import type { Level, Move, Program, ProgramDifficulty, MoveType } from '@shared/types'
import { TrainingTrackerDB } from '@storage/db'
import { TrainingRepository } from '@storage/repositories/training-repository'

interface ProgramInput {
  name: string
  description?: string
  goal?: string
  duration?: string
  difficulty?: ProgramDifficulty
  tags?: string[]
  color?: string
  customFields?: Record<string, unknown>
}

interface LevelInput {
  name: string
  description?: string
  duration?: string
  restDays?: number
  notes?: string
  order?: number
  customFields?: Record<string, unknown>
}

interface MoveInput {
  name: string
  description?: string
  type?: MoveType
  targetSets?: number
  targetReps?: string
  targetWeight?: string
  targetTime?: string
  restBetweenSets?: string
  videoUrl?: string
  imageUrl?: string
  equipment?: string[]
  notes?: string
  order?: number
  customFields?: Record<string, unknown>
}

interface ProgramTree {
  program: Program
  levels: Level[]
  moves: Move[]
}

function nowIso() {
  return new Date().toISOString()
}

function createEntityId() {
  return crypto.randomUUID()
}

function clampInsertionOrder(order: number | undefined, count: number) {
  if (!order || Number.isNaN(order)) {
    return count + 1
  }

  return Math.min(Math.max(1, Math.floor(order)), count + 1)
}

function normalizeOrdered<T extends { id: string; order: number }>(
  entities: T[],
  target: { id: string; desiredOrder: number },
) {
  const filtered = entities.filter((entity) => entity.id !== target.id).sort((a, b) => a.order - b.order)
  const insertionIndex = Math.max(0, Math.min(target.desiredOrder - 1, filtered.length))
  const targetEntity = entities.find((entity) => entity.id === target.id)

  if (!targetEntity) {
    return filtered
  }

  filtered.splice(insertionIndex, 0, targetEntity)
  return filtered.map((entity, index) => ({ ...entity, order: index + 1 }))
}

export class ProgramAuthoringService {
  private readonly repository: TrainingRepository

  constructor(private readonly db: TrainingTrackerDB) {
    this.repository = new TrainingRepository(db)
  }

  listPrograms() {
    return this.db.programs.orderBy('createdAt').toArray()
  }

  getProgram(programId: string) {
    return this.db.programs.get(programId)
  }

  async createProgram(input: ProgramInput) {
    const timestamp = nowIso()
    const program: Program = {
      id: createEntityId(),
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      goal: input.goal?.trim() ?? '',
      duration: input.duration?.trim() ?? '',
      difficulty: input.difficulty ?? 'Beginner',
      tags: input.tags ?? [],
      color: input.color,
      customFields: input.customFields ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await this.repository.programs.put(program)
    return program
  }

  async updateProgram(programId: string, patch: Partial<ProgramInput>) {
    const existing = await this.requireProgram(programId)
    const updated: Program = {
      ...existing,
      name: patch.name?.trim() ?? existing.name,
      description: patch.description?.trim() ?? existing.description,
      goal: patch.goal?.trim() ?? existing.goal,
      duration: patch.duration?.trim() ?? existing.duration,
      difficulty: patch.difficulty ?? existing.difficulty,
      tags: patch.tags ?? existing.tags,
      color: patch.color ?? existing.color,
      customFields: patch.customFields ?? existing.customFields,
      updatedAt: nowIso(),
    }

    await this.repository.programs.put(updated)
    return updated
  }

  async deleteProgram(programId: string) {
    await this.requireProgram(programId)
    await this.repository.deleteProgramCascade(programId)
  }

  async duplicateProgram(programId: string) {
    const program = await this.requireProgram(programId)
    const levels = await this.db.levels.where('programId').equals(program.id).sortBy('order')
    const levelIds = levels.map((level) => level.id)
    const moves = levelIds.length
      ? await this.db.moves.where('levelId').anyOf(levelIds).sortBy('order')
      : []

    const timestamp = nowIso()
    const duplicateProgram: Program = {
      ...program,
      id: createEntityId(),
      name: `${program.name} (Copy)`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const levelIdMap = new Map<string, string>()
    const duplicateLevels = levels.map((level, index) => {
      const newId = createEntityId()
      levelIdMap.set(level.id, newId)

      return {
        ...level,
        id: newId,
        programId: duplicateProgram.id,
        order: index + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    })

    const duplicateMoves = moves
      .sort((a, b) => a.order - b.order)
      .map((move) => ({
        ...move,
        id: createEntityId(),
        levelId: levelIdMap.get(move.levelId) ?? move.levelId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }))

    await this.repository.putProgramTree({
      program: duplicateProgram,
      levels: duplicateLevels,
      moves: duplicateMoves,
    })

    return {
      program: duplicateProgram,
      levels: duplicateLevels,
      moves: duplicateMoves,
    }
  }

  listLevels(programId: string) {
    return this.db.levels.where('programId').equals(programId).sortBy('order')
  }

  async createLevel(programId: string, input: LevelInput) {
    await this.requireProgram(programId)
    const existing = await this.listLevels(programId)
    const order = clampInsertionOrder(input.order, existing.length)
    const timestamp = nowIso()
    const level: Level = {
      id: createEntityId(),
      programId,
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      order,
      duration: input.duration?.trim() ?? '',
      restDays: input.restDays ?? 0,
      notes: input.notes?.trim() ?? '',
      customFields: input.customFields ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const normalized = normalizeOrdered([...existing, level], { id: level.id, desiredOrder: order })
    await this.db.transaction('rw', this.db.levels, async () => {
      await this.db.levels.bulkPut(normalized)
    })

    return normalized.find((entity) => entity.id === level.id) as Level
  }

  async updateLevel(levelId: string, patch: Partial<LevelInput>) {
    const existingLevel = await this.requireLevel(levelId)
    const siblings = await this.listLevels(existingLevel.programId)
    const desiredOrder = clampInsertionOrder(patch.order ?? existingLevel.order, siblings.length)

    const updatedLevel: Level = {
      ...existingLevel,
      name: patch.name?.trim() ?? existingLevel.name,
      description: patch.description?.trim() ?? existingLevel.description,
      duration: patch.duration?.trim() ?? existingLevel.duration,
      restDays: patch.restDays ?? existingLevel.restDays,
      notes: patch.notes?.trim() ?? existingLevel.notes,
      customFields: patch.customFields ?? existingLevel.customFields,
      order: desiredOrder,
      updatedAt: nowIso(),
    }

    const normalized = normalizeOrdered(
      siblings.map((level) => (level.id === levelId ? updatedLevel : level)),
      { id: levelId, desiredOrder },
    )

    await this.db.transaction('rw', this.db.levels, async () => {
      await this.db.levels.bulkPut(normalized)
    })

    return normalized.find((level) => level.id === levelId) as Level
  }

  async deleteLevel(levelId: string) {
    const level = await this.requireLevel(levelId)

    await this.db.transaction('rw', this.db.levels, this.db.moves, this.db.logs, async () => {
      await this.db.logs.where('levelId').equals(levelId).delete()
      await this.db.moves.where('levelId').equals(levelId).delete()
      await this.db.levels.delete(levelId)

      const siblings = await this.db.levels.where('programId').equals(level.programId).sortBy('order')
      const normalized = siblings.map((sibling, index) => ({ ...sibling, order: index + 1 }))
      await this.db.levels.bulkPut(normalized)
    })
  }

  async duplicateLevel(levelId: string) {
    const level = await this.requireLevel(levelId)
    const siblings = await this.listLevels(level.programId)
    const moves = await this.db.moves.where('levelId').equals(levelId).sortBy('order')
    const timestamp = nowIso()
    const duplicateId = createEntityId()
    const duplicate: Level = {
      ...level,
      id: duplicateId,
      name: `${level.name} (Copy)`,
      order: level.order + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const normalized = normalizeOrdered([...siblings, duplicate], {
      id: duplicateId,
      desiredOrder: duplicate.order,
    })

    const duplicatedMoves = moves.map((move) => ({
      ...move,
      id: createEntityId(),
      levelId: duplicateId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))

    await this.db.transaction('rw', this.db.levels, this.db.moves, async () => {
      await this.db.levels.bulkPut(normalized)
      if (duplicatedMoves.length) {
        await this.db.moves.bulkPut(duplicatedMoves)
      }
    })

    return {
      level: normalized.find((item) => item.id === duplicateId) as Level,
      moves: duplicatedMoves,
    }
  }

  listMoves(levelId: string) {
    return this.db.moves.where('levelId').equals(levelId).sortBy('order')
  }

  async createMove(levelId: string, input: MoveInput) {
    await this.requireLevel(levelId)
    const existing = await this.listMoves(levelId)
    const order = clampInsertionOrder(input.order, existing.length)
    const timestamp = nowIso()
    const move: Move = {
      id: createEntityId(),
      levelId,
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      type: input.type ?? 'Strength',
      targetSets: input.targetSets,
      targetReps: input.targetReps,
      targetWeight: input.targetWeight,
      targetTime: input.targetTime,
      restBetweenSets: input.restBetweenSets,
      videoUrl: input.videoUrl,
      imageUrl: input.imageUrl,
      equipment: input.equipment ?? [],
      notes: input.notes?.trim() ?? '',
      order,
      customFields: input.customFields ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const normalized = normalizeOrdered([...existing, move], { id: move.id, desiredOrder: order })
    await this.db.transaction('rw', this.db.moves, async () => {
      await this.db.moves.bulkPut(normalized)
    })

    return normalized.find((entity) => entity.id === move.id) as Move
  }

  async updateMove(moveId: string, patch: Partial<MoveInput>) {
    const existingMove = await this.requireMove(moveId)
    const siblings = await this.listMoves(existingMove.levelId)
    const desiredOrder = clampInsertionOrder(patch.order ?? existingMove.order, siblings.length)
    const updatedMove: Move = {
      ...existingMove,
      name: patch.name?.trim() ?? existingMove.name,
      description: patch.description?.trim() ?? existingMove.description,
      type: patch.type ?? existingMove.type,
      targetSets: patch.targetSets ?? existingMove.targetSets,
      targetReps: patch.targetReps ?? existingMove.targetReps,
      targetWeight: patch.targetWeight ?? existingMove.targetWeight,
      targetTime: patch.targetTime ?? existingMove.targetTime,
      restBetweenSets: patch.restBetweenSets ?? existingMove.restBetweenSets,
      videoUrl: patch.videoUrl ?? existingMove.videoUrl,
      imageUrl: patch.imageUrl ?? existingMove.imageUrl,
      equipment: patch.equipment ?? existingMove.equipment,
      notes: patch.notes?.trim() ?? existingMove.notes,
      customFields: patch.customFields ?? existingMove.customFields,
      order: desiredOrder,
      updatedAt: nowIso(),
    }
    const normalized = normalizeOrdered(
      siblings.map((move) => (move.id === moveId ? updatedMove : move)),
      { id: moveId, desiredOrder },
    )

    await this.db.transaction('rw', this.db.moves, async () => {
      await this.db.moves.bulkPut(normalized)
    })

    return normalized.find((move) => move.id === moveId) as Move
  }

  async deleteMove(moveId: string) {
    const move = await this.requireMove(moveId)
    await this.db.transaction('rw', this.db.moves, async () => {
      await this.db.moves.delete(moveId)

      const siblings = await this.db.moves.where('levelId').equals(move.levelId).sortBy('order')
      const normalized = siblings.map((sibling, index) => ({ ...sibling, order: index + 1 }))
      await this.db.moves.bulkPut(normalized)
    })
  }

  async duplicateMove(moveId: string) {
    const move = await this.requireMove(moveId)
    const siblings = await this.listMoves(move.levelId)
    const timestamp = nowIso()
    const duplicate: Move = {
      ...move,
      id: createEntityId(),
      name: `${move.name} (Copy)`,
      order: move.order + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const normalized = normalizeOrdered([...siblings, duplicate], {
      id: duplicate.id,
      desiredOrder: duplicate.order,
    })

    await this.db.transaction('rw', this.db.moves, async () => {
      await this.db.moves.bulkPut(normalized)
    })

    return normalized.find((item) => item.id === duplicate.id) as Move
  }

  async getProgramTree(programId: string): Promise<ProgramTree> {
    const program = await this.requireProgram(programId)
    const levels = await this.db.levels.where('programId').equals(programId).sortBy('order')
    const levelIds = levels.map((level) => level.id)
    const moves = levelIds.length
      ? await this.db.moves.where('levelId').anyOf(levelIds).sortBy('order')
      : []

    return { program, levels, moves }
  }

  private async requireProgram(programId: string) {
    const program = await this.db.programs.get(programId)

    if (!program) {
      throw new Error(`Program not found: ${programId}`)
    }

    return program
  }

  private async requireLevel(levelId: string) {
    const level = await this.db.levels.get(levelId)

    if (!level) {
      throw new Error(`Level not found: ${levelId}`)
    }

    const program = await this.db.programs.get(level.programId)
    if (!program) {
      throw new Error(`Referential integrity violation: missing program ${level.programId}`)
    }

    return level
  }

  private async requireMove(moveId: string) {
    const move = await this.db.moves.get(moveId)

    if (!move) {
      throw new Error(`Move not found: ${moveId}`)
    }

    const level = await this.db.levels.get(move.levelId)
    if (!level) {
      throw new Error(`Referential integrity violation: missing level ${move.levelId}`)
    }

    return move
  }
}

export function createProgramAuthoringService(db: TrainingTrackerDB) {
  return new ProgramAuthoringService(db)
}
