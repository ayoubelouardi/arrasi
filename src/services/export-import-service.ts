import type {
  ImportMode,
  Level,
  Move,
  Program,
  TrainingDataExport,
  UserSettings,
  WorkoutLog,
} from '@shared/types'
import { TrainingTrackerDB } from '@storage/db'

export const EXPORT_VERSION = '1.0'
export const EXPORT_SCHEMA_VERSION = '1.0.0'

interface ImportSummary {
  programs: number
  levels: number
  moves: number
  logs: number
  settings: number
}

function nowIso() {
  return new Date().toISOString()
}

function getMajorVersion(version: string) {
  return version.split('.')[0]
}

function isNewerRecord<T extends { updatedAt: string }>(incoming: T, existing?: T) {
  if (!existing) {
    return true
  }

  const incomingTime = Date.parse(incoming.updatedAt)
  const existingTime = Date.parse(existing.updatedAt)

  if (Number.isNaN(incomingTime) || Number.isNaN(existingTime)) {
    return incoming.updatedAt >= existing.updatedAt
  }

  return incomingTime >= existingTime
}

function defaultSettings(): UserSettings {
  return {
    id: 'settings',
    syncEnabled: false,
    darkMode: true,
    updatedAt: nowIso(),
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertArray<T>(value: unknown, field: string): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid export format: data.${field} must be an array`)
  }
}

function assertEnvelope(payload: unknown): asserts payload is TrainingDataExport {
  if (!isObject(payload)) {
    throw new Error('Invalid export format: root payload must be an object')
  }

  if (typeof payload.schemaVersion !== 'string' || typeof payload.version !== 'string') {
    throw new Error('Invalid export format: version fields are required')
  }

  if (payload.exportMode !== 'full' && payload.exportMode !== 'program') {
    throw new Error('Invalid export format: exportMode must be "full" or "program"')
  }

  if (!isObject(payload.data)) {
    throw new Error('Invalid export format: data object is required')
  }

  assertArray<Program>(payload.data.programs, 'programs')
  assertArray<Level>(payload.data.levels, 'levels')
  assertArray<Move>(payload.data.moves, 'moves')
  assertArray<WorkoutLog>(payload.data.logs, 'logs')

  if (!isObject(payload.data.settings)) {
    throw new Error('Invalid export format: data.settings object is required')
  }
}

function validateReferentialIntegrity(data: TrainingDataExport['data']) {
  const programIds = new Set(data.programs.map((program) => program.id))
  const levelIds = new Set(data.levels.map((level) => level.id))
  const moveIds = new Set(data.moves.map((move) => move.id))

  for (const level of data.levels) {
    if (!programIds.has(level.programId)) {
      throw new Error(`Referential integrity failed: missing program ${level.programId} for level ${level.id}`)
    }
  }

  for (const move of data.moves) {
    if (!levelIds.has(move.levelId)) {
      throw new Error(`Referential integrity failed: missing level ${move.levelId} for move ${move.id}`)
    }
  }

  for (const log of data.logs) {
    if (!programIds.has(log.programId)) {
      throw new Error(`Referential integrity failed: missing program ${log.programId} for log ${log.id}`)
    }

    if (!levelIds.has(log.levelId)) {
      throw new Error(`Referential integrity failed: missing level ${log.levelId} for log ${log.id}`)
    }

    if (log.moveId && !moveIds.has(log.moveId)) {
      throw new Error(`Referential integrity failed: missing move ${log.moveId} for log ${log.id}`)
    }
  }
}

function sortByUpdatedAt<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
}

export class ExportImportService {
  constructor(private readonly db: TrainingTrackerDB) {}

  async exportAll(): Promise<TrainingDataExport> {
    const programs = await this.db.programs.toArray()
    const levels = await this.db.levels.toArray()
    const moves = await this.db.moves.toArray()
    const logs = await this.db.logs.toArray()
    const settings = (await this.db.settings.get('settings')) ?? defaultSettings()

    return {
      version: EXPORT_VERSION,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportMode: 'full',
      exportDate: nowIso(),
      data: {
        programs: sortByUpdatedAt(programs),
        levels: levels.sort((a, b) => a.order - b.order),
        moves: moves.sort((a, b) => a.order - b.order),
        logs: sortByUpdatedAt(logs),
        settings,
      },
    }
  }

  async exportProgram(programId: string, includeLogs = true): Promise<TrainingDataExport> {
    const program = await this.db.programs.get(programId)
    if (!program) {
      throw new Error(`Program not found: ${programId}`)
    }

    const levels = await this.db.levels.where('programId').equals(programId).sortBy('order')
    const levelIds = levels.map((level) => level.id)
    const moves = levelIds.length
      ? await this.db.moves.where('levelId').anyOf(levelIds).sortBy('order')
      : []
    const logs = includeLogs ? await this.db.logs.where('programId').equals(programId).toArray() : []
    const settings = (await this.db.settings.get('settings')) ?? defaultSettings()

    return {
      version: EXPORT_VERSION,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportMode: 'program',
      exportDate: nowIso(),
      data: {
        programs: [program],
        levels,
        moves,
        logs: sortByUpdatedAt(logs),
        settings,
      },
    }
  }

  async importJson(json: string, mode: ImportMode) {
    let payload: unknown

    try {
      payload = JSON.parse(json)
    } catch {
      throw new Error('Import failed: invalid JSON')
    }

    return this.importData(payload, mode)
  }

  async importData(payload: unknown, mode: ImportMode): Promise<ImportSummary> {
    assertEnvelope(payload)

    if (getMajorVersion(payload.schemaVersion) !== getMajorVersion(EXPORT_SCHEMA_VERSION)) {
      throw new Error(
        `Import failed: incompatible schema version ${payload.schemaVersion}, expected ${EXPORT_SCHEMA_VERSION}`,
      )
    }

    validateReferentialIntegrity(payload.data)

    const incomingPrograms = payload.data.programs
    const incomingLevels = payload.data.levels
    const incomingMoves = payload.data.moves
    const incomingLogs = payload.data.logs
    const incomingSettings = payload.data.settings as UserSettings

    await this.db.transaction(
      'rw',
      [this.db.programs, this.db.levels, this.db.moves, this.db.logs, this.db.settings],
      async () => {
        if (mode === 'replace') {
          await this.db.programs.clear()
          await this.db.levels.clear()
          await this.db.moves.clear()
          await this.db.logs.clear()
          await this.db.settings.clear()

          await this.db.programs.bulkPut(incomingPrograms)
          await this.db.levels.bulkPut(incomingLevels)
          await this.db.moves.bulkPut(incomingMoves)
          await this.db.logs.bulkPut(incomingLogs)
          await this.db.settings.put(incomingSettings)
          return
        }

        for (const program of incomingPrograms) {
          const existing = await this.db.programs.get(program.id)
          if (isNewerRecord(program, existing)) {
            await this.db.programs.put(program)
          }
        }

        for (const level of incomingLevels) {
          const existing = await this.db.levels.get(level.id)
          if (isNewerRecord(level, existing)) {
            await this.db.levels.put(level)
          }
        }

        for (const move of incomingMoves) {
          const existing = await this.db.moves.get(move.id)
          if (isNewerRecord(move, existing)) {
            await this.db.moves.put(move)
          }
        }

        for (const log of incomingLogs) {
          const existing = await this.db.logs.get(log.id)
          if (isNewerRecord(log, existing)) {
            await this.db.logs.put(log)
          }
        }

        const existingSettings = await this.db.settings.get('settings')
        if (isNewerRecord(incomingSettings, existingSettings)) {
          await this.db.settings.put(incomingSettings)
        }
      },
    )

    return {
      programs: incomingPrograms.length,
      levels: incomingLevels.length,
      moves: incomingMoves.length,
      logs: incomingLogs.length,
      settings: incomingSettings ? 1 : 0,
    }
  }
}

export function createExportImportService(db: TrainingTrackerDB) {
  return new ExportImportService(db)
}
