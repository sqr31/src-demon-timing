import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDuration, fromDateTimeLocal, toDateTimeLocal } from './format.ts'

// Sydney is UTC+10 in winter and UTC+11 once daylight saving starts, on the
// first Sunday of October. A four week hunt starting in September crosses it.
test('a stored time shows as the local wall clock', () => {
  assert.equal(toDateTimeLocal('2026-09-13T23:00:00Z'), '2026-09-14T09:00')
  assert.equal(toDateTimeLocal('2026-10-11T22:00:00Z'), '2026-10-12T09:00')
})

test('a typed wall clock stores as the right instant', () => {
  assert.equal(fromDateTimeLocal('2026-09-14T09:00'), '2026-09-13T23:00:00.000Z')
  assert.equal(fromDateTimeLocal('2026-10-12T09:00'), '2026-10-11T22:00:00.000Z')
})

test('editing a release time and saving it unchanged is a no-op', () => {
  for (const iso of [
    '2026-09-13T23:00:00.000Z', // before daylight saving
    '2026-10-11T22:00:00.000Z', // after it
    '2026-10-03T12:30:00.000Z', // the day before the change
    '2026-10-04T12:30:00.000Z', // the day of it
  ]) {
    assert.equal(fromDateTimeLocal(toDateTimeLocal(iso)), iso, iso)
  }
})

test('a nonsense date is rejected rather than quietly parsed', () => {
  // Date's fallback parser reads 'not-a-date:00Z' as 1 Jan 2000, so shape is
  // checked before parsing.
  for (const junk of ['not-a-date', '', '2026-09-14', '2026-13-99T09:00', '14/09/2026 09:00']) {
    assert.throws(() => fromDateTimeLocal(junk), `${junk} should be rejected`)
  }
})

test('durations read as an organiser would say them', () => {
  const now = Date.parse('2026-09-14T12:00:00Z')
  assert.equal(formatDuration('2026-09-14T11:35:00Z', now), '25m')
  assert.equal(formatDuration('2026-09-14T08:20:00Z', now), '3h 40m')
  assert.equal(formatDuration('2026-09-11T06:00:00Z', now), '3d 6h')
  assert.equal(formatDuration('2026-09-20T00:00:00Z', now), '0m')
})
