import { useEffect, useState } from 'preact/hooks'
import type { HistoryAnalyticsService } from '@services/history-analytics-service'
import { Card, FormField } from '../components'

interface HistoryPageProps {
  service: HistoryAnalyticsService
  onNotify: (payload: { message: string; tone: 'success' | 'info' | 'error' }) => void
}

function messageFromError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

export function HistoryPage({ service, onNotify }: HistoryPageProps) {
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([])
  const [programId, setProgramId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [entries, setEntries] = useState<Awaited<ReturnType<HistoryAnalyticsService['getHistoryData']>>['entries']>([])
  const [metrics, setMetrics] = useState<Awaited<ReturnType<HistoryAnalyticsService['getHistoryData']>>['metrics'] | null>(
    null,
  )

  useEffect(() => {
    service
      .listPrograms()
      .then((result) => setPrograms(result.map((program) => ({ id: program.id, name: program.name }))))
      .catch((error) => {
        onNotify({ message: `Failed to load programs: ${messageFromError(error)}`, tone: 'error' })
      })
  }, [service])

  useEffect(() => {
    service
      .getHistoryData({
        programId: programId === 'all' ? undefined : programId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      .then((result) => {
        setEntries(result.entries)
        setMetrics(result.metrics)
      })
      .catch((error) => {
        onNotify({ message: `Failed to load history: ${messageFromError(error)}`, tone: 'error' })
      })
  }, [service, programId, dateFrom, dateTo])

  const maxWeeklyCount = Math.max(...(metrics?.weeklyActivity.map((item) => item.count) ?? [1]))

  return (
    <section class="space-y-4">
      <h2 class="text-title-md font-semibold text-zinc-100">History</h2>

      <Card title="Filters">
        <div class="grid gap-3 md:grid-cols-3">
          <FormField id="history-program-filter" label="Program">
            <select
              id="history-program-filter"
              class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              value={programId}
              onChange={(event) => setProgramId((event.currentTarget as HTMLSelectElement).value)}
            >
              <option value="all">All programs</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="history-date-from" label="From">
            <input
              id="history-date-from"
              type="date"
              class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              value={dateFrom}
              onInput={(event) => setDateFrom((event.currentTarget as HTMLInputElement).value)}
            />
          </FormField>
          <FormField id="history-date-to" label="To">
            <input
              id="history-date-to"
              type="date"
              class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              value={dateTo}
              onInput={(event) => setDateTo((event.currentTarget as HTMLInputElement).value)}
            />
          </FormField>
        </div>
      </Card>

      <div class="grid gap-4 md:grid-cols-3">
        <Card title="Completion rate">
          <p class="text-2xl font-semibold text-emerald-300">{metrics?.completionRate ?? 0}%</p>
        </Card>
        <Card title="Activity count">
          <p class="text-2xl font-semibold text-zinc-100">{metrics?.activityCount ?? 0}</p>
        </Card>
        <Card title="Last workout">
          <p class="text-sm text-zinc-300">{metrics?.lastWorkoutSummary ?? 'No workouts yet'}</p>
        </Card>
      </div>

      <Card title="Weekly activity">
        <div class="space-y-2" role="list" aria-label="Weekly activity summary">
          {(metrics?.weeklyActivity ?? []).map((item) => (
            <div key={item.label} class="flex items-center gap-2" role="listitem" aria-label={`${item.label}: ${item.count} workouts`}>
              <span class="w-14 text-xs text-zinc-400">{item.label}</span>
              <div class="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
                <div
                  class="h-full bg-emerald-500"
                  style={{ width: `${Math.max(5, (item.count / (maxWeeklyCount || 1)) * 100)}%` }}
                />
              </div>
              <span class="w-8 text-right text-xs text-zinc-300">{item.count}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Workout history">
        {!entries.length ? (
          <p class="text-sm text-zinc-400">No workout logs for selected filters.</p>
        ) : (
          <ul class="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} class="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div class="text-sm text-zinc-100">
                  {entry.programName} · {entry.levelName}
                  {entry.moveName ? ` · ${entry.moveName}` : ''}
                </div>
                <div class="text-xs text-zinc-400">
                  {new Date(entry.date).toLocaleString()} · {entry.logMode ?? 'move'} ·{' '}
                  {entry.completed ? 'completed' : 'incomplete'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}
