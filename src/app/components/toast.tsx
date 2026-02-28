type ToastTone = 'success' | 'info' | 'error'

interface ToastProps {
  message: string
  tone?: ToastTone
  onClose?: () => void
}

const toneClass: Record<ToastTone, string> = {
  success: 'border-emerald-500/40 text-emerald-200',
  info: 'border-sky-500/40 text-sky-200',
  error: 'border-rose-500/40 text-rose-200',
}

export function Toast({ message, tone = 'info', onClose }: ToastProps) {
  return (
    <div class="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div class={`flex w-full max-w-md items-center gap-3 rounded-xl border bg-zinc-900/95 px-3 py-2 ${toneClass[tone]}`}>
        <p class="flex-1 text-sm">{message}</p>
        {onClose ? (
          <button
            type="button"
            class="rounded p-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Dismiss toast"
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  )
}
