## MODIFIED Requirements

### Requirement: Expense cards group each expense exactly once
The dashboard SHALL show one card per spending category, each containing every expense of that category in the cycle, recurring and one-off alike. Every expense SHALL appear in exactly one category card. Category names SHALL be shown as the user entered them.

There SHALL be no card that groups expenses by whether they recur. A recurring charge SHALL NOT be listed, totalled or summarised as an expense anywhere outside its category's card; the `upcoming-charges` capability describes the one place the cycle's charges are listed again, as a read-only calendar that states no expense total.

The "Movimientos" card (`transaction-list`) is the one place that lists user-entered expenses again: by day, mixed with income and savings movements, and with no total of any kind. It is not a card of variable expenses and SHALL NOT be counted as one of the expense cards.

#### Scenario: Fixed expense in a category
- **WHEN** the cycle has a fixed "alquiler" expense in category "vivienda" and a variable "Tesco" expense in category "comida"
- **THEN** "alquiler" is listed as an expense only in the "vivienda" card and "Tesco" only in the "comida" card
- **AND** no card named after fixed expenses is rendered

#### Scenario: No variable pseudo-category
- **WHEN** the dashboard is rendered
- **THEN** there is no card grouping all variable expenses together, and none grouping all recurring ones
- **AND** the "Movimientos" card states no expense total and lists no recurring charge

#### Scenario: Counted once
- **WHEN** `/demo` is rendered in Spanish
- **THEN** the expenses total 1.700 € equals the sum of the seven category cards
- **AND** the 1.025 € committed in "Próximos cobros" is not added to it
- **AND** no amount shown by the "Movimientos" card is added to it
