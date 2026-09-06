export const labelClass = 'block text-sm font-medium text-muted mb-1'

export const inputClass =
  'w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-lg ' +
  'text-foreground placeholder:text-muted/60 outline-none focus:border-accent'

export const buttonClass =
  'w-full rounded-xl bg-accent px-4 py-3.5 text-lg font-semibold text-[#101426] ' +
  'active:opacity-90 disabled:opacity-60'

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-danger">
      {message}
    </p>
  )
}
