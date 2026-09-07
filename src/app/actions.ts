'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { loginPlayer, registerPlayer } from '@/lib/auth'
import { type FormState, type SolveState } from '@/lib/form'
import { enterCode, submitAnswer } from '@/lib/game'
import { safeNext } from '@/lib/paths'
import { clearSession, createSession, getSessionPlayerId } from '@/lib/session'

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await registerPlayer({
    studentId: field(formData, 'studentId'),
    displayName: field(formData, 'displayName'),
    pin: field(formData, 'pin'),
  })

  if (!result.ok) return { error: result.error }

  await createSession(result.playerId)
  // redirect() throws to unwind, so it stays outside any try/catch.
  redirect(safeNext(formData.get('next')))
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await loginPlayer({
    studentId: field(formData, 'studentId'),
    pin: field(formData, 'pin'),
  })

  if (!result.ok) return { error: result.error }

  await createSession(result.playerId)
  redirect(safeNext(formData.get('next')))
}

export async function logout() {
  await clearSession()
  redirect('/login')
}

export async function answer(_prev: SolveState, formData: FormData): Promise<SolveState> {
  const playerId = await getSessionPlayerId()
  if (!playerId) redirect('/login')

  const outcome = await submitAnswer(playerId, field(formData, 'answer'))
  // Re-render the case file so the stage cards and the next clue update behind
  // the message.
  if (outcome.ok) refresh()

  return { ok: outcome.ok, message: outcome.message, fragment: outcome.fragment ?? null }
}

export async function submitCode(_prev: SolveState, formData: FormData): Promise<SolveState> {
  const playerId = await getSessionPlayerId()
  if (!playerId) redirect('/login')

  const outcome = await enterCode(playerId, field(formData, 'code'))
  if (outcome.ok) refresh()

  return { ok: outcome.ok, message: outcome.message, fragment: outcome.fragment ?? null }
}
