## MODIFIED Requirements

### Requirement: Spend calendar widget
The dashboard SHALL show a "Gasto por día" widget for a cycle that is not a projection: one cell per local day of the cycle, laid out in rows of seven starting at the cycle's first day, so each row is one week of the cycle. The cell's fill SHALL encode the day's spent total on a single-hue sequential ramp: the surface tone for a day with nothing spent, then four steps from light to dark of the brand hue by quantile of the cycle's non-zero days. Today SHALL be outlined; days after today SHALL be drawn as empty cells with a muted number. Each cell SHALL show its day-of-month number in a text token. Cells SHALL be separated by a 2px surface gap.

A scale legend SHALL show the ramp from "menos" to "más". Hovering or focusing a cell SHALL show a tooltip with the full date, the day's total and its row count; a day with nothing spent SHALL say so. Activating a cell up to today (click, tap or Enter/Space) SHALL open that day's detail (*Day detail*); on touch, a tap SHALL open the detail instead of showing the tooltip. Cells after today SHALL have no action. Every day's date and total SHALL be available as text to assistive technology. Cells SHALL be at least 36px wide at a 390px-wide viewport, and the widget SHALL NOT scroll horizontally.

#### Scenario: The demo's calendar
- **WHEN** `/demo` is rendered in Spanish
- **THEN** 30 cells are drawn in rows of seven with the last row holding two, the cell for 1 September is the darkest (820 € spent), 11 September has the surface tone, and the cell for the cycle's today is outlined

#### Scenario: Future days are empty
- **WHEN** a cycle in progress runs from 1 to 30 September and today is the 22nd, with a pending charge dated the 22nd
- **THEN** cells for 23–30 September have no fill step, a muted number and no action, and the pending charge adds nothing to the 22nd

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

## ADDED Requirements

### Requirement: Day detail
The day detail SHALL be a sheet (the right side panel at `lg`) titled "Gasto del día". Its top SHALL hold a day selector laid out like the compact month selector: a previous-day arrow, the day's name (weekday, day and month) as a button, and a next-day arrow. The arrows SHALL reach only the displayed cycle's days, from its first day to today (its last day for a past cycle), and SHALL be disabled at either end. Activating the day's name SHALL unfold, under the selector, a grid of the cycle's days in rows of seven on the calendar's heat ramp, with today outlined, the shown day marked and days after today disabled; choosing a day SHALL show it and fold the grid, and Escape SHALL fold the grid without closing the sheet.

Below, the sheet SHALL list the day's spent rows — the rows the calendar cell counts — grouped by category: categories by subtotal, highest first, each with its colour, name and subtotal, and its rows by amount, highest first. The sheet SHALL end with the day's total, equal to the cell's, announced politely when the day changes. A day with nothing spent SHALL say "Sin gastos". Activating a row SHALL close the detail and open the expense sheet for that row.

#### Scenario: Opening a day
- **WHEN** the 3 September cell is activated on `/demo` in Spanish
- **THEN** the detail shows "Jueves, 3 sept", the rows Internet, Supermercado and Café grouped under their categories, and a total of 287,40 €

#### Scenario: Walking through days
- **WHEN** the next-day arrow is activated on 3 September
- **THEN** the detail shows 4 September with its rows and total
- **AND** on 1 September the previous-day arrow is disabled, and on the cycle's today the next-day arrow is disabled

#### Scenario: Jumping with the calendar
- **WHEN** the day's name is activated and the 1 September cell of the grid is chosen
- **THEN** the grid folds and the detail shows 1 September with a total of 820 €

#### Scenario: An empty day
- **WHEN** the detail shows 11 September on `/demo`
- **THEN** it says "Sin gastos" and lists no rows

#### Scenario: Editing a row
- **WHEN** a row of the detail is activated
- **THEN** the detail closes and the expense sheet opens with that row's name and amount

#### Scenario: Desktop
- **WHEN** a cell is activated at a 1280px-wide viewport
- **THEN** the detail opens as the right side panel
