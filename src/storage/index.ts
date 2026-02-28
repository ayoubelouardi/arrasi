import { createDatabase } from './db'
import { TrainingRepository } from './repositories/training-repository'

export function createStorage(name?: string) {
  const db = createDatabase(name)
  const repositories = new TrainingRepository(db)

  return {
    db,
    repositories,
  }
}

export type StorageContext = ReturnType<typeof createStorage>
