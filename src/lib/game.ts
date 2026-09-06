import 'server-only'
import { db } from '@/lib/db'
import {
  buildCaseFile,
  checkAnswer,
  type CaseFile,
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
