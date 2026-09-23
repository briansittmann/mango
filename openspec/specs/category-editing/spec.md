# Category Editing Specification

## Purpose

Lets people rename a category, change its colour, set or clear its monthly budget, and delete it with its expenses moved to another category, all from one sheet opened from the category card. A budget belongs to one cycle and works as an envelope: it drives its category's tracking — the progress bar, the weekly available figure and the bot's pace answer — and reserves its whole amount in the free margin, which this capability defines.

## Requirements

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

This requirement describes the sheet as it opens **for an existing category**. The same sheet also opens in a create mode, described by the `category-creation` capability: the panel, the sizes, the colour rules and the viewport constraints below apply to it unchanged, while its title, its primary action and the contents of its body differ.

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

#### Scenario: Create mode shares the panel and drops the two rows

- **WHEN** the sheet is opened in create mode at a 390 × 844 viewport
- **THEN** the panel's geometry, handle, scrim and row sizes are the same as when it is open for "comida"
- **AND** its body ends with the colour picker, showing no "Reordenar" row and no "Eliminar categoría" row

### Requirement: Category fields and validation

The fields below are the sheet's fields in both of its modes. Their **preloaded values** are described here for the sheet opened on an existing category; the values create mode starts from are described by the `category-creation` capability.

**Name:**
- A text field holding the category's current name, focused when the sheet opens.
- Leading and trailing spaces SHALL be removed on save. An empty name SHALL be invalid.
- A name already used by another category SHALL report in place, next to the field, and SHALL keep what was typed. The message SHALL be exposed to assistive technology.

**Colour:**
- The palette colours SHALL be offered inline as swatches, in one group with radio semantics, exposing which one is selected. The palette SHALL be a closed list: there SHALL be no free colour input.
- Each swatch's accessible name SHALL be the colour's name in the active language, never its hex value.
- Each swatch SHALL be a 28px circular token inside a hit area of at least 44 × 44px, and SHALL carry a hairline ring so that the lightest and darkest swatches stay distinguishable from the sheet in both themes.
- The selected swatch SHALL be marked by a checkmark as well as by its ring, so selection never rests on colour alone.
- The brand lime, the warning colour and the destructive colour SHALL NOT be offered, those three being reserved for the brand and for budget state. A category colour that merely reads as red SHALL NOT be confused with them: it is its own palette token and SHALL NOT be drawn from the warning or destructive tokens.
- Both modes SHALL offer the same swatches in the same order.

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
- **THEN** the swatches are exposed as a radio group whose accessible names are the colour names in the active language, and none of the names contains a hex value
- **AND** the selected swatch is exposed as checked and shows a checkmark
- **AND** no swatch is drawn from the brand lime, the warning colour or the destructive colour

#### Scenario: The same swatches in both modes

- **WHEN** the picker is rendered for "comida" and then in create mode
- **THEN** both show the same number of swatches, with the same accessible names in the same order

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

### Requirement: Saving, dismissal and errors

The rules below govern the sheet in both of its modes. Where they name the category being edited, the create mode's equivalent is the category being created, as the `category-creation` capability describes.

**Saving:** the name, the colour and the budget SHALL be saved together by the primary action, as one change. Renaming, recolouring and changing a budget SHALL NOT ask for confirmation.

**Dismissal:**
- "Cancelar" and Escape SHALL close the sheet without saving.
- Pressing the scrim or swiping the panel down SHALL close it only while every field still holds its initial value. Otherwise the sheet SHALL stay open.
- On close, keyboard focus SHALL return to the control that opened the sheet — the card's options control, or the "Añadir categoría" tile in create mode — or to the header of its card when that control no longer exists.

**Opening:** the sheet SHALL NOT load anything when it opens. Its values SHALL come from the card that opened it, or from the defaults create mode starts with, so it has no loading state of its own.

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

#### Scenario: Create mode returns focus to the tile

- **WHEN** the sheet was opened from the "Añadir categoría" tile with the keyboard and is closed with Escape
- **THEN** keyboard focus is on the tile

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
