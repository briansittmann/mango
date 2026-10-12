## Purpose

The "Movimientos" card: one chronological list of everything the user entered in the shown cycle (one-off expenses, non-recurring income, savings deposits and withdrawals), grouped by day, filterable by kind and paged, so the user can check what is already in without opening every category.

## ADDED Requirements

### Requirement: Movements card
The dashboard SHALL show a "Movimientos" card in the main column, after the category cards and the "Añadir categoría" tile, in every cycle (in progress, past and projected). Its header SHALL be a disclosure for the whole card with the title "Movimientos", the number of movements the card holds for the cycle (all kinds, whatever the filter) and a chevron; it SHALL state no amount.

The card SHALL be open by default at viewports of 1024px and wider and folded by default below 1024px. Toggling it SHALL only change this card; "Contraer todas" / "Expandir todas" and "Colapsar todo" SHALL NOT change it. While the category reorder mode is on, the card SHALL be hidden from assistive technology and SHALL NOT respond to input, like the rest of the page outside the list.

#### Scenario: Folded on a phone
- **WHEN** `/demo` is rendered at a 390px-wide viewport
- **THEN** the "Movimientos" card is the last card of the main column, below "Añadir categoría", its header reads "Movimientos" and "13", and its list is folded

#### Scenario: Open on a laptop
- **WHEN** `/demo` is rendered at a 1280px-wide viewport
- **THEN** the "Movimientos" card is open in the main column, under the category cards

#### Scenario: Not part of collapse all
- **WHEN** at 1280px the visitor activates "Contraer todas"
- **THEN** every category card folds and the "Movimientos" card stays open

#### Scenario: Header states no amount
- **WHEN** the card is rendered, open or folded
- **THEN** its header shows no currency amount

### Requirement: Only what the user entered
The card SHALL list, for the shown cycle, exactly the movements the user entered:
- expense rows that are not linked to a recurring definition and are not projected charges,
- income entries that are not linked to a recurring definition and are not projected,
- every savings movement (deposits and withdrawals).

A recurring charge or recurring income entry SHALL NOT appear in the card, whether it is pending, taken, completed from the chat or edited for one month, and whatever channel created it. A movement entered from WhatsApp SHALL appear like one entered on the web. A deleted row SHALL disappear from the card at the same time it disappears from its category card or panel, and come back with it on undo.

#### Scenario: The demo's movements
- **WHEN** `/demo` is rendered in Spanish
- **THEN** the card holds 13 movements: the nine one-off expenses (Supermercado, Restaurante, Café, Cine, Conciertos, Gasolina, Ropa, Electrónica, Decoración), the "Freelance" income and the three savings movements
- **AND** Alquiler, Internet, Seguro, Gimnasio, Limpieza, Parking and Salario do not appear

#### Scenario: A newly entered expense appears
- **WHEN** the visitor adds an expense "Farmacia" of 12 € dated 9 September in "salud"
- **THEN** "Farmacia" appears in the card under 9 September and the header count reads 14

#### Scenario: A projected cycle
- **WHEN** a projected cycle is shown and the user entered nothing in it
- **THEN** the card is rendered with its empty state and no projected charge or projected income is listed

### Requirement: Grouped by day, newest first
Movements SHALL be grouped by their local day in the user's timezone, days newest first. Within a day, movements SHALL be ordered by their stored instant, newest first. Each day SHALL have a heading: "Hoy" for the cycle's today, "Ayer" for the day before, and otherwise the short weekday, the day and the short month in the active language (for example "jue 10 sept" / "Thu Sep 10", with no comma). A day heading SHALL state no amount.

#### Scenario: The demo's first days
- **WHEN** the card is open on `/demo` in Spanish
- **THEN** the first heading reads "jue 10 sept" over "Electrónica", the second "mié 9 sept" over "Decoración" then "Bono ahorro", and the third "mar 8 sept" over "Conciertos" then "Retiro emergencia"

#### Scenario: A row at the boundary
- **WHEN** the user's timezone is Europe/Dublin and the "Café" row is stored at 23:30 UTC on 2 September
- **THEN** it is listed under 3 September, after "Supermercado" (12:00 UTC on the 3rd) and "Ahorro mensual" (09:00 UTC on the 3rd)

#### Scenario: Today and yesterday
- **WHEN** a cycle in progress has a movement dated today and one dated yesterday
- **THEN** their headings read "Hoy" and "Ayer"

### Requirement: Movement rows
Each row SHALL show, from start to end: a leading mark of its kind, its description over a muted line that names its kind, and its amount.
- An expense SHALL lead with its category's colour and name the category on the muted line; its amount SHALL carry no sign, as everywhere else on the dashboard.
- An income entry SHALL lead with an incoming mark, read "Ingreso" on the muted line, and show its amount with a "+" in the brand text colour.
- A savings movement SHALL lead with a savings mark, read "Depósito" or "Retiro" on the muted line, and show its amount with "+" for a deposit and "−" for a withdrawal in the regular text colour.

A row with no description SHALL show its category name (expense), "Ingreso" or the savings kind in its place. Colour SHALL never be the only way to tell the kind: the muted line always names it. The row's accessible name SHALL carry the description, the kind (or category), the day and the amount with its sign.

The card SHALL NOT state a total of any kind: not for the cycle, a day, a filter or a page.

#### Scenario: Three kinds side by side
- **WHEN** the card is open on `/demo` in Spanish under "sáb 5 sept"
- **THEN** "Cine" shows the "Ocio" colour, "Ocio" on its muted line and "45 €"
- **AND** "Freelance" shows "Ingreso" on its muted line and "+420 €" in the brand text colour

#### Scenario: A withdrawal
- **WHEN** the card shows "Retiro emergencia"
- **THEN** its muted line reads "Retiro" and its amount reads "−80 €" in the regular text colour

#### Scenario: No totals
- **WHEN** the card is open with any filter
- **THEN** no day heading, header or footer of the card shows a summed amount

### Requirement: Filter by kind
The open card SHALL show, above the list, a segmented control with four options: "Todo", "Gastos", "Ingresos", "Ahorro", with "Todo" selected whenever the dashboard mounts or the shown cycle changes. Selecting an option SHALL list only the movements of that kind (expenses, income entries, savings movements), keeping the day grouping and order. The control SHALL be a single-choice group operable with the keyboard (arrow keys move the selection), and every option SHALL be at least 44px tall at a 390px-wide viewport.

#### Scenario: Only income
- **WHEN** the visitor selects "Ingresos" on `/demo`
- **THEN** the list holds only "Freelance" under "sáb 5 sept"

#### Scenario: Only savings
- **WHEN** the visitor selects "Ahorro" on `/demo`
- **THEN** the list holds "Bono ahorro", "Retiro emergencia" and "Ahorro mensual", in that order, under three day headings

#### Scenario: Keyboard
- **WHEN** focus is on the selected "Todo" option and the visitor presses the right arrow twice
- **THEN** "Ingresos" is selected and focused, and the list shows only income

#### Scenario: Cycle change resets the filter
- **WHEN** "Ahorro" is selected and the visitor moves to the previous cycle
- **THEN** "Todo" is selected in the new cycle

### Requirement: Show more
The list SHALL show at most one page of movements at first: 15 movements below 1024px and 25 at 1024px and wider, counted after the filter. When more remain, a "Mostrar más" control at the end of the list SHALL reveal the next page of the same size. When every movement is shown and there was more than one page, the control SHALL read "Mostrar menos" and fold the list back to the first page, keeping the card's header in view. Changing the filter or the shown cycle SHALL return to the first page. When "Mostrar más" reveals a page, keyboard focus SHALL move to the first newly revealed row.

#### Scenario: A sixteenth movement on a phone
- **WHEN** at a 390px-wide viewport on `/demo` the visitor adds three expenses, so the card holds 16 movements, and opens the card
- **THEN** 15 rows are listed followed by "Mostrar más"
- **AND** activating it lists the 16th row and the control then reads "Mostrar menos"

#### Scenario: Fewer than a page
- **WHEN** `/demo` is rendered with its 13 movements
- **THEN** all 13 rows are listed and neither "Mostrar más" nor "Mostrar menos" is shown

#### Scenario: Show less
- **WHEN** every movement is shown after "Mostrar más" and the visitor activates "Mostrar menos"
- **THEN** the list holds the first page again and the card's header is within the viewport

#### Scenario: Filter returns to the first page
- **WHEN** a second page is shown and the visitor selects another filter and then "Todo" again
- **THEN** the list shows only the first page

### Requirement: Row actions
Activating an expense row SHALL open the expense sheet for that row, as from its category card. Activating an income row SHALL open the income sheet for that entry, as from the income panel. A savings row SHALL have no activation action. Every row SHALL support swipe-to-delete with the same undo toast as its category card or panel, and a delete undone SHALL bring the row back in the card. When the page supplies no handler for a kind (the corresponding mutations are absent), its rows SHALL be read-only.

#### Scenario: Edit from the list
- **WHEN** the visitor activates "Conciertos" in the card
- **THEN** the expense sheet opens for "Conciertos" with its amount 85 €, and saving a new amount updates the row in the card and in the "Ocio" card

#### Scenario: Swipe to delete with undo
- **WHEN** the visitor swipes "Electrónica" away in the card
- **THEN** it disappears from the card and from the "Compras" card, an undo toast is shown, and activating "Deshacer" brings it back in both

#### Scenario: Savings rows do not open
- **WHEN** the visitor activates the "Bono ahorro" row
- **THEN** no sheet opens

### Requirement: Empty states
When the cycle holds no movement entered by the user, the open card SHALL show, instead of the list and the filter, a short text saying nothing was entered this month and that what the user adds on the web or by WhatsApp appears there. When a filter leaves no movement, the filter SHALL stay and the list SHALL be replaced by a text naming the kind ("No hay ingresos cargados este mes", and the same for expenses and savings).

#### Scenario: Empty cycle
- **WHEN** a cycle with no user-entered movement is shown and the card is open
- **THEN** the card shows the empty text, no filter and no "Mostrar más", and its header count reads 0

#### Scenario: Empty filter
- **WHEN** a cycle has expenses but no income entered by the user and the visitor selects "Ingresos"
- **THEN** the filter stays and the list is replaced by "No hay ingresos cargados este mes"

### Requirement: Sidebar entry
At 1024px and wider, the sidebar's section list SHALL include "Movimientos" after the categories. Activating it SHALL scroll the page so the card's top edge sits below the top bar and open the card if it is folded. The entry SHALL become the current one while the card is the section in view, like the category entries; it SHALL show no amount.

#### Scenario: From the sidebar
- **WHEN** at 1280px the visitor folds the card, scrolls to the top and activates "Movimientos" in the sidebar
- **THEN** the page scrolls so the card's top edge is below the top bar's bottom edge, the card is open and the "Movimientos" entry is the current one

### Requirement: Movements card motion and accessibility
Opening and folding the card SHALL use the same disclosure motion as the category cards. Changing the filter SHALL slide the selection marker to the chosen option and bring the new list in with a short rise and fade; rows revealed by "Mostrar más" SHALL enter with a rise and fade in a short stagger that never blocks input. With reduced motion, nothing SHALL move: the marker jumps, and new content appears at once or with an opacity-only fade. The card SHALL pass automated accessibility checks in both themes, its text SHALL keep the dashboard's contrast in both themes, and the change of list after a filter or "Mostrar más" SHALL be announced politely with the number of movements shown.

#### Scenario: Reduced motion
- **WHEN** `/demo` is rendered with reduced motion and the visitor changes the filter and activates "Mostrar más"
- **THEN** no element of the card is translated or scaled during the change

#### Scenario: Accessible in both themes
- **WHEN** the open card is checked with axe in the light and the dark theme at 390px and 1280px
- **THEN** no violation is reported for the card

#### Scenario: Announced change
- **WHEN** the visitor selects "Ahorro" on `/demo` in Spanish
- **THEN** a polite live region announces that 3 movements are shown
