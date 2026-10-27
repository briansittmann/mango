## ADDED Requirements

### Requirement: A message with several movements loads them all

A `cargar_varios` SHALL write its items in the order of the message, each one exactly as a single `cargar` of that item would be written: the same type, amount, currency, description, day, payment method, category resolved by name with Otros as the fallback, and the same completion of a pending or deleted-for-this-cycle recurring charge, with the channel and the message. A batch SHALL never ask a question; where a single load would ask, it SHALL decide instead:

- an expense item with neither a description nor a category SHALL go to Otros, and SHALL be skipped when the account has no Otros;
- an item naming a recurring expense whose charge is already confirmed this cycle SHALL be skipped;
- an item that is an ambiguous deposit into the bank SHALL be loaded as an income;
- a transfer for an account that is not offered payment methods SHALL be skipped.

At most 10 rows SHALL be written for one message; items after the tenth written row SHALL NOT be written. Each row SHALL count against the daily limit, and the first item the limit refuses SHALL end the batch. When a write fails, the batch SHALL end there and the rows already written SHALL stay.

The reply SHALL be one text, in the account's language: "Anotado", the ✅ icon and the number of rows written, then one line per row with its icon, name, amount, the category when it differs from the name and the day when it is not today, with no budget line, and, when something was not written, one line naming each skipped item with its reason and how many items were left out by the limit of 10, by the daily limit or by a failed write. The rows written by one message SHALL be one load for the conversation (`bot-conversation`). When no row was written, the reply SHALL be a text saying nothing was loaded and why, and the channel's last load SHALL NOT change.

#### Scenario: Three expenses
- **WHEN** an account in EUR with no budgets sends "café 3, súper 25 y nafta 40 ayer"
- **THEN** three expense rows exist (3, 25 in Comida, 40 in Transporte dated yesterday), all with the message's channel, and the reply is "Anotado ✅ 3 movimientos:" followed by one line for each

#### Scenario: A list with an income
- **WHEN** the account sends "propina 500 y nafta 40"
- **THEN** an income of 500 and an expense of 40 exist, and the income's line starts with 💰

#### Scenario: A charged fixed expense in a list
- **WHEN** October's Spotify charge is confirmed and the account sends "spotify 7 y café 3"
- **THEN** only the 3 expense is written, no question is asked, and the reply says Spotify was not loaded because it was already charged

#### Scenario: A pending fixed expense in a list
- **WHEN** October's Netflix charge is pending at 15 and the account sends "netflix 15 y súper 30"
- **THEN** the Netflix charge is confirmed at 15, a 30 expense is written in Comida, and both appear in the reply

#### Scenario: An item with no description
- **WHEN** the account sends "súper 25 y 10"
- **THEN** a 25 expense in Comida and a 10 expense in Otros are written, and nothing is asked

#### Scenario: More than ten
- **WHEN** the account sends a list of 12 expenses
- **THEN** the first 10 are written and the reply says 2 were left out and can be sent in another message

#### Scenario: The daily limit in the middle
- **WHEN** the account has 98 movements today and sends a list of 4 expenses
- **THEN** the first 2 are written and the reply says the other 2 were not loaded because the day's limit was reached

#### Scenario: Nothing written
- **WHEN** the only items of a list are fixed expenses already charged this cycle
- **THEN** nothing is written, the reply says why, and the channel's last load is unchanged

## MODIFIED Requirements

### Requirement: Loads count against the daily limit
Every load SHALL count against the account's daily limit of new movements, shared with the assistants' `add_movement` (100 per local day, 500 in the account's first 7 days). Every row of a message with several movements SHALL count as one load. A load over the limit SHALL write nothing and SHALL be answered in the account's language that the day's limit was reached and that loading can continue tomorrow or on the web; in a message with several movements, the rows before the limit SHALL stay written and the reply SHALL say how many were not loaded.

#### Scenario: Over the limit
- **WHEN** an account that already added 100 movements today sends "súper 30"
- **THEN** nothing is written and the reply says the day's limit was reached

#### Scenario: A list counts per row
- **WHEN** an account with 90 movements today sends a list of 3 expenses
- **THEN** three rows are written and the account has 93 movements counted today
