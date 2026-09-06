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
