## Context

See proposal.md for the audit findings. What shapes the approach:

- **Who writes `usuarios`.** Only four places write it:
  - `lib/data/supabase/profile.ts`, with the user's JWT: name, country, currency, timezone, cycle day, amount format, savings target, onboarding step and completion, widget order, default payment method, and the linking code with its request time.
  - `app/auth/confirm/route.ts`, with the user's JWT: language and timezone.
  - `lib/data/users.ts` (the bot), with the admin client: the confirmation counters.
  - `app/api/cron/recurrentes/route.ts`, with the admin client: the generation mark.

  The service role bypasses both RLS and column grants, so the bot and the crons are not affected.
- **Policies.** Every table has an all-commands `*_crud_propio` policy, plus `usuarios_select_propio` and `usuarios_update_propio` (`0011`). No TypeScript hard-deletes a `transacciones` row. The only hard delete is the cascade from `usuarios` when an account is deleted, which runs through the admin client and FK actions, and FK actions run without RLS.
- **Assistant tokens.** Supabase OAuth access tokens are ordinary user JWTs plus a `client_id` claim (`checkClaims` in `lib/mcp/claims.ts` already relies on that claim). Scopes do not limit database access; Supabase's docs say RLS is the place to restrict OAuth clients by `client_id`.
- **Linking codes.** The web generates them (`generateLinkCode`) and writes them with the user's JWT, retrying on `23505`. That write is exactly what makes the column a lookup oracle.
- **Linking messages.** `handle-message.ts` resolves `vincular <code>` before the parser. Its effects come in through `deps`, which are wired in `adapter.ts` with the admin client.
- **Infrastructure.** There is no rate-limit service on Vercel today, and the project avoids new services.

## Goals / Non-Goals

**Goals:**
- Close every audit finding with the smallest change that enforces it in the database where possible, not only in the app.
- Keep every current write path of the web, the bot, the crons and the MCP working unchanged.

**Non-Goals:**
- **A full Content-Security-Policy.** Inline scripts from Next, next-intl and the theme bootstrap would need nonces. Only `frame-ancestors` is set.
- **Rate limiting of sign-up and CAPTCHA.** These stay in ROADMAP block 10.
- **Limiting which OAuth clients may register.** Dynamic client registration stays open, because Claude and ChatGPT need it. The consent page warning is the defence.
- **Validating `timezone` or locking `dia_inicio_ciclo` in the database.** A bad value only breaks the person's own account.
- **Changing the WhatsApp linking code's length or alphabet.** The attempt limit is what removes guessing.

## Decisions

**D1. Column grants, not a trigger or a policy per column.**
- **How:** `revoke update on usuarios from authenticated, anon`, then `grant update (nombre, pais, moneda_default, timezone, dia_inicio_ciclo, formato_montos, idioma, meta_ahorro_mensual, onboarding_paso, onboarding_completo, orden_widgets, medio_pago_default) on usuarios to authenticated`.
- **Why:** an update that touches any other column fails with `42501` before any uniqueness check runs, so it reveals nothing.
- **Rejected:** a `before update` trigger that compares `OLD` and `NEW`. It is more code, and it runs after the unique index would already have answered.

**D2. The linking code comes from a `security definer` function.**
- **How:** `pedir_codigo_vinculacion()` resolves the account from `auth.uid()`. It returns the live code when the request time is within 7 days. Otherwise it draws a new code from the same alphabet with `extensions.gen_random_bytes` and retries up to three times on `unique_violation`. It sets `whatsapp_solicitado_en = now()` and returns the code.
- **Settings and grants:** `set search_path = public`, `EXECUTE` only for `authenticated`.
- **Web side:** `requestWhatsAppLink` calls it. `generateLinkCode` stays in TypeScript only if something else uses it; otherwise it is removed along with its test.
- **Why:** this way the person's token never writes the column.

**D3. Restrictive policies keyed on `client_id` for assistant tokens.**
- **How:** two restrictive policies:
  - `create policy usuarios_update_sin_asistente on usuarios as restrictive for update to authenticated using ((auth.jwt() ->> 'client_id') is null)`
  - the same shape `for delete` on `transacciones`
- **Why restrictive:** restrictive policies are ANDed with the permissive ones, so browser sessions, which carry no `client_id`, are untouched.
- **Scope:** only these two, because the MCP legitimately deletes categories, cards and fixed-charge definitions, and those deletes run through invoker RPCs that need `DELETE` under RLS.
- **Rejected:** a separate Postgres role for assistant tokens. Supabase issues `role: authenticated` and we do not control the token's role claim without a custom access-token hook.

**D4. Rate limits as a Postgres fixed-window counter.**
- **Table:** `limites_uso (clave text primary key, ventana timestamptz not null, usos int not null)`, with RLS on and no policies.
- **Function:** `consumir_cupo(p_clave text, p_max int, p_segundos int) returns boolean` makes a single `insert … on conflict do update` that resets the window when it is older than `p_segundos`. It returns `usos <= p_max`. `EXECUTE` is for `service_role` only.
- **Wrapper:** `consumir_cupo_mcp() returns boolean` is a `security definer` wrapper for `authenticated`. Its key is `'mcp:' || auth.uid()`, with 120 per 60 s, so a token can only spend its own account's quota.
- **MCP:** the call runs in the envelope's context step (`toolContext`). `false` throws `McpToolError('rate-limited', …)`, and `rate-limited` joins `TOOL_ERROR_CODES`.
- **WhatsApp:** `handleIncoming` gets a new dependency, `allowLinkAttempt(phone)`. It is wired in `adapter.ts` to `consumir_cupo('vincular:' || phone, 5, 3600)` with the admin client and checked before `linkChannel`. When it refuses, the reply is a new bilingual message, `bot.vincularEspera`.
- **Cleanup:** the recurring cron deletes rows whose window is more than a day old, next to the purge of unknown contacts.
- **Rejected:**
  - Upstash or another new service.
  - Vercel WAF rules, which are panel-only, IP-based, and blind to accounts and phone numbers.
  - An in-memory limiter, which does not survive between serverless instances.

**D5. Consent page host classes.** `hostKind(host)` returns one of three values. It is pure and unit-tested.
- `known`: `claude.ai`, `chatgpt.com` or their subdomains.
- `local`: `localhost`, `127.0.0.1` or `[::1]`.
- `unknown`: anything else. The card shows a warning row above the buttons: an icon plus text, at the top of the card's content, inside the first viewport at 390×700. The texts go in `mcp.consentimiento`.

**D6. Headers from `next.config.ts`.** One `source: '/:path*'` entry carries:
- `Content-Security-Policy: frame-ancestors 'none'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

The existing `/auth/:path*` robots header stays. Nothing embeds Mango today: the portfolio only links to it, and Vercel's HSTS is already present.

**D7. Google `redirectTo`.** When `process.env.VERCEL_ENV === 'production'`, it is `${SITE_URL}/auth/confirm`. Otherwise it stays `request.nextUrl.origin`, which local development and preview deployments need.

**D8. Hygiene, all in the same migration.**
- **Tables:** `revoke all on all tables in schema public from anon`, and `revoke truncate, trigger, references on all tables in schema public from authenticated`.
- **Functions:** `revoke execute on all functions in schema public from anon, public`, then re-grant `EXECUTE` to `authenticated` on the functions the web and the MCP call. The list is generated from `pg_proc` before writing the migration, so that no invoker RPC loses its grant.
- **Default privileges:** `alter default privileges in schema public revoke … from anon`, so tables created later do not get the grants back.
- **`search_path`:** `alter function … set search_path = public` on `rango_ciclo`, `rango_ciclo_usuario` and `fecha_en_ciclo`.

**D9. MCP amount cap.** `amountField` adds `.max(9_999_999_999.99)`, the limit of `numeric(12,2)`.

## Risks / Trade-offs

- **A web write path that was missed fails with `42501` after the deploy.**
  - Before writing D1, grep every `.from('usuarios').update` and `.upsert`.
  - The full Playwright suite runs against `/demo`, which is in memory, so it cannot catch this. The account sheet, the onboarding, the widget order, the default payment method and the "Vincular WhatsApp" button are therefore checked against the real database as the test account.
  - Rollback is a single `grant update on usuarios to authenticated`.
- **Revoking `EXECUTE` from `public` strips an RPC the web needs.**
  - D8 re-grants from a generated list.
  - `scripts/mcp-smoke.mjs` and a pass through `/dashboard` and `/onboarding` on the test account verify it.
- **Restrictive policies cost a little on every update and delete.** `auth.jwt()` is a cheap settings read, and both tables see few writes.
- **A future assistant with a legitimate need to change the profile is blocked by D3.** That is intended. If it ever happens, the profile gets its own tool and a narrower policy.
- **A fixed-window counter allows up to twice the limit across a window edge.** That is acceptable: the point is to stop brute force and runaway loops, not to meter usage exactly.
- **The rate-limit table grows with every phone number and account.** The cron purge keeps it to a day's worth of keys.
- **The `next` upgrade can break the build or the tests.** Run the build, the unit tests and the Chromium suite first, then the full suite. The `npm audit` advisories name 16.4.2 as the fixed version.

## Migration Plan

1. **Write migration `0043_endurecer_seguridad.sql`** (D1–D4, D8).
2. **Run the check query:** compare `usuarios.email` with `auth.users.email` for every row. Any mismatch is reported to Brian and nothing is changed.
3. **Apply `0043` before the deploy,** with Brian's confirmation. Through the MCP, unless a `revoke` is refused; then Brian pastes it in the SQL editor.
   - The old code still works after D1, because it only writes granted columns and `codigo_vinculacion`.
   - D2 changes `codigo_vinculacion`: between the migration and the deploy, "Vincular WhatsApp" fails for anyone without a live code.
   - That window is minutes and only affects one button, so it is accepted. Otherwise, apply D1's revoke in a second migration right after the deploy.
4. **Deploy:** the code, the `next` and `sharp` upgrade, and the headers.
5. **Verify in production:**
   - `curl` the headers.
   - A forged `Host` header on `/auth/google`.
   - The MCP smoke test.
   - A direct REST `PATCH` of `usuarios.email` with a session token, which must return `42501`.
   - A REST `DELETE` on `transacciones` with an OAuth token, which must remove 0 rows.

**Rollback:** a migration that re-grants `UPDATE` on `usuarios` and drops the two restrictive policies. The code that calls `pedir_codigo_vinculacion` and `consumir_cupo_mcp` keeps working, because those functions stay.
