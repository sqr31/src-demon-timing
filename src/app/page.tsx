import { redirect } from 'next/navigation'
import { logout } from '@/app/actions'
import { buttonClass } from '@/components/ui'
import { getCurrentPlayer } from '@/lib/session'

export default async function CaseFilePage() {
  const player = await getCurrentPlayer()
  if (!player) redirect('/login')

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
      <h1 className="text-3xl font-bold">Case file</h1>
      <p className="mt-1 text-muted">
        Signed in as <span className="text-foreground">{player.display_name}</span>
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <p className="text-muted">
          Stage cards, clues and answer submission arrive in build step 2.
        </p>
      </div>

      <form action={logout} className="mt-8">
        <button className={buttonClass} type="submit">
          Log out
        </button>
      </form>
    </main>
  )
}
