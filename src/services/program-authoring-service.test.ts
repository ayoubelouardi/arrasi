import { TrainingTrackerDB } from '@storage/db'
import { ProgramAuthoringService } from './program-authoring-service'

function dbName() {
  return `program-authoring-service-test-${crypto.randomUUID()}`
}

describe('ProgramAuthoringService', () => {
  it('supports CRUD for program, level, and move', async () => {
    const db = new TrainingTrackerDB(dbName())
    const service = new ProgramAuthoringService(db)
    await db.open()

    const program = await service.createProgram({
      name: 'Strength Builder',
      goal: 'Build strength',
    })
    const createdProgram = await service.getProgram(program.id)
    expect(createdProgram?.name).toBe('Strength Builder')

    const updatedProgram = await service.updateProgram(program.id, { name: 'Strength Builder v2' })
    expect(updatedProgram.name).toBe('Strength Builder v2')

    const level = await service.createLevel(program.id, { name: 'Week 1' })
    expect(level.order).toBe(1)

    const move = await service.createMove(level.id, { name: 'Squat' })
    expect(move.order).toBe(1)

    await service.deleteMove(move.id)
    await service.deleteLevel(level.id)
    await service.deleteProgram(program.id)

    expect(await service.getProgram(program.id)).toBeUndefined()

    db.close()
    await db.delete()
  })

  it('duplicates and cascades program tree correctly', async () => {
    const db = new TrainingTrackerDB(dbName())
    const service = new ProgramAuthoringService(db)
    await db.open()

    const sourceProgram = await service.createProgram({ name: 'Marathon Prep' })
    const levelOne = await service.createLevel(sourceProgram.id, { name: 'Phase 1' })
    const levelTwo = await service.createLevel(sourceProgram.id, { name: 'Phase 2' })
    await service.createMove(levelOne.id, { name: 'Easy Run' })
    await service.createMove(levelOne.id, { name: 'Intervals' })
    await service.createMove(levelTwo.id, { name: 'Long Run' })

    const duplicate = await service.duplicateProgram(sourceProgram.id)
    expect(duplicate.program.id).not.toBe(sourceProgram.id)
    expect(duplicate.levels).toHaveLength(2)
    expect(duplicate.moves).toHaveLength(3)
    expect(new Set(duplicate.levels.map((level) => level.order))).toEqual(new Set([1, 2]))

    await service.deleteProgram(sourceProgram.id)
    const allPrograms = await service.listPrograms()
    expect(allPrograms.map((program) => program.id)).toEqual([duplicate.program.id])

    db.close()
    await db.delete()
  })

  it('enforces referential integrity and contiguous ordering', async () => {
    const db = new TrainingTrackerDB(dbName())
    const service = new ProgramAuthoringService(db)
    await db.open()

    await expect(service.createLevel('missing-program', { name: 'Invalid' })).rejects.toThrow(
      'Program not found',
    )

    const program = await service.createProgram({ name: 'Hypertrophy' })
    const levelA = await service.createLevel(program.id, { name: 'A' })
    await service.createLevel(program.id, { name: 'B' })
    const levelC = await service.createLevel(program.id, { name: 'C' })

    const reordered = await service.updateLevel(levelC.id, { order: 1 })
    expect(reordered.order).toBe(1)

    const levels = await service.listLevels(program.id)
    expect(levels.map((level) => level.name)).toEqual(['C', 'A', 'B'])
    expect(levels.map((level) => level.order)).toEqual([1, 2, 3])

    await expect(service.createMove('missing-level', { name: 'Invalid Move' })).rejects.toThrow(
      'Level not found',
    )

    const move1 = await service.createMove(levelA.id, { name: 'Bench Press' })
    const move2 = await service.createMove(levelA.id, { name: 'Pull-Up' })
    const move3 = await service.duplicateMove(move1.id)

    expect(move3.order).toBe(2)
    await service.deleteMove(move2.id)

    const moves = await service.listMoves(levelA.id)
    expect(moves.map((move) => move.order)).toEqual([1, 2])

    const duplicateLevel = await service.duplicateLevel(levelA.id)
    expect(duplicateLevel.moves).toHaveLength(2)

    const levelsAfterDuplication = await service.listLevels(program.id)
    expect(levelsAfterDuplication.map((level) => level.order)).toEqual([1, 2, 3, 4])

    db.close()
    await db.delete()
  })

  it('cascades level deletion to its moves', async () => {
    const db = new TrainingTrackerDB(dbName())
    const service = new ProgramAuthoringService(db)
    await db.open()

    const program = await service.createProgram({ name: 'Powerlifting' })
    const level = await service.createLevel(program.id, { name: 'Block 1' })
    await service.createMove(level.id, { name: 'Deadlift' })

    await service.deleteLevel(level.id)

    const moves = await service.listMoves(level.id)
    expect(moves).toHaveLength(0)

    db.close()
    await db.delete()
  })
})
