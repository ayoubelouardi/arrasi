import type { ComponentChildren } from 'preact'

interface FormFieldProps {
  id: string
  label: string
  hint?: string
  error?: string
  children: ComponentChildren
}

export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  return (
    <div class="space-y-1.5">
      <label for={id} class="block text-sm font-medium text-zinc-200">
        {label}
      </label>
      {children}
      {error ? (
        <p class="text-xs text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
      {!error && hint ? <p class="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  )
}
