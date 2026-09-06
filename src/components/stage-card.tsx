import type { StageView } from '@/lib/rules'
import { formatReleaseDate } from '@/lib/format'

const MARKER = {
  solved: { glyph: '✓', className: 'text-accent' },
  current: { glyph: '▸', className: 'text-foreground' },
  locked: { glyph: '·', className: 'text-muted/50' },
} as const

export function StageCard({ stage }: { stage: StageView }) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        stage.complete ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface'
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted">Stage {stage.stage}</p>
      <p className="font-semibold">{stage.theme}</p>

      <ul className="mt-2 space-y-1">
        {stage.items.map((item) => (
          <li key={item.position} className="flex gap-1.5 text-sm">
            <span className={MARKER[item.state].className} aria-hidden>
              {MARKER[item.state].glyph}
            </span>
            <span
              className={`truncate ${item.state === 'locked' ? 'text-muted/50' : 'text-muted'}`}
            >
              {item.title ?? 'Locked'}
            </span>
          </li>
        ))}
      </ul>

      {stage.fragment ? (
        <p className="mt-2 break-words font-mono text-sm text-accent">{stage.fragment}</p>
      ) : !stage.released ? (
        <p className="mt-2 text-xs text-muted">Opens {formatReleaseDate(stage.releaseAt)}</p>
      ) : null}
    </div>
  )
}
