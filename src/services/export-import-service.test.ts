import type { TrainingDataExport } from '@shared/types'
import { TrainingTrackerDB } from '@storage/db'
import { ExportImportService, EXPORT_SCHEMA_VERSION } from './export-import-service'
import { ProgramAuthoringService } from './program-authoring-service'

function dbName() {
  return `export-import-service-test-${crypto.randomUUID()}`
}

describe('ExportImportService', () => {
  it('exports full data and re-imports it with replace mode', async () => {
    const sourceDb = new TrainingTrackerDB(dbName())
    const sourceProgramService = new ProgramAuthoringService(sourceDb)
    const sourceService = new ExportImportService(sourceDb)
    await sourceDb.open()

    const program = await sourceProgramService.createProgram({ name: 'Strength Builder' })
    const level = await sourceProgramService.createLevel(program.id, { name: 'Week 1' })
    const move = await sourceProgramService.createMove(level.id, { name: 'Squat' })
    await sourceDb.logs.put({
      id: crypto.randomUUID(),
      programId: program.id,
      levelId: level.id,
      moveId: move.id,
      date: new Date().toISOString(),
      notes: 'Good session',
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const exported = await sourceService.exportAll()
    sourceDb.close()
    await sourceDb.delete()

    const targetDb = new TrainingTrackerDB(dbName())
    const targetService = new ExportImportService(targetDb)
    await targetDb.open()
    await targetService.importData(exported, 'replace')

    expect((await targetDb.programs.toArray()).length).toBe(1)
    expect((await targetDb.levels.toArray()).length).toBe(1)
    expect((await targetDb.moves.toArray()).length).toBe(1)
    expect((await targetDb.logs.toArray()).length).toBe(1)

    targetDb.close()
    await targetDb.delete()
  })

  it('exports single-program payload with only related entities', async () => {
    const db = new TrainingTrackerDB(dbName())
    const programService = new ProgramAuthoringService(db)
    const exportService = new ExportImportService(db)
    await db.open()

    const p1 = await programService.createProgram({ name: 'Program A' })
    const l1 = await programService.createLevel(p1.id, { name: 'A1' })
    await programService.createMove(l1.id, { name: 'A1 Move' })
    await db.logs.put({
      id: crypto.randomUUID(),
      programId: p1.id,
      levelId: l1.id,
      date: new Date().toISOString(),
      notes: '',
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const p2 = await programService.createProgram({ name: 'Program B' })
    const l2 = await programService.createLevel(p2.id, { name: 'B1' })
    await programService.createMove(l2.id, { name: 'B1 Move' })

    const exported = await exportService.exportProgram(p1.id, true)
    expect(exported.exportMode).toBe('program')
    expect(exported.data.programs).toHaveLength(1)
    expect(exported.data.levels.every((level) => level.programId === p1.id)).toBe(true)
    expect(exported.data.logs.every((log) => log.programId === p1.id)).toBe(true)

    db.close()
    await db.delete()
  })

  it('rejects incompatible schema versions', async () => {
    const db = new TrainingTrackerDB(dbName())
    const service = new ExportImportService(db)
    await db.open()

    const payload: TrainingDataExport = {
      version: '1.0',
      schemaVersion: '2.0.0',
      exportMode: 'full',
      exportDate: new Date().toISOString(),
      data: {
        programs: [],
        levels: [],
        moves: [],
        logs: [],
        settings: {
          id: 'settings',
          syncEnabled: false,
          darkMode: true,
          updatedAt: new Date().toISOString(),
        },
      },
    }

    await expect(service.importData(payload, 'merge')).rejects.toThrow('incompatible schema version')

    db.close()
    await db.delete()
  })

  it('fails invalid references with no partial writes', async () => {
    const db = new TrainingTrackerDB(dbName())
    const service = new ExportImportService(db)
    await db.open()

    const payload: TrainingDataExport = {
      version: '1.0',
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportMode: 'full',
      exportDate: new Date().toISOString(),
      data: {
        programs: [],
        levels: [
          {
            id: 'level-1',
            programId: 'missing-program',
            name: 'Invalid level',
            description: '',
            order: 1,
            duration: '',
            restDays: 0,
            notes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            customFields: {},
          },
        ],
        moves: [],
        logs: [],
        settings: {
          id: 'settings',
          syncEnabled: false,
          darkMode: true,
          updatedAt: new Date().toISOString(),
        },
      },
    }

    await expect(service.importData(payload, 'replace')).rejects.toThrow('Referential integrity failed')

    expect(await db.programs.count()).toBe(0)
    expect(await db.levels.count()).toBe(0)
    expect(await db.moves.count()).toBe(0)
    expect(await db.logs.count()).toBe(0)

    db.close()
    await db.delete()
  })
})
