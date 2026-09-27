## MODIFIED Requirements

### Requirement: Figures are scoped to one billing cycle in the user's timezone
The dashboard SHALL show one billing cycle at a time. The cycle SHALL be the range that starts on the user's cycle start day, computed on the user's timezone by the same rule the database's cycle function uses, and SHALL be named after the calendar month in which it ends. By default the cycle SHALL be the one containing now. `/dashboard?mes=YYYY-MM` SHALL show the cycle named by that month; a value that is not a month SHALL fall back to the default, and a month more than six cycles after the cycle in progress SHALL show the sixth. A cycle after the one in progress SHALL be shown as a projection (`cycle-projection`), marked as such in the data the dashboard receives. "Today" SHALL be the user's local date, clamped into the cycle: for a past cycle its last day, for a projected cycle its first day. The previous and next controls SHALL move one cycle at a time; the next control SHALL be disabled while the sixth cycle after the one in progress is shown. A row SHALL belong to the cycle whose range contains its instant. Soft-deleted rows SHALL count nowhere.

#### Scenario: Cycle starting on the 26th
- **WHEN** the user's cycle starts on the 26th, the timezone is Europe/Dublin, and today is 22 September 2026
- **THEN** the dashboard shows the cycle from 26 August to 25 September 2026, titled September, marked in progress, with 22 September as today

#### Scenario: Row at the boundary
- **WHEN** the user has an expense at 23:30 on 25 September Dublin time and another at 00:30 on 26 September Dublin time
- **THEN** the first counts in the September cycle and the second in the October cycle

#### Scenario: Past cycle
- **WHEN** the same user opens `/dashboard?mes=2026-08`
- **THEN** the cycle from 26 July to 25 August is shown, not in progress, with only its own rows and totals, its own budget rows computed as at its last day, every recurring charge in it shown as taken, and the next control offered

#### Scenario: Invalid month
- **WHEN** the user opens `/dashboard?mes=abc`
- **THEN** the cycle containing today is shown

#### Scenario: Future month
- **WHEN** today is 22 September 2026 and the user opens `/dashboard?mes=2026-11`
- **THEN** the November cycle is shown as a projection, and no movement row or budget entry is created for it

#### Scenario: Last reachable cycle
- **WHEN** the cycle in progress is September 2026 and the user opens `/dashboard?mes=2027-03`
- **THEN** the March 2027 projection is shown and the next control is disabled

### Requirement: Categories, budgets and recurring charges
The dashboard SHALL be supplied with one group per category of the user, in the user's stored order, including categories with no expense in the cycle (total 0, no rows). A category's budget SHALL come from its budget row for the shown cycle, following `category-editing` → *Budgets belong to one cycle*:
- when the shown cycle is the one in progress and holds no budget row, the rows of the most recent earlier cycle that has any SHALL be copied into it before anything is read, and never again for that cycle
- a row marked "no budget", or no row, means the category has no budget in that cycle
- a past cycle SHALL show its own rows
- a projected cycle SHALL show its own rows when it holds any, and otherwise those of the most recent earlier cycle that holds any, without writing them

Its progress SHALL be computed from the category's total spending in the cycle, recurring charges included, today, and the cycle's length. Each expense row SHALL carry its description, amount and instant. A row produced by a recurring definition SHALL carry the definition's id, the definition's day of the month, and whether it is already taken: taken when the row is confirmed (`recurring-charge-generation` → *A movement is pending or confirmed*) or when its local date is not after today; pending otherwise. A pending row whose day has passed SHALL be shown as taken and SHALL still be completed, not duplicated, by a charge entered for its definition. Every recurring definition SHALL have a day of the month; the database SHALL reject a definition without one. The dashboard SHALL be supplied with every recurring definition of the user, stopped ones included.

#### Scenario: Empty category
- **WHEN** a category has no expense in the shown cycle
- **THEN** its card is listed with 0 and no rows, in its stored position

#### Scenario: Taken and pending charges
- **WHEN** today is 22 September and the cycle holds pending recurring charges dated 8 September and 24 September
- **THEN** the charge of the 8th is shown as taken and the one of the 24th as pending, in that order in "Próximos cobros"

#### Scenario: A pending charge whose day has passed
- **WHEN** today is 22 September and the "Alquiler" charge dated 1 September is still pending
- **THEN** it is shown as taken, counts at its amount in the "Vivienda" total and the free margin, and the collapsed "Próximos cobros" card does not name it as the next charge

#### Scenario: A confirmed charge ahead of its day
- **WHEN** today is 10 September and the user saves the pending "Luz" charge dated 20 September
- **THEN** it is shown as taken

#### Scenario: Budget progress from stored rows
- **WHEN** "comida" has a budget row of 400 for the shown cycle and expense rows summing 310 in a cycle whose today is its 10th of 30 days
- **THEN** the card shows 310 of 400 and 30 left per week

#### Scenario: A recurring charge counts in the bar
- **WHEN** "transporte" has a budget of 100, a variable expense of 80 and a recurring charge of 50 in the shown cycle
- **THEN** the card shows 130 of 100, and the expenses panel lists "transporte" with 130

#### Scenario: A new cycle copies the previous budgets once
- **WHEN** the cycle in progress has no budget row, the previous cycle holds comida 400 and ocio 150, and the user opens `/dashboard` and then reloads it
- **THEN** the cycle holds exactly one row each for comida 400 and ocio 150, and the previous cycle's rows are unchanged

#### Scenario: A cleared budget is not copied back
- **WHEN** the user clears the budgets of comida and ocio in the cycle in progress and reloads
- **THEN** neither card shows a bar, and the stored rows for that cycle are "no budget" markers, not a fresh copy

#### Scenario: Definition without a day
- **WHEN** a recurring definition is written without a day of the month, by any caller
- **THEN** the database rejects it and nothing is stored

### Requirement: Every dashboard operation persists
Each operation of the injected contracts SHALL be durable — its result is visible after a reload — and after it completes the dashboard SHALL show figures recomputed from the stored rows. The outcomes SHALL be the ones the contracts and the `expense-editing`, `income-editing`, `savings-editing`, `category-editing`, `category-creation` and `category-reordering` capabilities promise, with these database specifics:
- creating an expense, an income entry or a savings movement SHALL insert one confirmed row of that type, in the user's default currency, whose local date is the chosen calendar day; a withdrawal SHALL be stored with a negative amount
- updating SHALL change only the amount, the description and the date of that row, and SHALL confirm it when it is a pending recurring charge (`recurring-charge-generation` → *A charge entered for a definition completes the pending one*)
- soft-deleting SHALL mark the row and restoring SHALL clear the mark; no operation SHALL delete a movement row
- creating a category SHALL place it after every existing one and, when a budget is given, SHALL add its budget row for the cycle in progress only, after that cycle's copy has run; a name already used by another category of the user, compared trimmed and case-insensitively, SHALL be rejected as a duplicate
- updating a category SHALL write its name, colour and budget; the budget SHALL be written for the shown cycle when it is the one in progress or a projected one, following `category-editing` → *Budgets belong to one cycle*, after the copy into the cycle in progress has run; a null budget SHALL mark the row as "no budget" rather than delete it; rows of earlier cycles SHALL NOT change
- deleting a category SHALL move every expense row of that category in every cycle, soft-deleted rows included, and every recurring definition of that category, to the receiving category, SHALL remove its budget rows in every cycle and the category, all or nothing; when no receiving category is given and the category still has rows or definitions, it SHALL reject with nothing changed
- reordering SHALL write the whole order; a list that omits an id, repeats one or names a category the user does not own SHALL be rejected with no part applied
- creating a recurring definition SHALL store it and SHALL link, as this cycle's charge, the confirmed row the same save created (same type, category, amount, name and day); that row SHALL count as the first repetition of a plan with an end
- updating a definition SHALL write its fields and SHALL rewrite the amount of this cycle's linked charge only while that charge is shown as pending: not confirmed and dated after today
- stopping a definition SHALL set it inactive and nothing else
- deleting a definition SHALL soft-delete every charge it produced and SHALL remove the definition
- any failure SHALL leave the stored rows as they were and reject the operation

#### Scenario: An expense survives a reload
- **WHEN** the user adds 20 described as "Panadería" to "comida" and reloads `/dashboard`
- **THEN** "Panadería" is listed in "comida" with 20 €, the card total and the expenses total are 20 higher, and the free margin is unchanged because "comida" is still within its budget

#### Scenario: A budget edit survives a reload and spares the previous cycle
- **WHEN** the user raises "comida" from 400 to 600 and reloads, then opens the previous cycle
- **THEN** the cycle in progress shows 310 of 600 and a free margin 200 lower, and the previous cycle still shows its own comida budget of 400

#### Scenario: Editing a pending charge confirms it
- **WHEN** the "Luz" charge of this cycle is pending at 90 and the user saves it at 120, then reloads
- **THEN** one "Luz" row exists in the cycle, at 120, shown as taken

#### Scenario: A definition update skips a taken charge
- **WHEN** today is 20 September, this cycle's "Netflix" charge dated 14 September is still pending at 12,99, and the user changes the definition's expected amount to 13,99
- **THEN** after a reload the definition shows 13,99 and this cycle's charge still shows 12,99

#### Scenario: Delete and restore
- **WHEN** the user deletes "Café" from "comida", reloads, activates nothing, then restores it from a fresh delete's undo
- **THEN** after the first reload "Café" is absent and the totals exclude it; after the undo it is listed again with its original amount and date

#### Scenario: Category deletion carries charges and definitions
- **WHEN** the user deletes "hogar" onto "compras"
- **THEN** after a reload the "Limpieza" charge is listed in "Compras", its definition's sheet names "Compras" as its category, "Hogar" is gone, and the expenses total is unchanged

#### Scenario: Rejected reorder
- **WHEN** a reorder is sent with one of the user's category ids missing
- **THEN** the operation rejects and, after a reload, the cards are in their previous order

#### Scenario: Recurring create links this cycle's row
- **WHEN** the user adds "Netflix" 12,99 to "suscripciones" with the recurrence switch on and day 5
- **THEN** after a reload exactly one "Netflix" row exists in "suscripciones", it appears in "Próximos cobros" with day 5, and its definition's sheet opens from it

#### Scenario: Deleting a definition takes its charges
- **WHEN** the user deletes the "Parking" definition from its sheet
- **THEN** after a reload no "Parking" charge is listed in any cycle and "Próximos cobros" no longer lists it

#### Scenario: Duplicate name
- **WHEN** the user creates a category named " comida " while "Comida" exists
- **THEN** the sheet shows the duplicate-name message and no category is created
