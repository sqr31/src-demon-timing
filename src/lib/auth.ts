import 'server-only'
import { compare, hash } from 'bcryptjs'
import { db } from '@/lib/db'
import type { Player } from '@/lib/types'

const BCRYPT_ROUNDS = 10
const RATE_LIMIT_WINDOW_MINUTES = 15
const RATE_LIMIT_MAX_ATTEMPTS = 10

export type AuthResult =
  | { ok: true; playerId: string }
  | { ok: false; error: string }

export function normaliseStudentId(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Shared shape checks for both forms, so the messages stay identical. */
function validate(studentId: string, pin: string): string | null {
  if (!studentId) return 'Enter your student ID.'
  if (studentId.length > 32) return 'That student ID is too long.'
  if (!/^[a-z0-9._-]+$/.test(studentId)) {
    return 'Student IDs can only use letters, numbers, dots, dashes and underscores.'
  }
  if (!/^\d{4,6}$/.test(pin)) return 'Your PIN must be 4 to 6 digits.'
  return null
}

export async function registerPlayer(input: {
  studentId: string
  displayName: string
  pin: string
}): Promise<AuthResult> {
  const studentId = normaliseStudentId(input.studentId)
  const displayName = input.displayName.trim()
  const pin = input.pin.trim()

  const invalid = validate(studentId, pin)
  if (invalid) return { ok: false, error: invalid }
  if (!displayName) return { ok: false, error: 'Enter a display name.' }
  if (displayName.length > 40) return { ok: false, error: 'That display name is too long.' }

  const pinHash = await hash(pin, BCRYPT_ROUNDS)

  const { data, error } = await db()
    .from('players')
    .insert({ student_id: studentId, display_name: displayName, pin_hash: pinHash })
    .select('id')
    .single()

  // 23505 is the unique violation on student_id — also covers two people
  // registering the same ID at the same moment.
  if (error?.code === '23505') {
    return { ok: false, error: 'That student ID is already registered. Log in instead.' }
  }
  if (error) throw error

  return { ok: true, playerId: data.id as string }
}

export async function loginPlayer(input: {
  studentId: string
  pin: string
}): Promise<AuthResult> {
  const studentId = normaliseStudentId(input.studentId)
  const pin = input.pin.trim()

  const invalid = validate(studentId, pin)
  if (invalid) return { ok: false, error: invalid }

  if (await isRateLimited(studentId)) {
    return {
      ok: false,
      error: `Too many attempts. Wait ${RATE_LIMIT_WINDOW_MINUTES} minutes and try again.`,
    }
  }

  const { data, error } = await db()
    .from('players')
    .select('id, pin_hash')
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) throw error

  const player = data as Pick<Player, 'id' | 'pin_hash'> | null
  // Hash against a dummy value when the player is unknown so both branches take
  // about the same time and don't reveal which IDs are registered.
  const pinHash = player?.pin_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'
  const pinMatches = await compare(pin, pinHash)

  if (!player || !pinMatches) {
    await recordFailedAttempt(studentId)
    return { ok: false, error: 'Student ID or PIN is wrong.' }
  }

  return { ok: true, playerId: player.id }
}

async function isRateLimited(studentId: string): Promise<boolean> {
  const since = windowStart()
  const { count, error } = await db()
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('attempted_at', since)

  if (error) throw error
  return (count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS
}

async function recordFailedAttempt(studentId: string) {
  const client = db()
  const { error } = await client.from('login_attempts').insert({ student_id: studentId })
  if (error) throw error

  // Keep the table from growing forever; attempts outside the window are dead.
  await client.from('login_attempts').delete().eq('student_id', studentId).lt('attempted_at', windowStart())
}

function windowStart(): string {
  return new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
}
