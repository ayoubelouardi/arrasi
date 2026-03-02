import { TrainingTrackerDB } from '@storage/db'
import { ProgramAuthoringService } from './program-authoring-service'
import { WorkoutSessionService } from './workout-session-service'

function dbName() {
  return `workout-session-service-test-${crypto.randomUUID()}`
}

describe('WorkoutSessionService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts a session and restores draft on reload', async () => {
    const db = new TrainingTrackerDB(dbName())
    const programService = new ProgramAuthoringService(db)
    const sessionService = new WorkoutSessionService(db)
    await db.open()

    const program = await programService.createProgram({ name: 'Strength' })
    const level = await programService.createLevel(program.id, { name: 'Week 1' })
    await programService.createMove(level.id, { name: 'Squat' })

    await sessionService.startSession()
    const snapshot = await sessionService.getTodaySnapshot()

    expect(snapshot.draft).not.toBeNull()
    expect(snapshot.target?.program.id).toBe(program.id)
    expect(snapshot.target?.level.id).toBe(level.id)
    expect(snapshot.target?.moves).toHaveLength(1)

    db.close()
    await db.delete()
  })

  it('completes session and persists completion across snapshot refresh', async () => {
    const db = new TrainingTrackerDB(dbName())
    const programService = new ProgramAuthoringService(db)
    const sessionService = new WorkoutSessionService(db)
    await db.open()

    const program = await programService.createProgram({ name: 'Conditioning' })
    const level = await programService.createLevel(program.id, { name: 'Base' })
    const move = await programService.createMove(level.id, { name: 'Run' })

    await sessionService.startSession()
    sessionService.updateMoveDraft(move.id, {
      completed: true,
      actualDistanceValue: 3,
      actualDistanceUnit: 'mi',
    })
    await sessionService.completeSession()
    const snapshot = await sessionService.getTodaySnapshot()
    const logs = await sessionService.queryLogs({ programId: program.id, levelId: level.id })

    expect(snapshot.draft).toBeNull()
    expect(snapshot.lastCompletion?.programId).toBe(program.id)
    expect(snapshot.lastCompletion?.levelId).toBe(level.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].moveId).toBe(move.id)
    expect(logs[0].actualDistanceValue).toBe(3)
    expect(logs[0].actualDistanceUnit).toBe('mi')
    expect(logs[0].normalizedDistanceKm).toBeCloseTo(4.828, 3)

    db.close()
    await db.delete()
  })

  it('cancels active draft and keeps no draft in snapshot', async () => {
    const db = new TrainingTrackerDB(dbName())
    const programService = new ProgramAuthoringService(db)
    const sessionService = new WorkoutSessionService(db)
    await db.open()

    const program = await programService.createProgram({ name: 'Mobility' })
    const level = await programService.createLevel(program.id, { name: 'Flow' })
    await programService.createMove(level.id, { name: 'Stretch' })

    await sessionService.startSession()
    sessionService.cancelSession()

    const snapshot = await sessionService.getTodaySnapshot()
    expect(snapshot.draft).toBeNull()

    db.close()
    await db.delete()
  })

  it('supports level-complete logging mode', async () => {
    const db = new TrainingTrackerDB(dbName())
    const programService = new ProgramAuthoringService(db)
    const sessionService = new WorkoutSessionService(db)
    await db.open()

    const program = await programService.createProgram({ name: 'Endurance' })
    const level = await programService.createLevel(program.id, { name: 'Week A' })
    await programService.createMove(level.id, { name: 'Tempo' })

    await sessionService.startSession()
    sessionService.updateDraftLevelComplete(true)
    await sessionService.completeSession()
    const logs = await sessionService.queryLogs({ programId: program.id, levelId: level.id })

    expect(logs).toHaveLength(1)
    expect(logs[0].logMode).toBe('level')
    expect(logs[0].moveId).toBeUndefined()
    expect(logs[0].completed).toBe(true)

    db.close()
    await db.delete()
  })
})
