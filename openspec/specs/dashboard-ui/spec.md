# Dashboard UI Specification

## Purpose

The monthly dashboard: the single-screen view of a billing cycle (free margin, summary cards, expense cards, charts, account menu). It renders only data it is given, so the same screen can run on real data or on in-memory sample data at `/demo`.

## Requirements

### Requirement: Dashboard renders only supplied data
The dashboard SHALL render entirely from a data object and optional action handlers supplied by the page that mounts it. No dashboard component SHALL read from or write to the database, call a data-access module, or hold sample data of its own. Amounts SHALL be supplied as numbers and dates as ISO-8601 strings, never as pre-formatted text.

#### Scenario: Different data, same screen
- **WHEN** the dashboard is mounted twice with two different data objects
- **THEN** each instance shows only the totals, groups, expenses and user details of its own data object

#### Scenario: No database traffic from the dashboard
- **WHEN** `/demo` is loaded and every card, summary panel and menu is opened
- **THEN** the browser makes no request to the Supabase project

#### Scenario: Component tries to access data directly
- **WHEN** a dashboard component imports a Supabase client or a data-access module for anything other than types
- **THEN** the project lint check fails

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

### Requirement: Savings target and history on the demo
The `/demo` sample SHALL supply a savings target and at least six cycles of accumulated savings balance, so that the bar, its caption and the sparkline are all on screen on first load without a visitor having to set anything.

Adding them SHALL move no existing figure: the cycle's savings total, the accumulated balance, the free margin, the expenses total and every card total, budget bar, pie slice and summary row SHALL be what they were before. The last point of the supplied history SHALL equal the accumulated balance shown in the panel, so the sparkline and the number beside it cannot disagree.

The savings add control SHALL keep behaving as it does today: enabled, changing nothing, and showing the "not available in the demo" message.

#### Scenario: The demo carries a target
- **WHEN** `/demo` is rendered in Spanish
- **THEN** the savings column shows its bar and the caption "146 de 300"
- **AND** the savings total still reads 146 €, the free margin 974 € and the expenses total 1.700 €

#### Scenario: The sparkline agrees with the balance
- **WHEN** the savings panel is open on `/demo`
- **THEN** the sparkline is drawn from six cycles of accumulated balance
- **AND** its last point equals the accumulated amount shown in the same block

#### Scenario: The add control is unchanged
- **WHEN** "Añadir movimiento de ahorro" is activated on `/demo`
- **THEN** no amount and no row changes, and the "not available in the demo" message is shown as a status

### Requirement: Expense cards group each expense exactly once
The dashboard SHALL show one card per spending category, each containing every expense of that category in the cycle, recurring and one-off alike. Every expense SHALL appear in exactly one card. Category names SHALL be shown as the user entered them.

There SHALL be no card that groups expenses by whether they recur. A recurring charge SHALL NOT be listed, totalled or summarised as an expense anywhere outside its category's card; the `upcoming-charges` capability describes the one place the cycle's charges are listed again, as a read-only calendar that states no expense total.

#### Scenario: Fixed expense in a category
- **WHEN** the cycle has a fixed "alquiler" expense in category "vivienda" and a variable "Tesco" expense in category "comida"
- **THEN** "alquiler" is listed as an expense only in the "vivienda" card and "Tesco" only in the "comida" card
- **AND** no card named after fixed expenses is rendered

#### Scenario: No variable pseudo-category
- **WHEN** the dashboard is rendered
- **THEN** there is no card grouping all variable expenses together, and none grouping all recurring ones

#### Scenario: Counted once
- **WHEN** `/demo` is rendered in Spanish
- **THEN** the expenses total 1.700 € equals the sum of the seven category cards
- **AND** the 1.025 € committed in "Próximos cobros" is not added to it

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

### Requirement: Budget progress on budgeted categories
A card whose category has a budget SHALL show "spent of budget" in its header and a progress bar.

**Bar:**
- Its colour SHALL depend on consumption (spent ÷ budget): the brand colour below 80 %, the warning colour from 80 % to 100 %, and the danger colour above 100 %.
- It SHALL expose its consumption to assistive technology as a value out of 100, with a text equivalent that states spent of budget.

**Text under the bar:**
- It SHALL show the amount left per week, calculated as (budget − spent) ÷ days left × 7 and rounded down to a whole amount. Days left SHALL count today.
- When fewer than 7 days remain, it SHALL show the total amount left for the remaining days instead.
- From 80 % to 100 %, the text SHALL be preceded by a warning icon and a "near limit" label.
- When spent exceeds the budget, the amount left SHALL be zero, the bar SHALL be full, and the text SHALL instead state the amount over budget (spent − budget), preceded by an alert icon with a different shape from the warning icon.

Categories without a budget SHALL show only their total.

#### Scenario: Worked example from ARCHITECTURE.md
- **WHEN** a category has budget 400 and 310 spent on day 10 of a 30-day cycle (21 days left, today included)
- **THEN** the header shows 310 of 400, the bar uses the brand colour, and the text shows 30 left per week

#### Scenario: Last days of the cycle
- **WHEN** a category has budget 120, 98 spent, and 4 days left in the cycle
- **THEN** the text shows 22 left for the last 4 days instead of a weekly amount

#### Scenario: Near the limit
- **WHEN** a category has budget 150 and 130 spent
- **THEN** the bar uses the warning colour, and the text starts with a warning icon and the "near limit" label, followed by the amount left

#### Scenario: Over budget
- **WHEN** a category has budget 100 and 130 spent
- **THEN** the bar is full and uses the danger colour
- **AND** the text states 30 over budget, preceded by the alert icon, and no "0 left" text is shown

#### Scenario: Consumption for assistive technology
- **WHEN** the "comida" card (310 spent of 400) is rendered in Spanish
- **THEN** its bar is exposed as a progress value of 77.5 out of 100 with a text equivalent containing "310 € de 400 €"

### Requirement: Category colour placement
A category's colour SHALL appear only in these places:
- the dot next to its name, drawn as a single flat colour
- the border of its card while the card is expanded
- its slice in the pie chart
- its dot in the pie legend
- the dot on its charges in the `upcoming-charges` card

It SHALL NOT colour the card surface in any state, and a collapsed card's border SHALL use a theme token.

The pie chart SHALL have one slice per expense card with a non-zero total, a thin separator between slices, and the cycle total in the centre. The pie card's title row SHALL NOT repeat that total. The pie SHALL have a legend with one entry per slice, in the same order as the expense cards. Each entry SHALL show a colour dot, the name, and the slice's share of the cycle total as a whole-number percentage formatted for the active language.

#### Scenario: Expanded card border
- **WHEN** the "comida" card is expanded
- **THEN** its border colour equals the colour of its dot, and its surface keeps the card token colour

#### Scenario: Collapsed card border
- **WHEN** a card is collapsed
- **THEN** its border uses the border theme token, not the category colour

#### Scenario: Pie matches cards
- **WHEN** the dashboard shows seven category cards with non-zero totals
- **THEN** the pie has seven slices whose colours match the cards' dots
- **AND** the legend lists the same seven entries with matching dots and names, in card order, each with a percentage instead of an amount

#### Scenario: Share and total
- **WHEN** the cycle total is 1 700, "comida" totals 310, and the language is Spanish
- **THEN** the "comida" legend entry shows "18 %"
- **AND** "1.700 €" appears exactly once inside the pie card, in the centre of the donut

### Requirement: Summary cards
Income, expenses and savings SHALL be shown as three columns of one grouped surface, each column showing a label and its total. The savings column SHALL additionally show its progress towards the savings target when the data supplies one, below its total. No other column SHALL carry anything below its total. Activating a column SHALL disclose its panel inside the same surface, below the columns. All three columns SHALL behave the same, with at most one panel open at a time. The open column SHALL be marked by an indicator under it and an upward chevron, in addition to any colour change. A panel SHALL NOT repeat its column's total.

Panel contents:
- **Income:** each income entry of the cycle with its amount and, under its name, its date in the active language, ordered by date from newest to oldest, followed by an "add income" row. No estimated or expected amount SHALL be shown beside an entry.
- **Expenses:** every expense card's name, colour dot and total, sorted from highest to lowest total, ending with a "view all expenses" row that scrolls smoothly to the expense cards. The scroll SHALL leave the first card visible below the top bar.
- **Savings:** an accumulated-balance block, then the cycle's individual movements, followed by an "add savings movement" row.

The **accumulated block** SHALL be distinguishable from a movement row without reading it: its label SHALL use the muted text colour, its amount SHALL NOT use the weight a movement's amount uses, and it SHALL be separated from the movements below it by more space than separates two movements. It SHALL carry a sparkline of the accumulated balance over the cycles the data supplies, between its label and its amount, drawn with no axis, no gridline, no point marker and no value label. The block SHALL NOT be interactive: it SHALL expose no chevron, no button and no tap target.

A **movement** SHALL show, from left to right: a circular icon distinguishing a deposit from a withdrawal by the direction of an arrow, the movement's name with its date under it, and its signed amount. A deposit's amount SHALL be prefixed with a plus sign in the brand text colour. A withdrawal's amount SHALL be prefixed with the typographic minus sign U+2212 in the regular text colour, and SHALL NOT use the danger colour or any other colour reserved for an error state. There SHALL be no gap between a sign and the digits that follow it. Every amount in the panel, the accumulated balance included, SHALL use tabular figures and SHALL be right-aligned, so that the signs and the digits of successive rows line up in a column.

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
- **WHEN** the savings panel lists a deposit of 50 and a withdrawal of 20, in Spanish
- **THEN** the deposit reads "+50 €" with the plus in the brand text colour, and the withdrawal reads "−20 €" with U+2212, not the hyphen U+002D
- **AND** the withdrawal's computed colour is the regular text colour, and is not the danger colour
- **AND** neither amount contains a space between its sign and its first digit

#### Scenario: Movements carry a direction icon
- **WHEN** the savings panel is open on `/demo`
- **THEN** each movement row starts with a circular icon whose background differs from the card's background
- **AND** the icon on a deposit row and the icon on a withdrawal row differ from each other in the direction of their arrow

#### Scenario: The accumulated block is not a movement
- **WHEN** the savings panel is open on `/demo`
- **THEN** the accumulated label's computed colour is the muted text colour and a movement name's is not
- **AND** the accumulated amount's computed font weight is lower than a movement amount's
- **AND** the vertical gap between the accumulated block and the first movement is greater than the gap between two consecutive movements

#### Scenario: The accumulated block cannot be activated
- **WHEN** the savings panel is open and the accumulated block is clicked, and separately when the keyboard is tabbed through the panel
- **THEN** nothing opens and no amount changes
- **AND** the block is not reachable by keyboard and contains no chevron

#### Scenario: Sparkline over the supplied cycles
- **WHEN** the data supplies six cycles of accumulated balance and the savings panel is open
- **THEN** a sparkline is drawn between the accumulated label and its amount
- **AND** it shows no axis line, no gridline, no point marker and no value label
- **AND** it is hidden from assistive technology or carries a text alternative naming the trend, so the balance is never announced twice

#### Scenario: Amounts line up
- **WHEN** the savings panel is open on `/demo` with a deposit, a withdrawal and the accumulated balance shown
- **THEN** every amount in the panel computes `font-variant-numeric: tabular-nums`
- **AND** the right edge of each amount is at the same horizontal position

#### Scenario: View all expenses clears the top bar
- **WHEN** the user activates "view all expenses"
- **THEN** after scrolling ends, the top edge of the first expense card is below the bottom edge of the top bar

### Requirement: Savings progress towards a monthly target
The data supplied to the dashboard MAY carry a savings target for the cycle. It SHALL be a per-user value, supplied as a number, and it SHALL be absent — not zero — when the user has not set one. No dashboard component SHALL hold a target of its own or fall back to a default when none is supplied.

**When a target is supplied**, the savings column SHALL show, below its total:
- a horizontal track 6px tall with fully rounded ends, spanning the column's content width
- within the track, a fill in the brand colour whose solid part ends at the net amount saved this cycle as a fraction of the target
- immediately after the solid fill, a stretch whose width equals the withdrawals of the cycle as a fraction of the target, drawn as a diagonal hatch in the muted colour, so that the fill as a whole ends at the amount deposited
- under the track, a caption in the muted text colour naming the net amount saved and the target, in that order, in the active language

The net amount is the cycle's deposits less its withdrawals. The fill and the hatch SHALL each be bounded to the track: a net or deposited amount above the target SHALL fill the track and SHALL NOT overflow it, and a negative net SHALL show no solid fill rather than a fill to the left. The caption SHALL show the true figures whatever the fill is bounded to.

**When the net amount reaches or exceeds the target**, a check mark SHALL be shown at the end of the track. Nothing else SHALL change: the fill SHALL keep the brand colour, and no other celebration SHALL be shown.

**The bar SHALL NOT change colour with its value.** It SHALL use the brand colour at every value, and SHALL NOT use the warning or danger colour at any value — those belong to budget state, which measures the opposite thing.

**When no target is supplied**, the savings column SHALL show its label, its total and nothing else. No track, no caption, no check and no placeholder SHALL be rendered, and the column SHALL NOT be shown as disabled: an absent target is missing data, not a control without a handler.

The track SHALL be exposed to assistive technology as a progress indicator, with its value set from the net fraction and a text alternative naming both the net amount and the target with their currency. The visible caption MAY omit the currency symbol, since the total directly above it carries one.

#### Scenario: Bar, hatch and caption
- **WHEN** the cycle has deposits of 176 and 50, a withdrawal of 80, and a target of 300, in Spanish
- **THEN** the savings column shows a 6px track under its total whose solid brand-coloured fill spans 48–49 % of the track
- **AND** a diagonally hatched stretch continues from the end of the solid fill to 75–76 % of the track
- **AND** the caption under the track reads "146 de 300"

#### Scenario: No target, no bar
- **WHEN** the dashboard is mounted with savings movements and no savings target
- **THEN** the savings column shows its label and its total and contains no track, no caption and no check mark
- **AND** the column is not exposed as disabled and still opens its panel when activated

#### Scenario: Target reached
- **WHEN** the net amount saved is 312 and the target is 300
- **THEN** the track is filled and a check mark is shown at its end
- **AND** the caption reads "312 de 300", and the fill's computed colour is the brand colour

#### Scenario: The bar never warns
- **WHEN** the savings bar is rendered at a net of 0, at half the target, at the target and above the target, in both themes
- **THEN** its fill's computed colour equals the brand colour in every case
- **AND** it equals neither the warning colour nor the danger colour in any case

#### Scenario: Net below zero
- **WHEN** the cycle's withdrawals exceed its deposits, for a target of 300
- **THEN** the track shows no solid fill and nothing is drawn outside the track
- **AND** the caption shows the true negative net amount and the target

#### Scenario: Bar exposed to assistive technology
- **WHEN** the savings bar is rendered with a net of 146 and a target of 300, in Spanish
- **THEN** it is exposed as a progress indicator whose value corresponds to 49 % of its range
- **AND** its text alternative names 146 € and 300 €

#### Scenario: The caption adds no font size
- **WHEN** `/demo` is rendered at a 390px-wide viewport with every card and panel collapsed
- **THEN** the caption's computed font size is one already in use by other metadata on the screen
- **AND** the caption computes the muted text colour and is smaller than the summary row text

#### Scenario: The three columns keep one shape
- **WHEN** `/demo` is rendered at a 390px-wide viewport with a savings target supplied
- **THEN** the income, expenses and savings columns have the same height and their labels and totals sit at the same vertical positions
- **AND** the savings track is the only element any column carries below its total

### Requirement: Cycle header and free margin
The top of the dashboard SHALL show a bar with the Mango logo and the app name on the left and the account avatar on the right.

Below the bar, the cycle name SHALL be the screen's title:
- It SHALL be left-aligned and larger than every other text except the free-margin number.
- Previous/next cycle controls SHALL sit beside it.
- The cycle SHALL be named after the month in which it ends.
- Under the title, the cycle's first and last day SHALL be shown as a date range in the active language. While the cycle contains today, the range SHALL be preceded by an "in progress" label.
- The title's accessible name SHALL contain the visible month name.

Activating the title SHALL open a month picker. In the picker, the selected month SHALL be marked by a filled shape and heavier weight, and exposed as current. Months after an in-progress cycle SHALL NOT be selectable.

Once the title has scrolled under the top bar, the bar SHALL become a frosted surface and show the month name with previous/next controls in place of the app name. The avatar SHALL stay in the same position. While the title is in view, the bar SHALL be transparent and its month controls SHALL be hidden and unreachable, so the month is never shown twice.

Below the header, a free-margin card SHALL show a "free margin" label and the supplied free-margin amount as the most prominent number on the screen, in the brand colour. The card SHALL NOT contain a badge or any other amount.

#### Scenario: Cycle crossing months
- **WHEN** the cycle runs from 26 August to 25 September
- **THEN** the title shows September in the active language

#### Scenario: Top bar
- **WHEN** the dashboard is rendered
- **THEN** the logo (decorative, with an empty accessible name) and the app name appear at the top left, and the avatar at the top right

#### Scenario: Title, range and progress label
- **WHEN** the cycle runs from 1 to 30 September 2026, contains today, and the language is Spanish
- **THEN** the title reads "septiembre", starting with a capital letter
- **AND** the line under it shows the "en curso" label followed by a date range covering 1 and 30 September
- **AND** the title's computed font size is larger than every other text on the page except the free-margin number

#### Scenario: Month picker marks the selection
- **WHEN** the user activates the title
- **THEN** a month picker opens, in which September has a filled background and heavier weight than the other months and is exposed as current

#### Scenario: Month moves into the top bar
- **WHEN** the user scrolls until the title is under the top bar
- **THEN** the bar has a frosted surface and shows the month name between previous/next controls, and the avatar has not moved
- **AND** when the user scrolls back to the top, the bar is transparent, shows the app name, and its month controls cannot be reached by keyboard

#### Scenario: Free-margin card content
- **WHEN** the free margin is 974 and the cycle income is 2 820, in Spanish
- **THEN** the card shows its label and "974 €" as the largest text on the page, and contains no badge and no "2.820 €"

### Requirement: Mobile visual hierarchy
At a 390px-wide viewport, the dashboard SHALL rank text sizes by importance:
1. The free-margin number SHALL be the largest text.
2. The cycle title SHALL be the second largest.
3. Summary totals and section titles SHALL be smaller than the cycle title and larger than row text.
4. Metadata (dates, remaining-amount text, estimates, summary labels, the cycle date range and chart labels) SHALL be smaller than row text and use the muted text colour.

Among texts larger than row text, only the free-margin number SHALL use the brand colour.

No bordered, rounded surface SHALL contain another one, in any open or closed state. For this rule, a surface is an element with a visible border, a corner radius of at least 12px and a height of at least 64px.

#### Scenario: Size order
- **WHEN** `/demo` is rendered at a 390px-wide viewport
- **THEN** the computed font sizes satisfy: free-margin number > cycle title > each summary total and section title > each expense-card name and amount > each date, remaining-amount text and summary label

#### Scenario: One brand-coloured figure
- **WHEN** `/demo` is rendered in either theme
- **THEN** the income, expenses and savings totals use the regular text colour
- **AND** the free-margin number is the only text larger than 16px in the brand text colour

#### Scenario: No nested surfaces
- **WHEN** `/demo` is rendered with every card collapsed, and again with the income panel and the "comida" card open
- **THEN** no bordered, rounded surface is contained in another bordered, rounded surface

### Requirement: Monthly spend chart
The monthly spend chart SHALL show one bar per history entry, oldest to newest, with the short month name under every bar. The current cycle's bar SHALL use the brand colour and the other bars a neutral tone. The chart SHALL have a single title, no value axis and no gridlines, and SHALL NOT sit on a second surface inside its card.

A value label SHALL appear only above the selected bar. The current cycle's bar SHALL be selected initially. Activating another bar SHALL select it and show its month label in a heavier weight.

Every month's total SHALL be available as text to assistive technology.

#### Scenario: Every month labelled
- **WHEN** the history has six entries and the viewport is 390px wide
- **THEN** six month labels are rendered, one under each bar, and no two labels overlap

#### Scenario: One value label
- **WHEN** the chart is rendered in Spanish
- **THEN** exactly one value label is visible, above the current cycle's bar, showing its compact figure (for example "1,7 mil")

#### Scenario: Select another bar
- **WHEN** the user taps the August bar
- **THEN** the value label is shown above August instead, the August month label is heavier than the others, and the September bar keeps the brand colour

#### Scenario: Totals for assistive technology
- **WHEN** assistive technology reads the chart
- **THEN** it can reach each of the six months together with its total amount

### Requirement: Account avatar and menu
The top-right corner SHALL show a 36px circular avatar with the user's photo, or the initial of the user's name when there is no photo. The avatar SHALL NOT use the brand or green colours. Activating it SHALL open a bottom sheet containing the user's photo or initial, name and phone number, a theme control, a language control, and a log-out action separated by a divider at the bottom. Menu rows SHALL be at least 48px tall and menu text at least 12px.

#### Scenario: User without photo
- **WHEN** the user named "Brian" has no photo
- **THEN** the avatar shows "B"

#### Scenario: Account details
- **WHEN** the account menu opens
- **THEN** it shows the user's name and phone number, and no e-mail address or plan badge
