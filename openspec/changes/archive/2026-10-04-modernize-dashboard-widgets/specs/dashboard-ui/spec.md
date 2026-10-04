## ADDED Requirements

### Requirement: Desktop layout
At a viewport 1024px wide or wider the dashboard SHALL lay its content out in two columns inside the page column of `design-system` → *Wide viewports*: a main column holding the cycle title, the free-margin card, the summary group and the expense breakdown, and a narrower widget column holding, in this order, the weekly top-categories widget, the spend calendar, the monthly spend chart and the distribution donut. The widget column SHALL be at least 360px wide and SHALL stick below the top bar while the main column scrolls, until its own height exceeds the viewport, in which case it SHALL scroll with the page. Below 1024px every one of those widgets SHALL follow the expense breakdown in the single column, in the same order.

Reorder mode SHALL keep working at every width: its pushed-back layer SHALL cover both columns and the handle lane SHALL open beside the cards in the main column. Every sheet and the month picker SHALL open within the page column at ≥1024px rather than stretched to the viewport's width: a modal sheet centred over it, a sheet anchored to its opener at its anchor.

#### Scenario: Two columns on a laptop
- **WHEN** `/demo` is rendered at a 1280px-wide viewport
- **THEN** the free-margin card and the first weekly bar are at the same vertical position, the widget column's left edge is to the right of the free-margin card's right edge, and the four widgets are stacked in it in order

#### Scenario: Widgets stick while cards scroll
- **WHEN** at 1280px the visitor opens three category cards and scrolls 600px
- **THEN** the weekly widget's top edge is still just below the top bar while the opened cards have moved up

#### Scenario: One column on a phone and a tablet
- **WHEN** `/demo` is rendered at 390px and at 820px
- **THEN** the four widgets follow the last category card in one column, in the order weekly, calendar, monthly, distribution

#### Scenario: Reorder on a laptop
- **WHEN** reorder mode is entered at 1280px
- **THEN** the widget column is dimmed under the pushed-back layer, the cards of the main column keep their handle lane, and "Listo" leaves the layout as it was

## MODIFIED Requirements

### Requirement: Cycle header and free margin
The top of the dashboard SHALL show a bar with the Mango logo and the app name on the left and the account avatar on the right.

Below the bar, the cycle name SHALL be the screen's title:
- It SHALL be left-aligned and larger than every other text except the free-margin number.
- Previous/next cycle controls SHALL sit beside it.
- The cycle SHALL be named after the month in which it ends.
- Under the title, the cycle's first and last day SHALL be shown as a date range in the active language. While the cycle contains today, the range SHALL be preceded by an "in progress" label. While the cycle is a projection, the range SHALL be preceded by a "Proyección" label instead.
- The title's accessible name SHALL contain the visible month name.

Activating the title SHALL open a month picker. In the picker, the selected month SHALL be marked by a filled shape and heavier weight, and exposed as current. Months more than six cycles after the cycle in progress SHALL NOT be selectable.

Navigation SHALL reach every earlier cycle and up to six cycles after the one in progress. While the sixth cycle after the one in progress is displayed, the next-cycle control SHALL be disabled, beside the title and in the top bar alike, even when the mounting page supplies a handler for it. No control SHALL display a cycle further ahead.

Once the title has scrolled under the top bar, the bar SHALL become a frosted surface and show the month name with previous/next controls in place of the app name. The avatar SHALL stay in the same position. While the title is in view, the bar SHALL be transparent and its month controls SHALL be hidden and unreachable, so the month is never shown twice.

Below the header, a free-margin card SHALL show a "free margin" label and the supplied free-margin amount as the most prominent number on the screen, in the brand colour. Under the number the card SHALL show a **composition strip**: one thin bar split into three segments — what the cycle's income went to in spending (budgets and spending as the free margin counts them), savings and the free margin — each segment's width proportional to its share of the income, separated by a 2px surface gap, with a text label under each segment in a text token and no amount or percentage printed. A segment with no share SHALL be omitted together with its label. When the free margin is negative or the income is zero, the strip SHALL NOT be shown. Hovering or focusing a segment SHALL show a tooltip naming it with its amount and its share of the income as a whole-number percentage. At a viewport 1024px wide or wider the strip SHALL always be shown and the card SHALL NOT be a control. Below 1024px the strip SHALL be folded away at rest, and activating the card anywhere SHALL disclose it and activating it again SHALL fold it; the card SHALL show no chevron, icon or other indicator that it opens, SHALL respond to a press with a slight scale, and SHALL expose its open state to assistive technology through a control named after the label and the amount. Activating a segment SHALL NOT fold the strip. The card SHALL NOT contain a badge or any amount other than the free margin at rest.

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

#### Scenario: Projection label
- **WHEN** the displayed cycle is the November 2026 projection and the language is Spanish
- **THEN** the line under the title shows "Proyección" followed by a date range covering 1 and 30 November, and no "en curso" label

#### Scenario: Month picker marks the selection
- **WHEN** the user activates the title
- **THEN** a month picker opens, in which September has a filled background and heavier weight than the other months and is exposed as current

#### Scenario: Navigation into the projection
- **WHEN** the displayed cycle is September 2026, in progress, and the mounting page supplies previous- and next-cycle handlers
- **THEN** the next-cycle control beside the title and the one in the top bar are both enabled
- **AND** in the month picker, October 2026 to March 2027 are enabled and April 2027 onwards is disabled

#### Scenario: No way past the current cycle
- **WHEN** the displayed cycle is March 2027, the last reachable one, six cycles past the September 2026 cycle in progress
- **THEN** the next-cycle control beside the title and the one in the top bar are both disabled, and the previous-cycle controls are enabled

#### Scenario: Month moves into the top bar
- **WHEN** the user scrolls until the title is under the top bar
- **THEN** the bar has a frosted surface and shows the month name between previous/next controls, and the avatar has not moved
- **AND** when the user scrolls back to the top, the bar is transparent, shows the app name, and its month controls cannot be reached by keyboard

#### Scenario: Free-margin card content
- **WHEN** the free margin is 864 and the cycle income is 2 820, in Spanish
- **THEN** the card shows its label and "864 €" as the largest text on the page, and contains no badge and no "2.820 €"
- **AND** under the number a strip shows three segments labelled for spending, savings and free, the free segment being about 31 % of the strip's width, and no number beside any label

#### Scenario: The strip folds on a phone
- **WHEN** `/demo` is rendered at a 390px-wide viewport
- **THEN** the strip is not visible, the card shows no chevron or icon, and its control is exposed as collapsed
- **AND** after the card is activated the strip is visible and the control is exposed as expanded, a tap on a segment leaves it open, and activating the card again folds it
- **AND** at a 1280px-wide viewport the strip is visible without any activation and the card contains no control

#### Scenario: Composition tooltip
- **WHEN** the pointer rests on the savings segment of the demo's strip (opened first below 1024px), in Spanish
- **THEN** a tooltip shows the savings label, "146 €" and "5 %", and leaves when the pointer leaves
- **AND** the same tooltip is shown while the segment has keyboard focus

#### Scenario: No strip when nothing is free
- **WHEN** the free margin is negative
- **THEN** the card shows the label and the negative amount in the negative treatment, and no strip

### Requirement: Summary cards
Income, expenses and savings SHALL be shown as three columns of one grouped surface, each column showing a label, its total and, under the total, a **trend**: a signed delta against the previous cycle as a whole-number percentage with an arrow, and a sparkline of the six history entries ending at the shown cycle (expenses and income from their cycle totals, savings from the accumulated balance). The delta's colour SHALL say whether the direction is good: for income and savings up is good, for expenses up is bad; a change under 1 % SHALL be shown as flat in the muted colour. The delta SHALL be omitted when the previous cycle's figure is zero. The sparkline SHALL use the de-emphasis tone with the shown cycle's point in the brand colour, SHALL carry no axis and no label, and SHALL be decorative to assistive technology, which SHALL instead reach the delta's text. Activating a column SHALL disclose its panel inside the same surface, below the columns. All three columns SHALL behave the same, with at most one panel open at a time. The open column SHALL be marked by an indicator under it and an upward chevron, in addition to any colour change. A panel SHALL NOT repeat its column's total. The three columns SHALL keep the same height and SHALL place their labels, totals and trends at the same vertical positions as one another.

Panel contents:
- **Income:** each income entry of the cycle with its amount and, under its name, its date in the active language, ordered by date from newest to oldest, followed by an "add income" row. No estimated or expected amount SHALL be shown beside an entry.
- **Expenses:** every expense card's name, colour dot and total, sorted from highest to lowest total, ending with a "view all expenses" row that scrolls smoothly to the expense cards. The scroll SHALL leave the first card visible below the top bar.
- **Savings:** an accumulated-balance block, then the cycle's individual movements, followed by an "add savings movement" row.

The **accumulated block** SHALL be distinguishable from a movement row without reading it: its label SHALL use the muted text colour, its amount SHALL NOT use the weight a movement's amount uses, and it SHALL be separated from the movements below it by more space than separates two movements. It SHALL show its label on the left and its amount on the right, with nothing between them. The block SHALL NOT be interactive: it SHALL expose no chevron, no button and no tap target.

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

#### Scenario: Trends on the demo
- **WHEN** `/demo` is rendered in Spanish
- **THEN** the expenses column shows "1.700 €" with a delta of −3 % against August's 1 750 € in the good colour and a six-point sparkline, the income column shows its delta against the previous cycle's income, and the savings column shows "146 €" with the delta of the accumulated balance against August's 2 500 €
- **AND** each delta is reachable as text to assistive technology and no sparkline is

#### Scenario: Flat and missing deltas
- **WHEN** the previous cycle's expenses equal this cycle's within 1 %
- **THEN** the expenses delta reads as flat, in the muted colour, with no up or down arrow
- **AND** when the previous cycle's income is zero, the income column shows its sparkline and no delta

#### Scenario: The trend keeps the columns in step
- **WHEN** `/demo` is rendered at a 390px-wide viewport
- **THEN** the income, expenses and savings columns have the same height, and their labels, totals and trend lines are at the same vertical positions across the three

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

#### Scenario: The accumulated block is a label and an amount
- **WHEN** the savings panel is open on `/demo`
- **THEN** the block shows the accumulated label and the accumulated amount and nothing else between them
- **AND** the accumulated amount is announced exactly once

#### Scenario: Amounts line up
- **WHEN** the savings panel is open on `/demo` with a deposit, a withdrawal and the accumulated balance shown
- **THEN** every amount in the panel computes `font-variant-numeric: tabular-nums`
- **AND** the right edge of each amount is at the same horizontal position

#### Scenario: View all expenses clears the top bar
- **WHEN** the user activates "view all expenses"
- **THEN** after scrolling ends, the top edge of the first expense card is below the bottom edge of the top bar

### Requirement: Savings target in the data
The data supplied to the dashboard MAY carry a savings target for the cycle. It SHALL be a per-user value, supplied as a number, and it SHALL be absent — not zero — when the user has not set one. No dashboard component SHALL hold a target of its own or fall back to a default when none is supplied.

The dashboard SHALL NOT show the target today: whether or not one is supplied, the savings column SHALL show its label, its total and its trend as *Summary cards* defines, with no progress track against the target, no caption about it, no check mark and no placeholder, and SHALL NOT be shown as disabled.

#### Scenario: A supplied target changes nothing on screen
- **WHEN** the dashboard is mounted with savings movements and a savings target of 300
- **THEN** the savings column shows its label, its total and its trend, and contains no progress track, no target caption and no check mark

#### Scenario: No target, no bar
- **WHEN** the dashboard is mounted with savings movements and no savings target
- **THEN** the savings column shows its label, its total and its trend, and contains no progress track, no target caption and no check mark
- **AND** the column is not exposed as disabled and still opens its panel when activated

#### Scenario: The three columns keep one shape
- **WHEN** `/demo` is rendered at a 390px-wide viewport
- **THEN** the income, expenses and savings columns have the same height and their labels, totals and trends sit at the same vertical positions
- **AND** no column carries anything below its trend

### Requirement: Mobile visual hierarchy
At a 390px-wide viewport, the dashboard SHALL rank text sizes by importance:
1. The free-margin number SHALL be the largest text.
2. The cycle title SHALL be the second largest.
3. Summary totals and section titles SHALL be smaller than the cycle title and larger than row text.
4. Metadata (dates, remaining-amount text, estimates, summary labels, summary deltas, the composition strip's labels, the cycle date range, widget captions, week names, calendar day numbers and chart labels) SHALL be smaller than row text and use the muted text colour, except a delta, which takes the colour of its direction.

Among texts larger than row text, only the free-margin number SHALL use the brand colour.

No bordered, rounded surface SHALL contain another one, in any open or closed state. For this rule, a surface is an element with a visible border, a corner radius of at least 12px and a height of at least 64px. A tooltip is transient and is not a surface for this rule.

#### Scenario: Size order
- **WHEN** `/demo` is rendered at a 390px-wide viewport
- **THEN** the computed font sizes satisfy: free-margin number > cycle title > each summary total and section title > each expense-card name and amount > each date, remaining-amount text, summary label, delta, strip label, week name and calendar day number

#### Scenario: One brand-coloured figure
- **WHEN** `/demo` is rendered in either theme
- **THEN** the income, expenses and savings totals use the regular text colour
- **AND** the free-margin number is the only text larger than 16px in the brand text colour

#### Scenario: No nested surfaces
- **WHEN** `/demo` is rendered with every card collapsed, and again with the income panel and the "comida" card open
- **THEN** no bordered, rounded surface is contained in another bordered, rounded surface

### Requirement: Monthly spend chart
The monthly spend chart SHALL show one bar per history entry, oldest to newest, with the short month name under every bar. The current cycle's bar SHALL use the brand colour and the other bars the de-emphasis tone. Bars SHALL be at most 24px thick, rounded at the top and square at the baseline, with at least a 2px gap of the surface colour between neighbours, and SHALL grow from one hairline baseline in a tone one step off the surface. The chart SHALL have a single title, no value axis and no gridlines, and SHALL NOT sit on a second surface inside its card.

Next to the title the card SHALL show a caption comparing the shown cycle's total with the previous cycle's: a signed whole-number percentage with an arrow and the previous month's short name, in the colour that says whether the direction is good (down is good for spending), or a flat caption in the muted colour when the change is under 1 %. The caption SHALL be omitted when the previous cycle's total is zero.

A value label SHALL appear only above the selected bar. The current cycle's bar SHALL be selected initially. Activating another bar SHALL select it and show its month label in a heavier weight. Hovering or focusing any bar SHALL show a tooltip with the month's full name and its total; the bars SHALL be reachable with the keyboard in order and the focused bar SHALL be selected with Enter or Space. The hit area of a bar SHALL be at least 44px wide, whatever the bar's own thickness.

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

#### Scenario: Caption against the previous cycle
- **WHEN** the demo's chart is rendered in Spanish, with September at 1 700 € and August at 1 750 €
- **THEN** the caption reads a 3 % drop against "ago" in the good colour
- **AND** after 50 € is added to "compras" (1 750 € against 1 750 €) the caption reads as flat in the muted colour

#### Scenario: Bar geometry
- **WHEN** the chart is rendered at 390px and at 1280px
- **THEN** every bar is at most 24px thick, the gap between neighbouring bars is at least 2px, and each bar's hit area is at least 44px wide

#### Scenario: Tooltip and keyboard
- **WHEN** the pointer rests on the July bar, and separately when the July bar receives keyboard focus and Enter is pressed
- **THEN** a tooltip shows "julio" and the July total in both cases, and after Enter the July bar is the selected one

#### Scenario: Totals for assistive technology
- **WHEN** assistive technology reads the chart
- **THEN** it can reach each of the six months together with its total amount

### Requirement: Category colour placement
A category's colour SHALL appear only in these places:
- the dot next to its name, drawn as a single flat colour
- the border of its card while the card is expanded
- its slice in the pie chart
- its dot in the pie legend
- the dot on its charges in the `upcoming-charges` card
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
