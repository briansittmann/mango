## MODIFIED Requirements

### Requirement: Expense card states
Each expense card SHALL start collapsed.

**Collapsed:**
- It SHALL show a colour dot, the name, the total aligned right (or "spent of budget" for a category with a budget), and a chevron.
- A category with a budget SHALL also show its progress bar and remaining-amount text under the header. A category with no budget SHALL show neither, and SHALL NOT show any hint that a budget could be set.
- Its expense rows SHALL NOT be visible, focusable or exposed to assistive technology.

**Header:** it SHALL hold two sibling controls, neither containing the other:
- the **disclosure**, which SHALL be exposed as expanded or collapsed, SHALL be named by the category, and SHALL cover the header apart from the options control's hit area
- the **options control** described in the `category-editing` capability, positioned between the amount and the chevron

Opening or closing a card SHALL push the content below it rather than cover it. While a card is open, its border SHALL take the category's colour.

**Expanded:**
- It SHALL list its expenses one row each: name on the left, date in muted text under the name, and the amount aligned right with tabular figures. An expense without a description SHALL be named after its card.
- Rows SHALL be at least 48px tall.
- When the mounting page supplies expense operations, each row SHALL be a button that opens the entry sheet in edit mode, and SHALL support swipe to delete, both as described in the `expense-editing` capability. Its amount SHALL look editable at rest: a background distinct from the row (lighter than the card in the dark theme), softly rounded corners, and no border.
- Every card's list SHALL be followed by an "add expense" row as described in *Add action rows*.
- A recurring charge SHALL be an ordinary row of its category's card, with the same appearance and the same behaviour as any other row.

**While reorder mode is on**, as described in the `category-reordering` capability, a category card SHALL take a third appearance: collapsed, showing its colour dot and its name only, with its amount, budget bar, remaining text and chevron hidden, its width reduced to open a lane for its handle, and every one of its controls — the disclosure, the options control, the expense rows and the add-expense row — unreachable by pointer and by keyboard. The card's open or collapsed state SHALL be remembered while the mode is on and restored when it is left.

Several cards SHALL be able to be open at once. A "collapse all" control SHALL be shown next to the expenses section title while at least one card is open, SHALL close every open card — the `upcoming-charges` card included — and SHALL be hidden while no card is open.

#### Scenario: Open two cards then collapse all
- **WHEN** no card is open
- **THEN** no "collapse all" control is visible
- **AND** when the user expands the "comida" card, expands the "ocio" card, then activates "collapse all", both cards were open at the same time, both are collapsed afterwards, and the control is hidden again

#### Scenario: Collapse all reaches the charges card
- **WHEN** only the "Próximos cobros" card is open
- **THEN** the "collapse all" control is visible, and activating it closes that card and hides the control

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

#### Scenario: Recurring charges are ordinary rows
- **WHEN** the "Vivienda" card is expanded on `/demo`
- **THEN** its rows are "Alquiler" 820 €, "Internet" 45 € and "Seguro" 35 €, each a button with an editable-looking amount and a delete panel behind it
- **AND** the card's last row is the "add expense" row, and its header carries an options control

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

#### Scenario: Card appearance in reorder mode
- **WHEN** the "comida" card is expanded on `/demo` and reorder mode is then entered
- **THEN** the card is collapsed, shows its colour dot and "Comida", and shows no amount, no "of budget" text, no progress bar, no remaining text and no chevron
- **AND** it is narrower than it was, with a handle in the lane over its trailing edge
- **AND** pressing where its options control was opens no sheet, and no expense row is focusable
- **AND** after "Listo" is activated, the card is expanded again with its amount and budget bar back

### Requirement: Public demo route
The application SHALL serve `/demo` without authentication. It SHALL render the full dashboard from a fictional sample billing cycle held in memory. The sample SHALL include:
- income sources
- a housing category holding the cycle's largest recurring charges
- food and leisure categories with budgets partly spent
- other variable categories
- at least six recurring charges spread over several categories, each with a day of the month and a charged-or-pending state, with at least three of each state
- savings movements
- at least six cycles of history

All totals in the sample SHALL be derived from its own rows. The sample SHALL set its own "today" inside its cycle, so that default dates and budget pace do not depend on the real date. Whether a charge is already taken SHALL be part of the sample, not derived from the real date, so that both states stay visible whenever the demo is opened. The page SHALL show a permanent notice that the data is sample data. Reloading SHALL reset the page to the initial sample. The sample SHALL NOT contain any real user's data.

**Expense editing on the demo:**
- Creating, editing, deleting and restoring expenses SHALL work as described in the `expense-editing` capability, through an in-memory implementation of the same expense operations the real route supplies.
- After each change, every figure derived from expenses SHALL be recalculated from the resulting rows:
  - card totals and budget progress
  - the expenses total and its panel
  - the current cycle's bar
  - the pie chart and its legend
  - the free margin
  - the rows and footer total of the `upcoming-charges` card
- Changes SHALL stay in the page's memory. They SHALL NOT be sent over the network, and reloading SHALL discard them.
- Changes SHALL survive a language switch. Sample rows SHALL then be shown in the new language, and typed descriptions SHALL stay as typed.

**Category editing on the demo:**
- Renaming, recolouring, changing or clearing a budget, and deleting a category SHALL work as described in the `category-editing` capability, through an in-memory implementation of the same category operations the real route supplies.
- After each change, every figure derived from categories SHALL be recalculated: card names, colours and borders, budget bars and their remaining text, the pie chart and its legend, the expenses summary rows, the expenses total, and the dots in the `upcoming-charges` card.
- A category's typed name SHALL survive a language switch, while categories that have not been renamed SHALL still be shown in the new language.
- **No category change SHALL move the free margin.** It SHALL stay at 974 € through any sequence of renames, recolours, budget changes and deletions that does not add or remove an expense.

**Category reordering on the demo:**
- Reordering SHALL work as described in the `category-reordering` capability, through an in-memory implementation of the same reorder operation the real route supplies.
- A new order SHALL be kept in the page's memory, SHALL NOT be sent over the network, and SHALL be discarded on reload.
- A new order SHALL survive a language switch, a rename, a recolour, a budget change and an expense change, and SHALL apply to whatever categories remain after a deletion.
- **No reorder SHALL move any figure on the page.** The free margin SHALL stay at 974 €, the expenses total at 1.700 €, and every card total, budget bar, pie slice and summary row SHALL be unchanged.

**Other add controls on the demo:**
- The add income and add savings movement controls SHALL be enabled.
- Activating one SHALL NOT change any amount or row. It SHALL show a message saying the action is not available in the demo.
- The message SHALL be exposed to assistive technology as a status, and SHALL disappear on its own within 5 seconds.
- Activating the other add control while the message is shown SHALL keep a single message visible and restart its timeout.
- Month navigation and log out SHALL stay disabled.

#### Scenario: Visitor opens the demo
- **WHEN** an unauthenticated visitor opens `/demo`
- **THEN** the dashboard renders with sample data and a visible "sample data" notice, and no login is requested

#### Scenario: Sample cards and charges
- **WHEN** `/demo` is rendered in Spanish
- **THEN** seven category cards are listed, "Vivienda" totalling 900 € among them, and no card is named "Gastos fijos"
- **AND** the "Próximos cobros" card lists six charges — Alquiler día 1, Internet día 3 and Seguro día 8 already taken; Parking día 15, Limpieza día 20 and Gimnasio día 22 pending
- **AND** the expenses total shows 1.700 € and the free margin 974 €

#### Scenario: Sample totals are consistent
- **WHEN** the demo is rendered, and again after one expense has been created, another edited and a third deleted
- **THEN** each card total equals the sum of its listed expense rows, and the expenses summary total equals the sum of all card totals

#### Scenario: Reordering on the demo moves nothing but the cards
- **WHEN** the visitor enters reorder mode on `/demo` and drags "Comida" from position 2 to position 5
- **THEN** the cards read vivienda · ocio · transporte · comida · salud · hogar · compras
- **AND** the free margin still reads 974 €, the expenses total 1.700 €, and "Comida" still reads 310 € of 400 €

#### Scenario: A new order survives a language switch and an edit
- **WHEN** the visitor reorders the cards, switches the language to English, renames one category and adds an expense to another
- **THEN** the cards are still in the order the visitor left them
- **AND** reloading the page restores the sample's original order
