> Written over the `cycle-projection` delta of the open change `add-cycle-projection-and-recurring-cron`, not yet synced to `openspec/specs/`. The requirements below replace those of the same name there.

## MODIFIED Requirements

### Requirement: A future cycle is computed, not stored

A cycle after the one in progress SHALL be a projection: its recurring figures SHALL be computed on every read from the user's recurring definitions, budget entries and savings target, and no movement row SHALL be written for it by reading it. The dashboard SHALL reach up to six cycles after the one in progress, and no further.

The projection of a cycle SHALL contain:

- **Recurring income**: one entry per active income definition, at its expected amount.
- **Recurring expenses**: one charge per active expense definition, at its expected amount, in the definition's category. A definition with a number of repetitions SHALL appear only while repetitions remain: counting cycles from the last cycle whose charges were generated (`recurring-charge-generation`), the n-th cycle after it SHALL include the definition only when the charges produced so far plus n do not exceed the total. An inactive definition SHALL NOT appear.
- **Budgets**: each category's entry for that cycle when the cycle holds any entry, otherwise the entries of the most recent earlier cycle that holds any — the same rule as the copy into a new current cycle (`category-editing` → *Budgets belong to one cycle*), without writing anything.
- **Savings**: the user's savings target, or 0 when there is none, as the cycle's savings floor.

**Real rows in a projected cycle.** A projected cycle SHALL also hold every movement row of the user whose instant falls inside its range and that is not soft-deleted — expenses in their category, income entries in the income panel, savings movements in the savings panel — merged with the projection:

- A real row linked to a recurring definition for that cycle (the definition's slot in that cycle) SHALL replace the projected charge of that definition, which SHALL NOT be listed. Every other projected charge SHALL be listed as before.
- A real row SHALL be shown and edited exactly as in the cycle in progress; a projected charge SHALL stay read-only.
- The cycle's savings SHALL be the larger of the savings floor and the sum of its real savings movements.
- **Free margin**: computed by the same rule as any other cycle (`category-editing` → *A budget reserves its amount in the free margin*), with each category's spending being the sum of its real rows and its projected charges, and savings as defined above.

Reading a projected cycle SHALL write nothing, whether or not it holds real rows. Entering a row in a projected cycle SHALL write that row only: no budget entry, no link to a definition, and no change to the generation marker (`recurring-charge-generation`).

The same computation SHALL decide which charges are inserted when the cycle starts (`recurring-charge-generation`), so a projected cycle lists exactly the charges, amounts and dates that will be inserted for it, as long as no definition, budget or target changes in between. A real row entered in the cycle SHALL still be there after the charges are inserted, and a definition whose slot in that cycle is already held by a real row SHALL NOT be inserted again.

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

#### Scenario: A real expense joins the projection
- **WHEN** the same projected cycle holds a real expense of 250 in "Comida" and one of 30 in "Suplementos", entered by the user
- **THEN** "Comida" lists the 250 row and counts 250 of its 300 budget, "Suplementos" lists its projected charge of 90 and the 30 row and counts 120 of 100
- **AND** the free margin is 2 580 (4 000 − 1 000 − 120 − 300)

#### Scenario: A real income entry and a savings movement join the projection
- **WHEN** a projected cycle holds recurring income of 4 000, no charge, no budget, a savings target of 200, a real income entry of 500 and a real savings deposit of 50
- **THEN** its income is 4 500, its savings 200 (the floor, larger than 50) and its free margin 4 300
- **AND** with a deposit of 350 instead, its savings are 350 and its free margin 4 150

#### Scenario: A linked row replaces its projected charge
- **WHEN** a projected cycle holds a real row linked to the "Luz" definition for that cycle, at 95 €, and "Luz" projects 90 €
- **THEN** the cycle lists one "Luz" row, at 95 €, and no second "Luz" charge

#### Scenario: Reading a projection writes nothing
- **WHEN** the user opens the cycle three months ahead, which holds two real rows, and reloads it
- **THEN** no new movement row, no budget entry and no link to a definition exists for that cycle afterwards, and the generation marker is unchanged

#### Scenario: Beyond the horizon
- **WHEN** September 2026 is in progress and the user opens `/dashboard?mes=2027-06`
- **THEN** the March 2027 cycle, the sixth after September, is shown as a projection

### Requirement: What a projected cycle shows and allows

A projected cycle SHALL be rendered by the same dashboard as any other, with these differences:

- Under the title, a "Proyección" label (in the active language) SHALL replace the "in progress" label, before the date range.
- Every projected recurring charge SHALL be listed in its category's card and every projected income entry in the income panel, each as a pending row that cannot be edited, swiped or deleted.
- Every real row of the cycle SHALL be listed, edited, swiped and deleted exactly as in the cycle in progress (`expense-editing`, `income-editing`, `savings-editing`).
- The "add expense" row of every category card, the "add income" row and the "add savings movement" row SHALL be offered as in the cycle in progress. The entry sheet SHALL open with the cycle's first day as its date, SHALL limit the date to the cycle's range, and SHALL NOT offer the recurrence switch.
- A budgeted category SHALL show its budget amount and an empty bar, and no spent-of-budget figure, no amount left per week and no over-budget text, while it holds no real row; once it holds a real row, it SHALL show its progress as the cycle in progress does, with the projected charges counted as spending (`dashboard-ui` → *Budget progress on budgeted categories*).
- The "Próximos cobros" card SHALL list the projected charges, all pending, sorted by day; a row SHALL still open its definition's sheet. A real row that replaced a projected charge SHALL be listed there as the cycle in progress would list it.
- The monthly spend chart and the accumulated savings SHALL NOT be shown.
- No control to add a category and no reorder mode SHALL be offered.
- The category sheet SHALL open from a card and SHALL allow changing the budget of that cycle (`category-editing` → *A future cycle's budget asks how far it reaches*).

#### Scenario: Label and read-only charges
- **WHEN** the user, in Spanish, opens the November 2026 projection
- **THEN** the line under the title shows "Proyección" followed by the range 1–30 November, and no "en curso" label
- **AND** swiping the "Alquiler" row reveals no delete action and tapping it opens no sheet
- **AND** the "Vivienda" card ends with an "Añadir gasto" row, and no "Añadir categoría" tile is shown

#### Scenario: An entry sheet in a projection
- **WHEN** on the November projection the user activates "Añadir gasto" in "Comida"
- **THEN** the sheet opens in create mode with the date 1 November 2026, 31 October and 1 December cannot be selected, and no recurrence switch is shown

#### Scenario: Budget bar in a projection
- **WHEN** "Comida" has a budget of 300 in the November projection and no real row
- **THEN** its card shows 300 € as its budget with an empty bar, and no "por semana", "de 300 €" or "por encima" text
- **AND** after the user adds 120 € to "Comida", the card shows 120 € of 300 € and a bar at 40 %

#### Scenario: Upcoming charges in a projection
- **WHEN** the November projection is shown
- **THEN** "Próximos cobros" lists every projected charge as pending, in day order, and its footer total equals their sum
- **AND** an expense the user entered in "Comida" is not listed there

### Requirement: The demo projects too

`/demo` SHALL offer the same projection after its sample cycle, computed in memory from its own recurring definitions, budget entries and savings target by the same computation, with its sample cycle as the last generated one. Its next-cycle control and month picker SHALL reach six cycles after the sample cycle. Its previous-cycle control SHALL keep its current behaviour. The demo SHALL still make no request to a Supabase host.

An expense, income entry or savings movement the visitor enters on `/demo` SHALL belong to the cycle its date falls in, in memory, and SHALL be merged into that cycle exactly as the real data source merges real rows into a projection: it SHALL be listed, counted and editable in that cycle only, and SHALL NOT appear in the sample cycle or in any other projection.

#### Scenario: Demo projection
- **WHEN** on `/demo` the visitor activates the next-cycle control
- **THEN** the October 2026 projection of the sample is shown with the "Proyección" label, listing the sample's active recurring charges at their expected amounts
- **AND** "Seguro", at 4 of 10, is listed in each of the six projected cycles

#### Scenario: A demo budget edit reaches the projection
- **WHEN** on `/demo` the visitor raises "comida" to 500 in the sample cycle and then opens the October projection
- **THEN** "comida" shows 500 € as its budget in October

#### Scenario: A demo entry stays in its projected cycle
- **WHEN** on `/demo` in Spanish the visitor opens the October 2026 projection (free margin 475 €) and adds 20 € described as "Ferretería" to "hogar"
- **THEN** October lists "Ferretería" in "hogar" with 20 €, the card shows 55 € and the free margin shows 455 €
- **AND** the September sample does not list "Ferretería", its "hogar" card still shows 95 € and its free margin 864 €
- **AND** the November projection does not list "Ferretería" and its free margin is 475 €
