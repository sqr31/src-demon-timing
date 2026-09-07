import 'server-only'
import { db } from '@/lib/db'
import {
  buildCaseFile,
  buildLeaderboard,
  checkAnswer,
  checkCode,
  checkScan,
  type CaseFile,
  type Leaderboard,
  type Standing,
} from '@/lib/rules'
import type { Component } from '@/lib/types'

export type SolveOutcome = { ok: boolean; message: string; fragment?: string }

/**
 * Every component in the one global order the game runs in: stage, then
 * position. All gating is an index into this list.
 */
async function componentsInOrder(): Promise<Component[]> {
  const { data, error } = await db()
    .from('components')
    .select('*')
    .order('stage')
    .order('position')

  if (error) throw error
  return (data ?? []) as Component[]
}

async function solvedComponentIds(playerId: string): Promise<Set<string>> {
  const { data, error } = await db()
    .from('progress')
    .select('component_id')
    .eq('player_id', playerId)

  if (error) throw error
  return new Set((data ?? []).map((row) => row.component_id as string))
}

/**
 * One row per player who has solved anything. Because a player can only solve
 * the next component in order, the number of solves *is* how far they've got,
 * and their latest solved_at is when they reached it.
 */
async function standings(): Promise<Standing[]> {
  // ~200 players x up to 24 components stays well inside one page of rows.
  const { data, error } = await db()
    .from('progress')
    .select('player_id, solved_at')
    .range(0, 49999)

  if (error) throw error

  const byPlayer = new Map<string, Standing>()
  for (const row of data ?? []) {
    const playerId = row.player_id as string
    const solvedAt = row.solved_at as string
    const existing = byPlayer.get(playerId)
    if (existing) {
      existing.solved += 1
      if (!existing.furthestAt || solvedAt > existing.furthestAt) existing.furthestAt = solvedAt
    } else {
      byPlayer.set(playerId, { playerId, solved: 1, furthestAt: solvedAt })
    }
  }
  return [...byPlayer.values()]
}

async function countPlayers(): Promise<number> {
  const { count, error } = await db()
    .from('players')
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}

export async function loadCaseFile(playerId: string): Promise<CaseFile> {
  const [components, solved, all, totalPlayers] = await Promise.all([
    componentsInOrder(),
    solvedComponentIds(playerId),
    standings(),
    countPlayers(),
  ])

  return buildCaseFile({
    playerId,
    components,
    solved,
    standings: all,
    totalPlayers,
    now: Date.now(),
  })
}

/**
 * Idempotent: a repeat solve keeps the original timestamp (rule 6). 23505 is
 * the unique violation on (player_id, component_id).
 */
export async function recordSolve(playerId: string, componentId: string): Promise<void> {
  const { error } = await db()
    .from('progress')
    .insert({ player_id: playerId, component_id: componentId })

  if (error && error.code !== '23505') throw error
}

export async function submitAnswer(playerId: string, raw: string): Promise<SolveOutcome> {
  const [components, solved] = await Promise.all([
    componentsInOrder(),
    solvedComponentIds(playerId),
  ])

  const verdict = checkAnswer({ components, solved, raw, now: Date.now() })
  if (!verdict.accepted) return { ok: false, message: verdict.message }

  await recordSolve(playerId, verdict.componentId)
  return { ok: true, message: 'Evidence found.', fragment: verdict.fragment ?? undefined }
}

export type ScanResult =
  | { unlocked: true; stage: number; title: string; fragment: string | null }
  | { unlocked: false }

/**
 * Resolves a QR landing. Recording the solve here is safe to repeat: the insert
 * ignores conflicts, so a re-scan keeps the original timestamp (rule 6).
 */
export async function scanToken(playerId: string, token: string): Promise<ScanResult> {
  const [components, solved] = await Promise.all([
    componentsInOrder(),
    solvedComponentIds(playerId),
  ])

  const verdict = checkScan({ components, solved, token, now: Date.now() })
  if (!verdict.unlocked) return { unlocked: false }

  if (!verdict.alreadySolved) await recordSolve(playerId, verdict.componentId)

  return {
    unlocked: true,
    stage: verdict.stage,
    title: verdict.title,
    fragment: verdict.fragment,
  }
}

/** The leaderboard lists everyone, so players yet to solve anything appear too. */
async function allPlayers(): Promise<{ id: string; display_name: string }[]> {
  const { data, error } = await db()
    .from('players')
    .select('id, display_name')
    .range(0, 9999)

  if (error) throw error
  return (data ?? []) as { id: string; display_name: string }[]
}

export async function loadLeaderboard(viewerId: string | null): Promise<Leaderboard> {
  const [players, all, components] = await Promise.all([
    allPlayers(),
    standings(),
    componentsInOrder(),
  ])

  return buildLeaderboard({ players, standings: all, components, viewerId, limit: 50 })
}

const CODE_ATTEMPT_WINDOW_MINUTES = 15
const CODE_ATTEMPT_MAX = 20

/**
 * The typed fallback for a camera that won't scan. It can only ever solve the
 * component the player is already on, so guessing buys at most one step — but
 * it is throttled anyway, since a wrong code costs nothing to try.
 */
export async function enterCode(playerId: string, code: string): Promise<SolveOutcome> {
  if (!code.trim()) return { ok: false, message: 'Type the code first.' }

  const attemptKey = `code:${playerId}`
  if (await tooManyCodeAttempts(attemptKey)) {
    return {
      ok: false,
      message: `Too many tries. Wait ${CODE_ATTEMPT_WINDOW_MINUTES} minutes and try again.`,
    }
  }

  const [components, solved] = await Promise.all([
    componentsInOrder(),
    solvedComponentIds(playerId),
  ])

  const verdict = checkCode({ components, solved, code, now: Date.now() })
  if (!verdict.unlocked) {
    await recordCodeAttempt(attemptKey)
    return { ok: false, message: "That code isn't right for this clue." }
  }

  if (!verdict.alreadySolved) await recordSolve(playerId, verdict.componentId)

  return { ok: true, message: 'Evidence found.', fragment: verdict.fragment ?? undefined }
}

function codeWindowStart(): string {
  return new Date(Date.now() - CODE_ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString()
}

async function tooManyCodeAttempts(key: string): Promise<boolean> {
  const { count, error } = await db()
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', key)
    .gte('attempted_at', codeWindowStart())

  if (error) throw error
  return (count ?? 0) >= CODE_ATTEMPT_MAX
}

async function recordCodeAttempt(key: string): Promise<void> {
  const client = db()
  const { error } = await client.from('login_attempts').insert({ student_id: key })
  if (error) throw error

  await client
    .from('login_attempts')
    .delete()
    .eq('student_id', key)
    .lt('attempted_at', codeWindowStart())
}
