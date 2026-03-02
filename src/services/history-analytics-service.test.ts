import { TrainingTrackerDB } from '@storage/db'
import { ProgramAuthoringService } from './program-authoring-service'
import { HistoryAnalyticsService } from './history-analytics-service'

function dbName() {
  return `history-analytics-service-test-${crypto.randomUUID()}`
}

describe('HistoryAnalyticsService', () => {
  it('filters history by program and date range and computes progress metrics', async () => {
    const db = new TrainingTrackerDB(dbName())
    const programService = new ProgramAuthoringService(db)
    const service = new HistoryAnalyticsService(db)
    await db.open()

    const p1 = await programService.createProgram({ name: 'Program A' })
    const l1 = await programService.createLevel(p1.id, { name: 'L1' })
    const p2 = await programService.createProgram({ name: 'Program B' })
    const l2 = await programService.createLevel(p2.id, { name: 'L2' })

    const now = new Date()
    const todayIso = now.toISOString()
    const yesterday = new Date(now)
    yesterday.setUTCDate(now.getUTCDate() - 1)
    const yesterdayIso = yesterday.toISOString()

    await db.logs.bulkPut([
      {
        id: crypto.randomUUID(),
        programId: p1.id,
        levelId: l1.id,
        date: todayIso,
        completed: true,
        notes: 'done',
        createdAt: todayIso,
        updatedAt: todayIso,
        logMode: 'level',
      },
      {
        id: crypto.randomUUID(),
        programId: p1.id,
        levelId: l1.id,
        date: yesterdayIso,
        completed: false,
        notes: 'partial',
        createdAt: yesterdayIso,
        updatedAt: yesterdayIso,
        logMode: 'move',
      },
      {
        id: crypto.randomUUID(),
        programId: p2.id,
        levelId: l2.id,
        date: todayIso,
        completed: true,
        notes: 'other program',
        createdAt: todayIso,
        updatedAt: todayIso,
        logMode: 'level',
      },
    ])

    const filtered = await service.getHistoryData({
      programId: p1.id,
      dateFrom: yesterdayIso.slice(0, 10),
      dateTo: todayIso.slice(0, 10),
    })

    expect(filtered.entries).toHaveLength(2)
    expect(filtered.metrics.activityCount).toBe(2)
    expect(filtered.metrics.completedCount).toBe(1)
    expect(filtered.metrics.completionRate).toBe(50)
    expect(filtered.metrics.lastWorkoutSummary).toContain('Program A')
    expect(filtered.metrics.weeklyActivity.reduce((sum, item) => sum + item.count, 0)).toBe(2)

    db.close()
    await db.delete()
  })
})
