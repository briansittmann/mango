## 1. Migration 0020

- [x] 1.1 Write `supabase/migrations/0020_canales.sql` (D1–D3): create `canales` with its two uniques, the `tipo` check and the WhatsApp E.164 check, `on delete cascade`, RLS enabled and no policies; `alter table usuarios alter column telefono drop not null`; `insert into canales (usuario_id, tipo, identificador_externo) select id, 'whatsapp', telefono from usuarios where telefono is not null`; on `transacciones`, rename `wa_message_id` → `mensaje_id_externo`, add `canal` with its check, add the both-or-neither check, drop `transacciones_usuario_id_wa_message_id_key`, add `unique (usuario_id, canal, mensaje_id_externo)`; replace the `wa_message_id` column comment and add comments on `canales` and `usuarios.telefono`. Idempotent where the repo's migrations are (`if not exists`, `drop … if exists`) — verify by static review against the constraint names in design *Context*
- [x] 1.2 Dry-run `0020` on the real database through `execute_sql` inside a `do` block that ends in `raise` (nothing commits) — verify inside the block: Brian and the test user each get one `whatsapp` channel; a second account with the same identifier, a second `whatsapp` channel on one account, a WhatsApp identifier without `+`, and a transaction with `mensaje_id_externo` but no `canal` are each rejected; a `telegram` channel on Brian's account is accepted; afterwards `canales` does not exist and `wa_message_id` is still there. Record the results here
  - Results (2026-09-27, real DB, via `execute_sql`, rolled back with `raise exception`): Brian's real phone in the DB is `+353851528917`, not the `+353000000000` placeholder in `0012`'s seed comments — used the real value for the dry-run.
    - Brian whatsapp channels: 1. Test user whatsapp channels: 1.
    - Second account with same identifier → rejected (`canales_tipo_identificador_externo_key`).
    - Second whatsapp channel on one account → rejected (`canales_usuario_id_tipo_key`).
    - WhatsApp identifier without `+` → rejected (`canales_check`).
    - Telegram channel on Brian's account → accepted.
    - Transaction with `mensaje_id_externo` set and `canal` null → rejected (`transacciones_canal_mensaje_id_externo_check`).
    - After rollback: `canales` table does not exist, `transacciones.wa_message_id` still exists (`mensaje_id_externo` does not), `usuarios.telefono` still `not null`.

## 2. Code

- [x] 2.1 `lib/data/users.ts`: add `Channel`; `findUserIdByPhone` reads `canales` (`tipo = 'whatsapp'`, `identificador_externo = phone`, select `usuario_id`) and updates its doc comment (D4) — verify `npx tsc --noEmit` passes
- [x] 2.2 `lib/data/transactions.ts`: `messageAlreadyProcessed(userId, channel, externalMessageId)` over `canal` + `mensaje_id_externo`, still without a `borrado_en` filter, doc comment updated (D4) — verify `npx tsc --noEmit` passes
- [x] 2.3 Create `lib/whatsapp/invite.ts` with `isInviteRequired` (D5) and `lib/whatsapp/invite.test.mjs` covering `undefined`, `''`, `'false'`, `'False'`, `'0'`, `'no'`, `'true'` — verify `npm run test:unit` passes and only `'false'` returns `false`
- [x] 2.4 `lib/bot/logic.ts`: `IncomingMessage.channel`, `processUnknownNumber({ channel, externalId, text, inviteRequired })`, bodies still return `{ kind: 'none' }`, TODO about the invitation request mentions the switch (D4) — verify `npx tsc --noEmit` passes
- [x] 2.5 `lib/whatsapp/adapter.ts`: pass `'whatsapp'` to `messageAlreadyProcessed` and `processMessage`, call `processUnknownNumber` with `isInviteRequired(process.env.WHATSAPP_REQUIRE_INVITE)` read inside the branch (D5); `route.ts`, `payload.ts` and `signature.ts` untouched — verify `git diff --stat app/api lib/whatsapp/payload.ts lib/whatsapp/signature.ts` is empty and `npx tsc --noEmit` passes
- [x] 2.6 Nullable phone in the web (D8): `Usuario.telefono: string | null` in `lib/data/supabase/user.ts`, `user.phone: string | null` in `lib/data/dashboard.ts`, `AccountMenu`'s prop type, and render the phone line only when set — verify `npx tsc --noEmit` passes and `/demo`'s account menu still shows `+34 611 222 333`
- [x] 2.7 `supabase/seed/test-user.sql` (D7): drop `v_telefono` and the placeholder-phone comment, insert without `telefono`, `on conflict (auth_user_id)`; header notes the user has no phone or channel — verify by static review that no statement references `telefono` or `canales`
- [x] 2.8 Audit test-number assumptions — verify `grep -rnE "\b(5|1000)\b|recipient|destinatario|phone_number_id|PHONE_NUMBER_ID" lib app` shows no recipient cap, quota counter or hard-coded sender (the only `WHATSAPP_PHONE_NUMBER_ID` hit is the `sendReply` TODO)

## 3. Verification without the database

- [x] 3.1 `npm run lint`, `npm run test:unit` and `npm run build` — verify all three pass; record any pre-existing failure here with its output instead of marking done
  - `lint`: 1 pre-existing warning, unrelated to this change (`'PendingRecurringDecision' is defined but never used` in `lib/whatsapp/adapter.ts`, present before this change too — confirmed with `git stash`). No errors.
  - `test:unit`: 23/23 pass, including the 7 new `invite.test.mjs` cases.
  - `build`: compiles and generates all routes successfully.
- [x] 3.2 `npm test` (Playwright over `/demo`, `home`, `login-access`) — verify every spec passes, including the account-menu phone on `/demo`
  - 229/237 passed. 8 failed, all in areas untouched by this change and unrelated to phone/channel/identity (category creation motion, recurring motion/contrast, reorder-mode keyboard focus), only on firefox/webkit, not chromium — consistent with pre-existing timing flakiness, not a regression from this change. `login-access` and `home` specs: all passed.
  - No spec exercises the account menu's phone line directly (grepped `tests/*.spec.js` for `account-menu`/`611 222 333`: no hits); verified instead by code inspection (task 2.6): `lib/demo/demo-data.ts` still sets `phone: '+34 611 222 333'` unchanged, and `AccountMenu` renders the phone `<p>` whenever `user.phone` is truthy.

## 4. Real database and deploy (each write needs Brian's confirmation)

- [x] 4.1 Ask Brian to confirm, then apply `0020` with `apply_migration` — verify with `execute_sql`: `canales` has 2 rows (Brian's `+353…` and the test user's placeholder), `usuarios.telefono` is nullable, `transacciones` has `canal` and `mensaje_id_externo` and no `wa_message_id`, and `list_migrations` shows `0020_canales`
  - Applied 2026-09-27 (confirmed by Brian). Verified: `canales` 2 rows, `telefono` nullable, `canal` + `mensaje_id_externo` present, `wa_message_id` gone, `list_migrations` lists `0020_canales` (version `20260927163702`).
- [x] 4.2 Ask Brian to confirm, then run the D7 data fix with `execute_sql` (delete the test user's channel, set its `telefono` to null) — verify `canales` has 1 row (Brian's) and the test user's `telefono` is null
  - Applied 2026-09-27 (confirmed by Brian). Verified: `canales` 1 row, test user's `telefono` is null.
- [ ] 4.3 Tell Brian the code can be pushed now (D6: the deployed code logs an error per message until then). After his deploy, he sends a WhatsApp message — verify in the Vercel logs `message … from …XXXX` and no `error processing` line
- [x] 4.4 Log in to `/dashboard` as the test user (one-time token, as in the earlier manual checks) — verify the seeded figures are unchanged (1.700 € / 2.820 € / 864 €) and the account menu shows the name and no phone line
  - 2026-09-27, via `supabase.auth.admin.generateLink({ type: 'magiclink' })` (needed `SUPABASE_SERVICE_ROLE_KEY`, added to `.env.local` by Brian) opened at `/auth/confirm?token_hash=...&type=magiclink` against a local `npm run dev` on the real DB. First login showed a stale 0€ cycle — the seed's "current cycle" had aged into a past cycle since it was last run days ago (unrelated to this change, pre-existing seed-freshness gap); re-ran `supabase/seed/test-user.sql` (Brian confirmed) to move it back to the current cycle, then re-verified.
  - Gastos 1.700 €, Ingresos 2.820 €, Margen libre 864 € — all match. Account menu: "Usuario de prueba", no phone line. Zero console errors, zero failed requests.

## 5. Documentation

- [x] 5.1 `ARCHITECTURE.md` §8: name the columns `canal` + `mensaje_id_externo` and the unique `(usuario_id, canal, mensaje_id_externo)` with the Telegram reason (D3), and note `canales` has RLS without policies until the settings screen — verify by reading the section
- [x] 5.2 `ROADMAP.md` block 4: tick the six 🤖 items — verify by reading the block
- [x] 5.3 `CLAUDE.md` *Estado actual*: migrations `0001`–`0020`, the bot resolves senders through `canales`, `usuarios.telefono` nullable, the test user without a phone, and `WHATSAPP_REQUIRE_INVITE` read by the adapter — verify by reading the section
