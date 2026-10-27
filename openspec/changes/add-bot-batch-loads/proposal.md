## Why

People load expenses in bursts ("café 3, súper 25 y nafta 40", or one per line after a day out), and today the bot loads none of them. The parser must return exactly one action, so a message with several movements comes back `no_entendido` (2 of 2 runs for a comma list and for "gasté 25 en el súper y 40 de nafta", 2026-10-26). A list with one movement per line is worse: the model reasons for 2,500–4,500 tokens about how to fit three movements into one action, takes 25–39 s and both attempts hit the 12 s timeout, so the person is told to send it again later, which fails the same way. Measured the same day: when the prompt allows a list, the same three messages parse correctly in 7–8 s, and in about 3 s with the model's thinking set to low. A voice note with several movements loads only the first one (a rule written for this reason in `add-voice-messages`).

## What Changes

- **A message can load several movements.** The parser gains an eighth action, `cargar_varios`: a list of 2 to 20 `cargar` items, in the order of the message. A text or a voice note with several movements becomes one `cargar_varios`. One movement is still a plain `cargar`.
- **The bot writes up to 10 per message**, in order, each one exactly as a single load would be written (category by name with Otros, recurring charges completed or revived, the daily limit per row). In a batch nothing is asked: an item with no description goes to Otros, a recurring charge already charged this cycle is skipped and named, a transfer for an account without payment methods is skipped and named. Items past the tenth, or past the daily limit, are not written and the reply says so.
- **One confirmation for the whole batch**, always in text with one Undo button: "Anotado ✅ 3 movimientos:" followed by one line per row (icon, name, amount, category, day when not today), plus a line for what was skipped. No budget line per row.
- **The batch is one load for the conversation.** The channel's last load, Undo and "borrá eso" act on every row the message wrote. "No, era 40" and "borrá eso" may name one movement ("la nafta era 40", "borrá el cine"), and then act on that row only. A correction on a batch that names none asks which one, listing the rows, without holding a question.
- **The parser runs text messages with thinking set to low**, kept only while the evaluation passes with it on both models (the primary and the fallback); voice notes keep the default, because with low their amounts came back in digits. Measured: simple messages go from 3.2 s to 2.7 s, lists from 7–8 s to 3.3 s, and a list of 12 from 11–24 s (past the 12 s timeout) to 4–5 s.
- **Voice notes**: a note with several movements loads them all, instead of only the first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bot-message-parsing`: *A message becomes exactly one action from the seven* — eight actions, with `cargar_varios`, and `corregir` and `borrar` may name the movement they mean; *The parser is evaluated against the recorded cases* — the cases include lists by comma, by "y" and by line, and a correction that names a movement.
- `bot-transaction-logging`: new requirement *A message with several movements loads them all*; *Loads count against the daily limit* — every row of a batch counts, and a batch stops at the limit.
- `bot-conversation`: *The chat's last load is the only row the chat can change*, *Deleting the last load*, *Correcting the last load* and *Undo removes the load it belongs to* — a load is every row one message wrote; deleting, correcting and undoing act on all of it, or on the one row a message names.
- `bot-progressive-confirmation`: *Some replies are always text* — a batch is always confirmed in text with Undo, and counts as one load of the day.
- `bot-voice-messages`: *A voice note is handled as a message* — a note with several movements loads them all.

## Impact

- **Bot**: `lib/bot/parser.ts` (the `cargar_varios` and `cual` schema, prompt rules and examples, voice rule, thinking level passed through `Model`), `lib/bot/gemini.ts` (`thinkingConfig`), `lib/bot/logic.ts` (batch load, one confirmation, the load as a set of rows for `borrar`, `corregir` and `undo`, `outcomeOf` → `cargado_varios`), `lib/bot/format.ts` (`batchConfirmationText`), `messages/*.json` (`bot.cargadoVarios`, skipped and limit lines, `bot.cualCorregir`).
- **Tests**: `lib/bot/parser.test.mjs` (schema and prompt with a fake model), `lib/bot/format.test.mjs` (batch text in both languages), `lib/bot/parser-cases.json` and `parser.eval.mjs` (list cases, correction naming a movement), and a new `lib/bot/batch.test.mjs` for the per-item decisions and the row matching.
- **Database**: nothing. Rows of a batch keep the unique `(usuario_id, canal, mensaje_id_externo)`: the first row carries the message id, the rest the id with `#2`…`#10` (design D2). `eventos_bot` gets the outcome `cargado_varios`.
- **Adapter**: `lib/whatsapp/adapter.ts` unchanged in shape; a batch is a `loaded` reply with `alwaysText`.
- **Docs**: CLAUDE.md, ARCHITECTURE.md §3 (one message, several rows), `docs/bot-conversacion-ejemplo.md` after the round.
- **Not touched**: the web, the MCP server, the onboarding.
