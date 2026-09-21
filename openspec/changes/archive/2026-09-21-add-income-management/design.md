## Context

See proposal.md — *Why*. What shapes the approach is what already exists:

- `components/organisms/entry-sheet.tsx` is already generic over a value type `V` and driven by an `EntryConfig<V>` (fields, initial focus, title/submit/delete message keys). `expenseEntry` is the only configuration today, and the sheet's `context` prop is hard-typed to `{ kind: 'category'; name; color; recurring }`, rendering a `CategoryDot` in the caption.
- `components/templates/dashboard-template.tsx` mounts exactly one `EntrySheet` and one `UndoToast`, and holds a single `sheet` state of `{ open, target: SheetTarget | null }` where `SheetTarget` always carries an `ExpenseGroup`.
- The income panel (around `dashboard-template.tsx:831`) renders `SummaryRow` per `data.income.sources`, with a muted `estimado` detail, plus an `AddRow` wired to `actions.addIncome`, which the demo points at the "not available" message. `SummaryRow` is a read-only row; expense rows use `ExpenseRow` inside `SwipeToDelete`.
- `lib/demo/demo-expenses.ts` holds `deriveDemoData`, a single ordered pipeline (definitions → expense edits → attach created definitions → category updates → deletions → order → totals → page figures) that recomputes the page from base sample data plus edit records. The free margin is computed there: `base.income.total - total - base.savings.cycle`.
- `selectUpcomingCharges(groups, definitions)` walks `ExpenseGroup.expenses` only, so anything not inside an expense group cannot become a charge.
- Supabase: `gastos_fijos` (0005, extended by 0013) has `categoria_id uuid not null`, `transacciones.categoria_id uuid not null`, and `transacciones.gasto_fijo_id` referencing it. `0014` is already taken by `0014_categorias_colores_extra.sql`. Only `users.ts` and `transactions.ts` touch Supabase; no TypeScript reads `gasto_fijo_id` or `gastos_fijos`.

## Goals / Non-Goals

**Goals**

- Add income CRUD by supplying a second configuration and a second operation set, not a second sheet, row, toast or panel component.
- Keep the type system carrying the rule the database carries: a recurring definition has a category if and only if it is an expense.
- Keep the demo's income total at 2 820 € and the free margin at 974 €, so existing specs and Playwright specs that assert those figures stay true.

**Non-Goals**

- No `ingresos_esperados` reads. The estimated-vs-actual "floor of the month" idea is dropped from the panel, not reimplemented elsewhere.
- No savings CRUD, no cron, no Supabase-backed implementations of the new contracts.
- No entry point for editing an income recurrence definition (see *Risks*).

## Decisions

### D1 — Income is a flat list of dated entries, replacing `income.sources`

`DashboardData.income` becomes `{ total: number; entries: IncomeEntry[] }`, with `IncomeEntry = { id; name; amount; date; recurring?: { definitionId; day } }` — the `Expense` shape minus the category it lives in, plus the recurrence link.

*Why:* the sheet edits an amount, a description and a date; a "source" with an `estimated` figure has no editable identity and no date, so it cannot be the thing a row opens. The two models cannot coexist in one panel without showing two lists.

*Alternative rejected:* keep `sources` and give each a nested list of entries. That is the `ingresos_esperados` feature (a floor per source) wearing an editing UI, and it doubles the panel's rows for a table nothing writes yet.

*Consequence:* the demo sample becomes two entries — `Salario` 2 400 € on day 1, carrying a recurring definition, and `Freelance` 420 € on 5 September — keeping the total at 2 820 €. The `resumen.estimado` message becomes unused and is removed.

### D2 — `IncomeMutations` mirrors `ExpenseMutations`, minus the category

New `lib/data/income.ts`:

```ts
export type IncomeDraft = ExpenseDraft // amount, description, date — the same three fields
export type IncomeMutations = {
  create(draft: IncomeDraft): Promise<void>
  update(entryId: string, draft: IncomeDraft): Promise<void>
  softDelete(entryId: string): Promise<void>
  restore(entryId: string): Promise<void>
}
```

`DashboardActions.addIncome?: () => void` is **removed** and replaced by `income?: IncomeMutations`, following `expenses`, `categories` and `recurring`. The disabled-control rule then falls out of the existing pattern: no `actions.income`, no editing (spec: *Controls without a handler are disabled*).

*Why an alias rather than a separate draft type:* the fields are identical and validated identically; a second structurally equal type would drift.

### D3 — The recurring contract learns the movement type through its target, not a loose flag

```ts
export type RecurringTarget = { tipo: 'gasto'; categoryId: string } | { tipo: 'ingreso' }
create(target: RecurringTarget, draft: RecurringDraft): Promise<void>
```

and `RecurringDefinition` gains `tipo: 'gasto' | 'ingreso'` with `categoryId: string | null`.

*Why:* this is exactly migration `0015`'s check constraint (`categoria_id not null` iff `tipo = 'gasto'`) expressed in the type, so an income definition with a category cannot be constructed.

*Alternative rejected:* `create(categoryId: string | null, draft)` plus `draft.tipo`. Two independent fields that must agree, with the disagreement only caught by Postgres at runtime.

*Migration note:* the existing call site passes `{ tipo: 'gasto', categoryId }`. `RecurringDraft` itself is unchanged.

### D4 — One `EntrySheet` instance, two configurations; `context` becomes a union

`EntrySheetContext` becomes `{ kind: 'category'; name; color; recurring } | { kind: 'income'; recurring: boolean }`. The caption renders the dot only for `kind: 'category'`; for income it renders the income label, and `recurring: true` swaps in the "only this cycle's entry" wording.

`SheetTarget` in the template becomes a union too:

```ts
type SheetTarget =
  | { kind: 'expense'; mode: 'create' | 'edit'; group: ExpenseGroup; expense?: Expense }
  | { kind: 'income'; mode: 'create' | 'edit'; entry?: IncomeEntry }
```

`config`, `context`, `initialValues`, `onSave`, `onDelete` and `onSaveRecurrence` are derived from `sheet.target.kind`. The existing `flushSync` + `initialFocusRef.current?.focus()` open pattern is reused verbatim, so keyboard focus and the iOS keypad behave identically.

*Why one instance:* two mounted sheets would mean two scrims, two focus traps and two dirty states to keep from fighting each other; `expense-editing` already specifies the sheet as configuration-driven.

### D5 — Income message keys join the existing `hojaGasto` namespace

`EntryConfig`'s key type is `keyof typeof esMessages.hojaGasto`, so income titles live there: `nuevoIngreso`, `editarIngreso`, `eliminarIngreso`, `ingresoAnadido`, `ingresoEliminado`, `errorEliminarIngreso`, `ingreso` (the fallback row name), `soloEsteIngreso`. `gastoRecurrente` gains `explicacionIngreso` (the day/amount sentence with no category).

*Why not a new `hojaIngreso` namespace:* the configuration's key type would have to become a union of two namespaces, and every shared key ("cancelar", "importe", "fecha", "guardar", "importeInvalido", "cambiosGuardados", "errorGuardar", "deshacer") would be duplicated in both catalogues. The namespace name is now slightly wrong for what it holds; renaming it to something neutral is a mechanical follow-up that touches every key in two catalogues and is not worth bundling here.

### D6 — Income resolves in `deriveDemoData`, after the expense pipeline, in its own step

`lib/demo/demo-income.ts` holds `DemoIncomeEdits` (`created`, `updated`, `deletedIds`) and `createDemoIncomeMutations`, copying `demo-expenses.ts`'s shape. `deriveDemoData` takes the income edits and, as a final step, resolves entries, recomputes `income.total`, and only then computes `freeMargin` from the three totals.

A recurring income create is correlated with the income entry created in the same submit the way `attachCreatedDefinitions` does it for expenses — same name, amount and day — but in the income step, so one row is produced rather than two.

`attachCreatedDefinitions` and `reconcileRecurringUpdatesAndDeletes` gain an explicit `definition.tipo === 'gasto'` filter. Today income definitions would be skipped anyway because their `categoryId` is `null` and no group id matches it; the explicit filter makes "a salary is not a charge" a stated rule instead of an accident of a null comparison.

### D7 — The income panel swaps `SummaryRow` for the expense row stack

Each entry renders `SwipeToDelete` → `ExpenseRow` (name, date under it, amount on the editable-looking surface), then `AddRow`. `ExpenseRow` is already generic over name/date/amount and needs no change; its `onActivate` gate is what makes the amount look editable, which is exactly the enabled/disabled rule the spec wants. Deletion reuses the single `UndoToast` and the template's existing pending-delete/undo handling, extended to carry which operation set to call on undo.

*Why not extend `SummaryRow`:* it is a read-only row shared with the expenses and savings panels; adding swipe, dates and activation to it would push that behaviour into two panels that must stay read-only.

### D8 — Migration `0015`, and `gasto_fijo_id` renamed with it

`supabase/migrations/0015_movimientos_recurrentes.sql`:

1. `alter table gastos_fijos rename to movimientos_recurrentes`, and rename its repetitions check constraint to match.
2. `add column tipo text not null default 'gasto' check (tipo in ('gasto','ingreso','ahorro'))`.
3. `alter column categoria_id drop not null`, plus `check (tipo <> 'gasto' or categoria_id is not null)`.
4. `transacciones.categoria_id`: drop `not null`, add the same conditional check.
5. `alter table transacciones rename column gasto_fijo_id to movimiento_recurrente_id`, renaming the dependent index and unique constraint; update the column comments.
6. RLS: drop `gastos_fijos_crud_propio`, create `movimientos_recurrentes_crud_propio` with the same `usuario_id = usuario_actual_id()` predicate.

`repeticiones_totales` / `repeticiones_insertadas` are untouched. The `unique (usuario_id, nombre)` constraint stays as it is, which means an expense and an income recurrence cannot share a name; that is acceptable and no worse than today.

*Why rename the FK column:* nothing in TypeScript reads it, so the cost is this one migration, and the alternative is a column called `gasto_fijo_id` pointing at a salary forever.

*Why a forward-only `alter`, not a new table:* the seed in 0012 and the demo have no production data behind them, and a rename keeps 0013's columns and the FK without a data copy.

## Risks / Trade-offs

- **An income recurrence cannot be edited or stopped once created.** → Accepted and specified (`income-editing` → *Entry points*). The definition sheet opens from "Próximos cobros", which income never reaches. A correction is delete-and-re-add, the same escape hatch §7 already documents for turning a one-off expense into a recurring one. A future change can add an entry point from the income row's sheet.
- **`DashboardData.income` is a breaking contract change** for anything mounting the dashboard. → Only two call sites exist (`/demo` and the sample builder); TypeScript flags both. Nothing is deployed.
- **The demo pipeline grows a fifth edit set**, and `deriveDemoData`'s signature keeps widening. → Income resolves as one isolated step that touches no expense structure, and the ordering comment block is extended so the sequence stays readable. A parameter object is a tidy-up for whichever change next touches that signature.
- **Two save calls for one recurring income entry** (entry, then definition) can partially fail. → Specified: the entry stays, the save alert shows, and the retry is the user's. Same behaviour the expense path already has.
- **A conditional check constraint on `transacciones.categoria_id`** lets an `ahorro` row exist with no category, which is what §7 wants, but also lets a mistyped `ingreso` carry one. → Acceptable: the type in D3 prevents the client from doing it, and a cross-column check between `tipo` and `categoria_id` for the income case would block the legitimate "income attributed to a category" case if that is ever wanted.
- **`hojaGasto` now holds income strings.** → Noted in D5; a rename is a separate mechanical change.

## Migration Plan

1. Apply `0015` (forward-only; no data migration). Rollback is the inverse rename plus restoring the two `not null`s, possible while no row has a null `categoria_id` or a non-`gasto` `tipo`.
2. Land the contract changes and the demo implementation together — `DashboardActions.addIncome` disappearing makes any un-updated mount a type error, which is the intended signal.
3. `messages/es.json` and `messages/en.json` gain the new keys and lose `resumen.estimado` in the same commit as the panel change, so no run can render a missing key.
