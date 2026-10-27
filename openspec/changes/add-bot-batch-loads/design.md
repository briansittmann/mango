## Context

The bot handles one action per message (`lib/bot/parser.ts` → `ActionSchema`, a union of seven). `processMessage` (`lib/bot/logic.ts`) runs it, writes at most one row and returns one `BotReply`; the adapter (`lib/whatsapp/adapter.ts`) confirms a `loaded` reply in text with `undo:<transaccion_id>` or with a reaction, and stores `reply.lastLoad` in `canales.ultima_carga_id`. Three constraints shape the design:

- `transacciones` has a unique index on `(usuario_id, canal, mensaje_id_externo)` (`0020`), and the check from `0045` makes `mensaje_id_externo` mandatory for `whatsapp`/`telegram` rows. Idempotency (`messageAlreadyProcessed`) and `writtenRowId` look a row up by the plain message id.
- `canales.ultima_carga_id` is one uuid with a composite FK to `transacciones (id, usuario_id)` (`0028`).
- The Undo button id is `undo:<uuid>` (`UNDO_ID` in `handle-message.ts`), within WhatsApp's 256-character button id.

Measurements behind the decisions are in the proposal (Why). The model already answers a list as a JSON array when it is not forbidden; the slow part is reconciling a list with a one-action contract.

## Goals / Non-Goals

**Goals:**
- A list of movements in one message (text or voice) is loaded as rows, each written exactly as the single-load path writes it.
- No migration: a batch is identified by its message id.
- The single-load path keeps its behaviour and its replies byte for byte.

**Non-Goals:**
- Mixing loads with other actions in one message ("café 3 y ¿cómo vengo?"): the parser picks one action, as today.
- Asking questions inside a batch (category, deposit, repeated charge): a batch never asks.
- Editing a batch from the web as a unit: on the web the rows are independent movements.
- Agent mode (Code Mode): separate change, after `eventos_bot` has data.

## Decisions

### D1. An eighth action, `cargar_varios`, with the `cargar` items inside

`{ "accion": "cargar_varios", "cargas": [cargar, …] }`, `cargas` with 2 to 20 items, each validated by the same `CargarSchema` (with its refinements: transfers, savings without method). For a voice note the whole action carries one `transcripcion`, as every voice action does (`VoiceActionSchema` gains the variant). A bare JSON array of `cargar` objects, which the model tends to emit, is normalised to `cargar_varios` before validation, so it does not cost a retry; a one-item list is normalised to that `cargar`.

The prompt adds one rule ("several movements, separated by comma, «y» or lines → `cargar_varios`, one `cargar` per movement in the message's order; one movement is still a plain `cargar`"), and examples in both languages (comma list, list by lines). The voice rule "devolvé solo el primero" is replaced by the same rule.

*Alternatives:* a `cargar` with an array `monto` (breaks every consumer of `cargar`); allowing only the bare array (the retry message and the voice `transcripcion` need an object); a cap of 10 in the schema (more than 10 would fail validation, retry, and end as `no_entendido` with nothing loaded: worse than loading 10 and saying the rest was not).

### D2. Row ids: the first written row keeps the message id, the rest get `#2`…`#10`

The n-th row a batch writes records `mensaje_id_externo = <wamid>` for n = 1 and `<wamid>#<n>` after. The unique index holds, `messageAlreadyProcessed` (plain id) still discards a retry once the first row is written, and a WhatsApp id never contains `#`. "Written" order, not item order: a skipped item takes no number, so the first row written always carries the plain id.

The rows of a load are then found from the row named by `ultima_carga_id` or the Undo button: that row (read whatever its state) gives the message id, and the load is every confirmed, not deleted row of the same account and channel whose `mensaje_id_externo` is that id or that id with `#2`…`#10` (an `in` list, no `like`). So deleting the first row of a batch on its own leaves the rest reachable. A single load is the same lookup with no siblings, so `borrar`, `corregir` and Undo have one code path; an empty load is "nothing to change" or "already undone", as today.

The bot gets the per-row id by giving each write its own `DataContext.origin.externalMessageId` (the creators already take it from there), and `completeRecurring` and `writtenRowId` take the row's external id instead of `message.messageId`.

*Alternatives:* a `lote` uuid column on `transacciones` (a migration, an index and a column the web would carry forever for a bot detail); a `uuid[]` in `canales` (Undo on an older batch would still need the rows, and the FK would be lost).

### D3. The batch reuses the single-load functions, never asks, and stops at the limits

`loadBatch` walks the items in order and, for each, runs the same steps `load` runs: the daily quota (`consumir_cupo_altas_usuario`), the category by name with Otros, the recurring definition by name (`completar_cargo_recurrente`, so a deleted-for-this-month charge comes back), then the writer for its type. Where the single path would ask, a batch decides:

| Single load | In a batch |
|---|---|
| No description and no category → asks the category | Otros (or skipped and named when the account has no Otros) |
| Fixed charge already charged → asks with two buttons | Skipped and named ("Spotify ya estaba cobrado") |
| Ambiguous bank deposit → asks with two buttons | Loaded as an income |
| Transfer without the payment-method feature → not understood | Skipped and named |

It stops writing at the 10th row (`MAX_BATCH_ROWS = 10`) or at the first refused quota; what was not written is named in the reply. A write that throws stops the batch too: the rows already written stay, and the reply lists them and says the rest could not be loaded (Risks).

The steps are factored out of `load` so both paths call them; `load` keeps its replies and its questions.

### D4. One confirmation text, always text, counted once

`batchConfirmationText` (`lib/bot/format.ts`, pure, tested) renders:

```
Anotado ✅ 3 movimientos:
✅ Súper · 25 € en Comida
✅ Nafta · 40 € en Transporte, ayer
💰 Propina · 500 €
No anoté: Spotify (ya estaba cobrado) y 2 más (máximo 10 por mensaje).
```

Each row is the single confirmation's line without "Anotado" and without the budget line: its icon (`loadIcon`), name, amount, category when it differs from the name, day when not today.

No budget line per row (a batch in three categories would be three lines of figures). The reply is `kind: 'loaded'` with `alwaysText: true`, `transactionId` = the first row (the Undo button and `lastLoad`), and `icon` ✅. The adapter therefore sends text with Undo and raises the day's count by one: one message, one confirmation. A batch where every item was skipped is a plain text listing why, with nothing written and `lastLoad` untouched. A batch that wrote exactly one row (the rest skipped) is confirmed as a batch, so the skipped line is read.

### D5. `borrar` and `corregir` may name the row: `cual`

Both actions gain an optional `cual` (the movement as the person named it: "la nafta", "el cine"). On a single-row load it is ignored. On a batch:

- `cual` matches exactly one row by description, else by category name (the bot's `normalizeName`, case and accents aside) → act on that row only. Deleting one row of a batch keeps the batch as the last load (the rest stay changeable); deleting the last remaining row clears it.
- `borrar` without `cual` deletes every row of the load; the reply names how many and their total. A `cual` that matches none or several rows deletes nothing and asks which one, like `corregir`.
- `corregir` without `cual` (or with a `cual` that matches none or several) changes nothing and replies `bot.cualCorregir`, listing the rows ("¿Cuál? Decime, por ejemplo, «la nafta era 40»: Súper 25 €, Nafta 40 €, Cine 12 €."). No pending question is stored: the next message is a normal `corregir` with `cual`.
- Undo deletes every row of its load, whatever was named before.

### D6. Thinking level low for text, adopted through the eval

`createGeminiModel` passes `thinkingConfig: { thinkingLevel: LOW }` on a text call when `GEMINI_TEXT_THINKING_LEVEL` (a constant in `gemini.ts`, not an env var) is set; a voice note always runs the default thinking. It is set only while `npm run test:parser` passes every case on the primary and on the fallback model, and both accept the parameter (`gemini-3.8-flash` rejects `'minimal'`).

Measured 2026-10-26: with `LOW` on every call, every text case passed on both models, but three voice notes came back transcribed in digits ("café 350" for "café tres cincuenta"), so a single constant for all calls stayed unset. The end-to-end run then showed lists of 8 or more items taking 11–24 s with the default thinking, past the 12 s timeout, against 4–5 s with `LOW`. Hence the split (Brian's choice): text with `LOW`, voice with the default. A spoken list of many items can still run long; the timeout and the fallback cover it as for any slow call.

### D7. Outcome and history

`outcomeOf` returns `cargado_varios` for a batch that wrote rows. The VIP history links the incoming message to the first row (`mensajes.transaccion_id` is one uuid). The VIP history's parser context is unchanged.

## Risks / Trade-offs

- [A batch is not atomic: a failure after row 3 leaves 3 rows and a Meta retry is discarded (the plain id is on row 1)] → the reply lists the rows written and says the rest failed; the person resends only those. An atomic batch needs a database function that inserts any type, which duplicates the web's contracts.
- [The model splits one movement into two ("súper 25 y 3 de bolsas") or merges two] → the confirmation lists every row, Undo removes the whole batch, and "borrá las bolsas" removes one row. Eval cases for both shapes.
- [A list of 11–20 loads only 10] → the reply says how many were left out; the person resends them. More than 20 fails validation twice and is `no_entendido` (rare; the prompt asks for the list as it is).
- [`cual` matching by name is loose: two rows in Comida] → only an exact single match acts; otherwise the bot asks.
- [Thinking low lowers accuracy on text cases outside the eval] → adopted only after the full eval on both models, and never for voice; `eventos_bot` will show a rise in `no_entendido` or corrections if it happens, and reverting is one constant.
- [The undo of a batch that revived a fixed charge leaves it pending, not deleted] → as for a single load (CLAUDE.md, Deuda técnica).

## Migration Plan

No migration. Deploy the code; the parser accepts the new action from the first message. Rollback is a revert: rows already written by a batch are ordinary rows with ids `<wamid>#n`, and the old code reads them as independent loads (Undo on the first row deletes only that row).
