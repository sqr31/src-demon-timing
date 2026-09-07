'use client'

import { useActionState, useState } from 'react'
import { submitCode } from '@/app/actions'
import { buttonClass, inputClass } from '@/components/ui'
import { emptySolveState } from '@/lib/form'

/**
 * The fallback for a phone that won't scan. Folded away by default so the code
 * on the poster stays the thing people look for.
 */
export function CodeBox() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(submitCode, emptySolveState)

  if (!open) {
    return (
      <button className="mt-3 text-accent underline" type="button" onClick={() => setOpen(true)}>
        Camera won&apos;t scan it?
      </button>
    )
  }

  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <label className="text-muted" htmlFor="code">
        Type the code printed under the QR.
      </label>
      <input
        className={inputClass}
        id="code"
        name="code"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        placeholder="e.g. 942226a3b4"
        required
      />

      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Enter code'}
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
