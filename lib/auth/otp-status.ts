// Maps Supabase Auth errors of the e-mail code flow to the page's outcomes (D2). Pure, so the
// mapping is unit-tested against stubbed errors without calling the provider.

export type AuthErrorLike = { code?: string; status?: number; message: string } | null

/** `requestCode`: an unknown address answers like a known one, so the page never tells them apart. */
export function sendStatus(error: AuthErrorLike): 'sent' | 'rate_limited' | 'error' {
  if (!error || error.code === 'otp_disabled' || /signups not allowed/i.test(error.message)) return 'sent'
  // The per-address interval (60 s) and the hourly cap of the custom SMTP both come back as 429.
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') return 'rate_limited'
  return 'error'
}

/** `verifyCode`: wrong, expired and used codes all come back as `otp_expired` (4xx). */
export function verifyStatus(error: AuthErrorLike): 'ok' | 'rejected' | 'rate_limited' | 'error' {
  if (!error) return 'ok'
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'rate_limited'
  if (error.status && error.status >= 400 && error.status < 500) return 'rejected'
  return 'error'
}
