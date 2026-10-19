// Where `/login` lands after signing in (`web-access` → *Sign-in returns to where it was sent from*,
// add-mcp-server D10). `next` is user-controlled, so only a path on Mango's own origin passes: an
// open redirect would let a link to `/login` send a fresh session anywhere. Pure, unit-tested.

const BASE = 'https://mango.invalid'

/** The value when it is a same-origin path (query and hash kept), otherwise null. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null
  if (!value.startsWith('/') || value[1] === '/' || value[1] === '\\') return null
  try {
    const url = new URL(value, BASE)
    if (url.origin !== BASE) return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}
