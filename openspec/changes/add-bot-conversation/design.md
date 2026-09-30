## Context

The pipeline today:

- `lib/whatsapp/payload.ts` extracts text messages only.
- `lib/whatsapp/adapter.ts` resolves the account through `canales`, drops retries with `messageAlreadyProcessed` (a lookup on `transacciones` by `canal` + `mensaje_id_externo`), and round-trips `canales.pregunta_pendiente`.
- `lib/bot/logic.ts` parses with `parseMessage` (Gemini + Zod, seven actions, already recognising `corregir`, `borrar`, `consultar` and `crear_categoria`). It executes only `cargar` and `repreguntar`.
- `lib/whatsapp/send.ts` sends plain text.

Other pieces this change builds on:

- `usuarios.cargas_confirmadas` and `modo_confirmacion` exist since `0002`, unused.
- The creators in `lib/data/supabase/*` return `void`, not the new row's id.
- `completar_cargo_recurrente` returns the row id.
- `resumenMensual(client, usuario)` builds the dashboard's `DashboardData` (`expenses.total`, `expenses.groups[].spent`, `freeMargin`) and already runs with any client.
- `crear_categoria(p_usuario_id, p_nombre, p_color, p_presupuesto, p_periodo, p_solo_este_ciclo)` rejects `duplicate-category-name`.
- `CATEGORY_COLORS` lives in `components/molecules/color-swatch-picker.tsx`.

## Goals / Non-Goals

**Goals:**
- The logic stays channel-agnostic: every new piece of per-channel state (last load, pending confirmation) is held by the adapter, the same way the pending question is today.
- No new model call: queries come from `resumenMensual`, and corrections and undo are plain writes.
- Everything the chat can change is one row: the channel's last load or the row an Undo button names.

**Non-Goals:**
- Telegram (block 11): the logic contract is ready for it, but no adapter is written.
- A retry table for non-load messages (see D4).
- Moving `CATEGORY_COLORS` out of the component into `lib/`, beyond importing the list from where the bot can reach it (D7).

## Decisions

### D1. The last load is a pointer on the channel: `canales.ultima_carga_id`

The last load is stored as a nullable uuid on `canales`, with a composite FK `(ultima_carga_id, usuario_id) → transacciones (id, usuario_id)` and `on delete set null`. That FK enforces "never another account's row". The adapter reads it with the pending question (one select) and passes it as `IncomingMessage.lastLoadId`. The logic returns `lastLoad: string | null | undefined` on the reply (undefined = keep, null = clear, id = replace), and the adapter writes it.

- *Alternative: the account's newest transaction with `canal` set.* It fails for recurring completions, whose `creado_en` is the cron's insert time, not the chat's, and it needs an ordering column that doesn't exist.
- *Alternative: a pointer on `usuarios`.* It would make a WhatsApp "borrá eso" delete a Telegram load. The chat's own last load is what the user sees on screen.

The row id of a load comes from `completar_cargo_recurrente`'s return value. For the creators it comes from one lookup by `(usuario_id, canal, mensaje_id_externo)`, which is unique since `0020`. The `void` contracts the web uses stay unchanged.

### D2. Undo is a reply button whose id names the row

The text confirmation is sent as an interactive `button` message with one reply button: `id = "undo:<transaccion_id>"`, title from `bot.deshacer`, 20 characters at most. Pressing it arrives as `messages[].type = 'interactive'` with `interactive.button_reply.id`. `payload.ts` extracts it as a `WhatsAppMessage` with `buttonId` and empty text. The adapter parses the id and passes `undoId`. The logic skips the parser and deletes that row (D3) after checking that it belongs to the account and is not deleted. Otherwise it replies `yaDeshecho`.

- *Alternative: Undo always deletes the last load, as ARCHITECTURE §4 words it.* The button sits under a specific confirmation, so deleting a newer row would surprise. The text commands keep acting on the last load.

### D3. Deleting and correcting go through the existing data operations

- **Delete, ordinary row**: `softDelete` of the matching contract (`ExpenseMutations`, `IncomeMutations`, `SavingsMutations`), chosen by the row's `tipo`.
- **Delete, recurring charge** (row has `movimiento_recurrente_id` and `ciclo_mes`): one update back to `estado = 'pendiente'`, `monto = definition.monto_actual`, `fecha = fechaEnCiclo(ciclo_mes, dia_del_mes)` at 12:00 UTC. `canal` and `mensaje_id_externo` are kept, so a Meta retry of the original message is still discarded. The web's `deleteInCycle` is not used: it removes the charge from the month, and "borrá eso" means "that message was wrong", not "no Netflix this month".
- **Correct amount**: `update` of the contract with the row's current fields and the new amount. A withdrawal keeps its negative sign. Recurring rows use a direct update of `monto` only, so the definition is never touched.
- **Correct category**: expenses only, via `ExpenseMutations.update(id, draft, newCategoryId)`, the same path the web's category move uses.

The row is read first with `usuario_id` in the filter (`borrado_en is null`). A missing row gives `nadaQueCorregir`. Every write filters by `usuario_id`, as the bot does today.

### D4. Retries of non-load messages are made harmless, not detected

`messageAlreadyProcessed` only finds messages that wrote a transaction. A Meta retry of "borrá eso" is processed again, but by then the pointer is cleared (D1), so it replies "nothing to delete" and deletes nothing more. The other retries are harmless too:

- "no, era 40" writes 40 again.
- A creation hits `duplicate-category-name` and replies "already exists".
- A query replies twice.
- An Undo finds the row deleted.

Retries are rare (Meta retries only on non-2xx or timeout), and every outcome is idempotent or a second reply.

- *Alternative: a processed-message table for every message.* It is another table and another write per message, for a case that does no damage.

### D5. The reply contract

`BotReply` gains:
- `{ kind: 'loaded'; text; icon; transactionId; alwaysText: boolean }`. `alwaysText` is true after a pending category answer and for a differing recurring amount. It replaces `recurring-discrepancy`, and the discrepancy note is appended to `text`.
- `lastLoad?: string | null` on every kind (D1).
- `ask` carries `pending: PendingQuestion`, which becomes a union: `{ pregunta: 'categoria', tipo, monto, diasAtras } | { pregunta: 'crear_categoria', nombre, presupuesto, parecida }`. A stored question without `pregunta` (written before this change, at most 30 minutes old at deploy time) is read as `categoria`.

The adapter's `PendingRecurringDecision` type and its TODO are deleted.

### D6. Progressive confirmation lives in the WhatsApp adapter

On a `loaded` reply the adapter reads `cargas_confirmadas` and `modo_confirmacion` from `usuarios` (admin client, one select). It then chooses:

- **text + Undo** when `alwaysText`, or mode `texto`, or mode `auto` with a count under `TEXT_CONFIRMATIONS = 15`;
- **a reaction** otherwise.

It then sets `cargas_confirmadas = count + 1`. A read-then-write is enough, because one account's messages are handled one at a time in a webhook batch, and a lost increment only means one extra text. `send.ts` gains `sendUndoButton(phone, text, buttonId, label)` and `sendReaction(phone, messageId, emoji)`, both logging and swallowing failures like `sendText`. The emoji is the icon the text starts with (✅ 💰 🐷 🏦). The logic returns it explicitly instead of the adapter slicing the text.

### D7. Queries reuse `resumenMensual`; creation reuses `crear_categoria`

- **`mes`**: `data.expenses.total` and the top 5 `expenses.groups` by `spent` (> 0), each `formatBotAmount`-ed.
- **`margen_libre`**: `data.freeMargin`.
- **Link**: `${SITE_URL}/dashboard`. `SITE_URL` is a constant in `lib/metadata.ts` (today inline in `app/layout.tsx` as `metadataBase`), used by both.

`resumenMensual` reads six cycles, which is heavier than a query needs. It takes well under the 60 s budget, and a second aggregate would be a second truth (ARCHITECTURE §3).

**Creation** calls `crear_categoria` for the cycle in progress with `p_solo_este_ciclo = false`:
- **Color**: the first of `CATEGORY_COLORS` not used by the account's categories, else the first. The list moves to `lib/data/categories.ts`, and the swatch picker re-exports it, so a server module never imports a client component.
- **Similarity**: `normalizeName` equality means "already exists", without calling the function. Containment either way, or a Levenshtein distance ≤ 2, over the categories alive in the cycle (`loadBotContext`) is "similar". A small pure function goes in `lib/data/supabase/bot.ts` with unit tests.
- **`confirmada: true` without a matching pending creation question**: handled as a fresh request, so the similarity check still runs. The flag is trusted only when the channel held that question for that name.

### D8. VIP history in `mensajes`, owned by the logic

Migration `0028` creates `mensajes`:
- columns `id`, `usuario_id`, `canal`, `direccion` (`entrante` | `saliente`), `texto`, `mensaje_id_externo` (nullable), `transaccion_id` (nullable, composite FK with `usuario_id`, `on delete set null`), `creado_en`;
- index `(usuario_id, creado_en)`;
- partial unique `(usuario_id, canal, mensaje_id_externo) where direccion = 'entrante'`;
- RLS on, no policies.

`lib/data/messages.ts` (admin client) provides:
- `recentMessages(userId)`: the last `HISTORY_LIMIT = 10` from the last `HISTORY_WINDOW_MS = 24 h`, oldest first;
- `storeExchange(...)`: incoming with `on conflict do nothing`, then outgoing;
- `purgeOldMessages()`: deletes messages older than `RETENTION_DAYS = 30`.

`processMessage` reads `usuario.vip` (added to `Usuario`). When it is true, it loads history before parsing and stores the exchange after deciding the reply. The history goes into the prompt as a `CONVERSACIÓN RECIENTE` block with `Usuario:` / `Mango:` lines, placed before the pending-question block. For a reaction, the stored outgoing text is the confirmation text: the parser needs what was decided, not the emoji. Button presses are stored as incoming `↩︎ Deshacer`.

The cron calls `purgeOldMessages()` after the per-user loop, in its own `try`, and adds `{ purged }` or `{ purgeError }` to the report.

### D9. Parser changes

- **Schema**: `crear_categoria: { nombre, presupuesto?: positive, confirmada: boolean default false }`.
- **Prompt**:
  - a rule that `corregir` covers loose wording ("osea esos 50 eran comida");
  - a rule that a bare "sí" with nothing pending is `no_entendido`;
  - one example each for `borrar`, `consultar` and `crear_categoria` with a budget;
  - the pending block per kind;
  - the history block (D8).
- **`parser-cases.json`**: gains the conversation cases listed in `bot-message-parsing`, with an optional `pending` per case, and `parser.eval.mjs` passes it through.

## Risks / Trade-offs

- **"borrá eso" long after the load** → it still deletes the chat's last load, even days later. The reply names amount, category and day, so a wrong target is visible, and the web restores nothing (no undo for a chat delete). This is accepted per ARCHITECTURE §4 ("siempre la última").
- **Undo pressed after a correction** → it deletes the corrected row. That is what the button is attached to, and it is accepted.
- **Reopening a recurring charge recomputes the date from the definition's current day** → if the definition's day changed since generation, the reopened row moves to the new day. Rare, and it matches what the projection shows.
- **The interactive message counts as a message** (same quota as text) → no change in cost for the first 15. Reactions don't open a conversation.
- **`resumenMensual` cost per query** → six cycle reads and the projection branch are skipped (cycle in progress). If it becomes slow, a lighter reader can come later.
- **Count drift under concurrent messages** → at most an extra text confirmation; no data at risk.
- **Similarity false positives** ("Ocio" vs "Oficio" is distance 2) → costs one "¿la creo igual?" round.
- **VIP text is personal data** → admin-only table, 30-day purge, VIP set by hand for Brian only.

## Migration Plan

1. Write `0028_conversacion_bot.sql`:
   - `usuarios.vip boolean not null default false`;
   - `canales.ultima_carga_id uuid` plus its composite FK, which needs `unique (id, usuario_id)` on `transacciones`. `0019` only created it on `categorias` and `movimientos_recurrentes`, so `0028` adds it;
   - the `mensajes` table and its index and partial unique;
   - a comment update on `canales.pregunta_pendiente`.
2. Dry-run it with `execute_sql` inside a `do` block ending in `raise`, then apply it with `apply_migration` after Brian confirms, **before** the deploy. The old code ignores the new columns.
3. Deploy. Brian marks himself VIP: `update usuarios set vip = true where email = …`.
4. Rollback: revert the deploy. The migration can stay, since its columns are nullable or defaulted and the table is unused by the old code.
