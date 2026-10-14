## MODIFIED Requirements

### Requirement: Summary figures include savings
For the shown cycle the dashboard SHALL be supplied with:
- the income total: the sum of income rows in the cycle
- the expenses total: the sum of expense rows in the cycle
- the savings total: the signed sum of savings rows in the cycle, withdrawals negative, leaving out deposits marked as already saved (`savings-editing` → *A deposit the user already had*)
- the accumulated balance: the signed sum of every savings row up to the end of the shown cycle, across all cycles, deposits marked as already saved included
- each savings movement of the cycle with whether it is marked as already saved
- the free margin, as `category-editing` → *A budget reserves its amount in the free margin* defines it, from the shown cycle's rows and budget rows
- the savings target: the user's monthly savings goal, absent when the user has none
- six history entries ending with the shown cycle: each cycle's expenses total, each cycle's income total, and the accumulated balance at each cycle's end, whose last point equals the accumulated balance above. The last expenses entry SHALL equal the expenses total and the last income entry SHALL equal the income total of the shown cycle. For a projected cycle the six entries SHALL end at the cycle in progress.

#### Scenario: Seeded cycle
- **WHEN** the test user's cycle holds income 2 820, expenses 1 700 of which 1 025 are recurring charges, savings movements of +176, −80 and +50, and budgets of 400 on comida (310 spent), 150 on ocio (130 spent) and 100 on transporte (130 spent, 50 € of it a recurring charge)
- **THEN** the summary shows income 2.820 €, expenses 1.700 €, savings 146 € and the free margin 864 €

#### Scenario: Accumulated across cycles
- **WHEN** the user saved 2 500 net before the shown cycle and 146 net inside it
- **THEN** the accumulated balance reads 2.646 € and the last point of the savings history equals it

#### Scenario: Income history agrees with the total
- **WHEN** the shown cycle holds income rows summing 2 820 and the previous cycle's income rows sum 2 400
- **THEN** the income history has six entries, its last reads 2 820 and the one before it 2 400

#### Scenario: A withdrawal moves only savings and the margin
- **WHEN** the user adds a withdrawal of 30
- **THEN** after the page refreshes the savings total is 30 lower, the accumulated balance 30 lower, the free margin 30 higher, and the income and expenses totals are unchanged

#### Scenario: A deposit already saved moves only the balance
- **WHEN** the user adds a deposit of 1 000 marked as already saved and the page refreshes
- **THEN** the accumulated balance is 1 000 higher, the last point of the savings history equals it, and the savings total and the free margin are unchanged

### Requirement: Every dashboard operation persists
Each operation of the injected contracts SHALL be durable — its result is visible after a reload — and after it completes the dashboard SHALL show figures recomputed from the stored rows. The outcomes SHALL be the ones the contracts and the `expense-editing`, `income-editing`, `savings-editing`, `category-editing`, `category-creation` and `category-reordering` capabilities promise, with these database specifics:
- creating an expense, an income entry or a savings movement SHALL insert one confirmed row of that type, in the user's default currency, whose local date is the chosen calendar day; a withdrawal SHALL be stored with a negative amount, and a savings movement SHALL store whether it is a deposit already saved. The day MAY fall in a projected cycle: the row SHALL then be inserted the same way, with no link to any definition, no cycle mark, no budget entry and no change to the generation marker, and it SHALL be supplied with that cycle from then on
- updating an expense or an income entry SHALL change only the amount, the description and the date of that row, and SHALL confirm it when it is a pending recurring charge (`recurring-charge-generation` → *A charge entered for a definition completes the pending one*)
- updating a savings movement SHALL change only its signed amount, its description, its date and its already-saved mark; the database SHALL reject a row of any other type, or a negative amount, carrying the mark
- every row the bot creates, and every row that existed before the mark, SHALL be a regular movement, not marked as already saved
- soft-deleting SHALL mark the row and restoring SHALL clear the mark; no operation SHALL delete a movement row
- creating a category SHALL place it after every existing one and, when a budget is given, SHALL add its budget row for the cycle in progress only, after that cycle's copy has run; a name already used by another category of the user, compared trimmed and case-insensitively, SHALL be rejected as a duplicate
- updating a category SHALL write its name, colour and budget; the budget SHALL be written for the shown cycle when it is the one in progress or a projected one, following `category-editing` → *Budgets belong to one cycle*, after the copy into the cycle in progress has run; a null budget SHALL mark the row as "no budget" rather than delete it; rows of earlier cycles SHALL NOT change
- deleting a category SHALL move every expense row of that category in every cycle, soft-deleted rows included, and every recurring definition of that category, to the receiving category, SHALL remove its budget rows in every cycle and the category, all or nothing; when no receiving category is given and the category still has rows or definitions, it SHALL reject with nothing changed
- reordering SHALL write the whole order; a list that omits an id, repeats one or names a category the user does not own SHALL be rejected with no part applied
- creating a recurring definition SHALL store it and SHALL link, as this cycle's charge, the confirmed row the same save created (same type, category, amount, name and day); that row SHALL count as the first repetition of a plan with an end
- updating a definition SHALL write its fields and SHALL rewrite the amount of this cycle's linked charge only while that charge is shown as pending: not confirmed and dated after today
- stopping a definition SHALL set it inactive and nothing else
- deleting a definition SHALL soft-delete every charge it produced and SHALL remove the definition
- when the charges of a cycle are generated (`recurring-charge-generation`), a row the user entered in that cycle SHALL be left as it is, and a definition whose slot in that cycle a row already holds SHALL NOT be inserted or counted again
- any failure SHALL leave the stored rows as they were and reject the operation

#### Scenario: An expense survives a reload
- **WHEN** the user adds 20 described as "Panadería" to "comida" and reloads `/dashboard`
- **THEN** "Panadería" is listed in "comida" with 20 €, the card total and the expenses total are 20 higher, and the free margin is unchanged because "comida" is still within its budget

#### Scenario: An expense in a projected cycle survives a reload
- **WHEN** on `/dashboard?mes=2026-11`, a projection, the user adds 250 described as "Cumpleaños" to "Comida" (budget 300) and reloads
- **THEN** "Cumpleaños" is listed in "Comida" with 250 € in November only, the card shows 250 € of 300 €, and the November free margin is unchanged because "Comida" is still within its budget
- **AND** the stored row is confirmed, dated 1 November 2026 local, linked to no definition and with no cycle mark, and no budget row and no generation marker changed

#### Scenario: The generation leaves manual rows alone
- **WHEN** November holds the user's "Cumpleaños" row and a row linked to the "Luz" definition for November, and the November charges are generated
- **THEN** "Cumpleaños" is unchanged, no second "Luz" row exists, "Luz" is not counted again, and every other definition's charge is inserted as pending

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

#### Scenario: A savings edit survives a reload
- **WHEN** the user opens a deposit of 50 named "Bono", saves it as a withdrawal of 30 dated two days later, and reloads `/dashboard`
- **THEN** one row exists for it, with −30, the new date and the same name, and the savings total is 80 lower and the free margin 80 higher than before the edit

#### Scenario: The mark survives a reload
- **WHEN** the user opens a deposit of 176, turns "Ya lo tenía ahorrado" on, saves and reloads
- **THEN** the deposit is listed with "Ya ahorrado", the savings total is 176 lower, the free margin 176 higher and the accumulated balance unchanged

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

