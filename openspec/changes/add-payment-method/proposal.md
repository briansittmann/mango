## Why

A user asked to tell cash from card: people who live on tips paid in cash, and Argentine users who pay a lot in cash, want to know how much cash they have left and how much is left in the bank, without Mango splitting its screen in two. Today a movement says what, how much and when, never *how it was paid*.

## What Changes

- **A payment method on every expense and income row**: `efectivo`, `tarjeta` or unspecified (null). It is an attribute, like `es_fijo`, not a separation: cards, budgets, charts and the free margin stay exactly as they are. Savings rows carry none.
- **A default payment method** on the account (`Ninguno` / `Efectivo` / `Tarjeta`, default `Ninguno`), chosen in the "Cuenta" sheet next to the currency and saved with its "Guardar", because it is account data (it applies on every device and to the bot), not a visual preference like theme or language. It preselects a chip in the entry sheet and fills the bot's loads when the message does not say the method.
- **Recurring definitions carry a payment method too**: chosen with the row that creates them, changed with the usual "Solo este mes" / "Desde este mes en adelante" reach, and copied onto every charge the cron generates. A generated charge never takes the account default.
- **Transfers between the two pockets**: a new kind of movement (`tipo = 'transferencia'`) for an ATM withdrawal (card → cash) or a deposit (cash → card). It counts in no income, expense, savings, budget, pace, chart, free-margin or projection figure; it only moves the pocket balances.
- **Pocket balances**: per pocket, what came in by that method minus what went out by it, plus or minus transfers. They appear only once the user has at least one movement with a payment method; until then nothing on the dashboard changes.
- **UI** (placement from Brian's mockup, styling from `design-system`):
  - two optional chips, "Efectivo" and "Tarjeta", in the entry sheet for expenses and income, under the amount;
  - a small muted icon (banknote or card) next to the date of a row that has a method;
  - inside the free-margin card, under the number and a thin divider, two subordinate blocks "Efectivo" and "Tarjeta" with their balances, and a round button between them that opens "Mover plata";
  - the "Mover plata" sheet (amount, "Sale de" / "Entra a" with a swap button, date, preview of both balances and "El margen libre no cambia");
  - the pocket list, opened from a block: balance, "Entró X · Salió Y" for the cycle, that pocket's movements, and its transfers in grey with no sign. Transfers live only there.
- **Bot**: the parser reads the method when the message says it ("pagué 15 en efectivo de cervezas"), otherwise the logic uses the default, otherwise null; it never asks for it. It recognises transfers ("saqué 200", "deposité las propinas"). "Ingresé 200 en el banco" is ambiguous between an income and a deposit: for users who already use the feature the bot asks with two reply buttons, "Lo pasé desde efectivo" / "Es un ingreso nuevo"; for everyone else it loads an income. The confirmation names the method only when the user said it.
- **`/demo`** seeds cash expenses, cash tips and a transfer so the balances show.
- The `hojaGasto` translation namespace, which also holds income and savings strings, is renamed (technical debt).

Out of scope (to *Deuda tecnica* on archiving): several cards or accounts per user; an opening cash balance (see design, *Open question 1*); the method on the "Movimientos" rows, the CSV and "Próximos cobros".

**Why it is built this way** (so it is not undone later):
- An attribute, not a separation: splitting expenses by method would duplicate the screen's structure.
- The free margin is not split into cash and card: unspent budget envelopes belong to no pocket, and dividing them would invent numbers. The balances are real flows and sit under the margin, not in its place.
- Transfers exist because without them an ATM withdrawal leaves cash negative and the card inflated, and a deposit the other way round.
- The bot never asks the method: with 200+ loads a month it would be constant friction, the same reason there is no category question (ARCHITECTURE.md §3). The one question is income vs deposit, because getting that wrong changes the free margin.
- The default is a three-way choice, not a switch, because "Ninguno" has to exist: whoever does not use the feature sees no change.

## Capabilities

### New Capabilities

- `payment-method`: the attribute and its default, who counts as using the feature, transfers as movements, the pocket balance rule, the pockets block, the "Mover plata" sheet, the pocket list, and their injected operations.

### Modified Capabilities

- `dashboard-ui`: *Cycle header and free margin* allows the pockets block inside the card (MODIFIED); new requirements for the payment icon on rows, the default in the "Cuenta" sheet and the demo's seed (ADDED).
- `dashboard-data`: the pocket balances and the account default in the data, transfers in no figure, and what the operations persist (ADDED).
- `expense-editing`: the payment chips in the expense sheet and their preselection (ADDED).
- `income-editing`: the same chips for income (ADDED).
- `recurring-expenses`: a definition's payment method and its reach (ADDED).
- `recurring-charge-generation`: generated charges copy the definition's method (ADDED).
- `cycle-projection`: projected charges carry the method; no pockets and no transfers in a projection (ADDED).
- `design-system`: the new surfaces' materials, states, touch targets and motion (ADDED).
- `bot-message-parsing`: `cargar` gains `medio_pago` and the `transferencia` type, `repreguntar` gains the deposit question (MODIFIED *A message becomes exactly one action from the seven*, *A pending question is context for the next message*).
- `bot-transaction-logging`: the method on a load, transfers from the chat, the deposit question with buttons, confirmations (ADDED).
- `messaging-channels`: a third kind of pending question and the clarification button (MODIFIED *A channel holds at most one pending question*, *The bot logic does not know the channel's mechanics*).

## Impact

- Database: migration `0041_medio_de_pago.sql` (additive): `transacciones.medio_pago`, `movimientos_recurrentes.medio_pago`, `usuarios.medio_pago_default`, `'transferencia'` in `transacciones.tipo` with its checks, and the recurring functions taking `p_medio_pago`. Applied before the deploy.
- Data: `lib/data/payment-method.ts` (types, `TransferMutations`, `pocketBalances`, `usesPaymentMethod`, pure with a unit test); `ExpenseDraft`, `IncomeDraft`, `RecurringDefinition`, `SlotEntry`, `ProjectedCharge`, `Expense`, `IncomeEntry` and `DashboardData` gain the method; `ProfileMutations.setDefaultPaymentMethod`; `lib/data/supabase/transfers.ts`, `lib/demo/demo-transfers.ts`; `resumenMensual`; server actions.
- UI: `entry-sheet.tsx` (chips), `expense-row.tsx` (icon), `free-margin-card.tsx` (pockets block), new `move-money-sheet.tsx` and `pocket-sheet.tsx`, `account-sheet.tsx` (default), `dashboard-template.tsx`; strings in `messages/*.json`, with `hojaGasto` renamed.
- Bot: `lib/bot/parser.ts` (schema, prompt, examples), `lib/bot/logic.ts`, `lib/bot/format.ts`, `lib/data/supabase/bot.ts`, `lib/whatsapp/adapter.ts` and `send.ts` (two reply buttons), `lib/bot/parser-cases.json`.
- Tests: `tests/payment-method.spec.js` on `/demo`, `lib/data/payment-method.test.mjs`, cases in `parser.test.mjs`, `format.test.mjs` and `adapter.test.mjs`, new eval cases.
- Docs: ARCHITECTURE.md §3 (the one question), §8 (columns), §9 (pockets beside the free margin); CLAUDE.md *Estado actual*.
