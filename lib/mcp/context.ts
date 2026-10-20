import 'server-only'

import type { AuthInfo } from '@modelcontextprotocol/server'
import { createClient, isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import type { DataContext } from '@/lib/data/supabase/context'
import { findCurrentUsuario, type Usuario } from '@/lib/data/supabase/user'
import { checkClaims, issuerOf } from './claims'
import { McpToolError } from './errors'

// The bearer token is the person (add-mcp-server D2): every tool runs on a client that sends it,
// so RLS isolates the account exactly as on `/dashboard`.

function env(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return { url, anonKey }
}

/** Supabase Auth's issuer: the only authorization server the protected resource metadata names. */
export function mcpIssuer(): string {
  return issuerOf(env().url)
}

function clientFor(token: string): SupabaseClient {
  const { url, anonKey } = env()
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * An auth call tried up to three times while it fails on the network (`AuthRetryableFetchError`):
 * a dropped connection must not answer `401`, which a client reads as "connect again".
 */
async function retryingNetwork<T extends { error: unknown }>(call: () => Promise<T>): Promise<T> {
  let result = await call()
  for (let attempt = 1; attempt < 3 && isAuthRetryableFetchError(result.error); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
    result = await call()
  }
  return result
}

/**
 * `withMcpAuth`'s check: `getClaims` verifies the signature against the JWKS and `exp`;
 * `checkClaims` the issuer and the OAuth client (D3); `getUser` that the session still exists, so
 * a disconnected assistant gets `401` at once instead of when the token expires (D2, spike 1.2).
 * Undefined makes `mcp-handler` answer `401` with `WWW-Authenticate`.
 */
export async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined
  const client = clientFor(bearer)
  const { data, error } = await retryingNetwork(() => client.auth.getClaims(bearer))
  if (error || !data) return undefined
  const checked = checkClaims(data.claims, mcpIssuer())
  if (!checked) return undefined
  const user = await retryingNetwork(() => client.auth.getUser(bearer))
  if (user.error || user.data.user?.id !== checked.sub) return undefined
  return {
    token: bearer,
    clientId: checked.clientId,
    scopes: [],
    expiresAt: typeof data.claims.exp === 'number' ? data.claims.exp : undefined,
    extra: { sub: checked.sub },
  }
}

export type ToolContext = { ctx: DataContext; usuario: Usuario }

/**
 * The `DataContext` a tool runs with: the token's client and the person's `usuarios` row, which
 * RLS returns. No row, or an onboarding not finished, is `account-not-ready`; a call past the
 * account's quota is `rate-limited`.
 */
export async function toolContext(authInfo: AuthInfo | undefined): Promise<ToolContext> {
  if (!authInfo) throw new McpToolError('account-not-ready', 'No signed-in account.')
  const client = clientFor(authInfo.token)
  const usuario = await findCurrentUsuario(client)
  if (!usuario || !usuario.onboarding_completo) {
    throw new McpToolError('account-not-ready', 'This Mango account is not set up yet. Finish the setup at https://www.usemango.dev, then try again.')
  }
  // 120 calls a minute per account, across its assistants, counted in Postgres (`harden-security` D4).
  const { data: allowed, error } = await client.rpc('consumir_cupo_mcp')
  if (error) throw new Error(error.message)
  if (allowed !== true) throw new McpToolError('rate-limited', 'Too many calls to Mango in the last minute. Wait a minute, then try again.')
  return { ctx: { client, usuarioId: usuario.id, currency: usuario.moneda_default, timezone: usuario.timezone }, usuario }
}
