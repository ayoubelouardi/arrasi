import { Card } from '../components'

interface TodayPageProps {
  onStartWorkout: () => void
}

export function TodayPage({ onStartWorkout }: TodayPageProps) {
  return (
    <section class="space-y-4">
      <h2 class="text-title-md font-semibold text-zinc-100">Today</h2>
      <Card title="Ready to train?" subtitle="Start or resume your next workout session.">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-zinc-300">Session lifecycle is scaffolded now and completed in Phase 3.</p>
          <button
            type="button"
            class="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
            onClick={onStartWorkout}
          >
            Start session
          </button>
        </div>
      </Card>
    </section>
  )
}
