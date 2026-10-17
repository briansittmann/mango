## Context

See proposal.md for the motivation. What shapes the approach:

- Every dashboard mutation goes through an injected contract in `lib/data/` with two implementations: `lib/demo/*` (in memory, `/demo`) and `lib/data/supabase/*` (behind the server actions of `app/dashboard/actions.ts`). The bot reuses the Supabase implementations with the admin client and `DataContext.origin`.
- A movement is a `transacciones` row with `tipo in ('ingreso','gasto','ahorro')`. The checks of `0008` are unnamed (Postgres calls them `transacciones_tipo_check` and `transacciones_check`); `0015` added `transacciones_categoria_si_gasto`, `0033` `transacciones_ahorro_previo_check`. `resumenMensual` splits rows by `tipo`, so a row of a new `tipo` already falls out of every figure; the free margin is `getFreeMargin` over those sums.
- Recurring charges are inserted only by SQL: `generar_ciclo`, `crear_movimiento_recurrente`, `editar_cargo_en_ciclo`, `congelar_ciclos`, `eliminar_cargo_en_ciclo` and `completar_cargo_recurrente` (current versions in `0024`), `insertar_cargos_pendientes` (`0029`) and the re-insert inside `eliminar_categoria` (`0024`). `proyectarCiclo` is pure and inserts nothing: it computes `ProjectedCharge`s that the dashboard shows and that the cron passes to `generar_ciclo`.
- The entry sheet is one component (`entry-sheet.tsx`) driven by `EntryConfig` descriptors; it already has a `choice` pill group (savings type) whose selected state is the primary fill.
- The free-margin card (`free-margin-card.tsx`) is a toggle below `lg` (the whole card folds the composition strip) and a stat tile at `lg`.
- The bot's parser is a Zod discriminated union of seven actions; `VoiceActionSchema` extends each. The adapter sends one reply button today (Undo, `undo:<id>`) and discards any other button id.

**Where the brief and the code disagree** (one line each; the design follows the code):
1. `docs/mockups/mango-efectivo-tarjeta.html` is not in the repository; placement follows the brief's written description.
2. `gastos_fijos` was renamed `movimientos_recurrentes` in `0015`; the column goes there.
3. The recurring functions the brief places in `0017` live today in `0024` and `0029`; those are the versions replaced.
4. `proyectarCiclo` inserts no row; the copy of the method to a generated row happens in `generar_ciclo` (and the other inserting functions), and `proyectarCiclo` only carries it for display.
5. The free-margin card has no "quedan N días de ciclo" line; the pockets go under the number (and the strip when open).
6. The account menu has no "Aplicación" section (it holds Tema, Fondo, Idioma). The selector goes in the "Cuenta" sheet instead (Brian, 2026-10-17), next to the currency: the default is account data that reaches the bot and every device, while the menu holds per-browser visual preferences.
7. Cash tips in September would move the demo's 2.820 € / 864 € that about fifteen specs assert; the tips are dated August, which the demo never shows, and only feed the cash balance.
8. "Lima" is the primary token, as on the existing choice pills.
9. "Everything new hidden" cannot include the chips and the default selector: they are the only ways in, so every user sees them; everything else stays hidden.

## Goals / Non-Goals

**Goals:**
- One nullable column and one new `tipo`, so no existing query, figure or test changes behaviour for a user who never marks anything.
- Balances computed by one pure function, shared by the demo and Supabase.
- The bot keeps its seven actions.

**Non-Goals:**
- An opening balance, several bank accounts, or reconciling with a bank.
- The method on "Movimientos" rows, the CSV, "Próximos cobros" rows or the bot's month query.
- Linking the wallet cards (`card-wallet`) to the `tarjeta` pocket.

## Decisions

### D1. Data: a nullable `medio_pago`, and a transfer is one row with `tipo = 'transferencia'`
Migration `0041_medio_de_pago.sql`, additive:

```sql
alter table transacciones add column medio_pago text
  check (medio_pago in ('efectivo','tarjeta'));
alter table movimientos_recurrentes add column medio_pago text
  check (medio_pago in ('efectivo','tarjeta'));
alter table usuarios add column medio_pago_default text
  check (medio_pago_default in ('efectivo','tarjeta'));

-- tipo and amount: the unnamed checks of 0008, by the names Postgres gave them (read first, task 1.1)
alter table transacciones drop constraint transacciones_tipo_check,
  add constraint transacciones_tipo_check check (tipo in ('ingreso','gasto','ahorro','transferencia'));
alter table transacciones drop constraint transacciones_check,
  add constraint transacciones_monto_check check (
    (tipo in ('ingreso','gasto','transferencia') and monto > 0) or (tipo = 'ahorro' and monto <> 0));
alter table transacciones add constraint transacciones_medio_pago_coherente check (
  case tipo
    when 'ahorro' then medio_pago is null
    when 'transferencia' then medio_pago is not null and categoria_id is null
      and movimiento_recurrente_id is null and ciclo_mes is null
    else true end);
alter table movimientos_recurrentes add constraint movimientos_recurrentes_medio_pago_coherente
  check (medio_pago is null or tipo in ('gasto','ingreso'));
create index transacciones_medio_pago_idx on transacciones (usuario_id, fecha)
  where medio_pago is not null and borrado_en is null;
```

A transfer's `medio_pago` is the pocket the money **enters**; the source is the other one. With two pockets the direction is one bit, so one column says it.

*Alternatives:* two linked rows, an expense out of one pocket and an income into the other (rejected: every figure would have to learn to skip them, and a half-deleted pair breaks the balance); a `transferencias` table (rejected: undo, soft delete, idempotency by `mensaje_id_externo`, last load and RLS already exist for `transacciones` rows, and would all be rebuilt); `origen` + `destino` columns (rejected: redundant with two pockets; it becomes right only with several accounts, which is out of scope and would need an accounts table anyway).

### D2. The inserting functions copy the definition's method
`crear_movimiento_recurrente` gains `p_medio_pago text default null` (stored on the definition and on the row it links); `editar_cargo_en_ciclo` gains `p_medio_pago` (written on the slot, and with `'onward'` on the definition); `generar_ciclo`, `congelar_ciclos`, `eliminar_cargo_en_ciclo`, `insertar_cargos_pendientes` and the re-insert of `eliminar_categoria` select `m.medio_pago` / `v_def.medio_pago` into the row; `completar_cargo_recurrente` gains `p_medio_pago default null` and writes `coalesce(p_medio_pago, v_def.medio_pago)` on the charge only. Changing a signature means `drop function … (old args)` then `create function`, as `0024` did for `crear_categoria`, so no ambiguous overload is left. Grants and `revoke` lines are repeated. `actualizar_movimiento_recurrente` has no caller in the dashboard (`unify-fixed-charge-sheet`) and is left alone.

### D3. Contracts
`lib/data/payment-method.ts`:

```ts
export type PaymentMethod = 'efectivo' | 'tarjeta'
export type TransferDraft = { amount: number; into: PaymentMethod; date: LocalDate }
export type TransferMutations = {
  create(draft: TransferDraft): Promise<void>
  update(transferId: string, draft: TransferDraft): Promise<void>
  softDelete(transferId: string): Promise<void>
  restore(transferId: string): Promise<void>
}
export type Pocket = { balance: number; cameIn: number; wentOut: number }
export type Transfer = { id: string; amount: number; into: PaymentMethod; date: string }
export function pocketBalances(input: { rows: CountedRow[]; transfers: Transfer[]; cycle: { start: LocalDate; end: LocalDate; today: LocalDate }; timeZone: string }): Record<PaymentMethod, Pocket>
```

`ExpenseDraft` (and so `IncomeDraft`), `SlotEntry` and `RecurringDraft` gain `paymentMethod: PaymentMethod | null`; `Expense`, `IncomeEntry`, `RecurringDefinition` and `ProjectedCharge` gain `paymentMethod: PaymentMethod | null`. `DashboardData.user` gains `defaultPaymentMethod: PaymentMethod | null` and `hasMarkedMovements: boolean`; `DashboardData` gains `pockets: { efectivo: Pocket; tarjeta: Pocket; transfers: Transfer[] } | null` (null when not shown). `DashboardActions` gains `transfers?: TransferMutations`. The default is a profile operation, `ProfileMutations.setDefaultPaymentMethod(m: PaymentMethod | null)`, behind a server action, used only by the "Cuenta" sheet (D13).

### D4. Balances: one pure function over the rows that have happened
`pocketBalances` sums every row with a method: income adds, expense subtracts, a transfer adds `amount` to `into` and subtracts it from the other. A row counts when it is real and has happened: a one-off row or a transfer whose local day is not after `today`, a recurring charge when `fixed.charged` (the dashboard's own rule, `isCharged`, so `no_cobrado` and a confirmed early charge behave as on screen). `cameIn` / `wentOut` are the same sums restricted to the cycle's range. Pure, with `lib/data/payment-method.test.mjs`.

Supabase: `resumenMensual` adds two reads, skipped for a projection: an existence count (`medio_pago is not null`, not deleted, any date) for `hasMarkedMovements`, and, when it is true, `tipo, monto, medio_pago, fecha, movimiento_recurrente_id, estado, no_cobrado` of every marked row before the shown cycle's end (the partial index of D1). It maps them to `CountedRow` with `isCharged`, then calls `pocketBalances`. Brian loads about 200 rows a month, so years of marked rows stay a small read; if it grows, the earlier cycles fold into a per-cycle sum (Risks). The demo builds the same input from `deriveDemoData`'s rows plus the August opening (D11).

### D5. Balances accumulate across cycles (confirmed by Brian, 2026-10-17)
A pocket is a wallet, not a monthly envelope: the cash in the drawer on 1 October is what was left on 30 September. So the balance runs from the first marked row to the end of the shown cycle, like the accumulated savings, and only "Entró / Salió" are per cycle.

There is no opening balance (out of scope): someone who starts marking with 300 € already in cash sees cash go negative with the first cash expense. The fix that needs no new field is to record that cash once with "Mover plata" (card to cash), which keeps the free margin intact. This design does not add a hint for it. If Brian prefers, the cheapest addition is an "Ajustar saldo" row in the pocket list that writes a transfer, and that goes in a follow-up.

*Alternative:* per-cycle balances, which start at 0 every cycle (rejected: on day 1 every pocket would read 0 € and cash would be negative after the first coffee, which reads wrong to everyone, and the no-opening-balance problem would come back every month instead of once).

### D6. Chips in the entry sheet
A new descriptor `{ kind: 'paymentMethod' }` placed after the amount in `expenseEntry` and `incomeEntry` (not in `savingsEntry`). It renders two `button`s with `aria-pressed` in a `role="group"` named "Medio de pago", styled like the existing `choice` pills (primary fill and `font-semibold` when pressed, plus a small check icon so the state does not rely on colour). It is not a radiogroup, because none is a valid value and a radiogroup cannot be emptied. State `paymentMethod` starts from `defaultPaymentMethod` in create mode and from the row's value in edit mode. On a fixed row the method takes part in `slotChanged`, so the existing `ScopeChoice` asks the reach. The sheet's `onSave` passes it in the draft.

### D7. Pockets inside the free-margin card
`FreeMarginCard` gains `pockets?: { efectivo: number; tarjeta: number }`, `onOpenPocket(m)` and `onMoveMoney()`. The block renders after the `Collapsible` with a `border-t` divider. Each block is a `button` (`stopPropagation` so the card's toggle does not fire), with the `Banknote` / `CreditCard` icons of `lucide-react` (already a dependency), the label in `text-body-sm` and the balance in `text-headline-md` tabular, on `bg-muted`. The swap button is a 44px circle with `ArrowLeftRight`, `border-2 border-primary`, absolutely centred on the gap. In the `tile` presentation the block sits under the income line. The template passes `pockets` only when `data.pockets` is not null.

### D8. Two sheets on `SheetShell`
- `components/organisms/move-money-sheet.tsx`: `AmountField` (centred, large), two boxes "Sale de / Entra a" with the swap button (it toggles `into`), `DateCalendar` limited to the cycle, a preview computed from `data.pockets` plus or minus the amount (minus the original amount in edit mode), "El margen libre no cambia", and the submit "Mover {monto}". In edit mode: "Editar movimiento", "Guardar" and "Eliminar movimiento".
- `components/organisms/pocket-sheet.tsx`: a header with back (closes the sheet), the name, the balance and "Entró · Salió"; the rows newest first, built from `data.expenses.groups`, `data.income.entries` and `data.pockets.transfers` with `pocketRows` (a pure helper in `payment-method.ts`, tested). Expense and income rows reuse `MovementRow` with a "−" / "+" sign. Transfer rows are a variant: `ArrowLeftRight` in a muted mark, the name "Tarjeta a efectivo" / "Efectivo a tarjeta", the amount unsigned in `text-muted-foreground`. Every row is wrapped in `SwipeToDelete`, the undo goes through the template's existing toast, and activating an expense or income row closes the list and opens `openEditSheet` / `openIncomeEditSheet`.

**Editing and deleting a transfer (confirmed by Brian, 2026-10-17):** the same gestures as everything else. A tap opens "Mover plata" in edit mode and a swipe deletes with "Deshacer". No new pattern to learn, and a wrong "saqué 200" from the bot is fixed where the transfer lives.

### D9. Row icon
`ExpenseRow` gains `paymentMethod?: PaymentMethod | null` and an `ariaLabel` suffix. The icon (14px, `text-muted-foreground`, `aria-hidden`) goes in an inline-flex with `ShortDate`, so a row without one renders exactly the old markup.

### D10. Bot
- **Schema** (`parser.ts`): `tipo` adds `'transferencia'`; `CargarSchema` adds `medio_pago: z.enum(['efectivo','tarjeta']).nullable().default(null)` and its `superRefine` adds two rules: a transfer needs a positive amount, a non-null `medio_pago` and null `categoria`/`recurrente`; savings needs a null `medio_pago`. `RepreguntarSchema.falta` becomes `z.enum(['categoria','deposito'])` with an optional `descripcion`. `VoiceActionSchema` follows by `extend`. The prompt gains the rules of `bot-message-parsing` and examples: "pagué 15 en efectivo de cervezas", "saqué 200", "deposité las propinas, 120" and "ingresé 200 en el banco", with English counterparts.
- **Logic** (`logic.ts`): `loadBotContext` also returns `defaultPaymentMethod` and `usesFeature` (one existence query plus the default). In `load`: `method = action.medio_pago ?? context.defaultPaymentMethod` for an expense or income, and `said = action.medio_pago != null` goes into `LoadSummary` for the confirmation. A transfer goes through `createSupabaseTransferMutations(data).create`, then `writtenRowId`. A `repreguntar` with `deposito` becomes `ask` with `pending: { pregunta: 'deposito', monto, diasAtras, descripcion }` and `buttons`, or, when `!usesFeature`, a plain income load.
- **Answers**: `IncomingMessage` gains `answer?: 'transfer' | 'income'`. The logic then skips the parser and writes from `pending`, with `alwaysText: true`.
- **Adapter** (`adapter.ts`, `send.ts`): `sendUndoButton` becomes `sendButtons(phone, text, buttons)` (at most 3, Meta's limit) and the Undo path calls it with one button. The ids are `deposito:transferencia` and `deposito:ingreso`. A pressed id that matches and has a `deposito` question pending maps to `answer`; otherwise it is discarded, like an unknown button today. `BotReply` `ask` gains `buttons?: { id: string; label: string }[]`.
- **Format** (`format.ts`): `LoadSummary` gains `method?: PaymentMethod` (set only when said) and the variant `{ tipo: 'transferencia'; into: PaymentMethod }`. `loadIcon` returns 🔁 for it. `confirmacionGasto` / `confirmacionIngreso` gain a `{medio, select, efectivo {, en efectivo} tarjeta {, con tarjeta} other {}}` before the final period. New keys `confirmacionTransferencia`, `preguntaDeposito`, `botonDesdeEfectivo`, `botonIngresoNuevo`, in voseo.
- **Corrections**: `correct` on a transfer accepts `monto` and answers `soloGastosCategoria` for `categoria`. The `borrado` / `deshecho` / `corregido` keys gain a `transferencia` branch.
- **Eval**: `parser-cases.json` gains the six cases of the spec; `npm run test:parser` must stay all green.

### D11. Demo
`lib/demo/demo-data.ts` gives the sample rows and definitions the methods of `dashboard-ui` → *The demo's payment methods*. `lib/demo/demo-transfers.ts` holds `DemoTransferEdits` over a seed of one transfer (`demo-transfer-1`, 100 into cash, 4 September). A constant `DEMO_POCKET_OPENING` (cash tips 150 €, 28 August) enters only `pocketBalances`. Edits carry `paymentMethod` through `DemoExpenseEdits` and `DemoIncomeEdits`. `/demo?e2e=fail-transfer` makes `create` and `update` reject; `/demo?e2e=no-payment-methods` loads the sample with every method, the transfer and the opening cleared, for the "no pockets until the first mark" scenarios. The demo's default is null, and `/demo?e2e=default-efectivo` / `?e2e=default-tarjeta` start it at a method so the chips' preselection can be tested on the demo, whose "Cuenta" sheet is disabled.

### D12. Strings
A new namespace `medioPago` holds the chips, the pockets, both sheets, the list, the "Cuenta" control and the toasts. `hojaGasto` is renamed `hojaMovimiento` in both catalogues and in its six users (`entry-sheet.tsx`, `swipe-to-delete.tsx`, `date-calendar.tsx`, `dashboard-template.tsx`, `onboarding/savings-step.tsx`, `onboarding/fixed-step.tsx`). The rename is mechanical: no test reads keys, and the type check catches a missed one.

### D13. The default in the "Cuenta" sheet
`account-sheet.tsx` gains `paymentMethod` in its draft, initialised from `user.defaultPaymentMethod`, with a `SegmentedControl` (the molecule "Movimientos" uses) of three options after the cycle-day line. It takes part in `isDirty`. `submit` calls `onSave(basics)` only when a basic changed, then `onSaveDefault(method)` only when the default changed. That is two writes, not one: `updateBasics` keeps its six fields because the onboarding's basics step shares `ProfileBasics` and `validateBasics`. If the second write fails after the first succeeded, the sheet shows its error and stays open, and a retry rewrites the same basics harmlessly. The template wires `onSaveDefault` to `actions.profile.setDefaultPaymentMethod` and refreshes, so the next entry sheet reads the new `user.defaultPaymentMethod`.

*Alternative:* adding the default to `ProfileBasics` so one `updateBasics` writes all seven (rejected: it drags the onboarding's validation and its step into a setting the onboarding does not ask).

## Risks / Trade-offs

- [No opening balance] Cash reads negative until the user records what they had. → D5. The balance is honest about what Mango knows, and one "Mover plata" fixes it. It goes to *Deuda tecnica*.
- [Reading every marked row] The balance query grows with history. → A partial index. If it becomes slow, add a per-cycle sum of earlier cycles (the same shape as the savings history).
- ["Saqué 200" vs "saqué 200 del ahorro"] The parser could take a savings withdrawal for a transfer, or the other way round. Both leave the free margin wrong by 200, or right when it should not be. → Explicit rules and examples, eval cases, the confirmation names "Tarjeta a efectivo", and Undo.
- [The word "tarjeta" means two things] The wallet's named cards (fixed charges only) and the card pocket are independent. → Documented in `recurring-expenses`. Unifying them belongs with "several cards or accounts", which is out of scope.
- [`usuarios_update_propio` has no column list] `medio_pago_default` adds to that surface, like `orden_widgets`. → Harmless, since it is the user's own preference. It joins the existing debt item.
- [Two writes in one "Guardar"] The basics and the default are saved separately (D13). → The second runs only when the default changed. A failure between them leaves the basics saved and the sheet open on the error, and retrying is idempotent.
- [Signature changes] The MCP's `apply_migration` refused `drop … if exists` in `0038`. → If it refuses again, Brian runs `0041` in the SQL editor, as with `0038`/`0039`, and it is verified by reading.
- [Dashboard tile height at `lg`] The pockets make the first tile taller than the three summary tiles. → The tiles stretch to the row (`h-full`). Checked in screenshots, task 3.3.

## Migration Plan

1. Read the real names of the `0008` checks with `execute_sql` (`pg_constraint`), write `0041`, and apply it before the deploy, through the MCP with Brian's confirmation or by Brian in the SQL editor. Additive: rows keep `null`, and the running code never writes `transferencia`.
2. Deploy. Nobody has marked anything, so no pocket shows anywhere.
3. Rollback: revert the deploy. The columns can stay. Dropping them means `drop index`, dropping the new constraints, restoring the old checks (only once no `transferencia` row exists), and restoring the previous function versions from `0024`/`0029`.

## Open Questions

- Should a fixed charge's wallet card imply `tarjeta` when it has no method? Deferred: nothing in the specs depends on it.
- Should the pockets reach the bot's "¿cómo vengo?" or the onboarding? Deferred until someone asks.
