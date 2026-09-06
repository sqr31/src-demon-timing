/** The hunt runs at one school, so dates are shown in its local time everywhere. */
const TIMEZONE = 'Australia/Sydney'

export function formatReleaseDate(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
}

export function formatReleaseDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * How far a wall clock in TIMEZONE is from UTC at a given instant, in ms.
 * Derived from Intl rather than hardcoded, so daylight saving is handled — the
 * hunt runs across the start of it.
 */
function offsetAt(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const at = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asIfUtc = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    at('hour'),
    at('minute'),
    at('second'),
  )
  return asIfUtc - instant.getTime()
}

/** A timestamptz as the `YYYY-MM-DDTHH:mm` local value a datetime-local input wants. */
export function toDateTimeLocal(iso: string): string {
  const instant = new Date(iso)
  const local = new Date(instant.getTime() + offsetAt(instant))
  return local.toISOString().slice(0, 16)
}

/**
 * The reverse: a local wall clock typed by an organiser back to an instant.
 * The offset is resolved twice because the first guess uses the offset at the
 * wrong instant, which matters either side of a daylight saving change.
 */
export function fromDateTimeLocal(local: string): string {
  // Checked by shape first: Date's fallback parser turns junk like
  // 'not-a-date:00Z' into 1 Jan 2000 rather than an Invalid Date, which would
  // silently store a wrong release time.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
    throw new Error(`Not a date and time: ${local}`)
  }

  const naive = new Date(`${local}:00Z`)
  if (Number.isNaN(naive.getTime())) throw new Error(`Not a date and time: ${local}`)

  const firstGuess = new Date(naive.getTime() - offsetAt(naive))
  return new Date(naive.getTime() - offsetAt(firstGuess)).toISOString()
}

/** Rough elapsed time, for "how long has this player been stuck". */
export function formatDuration(fromIso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`

  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}
