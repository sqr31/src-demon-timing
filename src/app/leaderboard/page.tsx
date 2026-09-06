import Link from 'next/link'
import { loadLeaderboard } from '@/lib/game'
import type { LeaderboardRow } from '@/lib/rules'
import { getSessionPlayerId } from '@/lib/session'

export const metadata = { title: 'Leaderboard · The Hunt' }

function Row({ row }: { row: LeaderboardRow }) {
  return (
    <li
      className={`flex items-baseline gap-3 rounded-xl px-3 py-2.5 ${
        row.isViewer ? 'bg-accent/10 text-accent' : ''
      }`}
    >
      <span className="w-8 shrink-0 tabular-nums text-muted">{row.rank}</span>
      <span className="flex-1 truncate">{row.displayName}</span>
      <span className="shrink-0 text-muted">
        {row.stage === null ? 'Not started' : `Stage ${row.stage}`}
      </span>
    </li>
  )
}

export default async function LeaderboardPage() {
  const viewerId = await getSessionPlayerId()
  const { rows, viewerRow, totalPlayers } = await loadLeaderboard(viewerId)

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      <h1 className="text-3xl font-bold">Leaderboard</h1>
      <p className="mt-1 text-muted">
        {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'} · furthest evidence first
      </p>

      <ol className="mt-6 divide-y divide-border">
        {rows.map((row) => (
          <Row key={row.playerId} row={row} />
        ))}
      </ol>

      {viewerRow ? (
        <>
          <p className="mt-4 text-center text-muted">···</p>
          <ol className="mt-2">
            <Row row={viewerRow} />
          </ol>
        </>
      ) : null}

      <Link className="mt-8 block text-accent underline" href={viewerId ? '/' : '/login'}>
        {viewerId ? 'Back to your case file' : 'Log in'}
      </Link>
    </main>
  )
}
