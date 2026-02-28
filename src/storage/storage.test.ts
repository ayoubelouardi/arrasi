import Dexie from 'dexie'
import type { Level, Move, Program } from '@shared/types'
import { TrainingTrackerDB } from './db'
import { TrainingRepository } from './repositories/training-repository'

function createProgram(id = 'program-1'): Program {
  const now = new Date().toISOString()

  return {
    id,
    name: 'Strength Builder',
    description: 'Build strength',
    goal: 'Gain strength',
    duration: '8 weeks',
    difficulty: 'Beginner',
    tags: ['strength'],
    createdAt: now,
    updatedAt: now,
    customFields: {},
  }
}

function createLevel(id = 'level-1', programId = 'program-1'): Level {
  const now = new Date().toISOString()

  return {
    id,
    programId,
    name: 'Week 1',
    description: 'Intro week',
    order: 1,
    duration: '1 week',
    restDays: 2,
    notes: '',
    createdAt: now,
    updatedAt: now,
    customFields: {},
  }
}

function createMove(id = 'move-1', levelId = 'level-1'): Move {
  const now = new Date().toISOString()

  return {
    id,
    levelId,
    name: 'Squat',
    description: 'Barbell squat',
    type: 'Strength',
    equipment: ['barbell'],
    notes: '',
    order: 1,
    createdAt: now,
    updatedAt: now,
    customFields: {},
  }
}

function dbName() {
  return `training-tracker-test-${crypto.randomUUID()}`
}

describe('TrainingTrackerDB', () => {
  it('supports basic CRUD through repositories', async () => {
    const name = dbName()
    const db = new TrainingTrackerDB(name)
    const repository = new TrainingRepository(db)
    const program = createProgram()

    await db.open()
    await repository.programs.put(program)

    const saved = await repository.programs.getById(program.id)
    expect(saved?.name).toBe('Strength Builder')

    await repository.programs.put({ ...program, name: 'Strength Builder Updated' })
    const updated = await repository.programs.getById(program.id)
    expect(updated?.name).toBe('Strength Builder Updated')

    await repository.programs.deleteById(program.id)
    const deleted = await repository.programs.getById(program.id)
    expect(deleted).toBeUndefined()

    db.close()
    await db.delete()
  })

  it('rolls back transaction and avoids orphan writes on failure', async () => {
    const name = dbName()
    const db = new TrainingTrackerDB(name)
    const repository = new TrainingRepository(db)
    const program = createProgram('program-rollback')
    const level = createLevel('level-rollback', program.id)
    const badMove = { ...createMove('move-rollback', level.id), id: undefined } as unknown as Move

    await db.open()

    await expect(
      repository.putProgramTree({
        program,
        levels: [level],
        moves: [badMove],
      }),
    ).rejects.toThrow()

    expect(await db.programs.get(program.id)).toBeUndefined()
    expect(await db.levels.get(level.id)).toBeUndefined()

    db.close()
    await db.delete()
  })

  it('migrates version 1 data to current schema', async () => {
    const name = dbName()

    class LegacyDB extends Dexie {
      constructor(databaseName: string) {
        super(databaseName)
        this.version(1).stores({
          programs: 'id, name, createdAt',
          levels: 'id, programId, [programId+order], order',
          moves: 'id, levelId, [levelId+order], order',
          logs: 'id, programId, levelId, moveId, date',
          settings: 'id',
        })
      }
    }

    const legacy = new LegacyDB(name)
    const program = createProgram('legacy-program')
    await legacy.open()
    await legacy.table<Program, string>('programs').put(program)
    legacy.close()

    const db = new TrainingTrackerDB(name)
    await db.open()

    const migratedProgram = await db.programs.get(program.id)
    const settings = await db.settings.get('settings')

    expect(migratedProgram?.id).toBe(program.id)
    expect(settings?.id).toBe('settings')
    expect(db.tables.map((table) => table.name)).toContain('sync_queue')
    expect(db.tables.map((table) => table.name)).toContain('conflicts')

    db.close()
    await db.delete()
  })
})
