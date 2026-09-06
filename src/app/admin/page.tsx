import { headers } from 'next/headers'
import { adminSignOut } from '@/app/admin/actions'
import { AdminSignInForm, ComponentForm, PinResetForm } from '@/app/admin/admin-forms'
import { isAdmin } from '@/lib/admin'
import { loadAdminData } from '@/lib/admin-data'
import { formatReleaseDateTime } from '@/lib/format'
import { STAGE_THEMES } from '@/lib/rules'

export const metadata = { title: 'Admin · The Hunt' }

/** The QR codes have to point at wherever this is actually being served from. */
async function currentOrigin(): Promise<string> {
  const requestHeaders = await headers()
  const host = requestHeaders.get('host') ?? 'localhost:3000'
  const protocol =
    requestHeaders.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http')

  return `${protocol}://${host}`
}

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <h1 className="text-3xl font-bold">Organisers only</h1>
        <p className="mt-1 mb-8 text-muted">The Hunt admin.</p>
        <AdminSignInForm />
      </main>
    )
  }

  const origin = await currentOrigin()
  const { players, components, solves } = await loadAdminData(origin)

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold">Admin</h1>
        <form action={adminSignOut}>
          <button className="text-accent underline" type="submit">
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Players ({players.length})</h2>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-3 font-medium">Player</th>
                <th className="py-2 pr-3 font-medium">Student ID</th>
                <th className="py-2 pr-3 font-medium">On</th>
                <th className="py-2 pr-3 font-medium">For</th>
                <th className="py-2 pr-3 font-medium">Last solve</th>
                <th className="py-2 font-medium">Reset PIN</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-border/50 align-middle">
                  <td className="py-2 pr-3">{player.displayName}</td>
                  <td className="py-2 pr-3 font-mono text-muted">{player.studentId}</td>
                  <td className="py-2 pr-3">
                    {player.currentLabel ?? <span className="text-accent">Finished</span>}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-muted">
                    {player.onItFor}
                  </td>
                  <td className="py-2 pr-3 text-muted">
                    {player.lastSolveAt ? formatReleaseDateTime(player.lastSolveAt) : '—'}
                  </td>
                  <td className="py-2">
                    <PinResetForm playerId={player.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {players.length === 0 ? <p className="mt-3 text-muted">Nobody has registered yet.</p> : null}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Components</h2>
        <p className="mt-1 text-muted">
          Print the codes, edit the clues. Release times are Sydney local.
        </p>

        <div className="mt-4 space-y-4">
          {components.map((component) => (
            <article key={component.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">
                  Stage {component.stage}.{component.position} ·{' '}
                  {STAGE_THEMES[component.stage - 1]} — {component.title}
                </h3>
                <p className="text-sm text-muted">
                  {component.solveType === 'qr' ? 'Solved by QR' : 'Solved by answer'}
                  {component.fragment ? ` · awards ${component.fragment}` : ''}
                </p>
              </div>

              {component.solveType === 'answer' ? (
                <p className="mt-2 text-sm text-muted">
                  Answer: <span className="font-mono text-foreground">{component.answer}</span>
                </p>
              ) : null}

              <div className="mt-3 flex flex-col gap-4 sm:flex-row">
                {component.qrSvg && component.scanUrl ? (
                  <div className="shrink-0">
                    <div
                      className="w-[220px] rounded-xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: component.qrSvg }}
                    />
                    <a
                      className="mt-2 block rounded-lg border border-border px-3 py-2 text-center text-sm"
                      href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(component.qrSvg)}`}
                      download={`hunt-stage-${component.stage}-${component.position}.svg`}
                    >
                      Download QR
                    </a>
                    <p className="mt-2 break-all font-mono text-xs text-muted">
                      {component.scanUrl}
                    </p>
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <ComponentForm component={component} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Last {solves.length} solves</h2>
        <p className="mt-1 text-muted">Newest first, so anything out of order stands out.</p>

        <ol className="mt-3 divide-y divide-border/50 text-sm">
          {solves.map((solve, index) => (
            <li key={index} className="flex flex-wrap gap-x-3 py-2">
              <span className="w-40 shrink-0 text-muted">
                {formatReleaseDateTime(solve.solvedAt)}
              </span>
              <span className="w-32 shrink-0 truncate">{solve.displayName}</span>
              <span className="text-muted">{solve.componentLabel}</span>
            </li>
          ))}
        </ol>

        {solves.length === 0 ? <p className="mt-3 text-muted">No solves yet.</p> : null}
      </section>
    </main>
  )
}
