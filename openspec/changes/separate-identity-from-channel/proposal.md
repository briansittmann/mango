## Why

Today a Mango account *is* a phone number: `usuarios.telefono` is `not null unique`, the webhook resolves the sender with `usuarios.telefono`, and idempotency is `transacciones.wa_message_id`, which only makes sense for WhatsApp. With open web sign-up (ARCHITECTURE.md §4) an account can exist without a phone, and a second channel (Telegram, block 11) needs its own identifier and its own message ids. Block 5 is about to make the bot write transactions; if it writes them tied to the phone, moving them later costs more than leaving the gap now (ROADMAP.md block 4).

## What Changes

- **New table `canales`** (migration `0020_canales.sql`): `usuario_id`, `tipo` (`whatsapp` | `telegram`), `identificador_externo`. Unique on `(tipo, identificador_externo)` — one number cannot be linked to two accounts — and on `(usuario_id, tipo)` — an account can have WhatsApp and Telegram at once, one of each. A WhatsApp identifier must be E.164. RLS enabled with no policies: only the service-role client (webhook) touches it for now.
- **`usuarios.telefono` becomes nullable.** The column stays (it is contact data the account menu shows); it stops being the bot's way to identify a sender. Its `unique` and E.164 check stay.
- **Data migration**: every `usuarios` row with a phone gets a `whatsapp` row in `canales` with that phone. On the real database this links Brian's account, which already receives messages in production, so the webhook keeps recognising him.
- **`findUserIdByPhone` reads `canales`** (`tipo = 'whatsapp'`) instead of `usuarios.telefono`. Its name and signature stay.
- **Idempotency per channel** — **BREAKING** for the column name: `transacciones.wa_message_id` is renamed to `mensaje_id_externo`, a new `canal` column (`whatsapp` | `telegram`) is added, both set or both null, and the unique key moves from `(usuario_id, wa_message_id)` to `(usuario_id, canal, mensaje_id_externo)`. No row on the real database has a `wa_message_id` today, so nothing is lost. `messageAlreadyProcessed` takes the channel.
- **Channel in the bot's internal format**: `IncomingMessage` gains `channel`, so block 5 can store the idempotency pair without the logic knowing anything else about WhatsApp. `processUnknownNumber` receives `{ channel, externalId, text, inviteRequired }` instead of a bare phone.
- **Invitation switch**: the WhatsApp adapter reads `WHATSAPP_REQUIRE_INVITE` and passes `inviteRequired` to the logic. Only the exact value `false` turns it off; missing or any other value keeps the code mandatory. The logic still returns `{ kind: 'none' }` for unknown numbers (invitations are block 10), so production behaviour does not change.
- **Nothing assumes the test number**: no cap of 5 recipients or quota of 1000 messages in code, and no hard-coded sender. Today's code already complies (checked with grep); the change records it as a requirement so later blocks keep it.
- **Test user without a phone**: `supabase/seed/test-user.sql` stops writing the placeholder `+10000000001` (it existed only because the column was `not null`) and upserts on `auth_user_id`; the real test user gets its placeholder phone and the channel the migration derived from it removed. The account menu hides the phone line when the account has none, which is also what a web-registered account will need.
- **Not in this change**: `mensajes` and `usuarios.vip` (block 5), invitations and linking a number from the web (block 10), the Telegram adapter (block 11), sending replies through the Cloud API, and any read of `canales` from the web.

## Capabilities

### New Capabilities
- `messaging-channels`: how the bot identifies who writes (a channel row, not the account's phone), the uniqueness rules for channels, per-channel message idempotency, the invitation switch, and the rule that nothing in code depends on Meta's test-number limits.

### Modified Capabilities
- `test-user-seed`: *The account is linked the way RLS expects* — the seeded account has no phone and no channel, and the upsert no longer keys on the phone.
- `dashboard-ui`: *Account avatar and menu* — the phone line appears only when the account has a phone.

## Impact

- **New**: `supabase/migrations/0020_canales.sql`, `lib/whatsapp/invite.ts` (+ `invite.test.mjs`), `openspec/specs/messaging-channels/`.
- **Changed**: `lib/data/users.ts` (`findUserIdByPhone` over `canales`, `Channel` type), `lib/data/transactions.ts` (`messageAlreadyProcessed` per channel), `lib/whatsapp/adapter.ts`, `lib/bot/logic.ts` (types and signatures only; still stubs), `lib/data/supabase/user.ts` and `lib/data/dashboard.ts` (`telefono`/`phone` nullable), `components/organisms/account-menu.tsx`, `supabase/seed/test-user.sql`, `ARCHITECTURE.md` §8 (column name `canal`), `ROADMAP.md` block 4, `CLAUDE.md` status.
- **Real database**: one migration and one data fix for the test user, each applied through the Supabase MCP only after Brian confirms. The migration renames a column the deployed code reads, so it is applied right before the deploy that ships the new code (design D6).
- **Untouched**: `app/api/whatsapp/route.ts`, `lib/whatsapp/payload.ts`, `lib/whatsapp/signature.ts`, `/demo` and `lib/demo/*`, existing migrations `0001`–`0019`.
