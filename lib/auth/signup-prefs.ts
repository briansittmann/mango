// The language and timezone a Google sign-in carries to a new account (add-google-login D3). Google
// sends neither, so `/auth/google` keeps them in the `mango-alta` cookie and `/auth/confirm` applies
// them after the exchange. Both are user-controlled: kept only when plausible. Pure, so it is
// unit-tested without a request. The same cookie carries `next` (add-mcp-server D10): where to land
// after the return, a same-origin path or nothing.

import { safeNext } from './next.ts'

export const SIGNUP_PREFS_COOKIE = 'mango-alta'

export type SignupPrefs = { idioma?: 'es' | 'en'; timezone?: string; next?: string }

function knownTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false
  try {
    // An unknown name throws. The resolved name is not compared: engines canonicalize links
    // differently (Node turns America/Argentina/Buenos_Aires into America/Buenos_Aires).
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** Keeps `idioma` only for `es`/`en`, a timezone only when it is a known IANA name, and `next` only when `safeNext` passes it. */
export function signupPrefs(input: unknown): SignupPrefs {
  const prefs: SignupPrefs = {}
  if (!input || typeof input !== 'object') return prefs
  const { idioma, timezone, next } = input as Record<string, unknown>
  if (idioma === 'es' || idioma === 'en') prefs.idioma = idioma
  if (knownTimezone(timezone)) prefs.timezone = timezone
  const path = safeNext(next)
  if (path) prefs.next = path
  return prefs
}

export function encodeSignupPrefs(prefs: SignupPrefs): string {
  return JSON.stringify(prefs)
}

/** The cookie's value back; anything malformed reads as no preferences. */
export function decodeSignupPrefs(value: string | undefined): SignupPrefs {
  if (!value) return {}
  try {
    return signupPrefs(JSON.parse(value))
  } catch {
    return {}
  }
}
