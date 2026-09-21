## MODIFIED Requirements

### Requirement: Controls without a handler are disabled
Every control that triggers a data action (previous/next cycle, add expense, add income, add savings movement, add category, log out) SHALL be rendered disabled when the mounting page supplies no handler for it.

When the mounting page supplies no expense operations:
- the "add expense" rows SHALL be disabled
- expense rows SHALL NOT open the entry sheet and SHALL NOT move when dragged
- expense amounts SHALL be shown as plain text, without the editable-looking background

When the mounting page supplies no income operations:
- the "add income" row SHALL be disabled
- income rows SHALL NOT open the entry sheet and SHALL NOT move when dragged
- income amounts SHALL be shown as plain text, without the editable-looking background

When the mounting page supplies no category operations:
- the options control on every category card header SHALL be disabled
- activating it SHALL NOT open the category sheet
- the "Añadir categoría" tile SHALL be disabled, SHALL NOT open the category sheet, and SHALL show neither its hover nor its pressed appearance. It SHALL stay in place rather than disappear, so the end of the list does not change shape according to what the page supplies.

#### Scenario: Demo without month navigation
- **WHEN** the dashboard is mounted without previous/next cycle handlers
- **THEN** both month chevrons are disabled and activating them does nothing

#### Scenario: Dashboard without expense operations
- **WHEN** the dashboard is mounted without expense operations and the "comida" card is expanded
- **THEN** "Añadir gasto" is disabled
- **AND** tapping or dragging an expense row opens nothing and does not move the row, and its amount has a transparent background

#### Scenario: Dashboard without income operations
- **WHEN** the dashboard is mounted without income operations and the income panel is opened
- **THEN** "Añadir ingreso" is disabled
- **AND** tapping or dragging an income row opens nothing and does not move the row, and its amount has a transparent background

#### Scenario: Dashboard without category operations
- **WHEN** the dashboard is mounted without category operations
- **THEN** the options control on each category card header is disabled, and activating it opens nothing
- **AND** the disclosure still expands and collapses the card

#### Scenario: The tile without a create handler
- **WHEN** the dashboard is mounted without category operations
- **THEN** the "Añadir categoría" tile is present at the end of the list and exposed as disabled
- **AND** activating it opens no sheet, and hovering and pressing it leave its appearance unchanged
