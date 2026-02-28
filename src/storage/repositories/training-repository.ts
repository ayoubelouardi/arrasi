import type { Level, Move, Program, WorkoutLog } from '@shared/types'
import { BaseRepository } from './base-repository'
import { TrainingTrackerDB } from '../db'

interface ProgramTreeInput {
  program: Program
  levels: Level[]
  moves: Move[]
}

export class TrainingRepository {
  readonly programs: BaseRepository<Program>
  readonly levels: BaseRepository<Level>
  readonly moves: BaseRepository<Move>
  readonly logs: BaseRepository<WorkoutLog>

  constructor(private readonly db: TrainingTrackerDB) {
    this.programs = new BaseRepository(db.programs)
    this.levels = new BaseRepository(db.levels)
    this.moves = new BaseRepository(db.moves)
    this.logs = new BaseRepository(db.logs)
  }

  async putProgramTree(input: ProgramTreeInput) {
    await this.db.transaction('rw', this.db.programs, this.db.levels, this.db.moves, async () => {
      await this.db.programs.put(input.program)
      await this.db.levels.bulkPut(input.levels)
      await this.db.moves.bulkPut(input.moves)
    })
  }

  async deleteProgramCascade(programId: string) {
    await this.db.transaction('rw', this.db.programs, this.db.levels, this.db.moves, this.db.logs, async () => {
      const levelIds = await this.db.levels.where('programId').equals(programId).primaryKeys()
      await this.db.logs.where('programId').equals(programId).delete()

      for (const levelId of levelIds) {
        await this.db.moves.where('levelId').equals(levelId).delete()
      }

      await this.db.levels.where('programId').equals(programId).delete()
      await this.db.programs.delete(programId)
    })
  }
}
