import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildCaseFile,
  buildLeaderboard,
  checkAnswer,
  checkScan,
  normaliseAnswer,
  rankOf,
  stageReached,
} from './rules.ts'
import type { Component } from './types.ts'

const NOW = Date.parse('2026-09-10T00:00:00Z')
const PAST = '2026-09-01T00:00:00Z'
const FUTURE = '2026-09-20T00:00:00Z'

/** Two stages of two components: qr then answer, the answer one carrying the fragment. */
function fixture(overrides: Partial<Component>[] = []): Component[] {
  const base: Component[] = [
    { stage: 1, position: 1, title: 'One', solve_type: 'qr', qr_token: 't1', answer: null, fragment: null },
    { stage: 1, position: 2, title: 'Two', solve_type: 'answer', qr_token: null, answer: 'Blue Whale', fragment: 'FRAG-1' },
    { stage: 2, position: 1, title: 'Three', solve_type: 'answer', qr_token: null, answer: 'x', fragment: null },
    { stage: 2, position: 2, title: 'Four', solve_type: 'qr', qr_token: 't4', answer: null, fragment: 'FRAG-2' },
  ].map((partial, index) => ({
    id: `c${index + 1}`,
    clue_text: `Clue ${index + 1}`,
    release_at: PAST,
    hint_text: `Hint ${index + 1}`,
    hint_released: false,
    ...partial,
  })) as Component[]

  return base.map((component, index) => ({ ...component, ...overrides[index] }))
}

function caseFileFor(solvedIds: string[], components = fixture()) {
  return buildCaseFile({
    playerId: 'me',
    components,
    solved: new Set(solvedIds),
    standings: [{ playerId: 'me', solved: solvedIds.length, furthestAt: PAST }],
    totalPlayers: 1,
    now: NOW,
  })
}

test('the current component is the first unsolved one', () => {
  const fresh = caseFileFor([])
  assert.equal(fresh.current.kind, 'clue')
  assert.equal(fresh.current.kind === 'clue' && fresh.current.title, 'One')

  const partway = caseFileFor(['c1', 'c2'])
  assert.equal(partway.current.kind === 'clue' && partway.current.title, 'Three')
})

test('later components stay locked and unnamed', () => {
  const stageOne = caseFileFor([]).stages[0]
  assert.deepEqual(
    stageOne.items.map((item) => [item.state, item.title]),
    [
      ['current', 'One'],
      ['locked', null],
    ],
  )
})

test('gating spans stages, not just the stage you are in', () => {
  // Stage 2 is untouchable while anything in stage 1 is unsolved.
  const stageTwo = caseFileFor(['c1']).stages[1]
  assert.deepEqual(
    stageTwo.items.map((item) => item.state),
    ['locked', 'locked'],
  )
})

test('an unreleased component hides its title and clue', () => {
  const components = fixture([{}, { release_at: FUTURE }])
  const file = caseFileFor(['c1'], components)

  assert.equal(file.current.kind, 'waiting')
  assert.equal(file.stages[0].items[1].title, null)
})

test('a stage awards its fragment only once every component is solved', () => {
  assert.equal(caseFileFor(['c1']).stages[0].fragment, null)
  assert.equal(caseFileFor(['c1', 'c2']).stages[0].fragment, 'FRAG-1')
})

test('finishing everything closes the case', () => {
  const file = caseFileFor(['c1', 'c2', 'c3', 'c4'])
  assert.equal(file.current.kind, 'done')
  // The fixture only defines two stages, and empty stages are left out.
  assert.deepEqual(
    file.stages.map((stage) => stage.complete),
    [true, true],
  )
})

test('a hint shows only once it is released', () => {
  const hidden = caseFileFor([], fixture([{ hint_released: false }]))
  assert.equal(hidden.current.kind === 'clue' && hidden.current.hint, null)

  const shown = caseFileFor([], fixture([{ hint_released: true }]))
  assert.equal(shown.current.kind === 'clue' && shown.current.hint, 'Hint 1')
})

test('answers ignore case and whitespace', () => {
  assert.equal(normaliseAnswer('  Blue   WHALE '), 'bluewhale')

  for (const raw of ['Blue Whale', 'bluewhale', '  BLUE   whale  ']) {
    const verdict = checkAnswer({ components: fixture(), solved: new Set(['c1']), raw, now: NOW })
    assert.equal(verdict.accepted, true, `${raw} should be accepted`)
  }
})

test('a wrong answer is rejected and solves nothing', () => {
  const verdict = checkAnswer({
    components: fixture(),
    solved: new Set(['c1']),
    raw: 'orca',
    now: NOW,
  })
  assert.equal(verdict.accepted, false)
})

test('an empty answer is rejected', () => {
  const verdict = checkAnswer({ components: fixture(), solved: new Set(['c1']), raw: '   ', now: NOW })
  assert.equal(verdict.accepted, false)
})

test('a correct answer typed at a qr component is rejected', () => {
  // c1 is a qr component, so nothing typed can solve it.
  const verdict = checkAnswer({ components: fixture(), solved: new Set(), raw: 't1', now: NOW })
  assert.equal(verdict.accepted, false)
})

test('the right answer to an unreleased component is still rejected', () => {
  const components = fixture([{}, { release_at: FUTURE }])
  const verdict = checkAnswer({
    components,
    solved: new Set(['c1']),
    raw: 'Blue Whale',
    now: NOW,
  })
  assert.equal(verdict.accepted, false)
})

test('answering the last component of a stage returns its fragment', () => {
  const verdict = checkAnswer({
    components: fixture(),
    solved: new Set(['c1']),
    raw: 'blue whale',
    now: NOW,
  })
  assert.equal(verdict.accepted && verdict.fragment, 'FRAG-1')
})

test('rank goes by furthest component, then by who got there first', () => {
  const all = [
    { playerId: 'ahead', solved: 3, furthestAt: '2026-09-05T00:00:00Z' },
    { playerId: 'early', solved: 2, furthestAt: '2026-09-02T00:00:00Z' },
    { playerId: 'late', solved: 2, furthestAt: '2026-09-04T00:00:00Z' },
    { playerId: 'nothing', solved: 0, furthestAt: null },
  ]

  assert.equal(rankOf('ahead', all), 1)
  assert.equal(rankOf('early', all), 2)
  assert.equal(rankOf('late', all), 3)
  assert.equal(rankOf('nothing', all), 4)
})

test('players who have solved nothing all tie for last', () => {
  const all = [
    { playerId: 'ahead', solved: 1, furthestAt: PAST },
    { playerId: 'a', solved: 0, furthestAt: null },
    { playerId: 'b', solved: 0, furthestAt: null },
  ]
  assert.equal(rankOf('a', all), 2)
  assert.equal(rankOf('b', all), 2)
})

test('the footer counts players past the end of each stage', () => {
  const file = buildCaseFile({
    playerId: 'me',
    components: fixture(),
    solved: new Set(),
    standings: [
      { playerId: 'me', solved: 0, furthestAt: null },
      { playerId: 'one', solved: 2, furthestAt: PAST }, // finished stage 1
      { playerId: 'two', solved: 4, furthestAt: PAST }, // finished both
    ],
    totalPlayers: 3,
    now: NOW,
  })

  assert.deepEqual(file.passedPerStage.slice(0, 2), [2, 1])
})

test('scanning the code you are up to records it', () => {
  // c1 is the qr component the fresh player is on.
  const verdict = checkScan({ components: fixture(), solved: new Set(), token: 't1', now: NOW })

  assert.equal(verdict.unlocked, true)
  assert.equal(verdict.unlocked && verdict.componentId, 'c1')
  assert.equal(verdict.unlocked && verdict.alreadySolved, false)
})

test('scanning a code further ahead stays locked', () => {
  // t4 is the last component of stage 2; a fresh player is nowhere near it.
  const verdict = checkScan({ components: fixture(), solved: new Set(), token: 't4', now: NOW })
  assert.equal(verdict.unlocked, false)
})

test('an unknown token is indistinguishable from a locked one', () => {
  const unknown = checkScan({ components: fixture(), solved: new Set(), token: 'nope', now: NOW })
  const locked = checkScan({ components: fixture(), solved: new Set(), token: 't4', now: NOW })

  assert.deepEqual(unknown, locked)
  assert.deepEqual(unknown, { unlocked: false })
})

test('an empty token is locked', () => {
  assert.deepEqual(
    checkScan({ components: fixture(), solved: new Set(), token: '', now: NOW }),
    { unlocked: false },
  )
})

test('a code that is reachable but not released yet stays locked', () => {
  const components = fixture([{ release_at: FUTURE }])
  const verdict = checkScan({ components, solved: new Set(), token: 't1', now: NOW })
  assert.equal(verdict.unlocked, false)
})

test('re-scanning something already found succeeds without re-solving it', () => {
  const verdict = checkScan({
    components: fixture(),
    solved: new Set(['c1']),
    token: 't1',
    now: NOW,
  })

  assert.equal(verdict.unlocked, true)
  assert.equal(verdict.unlocked && verdict.alreadySolved, true)
})

test('a code that completes a stage hands over the fragment', () => {
  const verdict = checkScan({
    components: fixture(),
    solved: new Set(['c1', 'c2', 'c3']),
    token: 't4',
    now: NOW,
  })

  assert.equal(verdict.unlocked && verdict.fragment, 'FRAG-2')
})

test('the same code is open to one player and locked to another', () => {
  // The two-player check from the build order, as a unit test.
  const components = fixture()
  const ahead = checkScan({ components, solved: new Set(['c1', 'c2', 'c3']), token: 't4', now: NOW })
  const behind = checkScan({ components, solved: new Set(['c1']), token: 't4', now: NOW })

  assert.equal(ahead.unlocked, true)
  assert.equal(behind.unlocked, false)
})

const PLAYERS = [
  { id: 'ahead', display_name: 'Ada' },
  { id: 'middle', display_name: 'Bo' },
  { id: 'behind', display_name: 'Cy' },
  { id: 'fresh', display_name: 'Dee' },
]

const STANDINGS = [
  { playerId: 'ahead', solved: 4, furthestAt: '2026-09-05T00:00:00Z' },
  { playerId: 'middle', solved: 2, furthestAt: '2026-09-02T00:00:00Z' },
  { playerId: 'behind', solved: 2, furthestAt: '2026-09-04T00:00:00Z' },
]

function leaderboard(viewerId: string | null, limit = 50) {
  return buildLeaderboard({
    players: PLAYERS,
    standings: STANDINGS,
    components: fixture(),
    viewerId,
    limit,
  })
}

test('a solve count maps to the stage it reached', () => {
  const components = fixture()
  assert.equal(stageReached(components, 0), null)
  assert.equal(stageReached(components, 1), 1)
  assert.equal(stageReached(components, 2), 1)
  assert.equal(stageReached(components, 3), 2)
  assert.equal(stageReached(components, 4), 2)
})

test('the leaderboard orders by progress, then by who got there first', () => {
  const { rows } = leaderboard(null)
  assert.deepEqual(
    rows.map((row) => [row.rank, row.displayName]),
    [
      [1, 'Ada'],
      [2, 'Bo'],
      [3, 'Cy'],
      [4, 'Dee'],
    ],
  )
})

test('a player with no solves shows no stage', () => {
  const { rows } = leaderboard(null)
  assert.equal(rows[3].stage, null)
  assert.equal(rows[0].stage, 2)
})

test('the viewer is marked, and only the viewer', () => {
  const { rows } = leaderboard('behind')
  assert.deepEqual(
    rows.filter((row) => row.isViewer).map((row) => row.displayName),
    ['Cy'],
  )
})

test('a viewer outside the cut is returned as an extra row', () => {
  const { rows, viewerRow } = leaderboard('fresh', 2)

  assert.equal(rows.length, 2)
  assert.equal(viewerRow?.displayName, 'Dee')
  assert.equal(viewerRow?.rank, 4)
})

test('a viewer inside the cut is not repeated', () => {
  const { viewerRow } = leaderboard('ahead', 2)
  assert.equal(viewerRow, null)
})

test('a logged-out viewer gets no extra row', () => {
  const { viewerRow } = leaderboard(null, 1)
  assert.equal(viewerRow, null)
})

test('leaderboard ranks agree with the rank on the case file', () => {
  for (const row of leaderboard(null).rows) {
    assert.equal(row.rank, rankOf(row.playerId, STANDINGS), row.displayName)
  }
})
