import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { encodeSignupPrefs, SIGNUP_PREFS_COOKIE, signupPrefs } from '@/lib/auth/signup-prefs'
import { supabaseServer } from '@/lib/supabase/server'

export type GoogleStartResult = { status: 'ok'; url: string } | { status: 'error' }

/**
 * Starts the Google sign-in (add-google-login D1): the Supabase client writes the PKCE verifier as a
 * cookie and answers the provider's URL, which the button opens. Google comes back through Supabase
 * to `/auth/confirm?code=`. The page's language and the browser's timezone travel in the
 * `mango-alta` cookie, because Google brings neither (D3).
 *
 * A POST route handler and not a link: only the browser knows the timezone, and the browser tests
 * stub it with `page.route`, as they do `/auth/request-code`.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  try {
    const supabase = await supabaseServer()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${request.nextUrl.origin}/auth/confirm`, skipBrowserRedirect: true },
    })
    if (error || !data.url) return Response.json({ status: 'error' } satisfies GoogleStartResult)

    const cookieStore = await cookies()
    cookieStore.set(SIGNUP_PREFS_COOKIE, encodeSignupPrefs(signupPrefs(body)), {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/auth',
      maxAge: 600,
    })
    return Response.json({ status: 'ok', url: data.url } satisfies GoogleStartResult)
  } catch {
    return Response.json({ status: 'error' } satisfies GoogleStartResult)
  }
}
