import { useEffect, useMemo, useState } from 'preact/hooks'
import { Toast } from './app/components'
import { HistoryPage } from './app/pages/history-page'
import { ProgramsPage } from './app/pages/programs-page'
import { SettingsPage } from './app/pages/settings-page'
import { TodayPage } from './app/pages/today-page'
import { TrainingTrackerDB } from './storage/db'
import type { ImportMode } from './shared/types'
import { ExportImportService, HistoryAnalyticsService, ProgramAuthoringService, SupabaseSyncService, WorkoutSessionService } from './services'
import type { SyncConfigInput } from './services/supabase-sync-service'

type TabId = 'programs' | 'today' | 'history' | 'settings'

const TABS: { id: TabId; label: string }[] = [
  { id: 'programs', label: 'Programs' },
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
]

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('programs')
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'info' | 'error' } | null>(null)

  const { db, programService, exportImportService, workoutSessionService, historyAnalyticsService, supabaseSyncService } =
    useMemo(() => {
      const database = new TrainingTrackerDB()
      return {
        db: database,
        programService: new ProgramAuthoringService(database),
        exportImportService: new ExportImportService(database),
        workoutSessionService: new WorkoutSessionService(database),
        historyAnalyticsService: new HistoryAnalyticsService(database),
        supabaseSyncService: new SupabaseSyncService(database, new ExportImportService(database)),
      }
    }, [])

  async function handleExportAll() {
    try {
      const payload = await exportImportService.exportAll()
      const json = JSON.stringify(payload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `arrasi-backup-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setToast({ message: 'Backup exported', tone: 'success' })
    } catch (error) {
      setToast({
        message: error instanceof Error ? `Export failed: ${error.message}` : 'Export failed',
        tone: 'error',
      })
    }
  }

  async function handleImportFile(file: File, mode: ImportMode) {
    try {
      const json = await file.text()
      const summary = await exportImportService.importJson(json, mode)
      setToast({
        message: `Import complete: ${summary.programs} programs, ${summary.levels} levels, ${summary.moves} moves`,
        tone: 'success',
      })
    } catch (error) {
      setToast({
        message: error instanceof Error ? `Import failed: ${error.message}` : 'Import failed',
        tone: 'error',
      })
    }
  }

  async function handleSaveSyncConfig(config: SyncConfigInput) {
    try {
      await supabaseSyncService.saveConfig(config)
      setToast({ message: 'Sync configuration saved', tone: 'success' })
    } catch (error) {
      setToast({
        message: error instanceof Error ? `Sync config failed: ${error.message}` : 'Sync config failed',
        tone: 'error',
      })
    }
  }

  async function handleTestSyncConnection(config: SyncConfigInput) {
    try {
      await supabaseSyncService.testConnection(config)
      setToast({ message: 'Supabase connection successful', tone: 'success' })
    } catch (error) {
      setToast({
        message: error instanceof Error ? `Connection test failed: ${error.message}` : 'Connection test failed',
        tone: 'error',
      })
    }
  }

  async function handleInitialUpload(config: SyncConfigInput) {
    try {
      const summary = await supabaseSyncService.initialUpload(config)
      setToast({
        message: `Upload complete: ${summary.programs} programs, ${summary.levels} levels, ${summary.moves} moves`,
        tone: 'success',
      })
    } catch (error) {
      setToast({
        message: error instanceof Error ? `Initial upload failed: ${error.message}` : 'Initial upload failed',
        tone: 'error',
      })
    }
  }

  async function handleInitialDownload(config: SyncConfigInput, mode: ImportMode) {
    try {
      const summary = await supabaseSyncService.initialDownload(config, mode)
      setToast({
        message: `Download complete: ${summary.programs} programs, ${summary.levels} levels, ${summary.moves} moves`,
        tone: 'success',
      })
    } catch (error) {
      setToast({
        message: error instanceof Error ? `Initial download failed: ${error.message}` : 'Initial download failed',
        tone: 'error',
      })
    }
  }

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 2500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  useEffect(() => {
    db.open().catch(() => {
      setToast({ message: 'Failed to initialize local database', tone: 'error' })
    })

    return () => {
      db.close()
    }
  }, [db])

  const page = useMemo(() => {
    switch (activeTab) {
      case 'programs':
        return <ProgramsPage service={programService} onNotify={setToast} />
      case 'today':
        return <TodayPage service={workoutSessionService} onNotify={setToast} />
      case 'history':
        return <HistoryPage service={historyAnalyticsService} onNotify={setToast} />
      case 'settings':
        return (
          <SettingsPage
            onSaveSettings={() => setToast({ message: 'Settings saved locally', tone: 'success' })}
            onExportAll={handleExportAll}
            onImportFile={handleImportFile}
            onSaveSyncConfig={handleSaveSyncConfig}
            onTestSyncConnection={handleTestSyncConnection}
            onInitialUpload={handleInitialUpload}
            onInitialDownload={handleInitialDownload}
          />
        )
      default:
        return null
    }
  }, [activeTab, programService, exportImportService, workoutSessionService, historyAnalyticsService, supabaseSyncService])

  function handleTabKeyDown(index: number, key: string) {
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      setActiveTab(TABS[(index + 1) % TABS.length].id)
      return true
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      setActiveTab(TABS[(index - 1 + TABS.length) % TABS.length].id)
      return true
    }
    if (key === 'Home') {
      setActiveTab(TABS[0].id)
      return true
    }
    if (key === 'End') {
      setActiveTab(TABS[TABS.length - 1].id)
      return true
    }
    return false
  }

  return (
    <div class="min-h-screen bg-zinc-950 text-zinc-100">
      <div class="mx-auto flex min-h-screen max-w-6xl">
        <aside class="hidden w-64 flex-col border-r border-zinc-800/80 p-4 md:flex">
          <h1 class="text-title-lg font-semibold text-emerald-400">الراسي · A-Rrasi</h1>
          <p class="mt-1 text-sm text-zinc-400">Personal Training Program & Tracker</p>
          <nav class="mt-6 flex flex-col gap-2" aria-label="Primary">
            {TABS.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                class={`rounded-xl px-3 py-2 text-left text-sm transition ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-zinc-300 hover:bg-zinc-800/70'
                }`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => {
                  if (handleTabKeyDown(index, event.key)) {
                    event.preventDefault()
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main class="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-8">
          <header class="mb-6 md:hidden">
            <h1 class="text-title-lg font-semibold text-emerald-400">الراسي · A-Rrasi</h1>
            <p class="text-sm text-zinc-400">Personal Training Program & Tracker</p>
          </header>
          {page}
        </main>
      </div>

      <nav class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 p-2 backdrop-blur md:hidden" aria-label="Primary">
        <ul class="mx-auto grid max-w-xl grid-cols-4 gap-2">
          {TABS.map((tab, index) => (
            <li key={tab.id}>
              <button
                type="button"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                class={`w-full rounded-lg px-2 py-2 text-xs transition ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-zinc-300 hover:bg-zinc-800/70'
                }`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => {
                  if (handleTabKeyDown(index, event.key)) {
                    event.preventDefault()
                  }
                }}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
    </div>
  )
}
