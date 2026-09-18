## MODIFIED Requirements

### Requirement: Expense card states
Each expense card SHALL start collapsed.

**Collapsed:**
- It SHALL show a colour dot, the name, the total aligned right (or "spent of budget" for a category with a budget), and a chevron.
- A category with a budget SHALL also show its progress bar and remaining-amount text under the header. A category with no budget SHALL show neither, and SHALL NOT show any hint that a budget could be set.
- Its expense rows SHALL NOT be visible, focusable or exposed to assistive technology.

**Header:** it SHALL hold two sibling controls, neither containing the other:
- the **disclosure**, which SHALL be exposed as expanded or collapsed, SHALL be named by the category, and SHALL cover the header apart from the options control's hit area
- on a category card, the **options control** described in the `category-editing` capability, positioned between the amount and the chevron

The fixed-expenses card SHALL have a disclosure only. Opening or closing a card SHALL push the content below it rather than cover it. While a card is open, its border SHALL take the category's colour.

**Expanded:**
- It SHALL list its expenses one row each: name on the left, date in muted text under the name, and the amount aligned right with tabular figures. An expense without a description SHALL be named after its card.
- Rows SHALL be at least 48px tall.
- When the mounting page supplies expense operations, each row SHALL be a button that opens the entry sheet in edit mode, and SHALL support swipe to delete, both as described in the `expense-editing` capability. Its amount SHALL look editable at rest: a background distinct from the row (lighter than the card in the dark theme), softly rounded corners, and no border.
- A category card's list SHALL be followed by an "add expense" row as described in *Add action rows*. The fixed-expenses card SHALL end with its last expense row and SHALL NOT have an add row.

Several cards SHALL be able to be open at once. A "collapse all" control SHALL be shown next to the expenses section title while at least one card is open, SHALL close every open card, and SHALL be hidden while no card is open.

#### Scenario: Open two cards then collapse all
- **WHEN** no card is open
- **THEN** no "collapse all" control is visible
- **AND** when the user expands the "comida" card, expands the "ocio" card, then activates "collapse all", both cards were open at the same time, both are collapsed afterwards, and the control is hidden again

#### Scenario: Two expenses with the same name
- **WHEN** a card contains two expenses both named "Lidl"
- **THEN** both rows are rendered

#### Scenario: Collapsed card with a budget
- **WHEN** the "comida" card (budget 400, 310 spent, day 10 of a 30-day cycle) is collapsed
- **THEN** its header shows 310 of 400, its progress bar and "30 left per week" text are visible, and none of its expense rows are visible, focusable or exposed to assistive technology

#### Scenario: Collapsed card without a budget
- **WHEN** a category without a budget is collapsed
- **THEN** it shows only the colour dot, name, total, options control and chevron
- **AND** no progress bar, remaining text or invitation to set a budget is shown

#### Scenario: Header holds two separate controls
- **WHEN** the "comida" card header is rendered at a 390px-wide viewport
- **THEN** it exposes exactly two controls, neither nested inside the other: a disclosure named after the category and exposed as collapsed, and an options control
- **AND** activating the disclosure expands the card without opening the sheet, and activating the options control opens the sheet without expanding the card

#### Scenario: Fixed card has only a disclosure
- **WHEN** the fixed-expenses card header is rendered
- **THEN** its only control is the disclosure, and no options control is present

#### Scenario: Open card keeps its colour border
- **WHEN** the "comida" card is expanded
- **THEN** its border colour is the category's colour
- **AND** after its colour is changed to `blanco` from the category sheet, the border takes the new colour

#### Scenario: Editable-looking amounts and light add row
- **WHEN** the "comida" card is expanded on `/demo`, in either theme
- **THEN** every expense amount has an opaque background colour different from its row's, a corner radius greater than 0, and no border
- **AND** the "add expense" row has no border and a transparent background at rest

#### Scenario: Rows are buttons
- **WHEN** the "comida" card is expanded on `/demo`
- **THEN** each expense row is exposed to assistive technology as a button whose accessible name contains the expense's name and amount

#### Scenario: Fixed card has no add row
- **WHEN** the fixed-expenses card is expanded on `/demo`
- **THEN** its last row is the "Seguro" expense row, and it contains no "add expense" row

### Requirement: Controls without a handler are disabled
Every control that triggers a data action (previous/next cycle, add expense, add income, add savings movement, log out) SHALL be rendered disabled when the mounting page supplies no handler for it.

When the mounting page supplies no expense operations:
- the "add expense" rows SHALL be disabled
- expense rows SHALL NOT open the entry sheet and SHALL NOT move when dragged
- expense amounts SHALL be shown as plain text, without the editable-looking background

When the mounting page supplies no category operations:
- the options control on every category card header SHALL be disabled
- activating it SHALL NOT open the category sheet

#### Scenario: Demo without month navigation
- **WHEN** the dashboard is mounted without previous/next cycle handlers
- **THEN** both month chevrons are disabled and activating them does nothing

#### Scenario: Dashboard without expense operations
- **WHEN** the dashboard is mounted without expense operations and the "comida" card is expanded
- **THEN** "Añadir gasto" is disabled
- **AND** tapping or dragging an expense row opens nothing and does not move the row, and its amount has a transparent background

#### Scenario: Dashboard without category operations
- **WHEN** the dashboard is mounted without category operations
- **THEN** the options control on each category card header is disabled, and activating it opens nothing
- **AND** the disclosure still expands and collapses the card

### Requirement: Public demo route
The application SHALL serve `/demo` without authentication. It SHALL render the full dashboard from a fictional sample billing cycle held in memory. The sample SHALL include:
- income sources
- a fixed-expenses group
- food and leisure categories with budgets partly spent
- other variable categories
- savings movements
- at least six cycles of history

All totals in the sample SHALL be derived from its own rows. The sample SHALL set its own "today" inside its cycle, so that default dates and budget pace do not depend on the real date. The page SHALL show a permanent notice that the data is sample data. Reloading SHALL reset the page to the initial sample. The sample SHALL NOT contain any real user's data.

**Expense editing on the demo:**
- Creating, editing, deleting and restoring expenses SHALL work as described in the `expense-editing` capability, through an in-memory implementation of the same expense operations the real route supplies.
- After each change, every figure derived from expenses SHALL be recalculated from the resulting rows:
  - card totals and budget progress
  - the expenses total and its panel
  - the current cycle's bar
  - the pie chart and its legend
  - the free margin
- Changes SHALL stay in the page's memory. They SHALL NOT be sent over the network, and reloading SHALL discard them.
- Changes SHALL survive a language switch. Sample rows SHALL then be shown in the new language, and typed descriptions SHALL stay as typed.

**Category editing on the demo:**
- Renaming, recolouring, changing or clearing a budget, and deleting a category SHALL work as described in the `category-editing` capability, through an in-memory implementation of the same category operations the real route supplies.
- After each change, every figure derived from categories SHALL be recalculated: card names, colours and borders, budget bars and their remaining text, the pie chart and its legend, the expenses summary rows, and the expenses total.
- A category's typed name SHALL survive a language switch, while categories that have not been renamed SHALL still be shown in the new language.
- **No category change SHALL move the free margin.** It SHALL stay at 974 € through any sequence of renames, recolours, budget changes and deletions that does not add or remove an expense.

**Other add controls on the demo:**
- The add income and add savings movement controls SHALL be enabled.
- Activating one SHALL NOT change any amount or row. It SHALL show a message saying the action is not available in the demo.
- The message SHALL be exposed to assistive technology as a status, and SHALL disappear on its own within 5 seconds.
- Activating the other add control while the message is shown SHALL keep a single message visible and restart its timeout.
- Month navigation and log out SHALL stay disabled.

#### Scenario: Visitor opens the demo
- **WHEN** an unauthenticated visitor opens `/demo`
- **THEN** the dashboard renders with sample data and a visible "sample data" notice, and no login is requested

#### Scenario: Sample totals are consistent
- **WHEN** the demo is rendered, and again after one expense has been created, another edited and a third deleted
- **THEN** each card total equals the sum of its listed expense rows, and the expenses summary total equals the sum of all card totals

#### Scenario: Demo in English
- **WHEN** the active language is English
- **THEN** the sample category, expense and income-source names are shown in English

#### Scenario: Add action in the demo
- **WHEN** a visitor on `/demo` in Spanish activates "Añadir ingreso" in the income panel
- **THEN** the income total and rows are unchanged
- **AND** a message "Esta acción no está disponible en la demo" is visible and exposed as a status
- **AND** within 5 seconds, without further input, the message is no longer visible

#### Scenario: Repeated add actions
- **WHEN** the visitor activates "Añadir ingreso" and then, while the message is shown, "Añadir movimiento de ahorro"
- **THEN** exactly one message is visible

#### Scenario: Added expense moves every figure
- **WHEN** on `/demo` in Spanish a visitor adds an expense of 20 described as "Panadería" to "comida"
- **THEN** the "comida" card shows 330 € of 400 €
- **AND** the expenses column shows 1.720 €, and the expenses panel lists "comida" with 330 €
- **AND** the September total exposed by the bar chart to assistive technology is 1.720 €
- **AND** the pie centre shows 1.720 €, and the "comida" legend entry shows "19 %"
- **AND** the free margin shows 954 €

#### Scenario: Category changes leave the free margin at 974
- **WHEN** on `/demo` in Spanish the visitor renames "comida", changes its colour, raises its budget to 600, clears "ocio"'s budget, and deletes "hogar" onto "compras"
- **THEN** after each of those saves the free margin shows 974 €
- **AND** the expenses total shows 1.700 € throughout

#### Scenario: Renamed category survives a language switch
- **WHEN** the visitor renames "comida" to "Mercado" and then switches the language to English
- **THEN** that card is still named "Mercado", and "ocio" is shown as "Leisure"

#### Scenario: Editing stays in the browser
- **WHEN** a visitor on `/demo` creates, edits, deletes and restores expenses, and renames, recolours and deletes categories, while network traffic is recorded
- **THEN** the browser sends no POST request and no request to a Supabase host, and no login is requested

#### Scenario: Edits survive a language switch
- **WHEN** the visitor adds 20 € described as "Panadería" to "comida", deletes "Cine", and then switches the language to English
- **THEN** "Food" lists "Panadería" with €20, "Leisure" does not list "Cinema", and the free margin shows €999

#### Scenario: Reload discards edits
- **WHEN** the visitor has deleted "Café" and reloads the page
- **THEN** "Café" is listed in "comida" again, and the free margin shows 974 €

#### Scenario: Reload discards category changes
- **WHEN** the visitor has deleted the "hogar" category and reloads the page
- **THEN** the "Hogar" card is listed again with 95 €, and the free margin shows 974 €
