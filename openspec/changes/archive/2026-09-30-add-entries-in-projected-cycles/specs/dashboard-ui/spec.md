> Written over the `dashboard-ui` delta of the open change `add-cycle-projection-and-recurring-cron`, not yet synced to `openspec/specs/`. The requirement below replaces the one of the same name there.

## MODIFIED Requirements

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

**In a projected cycle** a budgeted card SHALL show only its budget amount in its header and an empty bar exposed to assistive technology as 0 out of 100, with no spent figure, no text under the bar and no warning or alert icon, whatever its projected recurring charges add up to, while the category holds no real row in that cycle. Once the category holds a real row in that cycle, the card SHALL show spent of budget, the bar, its assistive-technology value and the text under the bar exactly as in the cycle in progress, with spent being the real rows plus the projected charges and today being the cycle's first day.

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

#### Scenario: A budgeted card in a projection with a real row
- **WHEN** on `/demo` in Spanish the visitor adds 60 € described as "Taxi" to "transporte" (budget 100, projected "Parking" 50 €) in the October 2026 projection
- **THEN** the card header shows 110 € of 100 €, the bar is full in the danger colour and exposed as 100 out of 100 (capped, as in the cycle in progress), and the text states "10 € por encima del presupuesto"
- **AND** the free margin shows 465 €, 10 € below the untouched projection's 475 €

#### Scenario: A projection bar within budget
- **WHEN** on `/demo` in Spanish the visitor adds 120 € described as "Cumpleaños" to "comida" (budget 400, no projected charge) in the October 2026 projection
- **THEN** the card header shows 120 € of 400 €, the bar is exposed as 30 out of 100 in the brand colour, and the text states the amount left per week over the whole cycle
- **AND** the free margin still shows 475 €
