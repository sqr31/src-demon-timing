import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import type { Player } from '@/lib/types'

const COOKIE_NAME = 'hunt_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function key() {
  return new TextEncoder().encode(env.sessionSecret)
}

export async function createSession(playerId: string) {
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000)
  const token = await new SignJWT({ playerId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key())

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function clearSession() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** The signed-in player's id, or null. Verifies the signature and expiry. */
export async function getSessionPlayerId(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] })
    const playerId = payload.playerId
    return typeof playerId === 'string' ? playerId : null
  } catch {
    return null
  }
}

/**
 * The signed-in player, or null. A valid cookie for a deleted player counts as
 * signed out.
 */
export async function getCurrentPlayer(): Promise<Player | null> {
  const playerId = await getSessionPlayerId()
  if (!playerId) return null

  const { data, error } = await db()
    .from('players')
    .select('*')
    .eq('id', playerId)
    .maybeSingle()

  if (error) throw error
  return (data as Player) ?? null
}
