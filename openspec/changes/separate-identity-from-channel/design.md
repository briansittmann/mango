## Context

See proposal.md — *Why*. State that shapes the approach:

- **Real database** (checked through the MCP on 2026-09-27): migrations `0001`–`0019` applied; two `usuarios` rows — Brian's (real `+353…` phone, no `auth_user_id`, the one the production webhook recognises) and the test user (placeholder `+10000000001`, linked to auth, e-mail set). Zero `transacciones` rows have a `wa_message_id`. No `canales` or `mensajes` table exists.
- **Constraints named on the real database**: `usuarios_telefono_key` (unique), `usuarios_telefono_check` (E.164), `transacciones_usuario_id_wa_message_id_key`.
- **Code that touches the phone or the message id**: `lib/data/users.ts` (`findUserIdByPhone`, `usuarios.telefono`), `lib/data/transactions.ts` (`messageAlreadyProcessed`, `wa_message_id`), `lib/whatsapp/adapter.ts` (calls both, passes the phone to `processUnknownNumber`), `lib/bot/logic.ts` (stubs that return `{ kind: 'none' }`), `lib/data/supabase/user.ts` + `lib/data/supabase/dashboard.ts` + `lib/data/dashboard.ts` (`telefono: string` → `user.phone`), `components/organisms/account-menu.tsx:204` (renders `user.phone`). No migration after `0012` mentions either column.
- **The webhook is live** (block 2): `route.ts` answers 200 at once and runs `handleMessages` inside `after()`; each message is wrapped in its own `try/catch`. Replies are not sent yet (`sendReply` only logs).
- No code mentions a recipient cap, a message quota or a phone number id other than the `WHATSAPP_PHONE_NUMBER_ID` TODO in `sendReply` (grep on `lib`, `app`, `components`).

## Goals / Non-Goals

**Goals:**
- The bot resolves senders through `canales`, and Brian keeps being recognised across the migration.
- Idempotency is keyed so a Telegram adapter can reuse it unchanged.
- The invitation switch is read in one place and is testable without a server.

**Non-Goals:**
- Keeping `usuarios.telefono` in sync with `canales`. Nothing writes either from the app today; the link flows of block 10 decide that.
- Any web read of `canales` (settings "WhatsApp" section is block 9/10), and therefore any RLS policy on it.
- Normalising Argentine `wa_id`s (the `toE164` TODO stays as is).

## Decisions

### D1 — `canales` shape and access
```
canales (
  id uuid pk default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('whatsapp','telegram')),
  identificador_externo text not null,
  unique (tipo, identificador_externo),
  unique (usuario_id, tipo),
  check (tipo <> 'whatsapp' or identificador_externo ~ '^\+[1-9]\d{6,14}$')
)
```
RLS enabled with **no policies**, same as `mensajes` in ARCHITECTURE.md §8: the only reader is the webhook with the service role, which bypasses RLS. *Alternative*: a `select` policy for the owner now. Rejected: no screen reads it yet, and a policy nobody exercises is untested surface; block 9/10 adds it with the settings screen. The E.164 check reuses the regex of `usuarios_telefono_check` so a phone that was valid in `usuarios` is valid as a channel.

### D2 — `usuarios.telefono` stays, nullable
`alter column telefono drop not null`; the unique key and the E.164 check stay (both accept null). The column keeps meaning "the account's contact phone", which the account menu shows through RLS; `canales` means "who is allowed to write to the bot". *Alternative*: drop the column and show the phone from `canales`. Rejected: `canales` has no policies (D1), so the dashboard could not read it, and dropping a column is outside this block.

### D3 — Idempotency key: `(usuario_id, canal, mensaje_id_externo)`
`rename column wa_message_id to mensaje_id_externo`, `add column canal text check (canal in ('whatsapp','telegram'))`, `check ((canal is null) = (mensaje_id_externo is null))`, drop `transacciones_usuario_id_wa_message_id_key`, add `unique (usuario_id, canal, mensaje_id_externo)`. Column name `canal` matches `mensajes.canal` in §8.
*Alternative*: `unique (canal, mensaje_id_externo)` without the user. Rejected: Telegram's `message_id` is unique only inside one chat, so two users would collide; WhatsApp's `wamid` is global, so adding `usuario_id` costs nothing there. It is also the old key's scope ("único por usuario"), so behaviour for WhatsApp does not change. Rename rather than add-and-drop because no row has a value (Context).

### D4 — Code over the new columns
- `lib/data/users.ts`: `export type Channel = 'whatsapp' | 'telegram'`. `findUserIdByPhone(phone)` keeps its name and signature and queries `canales` with `tipo = 'whatsapp'` and `identificador_externo = phone`, returning `usuario_id`. A generic `findUserIdByChannel` waits for the Telegram adapter, which is when a second caller exists.
- `lib/data/transactions.ts`: `messageAlreadyProcessed(userId, channel, externalMessageId)` filters on `usuario_id`, `canal` and `mensaje_id_externo`; still no `borrado_en` filter.
- `lib/bot/logic.ts`: `IncomingMessage` gains `channel: Channel`; `processUnknownNumber({ channel, externalId, text, inviteRequired })`. Bodies stay stubs; the `void` lines follow the new parameters. The logic imports `Channel` from `lib/data/users.ts`, which it will import anyway for writes in block 5.
- `lib/whatsapp/adapter.ts`: passes `'whatsapp'` everywhere and `inviteRequired` from D5. Logs keep `maskPhone`.

### D5 — The switch is a pure function read per message
`lib/whatsapp/invite.ts`: `export function isInviteRequired(value: string | undefined): boolean { return value !== 'false' }`, no imports, so `node --test` can load it the way `lib/data/budget.test.mjs` loads `budget.ts`. The adapter calls `isInviteRequired(process.env.WHATSAPP_REQUIRE_INVITE)` in the unknown-number branch, not at module scope, matching how `supabaseAdmin()` reads env. It lives under `lib/whatsapp/` because the variable is WhatsApp's; the logic only sees the boolean. *Alternative*: trim/lowercase the value. Rejected: ARCHITECTURE.md §4 says only `false` turns it off, and failing closed on a typo is the safe side.

### D6 — Deployment order: migration first, deploy right after
Deployed code reads `usuarios.telefono` (still there after the migration) and `wa_message_id` (renamed). Between applying `0020` and the new deploy, `messageAlreadyProcessed` fails for a known sender. That error is caught per message inside `after()`, Meta already got its 200, and the logic would have returned `none` anyway, so nothing visible breaks; only an error log line per message. The reverse order is worse: new code would query a `canales` table that does not exist and treat Brian as unknown. So: Brian confirms, `0020` is applied through the MCP, Brian pushes, Vercel deploys. *Alternative*: keep `wa_message_id` and drop it in a later migration. Rejected: two migrations and a sync period to avoid a log line on a code path with no effect.

### D7 — Test user: data fix, not migration
The placeholder phone comes from `supabase/seed/test-user.sql`, which is not a migration, so `0020` stays generic (it copies every phone, including the placeholder). A separate statement run through `execute_sql` after confirmation deletes the test user's `whatsapp` channel and sets its `telefono` to null, identifying the row by `telefono = '+10000000001'`. The seed drops `v_telefono`, inserts without a phone, and upserts `on conflict (auth_user_id)` (`usuarios_auth_user_id_key` exists). `0012` is left as is: its `on conflict (telefono)` still works with a nullable unique column.

### D8 — UI tolerates a missing phone
`Usuario.telefono: string | null`, `DashboardData.user.phone: string | null`, and `account-menu.tsx` renders the phone `<p>` only when `user.phone` is set. The demo keeps its phone, so existing Playwright specs over `/demo` see no change.

## Risks / Trade-offs

- [The window of D6 is longer than expected, e.g. the push waits a day] → Messages from Brian log an error and are otherwise ignored, same outcome as today's stub. Apply `0020` only when the push is ready.
- [A future web "link WhatsApp" writes `usuarios.telefono` but forgets `canales`] → The bot would not recognise the number. Spec *Phone without channel* makes this explicit; block 10 writes the channel.
- [Two sources for "the phone" (`usuarios.telefono`, `canales`)] → Accepted for now (D2); they are allowed to differ, and only `canales` authorises.
- [Test user's data fix runs before `0020`] → The delete finds no channel and the update still clears the phone; running it after `0020` is the documented order.

## Migration Plan

1. Write `0020_canales.sql` (D1–D3, plus the data copy) and review it against the constraint names in *Context*.
2. Dry-run inside a `do` block that ends in a `raise` (nothing commits), as done for `0017`/`0019`: check Brian gets a channel, the test user gets one, the uniques and checks reject the spec's bad cases.
3. After Brian confirms: apply `0020` with `apply_migration`, run the D7 data fix with `execute_sql`, and Brian pushes the code.
4. Verify with a real WhatsApp message from Brian: Vercel logs show `message … from …XXXX` and no `error processing`.

Rollback (SQL, only if needed before any row uses the new columns): drop the new unique and check on `transacciones`, drop `canal`, rename `mensaje_id_externo` back to `wa_message_id`, re-add `unique (usuario_id, wa_message_id)`; `drop table canales`; `set not null` on `telefono` only after putting back the test user's placeholder. Then redeploy the previous commit.
