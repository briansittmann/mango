## REMOVED Requirements

### Requirement: A row opens its definition, and nothing else does
**Reason**: The definition sheet is gone (`recurring-expenses` → *One sheet for a fixed row*): a row now opens the same sheet as its charge in its category card.
**Migration**: *A row opens its charge's sheet, and nothing else does* keeps every rule of the card's controls and changes only what a row opens.

## ADDED Requirements

### Requirement: A row opens its charge's sheet, and nothing else does

Activating a row by tap, click, Enter or Space SHALL open the sheet of that charge, in the cycle shown, exactly as activating the same charge in its category card does (`recurring-expenses` → *One sheet for a fixed row*). Each row SHALL be a button, named by its charge, at least 48px tall, reachable in reading order by keyboard, and with a visible focus indicator.

Nothing else in the card SHALL be editable, and nothing else SHALL suggest it is:

- The card's only controls SHALL be its disclosure, the taken-charges line and its rows. No row SHALL offer a delete panel or respond to a drag; the card SHALL NOT have an add row; and no value inside a row SHALL be a form field.
- No amount, name, day or caption in the card SHALL sit on a surface other than the card, apart from the day number on its tinted mark. Amounts in particular SHALL have a transparent background, unlike the amounts on an expense card, which look editable at rest.
- The card SHALL NOT explain what a row opens: no helper text, caption, tooltip or hint SHALL say that the rows change every month, that they are counted in their categories, or that editing happens elsewhere. The sheet that opens states its own scope.
- Activating a row SHALL NOT change any value.
- When the mounting page supplies no expense or recurring operations, the rows SHALL be rendered disabled rather than inert (`dashboard-ui` → *Controls without a handler are disabled*). The taken-charges line SHALL still fold and unfold.

#### Scenario: A row opens its charge
- **WHEN** the card is expanded on `/demo` in Spanish, its taken charges are shown, and the "Alquiler" row is activated by tap, and separately by click and by Enter
- **THEN** each time, the sheet "Editar gasto" opens captioned "Vivienda · Se repite cada mes", holding 820 € and 1 September 2026
- **AND** no value on the page changes

#### Scenario: Two rows, one sheet
- **WHEN** the visitor activates "Alquiler" in "Próximos cobros" and, separately, the "Alquiler" row in the "Vivienda" card
- **THEN** both open the same sheet, with the same fields and the same fixed's section

#### Scenario: A projected charge
- **WHEN** the visitor opens the October 2026 projection and activates "Alquiler" in "Próximos cobros"
- **THEN** the sheet opens holding 820 € and the date "Alquiler" falls on in October

#### Scenario: Still nothing else responds
- **WHEN** each row of the expanded card is dragged 60px to the left
- **THEN** no delete panel is revealed and no row moves

#### Scenario: Flat amounts
- **WHEN** the card is expanded next to an expanded expense card, in both themes
- **THEN** every amount in "Próximos cobros" has a transparent background, while every amount in the expense card has an opaque background different from its row's

#### Scenario: Rows are keyboard controls
- **WHEN** the visitor moves keyboard focus through the expanded card with its taken charges shown
- **THEN** focus reaches the disclosure, then each pending row in the order listed, then the taken-charges line, then each taken row in the order listed, each showing a visible focus indicator
- **AND** each row is exposed as a button named by its charge, and each row's hit area is at least 48px tall

#### Scenario: No explanation
- **WHEN** the card is rendered in Spanish and in English, collapsed and expanded
- **THEN** no text states what activating a row does, that the charges are included in their categories, or that they are counted once

#### Scenario: No add row
- **WHEN** the card is expanded
- **THEN** it has no add row, and its last element is the footer line
