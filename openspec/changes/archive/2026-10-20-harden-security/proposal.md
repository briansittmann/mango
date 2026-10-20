## Why

The security audit of 2026-10-19, done right after the MCP server went live, found no way to reach another account's data, but it did find two real problems and several soft spots. Any signed-in user can rewrite every column of their own `usuarios` row through the REST API: they can take someone else's e-mail so that person can never get an account, learn which e-mails and phones use Mango, and probe for live WhatsApp linking codes. An OAuth access token from the MCP flow also carries the same power as a browser session ("full access to user data", per Supabase), and anyone can register an OAuth client. Next.js 16.3.4 has critical advisories. These need fixing now, while the MCP is new and there are few accounts.

## What Changes

- **`usuarios` columns.** Revoke the table-wide `UPDATE` from `authenticated` and grant it back only on the columns the web edits. `email`, `telefono`, `vip`, `medio_pago_habilitado`, `cargas_*`, `modo_confirmacion`, `ciclo_generado_hasta`, `codigo_vinculacion`, `whatsapp_solicitado_en` and `auth_user_id` stop being writable with a user's JWT. The linking code is issued by a new `security definer` function, so the web no longer writes it directly.
- **Assistant tokens.** A token that carries an OAuth `client_id` (Claude, ChatGPT or any registered client) can no longer update `usuarios` or hard-delete `transacciones` through the REST API. Restrictive RLS policies enforce this, so the consent page's promise ("never delete the account or change its profile") holds at the database level and not only in the tool list.
- **Consent page.** It names the assistant as verified only when it returns to a known host (`claude.ai`, `chatgpt.com`). Any other host gets a visible warning that the app is not Claude or ChatGPT.
- **Rate limits.**
  - `/api/mcp`: at most 120 tool calls per minute per account, with a new `rate-limited` error code.
  - `vincular <code>`: at most 5 attempts per hour per sending number, with a reply that says to wait.
  - Both counters live in Postgres, so no new service is needed.
- **Dependencies.** Upgrade `next` past the patched release (16.4.2 or later) and `sharp` to 0.35.5 or later.
- **Security headers.** Every response carries `frame-ancestors 'none'` / `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a minimal `Permissions-Policy`.
- **Google redirect.** The Google sign-in `redirectTo` uses `SITE_URL` in production instead of the request's host.
- **Database hygiene.** Revoke all table privileges from `anon`, and `TRUNCATE`, `TRIGGER` and `REFERENCES` from `authenticated`. Revoke `EXECUTE` on public functions from `anon`. Pin `search_path` on `rango_ciclo`, `rango_ciclo_usuario` and `fecha_en_ciclo`.
- **MCP amounts** are capped at the column's limit (9,999,999,999.99), so an oversized amount is `invalid-input` instead of `failed`.
- **Existing data.** A one-time check confirms that no `usuarios.email` differs from its auth user's e-mail, which would mean the e-mail was already taken this way.

## Capabilities

### New Capabilities
- `account-data-protection`: what a signed-in user's JWT and an assistant's token may change in the database, what the anonymous role may reach, and the security headers every response carries.

### Modified Capabilities
- `mcp-server` (delta written over `add-mcp-server`, which must be archived first): the consent page's host warning, the `rate-limited` error and per-account call limit, and the amount cap.
- `whatsapp-linking` (delta written over `add-whatsapp-linking`, which must be archived first): linking attempts are limited per number, and the code is issued by the database.
- `web-access`: the Google sign-in returns to the site's own address in production.

## Impact

- **Migration `0043`:** column grants, restrictive policies, the linking-code function, the rate-limit table and its functions, revokes, and `search_path`. It must be applied before the deploy, because the new code calls its functions.
- **Code:**
  - `lib/data/supabase/profile.ts` (`requestWhatsAppLink` calls the RPC)
  - `lib/mcp/{errors,context,server}.ts` and `lib/mcp/tools/fields.ts`
  - `app/oauth/consent/*` and the `mcp.consentimiento` messages
  - `lib/whatsapp/handle-message.ts` and `adapter.ts`, plus bot messages
  - `app/auth/google/route.ts`
  - `next.config.ts`
  - `package.json`
  - `public/llms.txt` (wording checked against what now holds)
- **Docs:** CLAUDE.md, where the *Deuda técnica* entry `usuarios_update_propio` sin lista de columnas goes away.
- **No user-visible change** on the dashboard or onboarding. Every column the UI writes stays writable.
