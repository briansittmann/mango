## MODIFIED Requirements

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

## ADDED Requirements

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
