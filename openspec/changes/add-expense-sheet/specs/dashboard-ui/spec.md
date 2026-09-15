## MODIFIED Requirements

### Requirement: Expense card states
Each expense card SHALL start collapsed.

**Collapsed:**
- It SHALL show a colour dot, the name, the total aligned right (or "spent of budget" for a category with a budget), and a chevron.
- A category with a budget SHALL also show its progress bar and remaining-amount text under the header.
- Its expense rows SHALL NOT be visible, focusable or exposed to assistive technology.

**Header:** it SHALL be exposed as expanded or collapsed. Opening or closing a card SHALL push the content below it rather than cover it.

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
- **THEN** it shows only the colour dot, name, total and chevron

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

### Requirement: Add action rows
These rows SHALL look and behave the same:
- the "add income" row at the end of the income panel
- the "add savings movement" row at the end of the savings panel
- the "add expense" row at the end of every expanded category card

The fixed-expenses card has no add row (*Expense card states*).

**Layout:**
- The row SHALL span the full inner width of the surface that contains it and be at least 48px tall.
- It SHALL show a circular badge containing a plus icon, followed by the label, both left-aligned. The badge SHALL start at the same side inset as the content of the rows above it.
- A hairline SHALL separate it from the row above, inset like the hairlines between those rows.
- The label SHALL use the brand text colour at row-text size.

**States:**
- **Rest:** the row SHALL have no border and a transparent background. The badge SHALL be a light tint of the brand colour, with the plus in the brand text colour.
- **Hover:** this state SHALL apply only on devices whose primary pointer can hover, while the pointer is over the row.
  - The row SHALL show the same highlight as the list rows above it.
  - The badge SHALL fill with the solid brand colour, with the plus in a contrasting colour. It SHALL visibly grow and its plus SHALL turn, with spring motion.
  - On devices that cannot hover, no hover appearance SHALL remain after a tap.
- **Pressed:** while a pointer is held down, the row's highlight SHALL be stronger than the hover highlight, and the row SHALL shrink slightly.
- **Focus:** keyboard focus SHALL follow *Interaction states*.
- **Disabled:** when the mounting page supplies no handler, the row SHALL stay disabled (*Controls without a handler are disabled*) and SHALL NOT show hover or pressed feedback.

**Contrast:** in both themes:
- the label SHALL reach at least 4.5:1 against the surface
- the plus SHALL reach at least 3:1 against the badge, at rest and on hover

**Motion:** when the user prefers reduced motion, the badge SHALL NOT grow and the plus SHALL NOT turn. The colour changes SHALL still apply.

#### Scenario: Same geometry in every place
- **WHEN** `/demo` is rendered at a 390px-wide viewport, and the income panel, the savings panel and the "comida" card are opened in turn
- **THEN** each add row's left and right edges coincide with the inner edges of its surface
- **AND** the three rows have the same height, badge size, badge left offset and label left offset, measured from each row's left edge

#### Scenario: Rest appearance
- **WHEN** the "comida" card is expanded, in either theme
- **THEN** the "add expense" row has no border and a transparent background
- **AND** its badge background is a tint of the brand colour, not the solid brand colour
- **AND** its label uses the brand text colour

#### Scenario: Hover with a pointer
- **WHEN** a mouse pointer moves over the "add income" row
- **THEN** the row's background equals the background an income-source row shows on hover
- **AND** the badge background equals the brand colour and the badge's scale is greater than 1
- **AND** after the pointer leaves, the row and badge return to their rest appearance

#### Scenario: Pressed is stronger than hover
- **WHEN** a pointer is held down on the "add savings movement" row
- **THEN** the row's background is more opaque than its hover background and its scale is below 1
- **AND** both return to their previous values after release

#### Scenario: Touch without hover
- **WHEN** a touch device that cannot hover taps the "add expense" row
- **THEN** after the tap ends, the badge shows its rest background and a scale of 1

#### Scenario: Contrast in both themes
- **WHEN** the add rows are rendered in the light theme and then in the dark theme
- **THEN** each label reaches at least 4.5:1 against its surface
- **AND** each plus reaches at least 3:1 against its badge, at rest and on hover

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion and a pointer hovers the "add expense" row
- **THEN** the badge background changes to the brand colour
- **AND** the badge scale stays 1 and the plus is not rotated

### Requirement: Controls without a handler are disabled
Every control that triggers a data action (previous/next cycle, add expense, add income, add savings movement, log out) SHALL be rendered disabled when the mounting page supplies no handler for it.

When the mounting page supplies no expense operations:
- the "add expense" rows SHALL be disabled
- expense rows SHALL NOT open the entry sheet and SHALL NOT move when dragged
- expense amounts SHALL be shown as plain text, without the editable-looking background

#### Scenario: Demo without month navigation
- **WHEN** the dashboard is mounted without previous/next cycle handlers
- **THEN** both month chevrons are disabled and activating them does nothing

#### Scenario: Dashboard without expense operations
- **WHEN** the dashboard is mounted without expense operations and the "comida" card is expanded
- **THEN** "Añadir gasto" is disabled
- **AND** tapping or dragging an expense row opens nothing and does not move the row, and its amount has a transparent background

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

#### Scenario: Editing stays in the browser
- **WHEN** a visitor on `/demo` creates, edits, deletes and restores expenses while network traffic is recorded
- **THEN** the browser sends no POST request and no request to a Supabase host, and no login is requested

#### Scenario: Edits survive a language switch
- **WHEN** the visitor adds 20 € described as "Panadería" to "comida", deletes "Cine", and then switches the language to English
- **THEN** "Food" lists "Panadería" with €20, "Leisure" does not list "Cinema", and the free margin shows €999

#### Scenario: Reload discards edits
- **WHEN** the visitor has deleted "Café" and reloads the page
- **THEN** "Café" is listed in "comida" again, and the free margin shows 974 €
