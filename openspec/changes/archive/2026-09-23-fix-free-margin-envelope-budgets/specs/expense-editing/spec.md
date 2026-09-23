## MODIFIED Requirements

### Requirement: Expense changes go through injected operations
The page that mounts the dashboard SHALL supply expense changes as four operations. Every data source SHALL provide them with the same inputs and outcomes:
- **create:** adds an expense to a category from an amount, a description and a calendar date in the user's time zone
- **update:** replaces an existing expense's amount, description and calendar date
- **soft delete:** marks an expense as deleted without removing it
- **restore:** clears that mark

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change expenses only through these operations. Every delete path (swipe button, long swipe, the sheet's delete action) SHALL use soft delete, and no data source SHALL permanently remove an expense in response to them.

Update SHALL NOT change an expense's category, its type, its fixed flag, the recurring fixed-expense definition it came from, or any other expense.

A soft-deleted expense SHALL NOT count anywhere: not in expense lists, card totals, budget progress, the expenses total, the charts or the free margin. Once restored, it SHALL count in all of them again.

How an expense moves the free margin SHALL follow `category-editing` → *A budget reserves its amount in the free margin*: an expense in a category with a budget moves the free margin only by the part of the category's spending beyond its budget, and a recurring charge or an expense in a category without a budget moves it by its whole amount.

#### Scenario: Deleted expense leaves every figure
- **WHEN** the "Café" expense (62,40 €) in "comida" is soft-deleted on `/demo`, in Spanish
- **THEN** it is no longer listed
- **AND** the "comida" card shows 247,60 € of 400 €, the expenses total shows 1.637,60 € and the free margin still shows 844 €, because "comida" is still within its budget

#### Scenario: Restore brings the expense back
- **WHEN** the same expense is restored
- **THEN** "Café" is listed in "comida" with 62,40 € and its date, the card shows 310 € of 400 €, and the free margin shows 844 €

#### Scenario: Same operations on another data source
- **WHEN** the dashboard is mounted with an implementation of the four operations that records its calls instead of the demo's
- **AND** the user creates an expense in "ocio", edits "Cine", deletes "Conciertos" and undoes that deletion
- **THEN** the recorder receives create (the "ocio" category, amount, description, date), update ("Cine", amount, description, date), soft delete ("Conciertos") and restore ("Conciertos"), in that order
- **AND** no dashboard component needed a change for that data source

### Requirement: Entry points
The sheet SHALL open from exactly these triggers:
- **The "add expense" row** at the end of an open category card: opens create mode for that card's category.
- **An expense row in any open card:** activating it by tap, click, Enter or Space opens edit mode for that expense.

**Recurring charges.** A recurring charge is a single charge of the current cycle that sits in its category's card.
- Its category's card SHALL be the only place it is opened from. The `upcoming-charges` card SHALL NOT open the sheet for any charge it lists.
- Activating a recurring charge's row SHALL open edit mode for that charge only. The header caption SHALL name its category and SHALL state that only this cycle's charge changes.
- Saving or deleting a recurring charge SHALL NOT change the recurring definition it came from, that definition's active state, or the charge of any other cycle.

#### Scenario: Recurring charge edits this month only
- **WHEN** the visitor opens the "Vivienda" card on `/demo` in Spanish and taps "Alquiler" (820 €)
- **THEN** the sheet opens in edit mode with a header caption reading "Vivienda · Solo el cargo de este mes"
- **AND** after changing the amount to 880 and saving, the "Vivienda" card total is 960 € and the free margin is 784 €

#### Scenario: Recurring charge update carries only the charge
- **WHEN** a recording implementation of the operations is mounted and the user saves an edit to a recurring charge's row
- **THEN** the only call is update, with that expense's identifier, amount, description and date

#### Scenario: One way in
- **WHEN** the "Próximos cobros" card is expanded and its "Alquiler" row is tapped, clicked and activated with Enter
- **THEN** no sheet opens
- **AND** tapping the "Alquiler" row in the "Vivienda" card opens the sheet in edit mode

#### Scenario: Every card has an add row
- **WHEN** the "Vivienda" card is open on `/demo`
- **THEN** its last row is the "Añadir gasto" row
- **AND** the "Próximos cobros" card has no add row

#### Scenario: Keyboard opens edit mode
- **WHEN** keyboard focus is on the "Cine" row and the user presses Enter
- **THEN** the sheet opens in edit mode for "Cine"

### Requirement: Saving, dismissal and errors
**Dismissal:**
- "Cancelar" and Escape SHALL close the sheet without saving.
- Pressing the scrim or swiping the panel down SHALL close it only while every field still holds its initial value. Otherwise the sheet SHALL stay open.
- On close, keyboard focus SHALL return to the control that opened the sheet, or to the header of its card when that control no longer exists.

**Opening:** the sheet SHALL NOT load anything when it opens. Its values SHALL come from the card or row that opened it, so it has no loading state of its own.

**While saving or deleting:**
- the activated action SHALL show a progress indicator
- the form SHALL be exposed to assistive technology as busy
- fields and other actions SHALL NOT accept input
- the sheet SHALL NOT close by any means

**On success:**
- After create or update, the sheet SHALL close and announce "Gasto añadido" or "Cambios guardados" to assistive technology.
- After delete, the sheet SHALL close and show the undo toast (*Delete with undo*).

**On failure:**
- The sheet SHALL stay open with every typed value intact.
- It SHALL show an alert at the top of the form: "No se pudo guardar. Inténtalo de nuevo." for a save, "No se pudo eliminar el gasto" for a delete.
- Its actions SHALL be enabled again.

#### Scenario: Create updates the free margin
- **WHEN** on `/demo` in Spanish, with the free margin at 844 €, the visitor adds an expense of 20 described as "Ferretería" to "hogar", which has no budget
- **THEN** the sheet closes and "Ferretería" is listed in "hogar" with 20 €
- **AND** the card shows 115 €, the pie centre shows 1.720 €, and the free margin shows 824 €

#### Scenario: Create within a budget leaves the free margin
- **WHEN** on `/demo` in Spanish, with the free margin at 844 €, the visitor adds an expense of 20 described as "Panadería" to "comida"
- **THEN** the sheet closes and "Panadería" is listed in "comida" with 20 €
- **AND** the card shows 330 € of 400 € with the "near limit" label, the pie centre shows 1.720 €, and the free margin still shows 844 €

#### Scenario: Edit pushes a category over budget
- **WHEN** the visitor changes "Conciertos" in "ocio" from 85 to 125 and saves
- **THEN** "ocio" shows 170 € of 150 €, a full bar in the danger colour and "20 € por encima del presupuesto"
- **AND** the free margin shows 824 €

#### Scenario: Pending save
- **WHEN** an injected update takes one second to succeed and the user activates "Guardar"
- **THEN** during that second "Guardar" shows a progress indicator, the form is exposed as busy, the fields reject typing, and "Cancelar", Escape and the scrim leave the sheet open
- **AND** afterwards the sheet closes

#### Scenario: Failed save
- **WHEN** the injected update fails
- **THEN** the sheet stays open with the typed amount, description and date
- **AND** an alert reads "No se pudo guardar. Inténtalo de nuevo.", and "Guardar" can be activated again

#### Scenario: Unsaved values survive a stray tap
- **WHEN** the visitor has typed an amount and presses the scrim
- **THEN** the sheet stays open with the typed amount
- **AND** activating "Cancelar" then closes it without creating an expense

#### Scenario: Focus returns
- **WHEN** the sheet was opened from the "Cine" row with the keyboard and is closed with Escape
- **THEN** keyboard focus is on the "Cine" row

### Requirement: Swipe to delete
Every expense row in an open card SHALL support a leftward drag with touch or a pointer.

**Reveal:**
- While dragged, the row SHALL move as an opaque surface over a panel in the destructive colour holding a trash icon and the label "Eliminar". A shadow SHALL show on the row's trailing edge.
- Released more than half the panel's width to the left, the row SHALL settle open, showing the panel at a quarter of the row's width (at least 44px). Released anywhere short of that, it SHALL settle closed.
- The panel's icon and label SHALL reach 4.5:1 against the panel in both themes.

**Deleting:**
- Activating the revealed panel SHALL delete the expense.
- **Long swipe:** once the row is dragged beyond 60% of its width, the panel SHALL grow to fill the uncovered width, showing that release will delete. Releasing there SHALL delete without activating the panel. Dragging back under 60% SHALL cancel that state.
- When deleting, the row SHALL slide out to the left and collapse its height, and the expense SHALL be soft-deleted (*Delete with undo*). If the operation fails, the row SHALL return to its place, closed.

**Interaction:**
- At most one row SHALL be open. Pressing anywhere outside the open row, or scrolling the page, SHALL close it. Tapping the open row SHALL close it without opening the sheet.
- A mostly vertical drag SHALL scroll the page and SHALL NOT move the row. A rightward drag on a closed row SHALL NOT move it.
- While a row is closed, its delete panel SHALL be hidden from assistive technology and unreachable by keyboard. Deleting stays available from the sheet.

#### Scenario: Short swipe opens
- **WHEN** at a 390px-wide viewport a touch drags the "Parking" row 60px left and releases
- **THEN** the row settles open with a delete panel 89px wide (a quarter of the 356px row), showing a trash icon and "Eliminar"

#### Scenario: Release before the threshold closes
- **WHEN** a touch drags the "Parking" row 30px left and releases
- **THEN** the row settles closed

#### Scenario: Long swipe deletes directly
- **WHEN** a touch drags the "Gasolina" row 250px left (70% of its width)
- **THEN** before release the delete panel fills the uncovered width
- **AND** on release the row slides out and collapses, the "transporte" card shows 0 € of 100 €, and the undo toast appears

#### Scenario: Vertical scrolling is unaffected
- **WHEN** a touch on an expense row moves 80px down and 10px left
- **THEN** the page scrolls and the row does not move

#### Scenario: One open row
- **WHEN** the "Cine" row is open and the user swipes the "Conciertos" row open
- **THEN** "Cine" is closed and "Conciertos" is open

#### Scenario: Tapping an open row closes it
- **WHEN** the "Cine" row is open and the user taps it
- **THEN** the row closes and the sheet does not open

### Requirement: Delete with undo
Deleting an expense SHALL NOT ask for confirmation, whether it comes from the swipe panel, a long swipe or the sheet. It SHALL soft-delete the expense and show a toast at the bottom of the screen with the text "Gasto eliminado" and a "Deshacer" action.

**The toast:**
- It SHALL be opaque and announced politely to assistive technology.
- Its action SHALL be reachable by keyboard and at least 44px tall.
- It SHALL close on its own after 5 seconds. The countdown SHALL pause while a pointer is over the toast or focus is inside it.

**Undo:**
- Activating "Deshacer" SHALL restore the expense, which reappears in its card with every figure back at its previous value, and SHALL close the toast.
- Deleting another expense while the toast is shown SHALL replace it. Only the latest deletion SHALL be undoable from the toast.

**Failures:**
- If the soft delete fails, the expense SHALL stay listed, and an alert toast "No se pudo eliminar el gasto" SHALL be shown without an undo action.
- If restoring fails, the expense SHALL stay deleted, and an alert toast "No se pudo deshacer" SHALL be shown.

#### Scenario: Undo after a long swipe
- **WHEN** the visitor long-swipes "Café" in "comida" and then activates "Deshacer"
- **THEN** "Café" is listed in "comida" again with 62,40 €, the card shows 310 € of 400 €, and the free margin shows 844 €

#### Scenario: Delete from the sheet
- **WHEN** the visitor opens "Gimnasio" in "salud" and activates "Eliminar gasto"
- **THEN** no confirmation is requested and the sheet closes
- **AND** "salud" shows 0 € of 120 €, and a toast offers "Deshacer"
- **AND** "Gimnasio" is no longer listed in "Próximos cobros", whose footer reads 985 €

#### Scenario: Toast timing
- **WHEN** the toast is shown and nothing else happens
- **THEN** it is no longer visible after 5 seconds
- **AND** in a separate run, while a pointer rests on the toast, it stays visible past 5 seconds and closes after the pointer leaves

#### Scenario: Only the latest deletion is undoable
- **WHEN** "Cine" is deleted and, while its toast is shown, "Conciertos" is deleted
- **THEN** exactly one toast is visible, and activating "Deshacer" restores "Conciertos" while "Cine" stays deleted

#### Scenario: Failed delete
- **WHEN** a swipe deletes a row and the injected soft delete fails
- **THEN** the row is listed again, closed
- **AND** an alert toast reads "No se pudo eliminar el gasto" and offers no "Deshacer"
