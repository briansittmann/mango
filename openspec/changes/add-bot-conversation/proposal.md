## Why

The bot loads expenses, incomes and savings from WhatsApp, but everything else it recognises gets a canned "not yet": a wrong load can only be fixed from the web, "¿cómo vengo?" gets no answer, and every load costs two messages from the test number's 1000 a month. The first real round (2026-09-28) hit exactly this ("osea lo que gaste esos 50 eran comida" → "todavía no"). This change is the rest of block 5 of `ROADMAP.md`. With it, Fase 1 closes and the bot can be used every day without the web.

## What Changes

- **Corrections on the last load**: "borrá eso" deletes the channel's last load (soft delete). "no, era 40" changes its amount and "eran comida" changes its category. Only the last load of that chat, never older rows (ARCHITECTURE.md §4). A recurring charge completed by the chat goes back to pending when deleted instead of disappearing.
- **Undo button**: the text confirmation carries an **Undo** reply button that deletes that load. The button press arrives as a WhatsApp interactive message, which the payload extractor now reads.
- **Progressive confirmation** (ARCHITECTURE.md §3): with `modo_confirmacion = 'auto'`, the first 15 loads of an account are confirmed in text with Undo, and later ones with an emoji reaction on the user's message. A load that answered a category question is always confirmed in text. `texto` and `reaccion` force one form. `usuarios.cargas_confirmadas` counts the loads. WhatsApp adapter only: the logic still knows nothing about it.
- **Queries**: "¿cómo vengo?" replies with the cycle's total spent, the top 5 categories and a link to `/dashboard`. "libre" / "¿cuánto me queda?" replies with the free margin and the link. Both are built from `resumenMensual`, the dashboard's own function (§3 *una sola capa de datos*). No model call is involved, and there is no advisor prose.
- **Create a category by chat**, only when asked explicitly ("creá la categoría Mascotas", optionally "presupuesto 200"). It gets the next free palette color and lives from the cycle in progress onward. When a category with the same name already exists, the bot says so and creates nothing. When one with a **similar** name exists, the bot asks "¿la creo igual?", holds that as the channel's pending question, and a "sí" creates it.
- **A recurring amount that differs changes only this cycle** (decision of 2026-09-30): "luz 72" when Luz expects 60 completes this month's charge at 72, and the reply says the fixed amount stays at 60. The bot never asks whether the change is permanent. The adapter's pending-decision TODO and its log line go away. **BREAKING** for the `recurring-expenses` requirement that planned that question.
- **VIP history**: `usuarios.vip` is set by hand in SQL, with no UI. For VIP accounts the logic stores every incoming and outgoing message in a new `mensajes` table, and the parser receives the last 10 messages from the last 24 hours as context. Other accounts store no text. The daily cron deletes `mensajes` older than 30 days.
- **Migration `0028`**: `usuarios.vip`, the `mensajes` table (RLS on, no policies), and `canales.ultima_carga_id` (the chat's last load). `cargas_confirmadas` and `modo_confirmacion` already exist since `0002`.
- **Not in this change**: onboarding by chat, invitations and rate limiting (blocks 9–10), advisor mode with the model (block 13), a settings UI for `modo_confirmacion` or `vip`, editing older rows by chat, queries other than "month" and "free margin".

## Capabilities

### New Capabilities
- `bot-conversation`: what the bot does with the actions beyond loading. This covers deleting, correcting and undoing the channel's last load, answering the month and free-margin queries, and creating a category by chat with its similar-name confirmation.
- `bot-progressive-confirmation`: how the WhatsApp adapter confirms a load. It covers text with Undo versus reaction, the 15-load threshold, the forced modes and the question exception.
- `bot-conversation-history`: VIP-only storage of incoming and outgoing messages, the parser's 10-message / 24-hour window and the 30-day retention.

### Modified Capabilities
- `bot-transaction-logging`: replies are no longer text-only (*Replies are plain text…* drops "no button and no reaction"). *Recognised but unsupported actions* keeps only `no_entendido` and `no_disponible`. A differing recurring amount says it applies only this cycle. A load reports the row it wrote so the adapter can remember it.
- `bot-message-parsing`: `crear_categoria` gains an optional `presupuesto` and a `confirmada` flag. The pending question can also be a category-creation confirmation. For VIP accounts the prompt carries the recent conversation.
- `messaging-channels`: a channel remembers its last load. The logic also receives the last load and an undo request. The pending question can be of two kinds.
- `recurring-expenses`: *The bot asks whether a change is permanent, and the adapter owns the answer* becomes "a differing amount from the bot changes only this cycle's charge".
- `recurring-charge-generation`: the daily job also deletes messages older than 30 days.

## Impact

- **Changed**:
  - `lib/bot/logic.ts`: corrections, undo, queries, category creation, history, and a `loaded` reply that carries the row id and the emoji.
  - `lib/bot/parser.ts`: schema, pending confirmation block, history block.
  - `lib/whatsapp/adapter.ts`: last-load pointer, confirmation form, counter, undo.
  - `lib/whatsapp/payload.ts`: button replies.
  - `lib/whatsapp/send.ts`: interactive button message and reaction.
  - `lib/data/channels.ts`: last load; the pending question as a union.
  - `lib/data/supabase/bot.ts`: category colors and the similar-name check.
  - `app/api/cron/recurrentes/route.ts`: the 30-day purge.
  - `messages/es.json` and `en.json` (`bot`).
  - `lib/bot/parser-cases.json` and `parser.eval.mjs`: cases for corrections, queries, creation and confirmation.
  - `ROADMAP.md` block 5, `CLAUDE.md` status, ARCHITECTURE.md §3 and §8.
- **New**:
  - `supabase/migrations/0028_conversacion_bot.sql`.
  - `lib/data/messages.ts`: the VIP history, admin client.
- **Real database** (production): `0028` adds a column to `usuarios` and one to `canales`, both nullable or defaulted, and a new empty table. It is applied through the MCP after Brian confirms, before the deploy. Brian marks himself VIP by SQL.
- **WhatsApp**: interactive reply buttons and reactions are sent inside the 24-hour customer-service window, which is always open when replying to the user's own message. No template is needed.
