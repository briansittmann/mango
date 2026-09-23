## MODIFIED Requirements

### Requirement: Public demo route
The application SHALL serve `/demo` without authentication. It SHALL render the full dashboard from a fictional sample billing cycle held in memory. The sample SHALL include:
- at least two income entries, each with a calendar date inside the cycle, one of them produced by a recurring definition
- a housing category holding the cycle's largest recurring charges
- food and leisure categories with budgets partly spent
- a budgeted category that also holds a recurring charge
- other variable categories
- at least six recurring charges spread over several categories, each with a day of the month and a charged-or-pending state, with at least three of each state
- savings movements
- at least six cycles of history
- budgets stored for the cycle before the sample's cycle and none for the sample's cycle, so that the sample cycle's budgets are the copy described in `category-editing` → *Budgets belong to one cycle*

All totals in the sample SHALL be derived from its own rows, and the free margin SHALL be derived as `category-editing` → *A budget reserves its amount in the free margin* defines. The sample SHALL set its own "today" inside its cycle, so that default dates and budget pace do not depend on the real date. Whether a charge is already taken SHALL be part of the sample, not derived from the real date, so that both states stay visible whenever the demo is opened. The page SHALL show a permanent notice that the data is sample data. Reloading SHALL reset the page to the initial sample. The sample SHALL NOT contain any real user's data.

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
- After each change, every figure derived from categories SHALL be recalculated: card names, colours and borders, budget bars and their remaining text, the pie chart and its legend, the expenses summary rows, the expenses total, the free margin, and the dots in the `upcoming-charges` card.
- A category's typed name SHALL survive a language switch, while categories that have not been renamed SHALL still be shown in the new language.
- **Category changes SHALL move the free margin only through budgets.** Renames and recolours SHALL NOT move it. Setting, changing or clearing a budget, and deleting a category with a budget, SHALL move it exactly as `category-editing` → *A budget reserves its amount in the free margin* defines.

**Category reordering on the demo:**
- Reordering SHALL work as described in the `category-reordering` capability, through an in-memory implementation of the same reorder operation the real route supplies.
- A new order SHALL be kept in the page's memory, SHALL NOT be sent over the network, and SHALL be discarded on reload.
- A new order SHALL survive a language switch, a rename, a recolour, a budget change and an expense change, and SHALL apply to whatever categories remain after a deletion.
- **No reorder SHALL move any figure on the page.** The free margin SHALL stay at 844 €, the expenses total at 1.700 €, and every card total, budget bar, pie slice and summary row SHALL be unchanged.

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
- **AND** the expenses total shows 1.700 € and the free margin 844 €

#### Scenario: Sample totals are consistent
- **WHEN** the demo is rendered, and again after one expense has been created, another edited and a third deleted
- **THEN** each category's total in the expenses panel equals the sum of its card's listed expense rows, and the expenses summary total equals the sum of those category totals

#### Scenario: Reordering on the demo moves nothing but the cards
- **WHEN** the visitor enters reorder mode on `/demo` and drags "Comida" from position 2 to position 5
- **THEN** the cards read vivienda · ocio · transporte · comida · salud · hogar · compras
- **AND** the free margin still reads 844 €, the expenses total 1.700 €, and "Comida" still reads 310 € of 400 €

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
- **THEN** "Extra" is listed in the panel, the savings column shows 196 €, the accumulated balance 2.696 € and the free margin 794 €
- **AND** the expenses total still shows 1.700 € and the income total 2.820 €

#### Scenario: Repeated add actions
- **WHEN** on `/demo` in Spanish the visitor adds a deposit of 50 and then a withdrawal of 30
- **THEN** both movements are listed, the savings column shows 166 €, the accumulated balance 2.666 € and the free margin 824 €

#### Scenario: Reload discards savings movements
- **WHEN** the visitor has added a deposit of 50 and reloads the page
- **THEN** the savings column shows 146 €, the accumulated balance 2.646 € and the free margin 844 €, and the added movement is not listed

#### Scenario: Added income moves the income total and the free margin
- **WHEN** on `/demo` in Spanish, with the income total at 2.820 € and the free margin at 844 €, a visitor opens the income panel and adds 300 € described as "Bonus"
- **THEN** "Bonus" is listed in the panel with 300 € and its date, the income column shows 3.120 € and the free margin shows 1.144 €
- **AND** the expenses total still shows 1.700 €, and the "Próximos cobros" footer still reads 1.025 €

#### Scenario: Deleted income can be undone
- **WHEN** the visitor swipes the "Freelance" row (420 €) and activates "Eliminar", then activates "Deshacer"
- **THEN** after the deletion the income column shows 2.400 € and the free margin 424 €
- **AND** after the undo the row is listed again with 420 €, the income column shows 2.820 € and the free margin 844 €

#### Scenario: Added expense moves every figure
- **WHEN** on `/demo` in Spanish a visitor adds an expense of 20 described as "Regalo" to "compras", which has no budget
- **THEN** the "compras" card shows 115 €
- **AND** the expenses column shows 1.720 €, and the expenses panel lists "compras" with 115 €
- **AND** the September total exposed by the bar chart to assistive technology is 1.720 €
- **AND** the pie centre shows 1.720 €, and the "compras" legend entry shows "7 %"
- **AND** the free margin shows 824 €
- **AND** the "Próximos cobros" footer still reads 1.025 €, because the new expense is not a recurring charge

#### Scenario: Added expense within a budget moves every figure but the free margin
- **WHEN** on `/demo` in Spanish a visitor adds an expense of 20 described as "Panadería" to "comida"
- **THEN** the "comida" card shows 330 € of 400 €
- **AND** the expenses column, the bar chart's September total and the pie centre show 1.720 €, and the "comida" legend entry shows "19 %"
- **AND** the free margin still shows 844 €, because "comida" is still within its budget

#### Scenario: Category changes leave the free margin at 974
- **WHEN** on `/demo` in Spanish the visitor adds 130 € of income, bringing the free margin to 974 €, and then renames "comida", changes its colour, reorders the cards and deletes "hogar" onto "compras"
- **THEN** after each of those changes the free margin shows 974 €
- **AND** the expenses total shows 1.700 € throughout

#### Scenario: Category changes move the free margin only through budgets
- **WHEN** on `/demo` in Spanish the visitor renames "comida", changes its colour, raises its budget to 600, clears "ocio"'s budget, and deletes "hogar" onto "compras"
- **THEN** the free margin shows 844 € after the rename and the recolour, 644 € after the raise, and 664 € after clearing "ocio"'s budget and after the deletion
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
- **THEN** "Food" lists "Panadería" with €20, "Leisure" does not list "Cinema", and the free margin shows €844

#### Scenario: Reload discards edits
- **WHEN** the visitor has deleted "Café" and reloads the page
- **THEN** "Café" is listed in "comida" again, and the free margin shows 844 €

#### Scenario: Reload discards category changes
- **WHEN** the visitor has deleted the "hogar" category and reloads the page
- **THEN** the "Hogar" card is listed again with 95 €, and the free margin shows 844 €

### Requirement: Savings target and history on the demo
The `/demo` sample SHALL supply a savings target and at least six cycles of accumulated savings balance in its data. Neither is shown on the dashboard today: the savings column shows its label and its total, and the panel shows the accumulated balance as a number alone.

Carrying them SHALL move no existing figure: before any savings movement is added, the cycle's savings total, the accumulated balance, the free margin, the expenses total and every card total, budget bar, pie slice and summary row SHALL be what they were before. The last point of the supplied history SHALL equal the accumulated balance shown in the panel, so the two cannot disagree — on load and after every added movement, since both are recomputed from the same movements.

#### Scenario: The demo figures are unchanged
- **WHEN** `/demo` is rendered in Spanish
- **THEN** the savings total reads 146 €, the free margin 844 € and the expenses total 1.700 €
- **AND** the savings column shows no progress track and no caption

#### Scenario: The history agrees with the balance
- **WHEN** the demo data is built, and again after a deposit of 50 is added
- **THEN** its savings history carries at least six cycles of accumulated balance
- **AND** its last point equals the accumulated amount shown in the savings panel: 2.646 € and then 2.696 €

#### Scenario: The add control is unchanged
- **WHEN** "Añadir movimiento de ahorro" is activated on `/demo`
- **THEN** the control is still enabled in the same place, and it now opens the add-movement sheet instead of showing a "not available in the demo" message

### Requirement: Budget progress on budgeted categories
A card whose category has a budget SHALL show "spent of budget" in its header and a progress bar.

**Spent** SHALL be the category's spending outside recurring charges, as `category-editing` → *A budget reserves its amount in the free margin* defines. The header, the bar, its assistive-technology value and the text under the bar SHALL all use that figure. The card's recurring charges SHALL stay listed among its rows.

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

#### Scenario: A recurring charge stays out of the bar
- **WHEN** the "transporte" card on `/demo` (budget 100, "Gasolina" 80 € and the recurring "Parking" 50 €) is rendered in Spanish
- **THEN** its header shows 80 € of 100 € and its bar uses the warning colour
- **AND** when expanded it lists both "Gasolina" and "Parking", and the expenses panel lists "transporte" with 130 €

### Requirement: Cycle header and free margin
The top of the dashboard SHALL show a bar with the Mango logo and the app name on the left and the account avatar on the right.

Below the bar, the cycle name SHALL be the screen's title:
- It SHALL be left-aligned and larger than every other text except the free-margin number.
- Previous/next cycle controls SHALL sit beside it.
- The cycle SHALL be named after the month in which it ends.
- Under the title, the cycle's first and last day SHALL be shown as a date range in the active language. While the cycle contains today, the range SHALL be preceded by an "in progress" label.
- The title's accessible name SHALL contain the visible month name.

Activating the title SHALL open a month picker. In the picker, the selected month SHALL be marked by a filled shape and heavier weight, and exposed as current. Months after an in-progress cycle SHALL NOT be selectable.

Navigation SHALL reach the current cycle and earlier ones only. While the displayed cycle is in progress, the next-cycle control SHALL be disabled, beside the title and in the top bar alike, even when the mounting page supplies a handler for it. No control SHALL display a cycle after the current one.

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

#### Scenario: No way past the current cycle
- **WHEN** the displayed cycle is in progress and the mounting page supplies previous- and next-cycle handlers
- **THEN** the next-cycle control beside the title and the one in the top bar are both disabled, and the previous-cycle controls are enabled
- **AND** in the month picker, every month after the displayed one is disabled

#### Scenario: Month moves into the top bar
- **WHEN** the user scrolls until the title is under the top bar
- **THEN** the bar has a frosted surface and shows the month name between previous/next controls, and the avatar has not moved
- **AND** when the user scrolls back to the top, the bar is transparent, shows the app name, and its month controls cannot be reached by keyboard

#### Scenario: Free-margin card content
- **WHEN** the free margin is 844 and the cycle income is 2 820, in Spanish
- **THEN** the card shows its label and "844 €" as the largest text on the page, and contains no badge and no "2.820 €"
