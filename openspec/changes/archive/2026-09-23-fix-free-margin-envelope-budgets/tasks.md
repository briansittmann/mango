## 1. Free-margin formula

- [x] 1.1 Add `getFreeMargin({ income, savings, fixed, categories })` to `lib/data/budget.ts`, next to `getBudgetStatus` (D1): `income − savings − fixed − Σ (budget == null ? spent : max(budget, spent))`, no rounding, no storage — verify `npx tsc --noEmit` passes
- [x] 1.2 Add `BudgetRow = { categoryId; cycle: LocalDate; amount: number | null }` to `lib/data/budget.ts` with a doc comment stating the per-cycle rules (D3: `null` is a "no budget" marker; copy when a cycle becomes current and holds no rows, markers included, from the most recent earlier cycle with rows; never a later cycle; edits and creations write the current cycle only; clearing writes a marker; deletion removes every cycle's rows). Update the `CategoryMutations` comment in `lib/data/categories.ts` to say which cycle `create`, `update` and `delete` write — verify `npx tsc --noEmit` passes and the comments match `category-editing` → *Budgets belong to one cycle*
- [x] 1.3 Add `"test:unit": "node --test \"lib/**/*.test.mjs\""` to `package.json` and write `lib/data/budget.test.mjs` (D5) with one test per case, using the demo's figures where they apply:
  - spending within the budget (comida 330 of 400 leaves the margin where 310 of 400 did)
  - spending over the budget (transporte 110 of 100 costs 10)
  - overspending in one category with leftover in another (comida 90 under, transporte 30 over → −30, not −20)
  - raising and lowering a budget once spending exists (400→600: −200; 400→350: +50; 400→200 with 310 spent: +90, not +200)
  - a category with no budget in the cycle (its whole spending counts)
  - the demo's load figures give 844

  Verify `npm run test:unit` passes, and that it fails when `max(budget, spent)` is temporarily replaced by `budget`.

## 2. Budgets per cycle on `/demo`

- [x] 2.1 Create `lib/demo/demo-budgets.ts` with `copyForward`, `setBudget`, `dropCategory` and `budgetFor` (D4). `setBudget` always writes the `current` cycle it is given and writes a marker for `null`. `copyForward` treats markers as rows and ignores any row after `current`. `budgetFor` returns `null` for a marker. Imports from `@/` are type-only — verify `npx tsc --noEmit` passes
- [x] 2.2 Write `lib/demo/demo-budgets.test.mjs`. Verify `npm run test:unit` passes all of it:
  - a new current cycle with no rows copies the previous cycle's rows, and the previous cycle's rows are unchanged
  - it copies from the most recent cycle that has rows, skipping an empty one
  - no copy when the current cycle already holds a row
  - `setBudget` for the current cycle leaves every earlier cycle's rows equal to before, and a later `copyForward` into the next cycle carries the new amount
  - clearing every budget of the current cycle leaves markers, a second `copyForward` on that cycle changes nothing, and the next cycle's copy carries the markers
  - no row with a cycle after the current one exists after any sequence of `copyForward` and `setBudget`
- [x] 2.3 In `lib/demo/demo-data.ts`:
  - export `buildDemoBudgetRows()`: "comida" 400, "ocio" 150 and "transporte" 100 for `2026-08-01`, and nothing for `2026-09-01`
  - drop the `amount` parameter from `buildCategory`
  - drop the inline free-margin sum, which `deriveDemoData` recomputes
  - pass the rows to its `deriveDemoData` call

  Verify with `npx tsc --noEmit`.
- [x] 2.4 In `lib/demo/demo-expenses.ts`:
  - `deriveDemoData` takes `baseBudgetRows` after `baseDefinitions`
  - step 4 resolves `budgetAmount` from the rows as D4 orders it (copy, then updates and creations via `setBudget`, then deletions via `dropCategory`)
  - `finalizeGroup` passes the non-recurring spending to `getBudgetStatus`
  - step 10 computes the margin with `getFreeMargin`, where `fixed` is the sum of every group's `fixed` expenses

  Verify `/demo` shows "Margen libre 844 €", "Transporte 80 € de 100 €" and "Gastos 1.700 €" on load.
- [x] 2.5 Pass `buildDemoBudgetRows()` from `app/demo/page.tsx` to `DemoDashboard`, and on to its `deriveDemoData` call in `app/demo/demo-dashboard.tsx` — verify `npx tsc --noEmit` and `npm run lint` pass

## 3. Month navigation

- [x] 3.1 In `components/molecules/month-selector.tsx`, disable the next-cycle button while `inProgress` (D7), which covers both the header and the top-bar variant — verify on `/demo` that both next buttons are disabled and the previous button is enabled (covered by 5.2)

## 4. Schema

- [x] 4.1 Write `supabase/migrations/0018_presupuestos_periodo_ciclo.sql` (D6): drop the `periodo` default, `alter column periodo type date using periodo::date`, `alter column monto drop not null`, column comments on `presupuestos.periodo` (per-cycle rules) and `presupuestos.monto` (null = "no budget" marker), and a corrected comment on `usuarios.meta_ahorro_mensual` without the "presupuestos no restan del margen" clause. Verify by static review:
  - the 0006 unique constraint `(usuario_id, categoria_id, periodo)` still applies after the type change and is not declared twice
  - the 0006 `check (monto > 0)` accepts a null `monto` and still rejects 0 and negatives
  - nothing else in 0001–0016 references `periodo` or its default
- [x] 4.2 Edit the budget insert in `supabase/migrations/0012_seed_brian.sql` so `periodo` is the current cycle's first day as text, from `rango_ciclo_usuario` in the user's time zone (D6). Verify by static review that `on conflict (usuario_id, categoria_id, periodo)` still targets the 0006 constraint and that 0018's cast accepts the value (`YYYY-MM-DD`).

## 5. Playwright

- [x] 5.1 Update the figures in the existing specs. Where a bare number is matched, anchor it to its label (for example `Margen libre\s*844`).
  - `animated-amount`: margin `974` → `844` (three places); "transporte" `130` → `80` (three places); after "Peaje" 234,50, margin `739,50` → `629,50` and "transporte" `364,50` → `314,50`; after the edit to 34,50, margin `939,50` → `829,50` and "transporte" `164,50` → `114,50`
  - `category-create`: `974` → `844`; the budget-200 test also asserts the margin at `644`
  - `income-create`: `1.274` → `1.144`
  - `income-edit-delete`: `554` → `424`, `974` → `844`
  - `income-recurring`: `2.174` → `2.044`
  - `recurring-create`: the category line `180 € de 100 €` → `80 € de 100 €` (and `180 of 100` → `80 of 100` in English); `924` → `794`
  - `recurring-scope`: `914` → `784`, `969` → `839`, `974` → `844` (twice), `1.009` → `879`
  - `reorder-mode`: `974` → `844` (twice)
  - `savings-create`: `924` → `794`, `974` → `844` (twice)
- [x] 5.2 Add `tests/budget-envelope.spec.js`, covering `category-editing` → *A budget reserves its amount in the free margin* and `dashboard-ui` → *Cycle header and free margin* on `/demo` in Spanish. Verify `npx playwright test tests/budget-envelope.spec.js` passes:
  - on load, 844 € and "Transporte 80 € de 100 €", while the expenses panel lists "transporte" with 130 €
  - +20 € to "comida" leaves 844 €
  - +30 € to "transporte" gives 834 €
  - raising "comida" to 600 gives 644 €
  - lowering it to 200 gives 934 € with "110 € por encima del presupuesto"
  - clearing it gives 934 €
  - both next-cycle buttons are disabled
- [x] 5.3 Run the whole suite — verify `npm test` passes with no failures, and record any pre-existing failure unrelated to this change here instead of fixing it
  - 2026-09-23 run: 211 passed, 2 failed, both intermittent and unrelated to figures:
    - `[webkit] income-create` › adding an income entry: the "Añadir ingreso" click is intercepted by the "Gastos" `count-up` while the panel is still animating open, before any figure is read. Re-run ×10: 9 passed.
    - `[firefox] recurring-motion-a11y:158` › reduced motion: one extra height sample (3 distinct values, expected ≤ 2). Re-run ×5: 5 passed.

## 6. Docs and coordination

- [x] 6.1 ARCHITECTURE.md §3: where `resumenMensual(userId, mes)` is described, state the free-margin formula and that it is derived on read by a pure function in the shared data layer — verify by reading the section
- [x] 6.2 ARCHITECTURE.md §4, "Primera interacción": after the "café 3,50" exchange, add a note that this expense moves the food budget bar, not the free margin, because comida is budgeted — verify by reading the section
- [x] 6.3 ARCHITECTURE.md §8, `presupuestos`: `periodo` is the cycle's first day (`date`), one row per category per cycle, copied into a new current cycle — verify by reading the section
- [x] 6.4 ARCHITECTURE.md §9: make every item below agree with the new formula, then verify `grep -n "ingresos − ahorro − gastos\|Baja\*\* con cada carga\|no restan del margen\|no entran en esta cuenta" ARCHITECTURE.md` returns nothing:
  - item 2 of the structure list
  - the "Margen libre — Baja con cada carga" row of the four-numbers table, and the paragraph after it ("el mismo movimiento visto de dos lados")
  - *Alcance* ("es el sobrante después de ingresos, ahorro y gastos")
  - *Presupuestado vs real* (the "margen real" sentence and the worked example, rebuilt with fixed expenses and envelopes)
  - the *Detalles de implementación* line on fixed charges, which now also covers the bar
- [x] 6.5 Rewrite the Purpose line of `openspec/specs/category-editing/spec.md`, which says a budget "never changes how much money the dashboard says is free" — verify `openspec validate --specs` passes
- [x] 6.6 Check that `add-supabase-data-layer-and-login` still matches what this change shipped (D8): its D8, D12 and D15, and the `dashboard-data` and `test-user-seed` figures (844 €). Edit nothing there unless the implementation drifted from this plan, in which case revise that plan with `/opsx:update` — verify `openspec validate add-supabase-data-layer-and-login` passes

## 7. Verification and archive

- [x] 7.1 Run `npm run lint`, `npx tsc --noEmit` and `npm run build` — verify all three succeed
- [x] 7.2 Screenshot `/demo` at 390px in the light and dark themes, with the free-margin card and the expanded "transporte" card in view — verify 844 €, "80 € de 100 €" with the warning-colour bar, and both "Gasolina" and "Parking" listed
- [x] 7.3 On archive, update `CLAUDE.md`, which holds the debt list the request calls `status.md` — verify the entries are present:
  - *Deuda técnica*: the Supabase implementation of `BudgetRow` and the copy-forward, planned in `add-supabase-data-layer-and-login`; `periodo` keys if `dia_inicio_ciclo` ever changes; 0018 verified only statically
  - *Estado actual*: the free margin now uses envelopes
