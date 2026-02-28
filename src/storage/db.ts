import Dexie, { type Table } from 'dexie'
import type { Level, Move, Program, UserSettings, WorkoutLog } from '@shared/types'

export const DATABASE_NAME = 'TrainingTracker'
export const DATABASE_VERSION = 2

export interface SyncQueueItem {
  id: string
  entity: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload?: Record<string, unknown>
  createdAt: string
}

export interface SyncConflict {
  id: string
  entity: string
  entityId: string
  localUpdatedAt: string
  remoteUpdatedAt: string
  createdAt: string
}

export class TrainingTrackerDB extends Dexie {
  programs!: Table<Program, string>
  levels!: Table<Level, string>
  moves!: Table<Move, string>
  logs!: Table<WorkoutLog, string>
  settings!: Table<UserSettings, 'settings'>
  syncQueue!: Table<SyncQueueItem, string>
  conflicts!: Table<SyncConflict, string>

  constructor(name = DATABASE_NAME) {
    super(name)

    this.version(1).stores({
      programs: 'id, name, createdAt',
      levels: 'id, programId, [programId+order], order',
      moves: 'id, levelId, [levelId+order], order',
      logs: 'id, programId, levelId, moveId, date',
      settings: 'id',
    })

    this.version(DATABASE_VERSION)
      .stores({
        programs: 'id, name, createdAt',
        levels: 'id, programId, [programId+order], order',
        moves: 'id, levelId, [levelId+order], order',
        logs: 'id, programId, levelId, moveId, date',
        settings: 'id',
        sync_queue: 'id, entity, entityId, operation, createdAt',
        conflicts: 'id, entity, entityId, createdAt',
      })
      .upgrade(async (transaction) => {
        const settingsTable = transaction.table<UserSettings, 'settings'>('settings')
        const settings = await settingsTable.get('settings')

        if (!settings) {
          await settingsTable.put({
            id: 'settings',
            syncEnabled: false,
            darkMode: true,
            updatedAt: new Date().toISOString(),
          })
        }
      })

    this.programs = this.table('programs')
    this.levels = this.table('levels')
    this.moves = this.table('moves')
    this.logs = this.table('logs')
    this.settings = this.table('settings')
    this.syncQueue = this.table('sync_queue')
    this.conflicts = this.table('conflicts')
  }
}

export function createDatabase(name?: string) {
  return new TrainingTrackerDB(name)
}
