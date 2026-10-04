## MODIFIED Requirements

### Requirement: Summary figures include savings
For the shown cycle the dashboard SHALL be supplied with:
- the income total: the sum of income rows in the cycle
- the expenses total: the sum of expense rows in the cycle
- the savings total: the signed sum of savings rows in the cycle, withdrawals negative
- the accumulated balance: the signed sum of every savings row up to the end of the shown cycle, across all cycles
- the free margin, as `category-editing` → *A budget reserves its amount in the free margin* defines it, from the shown cycle's rows and budget rows
- the savings target: the user's monthly savings goal, absent when the user has none
- six history entries ending with the shown cycle: each cycle's expenses total, each cycle's income total, and the accumulated balance at each cycle's end, whose last point equals the accumulated balance above. The last expenses entry SHALL equal the expenses total and the last income entry SHALL equal the income total of the shown cycle. For a projected cycle the six entries SHALL end at the cycle in progress.

#### Scenario: Seeded cycle
- **WHEN** the test user's cycle holds income 2 820, expenses 1 700 of which 1 025 are recurring charges, savings movements of +176, −80 and +50, and budgets of 400 on comida (310 spent), 150 on ocio (130 spent) and 100 on transporte (130 spent, 50 € of it a recurring charge)
- **THEN** the summary shows income 2.820 €, expenses 1.700 €, savings 146 € and the free margin 864 €

#### Scenario: Accumulated across cycles
- **WHEN** the user saved 2 500 net before the shown cycle and 146 net inside it
- **THEN** the accumulated balance reads 2.646 € and the last point of the savings history equals it

#### Scenario: Income history agrees with the total
- **WHEN** the shown cycle holds income rows summing 2 820 and the previous cycle's income rows sum 2 400
- **THEN** the income history has six entries, its last reads 2 820 and the one before it 2 400

#### Scenario: A withdrawal moves only savings and the margin
- **WHEN** the user adds a withdrawal of 30
- **THEN** after the page refreshes the savings total is 30 lower, the accumulated balance 30 lower, the free margin 30 higher, and the income and expenses totals are unchanged
