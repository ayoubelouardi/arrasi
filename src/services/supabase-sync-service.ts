import type { ImportMode, Level, Move, Program, UserSettings, WorkoutLog } from '@shared/types'
import { TrainingTrackerDB } from '@storage/db'
import { ExportImportService, EXPORT_SCHEMA_VERSION, EXPORT_VERSION } from './export-import-service'

export interface SyncConfigInput {
  url: string
  anonKey: string
  ownerId: string
}

export type SyncConfig = SyncConfigInput

export type SyncEntity = 'programs' | 'levels' | 'moves' | 'logs' | 'user_settings'

export interface QueueMutationInput {
  entity: SyncEntity
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload?: Record<string, unknown>
}

interface QueueReplaySummary {
  processed: number
  succeeded: number
  conflicts: number
  failed: number
}

const RETRY_BASE_MS = 5_000
const RETRY_MAX_MS = 5 * 60_000

interface SupabaseResponse<T> {
  ok: boolean
  status: number
  json: () => Promise<T>
  text: () => Promise<string>
}

type FetchLike = (input: string, init?: RequestInit) => Promise<SupabaseResponse<unknown>>

function nowIso() {
  return new Date().toISOString()
}

function ensureSlashless(url: string) {
  return url.replace(/\/+$/, '')
}

function parseJsonErrorText(text: string) {
  if (!text) {
    return 'Unknown response error'
  }
  return text.length > 200 ? `${text.slice(0, 200)}...` : text
}

function updatedAtFromPayload(payload?: Record<string, unknown>) {
  const value = payload?.updatedAt ?? payload?.updated_at
  return typeof value === 'string' ? value : undefined
}

function retryDelayMs(attempts: number) {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts), RETRY_MAX_MS)
}

export class SupabaseSyncService {
  constructor(
    private readonly db: TrainingTrackerDB,
    private readonly exportImportService: ExportImportService,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  validateConfig(config: SyncConfigInput): SyncConfig {
    const url = ensureSlashless(config.url.trim())
    const anonKey = config.anonKey.trim()
    const ownerId = config.ownerId.trim()

    if (!url || !/^https?:\/\/.+/i.test(url)) {
      throw new Error('Invalid Supabase URL. Use an absolute http/https URL.')
    }
    if (!anonKey) {
      throw new Error('Supabase anon key is required.')
    }
    if (!ownerId) {
      throw new Error('Owner ID is required.')
    }

    return { url, anonKey, ownerId }
  }

  async saveConfig(config: SyncConfigInput) {
    const validated = this.validateConfig(config)
    const existing =
      (await this.db.settings.get('settings')) ??
      ({
        id: 'settings',
        darkMode: true,
        syncEnabled: false,
        updatedAt: nowIso(),
      } satisfies UserSettings)

    const next: UserSettings = {
      ...existing,
      syncEnabled: true,
      supabaseUrl: validated.url,
      supabaseAnonKey: validated.anonKey,
      syncOwnerId: validated.ownerId,
      updatedAt: nowIso(),
    }
    await this.db.settings.put(next)
    return next
  }

  async testConnection(config: SyncConfigInput) {
    const validated = this.validateConfig(config)
    await this.request('programs', validated, {
      method: 'GET',
      query: {
        select: 'id',
        owner_id: `eq.${validated.ownerId}`,
        limit: '1',
      },
    })
  }

  async initialUpload(config: SyncConfigInput) {
    const validated = this.validateConfig(config)
    const [programs, levels, moves, logs, settings] = await Promise.all([
      this.db.programs.toArray(),
      this.db.levels.toArray(),
      this.db.moves.toArray(),
      this.db.logs.toArray(),
      this.db.settings.get('settings'),
    ])

    await Promise.all([
      this.upsert('programs', validated, programs.map((program) => this.mapProgramToRemote(program, validated.ownerId))),
      this.upsert('levels', validated, levels.map((level) => this.mapLevelToRemote(level, validated.ownerId))),
      this.upsert('moves', validated, moves.map((move) => this.mapMoveToRemote(move, validated.ownerId))),
      this.upsert('logs', validated, logs.map((log) => this.mapLogToRemote(log, validated.ownerId))),
      this.upsert(
        'user_settings',
        validated,
        [
          this.mapSettingsToRemote(
            settings ?? {
              id: 'settings',
              syncEnabled: true,
              darkMode: true,
              updatedAt: nowIso(),
            },
            validated.ownerId,
          ),
        ],
      ),
    ])

    await this.saveConfig(validated)
    return {
      programs: programs.length,
      levels: levels.length,
      moves: moves.length,
      logs: logs.length,
    }
  }

  async initialDownload(config: SyncConfigInput, mode: ImportMode) {
    const validated = this.validateConfig(config)

    const [programsRaw, levelsRaw, movesRaw, logsRaw, settingsRaw] = await Promise.all([
      this.fetchRows('programs', validated),
      this.fetchRows('levels', validated),
      this.fetchRows('moves', validated),
      this.fetchRows('logs', validated),
      this.fetchRows('user_settings', validated),
    ])

    const payload = {
      version: EXPORT_VERSION,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportMode: 'full' as const,
      exportDate: nowIso(),
      data: {
        programs: programsRaw.map((row) => this.mapProgramFromRemote(row)),
        levels: levelsRaw.map((row) => this.mapLevelFromRemote(row)),
        moves: movesRaw.map((row) => this.mapMoveFromRemote(row)),
        logs: logsRaw.map((row) => this.mapLogFromRemote(row)),
        settings:
          settingsRaw[0] ? this.mapSettingsFromRemote(settingsRaw[0], validated) : this.fallbackSettings(validated),
      },
    }

    await this.exportImportService.importData(payload, mode)
    await this.saveConfig(validated)
    return {
      programs: payload.data.programs.length,
      levels: payload.data.levels.length,
      moves: payload.data.moves.length,
      logs: payload.data.logs.length,
    }
  }

  async enqueueMutation(input: QueueMutationInput) {
    const timestamp = nowIso()
    const item = {
      id: crypto.randomUUID(),
      entity: input.entity,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.db.syncQueue.put(item)
    return item
  }

  async replayQueue(config: SyncConfigInput): Promise<QueueReplaySummary> {
    const validated = this.validateConfig(config)
    const queue = await this.db.syncQueue.orderBy('createdAt').toArray()
    let processed = 0
    let succeeded = 0
    let conflicts = 0
    let failed = 0

    for (const item of queue) {
      if (item.nextRetryAt && item.nextRetryAt > nowIso()) {
        continue
      }

      processed += 1
      try {
        const conflict = await this.applyQueuedMutation(validated, item)
        if (conflict) {
          conflicts += 1
        } else {
          succeeded += 1
        }
      } catch (error) {
        failed += 1
        const attempts = (item.attempts ?? 0) + 1
        const delay = retryDelayMs(attempts - 1)
        await this.db.syncQueue.put({
          ...item,
          attempts,
          lastError: error instanceof Error ? error.message : 'Unknown queue replay error',
          nextRetryAt: new Date(Date.now() + delay).toISOString(),
          updatedAt: nowIso(),
        })
      }
    }

    await this.saveConfig(validated)
    return { processed, succeeded, conflicts, failed }
  }

  private fallbackSettings(config: SyncConfig): UserSettings {
    return {
      id: 'settings',
      darkMode: true,
      syncEnabled: true,
      supabaseUrl: config.url,
      supabaseAnonKey: config.anonKey,
      syncOwnerId: config.ownerId,
      updatedAt: nowIso(),
    }
  }

  private async fetchRows(table: string, config: SyncConfig) {
    return (await this.request(table, config, {
      method: 'GET',
      query: {
        select: '*',
        owner_id: `eq.${config.ownerId}`,
        deleted_at: 'is.null',
      },
    })) as Record<string, unknown>[]
  }

  private async upsert(table: string, config: SyncConfig, rows: Record<string, unknown>[]) {
    if (!rows.length) {
      return
    }
    await this.request(table, config, {
      method: 'POST',
      query: { on_conflict: table === 'user_settings' ? 'owner_id' : 'id' },
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    })
  }

  private async request(
    table: string,
    config: SyncConfig,
    options: {
      method: 'GET' | 'POST'
      query?: Record<string, string>
      headers?: Record<string, string>
      body?: string
    },
  ) {
    const search = new URLSearchParams(options.query).toString()
    const url = `${config.url}/rest/v1/${table}${search ? `?${search}` : ''}`
    const response = await this.fetchImpl(url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        ...options.headers,
      },
      body: options.body,
    })

    if (!response.ok) {
      throw new Error(`Supabase request failed (${table} ${response.status}): ${parseJsonErrorText(await response.text())}`)
    }

    return response.json()
  }

  private async applyQueuedMutation(config: SyncConfig, item: {
    id: string
    entity: string
    entityId: string
    operation: 'create' | 'update' | 'delete'
    payload?: Record<string, unknown>
  }) {
    const entity = item.entity as SyncEntity
    const remote = await this.fetchRemoteById(entity, item.entityId, config)
    const localUpdatedAt = updatedAtFromPayload(item.payload) ?? nowIso()
    const remoteUpdatedAt = this.remoteUpdatedAt(remote)

    if (remoteUpdatedAt && localUpdatedAt === remoteUpdatedAt) {
      await this.db.conflicts.put({
        id: crypto.randomUUID(),
        entity: item.entity,
        entityId: item.entityId,
        localUpdatedAt,
        remoteUpdatedAt,
        reason: 'equal-timestamp-remote-kept',
        localPayload: item.payload,
        remotePayload: remote ?? undefined,
        createdAt: nowIso(),
      })
      await this.db.syncQueue.delete(item.id)
      return true
    }

    if (remoteUpdatedAt && localUpdatedAt < remoteUpdatedAt) {
      await this.db.syncQueue.delete(item.id)
      return false
    }

    if (item.operation === 'delete') {
      await this.softDeleteRemote(entity, item.entityId, localUpdatedAt, config)
    } else {
      const row = this.buildRemotePayload(item.payload, item.entityId, config.ownerId, localUpdatedAt)
      await this.upsert(entity, config, [row])
    }

    await this.db.syncQueue.delete(item.id)
    return false
  }

  private async fetchRemoteById(entity: SyncEntity, entityId: string, config: SyncConfig) {
    if (entity === 'user_settings') {
      const rows = (await this.request('user_settings', config, {
        method: 'GET',
        query: {
          select: '*',
          owner_id: `eq.${config.ownerId}`,
          limit: '1',
        },
      })) as Record<string, unknown>[]
      return rows[0]
    }

    const rows = (await this.request(entity, config, {
      method: 'GET',
      query: {
        select: '*',
        owner_id: `eq.${config.ownerId}`,
        id: `eq.${entityId}`,
        limit: '1',
      },
    })) as Record<string, unknown>[]
    return rows[0]
  }

  private remoteUpdatedAt(row?: Record<string, unknown>) {
    if (!row) {
      return undefined
    }
    return typeof row.updated_at === 'string' ? row.updated_at : undefined
  }

  private buildRemotePayload(
    payload: Record<string, unknown> | undefined,
    entityId: string,
    ownerId: string,
    updatedAt: string,
  ): Record<string, unknown> {
    if (!payload) {
      return {
        id: entityId,
        owner_id: ownerId,
        updated_at: updatedAt,
        deleted_at: null,
      }
    }

    if ('owner_id' in payload) {
      return {
        ...payload,
        id: payload.id ?? entityId,
        owner_id: ownerId,
        updated_at: updatedAt,
        deleted_at: payload.deleted_at ?? null,
      }
    }

    return {
      ...payload,
      id: payload.id ?? entityId,
      owner_id: ownerId,
      updated_at: updatedAt,
      deleted_at: null,
    }
  }

  private async softDeleteRemote(entity: SyncEntity, entityId: string, updatedAt: string, config: SyncConfig) {
    const row =
      entity === 'user_settings'
        ? {
            owner_id: config.ownerId,
            deleted_at: nowIso(),
            updated_at: updatedAt,
          }
        : {
            id: entityId,
            owner_id: config.ownerId,
            deleted_at: nowIso(),
            updated_at: updatedAt,
          }
    await this.upsert(entity, config, [row])
  }

  private mapProgramToRemote(program: Program, ownerId: string) {
    return {
      id: program.id,
      owner_id: ownerId,
      name: program.name,
      description: program.description,
      goal: program.goal,
      duration: program.duration,
      difficulty: program.difficulty,
      tags: program.tags,
      created_at: program.createdAt,
      updated_at: program.updatedAt,
      deleted_at: null,
      color: program.color ?? null,
      custom_fields: program.customFields,
    }
  }

  private mapLevelToRemote(level: Level, ownerId: string) {
    return {
      id: level.id,
      owner_id: ownerId,
      program_id: level.programId,
      name: level.name,
      description: level.description,
      order: level.order,
      duration: level.duration,
      rest_days: level.restDays,
      notes: level.notes,
      created_at: level.createdAt,
      updated_at: level.updatedAt,
      deleted_at: null,
      custom_fields: level.customFields,
    }
  }

  private mapMoveToRemote(move: Move, ownerId: string) {
    return {
      id: move.id,
      owner_id: ownerId,
      level_id: move.levelId,
      name: move.name,
      description: move.description,
      type: move.type,
      target_sets: move.targetSets ?? null,
      target_reps: move.targetReps ?? null,
      target_weight: move.targetWeight ?? null,
      target_time: move.targetTime ?? null,
      rest_between_sets: move.restBetweenSets ?? null,
      video_url: move.videoUrl ?? null,
      image_url: move.imageUrl ?? null,
      equipment: move.equipment,
      notes: move.notes,
      order: move.order,
      created_at: move.createdAt,
      updated_at: move.updatedAt,
      deleted_at: null,
      custom_fields: move.customFields,
    }
  }

  private mapLogToRemote(log: WorkoutLog, ownerId: string) {
    return {
      id: log.id,
      owner_id: ownerId,
      program_id: log.programId,
      level_id: log.levelId,
      move_id: log.moveId ?? null,
      date: log.date,
      actual_sets: log.actualSets ?? null,
      actual_reps: log.actualReps ?? null,
      actual_weight: log.actualWeight ?? null,
      perceived_effort: log.perceivedEffort ?? null,
      notes: log.notes,
      completed: log.completed,
      created_at: log.createdAt,
      updated_at: log.updatedAt,
      deleted_at: null,
    }
  }

  private mapSettingsToRemote(settings: UserSettings, ownerId: string) {
    return {
      owner_id: ownerId,
      sync_enabled: settings.syncEnabled,
      dark_mode: settings.darkMode,
      unit_preference: settings.unitPreference ?? null,
      updated_at: settings.updatedAt,
      deleted_at: null,
    }
  }

  private mapProgramFromRemote(row: Record<string, unknown>): Program {
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      goal: String(row.goal ?? ''),
      duration: String(row.duration ?? ''),
      difficulty: (row.difficulty as Program['difficulty']) ?? 'Beginner',
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      color: row.color ? String(row.color) : undefined,
      createdAt: String(row.created_at ?? nowIso()),
      updatedAt: String(row.updated_at ?? nowIso()),
      customFields: (row.custom_fields as Record<string, unknown>) ?? {},
    }
  }

  private mapLevelFromRemote(row: Record<string, unknown>): Level {
    return {
      id: String(row.id),
      programId: String(row.program_id),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      order: Number(row.order ?? 1),
      duration: String(row.duration ?? ''),
      restDays: Number(row.rest_days ?? 0),
      notes: String(row.notes ?? ''),
      createdAt: String(row.created_at ?? nowIso()),
      updatedAt: String(row.updated_at ?? nowIso()),
      customFields: (row.custom_fields as Record<string, unknown>) ?? {},
    }
  }

  private mapMoveFromRemote(row: Record<string, unknown>): Move {
    return {
      id: String(row.id),
      levelId: String(row.level_id),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      type: (row.type as Move['type']) ?? 'Strength',
      targetSets: row.target_sets === null || row.target_sets === undefined ? undefined : Number(row.target_sets),
      targetReps: row.target_reps ? String(row.target_reps) : undefined,
      targetWeight: row.target_weight ? String(row.target_weight) : undefined,
      targetTime: row.target_time ? String(row.target_time) : undefined,
      restBetweenSets: row.rest_between_sets ? String(row.rest_between_sets) : undefined,
      videoUrl: row.video_url ? String(row.video_url) : undefined,
      imageUrl: row.image_url ? String(row.image_url) : undefined,
      equipment: Array.isArray(row.equipment) ? row.equipment.map(String) : [],
      notes: String(row.notes ?? ''),
      order: Number(row.order ?? 1),
      createdAt: String(row.created_at ?? nowIso()),
      updatedAt: String(row.updated_at ?? nowIso()),
      customFields: (row.custom_fields as Record<string, unknown>) ?? {},
    }
  }

  private mapLogFromRemote(row: Record<string, unknown>): WorkoutLog {
    return {
      id: String(row.id),
      programId: String(row.program_id),
      levelId: String(row.level_id),
      moveId: row.move_id ? String(row.move_id) : undefined,
      date: String(row.date ?? nowIso()),
      actualSets: row.actual_sets === null || row.actual_sets === undefined ? undefined : Number(row.actual_sets),
      actualReps: row.actual_reps ? String(row.actual_reps) : undefined,
      actualWeight: row.actual_weight ? String(row.actual_weight) : undefined,
      perceivedEffort:
        row.perceived_effort === null || row.perceived_effort === undefined ? undefined : Number(row.perceived_effort),
      notes: String(row.notes ?? ''),
      completed: Boolean(row.completed),
      createdAt: String(row.created_at ?? nowIso()),
      updatedAt: String(row.updated_at ?? nowIso()),
    }
  }

  private mapSettingsFromRemote(row: Record<string, unknown>, config: SyncConfig): UserSettings {
    return {
      id: 'settings',
      syncEnabled: Boolean(row.sync_enabled),
      darkMode: row.dark_mode === undefined ? true : Boolean(row.dark_mode),
      unitPreference: row.unit_preference ? (String(row.unit_preference) as 'metric' | 'imperial') : undefined,
      supabaseUrl: config.url,
      supabaseAnonKey: config.anonKey,
      syncOwnerId: config.ownerId,
      updatedAt: String(row.updated_at ?? nowIso()),
    }
  }
}

export function createSupabaseSyncService(db: TrainingTrackerDB, exportImportService: ExportImportService) {
  return new SupabaseSyncService(db, exportImportService)
}
