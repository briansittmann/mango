## MODIFIED Requirements

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

### Requirement: Summary cards
Income, expenses and savings SHALL be shown as three columns of one grouped surface, each column showing a label and its total. Activating a column SHALL disclose its panel inside the same surface, below the columns. All three columns SHALL behave the same, with at most one panel open at a time. The open column SHALL be marked by an indicator under it and an upward chevron, in addition to any colour change. A panel SHALL NOT repeat its column's total.

Panel contents:
- **Income:** each income source with its actual amount and its estimated amount as muted reference, followed by an "add income" row.
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

#### Scenario: Signed savings movements
- **WHEN** the savings panel lists a deposit of 50 and a withdrawal of 20
- **THEN** the deposit amount shows a plus sign and the withdrawal amount shows a minus sign

#### Scenario: View all expenses clears the top bar
- **WHEN** the user activates "view all expenses"
- **THEN** after scrolling ends, the top edge of the first expense card is below the bottom edge of the top bar

### Requirement: Expense card states
Each expense card SHALL start collapsed.

**Collapsed:**
- It SHALL show a colour dot, the name, the total aligned right (or "spent of budget" for a category with a budget), and a chevron.
- A category with a budget SHALL also show its progress bar and remaining-amount text under the header.
- Its expense rows SHALL NOT be visible, focusable or exposed to assistive technology.

**Header:** it SHALL be exposed as expanded or collapsed. Opening or closing a card SHALL push the content below it rather than cover it.

**Expanded:**
- It SHALL list its expenses one row each: name on the left, date in muted text under the name, and the amount aligned right as plain text with tabular figures and no background of its own.
- Rows SHALL be at least 48px tall.
- The list SHALL be followed by an "add expense" row: a plus icon and label in the brand text colour, with no border or background of its own.

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

#### Scenario: Plain amounts and light add row
- **WHEN** the "comida" card is expanded
- **THEN** every expense amount has a transparent background and no border
- **AND** the "add expense" row has no border and a transparent background at rest

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

It SHALL NOT colour the card surface in any state, and a collapsed card's border SHALL use a theme token.

The pie chart SHALL have one slice per expense card with a non-zero total, a thin separator between slices, and the cycle total in the centre. The pie card's title row SHALL NOT repeat that total. The pie SHALL have a legend with one entry per slice, in the same order as the expense cards. Each entry SHALL show a colour dot, the name, and the slice's share of the cycle total as a whole-number percentage formatted for the active language.

#### Scenario: Expanded card border
- **WHEN** the "comida" card is expanded
- **THEN** its border colour equals the colour of its dot, and its surface keeps the card token colour

#### Scenario: Collapsed card border
- **WHEN** a card is collapsed
- **THEN** its border uses the border theme token, not the category colour

#### Scenario: Pie matches cards
- **WHEN** the dashboard shows the fixed-expenses card and five category cards with non-zero totals
- **THEN** the pie has six slices whose colours match the cards' dots
- **AND** the legend lists the same six entries with matching dots and names, in card order, each with a percentage instead of an amount

#### Scenario: Share and total
- **WHEN** the cycle total is 1 700, "comida" totals 310, and the language is Spanish
- **THEN** the "comida" legend entry shows "18 %"
- **AND** "1.700 €" appears exactly once inside the pie card, in the centre of the donut

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Dashboard follows the v0 visual reference
**Reason**: `DESIGN.md` had already overridden its pinned values: Geist Sans, a 480px column, 22/24/26px radii, a 64px hero number, 24px summary values, a dashed add row, a 48px pill month bar and a value label above every bar. They conflict with the hierarchy, spacing and material rules this change introduces.
**Migration**: Measurable visual rules now live in the `design-system` capability (type scale, spacing, touch targets, interaction states, materials, motion) and in *Mobile visual hierarchy* and *Monthly spend chart* above. `referencia/` stays in the repository as historical reference only.
