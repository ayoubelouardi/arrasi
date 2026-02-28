import { useState } from 'preact/hooks'
import { FormField } from '../components'
import type { ImportMode } from '@shared/types'

interface SettingsPageProps {
  onSaveSettings: () => void
  onExportAll: () => Promise<void>
  onImportFile: (file: File, mode: ImportMode) => Promise<void>
}

export function SettingsPage({ onSaveSettings, onExportAll, onImportFile }: SettingsPageProps) {
  const [importMode, setImportMode] = useState<ImportMode>('merge')

  async function handleImport(event: Event, mode: ImportMode) {
    const fileInput = event.currentTarget as HTMLInputElement
    const file = fileInput.files?.[0]
    if (!file) {
      return
    }

    await onImportFile(file, mode)
    fileInput.value = ''
  }

  return (
    <section class="space-y-4">
      <h2 class="text-title-md font-semibold text-zinc-100">Settings</h2>
      <form
        class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSaveSettings()
        }}
      >
        <FormField id="unitPreference" label="Unit preference" hint="This setting is UI-only in Phase 1.">
          <select
            id="unitPreference"
            name="unitPreference"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            defaultValue="metric"
          >
            <option value="metric">Metric (kg/km)</option>
            <option value="imperial">Imperial (lb/mi)</option>
          </select>
        </FormField>

        <button
          type="submit"
          class="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          Save
        </button>
      </form>

      <form
        class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          onExportAll()
        }}
      >
        <h3 class="text-sm font-semibold text-zinc-100">Backup & Restore</h3>
        <button
          type="submit"
          class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Export full backup (JSON)
        </button>

        <FormField id="importMode" label="Import mode">
          <select
            id="importMode"
            name="importMode"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            defaultValue="merge"
            onChange={(event) => {
              setImportMode((event.currentTarget as HTMLSelectElement).value as ImportMode)
            }}
          >
            <option value="merge">Merge (updatedAt newer wins)</option>
            <option value="replace">Replace all existing data</option>
          </select>
        </FormField>

        <FormField
          id="importFile"
          label="Import JSON backup"
          hint="Imports are transactional: invalid payloads fail without partial writes."
        >
          <input
            id="importFile"
            type="file"
            accept="application/json,.json"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-100"
            onChange={(event) => {
              void handleImport(event, importMode)
            }}
          />
        </FormField>
      </form>
    </section>
  )
}
