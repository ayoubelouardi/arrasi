import { useState } from 'preact/hooks'
import { FormField } from '../components'
import type { ImportMode } from '@shared/types'
import type { SyncConfigInput } from '@services/supabase-sync-service'

interface SettingsPageProps {
  onSaveSettings: () => void
  onExportAll: () => Promise<void>
  onImportFile: (file: File, mode: ImportMode) => Promise<void>
  onSaveSyncConfig: (config: SyncConfigInput) => Promise<void>
  onTestSyncConnection: (config: SyncConfigInput) => Promise<void>
  onInitialUpload: (config: SyncConfigInput) => Promise<void>
  onInitialDownload: (config: SyncConfigInput, mode: ImportMode) => Promise<void>
  onReplaySyncQueue: (config: SyncConfigInput) => Promise<void>
}

export function SettingsPage({
  onSaveSettings,
  onExportAll,
  onImportFile,
  onSaveSyncConfig,
  onTestSyncConnection,
  onInitialUpload,
  onInitialDownload,
  onReplaySyncQueue,
}: SettingsPageProps) {
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [syncUrl, setSyncUrl] = useState('')
  const [syncAnonKey, setSyncAnonKey] = useState('')
  const [syncOwnerId, setSyncOwnerId] = useState('')

  async function handleImport(event: Event, mode: ImportMode) {
    const fileInput = event.currentTarget as HTMLInputElement
    const file = fileInput.files?.[0]
    if (!file) {
      return
    }

    await onImportFile(file, mode)
    fileInput.value = ''
  }

  function currentSyncConfig(): SyncConfigInput {
    return {
      url: syncUrl,
      anonKey: syncAnonKey,
      ownerId: syncOwnerId,
    }
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
          hint="Imports are transactional; replace mode asks for confirmation and backup."
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

      <form
        class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void onSaveSyncConfig(currentSyncConfig())
        }}
      >
        <h3 class="text-sm font-semibold text-zinc-100">Supabase Sync (Optional)</h3>
        <FormField id="sync-url" label="Supabase URL" hint="Example: https://your-project.supabase.co">
          <input
            id="sync-url"
            type="url"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={syncUrl}
            onInput={(event) => setSyncUrl((event.currentTarget as HTMLInputElement).value)}
          />
        </FormField>
        <FormField id="sync-anon-key" label="Supabase anon key">
          <input
            id="sync-anon-key"
            type="password"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={syncAnonKey}
            onInput={(event) => setSyncAnonKey((event.currentTarget as HTMLInputElement).value)}
          />
        </FormField>
        <FormField id="sync-owner-id" label="Owner ID" hint="Stable owner identifier for owner-scoped rows.">
          <input
            id="sync-owner-id"
            type="text"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={syncOwnerId}
            onInput={(event) => setSyncOwnerId((event.currentTarget as HTMLInputElement).value)}
          />
        </FormField>

        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            class="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            Save sync config
          </button>
          <button
            type="button"
            class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={() => {
              void onTestSyncConnection(currentSyncConfig())
            }}
          >
            Test connection
          </button>
          <button
            type="button"
            class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={() => {
              void onInitialUpload(currentSyncConfig())
            }}
          >
            Initial upload
          </button>
          <button
            type="button"
            class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={() => {
              void onInitialDownload(currentSyncConfig(), importMode)
            }}
          >
            Initial download
          </button>
          <button
            type="button"
            class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={() => {
              void onReplaySyncQueue(currentSyncConfig())
            }}
          >
            Replay queued mutations
          </button>
        </div>
      </form>
    </section>
  )
}
