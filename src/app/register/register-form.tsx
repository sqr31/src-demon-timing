'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { register } from '@/app/actions'
import { emptyFormState } from '@/lib/form'
import { FormError, buttonClass, inputClass, labelClass } from '@/components/ui'

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(register, emptyFormState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label className={labelClass} htmlFor="studentId">
          Student ID
        </label>
        <input
          className={inputClass}
          id="studentId"
          name="studentId"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="displayName">
          Display name
        </label>
        <input
          className={inputClass}
          id="displayName"
          name="displayName"
          maxLength={40}
          autoComplete="nickname"
          required
        />
        <p className="mt-1 text-sm text-muted">This is what the leaderboard shows.</p>
      </div>

      <div>
        <label className={labelClass} htmlFor="pin">
          PIN (4-6 digits)
        </label>
        <input
          className={inputClass}
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="new-password"
          minLength={4}
          maxLength={6}
          required
        />
        <p className="mt-1 text-sm text-muted">
          There is no email reset. Ask an organiser if you forget it.
        </p>
      </div>

      <FormError message={state.error} />

      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? 'Registering…' : 'Register'}
      </button>

      <p className="text-center text-muted">
        Already registered?{' '}
        <Link className="text-accent underline" href="/login">
          Log in
        </Link>
      </p>
    </form>
  )
}
