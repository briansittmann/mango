## Purpose

Lets the user look up to six billing cycles ahead and see what each will hold — recurring income and charges, inherited budgets, the savings target and the free margin they leave — computed from the same rule that later inserts those charges, so a projected cycle and the same cycle once inserted never disagree.

## ADDED Requirements

### Requirement: A future cycle is computed, not stored

A cycle after the one in progress SHALL be a projection: its figures SHALL be computed on every read from the user's recurring definitions, budget entries and savings target, and no movement row SHALL be written for it by reading it. The dashboard SHALL reach up to six cycles after the one in progress, and no further.

The projection of a cycle SHALL contain:

- **Recurring income**: one entry per active income definition, at its expected amount.
- **Recurring expenses**: one charge per active expense definition, at its expected amount, in the definition's category. A definition with a number of repetitions SHALL appear only while repetitions remain: counting cycles from the last cycle whose charges were generated (`recurring-charge-generation`), the n-th cycle after it SHALL include the definition only when the charges produced so far plus n do not exceed the total. An inactive definition SHALL NOT appear.
- **Budgets**: each category's entry for that cycle when the cycle holds any entry, otherwise the entries of the most recent earlier cycle that holds any — the same rule as the copy into a new current cycle (`category-editing` → *Budgets belong to one cycle*), without writing anything.
- **Savings**: the user's savings target as the cycle's savings, or 0 when there is none.
- **Free margin**: computed by the same rule as any other cycle (`category-editing` → *A budget reserves its amount in the free margin*), with each category's spending being the sum of its projected recurring charges.

The same computation SHALL decide which charges are inserted when the cycle starts (`recurring-charge-generation`), so a projected cycle lists exactly the charges, amounts and dates that will be inserted for it, as long as no definition, budget or target changes in between.

#### Scenario: A plan ends inside the horizon
- **WHEN** September 2026 is in progress and generated, and a definition "Hacienda" of 220 € has produced 1 of 3 charges
- **THEN** the October and November projections list "Hacienda" at 220 €, and the December projection does not list it
- **AND** the December free margin is 220 € higher than November's, all else equal

#### Scenario: A plan that has not started yet
- **WHEN** September is in progress and generated, and "Préstamo DB Bank" of 266 € has produced 0 of 4 charges and has no September charge
- **THEN** the October to January projections list it, and the February projection does not

#### Scenario: Projected free margin
- **WHEN** a projected cycle holds recurring income of 4 000, recurring charges of 1 000 in "Vivienda" (no budget), 90 in "Suplementos" (budget 100) and none in "Comida" (budget 300), and the user has no savings target
- **THEN** its free margin is 2 600 (4 000 − 1 000 − 100 − 300)

#### Scenario: Reading a projection writes nothing
- **WHEN** the user opens the cycle three months ahead and reloads it
- **THEN** no movement row and no budget entry exists for that cycle afterwards

#### Scenario: Beyond the horizon
- **WHEN** September 2026 is in progress and the user opens `/dashboard?mes=2027-06`
- **THEN** the March 2027 cycle, the sixth after September, is shown as a projection

### Requirement: A recurring charge falls on its day inside the cycle

A charge, projected or inserted, SHALL be dated on the day inside the cycle whose day of the month equals the definition's day. When the cycle does not contain that day of the month — the day does not exist in the month where it would fall, as the 31st in a 30-day month or the 29th to 31st in February — the charge SHALL fall on the last day of that month, inside the same cycle.

#### Scenario: Cycle starting on the 1st
- **WHEN** the cycle runs from 1 to 31 October and a definition's day is 14
- **THEN** its charge is dated 14 October

#### Scenario: Cycle starting on the 26th
- **WHEN** the cycle runs from 26 January to 25 February and definitions have days 3 and 29
- **THEN** the charges are dated 3 February and 29 January

#### Scenario: A day the month does not have
- **WHEN** the cycle runs from 1 to 30 September and a definition's day is 31
- **THEN** its charge is dated 30 September
- **AND** when the cycle runs from 26 February to 25 March 2027 and a definition's day is 30, its charge is dated 28 February 2027

### Requirement: What a projected cycle shows and allows

A projected cycle SHALL be rendered by the same dashboard as any other, with these differences:

- Under the title, a "Proyección" label (in the active language) SHALL replace the "in progress" label, before the date range.
- Every projected recurring charge SHALL be listed in its category's card and every projected income entry in the income panel, each as a pending row that cannot be edited, swiped or deleted.
- A budgeted category SHALL show its budget amount and an empty bar, and no spent-of-budget figure, no amount left per week and no over-budget text.
- The "Próximos cobros" card SHALL list the projected charges, all pending, sorted by day; a row SHALL still open its definition's sheet.
- The monthly spend chart and the accumulated savings SHALL NOT be shown.
- No control to add an expense, an income entry, a savings movement or a category, and no reorder mode, SHALL be offered.
- The category sheet SHALL open from a card and SHALL allow changing the budget of that cycle (`category-editing` → *A future cycle's budget asks how far it reaches*).

#### Scenario: Label and read-only rows
- **WHEN** the user, in Spanish, opens the November 2026 projection
- **THEN** the line under the title shows "Proyección" followed by the range 1–30 November, and no "en curso" label
- **AND** swiping the "Alquiler" row reveals no delete action, and no "Añadir gasto" row is shown

#### Scenario: Budget bar in a projection
- **WHEN** "Comida" has a budget of 300 in the November projection
- **THEN** its card shows 300 € as its budget with an empty bar, and no "por semana", "de 300 €" or "por encima" text

#### Scenario: Upcoming charges in a projection
- **WHEN** the November projection is shown
- **THEN** "Próximos cobros" lists every projected charge as pending, in day order, and its footer total equals their sum

### Requirement: The demo projects too

`/demo` SHALL offer the same projection after its sample cycle, computed in memory from its own recurring definitions, budget entries and savings target by the same computation, with its sample cycle as the last generated one. Its next-cycle control and month picker SHALL reach six cycles after the sample cycle. Its previous-cycle control SHALL keep its current behaviour. The demo SHALL still make no request to a Supabase host.

#### Scenario: Demo projection
- **WHEN** on `/demo` the visitor activates the next-cycle control
- **THEN** the October 2026 projection of the sample is shown with the "Proyección" label, listing the sample's active recurring charges at their expected amounts
- **AND** "Seguro", at 4 of 10, is listed in each of the six projected cycles

#### Scenario: A demo budget edit reaches the projection
- **WHEN** on `/demo` the visitor raises "comida" to 500 in the sample cycle and then opens the October projection
- **THEN** "comida" shows 500 € as its budget in October
