## MODIFIED Requirements

### Requirement: Movement rows
Each row SHALL show, from start to end: a leading mark of its kind, its description over a muted line that names its kind, and its amount.
- An expense SHALL lead with its category's colour and name the category on the muted line; its amount SHALL carry no sign, as everywhere else on the dashboard.
- An income entry SHALL lead with an incoming mark, read "Ingreso" on the muted line, and show its amount with a "+" in the brand text colour.
- A savings movement SHALL lead with a savings mark, read "Depósito" or "Retiro" on the muted line, and show its amount with "+" for a deposit and "−" for a withdrawal in the regular text colour. A deposit the user already had (`savings-editing` → *A deposit the user already had*) SHALL read "Depósito · Ya ahorrado" on the muted line.

A row with no description SHALL show its category name (expense), "Ingreso" or the savings kind in its place. Colour SHALL never be the only way to tell the kind: the muted line always names it. The row's accessible name SHALL carry the description, the kind (or category), the day and the amount with its sign.

The card SHALL NOT state a total of any kind: not for the cycle, a day, a filter or a page.

#### Scenario: Three kinds side by side
- **WHEN** the card is open on `/demo` in Spanish under "sáb 5 sept"
- **THEN** "Cine" shows the "Ocio" colour, "Ocio" on its muted line and "45 €"
- **AND** "Freelance" shows "Ingreso" on its muted line and "+420 €" in the brand text colour

#### Scenario: A withdrawal
- **WHEN** the card shows "Retiro emergencia"
- **THEN** its muted line reads "Retiro" and its amount reads "−80 €" in the regular text colour

#### Scenario: A deposit already saved
- **WHEN** the visitor saves a deposit of 1.000 named "Ahorros de antes" with "Ya lo tenía ahorrado" on
- **THEN** its row in the card reads "Depósito · Ya ahorrado" on the muted line and "+1.000 €"

#### Scenario: No totals
- **WHEN** the card is open with any filter
- **THEN** no day heading, header or footer of the card shows a summed amount

### Requirement: Row actions
Activating an expense row SHALL open the expense sheet for that row, as from its category card. Activating an income row SHALL open the income sheet for that entry, as from the income panel. Activating a savings row SHALL open the savings sheet in edit mode for that movement, as from the savings panel (`savings-editing` → *Editing a savings movement*). Every row SHALL support swipe-to-delete with the same undo toast as its category card or panel, and a delete undone SHALL bring the row back in the card. When the page supplies no handler for a kind (the corresponding mutations are absent), its rows SHALL be read-only.

#### Scenario: Edit from the list
- **WHEN** the visitor activates "Conciertos" in the card
- **THEN** the expense sheet opens for "Conciertos" with its amount 85 €, and saving a new amount updates the row in the card and in the "Ocio" card

#### Scenario: Swipe to delete with undo
- **WHEN** the visitor swipes "Electrónica" away in the card
- **THEN** it disappears from the card and from the "Compras" card, an undo toast is shown, and activating "Deshacer" brings it back in both

#### Scenario: Savings rows open the savings sheet
- **WHEN** the visitor activates the "Bono ahorro" row
- **THEN** the sheet "Editar movimiento" opens with "Bono ahorro" and 50, and saving 80 updates the row in the card and in the savings panel
