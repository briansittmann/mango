## ADDED Requirements

### Requirement: Payment methods and pockets in the data

For the shown cycle the dashboard SHALL also be supplied with:
- each expense row's and each income row's payment method, or none; a projected charge SHALL carry its definition's
- each recurring definition's payment method, or none
- the account's default payment method
- whether the account holds marked movements (`payment-method` → *Who uses the feature*), computed over every cycle
- while it does and the cycle is not a projection: for each pocket, its balance and what came in and went out in the cycle (`payment-method` → *A pocket's balance*), and the cycle's transfers with their amount, direction and instant

These SHALL be read as the signed-in user, from that user's rows only, like every other figure (*Reads and writes run as the signed-in user*). A balance SHALL include rows of every earlier cycle without the dashboard receiving those rows.

#### Scenario: Balance from earlier cycles
- **WHEN** the user received 300 in cash in August and spent 80 in cash in September, the cycle shown
- **THEN** the cash balance is 220, "came in" for September is 0 and "went out" is 80, and no August row is listed in any card

#### Scenario: Another user's rows
- **WHEN** user B holds cash rows and user A opens `/dashboard`
- **THEN** none of B's rows counts in A's balances or in whether A holds marked movements

### Requirement: Transfers count in no summary figure

A transfer SHALL be left out of the income total, the expenses total, the savings total and accumulated balance, the free margin, every category group, every budget computation, the history entries and the projection, in every cycle. It SHALL NOT be supplied as an expense, an income entry or a savings movement.

#### Scenario: Seeded cycle with a transfer
- **WHEN** the test user's cycle holds income 2 820, expenses 1 700 and savings 146, as in *Summary figures include savings*, plus a transfer of 200 from card to cash
- **THEN** the summary still shows income 2.820 €, expenses 1.700 €, savings 146 € and the free margin 864 €

### Requirement: Payment methods and transfers persist

Each operation SHALL be durable and, after it completes, the dashboard SHALL show figures recomputed from the stored rows:
- creating or updating an expense or an income entry SHALL store the method it is given, none included; updating SHALL change the method only of that row
- creating a recurring definition SHALL store the method on the definition and on the confirmed row the same save created
- a slot edit "only this month" SHALL write the method on that cycle's row only; "from this month on" SHALL also write it on the definition and on every pending slot it rewrites (`recurring-expenses` → *A definition's slot in a cycle can be changed on its own*)
- creating a transfer SHALL insert one confirmed transfer row in the user's default currency, whose local date is the chosen day, with no category, description, definition or cycle mark; updating SHALL change only its amount, direction and date; soft-delete and restore SHALL set and clear its deletion mark
- setting the default SHALL write only the account's default

The database SHALL reject a method other than `efectivo`, `tarjeta` or none; a method on a savings row; a transfer with no direction, with a category, with a definition or with an amount not greater than 0; and a method on a savings definition. Any failure SHALL leave the stored rows as they were and reject the operation.

#### Scenario: A cash expense survives a reload
- **WHEN** the user adds 15 described as "Cervezas" to "Ocio" with "Efectivo" and reloads `/dashboard`
- **THEN** "Cervezas" shows the cash icon, and the cash balance is 15 lower

#### Scenario: A transfer survives a reload
- **WHEN** the user moves 200 from card to cash and reloads
- **THEN** the cash balance is 200 higher, the card balance 200 lower, and every summary figure is unchanged

#### Scenario: The database refuses a method on savings
- **WHEN** any caller writes a savings row with the method `efectivo`
- **THEN** the database rejects it and nothing is stored
