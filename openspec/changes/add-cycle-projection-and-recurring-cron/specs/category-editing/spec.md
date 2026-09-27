## MODIFIED Requirements

### Requirement: Category changes go through injected operations

The page that mounts the dashboard SHALL supply category changes as two operations. Every data source SHALL provide them with the same inputs and outcomes:

- **update:** replaces a category's name, colour and budget together, from one saved form, for the displayed cycle
- **delete:** removes a category and moves its expenses to another category

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change categories only through these operations.

**Update:**
- The budget SHALL be either an amount above 0 or "no budget". "No budget" SHALL remove the category's budget, and an amount SHALL set or replace it.
- Update SHALL receive the displayed cycle and, when that cycle is a projection, the scope chosen in the sheet: "only this month" or "from this month on". The budget SHALL be written as *Budgets belong to one cycle* states for that cycle and scope; in the cycle in progress, or from a past cycle, only the current cycle's entry SHALL change, as before.
- Update SHALL NOT change any expense's amount, description, date or category, and SHALL NOT change any other category's name or colour.
- A name already used by another of the user's categories SHALL be rejected, and that rejection SHALL be distinguishable by the caller from every other failure.

**Delete:**
- Delete SHALL move every expense of the category to the category named in the call, in every cycle and not only the displayed one, leaving each expense's amount, description and date unchanged.
- Delete SHALL remove the category's budgets with it, in every cycle. The receiving category's own budgets SHALL NOT change.
- A category SHALL only be deleted without naming a receiving category when it has no expenses in any cycle.

#### Scenario: Update recomputes every derived figure

- **WHEN** on `/demo` in Spanish the visitor renames "Comida" to "Comida y bebida", changes its colour to `blanco` and its budget to 600, and saves
- **THEN** the card header, the expenses summary row and the pie legend all read "Comida y bebida" with the new colour dot
- **AND** the card shows 310 € of 600 € with "Te quedan 96 € por semana"
- **AND** the expenses total shows 1.700 € and the free margin shows 664 €

#### Scenario: Same operations on another data source

- **WHEN** the dashboard is mounted with an implementation of the two operations that records its calls instead of the demo's
- **AND** the visitor saves a rename of "ocio", then deletes "hogar" onto "compras"
- **THEN** the recorder receives update (the "ocio" category, its name, colour and budget, and the displayed cycle) and delete (the "hogar" category, the "compras" category), in that order
- **AND** no dashboard component needed a change for that data source

#### Scenario: A failed operation changes nothing

- **WHEN** the injected update rejects
- **THEN** the category keeps its previous name, colour and budget in every place they are shown
- **AND** the expenses total and the free margin are unchanged

### Requirement: Budgets belong to one cycle

Each budget entry SHALL belong to exactly one category and one billing cycle. The cycle SHALL be identified by its first day, computed from the user's cycle start day, not by the calendar month: for a cycle start day of 26, the cycle ending in September starts on 26 August. A category SHALL have at most one entry per cycle. An entry SHALL hold either an amount above 0 (a budget) or an explicit "no budget in this cycle".

Every data source SHALL apply these rules:

- **Copy into a new current cycle.** When a cycle becomes the current cycle and holds no entry for any category, every entry of the most recent earlier cycle that holds any SHALL be copied into it before any figure is computed: the same categories, the same amounts, and "no budget" entries as "no budget". A cycle that already holds at least one entry, "no budget" entries included, SHALL NOT receive a copy, so reading it again never brings back a cleared budget. An earlier cycle SHALL never receive a copy.
- **A projected cycle inherits without writing.** A cycle after the current one SHALL be read with its own entries when it holds any, and otherwise with those of the most recent earlier cycle that holds any. Reading it SHALL write nothing.
- **Edits in the current cycle.** Setting or changing a budget in the current cycle SHALL write the current cycle's entry for that category as that amount. Clearing it SHALL write the current cycle's entry as "no budget" rather than remove it. Entries of earlier cycles SHALL NOT change. Later cycles without entries of their own SHALL inherit the new amount, or the "no budget", through the copy.
- **Edits in a projected cycle.** Before a budget of a projected cycle is written, if that cycle holds no entry, every entry it inherits SHALL be written into it, so that the edited category is not the only one with an entry there. Then:
  - "from this month on" SHALL write that cycle's entry for the category; later cycles without entries of their own inherit it.
  - "only this month" SHALL also, when the following cycle holds no entry, write every entry the following cycle would have inherited before the edit, so the change does not carry over.
  - Entries of the current cycle, of earlier cycles and of later cycles that already hold entries SHALL NOT change.
- **Creation** with a budget SHALL write the current cycle's entry only. Creation without a budget SHALL write no entry.
- **Deletion** of a category SHALL remove its entries in every cycle, so that no copy can bring them back.
- A category whose entry in a cycle is "no budget", or that has no entry there after the copy or the inheritance, SHALL be a category without a budget in that cycle: no bar on its card, and its spending lowers the free margin directly.
- An earlier cycle SHALL be displayed with its own entries, never with the current cycle's.

#### Scenario: A new current cycle copies the previous budgets

- **WHEN** the current cycle starts on 26 September 2026 and holds no budget, and the cycle starting on 26 August 2026 holds "comida" 400 and "ocio" 150
- **THEN** the current cycle holds "comida" 400 and "ocio" 150 before its figures are computed
- **AND** the August cycle still holds exactly "comida" 400 and "ocio" 150

#### Scenario: The copy comes from the most recent cycle that has budgets

- **WHEN** the current cycle holds no budget, the previous cycle holds none either, and the one before it holds "comida" 380
- **THEN** the current cycle holds "comida" 380

#### Scenario: A cycle that already has a budget is left alone

- **WHEN** the current cycle holds only "ocio" 150 and the previous cycle holds "comida" 400 and "ocio" 150
- **THEN** no copy is made, and "comida" has no budget in the current cycle

#### Scenario: Editing a budget leaves earlier cycles alone

- **WHEN** the previous cycle holds "comida" 400 and the visitor raises "comida" to 600 in the current cycle
- **THEN** the current cycle holds "comida" 600 and the previous cycle still holds "comida" 400
- **AND** when the next cycle becomes current with no budget, it holds "comida" 600

#### Scenario: A cleared budget stays cleared

- **WHEN** the current cycle holds "comida" 400 and "ocio" 150, and the visitor clears both budgets
- **THEN** the current cycle holds "no budget" for "comida" and for "ocio", and reading it again copies nothing into it
- **AND** when the next cycle becomes current with no entry, it holds "no budget" for both, and neither card shows a bar

#### Scenario: Nothing is created for a future cycle

- **WHEN** the current cycle is September and holds "comida" 300 and "suplementos" 100, and the budgets of the November projection are read
- **THEN** November shows "comida" 300 and "suplementos" 100, and no entry exists for any cycle after September

#### Scenario: Only this month

- **WHEN** September holds "comida" 300 and "suplementos" 100, no later cycle holds entries, and the visitor sets "comida" to 500 in the December projection choosing "only this month"
- **THEN** December holds "comida" 500 and "suplementos" 100, January holds "comida" 300 and "suplementos" 100, and September, October and November are unchanged
- **AND** the October and November projections show "comida" 300, and February shows "comida" 300

#### Scenario: From this month on

- **WHEN** the same starting point, and the visitor sets "comida" to 500 in the December projection choosing "from this month on"
- **THEN** December holds "comida" 500 and "suplementos" 100, and no entry is written for January
- **AND** the January to March projections show "comida" 500, and the October and November projections show "comida" 300

#### Scenario: A materialised cycle keeps its entries

- **WHEN** December holds its own entries after an edit, and the visitor then raises "comida" to 350 in the current cycle
- **THEN** the October and November projections show "comida" 350, and December still shows its own "comida" entry

#### Scenario: The demo's budgets come from the previous cycle

- **WHEN** `/demo` is rendered, with its sample holding "comida" 400, "ocio" 150 and "transporte" 100 for the cycle starting 1 August 2026 and no budget for the cycle starting 1 September 2026
- **THEN** the September cards show "comida" of 400 €, "ocio" of 150 € and "transporte" of 100 €, and no other card has a bar

## ADDED Requirements

### Requirement: A future cycle's budget asks how far it reaches

When the category sheet is opened from a projected cycle and its budget field differs from the value it opened with, the sheet SHALL ask, before saving, whether the change applies "solo este mes" or "desde este mes en adelante" (in the active language), as a single choice with neither option preselected. Saving SHALL be unavailable until one is chosen. The choice SHALL NOT be shown when only the name or the colour changed, nor in the cycle in progress or a past cycle. The chosen scope SHALL be passed to the update operation with the displayed cycle.

#### Scenario: The question appears only for a budget change in a projection
- **WHEN** the visitor opens "comida" in the December projection and changes its budget from 300 to 500
- **THEN** the sheet shows "Solo este mes" and "Desde este mes en adelante", neither selected, and the save control is unavailable
- **AND** after choosing "Solo este mes" the save control becomes available

#### Scenario: No question in the cycle in progress
- **WHEN** the visitor opens "comida" in the cycle in progress and changes its budget
- **THEN** no scope choice is shown, and saving writes the current cycle's entry

#### Scenario: No question for a rename
- **WHEN** the visitor opens "comida" in the December projection and only renames it
- **THEN** no scope choice is shown
