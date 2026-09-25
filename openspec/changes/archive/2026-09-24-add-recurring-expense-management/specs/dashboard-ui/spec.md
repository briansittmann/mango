## MODIFIED Requirements

### Requirement: Controls without a handler are disabled
Every control that triggers a data action (previous/next cycle, add expense, add income, add savings movement, log out) SHALL be rendered disabled when the mounting page supplies no handler for it.

When the mounting page supplies no expense operations:
- the "add expense" rows SHALL be disabled
- expense rows SHALL NOT open the entry sheet and SHALL NOT move when dragged
- expense amounts SHALL be shown as plain text, without the editable-looking background
- the entry sheet's recurrence switch SHALL NOT be reachable, since the sheet never opens

When the mounting page supplies no category operations:
- the options control on every category card header SHALL be disabled
- activating it SHALL NOT open the category sheet

When the mounting page supplies no recurring-definition operations:
- the rows of the `upcoming-charges` card SHALL be rendered disabled, and activating one SHALL NOT open the definition sheet
- the card SHALL still expand, collapse and list every charge with its day, amount, progress and captions
- the entry sheet SHALL NOT show the recurrence switch, since no definition could be created

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

#### Scenario: Dashboard without definition operations
- **WHEN** the dashboard is mounted without recurring-definition operations and the "Próximos cobros" card is expanded
- **THEN** each row is disabled and activating it opens nothing
- **AND** the rows still show their day, dot, name, amount and progress, and the footer still shows the committed total

#### Scenario: No recurrence switch without definition operations
- **WHEN** the dashboard is mounted with expense operations but without recurring-definition operations, and the entry sheet is opened in create mode
- **THEN** no recurrence switch is shown in the sheet

### Requirement: Public demo route
The application SHALL serve `/demo` without authentication. It SHALL render the full dashboard from a fictional sample billing cycle held in memory. The sample SHALL include:
- income sources
- a housing category holding the cycle's largest recurring charges
- food and leisure categories with budgets partly spent
- other variable categories
- at least six recurring charges spread over several categories, each with a day of the month and a charged-or-pending state, with at least three of each state
- a recurring definition behind every one of those charges, carrying its expected amount, its day, its category and its active state, with at least one of them ending after a number of repetitions and partway through that number
- savings movements
- at least six cycles of history

All totals in the sample SHALL be derived from its own rows. The sample SHALL set its own "today" inside its cycle, so that default dates and budget pace do not depend on the real date. Whether a charge is already taken SHALL be part of the sample, not derived from the real date, so that both states stay visible whenever the demo is opened. Every charge in the sample SHALL start equal to its definition's expected amount, so that no difference caption is shown before the visitor causes one. The page SHALL show a permanent notice that the data is sample data. Reloading SHALL reset the page to the initial sample. The sample SHALL NOT contain any real user's data.

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

**Recurring definitions on the demo:**
- Creating a definition from the entry sheet, editing one from "Próximos cobros", stopping it and deleting it SHALL work as described in the `recurring-expenses` capability, through an in-memory implementation of the same definition operations the real route supplies.
- After each change, every figure derived from the affected charge SHALL be recalculated, in the same render: its card total and budget progress, the expenses total, the pie, the current cycle's bar, the free margin, and the rows and footer total of the `upcoming-charges` card.
- **What moves a figure and what does not:** changing a definition's expected amount SHALL move figures only while this cycle's charge is still pending; deleting a definition SHALL remove its charge and move every figure derived from it; stopping a definition SHALL move no figure at all.
- A definition's typed name SHALL survive a language switch, while definitions that have not been renamed SHALL still be shown in the new language.
- Changes SHALL stay in the page's memory, SHALL NOT be sent over the network, and SHALL be discarded on reload.

#### Scenario: Visitor opens the demo
- **WHEN** an unauthenticated visitor opens `/demo`
- **THEN** the dashboard renders with sample data and a visible "sample data" notice, and no login is requested

#### Scenario: Sample cards and charges
- **WHEN** `/demo` is rendered in Spanish
- **THEN** seven category cards are listed, "Vivienda" totalling 900 € among them, and no card is named "Gastos fijos"
- **AND** the "Próximos cobros" card lists six charges — Alquiler día 1, Internet día 3 and Seguro día 8 already taken; Parking día 15, Limpieza día 20 and Gimnasio día 22 pending
- **AND** the expenses total shows 1.700 € and the free margin 974 €

#### Scenario: Sample definitions
- **WHEN** `/demo` is rendered in Spanish and "Próximos cobros" is expanded
- **THEN** the "Seguro" row shows "4 de 10", and no other row shows a progress
- **AND** no row shows an expected-amount caption, every charge matching its definition

#### Scenario: Sample totals are consistent
- **WHEN** the demo is rendered, and again after one expense has been created, another edited and a third deleted
- **THEN** each card total equals the sum of its listed expense rows, and the expenses summary total equals the sum of all card totals

#### Scenario: A definition change moves a pending charge
- **WHEN** on `/demo` in Spanish the visitor opens the "Gimnasio" row in "Próximos cobros" and saves an expected amount of 45 €
- **THEN** the "Salud" card shows 45 €, the expenses total 1.705 €, the "Próximos cobros" footer 1.030 € and the free margin 969 €
- **AND** the pie centre shows 1.705 €

#### Scenario: Stopping a definition moves nothing
- **WHEN** the visitor opens the "Gimnasio" definition and activates "Dejar de repetir"
- **THEN** the free margin still shows 974 €, the expenses total 1.700 € and the "Próximos cobros" footer 1.025 €
- **AND** the "Gimnasio" charge is still listed in the "Salud" card and in "Próximos cobros"

#### Scenario: Deleting a definition takes its charge
- **WHEN** the visitor opens the "Seguro" definition, activates the delete action and confirms
- **THEN** "Seguro" is no longer listed in the "Vivienda" card or in "Próximos cobros"
- **AND** the "Vivienda" card shows 865 €, the expenses total 1.665 €, the footer 990 € and the free margin 1.009 €

#### Scenario: A definition created on the demo appears in both places
- **WHEN** on `/demo` in Spanish the visitor adds an expense of 50 € named "Peaje" to "Transporte" with the recurrence switch on and day 15
- **THEN** "Peaje" is listed in the "Transporte" card, which shows 180 € of 100 €
- **AND** "Próximos cobros" lists "Peaje" with día 15 and 50 € among the pending charges, after "Seguro" and before "Limpieza"
- **AND** the expenses total shows 1.750 € and the free margin 924 €

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
- **THEN** the sample category, expense and income-source names are shown in English, "Vivienda" as "Housing" and "Gimnasio" as "Gym"
- **AND** the "Seguro" definition is named "Insurance" in its sheet and its row

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
- **AND** the "Próximos cobros" footer still reads 1.025 €, because the new expense is not a recurring charge

#### Scenario: Category changes leave the free margin at 974
- **WHEN** on `/demo` in Spanish the visitor renames "comida", changes its colour, raises its budget to 600, clears "ocio"'s budget, and deletes "hogar" onto "compras"
- **THEN** after each of those saves the free margin shows 974 €
- **AND** the expenses total shows 1.700 € throughout

#### Scenario: A deleted category carries its charges
- **WHEN** the visitor deletes "hogar" onto "compras"
- **THEN** the "Limpieza" charge is listed in the "Compras" card and its dot in "Próximos cobros" takes the "compras" colour
- **AND** the "Próximos cobros" footer still reads 1.025 €
- **AND** opening the "Limpieza" row's definition shows "Compras" as its category

#### Scenario: Renamed category survives a language switch
- **WHEN** the visitor renames "comida" to "Mercado" and then switches the language to English
- **THEN** that card is still named "Mercado", and "ocio" is shown as "Leisure"

#### Scenario: Editing stays in the browser
- **WHEN** a visitor on `/demo` creates, edits, deletes and restores expenses, renames, recolours and deletes categories, and creates, edits, stops and deletes recurring definitions, while network traffic is recorded
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

#### Scenario: Reload discards definition changes
- **WHEN** the visitor has stopped the "Gimnasio" definition, raised "Seguro" to 50 € and reloads the page
- **THEN** both definitions are as the sample left them, "Seguro" showing 35 € and "4 de 10"
- **AND** the free margin shows 974 €
