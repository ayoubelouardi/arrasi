import type { ComponentChildren } from 'preact'

interface CardProps {
  title?: string
  subtitle?: string
  children: ComponentChildren
  className?: string
}

export function Card({ title, subtitle, children, className }: CardProps) {
  return (
    <section class={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm ${className ?? ''}`}>
      {title ? <h2 class="text-base font-semibold text-zinc-100">{title}</h2> : null}
      {subtitle ? <p class="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
      <div class="mt-3">{children}</div>
    </section>
  )
}
