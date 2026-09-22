## MODIFIED Requirements

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

**Savings editing on the demo:**
- Adding savings movements SHALL work as described in the `savings-editing` capability, through an in-memory implementation of the same savings operation the real route supplies.
- After each add, the savings total, the accumulated balance, the last point of the savings history, the progress against the target and the free margin SHALL be recalculated from the resulting movements.
- No savings change SHALL move an income or expense figure.
- Changes SHALL stay in the page's memory. They SHALL NOT be sent over the network, and reloading SHALL discard them.
- Changes SHALL survive a language switch. Sample movements SHALL then be shown in the new language, and typed names SHALL stay as typed.
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
- **WHEN** on `/demo` in Spanish a visitor opens the savings panel and adds a deposit of 50 named "Extra"
- **THEN** "Extra" is listed in the panel, the savings column shows 196 €, the accumulated balance 2.696 € and the free margin 924 €
- **AND** the expenses total still shows 1.700 € and the income total 2.820 €

#### Scenario: Repeated add actions
- **WHEN** on `/demo` in Spanish the visitor adds a deposit of 50 and then a withdrawal of 30
- **THEN** both movements are listed, the savings column shows 166 €, the accumulated balance 2.666 € and the free margin 954 €

#### Scenario: Reload discards savings movements
- **WHEN** the visitor has added a deposit of 50 and reloads the page
- **THEN** the savings column shows 146 €, the accumulated balance 2.646 € and the free margin 974 €, and the added movement is not listed

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
- **WHEN** a visitor on `/demo` creates, edits, deletes and restores expenses and income entries, adds savings movements, and renames, recolours and deletes categories, while network traffic is recorded
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
The `/demo` sample SHALL supply a savings target and at least six cycles of accumulated savings balance in its data. Neither is shown on the dashboard today: the savings column shows its label and its total, and the panel shows the accumulated balance as a number alone.

Carrying them SHALL move no existing figure: before any savings movement is added, the cycle's savings total, the accumulated balance, the free margin, the expenses total and every card total, budget bar, pie slice and summary row SHALL be what they were before. The last point of the supplied history SHALL equal the accumulated balance shown in the panel, so the two cannot disagree — on load and after every added movement, since both are recomputed from the same movements.

#### Scenario: The demo figures are unchanged
- **WHEN** `/demo` is rendered in Spanish
- **THEN** the savings total reads 146 €, the free margin 974 € and the expenses total 1.700 €
- **AND** the savings column shows no progress track and no caption

#### Scenario: The history agrees with the balance
- **WHEN** the demo data is built, and again after a deposit of 50 is added
- **THEN** its savings history carries at least six cycles of accumulated balance
- **AND** its last point equals the accumulated amount shown in the savings panel: 2.646 € and then 2.696 €

#### Scenario: The add control is unchanged
- **WHEN** "Añadir movimiento de ahorro" is activated on `/demo`
- **THEN** the control is still enabled in the same place, and it now opens the add-movement sheet instead of showing a "not available in the demo" message
