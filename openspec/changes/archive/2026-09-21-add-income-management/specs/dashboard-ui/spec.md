## MODIFIED Requirements

### Requirement: Controls without a handler are disabled
Every control that triggers a data action (previous/next cycle, add expense, add income, add savings movement, log out) SHALL be rendered disabled when the mounting page supplies no handler for it.

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

### Requirement: Public demo route
The application SHALL serve `/demo` without authentication. It SHALL render the full dashboard from a fictional sample billing cycle held in memory. The sample SHALL include:
- at least two income entries, each with a calendar date inside the cycle, one of them produced by a recurring definition
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

**Income editing on the demo:**
- Creating, editing, deleting and restoring income entries SHALL work as described in the `income-editing` capability, through an in-memory implementation of the same income operations the real route supplies.
- After each change, every figure derived from income SHALL be recalculated from the resulting rows: the income column's total, the rows of its panel, and the free margin.
- No income change SHALL move an expense figure: card totals, budget bars, the expenses total, the charts and the rows and footer total of the `upcoming-charges` card SHALL stay as they were.
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

**The savings add control on the demo:**
- The add savings movement control SHALL be enabled.
- Activating it SHALL NOT change any amount or row. It SHALL show a message saying the action is not available in the demo.
- The message SHALL be exposed to assistive technology as a status, and SHALL disappear on its own within 5 seconds.
- Activating it again while the message is shown SHALL keep a single message visible and restart its timeout.
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

#### Scenario: Charge states do not depend on the real date
- **WHEN** `/demo` is opened with the system clock set to the first day of the sample cycle, and again on its last day
- **THEN** the same three charges are shown as taken and the same three as pending in both runs

#### Scenario: Demo in English
- **WHEN** the active language is English
- **THEN** the sample category, expense and income-entry names are shown in English, "Vivienda" as "Housing", "Gimnasio" as "Gym" and "Salario" as "Salary"

#### Scenario: Add action in the demo
- **WHEN** a visitor on `/demo` in Spanish activates "Añadir movimiento de ahorro" in the savings panel
- **THEN** the savings total and rows are unchanged
- **AND** a message "Esta acción no está disponible en la demo" is visible and exposed as a status
- **AND** within 5 seconds, without further input, the message is no longer visible

#### Scenario: Repeated add actions
- **WHEN** the visitor activates "Añadir movimiento de ahorro" and then activates it again while the message is shown
- **THEN** exactly one message is visible

#### Scenario: Added income moves the income total and the free margin
- **WHEN** on `/demo` in Spanish, with the income total at 2.820 € and the free margin at 974 €, a visitor opens the income panel and adds 300 € described as "Bonus"
- **THEN** "Bonus" is listed in the panel with 300 € and its date, the income column shows 3.120 € and the free margin shows 1.274 €
- **AND** the expenses total still shows 1.700 €, and the "Próximos cobros" footer still reads 1.025 €

#### Scenario: Deleted income can be undone
- **WHEN** the visitor swipes the "Freelance" row (420 €) and activates "Eliminar", then activates "Deshacer"
- **THEN** after the deletion the income column shows 2.400 € and the free margin 554 €
- **AND** after the undo the row is listed again with 420 €, the income column shows 2.820 € and the free margin 974 €

#### Scenario: Added expense moves every figure
- **WHEN** on `/demo` in Spanish a visitor adds an expense of 20 described as "Panadería" to "comida"
- **THEN** the "comida" card shows 330 € of 400 €
- **AND** the expenses column shows 1.720 €, and the expenses panel lists "comida" with 330 €
- **AND** the September total exposed by the bar chart to assistive technology is 1.720 €
- **AND** the pie centre shows 1.720 €, and the "comida" legend entry shows "19 %"
- **AND** the free margin shows 954 €
- **AND** the "Próximos cobros" footer still reads 1.025 €, because the new expense is not a recurring charge

#### Scenario: Category changes leave the free margin at 974
- **WHEN** on `/demo` in Spanish the visitor renames "comida", changes its colour, raises its budget to 600, clears "ocio"'s budget, and deletes "hogar" onto "compras"
- **THEN** after each of those saves the free margin shows 974 €
- **AND** the expenses total shows 1.700 € throughout

#### Scenario: A deleted category carries its charges
- **WHEN** the visitor deletes "hogar" onto "compras"
- **THEN** the "Limpieza" charge is listed in the "Compras" card and its dot in "Próximos cobros" takes the "compras" colour
- **AND** the "Próximos cobros" footer still reads 1.025 €

#### Scenario: Renamed category survives a language switch
- **WHEN** the visitor renames "comida" to "Mercado" and then switches the language to English
- **THEN** that card is still named "Mercado", and "ocio" is shown as "Leisure"

#### Scenario: Editing stays in the browser
- **WHEN** a visitor on `/demo` creates, edits, deletes and restores expenses and income entries, and renames, recolours and deletes categories, while network traffic is recorded
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
- **THEN** the row's background equals the background an income row shows on hover
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


### Requirement: Summary cards
Income, expenses and savings SHALL be shown as three columns of one grouped surface, each column showing a label and its total. Activating a column SHALL disclose its panel inside the same surface, below the columns. All three columns SHALL behave the same, with at most one panel open at a time. The open column SHALL be marked by an indicator under it and an upward chevron, in addition to any colour change. A panel SHALL NOT repeat its column's total.

Panel contents:
- **Income:** each income entry of the cycle with its amount and, under its name, its date in the active language, ordered by date from newest to oldest, followed by an "add income" row. No estimated or expected amount SHALL be shown beside an entry.
- **Expenses:** every expense card's name, colour dot and total, sorted from highest to lowest total, ending with a "view all expenses" row that scrolls smoothly to the expense cards. The scroll SHALL leave the first card visible below the top bar.
- **Savings:** the accumulated balance, then the individual movements with deposits signed with a plus and withdrawals with a minus, followed by an "add savings movement" row.

#### Scenario: Expenses panel sort order
- **WHEN** the expense cards have totals 1 833, 420 and 78
- **THEN** the expenses panel lists them in that order

#### Scenario: Switching summary panels
- **WHEN** the income panel is open and the user activates the savings column
- **THEN** the income panel closes and the savings panel opens

#### Scenario: One grouped surface
- **WHEN** the income column is activated
- **THEN** its panel appears inside the same bordered surface as the three columns and spans that surface's full width
- **AND** no second bordered surface is created

#### Scenario: Panel does not repeat the total
- **WHEN** the income panel is open and the cycle income is 2 820, in Spanish
- **THEN** "2.820 €" appears exactly once inside the grouped surface

#### Scenario: Income rows are dated entries
- **WHEN** the income panel is open on `/demo` in Spanish
- **THEN** each row shows an income entry's name, its date under the name, and its amount
- **AND** no row shows a second, muted amount as an estimate or an expected figure

#### Scenario: Signed savings movements
- **WHEN** the savings panel lists a deposit of 50 and a withdrawal of 20
- **THEN** the deposit amount shows a plus sign and the withdrawal amount shows a minus sign

#### Scenario: View all expenses clears the top bar
- **WHEN** the user activates "view all expenses"
- **THEN** after scrolling ends, the top edge of the first expense card is below the bottom edge of the top bar

