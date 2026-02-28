import { FormField } from '../components'

interface SettingsPageProps {
  onSaveSettings: () => void
}

export function SettingsPage({ onSaveSettings }: SettingsPageProps) {
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
    </section>
  )
}
