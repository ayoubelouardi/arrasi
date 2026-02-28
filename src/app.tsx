import { useEffect, useMemo, useState } from 'preact/hooks'
import { Modal, Toast } from './app/components'
import { HistoryPage } from './app/pages/history-page'
import { ProgramsPage } from './app/pages/programs-page'
import { SettingsPage } from './app/pages/settings-page'
import { TodayPage } from './app/pages/today-page'

type TabId = 'programs' | 'today' | 'history' | 'settings'

const TABS: { id: TabId; label: string }[] = [
  { id: 'programs', label: 'Programs' },
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
]

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('programs')
  const [isStartModalOpen, setIsStartModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null)
    }, 2500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toastMessage])

  const page = useMemo(() => {
    switch (activeTab) {
      case 'programs':
        return <ProgramsPage />
      case 'today':
        return <TodayPage onStartWorkout={() => setIsStartModalOpen(true)} />
      case 'history':
        return <HistoryPage />
      case 'settings':
        return <SettingsPage onSaveSettings={() => setToastMessage('Settings saved locally')} />
      default:
        return null
    }
  }, [activeTab])

  return (
    <div class="min-h-screen bg-zinc-950 text-zinc-100">
      <div class="mx-auto flex min-h-screen max-w-6xl">
        <aside class="hidden w-64 flex-col border-r border-zinc-800/80 p-4 md:flex">
          <h1 class="text-title-lg font-semibold text-emerald-400">الراسي · A-Rrasi</h1>
          <p class="mt-1 text-sm text-zinc-400">Personal Training Program & Tracker</p>
          <nav class="mt-6 flex flex-col gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                class={`rounded-xl px-3 py-2 text-left text-sm transition ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-zinc-300 hover:bg-zinc-800/70'
                }`}
                onClick={() => setActiveTab(tab.id)}
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

      <nav class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 p-2 backdrop-blur md:hidden">
        <ul class="mx-auto grid max-w-xl grid-cols-4 gap-2">
          {TABS.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                class={`w-full rounded-lg px-2 py-2 text-xs transition ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-zinc-300 hover:bg-zinc-800/70'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <Modal
        open={isStartModalOpen}
        title="Start workout session?"
        onClose={() => setIsStartModalOpen(false)}
        footer={
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              onClick={() => setIsStartModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              onClick={() => {
                setIsStartModalOpen(false)
                setToastMessage('Workout session started')
              }}
            >
              Start
            </button>
          </div>
        }
      >
        <p class="text-sm text-zinc-300">
          This is the Phase 1 scaffold flow. Session lifecycle behavior is implemented in Phase 3.
        </p>
      </Modal>

      {toastMessage ? <Toast message={toastMessage} tone="success" onClose={() => setToastMessage(null)} /> : null}
    </div>
  )
}
