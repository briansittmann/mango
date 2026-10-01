## MODIFIED Requirements

### Requirement: Every dashboard operation persists
Each operation of the injected contracts SHALL be durable — its result is visible after a reload — and after it completes the dashboard SHALL show figures recomputed from the stored rows. The outcomes SHALL be the ones the contracts and the `expense-editing`, `income-editing`, `savings-editing`, `category-editing`, `category-creation`, `category-reordering` and `onboarding` capabilities promise, with these database specifics:
- creating an expense, an income entry or a savings movement SHALL insert one confirmed row of that type, in the user's default currency, whose local date is the chosen calendar day; a withdrawal SHALL be stored with a negative amount. The day MAY fall in a projected cycle: the row SHALL then be inserted the same way, with no link to any definition, no cycle mark, no budget entry and no change to the generation marker, and it SHALL be supplied with that cycle from then on
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
- when the charges of a cycle are generated (`recurring-charge-generation`), a row the user entered in that cycle SHALL be left as it is, and a definition whose slot in that cycle a row already holds SHALL NOT be inserted or counted again
- storing the charges of the cycle in progress for the account's definitions (`onboarding` → *Income and fixed expenses step, and the charges of the cycle in progress*) SHALL insert one pending row per active definition that has none in that cycle, with the columns the generation writes, SHALL count that definition's repetition only when the cycle was already generated, and SHALL leave the generation marker as it is; it SHALL be callable only for the cycle in progress or a later one, as the signed-in user, and SHALL reject a charge dated outside the cycle
- the profile operations SHALL write the user's own row only: the basics (name, country code, currency, timezone, cycle start day, amount format), rejecting a cycle-day change while the user has any category, definition, budget row or movement; the savings target, or its absence; the pending step; the completion mark; and the WhatsApp request (phone in E.164, code, time), rejecting a phone another account holds
- any failure SHALL leave the stored rows as they were and reject the operation

The data supplied to the dashboard SHALL carry, with the user's name, phone, photo, currency and timezone, the user's country code, the amount format in effect, the cycle start day, and whether the user holds any movement.

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

#### Scenario: Pending charges stored from the onboarding
- **WHEN** an account with no generated cycle holds the definitions "Sueldo" (income, 2 000, day 1) and "Alquiler" (expense, 820, day 1, Vivienda) and the charges of the cycle in progress are stored for it
- **THEN** the cycle holds one pending "Sueldo" row and one pending "Alquiler" row in Vivienda, dated day 1 inside the cycle, the generation marker is still empty, and storing them again inserts nothing
- **AND** the dashboard lists "Alquiler" in "Próximos cobros" and counts 820 in Vivienda's total and the free margin

#### Scenario: Pending charges in a generated cycle
- **WHEN** the cycle in progress was already generated with no definitions, "Alquiler" is then created and the charges of the cycle in progress are stored
- **THEN** one pending "Alquiler" row exists and the definition's count of produced charges is 1

#### Scenario: Charge outside the cycle
- **WHEN** the charges stored for the cycle in progress name a date in the next cycle
- **THEN** the operation rejects and no row is inserted

#### Scenario: Basics stored
- **WHEN** the account stores name "Ana", country `AR`, currency `ARS`, timezone `America/Argentina/Buenos_Aires`, cycle day 1 and the abbreviated format, with no category, definition, budget or movement
- **THEN** after a reload the dashboard data carries name "Ana", currency `ARS`, country `AR`, the abbreviated format in effect and cycle day 1

#### Scenario: Cycle day locked
- **WHEN** the account holds one category and the basics are stored with cycle day 15 instead of 1
- **THEN** the operation rejects and the row is unchanged

#### Scenario: Phone taken
- **WHEN** the WhatsApp request stores a phone another account holds
- **THEN** the operation rejects and neither row changes

#### Scenario: Savings target stored
- **WHEN** the account stores a savings target of 300 and reloads `/dashboard`
- **THEN** the dashboard data carries 300 as the savings target
