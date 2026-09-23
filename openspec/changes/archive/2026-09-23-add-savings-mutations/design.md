## Context

See proposal.md → *Why*. Relevant current state:

- `DashboardActions.addSavingsMovement(): void` is wired on `/demo` to `showUnavailable`, which opens `DemoToast`. Nothing else uses `DemoToast` or `demo.accionNoDisponible`.
- `deriveDemoData` (`lib/demo/demo-expenses.ts`) already recomputes expenses, income and the free margin from edit logs; it computes `freeMargin = incomeTotal − total − base.savings.cycle`, so savings is read straight from the base sample.
- The sample builds `savings.cycle = 146`, `accumulated = 2500 + 146`, and the history's last point `2500 + 146`. `savings.movements` are already in ascending date order (3, 8, 9 Sept).
- `EntrySheet` is generic over the draft type through an `EntryConfig` of field descriptors (`amount` | `text` | `date` | `recurrence`). The `optional` flag on text descriptors is declared but never read: no text field is ever validated.
- The savings column total and the free margin are `AnimatedAmount`; the accumulated block in the savings panel is a static `Money`.
- `getSavingsProgress` and `savings.target` have no UI consumer (reverted from the tile; `CLAUDE.md` → *Barra y sparkline de ahorro sin montar*).

## Goals / Non-Goals

**Goals:**
- One savings add operation behind a contract, with the in-memory implementation following the `lib/demo/demo-income.ts` pattern.
- Reuse `EntrySheet` rather than a new sheet component.

**Non-Goals:**
- Showing the target progress in the UI. It is recomputed in the data only.
- Update/delete/restore on the contract (`add-savings-sheet`).

## Decisions

**D1. Contract shape.** `lib/data/savings.ts` gains:

```ts
export type SavingsMovementKind = 'deposit' | 'withdrawal'
export type SavingsMovementDraft = { kind: SavingsMovementKind; name: string; amount: number; date: LocalDate }
export type SavingsMutations = { addSavingsMovement(draft: SavingsMovementDraft): Promise<void> }
```

An object of operations under `DashboardActions.savings`, like `expenses` / `income`, so `add-savings-sheet` adds `update`/`softDelete`/`restore` next to it without touching the actions shape again. The amount stays positive in the draft and the sign is applied by the implementation: the UI never computes a sign, and the Supabase implementation will write `monto` negative with `tipo = 'ahorro'` (ARCHITECTURE §7). *Alternative:* a signed `amount` in the draft — rejected, it moves the §7 rule into every caller.

**D2. Demo edit log and derivation.** `lib/demo/demo-savings.ts` holds `DemoSavingsEdits = { created: { id; draft }[] }` and `createDemoSavingsMutations(setEdits)`. `deriveDemoData` takes it as a seventh argument and resolves savings in a new last step, before the free margin:

- movements = base movements + created (`amount = kind === 'withdrawal' ? −amount : amount`, `date = ${draft.date}T12:00:00Z`), stable-sorted by date ascending (JS sort is stable, so a new movement lands after existing ones on the same day);
- `cycle = Σ amount`; `accumulated = (base.accumulated − base.cycle) + cycle`; history entry for `base.cycle.month` set to `accumulated`;
- `freeMargin = incomeTotal − total − cycle`.

The progress is not stored: `getSavingsProgress({ target, movements })` is already a pure function of the resulting movements, so any future consumer gets the recomputed value. Base movements keep their localized names (already resolved per locale by `buildDemoData`) and typed names stay as typed, so a language switch behaves like income.

**D3. Free-margin formula stays `income − savings − expenses`.** The request text says "ingresos − ahorro − fijos − presupuestos"; ARCHITECTURE (*Margen libre* and *Presupuestado vs real*) and the current code define it as `ingresos − ahorro − gastos` (fixed charges are inside `gastos`; budgets never subtract). The requested numbers (974 → 924 / 1.004) hold under the existing formula, so it is left untouched.

**D4. `EntrySheet` extensions.** Two additions, both inert for the existing expense and income configs:

- A `choice` field kind: `{ name, kind: 'choice', labelKey, options: { value, labelKey }[] }`, rendered as the same pill `radiogroup` the recurrence "ending" control already uses. Its value lives in `fieldState` as a string, counts for `isDirty`, and `buildValues` passes it through. Labels come from `resumen.deposito` / `resumen.retiro`, so the descriptor's label keys need to reach outside `hojaGasto`: `options[].label` is resolved by the template and passed in, not a `HojaGastoKey`.
- Required text fields: a text descriptor without `optional: true` is invalid when empty after trim. It feeds `primaryDisabled`, marks on blur and on a submit attempt, with an `invalidMessage`. Expense and income descriptions are `optional: true`, so they are unaffected.

`savingsEntry: EntryConfig<SavingsMovementDraft>` = `kind` (choice) · `amount` · `name` (required text) · `date`. No recurrence descriptor, and the template passes no `onSaveRecurrence` / `onDelete` for it. A new `EntrySheetContext` `{ kind: 'savings' }` covers the header. *Alternative:* a separate `SavingsSheet` built from `SheetShell` + `AmountField` + `FieldRow` — rejected, it would duplicate the dismissal/busy/error/focus logic that `EntrySheet` already owns.

**D5. Template wiring.** `SheetTarget` gains `{ kind: 'savings'; mode: 'create' }`; `openSavingsCreateSheet` mirrors `openIncomeCreateSheet`; `handleSaveEntry` branches to `actions.savings.addSavingsMovement` and announces `hojaGasto.movimientoAhorroAnadido`. Initial values: `{ kind: 'deposit', date: data.cycle.today }`. The add row's `onClick` becomes `actions.savings ? openSavingsCreateSheet : undefined`, which keeps the disabled-without-handler rule.

**D6. Animation.** The accumulated block switches from `Money` to `AnimatedAmount` (same props), so the three changed figures animate with the existing counter, which already honours `prefers-reduced-motion`. New rows already enter through `SavingsMovementRow`'s ref-callback tween.

**D7. Remove the demo toast.** With its only caller gone, `components/molecules/demo-toast.tsx`, `showUnavailable`, the timeout ref and `demo.accionNoDisponible` (es/en) are removed rather than left dead.

**D8. Strings.** In `hojaGasto` (the namespace `EntrySheet` reads; its misnaming is existing debt): `nuevoMovimientoAhorro`, `tipo`, `nombre`, `nombreObligatorio`, `movimientoAhorroAnadido`. Spanish `resumen.deposito` changes from "Ingreso" to "Depósito" so the selector reads "Depósito / Retiro"; this also changes the deposit row marker's accessible label, which no test asserts today.

## Risks / Trade-offs

- [Generalising `EntrySheet` touches the expense and income sheets] → the new behaviour is opt-in per descriptor; the full Playwright suite (`income-*`, `recurring-*`) runs in verification.
- [The demo counter for created ids is module-level, like the other demo mutations] → acceptable; ids only need to be unique within a page load.
- [`savings.target` progress has no visible check] → covered by D2's derivation from movements; a visible assertion lands with the UI in `add-savings-sheet`.
