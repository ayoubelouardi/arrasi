import type { ComponentChildren, JSX } from 'preact'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ComponentChildren
  footer?: JSX.Element
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) {
    return null
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        class="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        class="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-lg"
      >
        <h3 class="text-base font-semibold text-zinc-100">{title}</h3>
        <div class="mt-3">{children}</div>
        {footer ? <div class="mt-4">{footer}</div> : null}
      </div>
    </div>
  )
}
