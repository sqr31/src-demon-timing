import { redirect } from 'next/navigation'
import { logout } from '@/app/actions'
import { CluePanel } from '@/components/clue-panel'
import { StageCard } from '@/components/stage-card'
import { loadCaseFile } from '@/lib/game'
import { getCurrentPlayer } from '@/lib/session'

export default async function CaseFilePage() {
  const player = await getCurrentPlayer()
  if (!player) redirect('/login')

  const caseFile = await loadCaseFile(player.id)

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="truncate text-2xl font-bold">{player.display_name}</h1>
        <p className="shrink-0 text-muted">
          Rank <span className="text-accent">{caseFile.rank}</span> of {caseFile.totalPlayers}
        </p>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {caseFile.stages.map((stage) => (
          <StageCard key={stage.stage} stage={stage} />
        ))}
      </div>

      <CluePanel current={caseFile.current} />

      <footer className="mt-8 border-t border-border pt-4 text-sm text-muted">
        <p>{caseFile.totalPlayers} registered</p>
        <p className="mt-1">
          Passed each stage:{' '}
          {caseFile.passedPerStage.map((count, index) => (
            <span key={index}>
              {index > 0 ? ' · ' : ''}
              {index + 1}: {count}
            </span>
          ))}
        </p>
        <form action={logout} className="mt-4">
          <button className="text-accent underline" type="submit">
            Log out
          </button>
        </form>
      </footer>
    </main>
  )
}
