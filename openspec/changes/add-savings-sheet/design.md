## Context

Savings movements are `transacciones` rows with `tipo = 'ahorro'`, signed (a withdrawal is negative). `SavingsMutations` (`lib/data/savings.ts`) has `addSavingsMovement`, `softDelete` and `restore`, implemented in memory (`lib/demo/demo-savings.ts`, an edit log of `created` and `deletedIds`) and over Supabase (`lib/data/supabase/savings.ts`, through the server actions in `app/dashboard/actions.ts`).

The savings sheet is the generic `EntrySheet` with the `savingsEntry` config (a `choice` field for the type, name, amount, date), mounted in create mode only. Rows are rendered in two places: `SavingsMovementRow` in the savings panel (a `div`, swipe only) and `MovementRow` in the "Movimientos" card (activatable when the card gets a handler; savings get none today).

Figures: `resumenMensual` (`lib/data/supabase/dashboard.ts`) sums the cycle's savings rows into `savings.cycle`, which feeds `getFreeMargin`; in a projection `savings.cycle = max(target, Σ movements)`, and the accumulated balance adds each projected cycle's column. The demo (`deriveDemoData`, `lib/demo/demo-expenses.ts`) mirrors the same rules. The hero strip, the sidebar figures and the summary tile all read `savings.cycle`, so they follow whatever it holds.

## Goals / Non-Goals

**Goals:**
- One rule for "already saved", applied in one place per data source, so every consumer of `savings.cycle` (tile, margin, hero strip, sidebar) follows without changes.
- The edit sheet is the same `EntrySheet` in edit mode, as for expenses and income: no new sheet component.
- The migration is additive and safe to apply before the deploy: the code that is live today never reads or writes the new column.

**Non-Goals:**
- The bot does not set the mark. "ya tenía 5000 ahorrados" by chat stays a regular deposit; the web is where the user brings in their past.
- No "starting balance" setting on the account or in the onboarding: the mark is per movement.
- No mark on withdrawals (see D2).
- Mounting the unused savings progress pieces (`savings-progress.tsx`, `savings-sparkline.tsx`): still technical debt.

## Decisions

### D1. A column, `transacciones.ahorro_previo`
`alter table transacciones add column ahorro_previo boolean not null default false` with `check (not ahorro_previo or (tipo = 'ahorro' and monto > 0))`. Every existing row and every insert that does not name the column (the bot, the cron, the seeds) is a regular movement. RLS needs nothing new: `transacciones_crud_propio` (0011) already covers the user's own update.

In TypeScript the flag is `alreadySaved`: `SavingsMovementDraft.alreadySaved: boolean` and `DashboardData['savings']['movements'][number].alreadySaved?: true` (absent on a regular movement, so the demo's base sample and every other producer stay as they are).

*Alternatives considered:* a new `tipo` (`'ahorro_previo'`): rejected, every query filtering `tipo = 'ahorro'` (dashboard, bot, CSV, savings mutations) would need to learn it, and a deposit that changes its mark would change type. A "starting balance" number on `usuarios`: rejected, it cannot be dated, listed, edited or deleted like the movement the user asked for, and the bot's "¿cómo vengo?" would need a second source.

### D2. Only deposits carry the mark
A withdrawal from savings that should not touch the month is rare, and its wording ("no lo uso este mes") is a second concept. The switch is shown for "Depósito" only; turning the type to "Retiro" hides it and the draft is built with `alreadySaved: false`. The database check enforces it.

### D3. What the mark changes, in one place per data source
- `resumenMensual`: `movementsTotal` sums the cycle's movements without `alreadySaved`; `savingsCycle` (and so the free margin and the projection floor) comes from it. The accumulated balance (`savingsHistory`, `sumSavings`) keeps summing every row. In a projection, each projected cycle adds `max(target, Σ counted) + Σ already saved`, and the shown cycle adds `savingsCycle + Σ already saved` of its own movements. The `ahorros` query selects `ahorro_previo` so the projected cycles between can split the two sums.
- `deriveDemoData`: the same split for the sample cycle (`savingsCycle` counts only regular movements; `savingsAccumulated` adds the already-saved ones) and for the projection (`savingsIn(month)`, `projectedSavings`, `projectedAccumulated`).

A small pure helper, `splitSavings(movements)` in `lib/data/savings.ts` → `{ counted, alreadySaved }` sums, is shared by both sources and unit-tested (`lib/data/savings.test.mjs`).

*Alternative considered:* leave `savings.cycle` as the full sum and subtract the already-saved part in `getFreeMargin`. Rejected: the tile, the hero strip and the sidebar would then show a "this month's savings" that includes years of past savings, which is what Brian's users are asking to avoid.

### D4. `update` on `SavingsMutations`
`update(movementId, draft)` replaces type (sign), name, amount, date and mark. Supabase: one `update` on `transacciones` filtered by `id`, `usuario_id`, `tipo = 'ahorro'` and `borrado_en is null`, with `expectRows`, and a new server action `updateSavingsMovement`. The demo keeps edits in a new `updated: { id, draft }[]` list (latest wins) applied to both the base sample movements and the created ones before sorting; a base movement edited in the demo keeps its id, so swipe, undo and the "Movimientos" card keep working on it.

### D5. `EntrySheet`: a `toggle` field and savings edit mode
`EntrySheet` builds every field from descriptors. A new descriptor kind, `{ kind: 'toggle', name, labelKey, hintKey, shownWhen: { field, value } }`, renders a `FieldRow` with the existing `Switch` and a muted hint line, inside a `Collapsible` that opens while the named field holds the value (here, `kind === 'deposit'`). The state stores `'true'` / `''` like the other fields, so dirty tracking works as is; `buildValues` writes a boolean, `false` while hidden.

`savingsEntry` gains the toggle and the edit keys (`editarMovimientoAhorro`, `guardar`, `eliminarMovimiento`). The template mounts the savings `EntrySheet` with `mode` from the sheet target (`{ kind: 'savings'; mode: 'edit'; movement }` joins `SheetTarget`), `initialValues` from the movement (magnitude, kind from the sign, local date, the mark) and, in edit mode, `onDelete` that soft-deletes, closes and shows the savings undo toast. `asksScope` is already false for savings, so the delete row deletes at once.

*Alternative considered:* a dedicated `SavingsSheet`. Rejected: it would copy the sheet's dismissal, busy, error and keyboard behaviour that `EntrySheet` already owns for three kinds.

The switch sits in a span that prevents the default of `mousedown`, as the type buttons do: at `lg` the sheet is a side panel that grows downwards, and blurring an empty name shows its error line and moved the switch out from under the press, so the first click did nothing (found in 5.1). "Guardar" stays enabled with nothing changed, as in the expense and income edit sheets (the spec dropped the rule that disabled it). `/demo?e2e=fail-savings-update` makes `update` reject, for the failed-save scenario, like the other `e2e` seams of the demo.

### D6. Rows that open
`SavingsMovementRow` takes `onActivate` and, when present, renders a `button` (`pressable`, the amount on the `bg-muted` chip, as `ExpenseRow` does), still inside `SwipeToDelete`. Below its name, the date line reads "9 sept · Ya ahorrado" for a marked deposit. `MovementsCard` gains `onEditSavings(movement)` and its muted line reads "Depósito · Ya ahorrado" for a marked deposit. Both open `openSavingsEditSheet`, which focuses and selects the amount like the other edit openers. The savings panel lives in the summary side panel at `lg`: the edit sheet opens over it as the income sheet does today.

### D7. CSV
`lib/csv.ts` writes the mark into the existing status column ("Ya ahorrado" / "Already saved"), so an export does not read a past deposit as this month's saving. One label added to the export's `statuses`.

## Risks / Trade-offs

- [A user marks a deposit that was in fact saved this month] → the free margin is higher than it should be. The line under the switch states the effect, the row says "Ya ahorrado", and an edit undoes it.
- [The migration runs on the real database with users on it] → additive column with a default and a check that every existing row satisfies (all `false`). It goes before the deploy, as every migration here; the live code ignores the column.
- [The bot's correction of an `ahorro` row could hit the check] → it cannot: the bot only corrects its own last load, which is never marked, and a correction keeps the row unmarked.
- [`MovementRow` rows for savings were read-only and focusable but not tabbable (D8 of `add-transaction-list`)] → with a handler they become buttons like expense rows; the "Mostrar más" focus target still works because it uses the row ref, button or not.

- [Found in 4.1, not this change's: a sheet opened over the desktop summary panel (income or savings) sits under an `aria-hidden` ancestor] → screen readers do not reach "Editar ingreso" or "Editar movimiento" opened from the side panel at `lg`; Playwright's role queries fail there, so the laptop tests use labels and `button[type="submit"]`. Recorded in *Deuda tecnica*.

## Migration Plan

1. Write `supabase/migrations/0033_ahorro_previo.sql` (column, check, comment).
2. Apply it to the real database through the Supabase MCP **after Brian confirms**, verify with a read (`information_schema.columns`, `pg_constraint`) and a count of rows with `ahorro_previo = true` (0).
3. Deploy the code (Brian commits and pushes).
4. Rollback: the column can stay (the old code ignores it); if it must go, `alter table transacciones drop column ahorro_previo` after moving any marked deposit back, which Brian pastes in the SQL editor (the MCP does not drop).
