import type { Component } from '@/lib/types'

/**
 * The game rules, with no database in sight. Everything here is a pure
 * function of the components, one player's solves and the current time, so the
 * gating can be tested directly.
 */

/** Labels only — the content itself lives in the database. */
export const STAGE_THEMES = [
  'Riddles',
  'Basketball',
  'Music',
  'History',
  'Classics',
  'Finale',
] as const

export type ChecklistItem = {
  position: number
  /** Null until the component is reachable, so future titles stay secret. */
  title: string | null
  state: 'solved' | 'current' | 'locked'
}

export type StageView = {
  stage: number
  theme: string
  items: ChecklistItem[]
  fragment: string | null
  complete: boolean
  releaseAt: string
  released: boolean
}

export type CurrentView =
  | {
      kind: 'clue'
      stage: number
      theme: string
      title: string
      clueText: string
      solveType: 'qr' | 'answer'
      hint: string | null
    }
  | { kind: 'waiting'; releaseAt: string }
  | { kind: 'done' }

export type CaseFile = {
  rank: number
  totalPlayers: number
  stages: StageView[]
  current: CurrentView
  /** How many players have finished each stage, index 0 = stage 1. */
  passedPerStage: number[]
}

export type Standing = { playerId: string; solved: number; furthestAt: string | null }

export type LeaderboardRow = {
  rank: number
  playerId: string
  displayName: string
  /** Null until their first solve. */
  stage: number | null
  isViewer: boolean
}

export type Leaderboard = {
  rows: LeaderboardRow[]
  /** Set only when the viewer finished outside the listed rows. */
  viewerRow: LeaderboardRow | null
  totalPlayers: number
}

export type ScanVerdict =
  | {
      unlocked: true
      componentId: string
      stage: number
      title: string
      fragment: string | null
      alreadySolved: boolean
    }
  | { unlocked: false }

export type AnswerVerdict =
  | { accepted: true; componentId: string; fragment: string | null }
  | { accepted: false; message: string }

/** Answers are compared case- and whitespace-insensitively (rule 4). */
export function normaliseAnswer(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, '')
}

function isReleased(component: Component, now: number): boolean {
  return new Date(component.release_at).getTime() <= now
}

/**
 * The component a player is on: the first one they haven't solved. Returns -1
 * once everything is solved. Components must already be in stage/position
 * order, which is the one order the whole game runs in (rule 2).
 */
export function currentIndex(components: Component[], solved: Set<string>): number {
  return components.findIndex((component) => !solved.has(component.id))
}

/**
 * Competition ranking: furthest component first, then whoever got there
 * earliest. Everyone still on zero solves ties for last.
 */
export function rankOf(playerId: string, all: Standing[]): number {
  const mine = all.find((standing) => standing.playerId === playerId)
  const solved = mine?.solved ?? 0
  const furthestAt = mine?.furthestAt ?? null

  const ahead = all.filter((other) => {
    if (other.playerId === playerId) return false
    if (other.solved !== solved) return other.solved > solved
    if (!other.furthestAt || !furthestAt) return false
    return other.furthestAt < furthestAt
  }).length

  return ahead + 1
}

export function buildCaseFile(input: {
  playerId: string
  components: Component[]
  solved: Set<string>
  standings: Standing[]
  totalPlayers: number
  now: number
}): CaseFile {
  const { playerId, components, solved, standings, totalPlayers, now } = input
  const index = currentIndex(components, solved)

  const stages: StageView[] = []
  for (let stage = 1; stage <= STAGE_THEMES.length; stage++) {
    const inStage = components.filter((component) => component.stage === stage)
    if (inStage.length === 0) continue

    const items: ChecklistItem[] = inStage.map((component) => {
      const position = components.indexOf(component)
      const state =
        index === -1 || position < index ? 'solved' : position === index ? 'current' : 'locked'
      // A title is a small spoiler, so it waits until the component is both
      // reachable and released (rule 3).
      const revealed = state === 'solved' || (state === 'current' && isReleased(component, now))
      return { position: component.position, title: revealed ? component.title : null, state }
    })

    const fragmentComponent = inStage.find((component) => component.fragment)
    const complete = inStage.every((component) => solved.has(component.id))

    stages.push({
      stage,
      theme: STAGE_THEMES[stage - 1],
      items,
      fragment: complete ? (fragmentComponent?.fragment ?? null) : null,
      complete,
      releaseAt: inStage[0].release_at,
      released: isReleased(inStage[0], now),
    })
  }

  let current: CurrentView
  if (index === -1) {
    current = { kind: 'done' }
  } else {
    const component = components[index]
    current = isReleased(component, now)
      ? {
          kind: 'clue',
          stage: component.stage,
          theme: STAGE_THEMES[component.stage - 1],
          title: component.title,
          clueText: component.clue_text,
          solveType: component.solve_type,
          hint: component.hint_released && component.hint_text ? component.hint_text : null,
        }
      : { kind: 'waiting', releaseAt: component.release_at }
  }

  // Passing stage N means solving every component up to the end of it, which in
  // a strictly ordered game is just a solve count.
  const passedPerStage: number[] = []
  let reached = 0
  for (let stage = 1; stage <= STAGE_THEMES.length; stage++) {
    reached += components.filter((component) => component.stage === stage).length
    const needed = reached
    passedPerStage.push(standings.filter((standing) => standing.solved >= needed).length)
  }

  return { rank: rankOf(playerId, standings), totalPlayers, stages, current, passedPerStage }
}

/**
 * Decides whether a typed answer solves the player's current component. The
 * component comes from their own progress, never from the request, so a
 * crafted form post can't aim at anything they haven't reached.
 */
export function checkAnswer(input: {
  components: Component[]
  solved: Set<string>
  raw: string
  now: number
}): AnswerVerdict {
  const { components, solved, raw, now } = input

  if (!raw.trim()) return { accepted: false, message: 'Type an answer first.' }

  const index = currentIndex(components, solved)
  if (index === -1) return { accepted: false, message: 'You have already found everything.' }

  const component = components[index]
  if (!isReleased(component, now)) {
    return { accepted: false, message: 'This one is not out yet.' }
  }
  if (component.solve_type !== 'answer') {
    return { accepted: false, message: 'This one is found by scanning its code.' }
  }
  if (normaliseAnswer(raw) !== normaliseAnswer(component.answer ?? '')) {
    return { accepted: false, message: 'Not it. Try again.' }
  }

  return { accepted: true, componentId: component.id, fragment: component.fragment }
}

/**
 * Decides what a scanned QR token gets the player. A token that doesn't exist
 * and one they haven't earned yet return the same locked verdict, so scanning
 * a code from further ahead — or a made-up URL — reveals nothing either way.
 */
export function checkScan(input: {
  components: Component[]
  solved: Set<string>
  token: string
  now: number
}): ScanVerdict {
  const { components, solved, token, now } = input
  if (!token) return { unlocked: false }

  // A scanned URL carries the token exactly as it was printed.
  const component = components.find((candidate) => candidate.qr_token === token)
  return verify(components, solved, component, now)
}

/**
 * Typed by hand instead of scanned, for a camera that won't focus. Same gating,
 * but forgiving about case and the spaces or dashes someone adds while reading
 * a code off a poster.
 */
export function normaliseCode(raw: string): string {
  return raw.toLowerCase().replace(/[\s-]/g, '')
}

export function checkCode(input: {
  components: Component[]
  solved: Set<string>
  code: string
  now: number
}): ScanVerdict {
  const { components, solved, code, now } = input
  const wanted = normaliseCode(code)
  if (!wanted) return { unlocked: false }

  const component = components.find(
    (candidate) => candidate.qr_token && normaliseCode(candidate.qr_token) === wanted,
  )
  return verify(components, solved, component, now)
}

function verify(
  components: Component[],
  solved: Set<string>,
  component: Component | undefined,
  now: number,
): ScanVerdict {
  // An unknown code and one they haven't earned return the same verdict.
  if (!component) return { unlocked: false }

  const index = components.indexOf(component)
  const alreadySolved = solved.has(component.id)

  // Re-entering something already found always works; anything new has to be
  // the component they are actually on, and it has to be out (rules 2 and 3).
  if (!alreadySolved) {
    if (index !== currentIndex(components, solved)) return { unlocked: false }
    if (!isReleased(component, now)) return { unlocked: false }
  }

  return {
    unlocked: true,
    componentId: component.id,
    stage: component.stage,
    title: component.title,
    fragment: component.fragment,
    alreadySolved,
  }
}

/**
 * How far a solve count has carried a player. Solving is strictly ordered, so
 * the count alone identifies the component they last found.
 */
export function stageReached(components: Component[], solved: number): number | null {
  if (solved <= 0) return null
  return components[Math.min(solved, components.length) - 1].stage
}

export function buildLeaderboard(input: {
  players: { id: string; display_name: string }[]
  standings: Standing[]
  components: Component[]
  viewerId: string | null
  limit: number
}): Leaderboard {
  const { players, standings, components, viewerId, limit } = input
  const byPlayer = new Map(standings.map((standing) => [standing.playerId, standing]))

  const all = players
    .map((player) => {
      const standing = byPlayer.get(player.id)
      const solved = standing?.solved ?? 0
      return {
        solved,
        furthestAt: standing?.furthestAt ?? null,
        row: {
          rank: rankOf(player.id, standings),
          playerId: player.id,
          displayName: player.display_name,
          stage: stageReached(components, solved),
          isViewer: player.id === viewerId,
        },
      }
    })
    .sort((a, b) => {
      if (a.solved !== b.solved) return b.solved - a.solved
      if (a.furthestAt && b.furthestAt && a.furthestAt !== b.furthestAt) {
        return a.furthestAt < b.furthestAt ? -1 : 1
      }
      // A stable, name-ordered fallback so equal players don't shuffle between loads.
      return a.row.displayName.localeCompare(b.row.displayName)
    })
    .map((entry) => entry.row)

  const rows = all.slice(0, limit)
  const viewerRow =
    viewerId && !rows.some((row) => row.isViewer)
      ? (all.find((row) => row.isViewer) ?? null)
      : null

  return { rows, viewerRow, totalPlayers: players.length }
}
