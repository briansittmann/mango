## Purpose

Two read-only widgets that answer "where did the money go this week?" and "which days did I spend on?" from the rows the dashboard already receives for the shown cycle: a ranked bar chart of the week's categories, navigable week by week inside the cycle, and a calendar heatmap of the cycle's days.

## ADDED Requirements

### Requirement: Weeks of a cycle
A cycle SHALL be cut into consecutive weeks of seven local days starting on the cycle's first day; the last week SHALL hold whatever days remain (one to seven). Weeks SHALL be numbered from 1. The **current week** SHALL be the week that contains the cycle's "today" (its last day for a past cycle). A week SHALL be named by its day range in the active language, for example "1–7 sep" or "29 sep – 5 oct", and the first week of a cycle SHALL NOT be named differently from the others.

A row SHALL belong to the week and the day that contain its local date in the user's timezone. Only **spent** rows SHALL count: an expense row that is not a projected charge and is not a pending recurring charge. A pending recurring charge SHALL count in no week and on no day until it is taken.

#### Scenario: A 30-day cycle has five weeks
- **WHEN** the cycle runs from 1 to 30 September and today is 22 September
- **THEN** the weeks are 1–7, 8–14, 15–21, 22–28 and 29–30 September, and week 4 is the current week

#### Scenario: A cycle starting on the 28th
- **WHEN** the cycle runs from 28 September to 27 October
- **THEN** week 1 is 28 September – 4 October, named with both months, and the last week is 26–27 October

#### Scenario: A pending charge does not count
- **WHEN** the "Parking" charge dated 15 September is still pending and the "Gasolina" row dated 4 September is confirmed
- **THEN** week 3 holds no "transporte" amount and week 1 holds 80 € of "transporte"

#### Scenario: A row at the boundary
- **WHEN** the user's timezone is Europe/Madrid and a row is dated 23:30 UTC on 7 September
- **THEN** it counts on 8 September local, in week 2

### Requirement: Weekly top categories widget
The dashboard SHALL show a "Top gastos de la semana" widget for a cycle that is not a projection. It SHALL rank the categories by their spent amount in the selected week, highest first, and draw one horizontal bar per category. At most five categories SHALL get a bar; any remaining categories with spending SHALL be folded into one last bar named "Otras" that states how many it holds. A category with nothing spent in the week SHALL NOT get a bar. The longest bar SHALL span the full plot width and the others SHALL be proportional to it.

Each bar SHALL show, in text tokens never in the category colour: the category's colour dot and name before the bar, and its amount at the bar's tip. The bar's fill SHALL be the category's colour; the "Otras" bar SHALL use the de-emphasis tone. Bars SHALL be at most 24px thick, rounded at the tip and square at the baseline.

The widget header SHALL show the title, the selected week's name, and the week's total. It SHALL carry previous-week and next-week controls: the previous control SHALL be disabled on week 1, and the next control SHALL be disabled on the current week, so no week after today can be selected. The widget SHALL open on the current week whenever the dashboard mounts or the shown cycle changes.

When the selected week holds no spent row, the plot SHALL be replaced by a short empty-state text, and the header SHALL still name the week and show 0 as the total.

Every bar SHALL be a control named after its category and amount. Activating it SHALL scroll the page to that category's card, leaving the card visible below the top bar; the "Otras" bar SHALL NOT be a control. Hovering or focusing a bar SHALL show a tooltip with the category, the amount, its share of the week as a whole-number percentage and the number of rows; the tooltip SHALL never be the only place a value can be read. Every bar's category and amount SHALL be available as text to assistive technology, and the week's name and total SHALL be announced when the selected week changes.

#### Scenario: Current week on the demo
- **WHEN** `/demo` is rendered in Spanish with today inside its cycle
- **THEN** the widget names the week that contains today, and lists only categories with a spent row in that week, highest amount first, each bar tip showing its amount

#### Scenario: Walking back through the cycle
- **WHEN** the visitor activates the previous-week control until week 1 of the demo cycle
- **THEN** the header reads "1–7 sep", the bars read vivienda 865 € first and comida 310 € second among the others in descending order, and the previous control is disabled
- **AND** the next control is enabled and the first activation moves to "8–14 sep"

#### Scenario: Nothing after today
- **WHEN** the current week is selected
- **THEN** the next-week control is disabled, and the week after today cannot be reached with the keyboard either

#### Scenario: Fold into Otras
- **WHEN** seven categories hold spending in the selected week
- **THEN** five bars carry category names and a sixth, last bar reads "Otras (2)" with the sum of the two smallest categories, in the de-emphasis tone, and it is not a control

#### Scenario: Empty week
- **WHEN** the selected week holds no spent row
- **THEN** no bar is drawn, an empty-state text is shown in its place, the header shows the week's name and 0 €, and the controls still work

#### Scenario: A bar leads to the card
- **WHEN** the visitor activates the "comida" bar
- **THEN** the page scrolls so the "Comida" card's top edge is below the bottom edge of the top bar

#### Scenario: Hover shows the share
- **WHEN** the pointer rests on the "comida" bar in a week whose total is 400 € and "comida" holds 100 € over 3 rows
- **THEN** a tooltip shows "Comida", "100 €", "25 %" and the row count, and leaves when the pointer leaves
- **AND** the same tooltip is shown while the bar has keyboard focus

#### Scenario: Hidden in a projection
- **WHEN** a projected cycle is shown
- **THEN** the widget is not rendered

#### Scenario: Text to assistive technology
- **WHEN** assistive technology reads the widget
- **THEN** it reaches the title, the week's name and total, and each bar's category and amount

### Requirement: Spend calendar widget
The dashboard SHALL show a "Gasto por día" widget for a cycle that is not a projection: one cell per local day of the cycle, laid out in rows of seven starting at the cycle's first day, so each row is one week of the cycle. The cell's fill SHALL encode the day's spent total on a single-hue sequential ramp: the surface tone for a day with nothing spent, then four steps from light to dark of the brand hue by quantile of the cycle's non-zero days. Today SHALL be outlined; days after today SHALL be drawn as empty cells with a muted number. Each cell SHALL show its day-of-month number in a text token. Cells SHALL be separated by a 2px surface gap.

A scale legend SHALL show the ramp from "menos" to "más". Hovering or focusing a cell SHALL show a tooltip with the full date, the day's total and its row count; a day with nothing spent SHALL say so. Every day's date and total SHALL be available as text to assistive technology. Cells SHALL be at least 36px wide at a 390px-wide viewport, and the widget SHALL NOT scroll horizontally.

#### Scenario: The demo's calendar
- **WHEN** `/demo` is rendered in Spanish
- **THEN** 30 cells are drawn in rows of seven with the last row holding two, the cell for 1 September is the darkest (820 € spent), 11 September has the surface tone, and the cell for the cycle's today is outlined

#### Scenario: Future days are empty
- **WHEN** a cycle in progress runs from 1 to 30 September and today is the 22nd, with a pending charge dated the 22nd
- **THEN** cells for 23–30 September have no fill step and a muted number, and the pending charge adds nothing to the 22nd

#### Scenario: A day's tooltip
- **WHEN** the pointer rests on the 3 September cell on `/demo` in Spanish
- **THEN** a tooltip shows the full date, 287,40 € and three rows (Internet, Supermercado and the Café dated 23:30 UTC on the 2nd, which is the 3rd in the demo's Europe/Dublin timezone)
- **AND** resting on the 11 September cell shows the date and "Sin gastos"

#### Scenario: Legend and ramp
- **WHEN** the widget is rendered in either theme
- **THEN** the legend shows five swatches from the surface tone to the darkest step, the darkest step reaches at least 3:1 against the card, and no step uses the warning or danger colour

#### Scenario: Fits a phone
- **WHEN** the widget is rendered at a 390px-wide viewport
- **THEN** every cell is at least 36px wide, all seven columns are visible and the widget has no horizontal scroll

#### Scenario: Hidden in a projection
- **WHEN** a projected cycle is shown
- **THEN** the widget is not rendered

### Requirement: Widgets recompute from the shown rows
Both widgets SHALL be derived from the expense rows the dashboard receives for the shown cycle and nothing else. After an expense is created, edited, deleted or restored, or a category is renamed, recoloured or deleted, both widgets SHALL reflect the resulting rows in the same render as the cards. Neither widget SHALL request data of its own.

#### Scenario: A new expense moves the week
- **WHEN** on `/demo` the visitor adds 20 € described as "Panadería" to "comida" dated today
- **THEN** the current week's "comida" bar grows by 20 €, the week's total grows by 20 €, and today's calendar cell darkens or keeps its step according to the new quantiles

#### Scenario: A deleted expense and its undo
- **WHEN** the visitor deletes "Café" (62,40 €, 2 September) and then activates "Deshacer"
- **THEN** week 1's "comida" bar and the 2 September cell drop by 62,40 € after the delete and return after the undo

#### Scenario: Category colour follows
- **WHEN** the visitor changes "comida" to `celeste`
- **THEN** the "comida" bar's fill and its dot take the new colour in the same render
