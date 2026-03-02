import { TrainingTrackerDB } from '@storage/db'
import { ExportImportService } from './export-import-service'
import { ProgramAuthoringService } from './program-authoring-service'
import { SupabaseSyncService } from './supabase-sync-service'

function dbName() {
  return `supabase-sync-service-test-${crypto.randomUUID()}`
}

function okResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    async json() {
      return payload
    },
    async text() {
      return JSON.stringify(payload)
    },
  }
}

describe('SupabaseSyncService', () => {
  it('validates URL, anon key, and owner ID', async () => {
    const db = new TrainingTrackerDB(dbName())
    const service = new SupabaseSyncService(db, new ExportImportService(db))
    await db.open()

    expect(() =>
      service.validateConfig({
        url: 'not-a-url',
        anonKey: 'key',
        ownerId: 'owner',
      }),
    ).toThrow('Invalid Supabase URL')

    expect(() =>
      service.validateConfig({
        url: 'https://example.supabase.co',
        anonKey: '',
        ownerId: 'owner',
      }),
    ).toThrow('anon key is required')

    db.close()
    await db.delete()
  })

  it('maps owner_id and soft-delete fields for initial upload', async () => {
    const calls: Array<{ url: string; body?: unknown }> = []
    const fetchMock = async (input: string, init?: RequestInit) => {
      calls.push({
        url: input,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })
      return okResponse([])
    }

    const db = new TrainingTrackerDB(dbName())
    const programService = new ProgramAuthoringService(db)
    const syncService = new SupabaseSyncService(db, new ExportImportService(db), fetchMock)
    await db.open()

    const program = await programService.createProgram({ name: 'Upload Program' })
    const level = await programService.createLevel(program.id, { name: 'L1' })
    await programService.createMove(level.id, { name: 'Move 1' })

    await syncService.initialUpload({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
      ownerId: 'owner-1',
    })

    const programCall = calls.find((call) => call.url.includes('/programs?'))
    expect(programCall).toBeDefined()
    expect((programCall?.body as Array<Record<string, unknown>>)[0].owner_id).toBe('owner-1')
    expect((programCall?.body as Array<Record<string, unknown>>)[0].deleted_at).toBeNull()

    db.close()
    await db.delete()
  })

  it('downloads remote rows and imports them locally', async () => {
    const now = new Date().toISOString()
    const remoteData: Record<string, unknown[]> = {
      programs: [
        {
          id: 'program-1',
          owner_id: 'owner-1',
          name: 'Remote Program',
          description: '',
          goal: '',
          duration: '',
          difficulty: 'Beginner',
          tags: [],
          created_at: now,
          updated_at: now,
          deleted_at: null,
          custom_fields: {},
        },
      ],
      levels: [
        {
          id: 'level-1',
          owner_id: 'owner-1',
          program_id: 'program-1',
          name: 'Remote Level',
          description: '',
          order: 1,
          duration: '',
          rest_days: 0,
          notes: '',
          created_at: now,
          updated_at: now,
          deleted_at: null,
          custom_fields: {},
        },
      ],
      moves: [
        {
          id: 'move-1',
          owner_id: 'owner-1',
          level_id: 'level-1',
          name: 'Remote Move',
          description: '',
          type: 'Strength',
          equipment: [],
          notes: '',
          order: 1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          custom_fields: {},
        },
      ],
      logs: [],
      user_settings: [
        {
          owner_id: 'owner-1',
          sync_enabled: true,
          dark_mode: true,
          unit_preference: 'metric',
          updated_at: now,
          deleted_at: null,
        },
      ],
    }

    const fetchMock = async (input: string) => {
      const table = input.split('/rest/v1/')[1].split('?')[0]
      return okResponse(remoteData[table] ?? [])
    }

    const db = new TrainingTrackerDB(dbName())
    const syncService = new SupabaseSyncService(db, new ExportImportService(db), fetchMock)
    await db.open()

    await syncService.initialDownload(
      {
        url: 'https://example.supabase.co',
        anonKey: 'anon-key',
        ownerId: 'owner-1',
      },
      'replace',
    )

    expect((await db.programs.toArray()).map((program) => program.name)).toEqual(['Remote Program'])
    expect((await db.levels.toArray()).map((level) => level.name)).toEqual(['Remote Level'])
    expect((await db.moves.toArray()).map((move) => move.name)).toEqual(['Remote Move'])

    db.close()
    await db.delete()
  })
})
