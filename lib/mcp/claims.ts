// What a verified access token must say to open the MCP (`mcp-server` → *Discovery and token
// check*, add-mcp-server D2, D3). The signature and `exp` are `getClaims`'s job; this is the rest,
// pure so it can be unit-tested.

/** Supabase Auth's issuer for a project URL: the `iss` of every token it signs. */
export function issuerOf(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`
}

/**
 * The OAuth client and the auth user of a token whose claims came from Mango's issuer and name an
 * OAuth client, or null. A browser session's token carries no `client_id`, so it never passes (D3).
 */
export function checkClaims(claims: unknown, issuer: string): { clientId: string; sub: string } | null {
  if (typeof claims !== 'object' || claims === null) return null
  const { iss, sub, client_id: clientId, role } = claims as Record<string, unknown>
  if (iss !== issuer) return null
  if (typeof sub !== 'string' || sub.length === 0) return null
  if (typeof clientId !== 'string' || clientId.length === 0) return null
  if (role !== 'authenticated') return null
  return { clientId, sub }
}
