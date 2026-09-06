/** Only same-origin paths are allowed as a post-login destination, so ?next= can't become an open redirect. */
export function safeNext(raw: unknown): string {
  return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}
