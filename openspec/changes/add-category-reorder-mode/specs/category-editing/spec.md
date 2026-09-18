## MODIFIED Requirements

### Requirement: Category sheet layout

The sheet SHALL present the category's name, colour and budget together on one surface, and SHALL resolve every one of its steps on that same surface. It SHALL NOT open a second sheet, dialog or menu over itself.

**Panel:** it SHALL follow the entry sheet's appearance — a floating panel at most 440px wide, 12–16px from the left, right and bottom edges plus the bottom safe area on a narrow viewport, all four corners rounded, a drag handle centred at the top, and a dimmed scrim behind it. Every label, value, caption, icon and button SHALL be drawn at full opacity.

**Header**, from the leading edge to the trailing edge:
- a "Cancelar" action
- the title, naming the category, with the category's colour dot and name as a caption under it
- the primary action, "Guardar"

**Body**, in this order:
- the name field
- the budget field
- the colour picker
- a full-width divider, then "Reordenar", which is not a field of the form: it saves nothing about this category and instead turns on reorder mode for the whole screen, as described in the `category-reordering` capability
- a second full-width divider, then "Eliminar categoría" as the last element of the sheet, showing a trash icon and text in the destructive colour

The three fields SHALL be the only things "Guardar" writes. The two rows under them SHALL each be separated from the fields and from each other by a divider, so that neither reads as a fourth field.

**Sizes:** every field row, the reorder row and the delete row SHALL be at least 48px tall, every control SHALL have a hit area of at least 44 × 44px, no text SHALL compute below 12px, and editable text SHALL compute at 16px or larger.

**Colour:** the brand colour SHALL appear only on the primary action and focus indicators, and the destructive colour only on the delete action and its confirmation. The warning colour SHALL NOT appear. The reorder row SHALL carry neither the brand nor the destructive colour.

At a 390px-wide viewport, with the longest label of either language, a category name of eight words, and text scaled to 200%, no content SHALL be clipped and the page SHALL NOT scroll horizontally.

#### Scenario: Order and geometry

- **WHEN** the sheet is open for "comida" at a 390 × 844 viewport
- **THEN** the panel's left and right edges are 12–16px from the viewport edges and its bottom edge is 12–16px above the bottom edge, all four corner radii are non-zero, and a handle is centred at the top
- **AND** from top to bottom it shows the header, the name field, the budget field, the colour picker, a divider, "Reordenar", a divider and "Eliminar categoría"
- **AND** "Cancelar" is the leading header control and "Guardar" the trailing one

#### Scenario: The title names the category

- **WHEN** the sheet is open for "comida", in Spanish and then in English
- **THEN** its accessible name includes "Comida" and then "Food"
- **AND** the header caption shows the category's colour dot next to its name

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
