import { verifyStatus } from '@/lib/auth/otp-status'
import { supabaseServer } from '@/lib/supabase/server'

export type VerifyCodeResult = { status: 'ok' | 'rejected' | 'rate_limited' | 'error' }

/**
 * Checks the code from `/login` and, on `ok`, writes the session cookies. A route handler and not
 * a server action on purpose: a server action that sets cookies makes Next.js re-render the
 * current route, and `/login` would redirect a signed-in visitor to `/dashboard` in the middle of
 * the success sequence. A plain `fetch` sets the cookies and leaves the page alone.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!email.includes('@') || !/^\d{6}$/.test(token)) return Response.json({ status: 'rejected' } satisfies VerifyCodeResult)

  try {
    const supabase = await supabaseServer()
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    return Response.json({ status: verifyStatus(error) } satisfies VerifyCodeResult)
  } catch {
    return Response.json({ status: 'error' } satisfies VerifyCodeResult)
  }
}
