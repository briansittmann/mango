## 0. Before starting

- [x] 0.1 Brian confirms the two proposals of design.md: balances accumulate across cycles with no opening balance (D5), and a transfer is edited by tapping it and deleted by swiping with undo (D8). If either changes, update the specs and design with `/opsx:update` before 1.1; verify both answers are recorded in design.md

## 1. Database

- [x] 1.1 Read the real names of the `transacciones` checks from `0008` with `execute_sql` on `pg_constraint`, and write `supabase/migrations/0041_medio_de_pago.sql` (design D1, D2): the three columns, the new `tipo` and amount checks, `transacciones_medio_pago_coherente`, `movimientos_recurrentes_medio_pago_coherente`, the partial index, and the inserting functions with `p_medio_pago` / `m.medio_pago` (drop the old signatures, then repeat the grants and revokes); verify by reading it against `0024`, `0029` and `0033` for column and function names
- [x] 1.2 Apply `0041` to the real database before any deploy, through the MCP with Brian's confirmation, or by Brian in the SQL editor if the MCP refuses the drops; verify with `list_migrations` or by reading the columns, the constraints and each function's arguments. Then, inside a rolled-back transaction, check that a savings row with a method, a transfer with a category and a transfer with no method are rejected, and that `generar_ciclo` copies a definition's method

## 2. Data layer

- [x] 2.1 `lib/data/payment-method.ts`: `PaymentMethod`, `TransferDraft`, `TransferMutations`, `Pocket`, `Transfer`, `pocketBalances`, `pocketRows`, plus the method on `ExpenseDraft`, `SlotEntry`, `RecurringDraft`, `Expense`, `IncomeEntry`, `RecurringDefinition`, `ProjectedCharge` (`proyectarCiclo` copies it), `DashboardData` and `DashboardActions` (D3, D4); verify that `lib/data/payment-method.test.mjs` passes with `npm run test:unit`. It must cover: income in, expense out, both transfer directions, a pending charge not counted and counted once taken, `no_cobrado`, a one-off row dated after today, earlier cycles in the balance but not in came in / went out, rows with no method, deleted rows, and a negative balance. Also update `projection.test.mjs` for the method on charges
- [x] 2.2 Supabase: the method in `expenses.ts`, `income.ts` and `recurring.ts` (`create`, `editInCycle`), new `transfers.ts`, `ProfileMutations.setDefaultPaymentMethod`, `USUARIO_COLUMNS`, and in `resumenMensual` the method on rows, definitions and projected charges, `hasMarkedMovements`, the balance read and `pockets` (skipped in a projection); add the server actions in `app/dashboard/actions.ts` and wire them in `app/dashboard/supabase-dashboard.tsx`. Verify with `npx tsc --noEmit`, then with a script against the real database as Brian: create a cash expense, a transfer and a cash fixed charge; check `pockets` and that income, expenses and free margin did not move; delete everything, leaving nothing behind
- [x] 2.3 Demo: methods on the sample rows and definitions, `lib/demo/demo-transfers.ts`, `DEMO_POCKET_OPENING`, the method carried through the demo edits, plus `?e2e=fail-transfer`, `?e2e=no-payment-methods` and `?e2e=default-efectivo|default-tarjeta` (D11); verify on `/demo` that the free margin still reads 864 €, cash 142,60 € and card 1.492,40 €, and that a reload resets them

## 3. UI

- [x] 3.1 Chips in `entry-sheet.tsx` (descriptor `paymentMethod`, group with `aria-pressed`, check icon, default preselection in create, the row's value in edit, part of `slotChanged` on fixed rows; D6); verify every scenario of `expense-editing` → *Payment method on an expense* and `income-editing` → *Payment method on an income entry* by hand on `/demo`
- [x] 3.2 Row icon in `expense-row.tsx` and its use in the category cards and the income panel (D9); verify at 390px that a row with no method has the same date position as before (screenshot diff) and that the accessible name says the method
- [x] 3.3 Pockets block in `free-margin-card.tsx` and its wiring in `dashboard-template.tsx` (D7); verify at 390px and 1280px, in both themes, with and without marked movements, in a projection, and with the strip open and folded, using screenshots
- [x] 3.4 `move-money-sheet.tsx` (create and edit, swap, preview, date limits, failure) and `pocket-sheet.tsx` (header, rows, swipe with undo, opening a row's sheet, empty line) (D8); verify every scenario of `payment-method` → *The "Mover plata" sheet* and *The pocket list* on `/demo`
- [x] 3.5 "Medio de pago por defecto" in `account-sheet.tsx`: draft, dirty state, saved with "Guardar" through `setDefaultPaymentMethod` only when it changed, after the basics only when they changed (D13); verify the three scenarios of `dashboard-ui` → *Default payment method in the account sheet* against the real database in 5.4, and with a scripted check that the sheet's save order and error state hold
- [x] 3.6 Strings: new `medioPago` namespace, `hojaGasto` renamed `hojaMovimiento` in both catalogues and its six users (D12); verify `npx tsc --noEmit` and both languages with no missing-key warnings
- [x] 3.7 Motion and look against `motion-skills/AUDIT.md`: both sheets' entry and exit, chip press, balance animation, reduced motion; verify with screenshots of the card, both sheets and the "Cuenta" sheet at 390px and 1280px in light and dark

## 4. Bot

- [x] 4.1 `parser.ts`: schema (`transferencia`, `medio_pago`, `falta: 'deposito'`, refinements), prompt rules and examples in both languages (D10); verify that `lib/bot/parser.test.mjs` passes with new cases for each refinement, the voice schema carrying `medio_pago`, and the deposit pending block
- [x] 4.2 `logic.ts`, `format.ts`, `lib/data/supabase/bot.ts`: default fill and the `said` flag, transfer loads, the deposit question for users of the feature and a plain income otherwise, answers from the pending question, corrections and undo of a transfer, and the confirmation texts in voseo (D10); verify that `lib/bot/format.test.mjs` passes with the method named only when said and the transfer confirmation
- [x] 4.3 `adapter.ts` and `send.ts`: `sendButtons`, the `deposito:*` ids, an answer mapped only with a deposit question pending, the Undo path unchanged (D10); verify that `lib/whatsapp/adapter.test.mjs` passes with a pressed answer, an expired one discarded, and Undo still working
- [x] 4.4 Eval: add the six cases of `bot-message-parsing` to `parser-cases.json`; verify `npm run test:parser` all green twice in a row
- [ ] 4.5 Round on WhatsApp in production after the deploy, with Brian: "pagué 15 en efectivo de cervezas", "nafta 45" with and without a default, "saqué 200", "deposité las propinas, 120", "ingresé 200 en el banco" with both buttons, Undo on a transfer; verify each row in the database, then copy the exchanges verbatim into `docs/bot-conversacion-ejemplo.md` and soft-delete the test rows

## 5. Tests

- [x] 5.1 New `tests/payment-method.spec.js` on `/demo` at 390px and 1280px: chips and preselection (with `?e2e=default-tarjeta`), marking, switching and unmarking, icon on rows, pockets shown and hidden (a fresh demo state with no marks via `?e2e=no-payment-methods`), seeded balances, "Mover plata" (withdrawal, swap, preview, failure), editing and deleting a transfer with undo, the cash list's rows and order, the projection with no pockets, the free margin unchanged throughout, reduced motion, targets, and axe on the card and both sheets in both themes; run in Chromium, then Firefox and WebKit
- [x] 5.2 Re-run the specs that read the free-margin card, the entry sheet, the account sheet and the income panel (`desktop-tiles`, `desktop-motion-a11y`, `widgets-motion-a11y` for the six font sizes, `fixed-sheet`, `recurring-scope`, `income-*`, `savings-edit`, `movements`); fix what this change broke and report what was already failing
- [x] 5.3 Full `npm test` in Chromium and then the three browsers, plus `npm run test:unit`, `npm run lint` and `npx tsc --noEmit`; report failures with their output and whether this change caused them
- [ ] 5.4 Round on `/dashboard` against the real database at 390px and 1280px: mark two of Brian's rows, check that the pockets appear and the free margin does not move, move money both ways, edit and delete the transfer, set the default in "Cuenta" (check that the next entry sheet and the bot use it) and clear it; leave nothing behind

## 7. Country restriction (D14)

- [x] 7.1 `supabase/migrations/0042_medio_pago_habilitado.sql` (`usuarios.medio_pago_habilitado boolean`, nullable), applied to the real database before the deploy with Brian's confirmation; verify by reading the column
- [x] 7.2 `paymentMethodsOffered` and `PAYMENT_METHOD_COUNTRIES` in `payment-method.ts` with tests; `USUARIO_COLUMNS`, `DashboardData.user.paymentMethodsOffered`, `resumenMensual` skipping the pockets reads when not offered; verify `npm run test:unit` and `npx tsc --noEmit`
- [x] 7.3 UI: chips, row icons, pockets, swap button and the "Cuenta" selector only when offered; the entry sheet passes the stored method back when it shows no chips; verify on `/demo` (none of them) and `/demo?e2e=payment-methods` (all of them)
- [x] 7.4 Demo not offered by default; `?e2e=payment-methods` and the other payment flags offer it; `tests/payment-method.spec.js` on `?e2e=payment-methods`, plus a test that plain `/demo` shows no chip, icon or pocket; rerun the specs touched in 5.2
- [x] 7.5 Bot: `ParseInput.paymentMethods`; without it the prompt has no method, transfer or deposit rule or example, `medio_pago` is ignored and a transfer is answered as not understood; the deposit question only for an account offered and using the feature; verify `parser.test.mjs` and `npm run test:parser` twice
- [x] 7.6 Docs: ARCHITECTURE.md §8 and §9, CLAUDE.md *Estado actual*, the debt item on `usuarios_update_propio`

## 6. Docs

- [x] 6.1 Update ARCHITECTURE.md: §3 (the bot never asks the method; the one deposit question), §8 (`medio_pago`, `medio_pago_default`, `transferencia`) and §9 (pockets under the free margin, why the margin is not split). Update CLAUDE.md *Estado actual* (Web/dashboard, Bot, Base de datos with `0041`, Tests, OpenSpec). On archiving, move the out-of-scope items (several cards or accounts, the opening balance, the method on "Movimientos", CSV and "Próximos cobros") and the accepted risks into *Deuda tecnica*, and remove the `hojaGasto` item from it
