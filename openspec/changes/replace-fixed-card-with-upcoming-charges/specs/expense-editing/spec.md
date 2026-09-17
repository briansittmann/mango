## MODIFIED Requirements

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
- **AND** after changing the amount to 880 and saving, the "Vivienda" card total is 960 € and the free margin is 914 €

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
- **THEN** "Café" is listed in "comida" again with 62,40 €, the card shows 310 € of 400 €, and the free margin shows 974 €

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
