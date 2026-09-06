import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

const COOKIE_NAME = 'hunt_admin'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // a week, shorter than a player session
const RATE_LIMIT_WINDOW_MINUTES = 15
const RATE_LIMIT_MAX_ATTEMPTS = 10
/** Admin attempts share the players' throttle table under a key no student ID can take. */
const RATE_LIMIT_KEY = '__admin'

function key() {
  return new TextEncoder().encode(env.sessionSecret)
}

/** Compared over digests so the check is constant time whatever the lengths. */
function passwordMatches(given: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(given), digest(env.adminPassword))
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return false

  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] })
    return payload.admin === true
  } catch {
    return false
  }
}

/**
 * Every admin action calls this itself. Server Actions are reachable by direct
 * POST, so the page having rendered is not proof of anything.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error('Not signed in as an organiser.')
}

export async function signInAdmin(password: string): Promise<{ ok: boolean; error?: string }> {
  if (await isRateLimited()) {
    return {
      ok: false,
      error: `Too many attempts. Wait ${RATE_LIMIT_WINDOW_MINUTES} minutes and try again.`,
    }
  }

  if (!password || !passwordMatches(password)) {
    await recordFailedAttempt()
    return { ok: false, error: 'Wrong password.' }
  }

  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000)
  const token = await new SignJWT({ admin: true })
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

  return { ok: true }
}

export async function signOutAdmin(): Promise<void> {
  ;(await cookies()).delete(COOKIE_NAME)
}

function windowStart(): string {
  return new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
}

async function isRateLimited(): Promise<boolean> {
  const { count, error } = await db()
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', RATE_LIMIT_KEY)
    .gte('attempted_at', windowStart())

  if (error) throw error
  return (count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS
}

async function recordFailedAttempt(): Promise<void> {
  const client = db()
  const { error } = await client.from('login_attempts').insert({ student_id: RATE_LIMIT_KEY })
  if (error) throw error

  await client
    .from('login_attempts')
    .delete()
    .eq('student_id', RATE_LIMIT_KEY)
    .lt('attempted_at', windowStart())
}
