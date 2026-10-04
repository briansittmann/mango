## MODIFIED Requirements

### Requirement: Desktop layout
At a viewport 1024px wide or wider the dashboard SHALL be framed by the shell of the `desktop-shell` capability and SHALL lay its content out as: a row of four stat tiles across the content width, then a main column holding the expense breakdown and the "Próximos cobros" card, and a widget column at least 320px wide holding the chart widgets in the user's saved order. Both columns SHALL scroll with the page; no column SHALL stick to the viewport or scroll on its own. Below 1024px every widget SHALL follow the expense breakdown in the single column, in the saved order.

Reorder mode SHALL keep working at every width: its pushed-back layer SHALL cover the sidebar, the top bar and both columns, and the handle lane SHALL open beside the cards in the main column. Every sheet SHALL open as a side panel at ≥1024px, as `desktop-shell` → *Sheets open as side panels* describes.

#### Scenario: Two columns on a laptop
- **WHEN** `/demo` is rendered at a 1280px-wide viewport
- **THEN** the stat tiles span the content width above both columns, the widget column's left edge is to the right of the first category card's right edge, and the widgets are stacked in it in the saved order

#### Scenario: Nothing sticks
- **WHEN** at 1280px every category card is open and the page is scrolled by 800px
- **THEN** the first widget's top edge has moved up by 800px, and no element other than the document has a vertical scrollbar

#### Scenario: One column on a phone and a tablet
- **WHEN** `/demo` is rendered at 390px and at 820px
- **THEN** the widgets follow the last category card in one column, in the saved order

#### Scenario: Reorder on a laptop
- **WHEN** reorder mode is entered at 1280px
- **THEN** the sidebar, the top bar and the widget column are dimmed under the pushed-back layer, the cards of the main column keep their handle lane, and "Listo" leaves the layout as it was

### Requirement: Cycle header and free margin
Below 1024px the top of the dashboard SHALL show a bar with the Mango logo and the app name on the left and the account avatar on the right. At 1024px and wider that bar and the title block below SHALL NOT be rendered: the month, its controls, the status label and the month picker live in the shell's top bar (`desktop-shell` → *Desktop shell at wide viewports*), with the same six-cycle limit and the same picker.

Below the bar, the cycle name SHALL be the screen's title:
- It SHALL be left-aligned and larger than every other text except the free-margin number.
- Previous/next cycle controls SHALL sit beside it.
- The cycle SHALL be named after the month in which it ends.
- Under the title, the cycle's first and last day SHALL be shown as a date range in the active language. While the cycle contains today, the range SHALL be preceded by an "in progress" label. While the cycle is a projection, the range SHALL be preceded by a "Proyección" label instead.
- The title's accessible name SHALL contain the visible month name.

Activating the title SHALL open a month picker. In the picker, the selected month SHALL be marked by a filled shape and heavier weight, and exposed as current. Months more than six cycles after the cycle in progress SHALL NOT be selectable.

Navigation SHALL reach every earlier cycle and up to six cycles after the one in progress. While the sixth cycle after the one in progress is displayed, the next-cycle control SHALL be disabled, beside the title and in the top bar alike, even when the mounting page supplies a handler for it. No control SHALL display a cycle further ahead.

Once the title has scrolled under the top bar, the bar SHALL become a frosted surface and show the month name with previous/next controls in place of the app name. The avatar SHALL stay in the same position. While the title is in view, the bar SHALL be transparent and its month controls SHALL be hidden and unreachable, so the month is never shown twice.

Below the header, a free-margin card SHALL show a "free margin" label and the supplied free-margin amount as the most prominent number on the screen, in the brand colour. Under the number the card SHALL show a **composition strip**: one thin bar split into three segments — what the cycle's income went to in spending (budgets and spending as the free margin counts them), savings and the free margin — each segment's width proportional to its share of the income, separated by a 2px surface gap, with a text label under each segment in a text token and no amount or percentage printed. A segment with no share SHALL be omitted together with its label. When the free margin is negative or the income is zero, the strip SHALL NOT be shown. Hovering or focusing a segment SHALL show a tooltip naming it with its amount and its share of the income as a whole-number percentage. At a viewport 1024px wide or wider the card SHALL be the first of the stat tiles (`desktop-shell` → *Stat tiles*): it SHALL NOT be a control, SHALL NOT show the strip, and the strip SHALL be shown in the sidebar's savings block instead. Below 1024px the strip SHALL be folded away at rest, and activating the card anywhere SHALL disclose it and activating it again SHALL fold it; the card SHALL show no chevron, icon or other indicator that it opens, SHALL respond to a press with a slight scale, and SHALL expose its open state to assistive technology through a control named after the label and the amount. Activating a segment SHALL NOT fold the strip. The card SHALL NOT contain a badge or any amount other than the free margin at rest.

#### Scenario: Cycle crossing months
- **WHEN** the cycle runs from 26 August to 25 September
- **THEN** the title shows September in the active language

#### Scenario: Top bar
- **WHEN** the dashboard is rendered at a 390px-wide viewport
- **THEN** the logo (decorative, with an empty accessible name) and the app name appear at the top left, and the avatar at the top right

#### Scenario: No phone bar on a laptop
- **WHEN** the dashboard is rendered at a 1280px-wide viewport
- **THEN** the phone's bar and the title block are absent from the accessibility tree, the month name appears exactly once, in the shell's top bar, and activating it opens the month picker

#### Scenario: Title, range and progress label
- **WHEN** the cycle runs from 1 to 30 September 2026, contains today, and the language is Spanish, at a 390px-wide viewport
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

#### Scenario: The strip lives in the sidebar on a laptop
- **WHEN** `/demo` is rendered at a 1280px-wide viewport
- **THEN** the free-margin tile contains no strip and no control, and the sidebar's savings block shows the strip with its three labels

#### Scenario: Composition tooltip
- **WHEN** the pointer rests on the savings segment of the demo's strip (opened first below 1024px), in Spanish
- **THEN** a tooltip shows the savings label, "146 €" and "5 %", and leaves when the pointer leaves
- **AND** the same tooltip is shown while the segment has keyboard focus

#### Scenario: No strip when nothing is free
- **WHEN** the free margin is negative
- **THEN** the card shows the label and the negative amount in the negative treatment, and no strip

### Requirement: Summary cards
Below 1024px, income, expenses and savings SHALL be shown as three columns of one grouped surface, each column showing a label, its total and, under the total, a **trend**: a signed delta against the previous cycle as a whole-number percentage with an arrow, and a sparkline of the six history entries ending at the shown cycle (expenses and income from their cycle totals, savings from the accumulated balance). The delta's colour SHALL say whether the direction is good: for income and savings up is good, for expenses up is bad; a change under 1 % SHALL be shown as flat in the muted colour. The delta SHALL be omitted when the previous cycle's figure is zero. The sparkline SHALL use the de-emphasis tone with the shown cycle's point in the brand colour, SHALL carry no axis and no label, and SHALL be decorative to assistive technology, which SHALL instead reach the delta's text. Activating a column SHALL disclose its panel inside the same surface, below the columns. All three columns SHALL behave the same, with at most one panel open at a time. The open column SHALL be marked by an indicator under it and an upward chevron, in addition to any colour change. A panel SHALL NOT repeat its column's total. The three columns SHALL keep the same height and SHALL place their labels, totals and trends at the same vertical positions as one another.

At 1024px and wider the three SHALL instead be the second, third and fourth stat tiles of `desktop-shell` → *Stat tiles*: separate tiles with no shared surface and no accordion, the income and savings panels opening as side panels with the contents below, and the expenses tile scrolling to the breakdown.

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
- **WHEN** at a 390px-wide viewport the income panel is open and the user activates the savings column
- **THEN** the income panel closes and the savings panel opens

#### Scenario: One grouped surface
- **WHEN** at a 390px-wide viewport the income column is activated
- **THEN** its panel appears inside the same bordered surface as the three columns and spans that surface's full width
- **AND** no second bordered surface is created

#### Scenario: Tiles instead of columns on a laptop
- **WHEN** `/demo` is rendered at a 1280px-wide viewport
- **THEN** the income, expenses and savings figures are in three separate bordered tiles with no indicator or chevron, and activating the savings tile opens a side panel with the accumulated block, the movements and the add row

#### Scenario: Panel does not repeat the total
- **WHEN** the income panel is open and the cycle income is 2 820, in Spanish
- **THEN** "2.820 €" appears exactly once inside the surface that holds the income total and its panel

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

### Requirement: Expense card states
Below 1024px each expense card SHALL start collapsed. At 1024px and wider each expense card SHALL start open, and the expenses section title SHALL be followed by a "collapse all" / "expand all" control — "collapse all" while at least one card is open, "expand all" while none is — and a "new category" control that opens the category sheet in create mode. Closing a card at that width SHALL be remembered while the page is open and SHALL NOT change what the next load shows.

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

Several cards SHALL be able to be open at once. Below 1024px a "collapse all" control SHALL be shown next to the expenses section title while at least one card is open, SHALL close every open card — the `upcoming-charges` card included — and SHALL be hidden while no card is open. At 1024px and wider the control described above takes its place, and "expand all" SHALL open every category card.

#### Scenario: Open two cards then collapse all
- **WHEN** at a 390px-wide viewport no card is open
- **THEN** no "collapse all" control is visible
- **AND** when the user expands the "comida" card, expands the "ocio" card, then activates "collapse all", both cards were open at the same time, both are collapsed afterwards, and the control is hidden again

#### Scenario: Cards start open on a laptop
- **WHEN** `/demo` is rendered at a 1280px-wide viewport
- **THEN** every category card is exposed as expanded with its rows visible, the section title is followed by "collapse all" and "new category", and activating "collapse all" collapses every card and turns the control into "expand all"

#### Scenario: New category from the section header
- **WHEN** at 1280px the "new category" control is activated
- **THEN** the category sheet opens in create mode as a side panel

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

### Requirement: Account avatar and menu
Below 1024px the top-right corner SHALL show a 36px circular avatar with the user's photo, or the initial of the user's name when there is no photo. At 1024px and wider the avatar SHALL be part of the sidebar's account card (`desktop-shell` → *Desktop shell at wide viewports*) and SHALL NOT be shown in any top bar. The avatar SHALL NOT use the brand or green colours. Activating the avatar, or the account card, SHALL open a menu containing the user's photo or initial, name and, when the account has one, phone number, a theme control, a language control, and a log-out action separated by a divider at the bottom: a bottom sheet below 640px, an anchored popover placed entirely within the viewport from 640px. An account without a phone SHALL show no phone line and no empty space in its place. Menu rows SHALL be at least 48px tall and menu text at least 12px.

#### Scenario: User without photo
- **WHEN** the user named "Brian" has no photo
- **THEN** the avatar shows "B"

#### Scenario: Account details
- **WHEN** the account menu opens
- **THEN** it shows the user's name and phone number, and no e-mail address or plan badge

#### Scenario: Account without phone
- **WHEN** the account menu opens for an account with no phone
- **THEN** it shows the user's name, no phone line, and no e-mail address or plan badge

#### Scenario: Avatar in the sidebar on a laptop
- **WHEN** `/demo` is rendered at a 1280px-wide viewport
- **THEN** exactly one avatar is in the accessibility tree, inside the sidebar's account card, and activating the card opens the menu with the same rows as on a phone, entirely within the viewport
