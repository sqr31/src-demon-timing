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
