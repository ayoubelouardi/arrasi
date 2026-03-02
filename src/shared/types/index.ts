export type EntityId = string
export type ISODateString = string

export type ProgramDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'
export type MoveType = 'Strength' | 'Cardio' | 'Mobility' | 'Stretching' | 'Other'
export type ExportMode = 'full' | 'program'
export type ImportMode = 'merge' | 'replace'
export type WeightUnit = 'kg' | 'lb'
export type DistanceUnit = 'km' | 'mi'

export interface BaseEntity {
  id: EntityId
  createdAt: ISODateString
  updatedAt: ISODateString
}

export interface Program extends BaseEntity {
  name: string
  description: string
  goal: string
  duration: string
  difficulty: ProgramDifficulty
  tags: string[]
  color?: string
  customFields: Record<string, unknown>
}

export interface Level extends BaseEntity {
  programId: EntityId
  name: string
  description: string
  order: number
  duration: string
  restDays: number
  notes: string
  customFields: Record<string, unknown>
}

export interface Move extends BaseEntity {
  levelId: EntityId
  name: string
  description: string
  type: MoveType
  targetSets?: number
  targetReps?: string
  targetWeight?: string
  targetTime?: string
  restBetweenSets?: string
  videoUrl?: string
  imageUrl?: string
  equipment: string[]
  notes: string
  order: number
  customFields: Record<string, unknown>
}

export interface WorkoutLog extends BaseEntity {
  programId: EntityId
  levelId: EntityId
  moveId?: EntityId
  sessionId?: EntityId
  logMode?: 'level' | 'move'
  date: ISODateString
  actualSets?: number
  actualReps?: string
  actualWeight?: string
  actualWeightValue?: number
  actualWeightUnit?: WeightUnit
  normalizedWeightKg?: number
  actualDistance?: string
  actualDistanceValue?: number
  actualDistanceUnit?: DistanceUnit
  normalizedDistanceKm?: number
  perceivedEffort?: number
  notes: string
  completed: boolean
  metadata?: Record<string, unknown>
}

export interface UserSettings {
  id: 'settings'
  syncEnabled: boolean
  supabaseUrl?: string
  supabaseAnonKey?: string
  lastSync?: ISODateString
  darkMode: boolean
  unitPreference?: 'metric' | 'imperial'
  updatedAt: ISODateString
  customFields?: Record<string, unknown>
}

export interface TrainingDataExport {
  version: string
  schemaVersion: string
  exportMode: ExportMode
  exportDate: ISODateString
  data: {
    programs: Program[]
    levels: Level[]
    moves: Move[]
    logs: WorkoutLog[]
    settings: UserSettings
  }
}
