import Link from 'next/link'
import { redirect } from 'next/navigation'
import { STAGE_THEMES } from '@/lib/rules'
import { scanToken } from '@/lib/game'
import { getSessionPlayerId } from '@/lib/session'

export const metadata = { title: 'Evidence · The Hunt' }

export default async function ScanPage(props: PageProps<'/s/[token]'>) {
  const { token } = await props.params

  const playerId = await getSessionPlayerId()
  // Log in, then come straight back to this code rather than the case file.
  if (!playerId) redirect(`/login?next=${encodeURIComponent(`/s/${token}`)}`)

  const result = await scanToken(playerId, token)

  if (!result.unlocked) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <p className="text-xl">Evidence locked. You haven&apos;t found what leads here yet.</p>
        {/* Says nothing about the component, and saves a dead end on a phone. */}
        <Link
          className="mt-8 block rounded-xl border border-border bg-surface px-4 py-3.5 text-center text-lg"
          href="/"
        >
          Back to your case file
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
      <h1 className="text-3xl font-bold text-accent">Evidence found</h1>
      <p className="mt-1 text-muted">
        Stage {result.stage} · {STAGE_THEMES[result.stage - 1]} — {result.title}
      </p>

      {result.fragment ? (
        <div className="mt-6 rounded-2xl border border-accent/50 bg-accent/5 p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Fragment</p>
          <p className="mt-1 break-words font-mono text-xl text-accent">{result.fragment}</p>
        </div>
      ) : null}

      <Link
        className="mt-8 block rounded-xl border border-border bg-surface px-4 py-3.5 text-center text-lg"
        href="/"
      >
        Back to your case file
      </Link>
    </main>
  )
}
