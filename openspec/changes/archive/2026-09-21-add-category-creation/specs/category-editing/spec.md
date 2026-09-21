## MODIFIED Requirements

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
