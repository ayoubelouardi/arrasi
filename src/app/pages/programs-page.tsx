import { useEffect, useMemo, useState } from 'preact/hooks'
import type { Level, Move, Program } from '@shared/types'
import type { ProgramAuthoringService } from '@services/program-authoring-service'
import { Card, FormField } from '../components'

type NotifyPayload = {
  message: string
  tone: 'success' | 'info' | 'error'
}

interface ProgramsPageProps {
  service: ProgramAuthoringService
  onNotify: (payload: NotifyPayload) => void
}

interface FormErrors {
  programName?: string
  levelName?: string
  moveName?: string
}

function messageFromError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

export function ProgramsPage({ service, onNotify }: ProgramsPageProps) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [levels, setLevels] = useState<Level[]>([])
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null)
  const [moves, setMoves] = useState<Move[]>([])

  const [programName, setProgramName] = useState('')
  const [programEditName, setProgramEditName] = useState('')
  const [levelName, setLevelName] = useState('')
  const [levelEditName, setLevelEditName] = useState('')
  const [moveName, setMoveName] = useState('')
  const [moveEditName, setMoveEditName] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  )
  const selectedLevel = useMemo(
    () => levels.find((level) => level.id === selectedLevelId) ?? null,
    [levels, selectedLevelId],
  )

  async function loadPrograms() {
    const loaded: Program[] = await service.listPrograms()
    setPrograms(loaded)

    if (!loaded.length) {
      setSelectedProgramId(null)
      setSelectedLevelId(null)
      setLevels([])
      setMoves([])
      return
    }

    if (!selectedProgramId || !loaded.some((program) => program.id === selectedProgramId)) {
      setSelectedProgramId(loaded[0].id)
    }
  }

  async function loadLevels(programId: string | null) {
    if (!programId) {
      setLevels([])
      setSelectedLevelId(null)
      setMoves([])
      return
    }

    const loaded: Level[] = await service.listLevels(programId)
    setLevels(loaded)

    if (!loaded.length) {
      setSelectedLevelId(null)
      setMoves([])
      return
    }

    if (!selectedLevelId || !loaded.some((level) => level.id === selectedLevelId)) {
      setSelectedLevelId(loaded[0].id)
    }
  }

  async function loadMoves(levelId: string | null) {
    if (!levelId) {
      setMoves([])
      return
    }

    setMoves(await service.listMoves(levelId))
  }

  useEffect(() => {
    loadPrograms().catch((error) => {
      onNotify({ message: `Failed to load programs: ${messageFromError(error)}`, tone: 'error' })
    })
  }, [service])

  useEffect(() => {
    loadLevels(selectedProgramId).catch((error) => {
      onNotify({ message: `Failed to load levels: ${messageFromError(error)}`, tone: 'error' })
    })
  }, [selectedProgramId])

  useEffect(() => {
    loadMoves(selectedLevelId).catch((error) => {
      onNotify({ message: `Failed to load moves: ${messageFromError(error)}`, tone: 'error' })
    })
  }, [selectedLevelId])

  async function handleCreateProgram(event: Event) {
    event.preventDefault()
    const trimmed = programName.trim()

    if (!trimmed) {
      setErrors((prev) => ({ ...prev, programName: 'Program name is required.' }))
      return
    }

    setErrors((prev) => ({ ...prev, programName: undefined }))

    try {
      const created = await service.createProgram({ name: trimmed })
      setProgramName('')
      await loadPrograms()
      setSelectedProgramId(created.id)
      onNotify({ message: 'Program created', tone: 'success' })
    } catch (error) {
      onNotify({ message: `Program create failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  async function handleUpdateProgram() {
    if (!selectedProgram) {
      return
    }

    const trimmed = programEditName.trim()
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, programName: 'Program name is required.' }))
      return
    }

    try {
      await service.updateProgram(selectedProgram.id, { name: trimmed })
      await loadPrograms()
      onNotify({ message: 'Program updated', tone: 'success' })
    } catch (error) {
      onNotify({ message: `Program update failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  async function handleDeleteProgram(programId: string) {
    try {
      await service.deleteProgram(programId)
      await loadPrograms()
      onNotify({ message: 'Program deleted', tone: 'success' })
    } catch (error) {
      onNotify({ message: `Program delete failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  async function handleCreateLevel(event: Event) {
    event.preventDefault()
    if (!selectedProgram) {
      return
    }

    const trimmed = levelName.trim()
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, levelName: 'Level name is required.' }))
      return
    }

    setErrors((prev) => ({ ...prev, levelName: undefined }))

    try {
      const created = await service.createLevel(selectedProgram.id, { name: trimmed })
      setLevelName('')
      await loadLevels(selectedProgram.id)
      setSelectedLevelId(created.id)
      onNotify({ message: 'Level created', tone: 'success' })
    } catch (error) {
      onNotify({ message: `Level create failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  async function handleUpdateLevel() {
    if (!selectedLevel) {
      return
    }

    const trimmed = levelEditName.trim()
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, levelName: 'Level name is required.' }))
      return
    }

    try {
      await service.updateLevel(selectedLevel.id, { name: trimmed })
      await loadLevels(selectedProgramId)
      onNotify({ message: 'Level updated', tone: 'success' })
    } catch (error) {
      onNotify({ message: `Level update failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  async function handleDeleteLevel(levelId: string) {
    try {
      await service.deleteLevel(levelId)
      await loadLevels(selectedProgramId)
      onNotify({ message: 'Level deleted', tone: 'success' })
    } catch (error) {
      onNotify({ message: `Level delete failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  async function handleCreateMove(event: Event) {
    event.preventDefault()
    if (!selectedLevel) {
      return
    }

    const trimmed = moveName.trim()
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, moveName: 'Move name is required.' }))
      return
    }

    setErrors((prev) => ({ ...prev, moveName: undefined }))

    try {
      await service.createMove(selectedLevel.id, { name: trimmed })
      setMoveName('')
      await loadMoves(selectedLevel.id)
      onNotify({ message: 'Move created', tone: 'success' })
    } catch (error) {
      onNotify({ message: `Move create failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  async function handleUpdateMove(moveId: string) {
    const trimmed = moveEditName.trim()
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, moveName: 'Move name is required.' }))
      return
    }

    try {
      await service.updateMove(moveId, { name: trimmed })
      await loadMoves(selectedLevelId)
      onNotify({ message: 'Move updated', tone: 'success' })
    } catch (error) {
      onNotify({ message: `Move update failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  async function handleDeleteMove(moveId: string) {
    try {
      await service.deleteMove(moveId)
      await loadMoves(selectedLevelId)
      onNotify({ message: 'Move deleted', tone: 'success' })
    } catch (error) {
      onNotify({ message: `Move delete failed: ${messageFromError(error)}`, tone: 'error' })
    }
  }

  return (
    <section class="space-y-4">
      <h2 class="text-title-md font-semibold text-zinc-100">Programs</h2>

      <Card title="Create program">
        <form class="space-y-3" onSubmit={handleCreateProgram}>
          <FormField id="programName" label="Program name" error={errors.programName}>
            <input
              id="programName"
              class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              value={programName}
              onInput={(event) => setProgramName((event.currentTarget as HTMLInputElement).value)}
            />
          </FormField>
          <button
            type="submit"
            class="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            Add program
          </button>
        </form>
      </Card>

      <div class="grid gap-4 lg:grid-cols-3">
        <Card title="Program list" className="lg:col-span-1">
          <div class="space-y-2">
            {!programs.length ? <p class="text-sm text-zinc-400">No programs yet.</p> : null}
            {programs.map((program) => (
              <div
                key={program.id}
                class={`rounded-lg border px-3 py-2 ${
                  selectedProgramId === program.id
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-950/40'
                }`}
              >
                <button
                  type="button"
                  class="w-full text-left text-sm font-medium text-zinc-200"
                  onClick={() => {
                    setSelectedProgramId(program.id)
                    setProgramEditName(program.name)
                  }}
                >
                  {program.name}
                </button>
                <div class="mt-2 flex gap-2">
                  <button
                    type="button"
                    class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                    onClick={() => {
                      setSelectedProgramId(program.id)
                      setProgramEditName(program.name)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="rounded border border-rose-600/50 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/20"
                    onClick={() => handleDeleteProgram(program.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Program details" className="lg:col-span-2">
          {!selectedProgram ? (
            <p class="text-sm text-zinc-400">Select a program to manage levels and moves.</p>
          ) : (
            <div class="space-y-3">
              <FormField id="programEditName" label="Program name" error={errors.programName}>
                <input
                  id="programEditName"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  value={programEditName}
                  onInput={(event) => setProgramEditName((event.currentTarget as HTMLInputElement).value)}
                />
              </FormField>
              <button
                type="button"
                class="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                onClick={handleUpdateProgram}
              >
                Save program
              </button>
            </div>
          )}
        </Card>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <Card title="Levels">
          {!selectedProgram ? (
            <p class="text-sm text-zinc-400">Select a program first.</p>
          ) : (
            <div class="space-y-3">
              <form class="space-y-2" onSubmit={handleCreateLevel}>
                <FormField id="levelName" label="Level name" error={errors.levelName}>
                  <input
                    id="levelName"
                    class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    value={levelName}
                    onInput={(event) => setLevelName((event.currentTarget as HTMLInputElement).value)}
                  />
                </FormField>
                <button
                  type="submit"
                  class="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  Add level
                </button>
              </form>

              <div class="space-y-2">
                {!levels.length ? <p class="text-sm text-zinc-400">No levels yet.</p> : null}
                {levels.map((level) => (
                  <div
                    key={level.id}
                    class={`rounded-lg border px-3 py-2 ${
                      selectedLevelId === level.id
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-zinc-800 bg-zinc-950/40'
                    }`}
                  >
                    <button
                      type="button"
                      class="w-full text-left text-sm font-medium text-zinc-200"
                      onClick={() => {
                        setSelectedLevelId(level.id)
                        setLevelEditName(level.name)
                      }}
                    >
                      {level.order}. {level.name}
                    </button>
                    <div class="mt-2 flex gap-2">
                      <button
                        type="button"
                        class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                        onClick={() => {
                          setSelectedLevelId(level.id)
                          setLevelEditName(level.name)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="rounded border border-rose-600/50 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/20"
                        onClick={() => handleDeleteLevel(level.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedLevel ? (
                <div class="space-y-2 border-t border-zinc-800 pt-3">
                  <FormField id="levelEditName" label="Edit selected level" error={errors.levelName}>
                    <input
                      id="levelEditName"
                      class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                      value={levelEditName}
                      onInput={(event) => setLevelEditName((event.currentTarget as HTMLInputElement).value)}
                    />
                  </FormField>
                  <button
                    type="button"
                    class="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={handleUpdateLevel}
                  >
                    Save level
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        <Card title="Moves">
          {!selectedLevel ? (
            <p class="text-sm text-zinc-400">Select a level first.</p>
          ) : (
            <div class="space-y-3">
              <form class="space-y-2" onSubmit={handleCreateMove}>
                <FormField id="moveName" label="Move name" error={errors.moveName}>
                  <input
                    id="moveName"
                    class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    value={moveName}
                    onInput={(event) => setMoveName((event.currentTarget as HTMLInputElement).value)}
                  />
                </FormField>
                <button
                  type="submit"
                  class="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  Add move
                </button>
              </form>

              <div class="space-y-2">
                {!moves.length ? <p class="text-sm text-zinc-400">No moves yet.</p> : null}
                {moves.map((move) => (
                  <div key={move.id} class="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                    <div class="text-sm font-medium text-zinc-200">
                      {move.order}. {move.name}
                    </div>
                    <div class="mt-2 space-y-2">
                      <FormField id={`move-edit-${move.id}`} label="Edit move name" error={errors.moveName}>
                        <input
                          id={`move-edit-${move.id}`}
                          class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                          value={moveEditName && selectedLevelId === move.levelId ? moveEditName : move.name}
                          onFocus={() => setMoveEditName(move.name)}
                          onInput={(event) => setMoveEditName((event.currentTarget as HTMLInputElement).value)}
                        />
                      </FormField>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                          onClick={() => handleUpdateMove(move.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          class="rounded border border-rose-600/50 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/20"
                          onClick={() => handleDeleteMove(move.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  )
}
