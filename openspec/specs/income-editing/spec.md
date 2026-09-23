# Income Editing Specification

## Purpose

Lets people add, correct and remove the money that comes in during a cycle, from the income panel of the dashboard, through the same entry sheet, swipe gesture and undo toast that expenses use. Income has no category and no budget, so an entry is only an amount, a description and a date — optionally repeating every month. Every data source supplies the same operations, so the screen behaves the same on real data and on the in-memory demo.

## Requirements

### Requirement: Income changes go through injected operations
The page that mounts the dashboard SHALL supply income changes as four operations. Every data source SHALL provide them with the same inputs and outcomes:
- **create:** adds an income entry to the displayed cycle from an amount, a description and a calendar date in the user's time zone
- **update:** replaces an existing income entry's amount, description and calendar date
- **soft delete:** marks an income entry as deleted without removing it
- **restore:** clears that mark

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

No operation SHALL take a category: an income entry has none, and nothing in the income panel or the entry sheet SHALL ask for one, show one or assign one.

Dashboard components SHALL change income only through these operations. Every delete path (swipe panel, long swipe, the sheet's delete action) SHALL use soft delete, and no data source SHALL permanently remove an income entry in response to them.

Update SHALL NOT change an entry's type, the recurring definition it came from, or any other entry.

A soft-deleted income entry SHALL NOT count anywhere: not in the income panel's rows, not in the income total and not in the free margin. Once restored, it SHALL count in all of them again.

#### Scenario: Deleted income leaves every figure
- **WHEN** the "Freelance" entry (420 €) is soft-deleted on `/demo`, in Spanish
- **THEN** it is no longer listed in the income panel
- **AND** the income column shows 2.400 € and the free margin shows 424 €

#### Scenario: Restore brings the entry back
- **WHEN** the same entry is restored
- **THEN** "Freelance" is listed again with 420 € and its date, the income column shows 2.820 € and the free margin shows 844 €

#### Scenario: Same operations on another data source
- **WHEN** the dashboard is mounted with an implementation of the four operations that records its calls instead of the demo's
- **AND** the user creates an income entry, edits "Salario", deletes "Freelance" and undoes that deletion
- **THEN** the recorder receives create (amount, description, date), update ("Salario", amount, description, date), soft delete ("Freelance") and restore ("Freelance"), in that order
- **AND** no call carries a category, and no dashboard component needed a change for that data source

### Requirement: The income configuration of the entry sheet
Creating and editing an income entry SHALL use the same sheet expenses use, opened with an income field configuration (`expense-editing` → *One entry sheet for creating and editing*). The income configuration SHALL list amount, description and date, in that order, followed by the recurrence control in create mode.

The sheet SHALL differ from the expense one only in its wording and its header caption:
- **Titles:** "Nuevo ingreso" in create mode, "Editar ingreso" in edit mode.
- **Primary action:** "Añadir" in create mode, "Guardar" in edit mode, as for an expense.
- **Delete action (edit mode):** "Eliminar ingreso".
- **Caption:** the income label, with no colour dot and no category name. No category selector SHALL be rendered in either mode.

**Create mode:** the amount and description SHALL start empty, and the date SHALL start at today in the user's time zone when the displayed cycle contains today, and otherwise at the cycle's last day.

**Edit mode:** the fields SHALL start with the entry's amount, description and date, and a delete action SHALL be added below the fields.

Its panel, material, header order, row sizes, type sizes and colour use SHALL be those of the expense sheet (`expense-editing` → *Entry sheet appearance*).

#### Scenario: Create from the income panel
- **WHEN** the income panel is open on `/demo` in Spanish and the visitor activates "Añadir ingreso"
- **THEN** the sheet opens titled "Nuevo ingreso", with the income label in the header caption
- **AND** the amount and description are empty, the date is 10 September 2026, and there is no delete action

#### Scenario: Edit preloads the entry
- **WHEN** the visitor activates the "Freelance" row (420 €, 5 September)
- **THEN** the sheet opens titled "Editar ingreso" with the amount 420, the description "Freelance" and the date 5 September 2026
- **AND** an "Eliminar ingreso" action is shown below the fields

#### Scenario: No category anywhere
- **WHEN** the sheet is open for an income entry, in create mode and again in edit mode
- **THEN** no colour dot, category name, category selector or category field is rendered in the sheet
- **AND** its rows are amount, description and date only, plus the recurrence control in create mode

#### Scenario: Same geometry as the expense sheet
- **WHEN** the sheet is opened for an expense and then for an income entry at a 390px-wide viewport, both in create mode
- **THEN** the panel, the header controls and the amount, description and date rows have the same positions and sizes in both

### Requirement: Entry points
The income sheet SHALL open from exactly these triggers:
- **The "add income" row** at the end of the open income panel: opens create mode.
- **An income row in the open income panel:** activating it by tap, click, Enter or Space opens edit mode for that entry.

An income entry SHALL NOT be opened from anywhere else. In particular the `upcoming-charges` card SHALL never list it (`upcoming-charges` → *Only expense charges are listed*), and no category card SHALL contain it.

**Income entries produced by a recurring definition.** Such an entry is a single entry of the current cycle, shown in the income panel like any other.
- Activating its row SHALL open edit mode for that entry only, and the header caption SHALL state that only this cycle's entry changes.
- Saving or deleting it SHALL NOT change the definition it came from, that definition's active state, or the entry of any other cycle.
- This change SHALL provide no way to edit or stop an income recurrence definition: the definition sheet SHALL NOT be reachable for an income definition.

#### Scenario: Keyboard opens edit mode
- **WHEN** keyboard focus is on the "Freelance" row and the user presses Enter
- **THEN** the sheet opens in edit mode for "Freelance"

#### Scenario: The panel's last row is the add row
- **WHEN** the income panel is open on `/demo`
- **THEN** its last row is the "Añadir ingreso" row, below every income row

#### Scenario: A recurring entry edits this month only
- **WHEN** the visitor activates the "Salario" row (2 400 €), which came from a recurring definition, and changes the amount to 2 500 and saves
- **THEN** the header caption stated that only this cycle's entry changes
- **AND** the income column shows 2.920 € and the free margin 944 €
- **AND** a recording implementation receives one update call, for that entry, and no call on the recurring operations

### Requirement: Income fields and validation
**Amount:**
- When the sheet opens, the amount field SHALL have focus and SHALL request the decimal keypad on touch devices. In edit mode its value SHALL be selected, so that typing replaces it.
- It SHALL accept a comma or a period as the decimal separator and at most two decimals.
- Its value SHALL be greater than 0 and at most 9 999 999 999,99. Income SHALL NOT accept a negative amount.
- The user's currency symbol SHALL be shown next to it, on the side where the active language places it.

**Description:**
- Free text, optional.
- Leading and trailing spaces SHALL be removed on save.
- An entry without a description SHALL be listed under the generic income label.

**Date:**
- It SHALL be shown formatted in the active language. Activating it SHALL open the platform's date picker.
- Only days inside the displayed cycle SHALL be selectable.

**Validity:**
- While the amount is empty or invalid, the primary action SHALL be disabled.
- When the amount field loses focus holding an invalid value, a message SHALL appear under it, exposed to assistive technology, stating that an amount above 0 with up to two decimals is expected.

#### Scenario: Comma decimals in Spanish
- **WHEN** the visitor types "12,5" as the amount of a new income entry, in Spanish, and saves
- **THEN** the new row shows "12,50 €"

#### Scenario: Invalid amounts
- **WHEN** the amount is empty, "0", "abc", "-50" or "1,234"
- **THEN** the primary action is disabled
- **AND** once the field loses focus holding one of the non-empty values, a message under it states that an amount above 0 with up to two decimals is expected

#### Scenario: Empty description
- **WHEN** an income entry of 9 is saved without a description, in Spanish
- **THEN** its row is named "Ingreso"

#### Scenario: Date limited to the cycle
- **WHEN** the date field is open for the cycle running 1–30 September 2026
- **THEN** 31 August 2026 and 1 October 2026 cannot be selected

### Requirement: Recurring income
In create mode the income sheet SHALL offer the same recurrence control the expense sheet offers: a switch that, once on, reveals the day of the month and a choice between "sin final" and a number of repetitions, with the same validation and the same reduced-motion behaviour.

When the switch is on and the sheet is saved:
- the cycle's entry SHALL be created through the income create operation, and
- a recurring definition SHALL be created through the recurring create operation, carrying the movement type *income* and no category, the name and amount just typed, the chosen day, and the chosen repetitions (none meaning "sin final").

The two SHALL produce **one** row in the income panel, not two.

The explanation shown under the day SHALL state the amount and the day without naming a category.

An income definition SHALL never produce a row, a dot or a total in the `upcoming-charges` card.

#### Scenario: Recurring income creates one row
- **WHEN** on `/demo` in Spanish the visitor adds 1 200 € described as "Alquiler cobrado", with the recurrence switch on, day 5 and "sin final"
- **THEN** the income panel lists exactly one row named "Alquiler cobrado" with 1.200 €
- **AND** the income column shows 4.020 € and the free margin 2.044 €

#### Scenario: The definition carries the income type and no category
- **WHEN** a recording implementation of the operations is mounted and the visitor saves a recurring income entry of 1 200 € on day 5, ending after 10 repetitions
- **THEN** the recorder receives an income create and a recurring create, in that order
- **AND** the recurring create carries the income type, no category, the name, 1 200, day 5 and 10 repetitions

#### Scenario: The explanation names no category
- **WHEN** the recurrence switch is turned on in the income sheet in Spanish, with 1 200 typed and day 5 chosen
- **THEN** the explanation under the day states the amount and the day
- **AND** it names no category

#### Scenario: Recurrence control only when creating
- **WHEN** the income sheet is opened in edit mode
- **THEN** no recurrence switch, day field or repetitions control is rendered

### Requirement: Saving, dismissal and errors
Dismissal, the absence of any loading state on open, and the busy behaviour while saving or deleting SHALL be those of the expense sheet (`expense-editing` → *Saving, dismissal and errors*).

**On success:**
- After create or update, the sheet SHALL close and announce "Ingreso añadido" or "Cambios guardados" to assistive technology.
- After delete, the sheet SHALL close and show the undo toast (*Income deletes like an expense*).

**On failure:**
- The sheet SHALL stay open with every typed value intact, its actions enabled again.
- It SHALL show an alert at the top of the form: "No se pudo guardar. Inténtalo de nuevo." for a save, "No se pudo eliminar el ingreso" for a delete.
- When the entry saved but the recurring definition did not, the entry SHALL stay created and the alert SHALL be the save alert, so the entry is never silently duplicated by a retry.

#### Scenario: Create updates the income total and the free margin
- **WHEN** on `/demo` in Spanish, with the free margin at 844 €, the visitor adds an income entry of 300 € described as "Bonus"
- **THEN** the sheet closes and "Bonus" is listed with 300 €
- **AND** the income column shows 3.120 €, the free margin 1.144 €, and "Ingreso añadido" is announced

#### Scenario: Failed save
- **WHEN** the injected income update fails
- **THEN** the sheet stays open with the typed amount, description and date
- **AND** an alert reads "No se pudo guardar. Inténtalo de nuevo.", and "Guardar" can be activated again

#### Scenario: Pending save
- **WHEN** an injected income update takes one second to succeed and the user activates "Guardar"
- **THEN** during that second "Guardar" shows a progress indicator, the form is exposed as busy, the fields reject typing, and "Cancelar", Escape and the scrim leave the sheet open
- **AND** afterwards the sheet closes

#### Scenario: Focus returns
- **WHEN** the sheet was opened from the "Freelance" row with the keyboard and is closed with Escape
- **THEN** keyboard focus is on the "Freelance" row

### Requirement: Income deletes like an expense
Every income row in the open income panel SHALL support the leftward drag, the delete panel, the long swipe and the single-open-row rule specified for expense rows (`expense-editing` → *Swipe to delete*), with the same thresholds, motion, contrast and assistive-technology behaviour.

Deleting an income entry SHALL NOT ask for confirmation, whether it comes from the swipe panel, a long swipe or the sheet. It SHALL soft-delete the entry and show a toast with the text "Ingreso eliminado" and a "Deshacer" action, behaving as the expense toast does (`expense-editing` → *Delete with undo*): opaque, announced politely, keyboard-reachable, closing after 5 seconds with the countdown paused while a pointer or focus is on it.

At most one row SHALL be open across the whole page: opening an income row's delete panel SHALL close an open expense row's, and the other way round. Only the latest deletion, of either kind, SHALL be undoable from the toast.

**Failures:**
- If the soft delete fails, the entry SHALL stay listed and an alert toast "No se pudo eliminar el ingreso" SHALL be shown without an undo action.
- If restoring fails, the entry SHALL stay deleted and an alert toast "No se pudo deshacer" SHALL be shown.

#### Scenario: Swipe reveals the delete panel
- **WHEN** at a 390px-wide viewport a touch drags the "Freelance" row 60px left and releases
- **THEN** the row settles open, showing a delete panel with a trash icon and "Eliminar", a quarter of the row's width and at least 44px

#### Scenario: Undo after a long swipe
- **WHEN** the visitor long-swipes the "Freelance" row (420 €) and then activates "Deshacer"
- **THEN** the toast read "Ingreso eliminado" before the undo
- **AND** "Freelance" is listed again with 420 €, the income column shows 2.820 € and the free margin 844 €

#### Scenario: Delete from the sheet
- **WHEN** the visitor opens "Freelance" and activates "Eliminar ingreso"
- **THEN** no confirmation is requested, the sheet closes, and a toast offers "Deshacer"
- **AND** the income column shows 2.400 € and the free margin 424 €

#### Scenario: One open row on the page
- **WHEN** an expense row is swiped open in the "comida" card and the visitor then swipes an income row open
- **THEN** the expense row is closed and the income row is open

#### Scenario: Failed delete
- **WHEN** a swipe deletes an income row and the injected soft delete fails
- **THEN** the row is listed again, closed
- **AND** an alert toast reads "No se pudo eliminar el ingreso" and offers no "Deshacer"

### Requirement: Income moves only income figures
Creating, editing, deleting or restoring an income entry SHALL, in the same render, update the income column's total, the rows of the income panel and the free margin, as defined in `category-editing` → *A budget reserves its amount in the free margin*. Income enters that definition with its whole amount, so an income change SHALL move the free margin by exactly the change in the income total.

It SHALL NOT change any expense figure: no card total, budget bar or remaining text, no expenses total or expenses panel row, no pie slice or legend entry, no bar of the monthly chart, and no row or footer total of the `upcoming-charges` card.

Income entries SHALL NOT appear in any expense surface: not in a category card, not in the expenses panel, not in the pie chart, and not in the monthly spend chart.

#### Scenario: Income does not touch expenses
- **WHEN** on `/demo` in Spanish the visitor adds 300 € of income, edits it to 350 €, and deletes it
- **THEN** after each of those steps the expenses total shows 1.700 €, the pie centre shows 1.700 €, every card total is unchanged, and the "Próximos cobros" footer reads 1.025 €
- **AND** the free margin reads 1.144 €, then 1.194 €, then 844 €

#### Scenario: Income stays out of the expense surfaces
- **WHEN** an income entry named "Bonus" exists and every category card, the expenses panel, the pie legend and the monthly chart are inspected
- **THEN** "Bonus" appears in none of them

#### Scenario: Free margin follows the three totals
- **WHEN** on `/demo` the income total is 2 820, the cycle's savings 146, and the expense side of the free margin 1 830 (recurring charges 1 025, budgets reserved 650, unbudgeted spending 155)
- **THEN** the free margin shows 844 €
- **AND** after an income entry of 300 € is added it shows 1.144 €
