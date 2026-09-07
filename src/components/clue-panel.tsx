import Markdown from 'react-markdown'
import { AnswerBox } from '@/components/answer-box'
import { CodeBox } from '@/components/code-box'
import type { CurrentView } from '@/lib/rules'
import { formatReleaseDateTime } from '@/lib/format'

const markdownClasses =
  '[&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-accent [&_a]:underline ' +
  '[&_strong]:text-foreground [&_em]:italic [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 ' +
  '[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:font-mono [&_code]:text-accent'

export function CluePanel({ current }: { current: CurrentView }) {
  if (current.kind === 'done') {
    return (
      <section className="mt-6 rounded-2xl border border-accent/50 bg-accent/5 p-5">
        <h2 className="text-xl font-semibold text-accent">Case closed</h2>
        <p className="mt-2 text-muted">
          You have every fragment. Put them together and bring the answer to the club.
        </p>
      </section>
    )
  }

  if (current.kind === 'waiting') {
    return (
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold">Nothing to chase yet</h2>
        <p className="mt-2 text-muted">
          You are up to date. The next evidence drops {formatReleaseDateTime(current.releaseAt)}.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs uppercase tracking-wide text-muted">
        Stage {current.stage} · {current.theme}
      </p>
      <h2 className="text-xl font-semibold">{current.title}</h2>

      <div className={`mt-3 text-muted ${markdownClasses}`}>
        <Markdown>{current.clueText}</Markdown>
      </div>

      {current.hint ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Hint</p>
          <div className={`mt-1 text-muted ${markdownClasses}`}>
            <Markdown>{current.hint}</Markdown>
          </div>
        </div>
      ) : null}

      {current.solveType === 'answer' ? (
        <AnswerBox />
      ) : (
        <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3">
          <p>Scan the code where the clue leads.</p>
          <CodeBox />
        </div>
      )}
    </section>
  )
}
