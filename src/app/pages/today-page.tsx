import { useEffect, useState } from 'preact/hooks'
import type { WorkoutSessionService } from '@services/workout-session-service'
import { Card, Modal } from '../components'

interface TodayPageProps {
  service: WorkoutSessionService
  onNotify: (payload: { message: string; tone: 'success' | 'info' | 'error' }) => void
}

type ConfirmAction = 'complete' | 'cancel' | null

function messageFromError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

export function TodayPage({ service, onNotify }: TodayPageProps) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<WorkoutSessionService['getTodaySnapshot']>> | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  async function loadSnapshot() {
    setSnapshot(await service.getTodaySnapshot())
  }

  useEffect(() => {
    loadSnapshot().catch((error) => {
      onNotify({ message: `Failed to load today view: ${messageFromError(error)}`, tone: 'error' })
    })
  }, [service])

  async function handleStartOrResume() {
    try {
      if (snapshot?.draft) {
        service.resumeSession()
        onNotify({ message: 'Workout draft resumed', tone: 'success' })
      } else {
        await service.startSession()
        onNotify({ message: 'Workout session started', tone: 'success' })
      }

      await loadSnapshot()
    } catch (error) {
      onNotify({ message: `Session action failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) {
      return
    }

    try {
      if (confirmAction === 'complete') {
        service.completeSession()
        onNotify({ message: 'Workout session completed', tone: 'success' })
      } else {
        service.cancelSession()
        onNotify({ message: 'Workout session canceled', tone: 'info' })
      }
      setConfirmAction(null)
      await loadSnapshot()
    } catch (error) {
      onNotify({ message: `Session action failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  const hasDraft = Boolean(snapshot?.draft)
  const target = snapshot?.target
  const draft = snapshot?.draft

  async function updateMoveField(
    moveId: string,
    updater: Parameters<WorkoutSessionService['updateMoveDraft']>[1],
  ) {
    try {
      service.updateMoveDraft(moveId, updater)
      await loadSnapshot()
    } catch (error) {
      onNotify({ message: `Draft update failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  return (
    <section class="space-y-4">
      <h2 class="text-title-md font-semibold text-zinc-100">Today</h2>

      <Card title="Current target" subtitle="Current program, level, and next moves">
        {!target ? (
          <p class="text-sm text-zinc-400">Create a program with at least one level to start a workout session.</p>
        ) : (
          <div class="space-y-3">
            <div class="text-sm text-zinc-200">
              <div>
                <span class="text-zinc-400">Program:</span> {target.program.name}
              </div>
              <div>
                <span class="text-zinc-400">Level:</span> {target.level.order}. {target.level.name}
              </div>
            </div>
            <div>
              <p class="text-xs text-zinc-500">Next moves</p>
              {!target.moves.length ? (
                <p class="text-sm text-zinc-400">No moves in this level yet.</p>
              ) : (
                <ul class="mt-1 space-y-1">
                  {target.moves.slice(0, 5).map((move) => (
                    <li key={move.id} class="text-sm text-zinc-200">
                      {move.order}. {move.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
                onClick={() => {
                  void handleStartOrResume()
                }}
              >
                {hasDraft ? 'Resume session' : 'Start session'}
              </button>
              {hasDraft ? (
                <>
                  <button
                    type="button"
                    class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={() => setConfirmAction('complete')}
                  >
                    Complete session
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-rose-600/50 px-3 py-2 text-sm text-rose-300 hover:bg-rose-900/20"
                    onClick={() => setConfirmAction('cancel')}
                  >
                    Cancel session
                  </button>
                </>
              ) : null}
            </div>
            {draft ? (
              <p class="text-xs text-zinc-500">
                Draft started: {new Date(draft.startedAt).toLocaleString()}
              </p>
            ) : null}

            {draft ? (
              <div class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <label class="flex items-center gap-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={draft.levelCompleted}
                    onChange={(event) => {
                      service.updateDraftLevelComplete((event.currentTarget as HTMLInputElement).checked)
                      void loadSnapshot()
                    }}
                  />
                  Mark entire level completed
                </label>
                <textarea
                  class="min-h-20 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  placeholder="Session notes"
                  value={draft.notes}
                  onInput={(event) => {
                    service.updateDraftNotes((event.currentTarget as HTMLTextAreaElement).value)
                    void loadSnapshot()
                  }}
                />
                {!draft.levelCompleted ? (
                  <div class="space-y-2">
                    <p class="text-xs text-zinc-500">Move-level logs</p>
                    {target.moves.map((move) => {
                      const entry = draft.moveLogs.find((item) => item.moveId === move.id)
                      return (
                        <div key={move.id} class="rounded-lg border border-zinc-800 p-2">
                          <div class="mb-2 text-sm font-medium text-zinc-200">
                            {move.order}. {move.name}
                          </div>
                          <div class="grid gap-2 md:grid-cols-2">
                            <label class="text-xs text-zinc-400">
                              Sets
                              <input
                                type="number"
                                min="0"
                                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                                value={entry?.actualSets ?? ''}
                                onInput={(event) => {
                                  const value = (event.currentTarget as HTMLInputElement).value
                                  void updateMoveField(move.id, {
                                    actualSets: value === '' ? undefined : Number(value),
                                  })
                                }}
                              />
                            </label>
                            <label class="text-xs text-zinc-400">
                              Reps
                              <input
                                type="text"
                                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                                value={entry?.actualReps ?? ''}
                                onInput={(event) => {
                                  void updateMoveField(move.id, {
                                    actualReps: (event.currentTarget as HTMLInputElement).value || undefined,
                                  })
                                }}
                              />
                            </label>
                            <label class="text-xs text-zinc-400">
                              Weight value
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                                value={entry?.actualWeightValue ?? ''}
                                onInput={(event) => {
                                  const value = (event.currentTarget as HTMLInputElement).value
                                  void updateMoveField(move.id, {
                                    actualWeightValue: value === '' ? undefined : Number(value),
                                  })
                                }}
                              />
                            </label>
                            <label class="text-xs text-zinc-400">
                              Weight unit
                              <select
                                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                                value={entry?.actualWeightUnit ?? 'kg'}
                                onChange={(event) => {
                                  void updateMoveField(move.id, {
                                    actualWeightUnit: (event.currentTarget as HTMLSelectElement).value as 'kg' | 'lb',
                                  })
                                }}
                              >
                                <option value="kg">kg</option>
                                <option value="lb">lb</option>
                              </select>
                            </label>
                            <label class="text-xs text-zinc-400">
                              Distance value
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                                value={entry?.actualDistanceValue ?? ''}
                                onInput={(event) => {
                                  const value = (event.currentTarget as HTMLInputElement).value
                                  void updateMoveField(move.id, {
                                    actualDistanceValue: value === '' ? undefined : Number(value),
                                  })
                                }}
                              />
                            </label>
                            <label class="text-xs text-zinc-400">
                              Distance unit
                              <select
                                class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                                value={entry?.actualDistanceUnit ?? 'km'}
                                onChange={(event) => {
                                  void updateMoveField(move.id, {
                                    actualDistanceUnit: (event.currentTarget as HTMLSelectElement).value as 'km' | 'mi',
                                  })
                                }}
                              >
                                <option value="km">km</option>
                                <option value="mi">mi</option>
                              </select>
                            </label>
                          </div>
                          <label class="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                            <input
                              type="checkbox"
                              checked={entry?.completed ?? false}
                              onChange={(event) => {
                                void updateMoveField(move.id, {
                                  completed: (event.currentTarget as HTMLInputElement).checked,
                                })
                              }}
                            />
                            Move completed
                          </label>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <Card title="Last completion" subtitle="Persists after refresh">
        {snapshot?.lastCompletion ? (
          <p class="text-sm text-zinc-300">
            Last completed at {new Date(snapshot.lastCompletion.completedAt).toLocaleString()}
          </p>
        ) : (
          <p class="text-sm text-zinc-400">No completed session yet.</p>
        )}
      </Card>

      <Modal
        open={confirmAction !== null}
        title={confirmAction === 'complete' ? 'Complete this session?' : 'Cancel this session?'}
        onClose={() => setConfirmAction(null)}
        footer={
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              onClick={() => setConfirmAction(null)}
            >
              Back
            </button>
            <button
              type="button"
              class="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              onClick={() => {
                void handleConfirmAction()
              }}
            >
              Confirm
            </button>
          </div>
        }
      >
        <p class="text-sm text-zinc-300">
          {confirmAction === 'complete'
            ? 'This will mark the active draft as completed.'
            : 'This will discard the active draft session.'}
        </p>
      </Modal>
    </section>
  )
}
