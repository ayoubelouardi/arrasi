import type { Program, WorkoutLog } from '@shared/types'
import { TrainingTrackerDB } from '@storage/db'

export interface HistoryFilters {
  programId?: string
  dateFrom?: string
  dateTo?: string
}

export interface HistoryEntry {
  id: string
  date: string
  programId: string
  programName: string
  levelId: string
  levelName: string
  moveId?: string
  moveName?: string
  logMode?: 'level' | 'move'
  completed: boolean
  notes: string
}

export interface ProgressMetrics {
  activityCount: number
  completedCount: number
  completionRate: number
  lastWorkoutSummary: string | null
  weeklyActivity: { label: string; count: number }[]
}

export interface HistoryData {
  entries: HistoryEntry[]
  metrics: ProgressMetrics
}

export class HistoryAnalyticsService {
  constructor(private readonly db: TrainingTrackerDB) {}

  listPrograms(): Promise<Program[]> {
    return this.db.programs.orderBy('createdAt').toArray()
  }

  async getHistoryData(filters: HistoryFilters = {}): Promise<HistoryData> {
    const [logs, programs, levels, moves] = await Promise.all([
      this.db.logs.toArray(),
      this.db.programs.toArray(),
      this.db.levels.toArray(),
      this.db.moves.toArray(),
    ])

    const programMap = new Map(programs.map((program) => [program.id, program]))
    const levelMap = new Map(levels.map((level) => [level.id, level]))
    const moveMap = new Map(moves.map((move) => [move.id, move]))

    const filteredLogs = logs
      .filter((log) => this.matchesFilters(log, filters))
      .sort((a, b) => b.date.localeCompare(a.date))

    const entries: HistoryEntry[] = filteredLogs.map((log) => ({
      id: log.id,
      date: log.date,
      programId: log.programId,
      programName: programMap.get(log.programId)?.name ?? 'Unknown program',
      levelId: log.levelId,
      levelName: levelMap.get(log.levelId)?.name ?? 'Unknown level',
      moveId: log.moveId,
      moveName: log.moveId ? moveMap.get(log.moveId)?.name : undefined,
      logMode: log.logMode,
      completed: log.completed,
      notes: log.notes,
    }))

    const completedCount = filteredLogs.filter((log) => log.completed).length
    const activityCount = filteredLogs.length
    const completionRate = activityCount ? Number(((completedCount / activityCount) * 100).toFixed(2)) : 0
    const last = entries[0]
    const lastWorkoutSummary = last ? `${last.programName} · ${last.levelName} · ${new Date(last.date).toLocaleString()}` : null

    return {
      entries,
      metrics: {
        activityCount,
        completedCount,
        completionRate,
        lastWorkoutSummary,
        weeklyActivity: this.computeWeeklyActivity(filteredLogs),
      },
    }
  }

  private matchesFilters(log: WorkoutLog, filters: HistoryFilters) {
    if (filters.programId && filters.programId !== 'all' && log.programId !== filters.programId) {
      return false
    }
    if (filters.dateFrom && log.date < filters.dateFrom) {
      return false
    }
    if (filters.dateTo && log.date > `${filters.dateTo}T23:59:59.999Z`) {
      return false
    }
    return true
  }

  private computeWeeklyActivity(logs: WorkoutLog[]) {
    const byDay = new Map<string, number>()
    for (const log of logs) {
      const day = log.date.slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }

    const result: { label: string; count: number }[] = []
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today)
      date.setUTCDate(today.getUTCDate() - offset)
      const key = date.toISOString().slice(0, 10)
      result.push({
        label: key.slice(5),
        count: byDay.get(key) ?? 0,
      })
    }

    return result
  }
}

export function createHistoryAnalyticsService(db: TrainingTrackerDB) {
  return new HistoryAnalyticsService(db)
}
