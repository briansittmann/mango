## Context

See proposal.md — Why. What is already in place and shapes this design:

- `app/api/whatsapp/route.ts` validates the HMAC, answers 200 and runs `handleMessages` inside `after()`. `lib/whatsapp/adapter.ts` resolves the sender through `canales` (`findUserIdByPhone`), discards retries with `messageAlreadyProcessed(userId, 'whatsapp', messageId)` and calls `processMessage({ userId, text, messageId, channel })`. `sendReply` only logs. `lib/bot/logic.ts` returns `{ kind: 'none' }`; `BotReply` already defines `text`, `none` and `recurring-discrepancy`.
- `lib/data/supabase/*` creators take a `DataContext` (`client`, `usuarioId`, `currency`, `timezone`) and filter every statement by `usuarioId`, so they run the same with the service-role client. `expenses.create` / `income.create` / `savings.addSavingsMovement` insert `transacciones` rows dated `${date}T12:00:00Z`; none of them writes `canal` or `mensaje_id_externo`. `completar_cargo_recurrente(p_usuario_id, p_movimiento_id, p_periodo, p_monto, p_fecha)` (0021) completes a pending charge or inserts a confirmed one, raises `already-confirmed`, `plan-completed`, `not-found`, `invalid-date`, `future-cycle`; it does not take a message origin either.
- `cycleRange` (`rango_ciclo` RPC) and `localDateOf` in `lib/data/supabase/cycle.ts` give the cycle of an instant and the local day of an instant. `usuarios` has `timezone`, `moneda_default`, `dia_inicio_ciclo`, `idioma` (`es` | `en`); `Usuario` in `user.ts` does not select `idioma` yet.
- `canales` (0020): `usuario_id`, `tipo`, `identificador_externo`, RLS on with no policies (admin client only).
- Node 23 runs `lib/**/*.test.mjs` importing `.ts` files directly (`projection.test.mjs`), as long as those files use relative imports and no Next-only modules.
- Vercel functions keep nothing between invocations: two consecutive webhook calls can land on different instances, so "the adapter owns conversation state" cannot mean a module-level `Map`.
- `messages/es.json` / `en.json` are read through next-intl's request config (cookie locale); the bot runs outside a request and its language comes from `usuarios.idioma`.
- `lib/bot/parser-cases.json`: 15 messages, expected action as a subset of fields, category list of `supabase/seed/brian.sql`.

## Goals / Non-Goals

**Goals:**
- One Gemini call per message in the happy path, two at most; Zod is the only gate between the model and a write.
- Every write goes through the existing `lib/data/supabase` creators or `completar_cargo_recurrente`; the bot adds no second way of writing a `transacciones` row.
- The parser is a pure module callable from a Node script, so `parser-cases.json` runs against the real model without Next.
- The logic stays platform-agnostic; the adapter holds the pending question and sends.

**Non-Goals:**
- Anything the proposal lists under *Not in this change* (`add-bot-conversation`).
- Multi-currency: the parsed message may mention a currency, the row is written in `moneda_default` (existing debt *Monedas mezcladas*).
- Typing the Supabase client with generated types.
- Recognising the language the account is not set to.

## Decisions

### D1 — The parser is a pure module with an injected model call

`lib/bot/parser.ts` exports `parseMessage(input, model)` where `input` is `{ text, categories: string[], recurringNames: string[], locale, pending?: { tipo, monto, diasAtras } }` and `model` is `(prompt: string) => Promise<string>`. `lib/bot/gemini.ts` builds that function from `@google/genai` (`GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`, `models.generateContent` with `responseMimeType: 'application/json'`, temperature 0, model id in one constant, `gemini-3.8-flash`, pinned by name rather than the `gemini-flash-latest` alias so a Google-side switch cannot change the eval's result unnoticed). The parser has only relative imports and no `server-only`, so `parser.eval.mjs` and a future unit test with a fake model can load it. `gemini.ts` reads the key inside the function, never at module scope, like `supabaseAdmin`.

*Why not `responseJsonSchema` from the Zod schema:* the action is a discriminated union with different fields per action; Gemini's schema subset handles unions poorly and the prompt already lists the exact shape. JSON mode plus Zod plus one retry is enough, and the eval script tells us if it is not.

*Alternative rejected:* calling the SDK from `logic.ts` directly — untestable without a key and couples the logic to Gemini.

### D2 — One Zod discriminated union, all seven actions

`ActionSchema = z.discriminatedUnion('accion', [...])` with the fields of `bot-message-parsing` → *A message becomes exactly one action from a fixed set*. `z.coerce` is not used: the prompt asks for numbers and a string amount is a schema failure that triggers the retry. Refinements: `monto > 0` for `gasto` / `ingreso`, `monto !== 0` for `ahorro`, `dias_atras` integer ≥ 0 with default 0, `recurrente` nullable and only meaningful when `tipo === 'gasto'` (the logic ignores it otherwise). `consultar`, `corregir`, `borrar`, `crear_categoria` are in the schema so the eval covers all 15 cases; the logic answers them with `bot.todaviaNo`.

### D3 — Prompt contents

System-style instructions in Spanish (the model follows them regardless of the message language), then the account data, then the message:

- Today's local date and the account language.
- The category list, verbatim from the database, and the rule: choose one of them or "Otros"; never invent one; `categoria` null only when the message has no description at all, and then `accion` is `repreguntar`.
- The active recurring expense names; set `recurrente` only when the message names one; incomes never.
- Conventions: decimal comma, "ayer" → `dias_atras` 1, "hace N días", "date" is an outing; withdrawal from savings is negative `ahorro`; `cobré` / `me pagaron` is `ingreso`.
- Six or seven examples in the account's language, taken from the case set.
- The pending question, when present: "In the previous turn the bot asked which category for a `gasto` of 50. If this message answers it, return `cargar` with that amount and category; otherwise parse the message on its own."
- On retry: the previous output and the Zod issues, and the instruction to return only the JSON object.

### D4 — Message origin travels in `DataContext`

`DataContext` gains `origin?: { channel: Channel; externalMessageId: string }`. `createSupabaseExpenseMutations`, `...IncomeMutations` and `...SavingsMutations` spread `canal` and `mensaje_id_externo` into their `insert` when `origin` is set; the web never sets it. One optional field, three one-line changes, no new writer, and the unique `(usuario_id, canal, mensaje_id_externo)` is written in the same statement as the row.

*Alternative rejected:* a bot-only `createBotTransaction` in `lib/data/supabase` — duplicates the three inserts (the proposal forbids it).

### D5 — `completar_cargo_recurrente` learns the message origin (migration 0023)

0023 replaces `completar_cargo_recurrente` with two extra nullable parameters, `p_canal` and `p_mensaje_id_externo`, written in both the `update` and the `insert` path, and drops the old signature. Without them a recurring completion would have no idempotency key: a Meta retry would hit `already-confirmed` and be answered again. The cron does not call this function; nothing else changes.

The same migration adds `canales.pregunta_pendiente jsonb` and `canales.pregunta_vence_en timestamptz`, both nullable (D7). Two nullable columns on a table with one row; no back-fill.

### D6 — Recurring match: complete, report, or refuse

The logic, for `cargar` with `tipo === 'gasto'` and `recurrente` set:

1. Resolve the definition by normalised name among the account's active `gasto` definitions (loaded once per message, D9). No match → ignore `recurrente`, ordinary load.
2. `fecha` from `dias_atras` (D8); `periodo` = `localDateOf(cycleRange(ref = fecha at noon UTC).inicio)`.
3. `rpc('completar_cargo_recurrente', { ..., p_monto, p_fecha: fecha, p_canal, p_mensaje_id_externo })`.
   - OK and `monto === monto_actual` → `{ kind: 'text', text: confirmation }`.
   - OK and different → `{ kind: 'recurring-discrepancy', text: confirmation, definitionId, definitionName, expectedAmount, loadedAmount }`. `BotReply`'s discrepancy variant gains `text` so the adapter can send the confirmation now and append its question in `add-bot-conversation`; the adapter keeps logging the discrepancy.
   - `already-confirmed` → no write, `{ kind: 'text', text: bot.yaCargado }`. Chosen over writing a second row: with real data, a silent duplicate of a fixed charge costs more than one honest "already logged" reply; a genuine second payment is rare and can be loaded from the web.
   - `plan-completed` / `not-found` → ordinary load in the definition's category with the definition name as description (the payment is real, the plan just ended).
   - Any other error → thrown; the adapter logs it and nothing is sent.

Why in this change and not the next: from 1 October the cron inserts Brian's 23 pending charges, and the first thing the test round will do is "luz 120". Without this branch every fixed charge loaded by chat duplicates a pending row; the function to avoid it already exists.

### D7 — The pending question lives on the channel row, for 30 minutes

The adapter reads the channel's `pregunta_pendiente` (when `pregunta_vence_en > now()`) before calling the logic and passes it as `pending` on `IncomingMessage`. The logic answers `repreguntar` with a new reply variant `{ kind: 'ask'; text; pending: { tipo, monto, diasAtras } }`; the adapter writes the question with `now() + 30 min`, then sends. Any other reply kind clears the question. Helpers in `lib/data/channels.ts` (admin client, like `users.ts`): `readPendingQuestion`, `writePendingQuestion`, `clearPendingQuestion`, keyed by `(tipo, identificador_externo)`.

*Why on `canales`:* the question belongs to the conversation on one channel, one at a time, and the table is already admin-only. A `mensajes` table is VIP history and comes in `add-bot-conversation`; a module `Map` does not survive Vercel invocations.

*Why 30 minutes (`PENDING_QUESTION_TTL_MS`, a code constant):* long enough to answer after a distraction, short enough that a bare word hours later ("super") is not glued to a forgotten amount. Any message from the channel resolves or drops the question, so the TTL only matters for silence.

### D8 — Dates and cycles

`today = localDateOf(new Date(), usuario.timezone)`; `fecha = today − dias_atras`, computed on the `YYYY-MM-DD` string with `Date.UTC` arithmetic (no DST drift). Plain rows are written with `date: fecha` through the creators (`T12:00:00Z`, the web's convention) and have no `ciclo_mes`, as the 0021 column comment states; only D6 computes a `periodo`, and only to hand it to the SQL function.

### D9 — What the logic loads per message

`lib/data/supabase/user.ts` gets `findUsuarioById(client, id)` returning `Usuario` plus `idioma` (the `Usuario` type and `findCurrentUsuario`'s select gain `idioma`). `lib/data/supabase/bot.ts` exports `loadBotContext(client, usuarioId)`: categories (`id`, `nombre`) and active `gasto` definitions (`id`, `nombre`, `monto_actual`, `categoria_id`), two selects filtered by `usuario_id`. Name matching normalises with `toLowerCase()` and `normalize('NFD')` minus combining marks; "Otros" is found the same way.

### D10 — Texts

`messages/*.json` gain a `bot` namespace: `confirmacionGasto` (`{monto}`, `{categoria}`, `{dia}`), `confirmacionIngreso`, `confirmacionAhorro`, `confirmacionRetiro`, `hoy`, `ayer`, `pregunta­Categoria` (`{categorias}`), `yaCargado` (`{nombre}`), `noEntendi`, `todaviaNo`. The logic uses `createTranslator({ locale: usuario.idioma, messages, namespace: 'bot' })` from `next-intl` (works outside a request) and `Intl.NumberFormat(locale, { ...currencyFormatOptions, currency })` from `i18n/formats.ts`, so amounts look like the web. Day: `hoy` / `ayer` / `Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })`.

### D11 — Sending

`lib/whatsapp/send.ts`: `sendText(phone, text)` → `POST https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages` with `Authorization: Bearer ${WHATSAPP_TOKEN}` and `{ messaging_product: 'whatsapp', to: digits, type: 'text', text: { body } }`. Missing variables or a non-2xx response are logged with `maskPhone` and swallowed: the row is already written and a thrown error here would only surface in the batch `catch`. `sendReply` sends `text`, `ask` and the `text` of `recurring-discrepancy`; `none` sends nothing.

### D12 — Order of operations in the adapter

resolve user → discard retry → read pending question → `processMessage` → write/replace or clear question → send. The write inside `processMessage` records the origin, so a retry that arrives after the write is discarded at step two; a retry after a failed parse is parsed again (no row, no key). `app/api/whatsapp/route.ts` sets `export const maxDuration = 60` so two model calls plus writes and the send fit inside `after()`.

### D13 — Parser evaluation script

`lib/bot/parser.eval.mjs`, run by `npm run test:parser` = `node --env-file=.env.local lib/bot/parser.eval.mjs`. Loads `parser-cases.json`, builds the Gemini model function, calls `parseMessage` per case with the file's categories, `recurringNames: []`, locale `es`, prints `ok` / `FAIL` per case with the parsed object on failure, exits 1 on any failure. Expected fields are compared as a subset; `categoria` case-insensitively. Named `.eval.mjs` so the `test:unit` glob `lib/**/*.test.mjs` does not pick it up. Gemini free-tier rate limits: cases run sequentially.

## Risks / Trade-offs

- [The parser misses a recurring name ("la luz 72" vs "Luz") and a pending charge gets a duplicate row] → the definition names are in the prompt and the eval can grow a case per fixed charge; a duplicate is visible in "Próximos cobros" and deleted from the web. Residual risk accepted for this change.
- [The parser mislabels a description as "no description" or vice versa] → the eval's "gasté 50" and "cosas 50"-style cases catch it; a wrong category lands in "Otros", never in a question.
- [A recurring completion for a past cycle] → `cerrar_pendientes` already confirmed it, so `already-confirmed` → "already logged", nothing written; the user loads it from the web if it was really a second payment.
- [Gemini latency or quota] → two calls at most, `maxDuration` 60, `no_entendido` on failure with nothing written; a Meta retry re-parses. Free-tier rate limits are per minute; the eval runs sequentially.
- [Free tier allows 5 requests per minute and 20 per day per model (`gemini-3.8-flash`, measured 2026-09-28), retries included, and uses the content to improve Google's products] → not enough for the eval (18–36 requests per run) or three users, and the content is financial. Decision (2026-09-28): billing on (Tier 1) with a 5 USD budget alert; estimated 0.20 USD/month at ~200 messages (0.40 from 2027), plus reasoning tokens if the model uses them. ARCHITECTURE.md §1 records the exception to *coste cero*. 503 "high demand" answers still cost a retry and end in `no_entendido` with nothing written; the eval keeps its 20 s pacing. Fallback if cost or latency bite: `gemini-3.5-flash-lite`, one constant, re-run the eval.
- [Send fails after the write] → the row exists, the reply is lost, the retry is discarded as processed. Accepted; logged with the number masked.
- [Every reply costs a quota message] → one reply per message until progressive confirmation (`add-bot-conversation`).
- [Hostile message text in the prompt] → the model's output is only ever a validated action on the sender's own account; the worst case is a wrong movement for that account.
- [`Usuario` type grows `idioma`] → additive; `findCurrentUsuario` selects one more column.
- [Old `completar_cargo_recurrente` signature removed] → no caller besides this change; the cron uses `generar_ciclo`.

## Migration Plan

1. `npm install zod @google/genai`; add `test:parser` to `package.json`.
2. Write `0023_pregunta_pendiente_y_origen.sql`; dry-run it on the real database inside a `do` block ending in `raise` through the MCP; 👤 Brian confirms; `apply_migration`; verify with `list_migrations` and a read-only query.
3. 👤 `GEMINI_API_KEY` in `.env.local`; `npm run test:parser` until the 15 cases pass; prompt tweaks are the fix, never the cases (unless the schema shape changes, per the file's `_descripcion`).
4. Implement logic, adapter, send, texts; `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run build`.
5. 👤 `GEMINI_API_KEY` in Vercel Production; redeploy.
6. 👤 Test round with the block-3 messages from Brian's WhatsApp; check each row on `/dashboard`; list failures in ROADMAP block 5.

Rollback: the parser and send only act inside `after()`; reverting the deploy returns the bot to `{ kind: 'none' }`. The 0023 columns are nullable and can stay; the function signature can be restored from 0021.

## Open Questions

- Whether an account without an "Otros" category should get one created automatically (onboarding, phase 2) or keep the question fallback. Does not affect this change: Brian's account has "Otros".
