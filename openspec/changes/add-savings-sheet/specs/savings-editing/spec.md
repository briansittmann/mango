## MODIFIED Requirements

### Requirement: Savings changes go through an injected operation
The dashboard SHALL change savings movements only through savings operations supplied by the page that mounts it. The dashboard SHALL NOT know which data source is behind it. There SHALL be four operations:

- **add**, which SHALL take:
  - the movement type, deposit or withdrawal
  - a name, trimmed, never empty
  - an amount greater than 0
  - a calendar date inside the displayed cycle
  - whether the deposit is one the user already had (*A deposit the user already had*), always false for a withdrawal
- **update**, which SHALL take a movement and the same five values, and SHALL replace that movement's type, name, amount, date and mark with them
- **soft delete**, which SHALL take a movement and mark it as deleted without removing it
- **restore**, which SHALL clear that mark

Each SHALL resolve once the change is durable, and SHALL reject with nothing changed. A withdrawal SHALL be recorded as a savings movement with a negative amount; a deposit with a positive one. The caller SHALL never pass a signed amount: the sign comes from the type. No data source SHALL permanently remove a movement in response to a delete.

Every data source SHALL implement them with the same inputs and outcomes. When the page supplies no add operation, the "add savings movement" row SHALL be disabled (`dashboard-ui` → *Controls without a handler are disabled*); when it supplies no soft delete, movement rows SHALL offer no swipe; when it supplies no update, movement rows SHALL NOT open the sheet.

#### Scenario: A withdrawal reaches the operation as a positive amount and a type
- **WHEN** a recording implementation of the savings operations is mounted and the user saves a withdrawal of 30 named "Viaje" dated 12 September 2026
- **THEN** the recorder receives one add call with the withdrawal type, "Viaje", 30, 2026-09-12 and the mark off

#### Scenario: An edit reaches the update operation
- **WHEN** a recording implementation is mounted and the user opens "Bono ahorro" and saves it with the amount 80
- **THEN** the recorder receives one update call for that movement with the deposit type, "Bono ahorro", 80, 2026-09-09 and the mark off, and no add call

#### Scenario: No operation, no sheet
- **WHEN** the dashboard is mounted without savings operations
- **THEN** the "Añadir movimiento de ahorro" row is disabled and activating it opens nothing, no movement row can be swiped, and activating a movement row opens nothing

#### Scenario: Delete and undo reach the operations
- **WHEN** a recording implementation is mounted and the user long-swipes a movement and then activates "Deshacer"
- **THEN** the recorder receives soft delete and then restore, both for that movement

### Requirement: The add-movement sheet
Activating "Añadir movimiento de ahorro" in the savings panel SHALL open a bottom sheet with the same structure, dismissal, focus return, busy behaviour and error handling as the entry sheet in create mode (`expense-editing` → *Saving, dismissal and errors*). It SHALL have no delete action and no recurrence control.

It SHALL be titled "Nuevo movimiento de ahorro" and its primary action SHALL read "Añadir". Its fields, top to bottom:

**Type:**
- A two-option segmented control, "Depósito" and "Retiro", exposed to assistive technology as a single-choice group.
- "Depósito" SHALL be selected every time the sheet opens.

**Amount:**
- The same field as the entry sheet: focus on open, decimal keypad on touch devices, comma or period as decimal separator, at most two decimals, greater than 0, currency symbol shown.
- It SHALL NOT accept a sign. The typed value SHALL be the magnitude for both types.

**Name:**
- Free text, required. Leading and trailing spaces SHALL be removed on save; a name that is empty after trimming SHALL be invalid.

**Date:**
- The cycle's today by default, which in a projected cycle is its first day. Only days inside the displayed cycle SHALL be selectable.

**Already saved:**
- A switch labelled "Ya lo tenía ahorrado", with the line "Suma a tu acumulado sin restar de tu margen libre" under it, off every time the sheet opens.
- It SHALL be shown only while "Depósito" is selected. Selecting "Retiro" SHALL hide it, and a withdrawal SHALL always be saved with the mark off, whatever the switch showed before.

**Validity:**
- While the amount or the name is invalid, the primary action SHALL be disabled.
- A submit attempt with an invalid amount (for example Enter in the amount field) SHALL save nothing, keep the sheet open and mark the amount field invalid, with the message stating that an amount above 0 with up to two decimals is expected.
- Enter in the name field SHALL move focus to the amount while the amount is empty.
- When the name field loses focus empty, it SHALL be marked invalid with a message stating a name is required.
- A withdrawal SHALL NOT be limited by the savings balance: it MAY leave the cycle's savings total or the accumulated balance below zero.

**On success** the sheet SHALL close and announce "Movimiento de ahorro añadido" to assistive technology.

The sheet SHALL open the same way from the savings panel of a projected cycle (`cycle-projection` → *What a projected cycle shows and allows*).

#### Scenario: Defaults on open
- **WHEN** on `/demo` in Spanish the visitor opens the savings panel and activates "Añadir movimiento de ahorro"
- **THEN** a sheet titled "Nuevo movimiento de ahorro" is shown with "Depósito" selected, the name field focused and empty above the empty amount field, the date set to the cycle's today and "Ya lo tenía ahorrado" off

#### Scenario: Defaults in a projected cycle
- **WHEN** on `/demo` in Spanish the visitor opens the October 2026 projection, opens the savings panel and activates "Añadir movimiento de ahorro"
- **THEN** the sheet opens with "Depósito" selected and the date 1 October 2026, and 30 September and 1 November cannot be selected

#### Scenario: The switch follows the type
- **WHEN** the visitor turns "Ya lo tenía ahorrado" on, selects "Retiro" and saves a withdrawal of 20 named "Regalo"
- **THEN** the switch is hidden while "Retiro" is selected, and the withdrawal is saved with the mark off: the savings column shows 126 € and the free margin 884 €

#### Scenario: Saving without an amount does nothing
- **WHEN** the visitor types a name, leaves the amount empty and presses Enter in the amount field
- **THEN** the sheet stays open, no movement is added, the savings total still reads 146 €
- **AND** the amount field is marked invalid and its message is shown

#### Scenario: Saving without a name is not possible
- **WHEN** the visitor types 50 as the amount and leaves the name empty
- **THEN** "Añadir" is disabled
- **AND** once the name field loses focus, a message under it states a name is required

#### Scenario: A withdrawal larger than the cycle's savings
- **WHEN** the visitor saves a withdrawal of 500 named "Coche"
- **THEN** the sheet closes and the savings column shows −354 €

### Requirement: A saved movement moves only savings figures and the free margin
After a movement is saved, the dashboard SHALL show figures recomputed from the resulting list of movements, not from the previously shown figures:
- the savings column's total: the sum of the cycle's signed movements, leaving out deposits the user already had (*A deposit the user already had*)
- the accumulated balance: the balance before the cycle plus the sum of every movement of the cycle, deposits the user already had included
- the last point of the savings history, equal to the accumulated balance
- the progress against the savings target, when one is set
- the free margin, as defined in `category-editing` → *A budget reserves its amount in the free margin*, in which savings enter with the savings column's total, so a movement that counts there moves the free margin by exactly its signed amount in the opposite direction, and a deposit the user already had does not move it

The new movement SHALL be listed in the savings panel among the others in ascending date order, after any movement already listed on the same date, with the deposit or withdrawal marker and a signed amount; a withdrawal SHALL show the true minus sign U+2212, never a hyphen.

The savings total, the accumulated balance and the free margin SHALL animate from their previous value to the new one, and SHALL change without animation when the user prefers reduced motion.

No savings movement SHALL move an income or expense figure: the income total, the expenses total, card totals, budget bars, the charts and the `upcoming-charges` card SHALL stay as they were.

**In a projected cycle** the savings column's total and the savings that enter the free margin SHALL be the larger of the savings target (0 when there is none) and the sum of the cycle's signed movements that count in the savings column (`cycle-projection` → *A future cycle is computed, not stored*), so a movement moves the free margin only by the part of the cycle's movements beyond the target. The accumulated balance SHALL be shown in a projection and SHALL run to the shown cycle's end (`cycle-projection` → *What a projected cycle shows and allows*): a movement entered in an earlier projected cycle SHALL count in every later one, and a deposit the user already had SHALL add its whole amount on top of the cycle's savings column.

#### Scenario: A deposit of 50
- **WHEN** on `/demo` in Spanish, with savings at 146 €, the accumulated balance at 2.646 € and the free margin at 864 €, the visitor saves a deposit of 50 named "Extra"
- **THEN** the savings column shows 196 €, the accumulated balance 2.696 € and the free margin 814 €
- **AND** "Extra" is listed in the savings panel with "+50 €"
- **AND** the income total still shows 2.820 € and the expenses total 1.700 €

#### Scenario: A withdrawal of 30
- **WHEN** on `/demo` in Spanish the visitor saves a withdrawal of 30 named "Imprevisto"
- **THEN** "Imprevisto" is listed with "−30 €", its minus sign being U+2212
- **AND** the savings column shows 116 €, the accumulated balance 2.616 € and the free margin 894 €

#### Scenario: Date order
- **WHEN** the visitor saves a deposit dated 5 September 2026 while the panel lists movements dated 3, 8 and 9 September
- **THEN** the new movement is listed second

#### Scenario: A deposit in a projected cycle
- **WHEN** on `/demo` in Spanish the visitor opens the October 2026 projection (savings target 300 €, savings column 300 €, free margin 475 €) and saves a deposit of 50 named "Extra"
- **THEN** "Extra" is listed in the savings panel with "+50 €", the savings column still shows 300 € and the free margin still shows 475 €
- **AND** after a second deposit of 300 named "Paga extra", the savings column shows 350 € and the free margin 425 €
- **AND** the September sample lists neither movement and its savings column still shows 146 €

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion and saves a deposit of 50
- **THEN** the savings total, the accumulated balance and the free margin show their new values without an animated transition

### Requirement: A savings movement deletes like an income entry

A savings movement row in the savings panel SHALL be deleted the way an income entry is (`income-editing` → *Income deletes like an expense*): a swipe reveals the delete panel, a long swipe deletes, the toast offers "Deshacer", only one row on the page stays open, and a failed delete brings the row back with an alert. Deleting a movement SHALL move only savings figures and the free margin, exactly as saving one does, in reverse (*A saved movement moves only savings figures and the free margin*). Restoring it SHALL bring back the same figures.

The edit sheet (*Editing a savings movement*) SHALL offer "Eliminar movimiento" as its last row. Activating it SHALL delete the movement at once, with no confirmation step, close the sheet and show the same toast with "Deshacer" as a swipe; a failed delete SHALL keep the sheet open with an error and the movement listed.

#### Scenario: Deleting a deposit
- **WHEN** on `/demo` in Spanish the visitor saves a deposit of 50 and then long-swipes it
- **THEN** it is no longer listed, the savings and the free margin show what they showed before the deposit, and a toast offers "Deshacer"
- **AND** activating "Deshacer" lists it again and the figures show the deposit again

#### Scenario: Deleting a withdrawal
- **WHEN** the visitor saves a withdrawal of 30 and then deletes it
- **THEN** the savings and the free margin show what they showed before the withdrawal

#### Scenario: Deleting in a projection
- **WHEN** on the October projection the visitor saves a deposit of 350 above a savings target of 300 and then deletes it
- **THEN** the October savings show 300 again, the floor

#### Scenario: Deleting from the sheet
- **WHEN** on `/demo` in Spanish the visitor opens "Bono ahorro" and activates "Eliminar movimiento"
- **THEN** the sheet closes, "Bono ahorro" is no longer listed, the savings column shows 96 € and a toast offers "Deshacer"
- **AND** activating "Deshacer" lists "Bono ahorro" again and the savings column shows 146 €

## ADDED Requirements

### Requirement: Editing a savings movement
Activating a savings movement, in the savings panel or in the "Movimientos" card (`transaction-list` → *Row actions*), SHALL open the savings sheet in edit mode for that movement, with the same structure, dismissal, focus return, busy behaviour and error handling as the entry sheet in edit mode (`expense-editing` → *Saving, dismissal and errors*). Its title SHALL read "Editar movimiento", over the same "Ahorro" caption as the add sheet, and its primary action "Guardar".

The sheet SHALL open with the movement's values: its type selected, its name, its amount as a magnitude, its date and, for a deposit, the "Ya lo tenía ahorrado" switch as the movement holds it. Focus SHALL land on the amount with its text selected. Every field SHALL follow the rules of the add sheet (*The add-movement sheet*): the type MAY be changed, a withdrawal changed into a deposit keeps its magnitude and becomes positive, and a deposit changed into a withdrawal loses the mark. The date SHALL stay inside the displayed cycle.

On success the sheet SHALL close and announce "Cambios guardados", and the figures SHALL follow *A saved movement moves only savings figures and the free margin*, computed from the edited list of movements. The row SHALL keep its place by date, moving if its date changed.

A movement SHALL open the same way in a projected cycle. A row in the savings panel SHALL be activatable as well as swipeable: a tap opens the sheet, a horizontal drag reveals the delete panel.

#### Scenario: Open and edit
- **WHEN** on `/demo` in Spanish the visitor opens the savings panel and activates "Bono ahorro"
- **THEN** a sheet titled "Editar movimiento" opens with "Depósito" selected, the name "Bono ahorro", the amount 50 focused and selected, the date 9 September 2026 and "Ya lo tenía ahorrado" off
- **AND** after typing 80 and activating "Guardar", the sheet closes, "Bono ahorro" reads "+80 €", the savings column shows 176 €, the accumulated balance 2.676 € and the free margin 834 €

#### Scenario: A withdrawal becomes a deposit
- **WHEN** the visitor opens "Retiro emergencia", selects "Depósito" and saves
- **THEN** "Retiro emergencia" reads "+80 €", the savings column shows 306 € and the free margin 704 €

#### Scenario: Moving the date
- **WHEN** the visitor opens "Ahorro mensual" (3 September) and saves it dated 10 September
- **THEN** it is listed last in the savings panel and the figures do not change

#### Scenario: A failed save
- **WHEN** the update operation rejects
- **THEN** the sheet stays open with an error, and the movement and the figures are unchanged

### Requirement: A deposit the user already had
A deposit saved with "Ya lo tenía ahorrado" on SHALL be money the user already had saved before entering it, not money set aside from the cycle. It SHALL count in the accumulated balance, from its date on, in the cycle it belongs to and in every later one, projections included. It SHALL NOT count in the cycle's savings column, in the free margin, in the progress against the savings target, or towards a projected cycle's savings floor.

It SHALL be listed with the other movements, in date order, with a deposit marker and "+" as any deposit, and with "Ya ahorrado" next to its date so the user can tell why the figures did not move. Deleting it, restoring it and editing it SHALL move only the accumulated balance (and, when an edit turns the mark off or makes it a withdrawal, the figures a regular movement moves). Only a deposit MAY carry the mark.

#### Scenario: Bringing in what the user already had
- **WHEN** on `/demo` in Spanish, with savings at 146 €, the accumulated balance at 2.646 € and the free margin at 864 €, the visitor saves a deposit of 1.000 named "Ahorros de antes" with "Ya lo tenía ahorrado" on
- **THEN** the savings column still shows 146 €, the free margin still shows 864 € and the accumulated balance shows 3.646 €
- **AND** "Ahorros de antes" is listed with "+1.000 €" and "Ya ahorrado" next to its date

#### Scenario: Marking an existing deposit
- **WHEN** the visitor opens "Ahorro mensual" (+176) and saves it with "Ya lo tenía ahorrado" on
- **THEN** the savings column shows −30 €, the free margin 1.040 € and the accumulated balance stays at 2.646 €

#### Scenario: In a projected cycle
- **WHEN** on the October 2026 projection (savings target 300 €, savings column 300 €, free margin 475 €) the visitor saves a deposit of 1.000 with "Ya lo tenía ahorrado" on
- **THEN** the savings column still shows 300 €, the free margin still shows 475 €, and the accumulated balance is 1.000 € higher than before
- **AND** the November projection's accumulated balance is 1.000 € higher as well

#### Scenario: Deleting it
- **WHEN** the visitor deletes "Ahorros de antes"
- **THEN** the accumulated balance returns to 2.646 €, and the savings column and the free margin do not move
