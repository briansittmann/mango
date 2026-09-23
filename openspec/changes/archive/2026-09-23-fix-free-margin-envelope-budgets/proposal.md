## Why

The free margin is meant to answer *"how much can I spend this cycle without breaking anything"* (ARCHITECTURE.md §9). Today it is `income − savings − expenses`, and budgets never enter it. So on day 1 it counts the whole food and leisure budget as free money, and it drops with every coffee even though that coffee was already planned for. Budgets have to work as envelopes: money set aside for a category is not free, whether it has been spent yet or not. For an envelope to mean anything over time, a budget also has to belong to one cycle: editing September's must not rewrite August's.

## What Changes

- **BREAKING (behaviour): new free-margin formula.**
  - The formula: `income − savings − fixed expenses − Σ max(budget, spent) per budgeted category − spent in categories without a budget`.
  - "Fixed expenses" are every recurring charge in the cycle, pending or charged. "Spent" in a category is its spending *outside* recurring charges, so every expense counts exactly once.
  - The max applies per category: overspending in one category is never offset by money left in another's budget. Leftover budget stays reserved until the cycle ends and never flows back into the margin.
  - It is derived every time it is read and never stored. It is a pure function in `lib/data/`, next to `getBudgetStatus`, and it replaces the inline sum on `/demo`. The real dashboard will use the same function.
- **BREAKING (behaviour): the budget bar leaves recurring charges out.** A budgeted card's "spent of budget", bar, remaining text and weekly allowance measure the category's non-recurring spending. This matches ARCHITECTURE.md §9: *"Los gastos fijos quedan fuera de este cálculo"*. The card's total in the expenses panel and in the pie still includes every expense.
  - On `/demo`, "Transporte" goes from "130 € de 100 €" (over budget) to "80 € de 100 €". Its 50 € "Parking" charge is counted once, as a fixed expense.
- **Visible consequences on `/demo`.** The margin on load goes from 974 € to **844 €**: comida reserves 90 € more, ocio 20 € more, and transporte's envelope is 100 € where its variable spending is 80 €. Every spec scenario and Playwright assertion that states a margin figure, or transporte's bar, is updated to match.
  - Spending within a budget no longer moves the margin. Spending past it moves the margin only by the amount beyond the budget.
  - Setting, raising, lowering or clearing a budget moves the margin, and so do creating a category with a budget and deleting a budgeted category.
  - Renames, recolours, reorders and changes to recurring charges or to unbudgeted categories move it as before.
- **Budgets are stored per cycle.**
  - Each `presupuestos` row belongs to one category and one cycle.
  - When a cycle becomes current and has no budget rows, the rows of the most recent cycle that has any are copied into it. No row is ever created for a future cycle.
  - Editing a budget writes only the current cycle's row, so closed cycles never change and later cycles inherit the new amount through the copy.
  - Clearing a budget writes a "no budget" row (null amount) for the current cycle instead of deleting it. The cycle therefore never looks empty again, a cleared budget cannot be copied back, and the "no budget" carries forward like any amount.
  - A category with a "no budget" row, or with no row after the copy, is unbudgeted.
  - These rules are written into the data contract in `lib/data/` and implemented only by `lib/demo/`.
- **Migration `0018_presupuestos_periodo_ciclo.sql`:**
  - `presupuestos.periodo` goes from free text (`'mensual'`) to a `date` holding the cycle's first day, computed from `dia_inicio_ciclo`. For a user with day 26, the September cycle is `2026-08-26`.
  - `presupuestos.monto` becomes nullable, for the "no budget" row. The 0006 `check (monto > 0)` already lets null through.
  - The existing `unique (usuario_id, categoria_id, periodo)` from 0006 is kept.
  - Seed `0012` is updated so its budget rows belong to the current cycle.
  - There is no real database yet, so no other data migration is needed. Like 0015 and 0016, it is verified by static review only.
- **The month selector stops at the current cycle.** While the displayed cycle is in progress, the "next cycle" control is disabled, in the header and in the top bar. The month picker already makes later months unselectable.
- **Unit tests, the project's first**, run with Node's built-in test runner through a new `test:unit` script:
  - the formula: spending within the budget, spending over it, overspending in one category with money left in another, raising and lowering a budget once spending exists, a category with no budget in the cycle
  - budgets per cycle: a new current cycle copies the previous one's rows, editing a budget leaves earlier cycles alone, no rows are created for future cycles
- **Docs:**
  - ARCHITECTURE.md §3: the formula stated where `resumenMensual` is described.
  - ARCHITECTURE.md §9: "Margen libre — baja con cada carga", the four-numbers table, *Alcance* and *Presupuestado vs real* with its worked example.
  - ARCHITECTURE.md §4: the "café 3,50" script, which gets a note that this expense moves the food budget bar, not the free margin.
  - ARCHITECTURE.md §8: `periodo` is the cycle's first day.
- **Coordination:** `add-supabase-data-layer-and-login` (in progress) is revised in its own plan to adopt this model: per-cycle reads with a copy RPC, category functions that write the current cycle, a seed with per-cycle rows, and `getFreeMargin`. It names this change as a prerequisite. This change only has to land first.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `category-editing`: the budget requirement is inverted, from "tracks spending and never reserves money" to "reserves its amount in the free margin", and becomes the one place the free-margin formula is defined. It adds budgets per cycle: the copy into a new current cycle, edits that write only the current cycle, and nothing for future cycles. The update and delete scenarios with margin figures are updated.
- `category-creation`: creating a category with a budget lowers the margin by that budget. Creating one without a budget still moves nothing.
- `category-reordering`: the margin figure in the reorder scenarios goes from 974 € to 844 €.
- `expense-editing`: spending within a budget leaves the margin alone, and spending past it moves the margin only by the excess. Scenario figures (margin and transporte's bar) are updated.
- `income-editing`: the margin is defined by reference to `category-editing` instead of `income − expenses − savings`. Figures shift by −130 €.
- `savings-editing`: same as income: the formula is referenced and the figures updated.
- `upcoming-charges`: the margin after editing "Alquiler" goes from 914 € to 784 €.
- `dashboard-ui`:
  - The demo rule "no category change SHALL move the free margin" becomes "category changes move it only through budgets", and the demo figures are updated.
  - The budget-progress requirement states that recurring charges are left out of the bar.
  - The cycle header disables "next cycle" while the cycle is in progress.

## Impact

- **Code:**
  - `lib/data/budget.ts`: `getFreeMargin` and the per-cycle budget row type with its contract.
  - `lib/data/categories.ts`: the contract comment says which cycle `update`, `create` and `delete` write.
  - `lib/demo/demo-budgets.ts` (new): the in-memory budget rows and copy-forward.
  - `lib/demo/demo-data.ts` and `lib/demo/demo-expenses.ts`: budgets from rows, bar on non-recurring spending, margin from `getFreeMargin`.
  - `components/molecules/month-selector.tsx`: "next" disabled while in progress.
  - `package.json`: `test:unit`.
  - New `lib/data/budget.test.mjs` and `lib/demo/demo-budgets.test.mjs`.
- **Database:**
  - New `supabase/migrations/0018_presupuestos_periodo_ciclo.sql`. 0017 is claimed by `add-supabase-data-layer-and-login`.
  - An edit to the budget insert in `0012_seed_brian.sql`.
- **Tests:** margin and transporte figures in 9 Playwright specs: `animated-amount`, `category-create`, `income-create`, `income-edit-delete`, `income-recurring`, `recurring-create`, `recurring-scope`, `reorder-mode`, `savings-create`.
- **Docs:** `ARCHITECTURE.md` §3, §4, §8 and §9; `CLAUDE.md` *Deuda técnica* on archive (the request names `status.md`, which does not exist; the debt list lives in `CLAUDE.md`).
- **Other change:** none edited by this change's tasks. `add-supabase-data-layer-and-login` already carries the Supabase side in its own plan.
- **Out of scope:** the Supabase implementation of the budget contract and of the copy-forward. It is planned in `add-supabase-data-layer-and-login` (D8, D12, D15).
- No new runtime dependency. Node's test runner and its type stripping come with the installed Node 23.11.
