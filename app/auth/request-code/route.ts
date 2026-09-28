import { sendStatus } from '@/lib/auth/otp-status'
import { supabaseServer } from '@/lib/supabase/server'

export type RequestCodeResult = { status: 'sent' | 'rate_limited' | 'error'; email?: string }

/**
 * Sends the 6-digit code and, for an address with no account, creates one (open-web-signup D5).
 * `idioma` and `timezone` become the new auth user's metadata, which the mail template and the
 * `usuarios` trigger read; an existing account ignores them. An unknown address with sign-ups off
 * still answers `sent`, so the page never tells which e-mails have an account.
 *
 * A route handler and not a server action so the browser tests can stub it with `page.route`, as
 * they do `/auth/verify-code`: the response format of a server action is internal to Next.js.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  if (!email.includes('@')) return Response.json({ status: 'error' } satisfies RequestCodeResult)

  // Both are user-controlled: kept only when plausible, and the trigger checks the timezone is real.
  const data: { idioma?: string; timezone?: string } = {}
  if (body.idioma === 'es' || body.idioma === 'en') data.idioma = body.idioma
  if (typeof body.timezone === 'string' && body.timezone.length > 0 && body.timezone.length <= 64) data.timezone = body.timezone

  try {
    const supabase = await supabaseServer()
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data } })
    const status = sendStatus(error)
    return Response.json((status === 'sent' ? { status, email } : { status }) satisfies RequestCodeResult)
  } catch {
    return Response.json({ status: 'error' } satisfies RequestCodeResult)
  }
}
