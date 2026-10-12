## MODIFIED Requirements

### Requirement: Public demo route
The application SHALL serve `/demo` without authentication. It SHALL render the full dashboard from a fictional sample billing cycle held in memory. The sample SHALL include:
- at least two income entries, each with a calendar date inside the cycle, one of them produced by a recurring definition
- a housing category holding the cycle's largest recurring charges
- food and leisure categories with budgets partly spent
- a budgeted category that also holds a recurring charge
- other variable categories
- at least six recurring charges spread over several categories, each with a day of the month and a charged-or-pending state, with at least three of each state
- a recurring definition behind every one of those charges, carrying its expected amount, its day, its category and its active state, with at least one of them ending after a number of repetitions and partway through that number
- savings movements
- at least six cycles of history
- budgets stored for the cycle before the sample's cycle and none for the sample's cycle, so that the sample cycle's budgets are the copy described in `category-editing` → *Budgets belong to one cycle*

All totals in the sample SHALL be derived from its own rows, and the free margin SHALL be derived as `category-editing` → *A budget reserves its amount in the free margin* defines. The sample SHALL set its own "today" inside its cycle, so that default dates and budget pace do not depend on the real date. Whether a charge is already taken SHALL be part of the sample, not derived from the real date, so that both states stay visible whenever the demo is opened. Every charge in the sample SHALL start equal to its definition's expected amount, so that no difference caption is shown before the visitor causes one. The page SHALL show a permanent notice that the data is sample data. Reloading SHALL reset the page to the initial sample. The sample SHALL NOT contain any real user's data.

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
- A budget change SHALL write only the sample cycle's budget. The budgets stored for the cycle before it SHALL NOT change.
- After each change, every figure derived from categories SHALL be recalculated: card names, colours and borders, budget bars and their remaining text, the pie chart and its legend, the expenses summary rows, the expenses total, the free margin, and the day marks in the `upcoming-charges` card.
- A category's typed name SHALL survive a language switch, while categories that have not been renamed SHALL still be shown in the new language.
- **Category changes SHALL move the free margin only through budgets.** Renames and recolours SHALL NOT move it. Setting, changing or clearing a budget, and deleting a category with a budget, SHALL move it exactly as `category-editing` → *A budget reserves its amount in the free margin* defines.

**Category reordering on the demo:**
- Reordering SHALL work as described in the `category-reordering` capability, through an in-memory implementation of the same reorder operation the real route supplies.
- A new order SHALL be kept in the page's memory, SHALL NOT be sent over the network, and SHALL be discarded on reload.
- A new order SHALL survive a language switch, a rename, a recolour, a budget change and an expense change, and SHALL apply to whatever categories remain after a deletion.
- **No reorder SHALL move any figure on the page.** The free margin SHALL stay at 864 €, the expenses total at 1.700 €, and every card total, budget bar, pie slice and summary row SHALL be unchanged.

**Recurring definitions on the demo:**
- Creating a definition from the entry sheet, editing one from "Próximos cobros", stopping it and deleting it SHALL work as described in the `recurring-expenses` capability, through an in-memory implementation of the same definition operations the real route supplies.
- After each change, every figure derived from the affected charge SHALL be recalculated, in the same render: its card total and budget progress, the expenses total, the pie, the current cycle's bar, the free margin, and the rows and footer total of the `upcoming-charges` card.
- **What moves a figure and what does not:** changing a definition's expected amount SHALL move figures only while this cycle's charge is still pending; deleting a definition SHALL remove its charge and move every figure derived from it; stopping a definition SHALL move no figure at all.
- A definition's typed name SHALL survive a language switch, while definitions that have not been renamed SHALL still be shown in the new language.
- Changes SHALL stay in the page's memory, SHALL NOT be sent over the network, and SHALL be discarded on reload.

**Savings editing on the demo:**
- Adding savings movements SHALL work as described in the `savings-editing` capability, through an in-memory implementation of the same savings operation the real route supplies.
- After each add, the savings total, the accumulated balance, the last point of the savings history, the progress against the target and the free margin SHALL be recalculated from the resulting movements.
- No savings change SHALL move an income or expense figure.
- Changes SHALL stay in the page's memory. They SHALL NOT be sent over the network, and reloading SHALL discard them.
- Changes SHALL survive a language switch. Sample movements SHALL then be shown in the new language, and typed names SHALL stay as typed.
- Month navigation SHALL stay disabled.
- "Cerrar sesión" SHALL lead to `/login`; there is no session to end.

#### Scenario: Visitor opens the demo
- **WHEN** an unauthenticated visitor opens `/demo`
- **THEN** the dashboard renders with sample data and a visible "sample data" notice, and no login is requested

#### Scenario: Sample cards and charges
- **WHEN** `/demo` is rendered in Spanish
- **THEN** seven category cards are listed, "Vivienda" totalling 900 € among them, and no card is named "Gastos fijos"
- **AND** the "Próximos cobros" card lists six charges — Parking día 15, Limpieza día 20 and Gimnasio día 22 pending; Alquiler día 1, Internet día 3 and Seguro día 8 already taken, behind the folded "3 cobrados" line
- **AND** the expenses total shows 1.700 € and the free margin 864 €

#### Scenario: Sample definitions
- **WHEN** `/demo` is rendered in Spanish, "Próximos cobros" is expanded and its taken charges are shown
- **THEN** the "Seguro" row shows "4 de 10", and no other row shows a progress
- **AND** no row shows an expected-amount caption, every charge matching its definition

#### Scenario: A definition change moves a pending charge
- **WHEN** on `/demo` in Spanish the visitor opens the "Gimnasio" row in "Próximos cobros" and saves an expected amount of 45 €
- **THEN** the "Salud" card shows 45 €, the expenses total 1.705 €, the "Próximos cobros" footer 1.030 € and the free margin 859 €
- **AND** the pie centre shows 1.705 €

#### Scenario: Stopping a definition moves nothing
- **WHEN** the visitor opens the "Gimnasio" definition and activates "Dejar de repetir"
- **THEN** the free margin still shows 864 €, the expenses total 1.700 € and the "Próximos cobros" footer 1.025 €
- **AND** the "Gimnasio" charge is still listed in the "Salud" card and in "Próximos cobros"

#### Scenario: Deleting a definition takes its charge
- **WHEN** the visitor opens the "Seguro" definition, activates the delete action and confirms
- **THEN** "Seguro" is no longer listed in the "Vivienda" card or in "Próximos cobros"
- **AND** the "Vivienda" card shows 865 €, the expenses total 1.665 €, the footer 990 € and the free margin 899 €

#### Scenario: A definition created on the demo appears in both places
- **WHEN** on `/demo` in Spanish the visitor adds an expense of 50 € named "Peaje" to "Transporte" with the recurrence switch on and day 15
- **THEN** "Peaje" is listed in the "Transporte" card, which shows 180 € of 100 €
- **AND** "Próximos cobros" lists "Peaje" with día 15 and 50 € under "Pendientes", after "Parking" and before "Limpieza"
- **AND** the expenses total shows 1.750 € and the free margin 814 €

#### Scenario: Sample totals are consistent
- **WHEN** the demo is rendered, and again after one expense has been created, another edited and a third deleted
- **THEN** each category's total in the expenses panel equals the sum of its card's listed expense rows, and the expenses summary total equals the sum of those category totals

#### Scenario: Reordering on the demo moves nothing but the cards
- **WHEN** the visitor enters reorder mode on `/demo` and drags "Comida" from position 2 to position 5
- **THEN** the cards read vivienda · ocio · transporte · comida · salud · hogar · compras
- **AND** the free margin still reads 864 €, the expenses total 1.700 €, and "Comida" still reads 310 € of 400 €

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
- **AND** the "Seguro" definition is named "Insurance" in its sheet and its row

#### Scenario: Add action in the demo
- **WHEN** on `/demo` in Spanish a visitor opens the savings panel and adds a deposit of 50 named "Extra"
- **THEN** "Extra" is listed in the panel, the savings column shows 196 €, the accumulated balance 2.696 € and the free margin 814 €
- **AND** the expenses total still shows 1.700 € and the income total 2.820 €

#### Scenario: Repeated add actions
- **WHEN** on `/demo` in Spanish the visitor adds a deposit of 50 and then a withdrawal of 30
- **THEN** both movements are listed, the savings column shows 166 €, the accumulated balance 2.666 € and the free margin 844 €

#### Scenario: Reload discards savings movements
- **WHEN** the visitor has added a deposit of 50 and reloads the page
- **THEN** the savings column shows 146 €, the accumulated balance 2.646 € and the free margin 864 €, and the added movement is not listed

#### Scenario: Added income moves the income total and the free margin
- **WHEN** on `/demo` in Spanish, with the income total at 2.820 € and the free margin at 864 €, a visitor opens the income panel and adds 300 € described as "Bonus"
- **THEN** "Bonus" is listed in the panel with 300 € and its date, the income column shows 3.120 € and the free margin shows 1.164 €
- **AND** the expenses total still shows 1.700 €, and the "Próximos cobros" footer still reads 1.025 €

#### Scenario: Deleted income can be undone
- **WHEN** the visitor swipes the "Freelance" row (420 €) and activates "Eliminar", then activates "Deshacer"
- **THEN** after the deletion the income column shows 2.400 € and the free margin 444 €
- **AND** after the undo the row is listed again with 420 €, the income column shows 2.820 € and the free margin 864 €

#### Scenario: Added expense moves every figure
- **WHEN** on `/demo` in Spanish a visitor adds an expense of 20 described as "Regalo" to "compras", which has no budget
- **THEN** the "compras" card shows 115 €
- **AND** the expenses column shows 1.720 €, and the expenses panel lists "compras" with 115 €
- **AND** the September total exposed by the bar chart to assistive technology is 1.720 €
- **AND** the pie centre shows 1.720 €, and the "compras" legend entry shows "7 %"
- **AND** the free margin shows 844 €
- **AND** the "Próximos cobros" footer still reads 1.025 €, because the new expense is not a recurring charge

#### Scenario: Added expense within a budget moves every figure but the free margin
- **WHEN** on `/demo` in Spanish a visitor adds an expense of 20 described as "Panadería" to "comida"
- **THEN** the "comida" card shows 330 € of 400 €
- **AND** the expenses column, the bar chart's September total and the pie centre show 1.720 €, and the "comida" legend entry shows "19 %"
- **AND** the free margin still shows 864 €, because "comida" is still within its budget

#### Scenario: Category changes leave the free margin at 994
- **WHEN** on `/demo` in Spanish the visitor adds 130 € of income, bringing the free margin to 994 €, and then renames "comida", changes its colour, reorders the cards and deletes "hogar" onto "compras"
- **THEN** after each of those changes the free margin shows 994 €
- **AND** the expenses total shows 1.700 € throughout

#### Scenario: Category changes move the free margin only through budgets
- **WHEN** on `/demo` in Spanish the visitor renames "comida", changes its colour, raises its budget to 600, clears "ocio"'s budget, and deletes "hogar" onto "compras"
- **THEN** the free margin shows 864 € after the rename and the recolour, 664 € after the raise, and 684 € after clearing "ocio"'s budget and after the deletion
- **AND** the expenses total shows 1.700 € throughout

#### Scenario: A deleted category carries its charges
- **WHEN** the visitor deletes "hogar" onto "compras"
- **THEN** the "Limpieza" charge is listed in the "Compras" card and its day mark in "Próximos cobros" takes the "compras" tint, with "Compras" on its muted line
- **AND** the "Próximos cobros" footer still reads 1.025 €

#### Scenario: Renamed category survives a language switch
- **WHEN** the visitor renames "comida" to "Mercado" and then switches the language to English
- **THEN** that card is still named "Mercado", and "ocio" is shown as "Leisure"

#### Scenario: Editing stays in the browser
- **WHEN** a visitor on `/demo` creates, edits, deletes and restores expenses and income entries, adds savings movements, and renames, recolours and deletes categories, while network traffic is recorded
- **THEN** the browser sends no POST request and no request to a Supabase host, and no login is requested

#### Scenario: Edits survive a language switch
- **WHEN** the visitor adds 20 € described as "Panadería" to "comida", deletes "Cine", and then switches the language to English
- **THEN** "Food" lists "Panadería" with €20, "Leisure" does not list "Cinema", and the free margin shows €864

#### Scenario: Reload discards edits
- **WHEN** the visitor has deleted "Café" and reloads the page
- **THEN** "Café" is listed in "comida" again, and the free margin shows 864 €

#### Scenario: Reload discards category changes
- **WHEN** the visitor has deleted the "hogar" category and reloads the page
- **THEN** the "Hogar" card is listed again with 95 €, and the free margin shows 864 €

### Requirement: Category colour placement
A category's colour SHALL appear only in these places:
- the dot next to its name, drawn as a single flat colour
- the border of its card while the card is expanded
- its slice in the pie chart
- its dot in the pie legend
- the tint of the day mark on its charges in the `upcoming-charges` card
- its bar and its dot in the weekly top-categories widget (`spend-insights`)

It SHALL NOT colour the card surface in any state, and a collapsed card's border SHALL use a theme token. Text SHALL never take a category's colour.

The pie chart SHALL have one slice per expense card with a non-zero total, a 2px separator in the surface colour between slices, and the cycle total in the centre with a "Total" label. The donut SHALL be at least 160px across at a 390px-wide viewport and SHALL sit above its legend there; at ≥640px the donut and the legend SHALL sit side by side. The pie card's title row SHALL NOT repeat that total. The pie SHALL have a legend with one entry per slice, in the same order as the expense cards. Each entry SHALL show a colour dot, the name, the slice's amount and the slice's share of the cycle total as a whole-number percentage formatted for the active language, with amounts right-aligned in tabular figures.

Hovering or focusing a slice or its legend entry SHALL highlight that category: its slice SHALL be drawn slightly larger, the other slices SHALL fade to half opacity, its legend entry SHALL be emphasised, and the centre SHALL show that category's name and amount in place of the total. Leaving SHALL restore the total and every slice. Legend entries SHALL be reachable with the keyboard and SHALL each be a control that scrolls to that category's card, leaving it visible below the top bar.

#### Scenario: Expanded card border
- **WHEN** the "comida" card is expanded
- **THEN** its border colour equals the colour of its dot, and its surface keeps the card token colour

#### Scenario: Collapsed card border
- **WHEN** a card is collapsed
- **THEN** its border uses the border theme token, not the category colour

#### Scenario: Pie matches cards
- **WHEN** the dashboard shows seven category cards with non-zero totals
- **THEN** the pie has seven slices whose colours match the cards' dots
- **AND** the legend lists the same seven entries with matching dots and names, in card order, each with an amount and a percentage

#### Scenario: Share and total
- **WHEN** the cycle total is 1 700, "comida" totals 310, and the language is Spanish
- **THEN** the "comida" legend entry shows "310 €" and "18 %"
- **AND** "1.700 €" appears exactly once inside the pie card, in the centre of the donut, under a "Total" label

#### Scenario: Highlight a category
- **WHEN** the pointer rests on the "comida" legend entry
- **THEN** the centre of the donut reads "Comida" and "310 €", the "comida" slice is larger than at rest, the other slices are at half opacity, and the legend entry is emphasised
- **AND** when the pointer leaves, the centre reads "Total" and "1.700 €" and every slice is at full opacity

#### Scenario: Legend leads to the card
- **WHEN** the visitor focuses the "ocio" legend entry with the keyboard and presses Enter
- **THEN** the page scrolls so the "Ocio" card's top edge is below the bottom edge of the top bar

#### Scenario: Donut layout by width
- **WHEN** the card is rendered at 390px and at 1280px
- **THEN** at 390px the donut is at least 160px across and the legend is under it; at 1280px the legend is beside it

