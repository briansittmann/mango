## Context

See proposal.md → *Why*. What the code does today:

- **Free margin.** `deriveDemoData` (`lib/demo/demo-expenses.ts`, step 10) computes `incomeTotal − total − savingsCycle` inline, and `buildDemoData` repeats the same sum for its placeholder. Nothing in `lib/data/` computes it, and the real layer does not exist yet (`add-supabase-data-layer-and-login` plans the same sum in D8).
- **Budget status.** `getBudgetStatus` (`lib/data/budget.ts`) is pure. `finalizeGroup` passes it the group's full total, recurring charges included, so the demo's "transporte" reads 130 € of 100 € because of the 50 € "Parking" charge. ARCHITECTURE.md §9 already says fixed charges stay out of that calculation.
- **Budget storage.**
  - Schema: `presupuestos.periodo` is `text not null default 'mensual'` with `unique (usuario_id, categoria_id, periodo)` (0006). One row per category, not per cycle.
  - Seed: 0012 inserts two `'mensual'` rows.
  - Demo: budgets are the `amount` argument of `buildCategory`, and edits are applied from `DemoCategoryEdits.updated[id].budget` over the single sample cycle.
- **Cycles.** `rango_ciclo_usuario` (0010) returns the cycle as `[inicio, fin)` timestamps in the user's time zone. The demo's cycle is `2026-09-01`–`2026-09-30` with `dia_inicio_ciclo` 1, and it has no other cycle to navigate to.
- **Month navigation.** The picker already disables months after an in-progress cycle (`month-picker.tsx`). The next-cycle button in `month-selector.tsx` is disabled only when no handler is given, so on `/demo` it is enabled and shows "not available".
- **Header.** `category-card.tsx` prints `group.budget.spent` for a budgeted card and `group.total` otherwise, so changing what `spent` means needs no component change.
- **Tests.** Playwright only. Node is 23.11, whose test runner strips TypeScript types without a flag: checked in this environment with a `.test.mjs` importing a `.ts` module that has a type-only import.

## Goals / Non-Goals

**Goals:**
- One pure function for the free margin that `/demo` uses now and the real layer will use later, with unit tests.
- Budget rows keyed by cycle, with copy-forward and current-cycle-only writes defined once in `lib/data/` and implemented in memory for `/demo`.
- A schema that can hold per-cycle rows, ready for the real layer.

**Non-Goals:**
- The Supabase implementation of the budget rules: reading by `periodo`, the copy on first read, writes from `actualizar_categoria`. It belongs to `add-supabase-data-layer-and-login` and is recorded as debt.
- Navigating to other cycles on `/demo`. The sample still holds one cycle of expenses, and the previous cycle exists only as budget rows.
- UI to edit a past cycle's budget, or to change `dia_inicio_ciclo`.
- Any change to pace or weekly-allowance formulas beyond which "spent" they receive.

## Decisions

**D1. `getFreeMargin` takes plain numbers.** In `lib/data/budget.ts`:

```ts
getFreeMargin({ income, savings, fixed, categories }: {
  income: number
  savings: number
  fixed: number                                             // every recurring charge of the cycle
  categories: { budget: number | null; spent: number }[]    // spent = non-recurring spending
}): number
// income − savings − fixed − Σ (budget == null ? spent : max(budget, spent))
```

It reads like the formula in `category-editing` and can be tested without building `ExpenseGroup`s. *Alternative:* take `ExpenseGroup[]` and split by `expense.fixed`. Rejected because it ties the function to the UI shape and to the demo's `fixed` marker, while the real layer will have `movimiento_recurrente_id` rows before it has groups. The caller does the split, which is one `filter` in each data source.

**D2. "Spent" excludes recurring charges everywhere a budget is involved.** `finalizeGroup` computes `variableSpent` from expenses without `fixed` and passes it to `getBudgetStatus` and to `getFreeMargin`. `total`, which feeds the panel, the pie, the bar chart and the header of an unbudgeted card, stays the full sum. *Alternative (considered with the user):* count a recurring charge inside its category's envelope. Rejected because that folds "fixed expenses" into the envelope and shows a budget bar driven by a charge the user cannot pace.

**D3. The budget contract is a row type plus documented rules, not a new injected interface.** `lib/data/budget.ts` gains:

```ts
/** presupuestos row. `cycle` is the cycle's first day (periodo), computed from dia_inicio_ciclo.
 *  `amount: null` is an explicit "no budget in this cycle" (monto null). */
export type BudgetRow = { categoryId: string; cycle: LocalDate; amount: number | null }
```

Its doc comment states the rules from `category-editing` → *Budgets belong to one cycle*:
- when the current cycle has no rows at all, markers included, copy every row of the most recent earlier cycle that has any, markers included
- never write a later cycle
- edits touch only the current cycle, and clearing writes a marker instead of deleting
- deleting a category removes its rows everywhere

*Why a marker row:* without it, "the current cycle has no rows" cannot tell "never copied" apart from "the user cleared every budget", and the copy would bring cleared budgets back on the next read. A row that says "no budget" makes the cycle non-empty, so the copy is idempotent without any extra column or state. *Alternative:* delete on clear and accept that re-copy as debt. Rejected with the user. `CategoryMutations`' comment in `categories.ts` is updated to say which cycle `create`, `update` and `delete` write. Reads are not injected in this codebase: the page supplies `DashboardData`, and the real layer will apply the copy inside `resumenMensual`. *Alternative:* a `BudgetStore { forCycle(); set() }` interface. Rejected because nothing would call it until the real layer exists, and the demo derives its state synchronously.

**D4. Demo: rows in, budgets out, in three pure functions.** New `lib/demo/demo-budgets.ts`, with type-only imports so Node can run it directly:

- `copyForward(rows, current)`: when `current` has no row (markers count as rows), append copies of the rows of the greatest `cycle < current` that has any, markers included. Otherwise return `rows` unchanged. It never reads or writes a cycle after `current`.
- `setBudget(rows, categoryId, amount | null, current)`: replace or add only the `(categoryId, current)` row. `null` writes a marker, not a deletion. It has no cycle parameter for the target, so it cannot write any other cycle.
- `dropCategory(rows, categoryId)`, and `budgetFor(rows, categoryId, cycle)`, which returns `null` for a marker and for a missing row alike.

A creation without a budget does not call `setBudget`, so it writes no marker.

`demo-data.ts` exports `buildDemoBudgetRows()`: "comida" 400, "ocio" 150 and "transporte" 100 for `2026-08-01`, and nothing for `2026-09-01`. The on-load figures are therefore the copy. `buildCategory` loses its `amount` parameter. `deriveDemoData` gains a `baseBudgetRows` parameter (after `baseDefinitions`) and, in its step 4:

1. `copyForward(baseBudgetRows, base.cycle.start)`
2. every `categoryEdits.updated` or `created` draft → `setBudget(…, draft.budget, base.cycle.start)`
3. every `deleted` → `dropCategory`
4. each group's `budgetAmount = budgetFor(rows, id, base.cycle.start)`

Edits are applied after the copy, so clearing every budget does not bring them back within the session. `app/demo/page.tsx` passes the rows to `DemoDashboard` next to the recurring definitions, and both derive calls receive them.

**D5. Unit tests: `node --test` on `.test.mjs` files that import the `.ts` modules.** The script is `"test:unit": "node --test \"lib/**/*.test.mjs\""`. There are two files: `lib/data/budget.test.mjs` (the formula cases in the proposal) and `lib/demo/demo-budgets.test.mjs` (copy, edit isolation, no future rows). *Alternative:* `.test.ts` files. Rejected because they need `allowImportingTsExtensions` to import `./budget.ts`, and `next build` type-checks every included `.ts`, so they would break the build. Vitest was also rejected: a dependency for 8 cases, when the platform runner works. Tests import by relative path because Node does not resolve the `@/` alias, which is why the modules under test may use `@/` only in type-only imports.

**D6. Migration `0018_presupuestos_periodo_ciclo.sql`, with the seed fixed at the source.**

```sql
alter table presupuestos
  alter column periodo drop default,
  alter column periodo type date using periodo::date,
  alter column monto drop not null;
comment on column presupuestos.monto is '<null = explicit "no budget in this cycle"; see the periodo comment>';
comment on column presupuestos.periodo is '<first day of the billing cycle, from rango_ciclo_usuario; one row per category per cycle; copy-forward rules>';
comment on column usuarios.meta_ahorro_mensual is '<0016 text without "no debe restar del margen libre igual que presupuestos no lo hace">';
```

- **Unique constraint.** `unique (usuario_id, categoria_id, periodo)` already exists from 0006. `alter column … type` rebuilds its index and keeps it, so 0018 does not declare a second one. The user asked for the constraint, and it is verified by static review rather than duplicated.
- **Marker.** `monto` becomes nullable for the "no budget" marker (D3). The 0006 `check (monto > 0)` stays as it is: a CHECK passes on null, so it already reads "null or above 0" and needs no rewrite.
- **Default.** It is dropped, not replaced: a cycle start depends on the user, so no column default can be right.
- **Seed.** 0012 is edited so its insert writes `periodo` as the current cycle's first day, as text because the column is still text at that point: `(select (c.inicio at time zone u.timezone)::date::text from usuarios u cross join lateral rango_ciclo_usuario(u.id) c where u.telefono = '+353000000000')`. 0018's cast then turns it into a date. `on conflict (usuario_id, categoria_id, periodo)` keeps working.
- **Numbering.** 0017 is claimed by `add-supabase-data-layer-and-login`, so this is 0018.
- **No data step.** There is no real database, so 0018 has no `update … where periodo = 'mensual'`. A database that ran the old 0012 fails the cast loudly instead of guessing a cycle.

*Alternative (rejected by the user):* keep `periodo` as text holding `'YYYY-MM-DD'`, with no migration.

**D7. Month navigation stops at the current cycle.** In `month-selector.tsx` the next button becomes `disabled={!onNext || inProgress}`. Both variants, header and compact top bar, render through this component. The picker is unchanged. The real route's future handler may still exist, but it cannot be reached while the displayed cycle is current.

**D8. The Supabase side lives in the other change's plan.** `add-supabase-data-layer-and-login` was revised to use this model, with this change as its prerequisite:
- its D8 reads by cycle after a copy RPC
- its D12 adds `copiar_presupuestos_ciclo`, and the category functions write the current cycle's row and a marker on clear
- its D15 seeds per-cycle rows
- its `dashboard-data` and `test-user-seed` deltas use 844 € and `getFreeMargin`

This change edits nothing there. It only has to be archived first, so that 0018 and the edited 0012 exist before that change applies the migrations.

## Risks / Trade-offs

- **[Readers that treat a marker as a budget]** Code that reads `presupuestos` and assumes `monto` is a number would draw a bar of 0 or fail. → `BudgetRow.amount` is typed `number | null`, and `budgetFor` returns `null` for both a marker and a missing row. The real layer (`add-supabase-data-layer-and-login`) reads through the same type.
- **[Two readers copy at once]** Two tabs opening a new cycle together could both see it empty. → The in-memory demo has one reader. The real layer copies with one `insert … on conflict do nothing` against the 0006 unique constraint, which that change owns.
- **[`dia_inicio_ciclo` changes later]** Existing `periodo` keys would no longer be cycle starts. → No UI changes it today. Recorded as debt.
- **[Nothing checks that `periodo` is a real cycle start]** A check constraint cannot read `usuarios.dia_inicio_ciclo`. → The contract in `lib/data/budget.ts` and the column comment state it. The real layer computes it from `rango_ciclo_usuario`.
- **[The "transporte" header reads 80 € de 100 € while its rows add to 130 €]** → The card still lists "Parking", the panel and the pie show 130 €, and ARCHITECTURE.md §9 now explains why. Screenshot "transporte" expanded, in both themes, during verification.
- **[Playwright regexes on bare numbers]** `/844/` could match unrelated text. → Where a test uses a bare number, anchor it to the label, as `savings-create` does with `Margen libre\s*…`.
- **[0018 verified only by static review]** Same limit as 0015 and 0016: there is no docker, Supabase CLI or psql here. → The review checks the cast, the kept constraint and the seed's `text` value, and the debt entry names it.
- **[Node prints an ExperimentalWarning for type stripping]** → Harmless. `node --test` exits non-zero only on failures.
