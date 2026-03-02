import type { DistanceUnit, Level, Move, Program, WeightUnit, WorkoutLog } from '@shared/types'
import { TrainingTrackerDB } from '@storage/db'

const DRAFT_KEY = 'arrasi:workout-session:draft'
const LAST_COMPLETION_KEY = 'arrasi:workout-session:last-completion'

interface SessionTarget {
  program: Program
  level: Level
  moves: Move[]
}

interface WorkoutSessionDraft {
  id: string
  programId: string
  levelId: string
  startedAt: string
  updatedAt: string
  levelCompleted: boolean
  notes: string
  moveLogs: DraftMoveLog[]
}

interface LastSessionCompletion {
  sessionId: string
  programId: string
  levelId: string
  completedAt: string
}

export interface TodaySessionSnapshot {
  target: SessionTarget | null
  draft: WorkoutSessionDraft | null
  lastCompletion: LastSessionCompletion | null
}

interface DraftMoveLog {
  moveId: string
  completed: boolean
  actualSets?: number
  actualReps?: string
  actualWeightValue?: number
  actualWeightUnit?: WeightUnit
  actualDistanceValue?: number
  actualDistanceUnit?: DistanceUnit
  notes?: string
}

interface MoveLogDraftInput {
  completed?: boolean
  actualSets?: number
  actualReps?: string
  actualWeightValue?: number
  actualWeightUnit?: WeightUnit
  actualDistanceValue?: number
  actualDistanceUnit?: DistanceUnit
  notes?: string
}

function nowIso() {
  return new Date().toISOString()
}

function readJson<T>(key: string): T | null {
  const value = localStorage.getItem(key)
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export class WorkoutSessionService {
  constructor(private readonly db: TrainingTrackerDB) {}

  async getTodaySnapshot(): Promise<TodaySessionSnapshot> {
    const target = await this.resolveTarget()
    const draft = this.getDraft()
    const lastCompletion = this.getLastCompletion()

    return {
      target,
      draft: draft && target ? draft : null,
      lastCompletion,
    }
  }

  async startSession() {
    const target = await this.resolveTarget()
    if (!target) {
      throw new Error('Cannot start session: no program or level configured')
    }

    const timestamp = nowIso()
    const draft: WorkoutSessionDraft = {
      id: crypto.randomUUID(),
      programId: target.program.id,
      levelId: target.level.id,
      startedAt: timestamp,
      updatedAt: timestamp,
      levelCompleted: false,
      notes: '',
      moveLogs: target.moves.map((move) => ({ moveId: move.id, completed: false })),
    }

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    return draft
  }

  resumeSession() {
    const draft = this.getDraft()
    if (!draft) {
      throw new Error('No draft session to resume')
    }

    const resumed = { ...draft, updatedAt: nowIso() }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(resumed))
    return resumed
  }

  updateDraftLevelComplete(completed: boolean) {
    const draft = this.requireDraft()
    const updated = {
      ...draft,
      levelCompleted: completed,
      updatedAt: nowIso(),
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(updated))
    return updated
  }

  updateDraftNotes(notes: string) {
    const draft = this.requireDraft()
    const updated = {
      ...draft,
      notes,
      updatedAt: nowIso(),
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(updated))
    return updated
  }

  updateMoveDraft(moveId: string, input: MoveLogDraftInput) {
    const draft = this.requireDraft()
    const existing = draft.moveLogs.find((entry) => entry.moveId === moveId) ?? { moveId, completed: false }
    const merged: DraftMoveLog = {
      ...existing,
      ...input,
    }
    const moveLogs = [...draft.moveLogs.filter((entry) => entry.moveId !== moveId), merged]
    const updated = {
      ...draft,
      moveLogs,
      updatedAt: nowIso(),
    }

    localStorage.setItem(DRAFT_KEY, JSON.stringify(updated))
    return updated
  }

  async queryLogs(filters: { programId?: string; levelId?: string; dateFrom?: string; dateTo?: string } = {}) {
    const logs = await this.db.logs.orderBy('date').toArray()

    return logs.filter((log) => {
      if (filters.programId && log.programId !== filters.programId) {
        return false
      }
      if (filters.levelId && log.levelId !== filters.levelId) {
        return false
      }
      if (filters.dateFrom && log.date < filters.dateFrom) {
        return false
      }
      if (filters.dateTo && log.date > filters.dateTo) {
        return false
      }
      return true
    })
  }

  async completeSession() {
    const draft = this.getDraft()
    if (!draft) {
      throw new Error('No active draft session to complete')
    }

    const completionTimestamp = nowIso()
    const logs = this.createLogsFromDraft(draft, completionTimestamp)
    await this.db.logs.bulkPut(logs)

    const completion: LastSessionCompletion = {
      sessionId: draft.id,
      programId: draft.programId,
      levelId: draft.levelId,
      completedAt: completionTimestamp,
    }

    localStorage.setItem(LAST_COMPLETION_KEY, JSON.stringify(completion))
    localStorage.removeItem(DRAFT_KEY)
    return completion
  }

  cancelSession() {
    this.requireDraft()

    localStorage.removeItem(DRAFT_KEY)
  }

  private getDraft() {
    return readJson<WorkoutSessionDraft>(DRAFT_KEY)
  }

  private requireDraft() {
    const draft = this.getDraft()
    if (!draft) {
      throw new Error('No active draft session')
    }
    return draft
  }

  private getLastCompletion() {
    return readJson<LastSessionCompletion>(LAST_COMPLETION_KEY)
  }

  private async resolveTarget(): Promise<SessionTarget | null> {
    const program = await this.db.programs.orderBy('createdAt').first()
    if (!program) {
      return null
    }

    const level = await this.db.levels.where('programId').equals(program.id).sortBy('order').then((levels) => levels[0])
    if (!level) {
      return null
    }

    const moves = await this.db.moves.where('levelId').equals(level.id).sortBy('order')
    return {
      program,
      level,
      moves,
    }
  }

  private createLogsFromDraft(draft: WorkoutSessionDraft, timestamp: string): WorkoutLog[] {
    const base = {
      programId: draft.programId,
      levelId: draft.levelId,
      date: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      sessionId: draft.id,
      notes: draft.notes,
    }

    if (draft.levelCompleted) {
      return [
        {
          id: crypto.randomUUID(),
          ...base,
          logMode: 'level',
          completed: true,
          metadata: {
            moveCount: draft.moveLogs.length,
          },
        },
      ]
    }

    return draft.moveLogs
      .filter((entry) => entry.completed || entry.actualSets || entry.actualReps || entry.actualWeightValue || entry.actualDistanceValue)
      .map((entry) => {
        const normalizedWeightKg =
          entry.actualWeightValue === undefined
            ? undefined
            : entry.actualWeightUnit === 'lb'
              ? Number((entry.actualWeightValue * 0.45359237).toFixed(3))
              : entry.actualWeightValue
        const normalizedDistanceKm =
          entry.actualDistanceValue === undefined
            ? undefined
            : entry.actualDistanceUnit === 'mi'
              ? Number((entry.actualDistanceValue * 1.609344).toFixed(3))
              : entry.actualDistanceValue

        return {
          id: crypto.randomUUID(),
          ...base,
          moveId: entry.moveId,
          logMode: 'move' as const,
          actualSets: entry.actualSets,
          actualReps: entry.actualReps,
          actualWeightValue: entry.actualWeightValue,
          actualWeightUnit: entry.actualWeightUnit,
          actualWeight:
            entry.actualWeightValue !== undefined && entry.actualWeightUnit
              ? `${entry.actualWeightValue} ${entry.actualWeightUnit}`
              : undefined,
          normalizedWeightKg,
          actualDistanceValue: entry.actualDistanceValue,
          actualDistanceUnit: entry.actualDistanceUnit,
          actualDistance:
            entry.actualDistanceValue !== undefined && entry.actualDistanceUnit
              ? `${entry.actualDistanceValue} ${entry.actualDistanceUnit}`
              : undefined,
          normalizedDistanceKm,
          notes: entry.notes?.trim() || draft.notes,
          completed: entry.completed,
        }
      })
  }
}

export function createWorkoutSessionService(db: TrainingTrackerDB) {
  return new WorkoutSessionService(db)
}
