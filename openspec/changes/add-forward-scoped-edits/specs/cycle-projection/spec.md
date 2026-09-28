> Written over the `cycle-projection` delta of the open change `add-entries-in-projected-cycles` (itself over `add-cycle-projection-and-recurring-cron`). The requirements below replace those of the same name there.

## MODIFIED Requirements

### Requirement: A future cycle is computed, not stored

A cycle after the one in progress SHALL be a projection: its recurring figures SHALL be computed on every read from the user's recurring definitions, budget entries and savings target, and no movement row SHALL be written for it by reading it. The dashboard SHALL reach up to six cycles after the one in progress, and no further.

The projection of a cycle SHALL contain:

- **Recurring income**: one entry per active income definition, at its expected amount.
- **Recurring expenses**: one charge per active expense definition, at its expected amount, in the definition's category. A definition with a number of repetitions SHALL appear only while repetitions remain: counting cycles from the last cycle whose charges were generated (`recurring-charge-generation`), the n-th cycle after it SHALL include the definition only when the charges produced so far plus n do not exceed the total. An inactive definition SHALL NOT appear.
- **Categories**: the user's categories alive in that cycle (`category-editing` → *A category lives from its first cycle to its last*), and no other.
- **Budgets**: each category's entry for that cycle when the cycle holds any entry, otherwise the entries of the most recent earlier cycle that holds any — the same rule as the copy into a new current cycle (`category-editing` → *Budgets belong to one cycle*), without writing anything — for the categories alive in it.
- **Savings**: the user's savings target, or 0 when there is none, as the cycle's savings floor.

**Real rows in a projected cycle.** A projected cycle SHALL also hold every movement row of the user whose instant falls inside its range and that is not soft-deleted — expenses in their category, income entries in the income panel, savings movements in the savings panel — merged with the projection:

- A row linked to a recurring definition for that cycle (the definition's slot in that cycle) SHALL replace the projected charge of that definition, which SHALL NOT be listed. A soft-deleted linked row SHALL hold the slot too: that cycle SHALL list neither the row nor the projected charge. Every other projected charge SHALL be listed as before.
- A real row SHALL be shown and edited exactly as in the cycle in progress. A projected charge or income entry SHALL be opened, edited, swiped and deleted as a row of its definition (`recurring-expenses` → *Every change to a recurring row asks how far it reaches*); doing so SHALL write that cycle's slot.
- The cycle's savings SHALL be the larger of the savings floor and the sum of its real savings movements.
- **Free margin**: computed by the same rule as any other cycle (`category-editing` → *A budget reserves its amount in the free margin*), with each category's spending being the sum of its real rows and its projected charges, and savings as defined above.

Reading a projected cycle SHALL write nothing, whether or not it holds real rows. Entering a new row in a projected cycle SHALL write that row only: no budget entry, no link to a definition, and no change to the generation marker (`recurring-charge-generation`). Changing a projected charge SHALL write only what its scope requires (`recurring-expenses` → *A definition's slot in a cycle can be changed on its own*), and never the generation marker.

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

#### Scenario: A swiped projected charge stays gone
- **WHEN** the visitor swipes away the projected "Netflix" row in the November projection and reloads it
- **THEN** November lists no "Netflix" row and no projected "Netflix" charge, and its free margin no longer counts it
- **AND** the December projection still lists "Netflix"

### Requirement: What a projected cycle shows and allows

A projected cycle SHALL be rendered by the same dashboard as any other, with these differences:

- Under the title, a "Proyección" label (in the active language) SHALL replace the "in progress" label, before the date range.
- Every projected recurring charge SHALL be listed in its category's card and every projected income entry in the income panel, each as a pending row that opens the entry sheet and can be swiped, as a row of its definition (`recurring-expenses` → *Every change to a recurring row asks how far it reaches*).
- Every real row of the cycle SHALL be listed, edited, swiped and deleted exactly as in the cycle in progress (`expense-editing`, `income-editing`, `savings-editing`).
- The "add expense" row of every category card, the "add income" row and the "add savings movement" row SHALL be offered as in the cycle in progress. The entry sheet SHALL open with the cycle's first day as its date, SHALL limit the date to the cycle's range, and SHALL NOT offer the recurrence switch.
- A budgeted category SHALL show its budget amount and an empty bar, and no spent-of-budget figure, no amount left per week and no over-budget text, while it holds no real row; once it holds a real row, it SHALL show its progress as the cycle in progress does, with the projected charges counted as spending (`dashboard-ui` → *Budget progress on budgeted categories*).
- The "Próximos cobros" card SHALL list the projected charges, all pending, sorted by day; a row SHALL still open its definition's sheet. A real row that replaced a projected charge SHALL be listed there as the cycle in progress would list it.
- The monthly spend chart and the accumulated savings SHALL NOT be shown.
- The "Añadir categoría" tile SHALL be offered as in the cycle in progress; a category created there starts in that cycle (`category-creation` → *Category creation goes through an injected operation*). No reorder mode SHALL be offered.
- Only the categories alive in the cycle SHALL be listed.
- The category sheet SHALL open from a card and SHALL allow changing the budget of that cycle (`category-editing` → *A future cycle's budget asks how far it reaches*).

#### Scenario: Label and read-only charges
- **WHEN** the user, in Spanish, opens the November 2026 projection
- **THEN** the line under the title shows "Proyección" followed by the range 1–30 November, and no "en curso" label
- **AND** tapping the "Alquiler" row opens the entry sheet, and swiping it reveals the delete action
- **AND** the "Vivienda" card ends with an "Añadir gasto" row, and the "Añadir categoría" tile is shown

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
