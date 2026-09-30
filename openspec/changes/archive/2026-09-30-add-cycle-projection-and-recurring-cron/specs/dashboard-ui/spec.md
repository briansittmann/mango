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

### Requirement: Budget progress on budgeted categories
A card whose category has a budget SHALL show "spent of budget" in its header and a progress bar.

**Spent** SHALL be the category's total for the cycle, recurring charges included and pending ones at their expected amount, as `category-editing` → *A budget reserves its amount in the free margin* defines. The header, the bar, its assistive-technology value and the text under the bar SHALL all use that figure. The card's recurring charges SHALL stay listed among its rows.

**Bar:**
- Its colour SHALL depend on consumption (spent ÷ budget): the brand colour below 80 %, the warning colour from 80 % to 100 %, and the danger colour above 100 %.
- It SHALL expose its consumption to assistive technology as a value out of 100, with a text equivalent that states spent of budget.

**Text under the bar:**
- It SHALL show the amount left per week, calculated as (budget − spent) ÷ days left × 7 and rounded down to a whole amount. Days left SHALL count today.
- When fewer than 7 days remain, it SHALL show the total amount left for the remaining days instead.
- From 80 % to 100 %, the text SHALL be preceded by a warning icon and a "near limit" label.
- When spent exceeds the budget, the amount left SHALL be zero, the bar SHALL be full, and the text SHALL instead state the amount over budget (spent − budget), preceded by an alert icon with a different shape from the warning icon.

**In a projected cycle** a budgeted card SHALL show only its budget amount in its header and an empty bar exposed to assistive technology as 0 out of 100, with no spent figure, no text under the bar and no warning or alert icon, whatever its projected recurring charges add up to.

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

#### Scenario: A recurring charge counts in the bar
- **WHEN** the "transporte" card on `/demo` (budget 100, "Gasolina" 80 € and the recurring "Parking" 50 €) is rendered in Spanish
- **THEN** its header shows 130 € of 100 €, its bar is full in the danger colour, and the text states "30 € por encima del presupuesto"
- **AND** when expanded it lists both "Gasolina" and "Parking", and the expenses panel lists "transporte" with 130 €

#### Scenario: A budgeted card in a projection
- **WHEN** the "suplementos" card, budget 100 with projected recurring charges of 90 €, is rendered in a projected cycle in Spanish
- **THEN** its header shows 100 € and no "90 € de 100 €", its bar is empty and exposed as 0 out of 100, and no text is shown under it
