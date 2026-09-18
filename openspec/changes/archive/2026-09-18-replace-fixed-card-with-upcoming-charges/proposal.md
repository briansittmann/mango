## Why

The dashboard shows a "Gastos fijos" card that answers the same question the category cards already answer — *how much*. Collapsed, `Gastos fijos · 900` and a housing card read as two separate expenses, and nothing on screen says it is the same money. The card also duplicates interaction: the electricity row can be opened from two places, one of which says *"solo el cargo de este mes"*, which implies a second copy exists somewhere.

Meanwhile nothing in the dashboard answers *when*. The billing calendar — what is already charged this cycle and what is still coming — exists in the data (`gastos_fijos.dia_del_mes`, `transacciones.estado`) and is shown nowhere.

This change retires the fixed-expenses card and puts a read-only **"Próximos cobros"** strip in its place. Fixed charges move into their own categories, where ARCHITECTURE.md §8 and §9 already say they live.

## What Changes

### A) Fixed charges live in their categories

- **BREAKING (internal contract).** `ExpenseGroup.kind` loses `'fixed'`; every card is a category card and `name` is no longer nullable. The `dashboard.gastosFijos` label and the `fixedCharge` entry-sheet context go with it.
- A fixed charge is now a property of an expense row, not of the card that holds it: `Expense` gains `fixed?: { day: number; charged: boolean }`, mirroring `gastos_fijos.dia_del_mes` and `transacciones.estado`.
- Consequence: fixed charges gain what every other row already has — an options control on their card, an add row, a category colour, a budget they count against. Each charge is still counted exactly once.

### B) A card that answers *when*

- **"Próximos cobros"**, placed under the *Desglose de gastos* heading, above the first category card.
- **Collapsed:** a thin strip, shorter than a category card — the title on the left, the next charge with its day on the right (`Parking · día 15`). Never a total. No colour dot, no lighter surfaces, a muted chevron rather than the brand-tinted one the cards use.
- **Expanded:** one row per charge of the cycle — day chip, 6px category dot, name, amount aligned to the card edge. Already-charged rows first, dimmed with a checkmark; pending rows below at full opacity. The boundary between the two groups is the only "you are here" marker: no divider, no label, no today indicator.
- **Footer:** below a hairline, one muted line with the cycle total (`comprometido este ciclo · 1.025 €`), smaller than the row amounts.
- **Read-only, and it looks read-only.** No row is a button, nothing swipes, no amount sits on a lighter surface, and no helper text explains the absence. Editing a charge happens once, in its category card.
- **No lime, amber or red**, and no new colour: lime is brand and amber/red are budget state (§9).

### C) When everything is already charged

The strip never falls back to a total or an empty state. Once every charge in the cycle is confirmed, it shows the **first charge of the next cycle** — the same recurring definitions, so the earliest day in the list. Same shape, same format, one less special case. A cycle with no fixed charges at all renders no card.

### D) Data

- Reads existing tables only — **no migration**. Rows are the cycle's `transacciones` with `es_fijo = true` and `gasto_fijo_id IS NOT NULL` and `borrado_en IS NULL`; the day comes from `gastos_fijos.dia_del_mes`; charged vs pending comes from `estado`.
- The card never queries. It is derived from the same rows the category cards render, so editing a charge's amount in its category moves the card, the footer total and the free margin together.
- The footer total sums pending and confirmed alike, consistent with §7: fixed expenses leave the free margin from day one of the cycle. **No figure this change touches moves the free margin.**

### E) Demo

The sample is re-homed, not re-priced. The three rows of the old fixed group move into a new **`vivienda`** category (`gris_oscuro`, no budget, 900 €), and three rows that are already in the sample become recurring charges. **The expenses total stays 1.700 € and the free margin stays 974 €**, so every figure asserted by the existing capabilities survives.

| Charge | Category | Day | Amount | State |
|---|---|---|---|---|
| Alquiler | vivienda | 1 | 820 € | charged |
| Internet | vivienda | 3 | 45 € | charged |
| Seguro | vivienda | 8 | 35 € | charged |
| Parking | transporte | 15 | 50 € | pending |
| Limpieza | hogar | 20 | 35 € | pending |
| Gimnasio | salud | 22 | 40 € | pending |

Three charged and three pending, so both visual states are on screen at first load. `Farmacia` (salud, 40 €) is renamed `Gimnasio` and keeps its amount and identifier — a gym membership is a credible recurring charge where a single pharmacy purchase is not.

### F) Copy and docs

- A new `proximosCobros` message namespace in both languages. No literal strings in components.
- ARCHITECTURE.md §9 *"La tarjeta 'Gastos fijos': resumen, no contenedor"* is rewritten, and the two mobile/desktop order lists updated. §7's note that the fixed card can show what is left to confirm is now true of this card.
- `DESIGN.md` gains the day chip and the read-only row.

**Out of scope:**

- The fixed-expense **definitions** screen (expected amount, day, deactivating, deleting) and the `activo` vs `borrado_en` question on `gastos_fijos`. A "Gestionar gastos fijos" footer link has a natural place here; it is not built.
- The §9 *"día 3"* line under a recurring expense inside its category card.
- Subscription-expiry reminders (§14.1, phase 2) and drag-to-reorder (phase 3).
- Any change to how fixed charges are created, edited, or subtracted from the free margin, and any Supabase implementation — the real dashboard route still does not exist.

## Capabilities

### New Capabilities

- `upcoming-charges`: the billing-calendar card — what it shows collapsed and expanded, the ordering and grouping of charges, the checkmark and dimming of charged rows, the footer total, its read-only guarantees, the fallback to the next cycle, and the injected data it renders from.

### Modified Capabilities

- `dashboard-ui`:
  - *Expense cards group each expense exactly once*: a fixed charge belongs to its category's card; there is no fixed-expenses card.
  - *Expense card states*: every card is a category card, so the fixed-card exceptions (disclosure only, no add row) are gone.
  - *Category colour placement*: the pie and legend now count only category cards.
  - *Public demo route*: the sample carries a `vivienda` category and six recurring charges with a day and a state, with the total and free margin unchanged.
- `expense-editing`:
  - *Entry points*: a fixed charge opens from its category card only, and the sheet's caption names that category while still stating that only this cycle's charge changes.
  - *Delete with undo*: the deletion scenario moves off `Farmacia`.
- `category-editing`:
  - *Opening the category sheet*: with no fixed card left, every card carries the options control.

`theming` and `design-system` are **not** modified: the card introduces no colour, material or motion rule that is not already required.

> `openspec/specs/` is still empty because no change has been archived. `dashboard-ui`, `expense-editing` and `category-editing` are defined by `land-finance-dashboard`, `restyle-dashboard-to-v0`, `refine-mobile-ui-apple-hig`, `unify-add-action-rows`, `add-expense-sheet` and `add-category-sheet`. Archive this change after those six.

## Impact

- **Data contract:** a new `lib/data/upcoming-charges.ts` (the charge type and the pure selector over the cycle's groups); `Expense.fixed` and the `kind` narrowing in `lib/data/dashboard.ts`.
- **Components:** a new `components/organisms/upcoming-charges-card.tsx` and a day-chip atom; changes to `category-card.tsx` (no fixed branch), `dashboard-template.tsx` (mounting, placement, collapse-all), `category-pie-chart.tsx` and `entry-sheet.tsx` (caption).
- **Demo:** `lib/demo/demo-data.ts` (the `vivienda` group and the six charges) and `lib/demo/demo-expenses.ts` (carrying `fixed` through the derivation).
- **Messages and docs:** `messages/es.json`, `messages/en.json`, `DESIGN.md`, ARCHITECTURE.md §7 and §9.
- **Dependencies:** none new. The existing `Collapsible` already animates height and honours reduced motion.
- **Database:** no migration. `transacciones.estado`, `transacciones.es_fijo`, `gasto_fijo_id` and `gastos_fijos.dia_del_mes` already exist.
- **CSS:** none expected. Every token the card needs already exists.
