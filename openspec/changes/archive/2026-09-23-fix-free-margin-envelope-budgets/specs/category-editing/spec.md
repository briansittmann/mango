## MODIFIED Requirements

### Requirement: Category changes go through injected operations

The page that mounts the dashboard SHALL supply category changes as two operations. Every data source SHALL provide them with the same inputs and outcomes:

- **update:** replaces a category's name, colour and budget together, from one saved form
- **delete:** removes a category and moves its expenses to another category

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change categories only through these operations.

**Update:**
- The budget SHALL be either an amount above 0 or "no budget". "No budget" SHALL remove the category's budget, and an amount SHALL set or replace it. Either way, only the current cycle's entry SHALL change (*Budgets belong to one cycle*).
- Update SHALL NOT change any expense's amount, description, date or category, and SHALL NOT change any other category.
- A name already used by another of the user's categories SHALL be rejected, and that rejection SHALL be distinguishable by the caller from every other failure.

**Delete:**
- Delete SHALL move every expense of the category to the category named in the call, in every cycle and not only the displayed one, leaving each expense's amount, description and date unchanged.
- Delete SHALL remove the category's budgets with it, in every cycle. The receiving category's own budgets SHALL NOT change.
- A category SHALL only be deleted without naming a receiving category when it has no expenses in any cycle.

#### Scenario: Update recomputes every derived figure

- **WHEN** on `/demo` in Spanish the visitor renames "Comida" to "Comida y bebida", changes its colour to `blanco` and its budget to 600, and saves
- **THEN** the card header, the expenses summary row and the pie legend all read "Comida y bebida" with the new colour dot
- **AND** the card shows 310 € of 600 € with "Te quedan 96 € por semana"
- **AND** the expenses total shows 1.700 € and the free margin shows 644 €

#### Scenario: Same operations on another data source

- **WHEN** the dashboard is mounted with an implementation of the two operations that records its calls instead of the demo's
- **AND** the visitor saves a rename of "ocio", then deletes "hogar" onto "compras"
- **THEN** the recorder receives update (the "ocio" category, its name, colour and budget) and delete (the "hogar" category, the "compras" category), in that order
- **AND** no dashboard component needed a change for that data source

#### Scenario: A failed operation changes nothing

- **WHEN** the injected update rejects
- **THEN** the category keeps its previous name, colour and budget in every place they are shown
- **AND** the expenses total and the free margin are unchanged

### Requirement: Deleting a category

"Eliminar categoría" SHALL ask for confirmation before anything is deleted, as a step inside the same sheet.

The confirmation SHALL:
- name the category and state the scale of the consequence, including how many expenses it holds in the displayed cycle
- offer Cancel as the safe default, returning to the form with every edit intact
- never present the destructive action as the primary action of the sheet

**When the category holds expenses**, the confirmation SHALL require a receiving category before deleting:
- The receiving category SHALL be chosen from the user's other categories.
- A category named "Otros" SHALL be preselected when one exists. Otherwise nothing SHALL be preselected and the destructive action SHALL stay disabled until one is chosen.
- Confirming SHALL move every expense of the deleted category to the chosen one, so that no expense is lost and the expenses total does not change.

**When the category holds no expenses**, the confirmation SHALL NOT offer a receiving category.

After a deletion the sheet SHALL close, the card SHALL disappear from the dashboard, and keyboard focus SHALL move to a control that still exists.

#### Scenario: Deleting a category moves its expenses

- **WHEN** on `/demo` in Spanish the visitor opens the sheet for "hogar" (95 €, two expenses), activates "Eliminar categoría", chooses "Compras" as the receiving category and confirms
- **THEN** the confirmation named "Hogar" and said it holds two expenses this cycle
- **AND** the sheet closes, no "Hogar" card is listed, and the "compras" card shows 190 € of 180 € with "10 € por encima del presupuesto"
- **AND** the expenses total still shows 1.700 € and the free margin still shows 844 €

#### Scenario: Cancel keeps the category and the edits

- **WHEN** the visitor types a new name for "hogar", activates "Eliminar categoría" and then cancels the confirmation
- **THEN** the sheet returns to the form with the typed name still in the field, and the "Hogar" card is unchanged

#### Scenario: A receiving category is required

- **WHEN** the delete confirmation is shown for "hogar" on `/demo`, where no category is named "Otros"
- **THEN** no receiving category is preselected and the destructive action is disabled
- **AND** it becomes enabled once a receiving category is chosen

#### Scenario: An empty category is confirmed without a picker

- **WHEN** the visitor deletes the only expense of "salud" and then opens the sheet for "salud" and activates "Eliminar categoría"
- **THEN** the confirmation is shown without any receiving-category picker
- **AND** confirming removes the card, leaving the expenses total at 1.660 € and the free margin at 884 €

#### Scenario: The destructive action is not the primary one

- **WHEN** the delete confirmation is shown
- **THEN** the confirming action is not styled as the sheet's primary action, and Cancel is reachable first by keyboard

## ADDED Requirements

### Requirement: A budget reserves its amount in the free margin

A budget SHALL drive what is shown for its own category: the progress bar and its colour, the "spent of budget" header figure, the remaining and weekly available text, and the pace answer. In all of them, **spent** SHALL be the sum of the category's non-deleted expenses in the cycle that are not recurring charges. A recurring charge SHALL stay listed in its category's card and SHALL count in the card's total in the expenses panel and the pie chart, but SHALL NOT count against the budget.

The free margin SHALL be derived every time it is shown and SHALL NOT be stored. It SHALL equal:

income − savings − fixed expenses − Σ over budgeted categories of max(budget, spent) − Σ over categories without a budget of spent

where:
- **income** is the sum of the cycle's non-deleted income entries
- **savings** is the signed sum of the cycle's savings movements
- **fixed expenses** is the sum of every non-deleted recurring charge in the cycle, pending or charged, whatever its category
- **budget** is the category's budget for the displayed cycle (*Budgets belong to one cycle*), and **spent** is as above

Every definition of the free margin in another capability SHALL refer to this one. Consequently:

- A budget SHALL reserve its whole amount from the first day of the cycle, whether or not any of it has been spent.
- Spending within a budget SHALL NOT change the free margin.
- Spending past a budget SHALL lower the free margin by exactly the amount beyond the budget.
- The maximum SHALL be taken per category. Money left in one category's budget SHALL NOT offset spending past another's.
- Raising or lowering a budget SHALL move the free margin by exactly the change in max(budget, spent) for that category: a raise reserves the part of the new amount above both the old amount and what is spent, and a lowering releases money only down to what is spent.
- Clearing a budget SHALL turn the category into one without a budget, whose spending then lowers the free margin directly.
- A recurring charge SHALL count exactly once, as a fixed expense, whether or not its category has a budget.

Setting a budget SHALL make the progress bar appear on that category's card; clearing it SHALL leave the plain total and no bar.

Unused budget SHALL stay reserved until the cycle ends. It SHALL NOT flow back into the free margin during the cycle, and at the end of the cycle it SHALL NOT be carried to the next one, swept into savings, or stored anywhere. A finished cycle SHALL keep showing what was spent against the budget it had.

#### Scenario: A budget is reserved from the start

- **WHEN** `/demo` is rendered in Spanish, with income 2.820 €, savings 146 €, recurring charges of 1.025 €, "comida" 310 € of 400 €, "ocio" 130 € of 150 €, "transporte" 80 € of 100 €, and 155 € spent outside recurring charges in categories without a budget
- **THEN** the free margin shows 844 €

#### Scenario: Spending within a budget leaves the free margin alone

- **WHEN** on `/demo` in Spanish the visitor adds an expense of 20 € to "comida"
- **THEN** the card shows 330 € of 400 € and the free margin still shows 844 €
- **AND** the expenses total shows 1.720 €

#### Scenario: Spending over budget costs only the excess

- **WHEN** on `/demo` in Spanish the visitor adds an expense of 30 € to "transporte", which shows 80 € of 100 €
- **THEN** the card shows 110 € of 100 € and the free margin shows 834 €
- **AND** in a separate run, clearing "transporte"'s budget first shows the free margin at 864 €, and adding the same 30 € then leaves it at 834 €

#### Scenario: One budget's leftover does not cover another's excess

- **WHEN** on `/demo` in Spanish, with "comida" 90 € under its budget, the visitor adds an expense of 30 € to "transporte"
- **THEN** the free margin shows 834 €, not 844 €

#### Scenario: Raising a budget reserves the raise

- **WHEN** on `/demo` in Spanish, with the free margin at 844 €, the visitor changes "comida" from 400 to 600 and saves
- **THEN** the "comida" card shows 310 € of 600 € with a bar below the warning threshold
- **AND** the free margin shows 644 € and the expenses total still shows 1.700 €

#### Scenario: Lowering a budget releases down to what is spent

- **WHEN** the visitor changes "comida" from 400 to 350 and saves
- **THEN** the free margin shows 894 €
- **AND** in a separate run, changing it from 400 to 200 shows 310 € of 200 €, a full bar in the danger colour, "110 € por encima del presupuesto", and a free margin of 934 €

#### Scenario: Clearing a budget counts what was spent

- **WHEN** the visitor clears the budget field for "comida" and saves
- **THEN** the card header shows 310 € as a plain total, and no progress bar or remaining text is shown on it
- **AND** the free margin shows 934 € and the expenses total still shows 1.700 €

#### Scenario: Setting a budget brings the bar back

- **WHEN** the visitor then sets "comida" back to 400 and saves
- **THEN** the card shows 310 € of 400 € with "Te quedan 30 € por semana"
- **AND** the free margin shows 844 €

#### Scenario: A recurring charge counts once, outside the budget

- **WHEN** `/demo` is rendered in Spanish
- **THEN** the "transporte" card shows 80 € of 100 € and still lists "Parking" (50 €), and the expenses panel lists "transporte" with 130 €
- **AND** after the visitor deletes "Parking", the card still shows 80 € of 100 € and the free margin shows 894 €

#### Scenario: A finished cycle keeps its figures

- **WHEN** a cycle that has ended is displayed for a category that spent 310 € of a 400 € budget
- **THEN** the card still shows 310 € of 400 €
- **AND** no leftover budget appears in the next cycle's free margin, savings or any other figure

### Requirement: Budgets belong to one cycle

Each budget entry SHALL belong to exactly one category and one billing cycle. The cycle SHALL be identified by its first day, computed from the user's cycle start day, not by the calendar month: for a cycle start day of 26, the cycle ending in September starts on 26 August. A category SHALL have at most one entry per cycle. An entry SHALL hold either an amount above 0 (a budget) or an explicit "no budget in this cycle".

Every data source SHALL apply these rules:

- **Copy into a new current cycle.** When a cycle becomes the current cycle and holds no entry for any category, every entry of the most recent earlier cycle that holds any SHALL be copied into it before any figure is computed: the same categories, the same amounts, and "no budget" entries as "no budget". A cycle that already holds at least one entry, "no budget" entries included, SHALL NOT receive a copy, so reading it again never brings back a cleared budget. An earlier cycle SHALL never receive a copy.
- **No future cycles.** No entry SHALL ever be created for a cycle after the current one, by the copy or by any operation.
- **Edits stay in the current cycle.** Setting or changing a budget SHALL write the current cycle's entry for that category as that amount. Clearing it SHALL write the current cycle's entry as "no budget" rather than remove it. Entries of earlier cycles SHALL NOT change. Later cycles SHALL inherit the new amount, or the "no budget", through the copy.
- **Creation** with a budget SHALL write the current cycle's entry only. Creation without a budget SHALL write no entry.
- **Deletion** of a category SHALL remove its entries in every cycle, so that no copy can bring them back.
- A category whose entry in a cycle is "no budget", or that has no entry there after the copy, SHALL be a category without a budget in that cycle: no bar on its card, and its spending lowers the free margin directly.
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

- **WHEN** the budgets are read for the current cycle and for the cycle after it
- **THEN** budgets exist for the current cycle and earlier ones only, and the later cycle holds none

#### Scenario: The demo's budgets come from the previous cycle

- **WHEN** `/demo` is rendered, with its sample holding "comida" 400, "ocio" 150 and "transporte" 100 for the cycle starting 1 August 2026 and no budget for the cycle starting 1 September 2026
- **THEN** the September cards show "comida" of 400 €, "ocio" of 150 € and "transporte" of 100 €, and no other card has a bar

## REMOVED Requirements

### Requirement: A budget tracks spending and never reserves money
**Reason**: Budgets become envelopes. A budget now reserves its whole amount in the free margin from the first day of the cycle, which inverts every rule of this requirement.
**Migration**: Replaced by *A budget reserves its amount in the free margin*, which also becomes the one definition of the free margin that the other capabilities refer to. Budgets per cycle are covered by *Budgets belong to one cycle*.
