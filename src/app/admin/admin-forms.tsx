'use client'

import { useActionState } from 'react'
import { adminSignIn, saveComponent, savePin } from '@/app/admin/actions'
import { FormError, buttonClass, inputClass, labelClass } from '@/components/ui'
import { emptyFormState, emptySaveState } from '@/lib/form'
import type { AdminComponentRow } from '@/lib/admin-data'

const smallButton =
  'rounded-lg border border-border bg-surface px-3 py-2 font-medium active:opacity-90 disabled:opacity-60'

function Status({ error, saved }: { error: string | null; saved: boolean }) {
  if (error) return <span className="text-danger">{error}</span>
  if (saved) return <span className="text-accent">Saved</span>
  return null
}

export function AdminSignInForm() {
  const [state, action, pending] = useActionState(adminSignIn, emptyFormState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className={labelClass} htmlFor="password">
          Organiser password
        </label>
        <input
          className={inputClass}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <FormError message={state.error} />

      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Open admin'}
      </button>
    </form>
  )
}

export function ComponentForm({ component }: { component: AdminComponentRow }) {
  const [state, action, pending] = useActionState(saveComponent, emptySaveState)

  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="componentId" value={component.id} />

      <div>
        <label className={labelClass} htmlFor={`clue-${component.id}`}>
          Clue (markdown)
        </label>
        <textarea
          className={`${inputClass} min-h-28 text-base`}
          id={`clue-${component.id}`}
          name="clueText"
          defaultValue={component.clueText}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`hint-${component.id}`}>
          Hint
        </label>
        <textarea
          className={`${inputClass} min-h-20 text-base`}
          id={`hint-${component.id}`}
          name="hintText"
          defaultValue={component.hintText}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className={labelClass} htmlFor={`release-${component.id}`}>
            Releases (Sydney time)
          </label>
          <input
            className={`${inputClass} text-base`}
            id={`release-${component.id}`}
            name="releaseAt"
            type="datetime-local"
            defaultValue={component.releaseAtLocal}
            required
          />
        </div>

        <label className="flex items-center gap-2 py-3">
          <input
            className="size-5"
            name="hintReleased"
            type="checkbox"
            defaultChecked={component.hintReleased}
          />
          Hint released
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button className={smallButton} type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <Status error={state.error} saved={state.saved} />
      </div>
    </form>
  )
}

export function PinResetForm({ playerId }: { playerId: string }) {
  const [state, action, pending] = useActionState(savePin, emptySaveState)

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="playerId" value={playerId} />
      <input
        className="w-24 rounded-lg border border-border bg-surface px-2 py-1.5"
        name="pin"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="New PIN"
        aria-label="New PIN"
        minLength={4}
        maxLength={6}
        required
      />
      <button className={smallButton} type="submit" disabled={pending}>
        {pending ? '…' : 'Reset'}
      </button>
      <Status error={state.error} saved={state.saved} />
    </form>
  )
}
