## 1. Database (`account-data-protection`, `whatsapp-linking`, `mcp-server` → *Tool calls are limited per account*)

- [x] 1.1 Inventory before writing (read only): grep every `.from('usuarios').update|upsert|insert` and every `client.rpc(` called with a user's JWT in `lib/`, `app/`; query `pg_proc` for every function in `public` with its `prosecdef` and current grants; check by query that no `usuarios.email` differs from its `auth.users.email`; verify the column list of D1 covers every JWT write found and report any email mismatch to Brian
- [ ] 1.2 Write `supabase/migrations/0043_endurecer_seguridad.sql`: column grants on `usuarios` (D1), `pedir_codigo_vinculacion()` (D2), the two restrictive policies (D3), `limites_uso` + `consumir_cupo` + `consumir_cupo_mcp` (D4), revokes from `anon`/`public` with re-grants to `authenticated` from 1.1's list, default privileges, and `search_path` on the three functions (D8); verify it parses and is idempotent by running it twice inside a `begin … rollback` on the real database through `execute_sql`, with Brian's confirmation
- [x] 1.3 In the same rolled-back transaction, prove the behaviours with `set local role authenticated` and `request.jwt.claims` set: updating `email`, `telefono`, `vip`, `codigo_vinculacion` fails with `42501`; updating `nombre`, `orden_widgets`, `medio_pago_default` succeeds; with a `client_id` in the claims, updating `nombre` changes 0 rows and deleting a `transacciones` row removes 0; `pedir_codigo_vinculacion()` returns the same code twice and a new one after backdating `whatsapp_solicitado_en` 8 days; `consumir_cupo_mcp()` is true 120 times and false the 121st; as `anon`, selecting `transacciones` fails with `42501`
- [x] 1.4 👤 With Brian's confirmation, apply `0043` to the real database (MCP `apply_migration`, or Brian in the SQL editor if a revoke is refused); verify by reading grants (`information_schema.column_privileges`), policies (`pg_policies`) and functions

## 2. Web and bot code

- [ ] 2.1 `requestWhatsAppLink` in `lib/data/supabase/profile.ts` calls `pedir_codigo_vinculacion` (D2); remove `generateLinkCode` and its test if nothing else uses it; verify `npm run test:unit`, `npx tsc --noEmit`, and against the real database as the test account brianreba97 that "Vincular WhatsApp" in the account sheet shows a code and shows the same one on reopening
- [x] 2.2 Linking attempt limit: new `allowLinkAttempt` dependency in `lib/whatsapp/handle-message.ts`, checked before `linkChannel` for an unknown number, wired in `adapter.ts` to `consumir_cupo('vincular:'+phone, 5, 3600)`; bilingual `bot.vincularEspera` in `messages/es.json` and `en.json` (voseo); verify with new cases in `lib/whatsapp/adapter.test.mjs` (sixth attempt answered to wait without calling `linkChannel`; a known number never consumes)
- [x] 2.3 Cron cleanup of `limites_uso` rows older than a day in `app/api/cron/recurrentes/route.ts`, reported in its JSON like `purgedContacts`; verify by running the handler locally against the real database (200, count in the JSON)
- [x] 2.4 Google `redirectTo` from `SITE_URL` when `VERCEL_ENV === 'production'` (D7) in `app/auth/google/route.ts`; verify `tests/login-google.spec.js` still passes and, after deploy, with `curl -X POST -H 'Host: evil.example'` (6.2)
- [x] 2.5 Security headers in `next.config.ts` (D6); verify with `next build && next start` and `curl -I` on `/`, `/dashboard`, `/oauth/consent`, `/api/mcp` that the five headers are present and `/.well-known/oauth-protected-resource` keeps `access-control-allow-origin: *`

## 3. MCP (`mcp-server`)

- [x] 3.1 `rate-limited` in `TOOL_ERROR_CODES` (`lib/mcp/errors.ts`) and `consumir_cupo_mcp` in `toolContext` (`lib/mcp/context.ts`) (D4); verify with a case in `lib/mcp/envelope.test.mjs` or `errors.test.mjs` that a context throwing `rate-limited` returns that code and runs nothing, and `scripts/mcp-smoke.mjs read` still passes against `next dev`
- [x] 3.2 `amountField` max 9,999,999,999.99 (D9) in `lib/mcp/tools/fields.ts`; verify with a unit case that 1e12 fails parsing and 9999999999.99 passes
- [x] 3.3 Consent host classes (D5): pure `hostKind` with a unit test (`claude.ai`, `api.claude.ai`, `chatgpt.com`, `localhost`, `127.0.0.1`, `[::1]`, `claude-ai.example.com`, `evilclaude.ai`), the warning row and the "app on this computer" line in `consent-card.tsx`, strings in `mcp.consentimiento` (es, en); verify with screenshots at 390px and 1280px of the three cases in the dark card, axe clean, the warning above the buttons in the first viewport at 390×700, and the existing consent spec still passing

## 4. Dependencies

- [x] 4.1 Upgrade `next` to the first release that clears the `npm audit` advisories (16.4.2 or later, `eslint-config-next` to match) and `sharp` to ≥ 0.35.5; verify `npm audit --omit=dev` reports no high or critical, `npm run build` succeeds, `npm run lint`, `npx tsc --noEmit` and `npm run test:unit` pass

## 5. Tests

- [x] 5.1 `npm test` in Chromium, then the three browsers; report failures with output and whether they are this change's (the known ones in CLAUDE.md *Deuda tecnica* excluded)
- [ ] 5.2 Against the real database as the test account brianreba97, with the one-time-token script at 390px: onboarding basics, account sheet save (name, currency, default payment method), widget order, "Vincular WhatsApp"; verify every write lands and nothing logs `42501`
- [x] 5.3 `SMOKE_EMAIL=brianreba97@gmail.com node --env-file=.env.local scripts/mcp-smoke.mjs read movements categories fixed cards` against `next dev`, plus a direct REST `PATCH usuarios` and `DELETE transacciones` with the smoke's OAuth token; verify the tools all pass, the PATCH changes 0 rows and the DELETE removes 0, and the script leaves nothing behind

## 6. Deploy and production checks

- [ ] 6.1 👤 Brian deploys after 1.4
- [ ] 6.2 On production: `curl -I` the headers; `/auth/google` with a forged `Host` returns a provider URL whose `redirect_to` is `https://www.usemango.dev/auth/confirm`; `/api/mcp` without a token still answers `401` with the metadata; `npm audit` clean on the deployed lockfile

## 7. Docs

- [ ] 7.1 `public/llms.txt` and the consent page's list match what now holds (an assistant cannot change the profile or erase movements); CLAUDE.md *Estado actual* and *Deuda tecnica* (drop "`usuarios_update_propio` sin lista de columnas" and the `orden_widgets`/`medio_pago_habilitado` entry, add the accepted risks of design.md), ROADMAP.md block 10 (MCP and linking limits done; sign-up still open), ARCHITECTURE.md (rate limits in Postgres, assistant tokens restricted by `client_id`); archive after `add-mcp-server` and `add-whatsapp-linking`, whose deltas this one writes over
