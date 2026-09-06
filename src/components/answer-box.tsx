'use client'

import { useActionState } from 'react'
import { answer } from '@/app/actions'
import { emptySolveState } from '@/lib/form'
import { buttonClass, inputClass } from '@/components/ui'

export function AnswerBox() {
  const [state, action, pending] = useActionState(answer, emptySolveState)

  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input
        className={inputClass}
        name="answer"
        aria-label="Your answer"
        placeholder="Your answer"
        autoCapitalize="none"
        autoComplete="off"
        required
      />

      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Submit'}
      </button>

      {state.message ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 ${
            state.ok
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-danger/40 bg-danger/10 text-danger'
          }`}
        >
          <p>{state.message}</p>
          {state.fragment ? (
            <p className="mt-1 font-mono text-lg break-words">{state.fragment}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
