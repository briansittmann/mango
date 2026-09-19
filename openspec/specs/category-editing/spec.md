# Category Editing Specification

## Purpose

Lets people rename a category, change its colour, set or clear its monthly budget, and delete it with its expenses moved to another category, all from one sheet opened from the category card. A budget drives tracking only — the progress bar, the weekly available figure and the bot's pace answer — and never changes how much money the dashboard says is free.

## Requirements

### Requirement: Category changes go through injected operations

The page that mounts the dashboard SHALL supply category changes as two operations. Every data source SHALL provide them with the same inputs and outcomes:

- **update:** replaces a category's name, colour and budget together, from one saved form
- **delete:** removes a category and moves its expenses to another category

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change categories only through these operations.

**Update:**
- The budget SHALL be either an amount above 0 or "no budget". "No budget" SHALL remove the category's budget, and an amount SHALL set or replace it.
- Update SHALL NOT change any expense's amount, description, date or category, and SHALL NOT change any other category.
- A name already used by another of the user's categories SHALL be rejected, and that rejection SHALL be distinguishable by the caller from every other failure.

**Delete:**
- Delete SHALL move every expense of the category to the category named in the call, in every cycle and not only the displayed one, leaving each expense's amount, description and date unchanged.
- Delete SHALL remove the category's budget with it. The receiving category's own budget SHALL NOT change.
- A category SHALL only be deleted without naming a receiving category when it has no expenses in any cycle.

#### Scenario: Update recomputes every derived figure

- **WHEN** on `/demo` in Spanish the visitor renames "Comida" to "Comida y bebida", changes its colour to `blanco` and its budget to 600, and saves
- **THEN** the card header, the expenses summary row and the pie legend all read "Comida y bebida" with the new colour dot
- **AND** the card shows 310 € of 600 € with "Te quedan 96 € por semana"
- **AND** the expenses total shows 1.700 € and the free margin shows 974 €

#### Scenario: Same operations on another data source

- **WHEN** the dashboard is mounted with an implementation of the two operations that records its calls instead of the demo's
- **AND** the visitor saves a rename of "ocio", then deletes "hogar" onto "compras"
- **THEN** the recorder receives update (the "ocio" category, its name, colour and budget) and delete (the "hogar" category, the "compras" category), in that order
- **AND** no dashboard component needed a change for that data source

#### Scenario: A failed operation changes nothing

- **WHEN** the injected update rejects
- **THEN** the category keeps its previous name, colour and budget in every place they are shown
- **AND** the expenses total and the free margin are unchanged

### Requirement: Opening the category sheet

Every expense card SHALL carry an options control in its header, positioned between the amount and the chevron. The `upcoming-charges` card is not an expense card and SHALL NOT carry one.

- The control SHALL have a hit area of at least 44 × 44 CSS pixels, and pressing it SHALL NOT activate the disclosure.
- Its accessible name SHALL include the category's name, so that the controls of two cards never share an accessible name.
- Activating it by tap, click, Enter or Space SHALL open the category sheet for that category.
- On a narrow viewport the sheet SHALL rise from the bottom edge. On a wide viewport it SHALL be anchored to the control that opened it.
- When the mounting page supplies no category operations, the control SHALL be rendered disabled (*Controls without a handler are disabled*).

The sheet SHALL be reachable without a gesture. Any press-and-hold or swipe SHALL only ever be an addition to this control, never the sole route to it.

#### Scenario: One options control per category card

- **WHEN** `/demo` is rendered in Spanish
- **THEN** each of the seven category cards has an options control in its header, "Vivienda" included
- **AND** the "Próximos cobros" card has no options control, its disclosure being its only control

#### Scenario: Accessible names name the category

- **WHEN** the options controls are listed by their accessible names, in Spanish and then in English
- **THEN** the "comida" card's control reads "Opciones de Comida" and then "Food options"
- **AND** no two controls on the page share an accessible name

#### Scenario: Control and disclosure are separate targets

- **WHEN** the "comida" card header is rendered at a 390px-wide viewport
- **THEN** the disclosure and the options control are two controls, neither containing the other
- **AND** each has a hit area at least 44px wide and 44px tall that responds to a pointer press at its centre
- **AND** a press at the centre of the options control leaves the disclosure's expanded state unchanged
- **AND** the category name is still truncated with an ellipsis when it is too long for the row

#### Scenario: Keyboard reaches the control

- **WHEN** the user moves keyboard focus forward from the "comida" card's disclosure
- **THEN** focus reaches that card's options control, and pressing Enter opens the sheet

#### Scenario: Opening does not toggle the card

- **WHEN** the "comida" card is collapsed and the visitor activates its options control
- **THEN** the sheet opens and the card is still collapsed

### Requirement: Category sheet layout

The sheet SHALL present the category's name, colour and budget together on one surface, and SHALL resolve every one of its steps on that same surface. It SHALL NOT open a second sheet, dialog or menu over itself.

**Panel:** it SHALL follow the entry sheet's appearance — a floating panel at most 440px wide, 12–16px from the left, right and bottom edges plus the bottom safe area on a narrow viewport, all four corners rounded, a drag handle centred at the top, and a dimmed scrim behind it. Every label, value, caption, icon and button SHALL be drawn at full opacity.

**Header**, from the leading edge to the trailing edge, on a single row:
- a "Cancelar" action
- the title: the category's colour dot immediately followed by its name
- the primary action, "Guardar"

The header SHALL NOT repeat the name, the dot or both as a caption under the title.

The title's dot SHALL show the colour **currently selected in the picker**, not the saved one: choosing another colour SHALL recolour it immediately, before "Guardar" is activated, and cancelling SHALL leave the category's saved colour untouched. It is the sheet's only preview of the colour outside the picker itself.

**Body**, in this order:
- the name field
- the budget field
- the colour picker
- a full-width divider, then "Reordenar", which is not a field of the form: it saves nothing about this category and instead turns on reorder mode for the whole screen, as described in the `category-reordering` capability
- a second full-width divider, then "Eliminar categoría" as the last element of the sheet, showing a trash icon and text in the destructive colour

The three fields SHALL be the only things "Guardar" writes. The two rows under them SHALL each be separated from the fields and from each other by a divider, so that neither reads as a fourth field.

**Sizes:** every field row, the reorder row and the delete row SHALL be at least 48px tall, every control SHALL have a hit area of at least 44 × 44px, no text SHALL compute below 12px, and editable text SHALL compute at 16px or larger.

**Colour:** the brand colour SHALL appear only on the primary action and focus indicators, and the destructive colour only on the delete action and its confirmation. The warning colour SHALL NOT appear. The reorder row SHALL carry neither the brand nor the destructive colour.

At a 390px-wide viewport, with the longest label of either language, a category name of eight words, and text scaled to 200%, no content SHALL be clipped and the page SHALL NOT scroll horizontally. The title is the one exception: rather than widen the header, it SHALL truncate with an ellipsis, so that "Cancelar" and "Guardar" always stay inside the panel and reachable however long the name being typed is.

#### Scenario: Order and geometry

- **WHEN** the sheet is open for "comida" at a 390 × 844 viewport
- **THEN** the panel's left and right edges are 12–16px from the viewport edges and its bottom edge is 12–16px above the bottom edge, all four corner radii are non-zero, and a handle is centred at the top
- **AND** from top to bottom it shows the header, the name field, the budget field, the colour picker, a divider, "Reordenar", a divider and "Eliminar categoría"
- **AND** "Cancelar" is the leading header control and "Guardar" the trailing one

#### Scenario: The title names the category

- **WHEN** the sheet is open for "comida", in Spanish and then in English
- **THEN** its accessible name includes "Comida" and then "Food"
- **AND** the title shows the category's colour dot immediately before its name, on the same row as "Cancelar" and "Guardar"
- **AND** no caption under the title repeats the name or the dot

#### Scenario: The title's dot follows the picker, not the saved colour

- **WHEN** the visitor opens the sheet for "comida" and selects a different colour in the picker without saving
- **THEN** the dot beside the title takes the newly selected colour straight away
- **AND** the "comida" card behind the sheet still shows its saved colour

#### Scenario: A long name keeps the header's actions reachable

- **WHEN** the visitor types a name of eight words into the name field at a 390px-wide viewport
- **THEN** the title truncates with an ellipsis
- **AND** "Cancelar" and "Guardar" are both still fully inside the panel

#### Scenario: One surface only

- **WHEN** the sheet is open and the visitor moves through the colour picker and opens the delete confirmation
- **THEN** exactly one dialog is present on the page at every point

#### Scenario: Reordenar is not a field

- **WHEN** the sheet is open for "comida" and the visitor changes the name, the budget and the colour, then activates "Guardar"
- **THEN** the category's name, budget and colour are saved and its position among the cards is unchanged
- **AND** the "Reordenar" row was never part of what "Guardar" wrote

#### Scenario: Row and target sizes

- **WHEN** the sheet is open at a 390px-wide viewport
- **THEN** every field row, the reorder row and the delete row is at least 48px tall
- **AND** every button, input and swatch has a hit area of at least 44 × 44px, and no text is smaller than 12px

#### Scenario: Long strings and large text

- **WHEN** the sheet is open at a 390px-wide viewport for a category named "Comida fuera de casa y bebidas para compartir", with text scaled to 200%
- **THEN** no text is clipped and the document does not scroll horizontally

### Requirement: Category fields and validation

**Name:**
- A text field holding the category's current name, focused when the sheet opens.
- Leading and trailing spaces SHALL be removed on save. An empty name SHALL be invalid.
- A name already used by another category SHALL report in place, next to the field, and SHALL keep what was typed. The message SHALL be exposed to assistive technology.

**Colour:**
- The eight palette colours SHALL be offered inline as swatches, in one group with radio semantics, exposing which one is selected.
- Each swatch's accessible name SHALL be the colour's name in the active language, never its hex value.
- Each swatch SHALL be a 28px circular token inside a hit area of at least 44 × 44px, and SHALL carry a hairline ring so that the lightest and darkest swatches stay distinguishable from the sheet in both themes.
- The selected swatch SHALL be marked by a checkmark as well as by its ring, so selection never rests on colour alone.
- Amber, red and lime SHALL NOT be offered.

**Budget:**
- An optional amount field, empty when the category has no budget.
- It SHALL accept a comma or a period as the decimal separator and at most two decimals, and its value SHALL be greater than 0 and at most 9 999 999 999,99.
- The user's currency symbol SHALL be shown next to it, on the side where the active language places it.
- **Leaving it empty SHALL mean the category has no budget**, and SHALL be how an existing budget is removed. There SHALL be no separate action to remove a budget.
- With the virtual keyboard open at a 390 × 667 viewport, the focused budget field SHALL stay visible above the keyboard.

**Validity:** while the name is empty or the budget holds an invalid amount, the primary action SHALL be disabled. A validation message SHALL never clear what the user typed.

#### Scenario: Fields preloaded from the category

- **WHEN** the sheet opens for "comida" on `/demo` in Spanish
- **THEN** the name field holds "Comida" and has keyboard focus, the `naranja_calido` swatch is the selected one, and the budget field holds 400

#### Scenario: A category without a budget

- **WHEN** the sheet opens for a category that has no budget
- **THEN** the budget field is empty and the primary action is enabled

#### Scenario: Swatches are named and marked

- **WHEN** the colour picker is rendered in Spanish and then in English
- **THEN** the swatches are exposed as a radio group of eight options whose accessible names are the colour names in the active language, and none of the names contains a hex value
- **AND** the selected swatch is exposed as checked and shows a checkmark
- **AND** no swatch offers amber, red or lime

#### Scenario: Swatch targets and hairline

- **WHEN** the colour picker is rendered at a 390px-wide viewport, in the light theme and then in the dark theme
- **THEN** each swatch has a hit area at least 44 × 44px
- **AND** the `blanco` and `gris_oscuro` swatches each have a visible ring separating them from the sheet behind

#### Scenario: Duplicate name reports in place

- **WHEN** the visitor opens the sheet for "ocio", types "Comida" as the name and saves
- **THEN** the sheet stays open with "Comida" still in the field, and a message next to the field says the name is already used
- **AND** the message is exposed to assistive technology, and the "ocio" card is still named "Ocio"

#### Scenario: Invalid budgets

- **WHEN** the budget is "0", "abc" or "1,234"
- **THEN** the primary action is disabled, and what was typed is still in the field

#### Scenario: Empty name is invalid

- **WHEN** the visitor clears the name field
- **THEN** the primary action is disabled

#### Scenario: Keyboard does not cover the budget field

- **WHEN** the sheet is open at a 390 × 667 viewport and the budget field takes focus with the virtual keyboard shown
- **THEN** the budget field is fully visible above the keyboard

### Requirement: A budget tracks spending and never reserves money

A budget SHALL only drive what is shown for its own category: the progress bar and its colour, the "spent of budget" header figure, the remaining and weekly available text, and the pace answer. It SHALL NOT reserve, withhold or commit any money.

The free margin SHALL remain what the dashboard already computes: the cycle's income, minus the cycle's savings, minus every non-deleted expense in the cycle, fixed charges included, whether pending or confirmed. **No budget SHALL appear in that calculation.** Consequently:

- Setting, raising, lowering or clearing a budget SHALL NOT change the free margin.
- Spending in a category with a budget SHALL lower the free margin by exactly the amount spent, the same as spending in a category with no budget.
- Spending beyond a budget SHALL lower the free margin by exactly the amount spent and no more. An exceeded budget SHALL NOT be counted twice or carry any further penalty.

Setting a budget SHALL make the progress bar appear on that category's card; clearing it SHALL leave the plain total and no bar.

Unused budget SHALL NOT roll over. At the end of a cycle it SHALL NOT be carried to the next one, swept into savings, or stored anywhere. A finished cycle SHALL keep showing what was spent against the budget it had.

#### Scenario: Setting a budget leaves the free margin alone

- **WHEN** on `/demo` in Spanish, with the free margin at 974 €, the visitor changes "comida" from 400 to 600 and saves
- **THEN** the "comida" card shows 310 € of 600 € with a bar below the warning threshold
- **AND** the free margin still shows 974 € and the expenses total still shows 1.700 €

#### Scenario: Lowering a budget past what is spent

- **WHEN** the visitor changes "comida" from 400 to 200 and saves
- **THEN** the card shows 310 € of 200 €, a full bar in the danger colour and "110 € por encima del presupuesto"
- **AND** the free margin still shows 974 €

#### Scenario: Clearing a budget removes only the bar

- **WHEN** the visitor clears the budget field for "comida" and saves
- **THEN** the card header shows 310 € as a plain total, and no progress bar or remaining text is shown on it
- **AND** the free margin still shows 974 € and the expenses total still shows 1.700 €

#### Scenario: Setting a budget brings the bar back

- **WHEN** the visitor then sets "comida" back to 400 and saves
- **THEN** the card shows 310 € of 400 € with "Te quedan 30 € por semana"
- **AND** the free margin still shows 974 €

#### Scenario: Spending over budget costs exactly what was spent

- **WHEN** on `/demo` in Spanish the visitor adds an expense of 20 € to "transporte", which already shows 130 € of 100 €
- **THEN** the card shows 150 € of 100 € and the free margin shows 954 €
- **AND** in a separate run, clearing "transporte"'s budget first and then adding the same 20 € leaves the free margin at 954 € as well

#### Scenario: A finished cycle keeps its figures

- **WHEN** a cycle that has ended is displayed for a category that spent 310 € of a 400 € budget
- **THEN** the card still shows 310 € of 400 €
- **AND** no leftover budget appears in the next cycle's free margin, savings or any other figure

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
- **AND** the expenses total still shows 1.700 € and the free margin still shows 974 €

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
- **AND** confirming removes the card, leaving the expenses total at 1.660 € and the free margin at 1.014 €

#### Scenario: The destructive action is not the primary one

- **WHEN** the delete confirmation is shown
- **THEN** the confirming action is not styled as the sheet's primary action, and Cancel is reachable first by keyboard

### Requirement: Saving, dismissal and errors

**Saving:** the name, the colour and the budget SHALL be saved together by the primary action, as one change. Renaming, recolouring and changing a budget SHALL NOT ask for confirmation.

**Dismissal:**
- "Cancelar" and Escape SHALL close the sheet without saving.
- Pressing the scrim or swiping the panel down SHALL close it only while every field still holds its initial value. Otherwise the sheet SHALL stay open.
- On close, keyboard focus SHALL return to the options control that opened the sheet, or to the header of its card when that control no longer exists.

**Opening:** the sheet SHALL NOT load anything when it opens. Its values SHALL come from the card that opened it, so it has no loading state of its own.

**While saving or deleting:**
- the activated action SHALL show a progress indicator
- the form SHALL be exposed to assistive technology as busy
- fields and other actions SHALL NOT accept input
- the sheet SHALL NOT close by any means

**On success:** the sheet SHALL close and announce the change to assistive technology.

**On failure:**
- The sheet SHALL stay open with every typed value intact.
- It SHALL show an alert at the top of the form, distinguishing a failed save from a failed delete.
- Its actions SHALL be enabled again.

#### Scenario: Saving applies without confirmation

- **WHEN** the visitor changes the name, the colour and the budget of "ocio" and activates "Guardar"
- **THEN** no confirmation is requested, the sheet closes, and all three changes are shown on the card

#### Scenario: Pending save

- **WHEN** an injected update takes one second to succeed and the visitor activates "Guardar"
- **THEN** during that second "Guardar" shows a progress indicator, the form is exposed as busy, the fields reject typing, and "Cancelar", Escape and the scrim leave the sheet open
- **AND** afterwards the sheet closes

#### Scenario: Failed save

- **WHEN** the injected update fails
- **THEN** the sheet stays open with the typed name, the chosen colour and the typed budget
- **AND** an alert says the change could not be saved, and "Guardar" can be activated again

#### Scenario: Unsaved edits survive a stray tap

- **WHEN** the visitor has typed a new name and presses the scrim
- **THEN** the sheet stays open with the typed name
- **AND** activating "Cancelar" then closes it without changing the category

#### Scenario: Focus returns to the opener

- **WHEN** the sheet was opened from the "comida" card's options control with the keyboard and is closed with Escape
- **THEN** keyboard focus is on that card's options control
