# Expense Editing Specification

## Purpose

Lets people add, correct and remove expenses from the dashboard through one entry sheet and a swipe gesture. Deletion is soft and can be undone. Every data source supplies the same operations, so the screen behaves the same on real data and on the in-memory demo.

## Requirements

### Requirement: Expense changes go through injected operations
The page that mounts the dashboard SHALL supply expense changes as four operations. Every data source SHALL provide them with the same inputs and outcomes:
- **create:** adds an expense to a category from an amount, a description and a calendar date in the user's time zone
- **update:** replaces an existing expense's amount, description, calendar date and category
- **soft delete:** marks an expense as deleted without removing it
- **restore:** clears that mark

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change expenses only through these operations, and rows that belong to a recurring definition through the slot operations (`recurring-expenses` → *A definition's slot in a cycle can be changed on its own*). Every delete path (swipe button, long swipe, the sheet's delete action) SHALL use soft delete, and no data source SHALL permanently remove an expense in response to them.

Update SHALL NOT change an expense's type, its fixed flag, the recurring fixed-expense definition it came from, or any other expense. The category it receives SHALL be one of the user's categories alive in the expense's cycle (`category-editing` → *A category lives from its first cycle to its last*); any other SHALL be rejected with nothing changed.

A soft-deleted expense SHALL NOT count anywhere: not in expense lists, card totals, budget progress, the expenses total, the charts or the free margin. Once restored, it SHALL count in all of them again.

How an expense moves the free margin SHALL follow `category-editing` → *A budget reserves its amount in the free margin*: an expense in a category with a budget, recurring charges included, moves the free margin only by the part of the category's spending beyond its budget, and an expense in a category without a budget moves it by its whole amount.

The four operations SHALL be offered in a projected cycle (`cycle-projection` → *What a projected cycle shows and allows*) for the cycle's real rows that belong to no definition, with the same inputs and outcomes; the calendar date SHALL then fall inside that cycle.

#### Scenario: Deleted expense leaves every figure
- **WHEN** the "Café" expense (62,40 €) in "comida" is soft-deleted on `/demo`, in Spanish
- **THEN** it is no longer listed
- **AND** the "comida" card shows 247,60 € of 400 €, the expenses total shows 1.637,60 € and the free margin still shows 864 €, because "comida" is still within its budget

#### Scenario: Restore brings the expense back
- **WHEN** the same expense is restored
- **THEN** "Café" is listed in "comida" with 62,40 € and its date, the card shows 310 € of 400 €, and the free margin shows 864 €

#### Scenario: Same operations on another data source
- **WHEN** the dashboard is mounted with an implementation of the four operations that records its calls instead of the demo's
- **AND** the user creates an expense in "ocio", edits "Cine", deletes "Conciertos" and undoes that deletion
- **THEN** the recorder receives create (the "ocio" category, amount, description, date), update ("Cine", amount, description, date, the "ocio" category), soft delete ("Conciertos") and restore ("Conciertos"), in that order
- **AND** no dashboard component needed a change for that data source

#### Scenario: An expense in a projected cycle moves the projected margin
- **WHEN** on `/demo` in Spanish the visitor opens the October 2026 projection, whose free margin is 475 €, and adds 20 € described as "Ferretería" to "hogar", which has no budget
- **THEN** "Ferretería" is listed in "hogar" with 20 €, the card shows 55 € and the free margin shows 455 €
- **AND** the "Próximos cobros" footer still reads 1.025 €

#### Scenario: Edit and delete in a projected cycle
- **WHEN** the visitor then changes "Ferretería" to 50 € and saves, and afterwards long-swipes it
- **THEN** after the save the "hogar" card shows 85 € and the free margin 425 €
- **AND** after the swipe "Ferretería" is no longer listed, the card shows 35 €, the free margin shows 475 € and a toast offers "Deshacer"
- **AND** activating "Deshacer" lists "Ferretería" again with 50 € and the free margin shows 425 €

### Requirement: One entry sheet for creating and editing
Creating and editing SHALL use one sheet with the same layout in both modes. The sheet SHALL show the fields of the field configuration it is opened with, in that configuration's order. Another kind of entry SHALL be able to use the same sheet by supplying a different configuration. The expense configuration SHALL list amount, description and date, in that order.

**Create mode:**
- The amount and description SHALL start empty.
- The date SHALL start at today in the user's time zone when the displayed cycle contains today, at the cycle's first day when the cycle is a projection, and otherwise at the cycle's last day.
- The header SHALL name the category the expense will be created in, with its colour dot.
- Below the last field, the sheet SHALL offer the recurrence switch and, while it is on, the fields it reveals (`recurring-expenses` → *The recurrence switch creates the definition*) — except in a projected cycle, where the sheet SHALL NOT show the recurrence switch or any field it reveals.

**Edit mode:**
- The fields SHALL start with the expense's amount, description and date.
- The header SHALL name what is being edited (see *Entry points*), and its category SHALL be a control that moves the expense (*Moving an expense to another category*).
- The sheet SHALL add a delete action below the fields.
- The sheet SHALL NOT show the recurrence switch, in any state, whether the expense is recurring or not. On a row that belongs to a definition, the sheet SHALL instead ask how far the change reaches (`recurring-expenses` → *Every change to a recurring row asks how far it reaches*).

#### Scenario: Create from a category card
- **WHEN** the "comida" card is open on `/demo` in Spanish and the visitor activates "Añadir gasto"
- **THEN** the sheet opens titled "Nuevo gasto", with "Comida" and its colour dot in the header
- **AND** the amount and description are empty, the date is 10 September 2026, and there is no delete action
- **AND** the recurrence switch is shown below the date, off

#### Scenario: Create in a projected cycle
- **WHEN** on `/demo` in Spanish the visitor opens the October 2026 projection, opens the "comida" card and activates "Añadir gasto"
- **THEN** the sheet opens titled "Nuevo gasto" with the date 1 October 2026, 30 September and 1 November cannot be selected, and no recurrence switch is shown

#### Scenario: Edit preloads the expense
- **WHEN** the visitor taps the "Restaurante" row (67,60 €, 7 September) in the "comida" card
- **THEN** the sheet opens titled "Editar gasto" with the amount 67,60, the description "Restaurante" and the date 7 September 2026
- **AND** a delete action is shown below the fields, and no recurrence switch is shown

#### Scenario: No switch on a recurring charge
- **WHEN** the visitor taps the "Alquiler" row in the "Vivienda" card, that charge coming from a definition
- **THEN** no recurrence switch is shown in the sheet, in any state
- **AND** changing the amount shows the "Solo este mes" / "Desde este mes en adelante" choice

#### Scenario: Same layout in both modes
- **WHEN** the sheet is opened from the "comida" card at a 390px-wide viewport, first in create mode and then in edit mode
- **THEN** the header and the amount, description and date rows have the same positions and sizes in both modes
- **AND** only create mode shows the recurrence switch, and only edit mode shows a divider and the delete action below the fields

### Requirement: Entry points
The sheet SHALL open from exactly these triggers:
- **The "add expense" row** at the end of an open category card: opens create mode for that card's category.
- **An expense row in any open card**, real or projected: activating it by tap, click, Enter or Space opens edit mode for that expense.

**Recurring charges.** A recurring charge is the slot a definition (`recurring-expenses`) holds in one cycle, shown in its category's card: a real row in the cycle in progress or a past one, and a real or projected row in a projection.
- Its category's card SHALL be the only place the **charge** is opened from. The `upcoming-charges` card SHALL NOT open this sheet for any charge it lists; activating one of its rows opens the **definition** instead (`upcoming-charges` → *A row opens its definition, and nothing else does*).
- Activating a recurring charge's row SHALL open edit mode for that charge. The header caption SHALL name its category and SHALL state that it repeats every month.
- Saving or deleting it SHALL reach as far as the scope chosen in the sheet, and no further (`recurring-expenses` → *Where you touch decides what you change*).

**Two ways in, one rule.** The category card changes a charge with the scope the visitor chooses; the `upcoming-charges` card edits the definition from the cycle in progress on. Neither SHALL change an earlier cycle.

#### Scenario: Recurring charge edits this month only
- **WHEN** the visitor opens the "Vivienda" card on `/demo` in Spanish and taps "Alquiler" (820 €)
- **THEN** the sheet opens in edit mode with a header caption naming "Vivienda" and stating that it repeats every month
- **AND** after changing the amount to 880, choosing "Solo este mes" and saving, the "Vivienda" card total is 960 € and the free margin is 804 €
- **AND** the "Alquiler" definition still holds an expected amount of 820 €

#### Scenario: Recurring charge update carries only the charge
- **WHEN** a recording implementation of the expense operations and another of the recurring operations are mounted and the user saves an edit to a recurring charge's row with "Solo este mes"
- **THEN** the only call is one edit in cycle, with the definition, the cycle, the amount, description, date, category and "only"
- **AND** the expense recorder receives nothing

#### Scenario: A projected charge opens the sheet
- **WHEN** the visitor opens the October 2026 projection on `/demo` and taps the projected "Alquiler" row in "Vivienda"
- **THEN** the entry sheet opens in edit mode holding 820 € and the date "Alquiler" falls on in October

#### Scenario: One way in
- **WHEN** the "Próximos cobros" card is expanded and its "Alquiler" row is tapped, clicked and activated with Enter
- **THEN** the entry sheet does not open, and the definition sheet opens each time
- **AND** tapping the "Alquiler" row in the "Vivienda" card opens the entry sheet in edit mode, and no definition sheet opens

#### Scenario: Every card has an add row
- **WHEN** the "Vivienda" card is open on `/demo`
- **THEN** its last row is the "Añadir gasto" row
- **AND** the "Próximos cobros" card has no add row

#### Scenario: Keyboard opens edit mode
- **WHEN** keyboard focus is on the "Cine" row and the user presses Enter
- **THEN** the sheet opens in edit mode for "Cine"

### Requirement: Expense fields and validation
**Amount:**
- The description field SHALL come before it. In create mode the description SHALL have focus when the sheet opens, and Enter in it SHALL move focus to the amount while the amount is empty. In edit mode the amount SHALL have focus on open, with its value selected so that typing replaces it.
- It SHALL request the decimal keypad on touch devices.
- It SHALL accept a comma or a period as the decimal separator and at most two decimals.
- Its value SHALL be greater than 0 and at most 9 999 999 999,99.
- The user's currency symbol SHALL be shown next to it, on the side where the active language places it.

**Description:**
- Free text, optional.
- Leading and trailing spaces SHALL be removed on save.
- An expense without a description SHALL be listed under its card's name.

**Date:**
- It SHALL be shown formatted in the active language. Activating it SHALL open the platform's date picker.
- Only days inside the displayed cycle SHALL be selectable.

**Validity:**
- While the amount is empty or invalid, the primary action SHALL be disabled.
- When the amount field loses focus holding an invalid value, a message SHALL appear under it. The message SHALL be exposed to assistive technology and state that an amount above 0 with up to two decimals is expected.

#### Scenario: Focus on open
- **WHEN** the sheet opens in create mode
- **THEN** the description field has keyboard focus, and Enter in it moves focus to the empty amount field, which declares a decimal input mode
- **WHEN** the sheet opens in edit mode
- **THEN** the amount field has keyboard focus and its whole value is selected

#### Scenario: Comma decimals in Spanish
- **WHEN** the visitor types "12,5" as the amount in "comida", in Spanish, and saves
- **THEN** the new row shows "12,50 €"

#### Scenario: Invalid amounts
- **WHEN** the amount is empty, "0", "abc" or "1,234"
- **THEN** the primary action is disabled
- **AND** for "0", "abc" and "1,234", once the field loses focus a message under it states that an amount above 0 with up to two decimals is expected

#### Scenario: Empty description
- **WHEN** an expense of 9 is saved in "ocio" without a description
- **THEN** its row is named "Ocio"

#### Scenario: Date limited to the cycle
- **WHEN** the date field is open for the cycle running 1–30 September 2026
- **THEN** 31 August 2026 and 1 October 2026 cannot be selected

### Requirement: Entry sheet appearance
**Panel:**
- The sheet SHALL be a panel floating above the page, at most 440px wide and centred.
- At a 390px-wide viewport it SHALL sit 12–16px from the left and right edges. At every width it SHALL sit 12–16px above the bottom edge, plus the bottom safe area.
- All four corners SHALL be rounded, and a drag handle SHALL be centred at the top.
- A dimmed scrim SHALL cover the page behind it.

**Material:** follows *Translucent materials*:
- content behind the panel shows through heavily blurred
- a thin light border, more pronounced along the top edge
- a soft shadow beneath

Every label, value, caption, icon and button SHALL be drawn at full opacity, never translucent. Icons SHALL reach 3:1 against the panel.

**Header**, from the leading edge to the trailing edge:
- a "Cancelar" action
- the title, with a caption under it in the muted text colour
- the primary action: "Añadir" in create mode, "Guardar" in edit mode

**Body:**
- Each field SHALL be a row at least 48px tall, with its label on the leading side and its value on the trailing side, separated from the next row by a hairline.
- Each editable value SHALL sit on a surface visibly distinct from the panel, with softly rounded corners, so it looks editable before it is touched.

**Delete action (edit mode only):** after the last field, a full-width divider SHALL be followed by an "Eliminar gasto" row as the last element of the sheet. It SHALL show a trash icon and text in the destructive colour on a faint destructive tint.

**Sizes:**
- No text SHALL compute below 12px.
- Editable text SHALL compute at 16px or larger.
- Every control SHALL have a hit area of at least 44 × 44px.

**Colour:**
- The brand colour SHALL appear only on the primary action and focus indicators.
- The destructive colour SHALL appear only on the delete action.
- The warning colour SHALL NOT appear.

#### Scenario: Floating geometry
- **WHEN** the sheet is open at a 390 × 844 viewport
- **THEN** the panel's left and right edges are 12–16px from the viewport edges and its bottom edge is 12–16px above the bottom edge
- **AND** all four corner radii are non-zero, and a handle is centred horizontally at the top of the panel

#### Scenario: Full-opacity content
- **WHEN** the sheet is open in edit mode, in the light theme and then in the dark theme
- **THEN** the title, caption, labels, values, icons and buttons have a computed opacity of 1 and text colours with no transparency

#### Scenario: Header and delete order
- **WHEN** the sheet is open in edit mode
- **THEN** "Cancelar" is the leading header control and "Guardar" the trailing one
- **AND** "Eliminar gasto" is the last element of the sheet, below a divider, in the destructive colour

#### Scenario: Row and target sizes
- **WHEN** the sheet is open in edit mode at a 390px-wide viewport
- **THEN** every field row and the delete row are at least 48px tall
- **AND** every button and field has a hit area of at least 44 × 44px, and no text is smaller than 12px

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
- **WHEN** on `/demo` in Spanish, with the free margin at 864 €, the visitor adds an expense of 20 described as "Ferretería" to "hogar", which has no budget
- **THEN** the sheet closes and "Ferretería" is listed in "hogar" with 20 €
- **AND** the card shows 115 €, the pie centre shows 1.720 €, and the free margin shows 844 €

#### Scenario: Create within a budget leaves the free margin
- **WHEN** on `/demo` in Spanish, with the free margin at 864 €, the visitor adds an expense of 20 described as "Panadería" to "comida"
- **THEN** the sheet closes and "Panadería" is listed in "comida" with 20 €
- **AND** the card shows 330 € of 400 € with the "near limit" label, the pie centre shows 1.720 €, and the free margin still shows 864 €

#### Scenario: Edit pushes a category over budget
- **WHEN** the visitor changes "Conciertos" in "ocio" from 85 to 125 and saves
- **THEN** "ocio" shows 170 € of 150 €, a full bar in the danger colour and "20 € por encima del presupuesto"
- **AND** the free margin shows 844 €

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
- **THEN** "Café" is listed in "comida" again with 62,40 €, the card shows 310 € of 400 €, and the free margin shows 864 €

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

### Requirement: Moving an expense to another category

In edit mode, the category named in the sheet's header, with its colour dot, SHALL be a control. Activating it SHALL unfold, right under the header and inside the sheet, a picker styled like the month picker's grid, listing every category alive in the expense's cycle with its colour dot and name, the current one marked. Choosing one SHALL change the header to that category, with its dot, and SHALL count as a change of the form; nothing SHALL be written until the sheet is saved.

- The control SHALL have a hit area of at least 44 × 44px, SHALL expose an accessible name that states the current category and that it can be changed, and SHALL be reachable by keyboard. The picker SHALL close on Escape, on a choice and on a pointer down outside it, returning focus to the control.
- The picker SHALL open and close with the month picker's motion, and without movement under reduced motion.
- On a row that belongs to a definition, a new category SHALL be saved with the chosen scope: "Solo este mes" moves that cycle's charge only, "Desde este mes en adelante" also moves the definition.
- Create mode SHALL keep naming the card's category without a control.

Saving SHALL move the row to the chosen card: both cards' totals, budget progress and the free margin SHALL follow, and the expenses total SHALL stay the same.

#### Scenario: Moving an expense
- **WHEN** on `/demo` in Spanish the visitor opens "Cine" in "ocio", activates the header's "Ocio", chooses "Compras" and saves
- **THEN** "Cine" is listed in the "compras" card and not in "ocio", both card totals changed by its amount, and the expenses total still shows 1.700 €

#### Scenario: The choice is not written before saving
- **WHEN** the visitor chooses "Compras" in the picker and then cancels the sheet
- **THEN** "Cine" is still listed in "ocio"

#### Scenario: Moving a fixed charge from this month on
- **WHEN** the visitor opens the "Gimnasio" charge in "Salud", moves it to "Ocio", chooses "Desde este mes en adelante" and saves
- **THEN** the September "Gimnasio" charge and the "Gimnasio" definition are in "Ocio", and every projection lists it in the "ocio" card

#### Scenario: The picker by keyboard
- **WHEN** keyboard focus is on the header's category control and the user presses Enter, moves to "Compras" and presses Enter
- **THEN** the picker closes, the header names "Compras", and focus is back on the control
