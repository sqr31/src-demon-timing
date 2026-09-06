'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions'
import { emptyFormState } from '@/lib/form'
import { FormError, buttonClass, inputClass, labelClass } from '@/components/ui'

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, emptyFormState)

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
        <label className={labelClass} htmlFor="pin">
          PIN
        </label>
        <input
          className={inputClass}
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="current-password"
          minLength={4}
          maxLength={6}
          required
        />
      </div>

      <FormError message={state.error} />

      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Log in'}
      </button>

      <p className="text-center text-muted">
        No account yet?{' '}
        <Link className="text-accent underline" href="/register">
          Register
        </Link>
      </p>
    </form>
  )
}
