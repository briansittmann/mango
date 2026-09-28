> Written over the `category-editing` delta of the open change `add-cycle-projection-and-recurring-cron`. The requirements below replace those of the same name there.

## MODIFIED Requirements

### Requirement: Category changes go through injected operations

The page that mounts the dashboard SHALL supply category changes as two operations. Every data source SHALL provide them with the same inputs and outcomes:

- **update:** replaces a category's name, colour and budget together, from one saved form, for the displayed cycle
- **delete:** removes a category from the displayed cycle on, or from every cycle, and moves its expenses and fixed charges to another category

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change categories only through these operations.

**Update:**
- The budget SHALL be either an amount above 0 or "no budget". "No budget" SHALL remove the category's budget, and an amount SHALL set or replace it.
- Update SHALL receive the displayed cycle and, when that cycle is a projection, the scope chosen in the sheet: "only this month" or "from this month on". The budget SHALL be written as *Budgets belong to one cycle* states for that cycle and scope; in the cycle in progress, or from a past cycle, only the current cycle's entry SHALL change, as before.
- When the displayed cycle is a projection and no scope is given (only the name or the colour changed), update SHALL change the name and colour only, and SHALL leave every budget entry of every cycle unchanged.
- Update SHALL NOT change any expense's amount, description, date or category, and SHALL NOT change any other category's name or colour.
- A name already used by another of the user's live categories SHALL be rejected, and that rejection SHALL be distinguishable by the caller from every other failure. A category that ended before the cycle in progress (*A category lives from its first cycle to its last*) SHALL NOT reserve its name.

**Delete:**
- Delete SHALL receive the displayed cycle and a scope: "from this month on" or "all months".
- **All months** SHALL move every expense of the category, in every cycle, and every recurring definition in it, to the category named in the call, leaving each expense's amount, description and date unchanged, and SHALL remove the category and its budgets in every cycle.
- **From this month on** SHALL end the category's lifetime at the cycle before the displayed one. It SHALL move the category's expenses of the displayed cycle and every later one, and every recurring definition in it, to the category named in the call, and SHALL remove its budget entries of those cycles. Its expenses and budget entries of earlier cycles SHALL stay in it. When the displayed cycle is the category's first cycle, "from this month on" SHALL behave as "all months".
- The receiving category's own budgets SHALL NOT change. It SHALL be alive in the displayed cycle.
- A category SHALL only be deleted without naming a receiving category when it holds, in the cycles the delete reaches, no expense and no recurring definition.

#### Scenario: Update recomputes every derived figure

- **WHEN** on `/demo` in Spanish the visitor renames "Comida" to "Comida y bebida", changes its colour to `blanco` and its budget to 600, and saves
- **THEN** the card header, the expenses summary row and the pie legend all read "Comida y bebida" with the new colour dot
- **AND** the card shows 310 € of 600 € with "Te quedan 96 € por semana"
- **AND** the expenses total shows 1.700 € and the free margin shows 664 €

#### Scenario: Same operations on another data source

- **WHEN** the dashboard is mounted with an implementation of the two operations that records its calls instead of the demo's
- **AND** the visitor saves a rename of "ocio", then deletes "hogar" onto "compras" for all months
- **THEN** the recorder receives update (the "ocio" category, its name, colour and budget, and the displayed cycle) and delete (the "hogar" category, the "compras" category, the displayed cycle and "all months"), in that order
- **AND** no dashboard component needed a change for that data source

#### Scenario: A failed operation changes nothing

- **WHEN** the injected update rejects
- **THEN** the category keeps its previous name, colour and budget in every place they are shown
- **AND** the expenses total and the free margin are unchanged

#### Scenario: An ended category frees its name

- **WHEN** "ocio" was deleted from October on, and in the October cycle in progress the visitor creates a category named "Ocio"
- **THEN** it is created, and the September cycle still shows the old "ocio" card with its expenses

### Requirement: Deleting a category

"Eliminar categoría" SHALL ask for confirmation before anything is deleted, as a step inside the same sheet.

The confirmation SHALL:
- name the category and state the scale of the consequence: how many expenses it holds in the displayed cycle and later ones, and how many fixed charges (recurring definitions) it holds
- ask how far the delete reaches, "Desde este mes en adelante" or "Todos los meses" (in the active language), as a single choice with neither preselected. When the displayed cycle is the category's first cycle, the choice SHALL NOT be shown and the delete SHALL reach every month. The line under "Desde este mes en adelante" SHALL state that earlier months keep the category and their expenses; the line under "Todos los meses" SHALL state how many expenses of earlier months it also moves.
- offer Cancel as the safe default, returning to the form with every edit intact
- never present the destructive action as the primary action of the sheet, and keep it disabled until a scope is chosen, when the choice is shown

**When the category holds expenses or fixed charges** in the cycles the chosen scope reaches, the confirmation SHALL require a receiving category before deleting:
- The receiving category SHALL be chosen from the user's other categories alive in the displayed cycle.
- A category named "Otros" SHALL be preselected when one exists. Otherwise nothing SHALL be preselected and the destructive action SHALL stay disabled until one is chosen.
- Confirming SHALL move every one of them to the chosen category, so that no expense is lost and the expenses total of every cycle does not change.

**When it holds none**, the confirmation SHALL NOT offer a receiving category.

A single expense SHALL also be movable before any delete, from its own sheet (`expense-editing` → *Moving an expense to another category*).

After a deletion the sheet SHALL close, the card SHALL disappear from the displayed cycle, and keyboard focus SHALL move to a control that still exists.

#### Scenario: Deleting a category moves its expenses

- **WHEN** on `/demo` in Spanish the visitor opens the sheet for "hogar" (95 €, two expenses), activates "Eliminar categoría", chooses "Todos los meses", chooses "Compras" as the receiving category and confirms
- **THEN** the confirmation named "Hogar" and said it holds two expenses this cycle
- **AND** the sheet closes, no "Hogar" card is listed, and the "compras" card shows 190 € of 180 € with "10 € por encima del presupuesto"
- **AND** the expenses total still shows 1.700 € and the free margin still shows 864 €

#### Scenario: Deleting from this month on keeps the past

- **WHEN** a user's "ocio" holds expenses in August and September, September is displayed, and the visitor deletes it with "Desde este mes en adelante" onto "compras"
- **THEN** September lists no "ocio" card and its "ocio" expenses are in "compras"
- **AND** August still lists the "ocio" card with its expenses and its budget, and August's expenses total is unchanged

#### Scenario: Fixed charges move with the category

- **WHEN** the visitor deletes "Salud", which holds the "Gimnasio" definition, from this month on onto "ocio"
- **THEN** the confirmation stated that it holds one fixed charge, and a receiving category was required
- **AND** "Gimnasio" is listed in "ocio" in this cycle and in every projection, and "Próximos cobros" still lists it

#### Scenario: The scope must be chosen

- **WHEN** the delete confirmation is shown for a category that started before the displayed cycle
- **THEN** "Desde este mes en adelante" and "Todos los meses" are offered, neither selected, and the destructive action is disabled until one is chosen

#### Scenario: No scope for a category that starts this month

- **WHEN** the visitor deletes a category created in the displayed cycle
- **THEN** no scope choice is shown, and confirming removes it from every cycle

#### Scenario: Cancel keeps the category and the edits

- **WHEN** the visitor types a new name for "hogar", activates "Eliminar categoría" and then cancels the confirmation
- **THEN** the sheet returns to the form with the typed name still in the field, and the "Hogar" card is unchanged

#### Scenario: A receiving category is required

- **WHEN** the delete confirmation is shown for "hogar" on `/demo`, where no category is named "Otros"
- **THEN** no receiving category is preselected and the destructive action is disabled after choosing a scope
- **AND** it becomes enabled once a receiving category is chosen

#### Scenario: An empty category is confirmed without a picker

- **WHEN** the visitor deletes the only expense of "salud", the category holding no fixed charge, and then opens the sheet for "salud", activates "Eliminar categoría" and chooses a scope
- **THEN** the confirmation is shown without any receiving-category picker
- **AND** confirming removes the card, leaving the expenses total at 1.660 € and the free margin at 904 €

#### Scenario: The destructive action is not the primary one

- **WHEN** the delete confirmation is shown
- **THEN** the confirming action is not styled as the sheet's primary action, and Cancel is reachable first by keyboard

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
  - A save from a projected cycle without a scope (a rename or colour change) SHALL write no budget entry and change none.
- **Creation** with a budget SHALL write the entry of the cycle the category starts in (*A category lives from its first cycle to its last*): in the cycle in progress, that cycle's entry only; in a projected cycle, as an edit "from this month on" does, writing first every entry that cycle inherits when it holds none. Creation without a budget SHALL write no entry.
- **Deletion** of a category for all months SHALL remove its entries in every cycle, so that no copy can bring them back. Deletion from a cycle on SHALL remove its entries of that cycle and every later one, and SHALL leave those of earlier cycles as they were.
- A cycle outside a category's lifetime SHALL show no budget for it, whatever entry it inherits.
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

#### Scenario: A rename from a projection leaves the budgets alone

- **WHEN** September holds "comida" 300 and "suplementos" 100, no later cycle holds entries, and the visitor renames "comida" from the December projection without changing its budget
- **THEN** no entry exists for any cycle after September, September still holds "comida" 300 and "suplementos" 100, and the December projection shows the new name with "comida" 300

#### Scenario: The demo's budgets come from the previous cycle

- **WHEN** `/demo` is rendered, with its sample holding "comida" 400, "ocio" 150 and "transporte" 100 for the cycle starting 1 August 2026 and no budget for the cycle starting 1 September 2026
- **THEN** the September cards show "comida" of 400 €, "ocio" of 150 € and "transporte" of 100 €, and no other card has a bar

#### Scenario: A category created in a projection starts its budget there

- **WHEN** September holds "comida" 300 and no later cycle holds entries, and the visitor creates "Viajes" with a budget of 200 from the December projection
- **THEN** December holds "comida" 300 and "Viajes" 200, and no entry exists for October or November
- **AND** the January projection shows "Viajes" with 200 €, and September, October and November list no "Viajes" card

#### Scenario: Deleting from a month on keeps earlier budgets

- **WHEN** September and October hold "ocio" 150 and the visitor deletes "ocio" from October with "Desde este mes en adelante"
- **THEN** September still holds "ocio" 150, and no "ocio" entry exists for October or later

## ADDED Requirements

### Requirement: A category lives from its first cycle to its last

Every category SHALL have a lifetime: a first cycle and, once deleted from a cycle on, a last cycle. A category with no first cycle SHALL have existed since always; one with no last cycle SHALL not have ended.

- A category SHALL be shown in a cycle — card, expenses summary, pie chart, reorder list, receiving-category and category pickers — only when the cycle is inside its lifetime.
- Its expenses of cycles inside its lifetime SHALL stay in it; no data source SHALL let an expense of a cycle outside its lifetime be in it.
- The bot SHALL match a category by name only among categories alive in the cycle in progress.
- Past cycles SHALL be shown with the categories alive in them, including ones ended since.

#### Scenario: A category created in a projection is not in earlier months
- **WHEN** September is in progress and the visitor creates "Viajes" from the December projection
- **THEN** September, October and November show no "Viajes" card, and December and every later projection show it

#### Scenario: An ended category is gone from the month it ended on
- **WHEN** "ocio" is deleted from October on
- **THEN** October and every later cycle show no "ocio" card and offer it in no picker, and September still shows it

#### Scenario: The bot ignores an ended category
- **WHEN** "ocio" ended in September and the user sends "cine 12 ocio" in October
- **THEN** the expense is not filed in the ended "ocio"
