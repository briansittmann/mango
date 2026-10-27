## MODIFIED Requirements

### Requirement: The chat's last load is the only row the chat can change

Each channel SHALL remember the last load made through it: the rows written or completed by the channel's most recent successful load, which are one row for a single movement and every row one message wrote for several. Deleting that whole load SHALL make the channel remember none, and a new load SHALL replace it. Movements created or edited on the web SHALL NOT become part of a channel's last load. `borrar` and `corregir` SHALL act only on the rows of the channel's last load, never on an older row, whatever its age. When the channel remembers no last load, or all its rows were deleted elsewhere, they SHALL change nothing and reply that there is nothing to change and that older rows are edited on the web.

#### Scenario: Last load of this chat
- **WHEN** the account loads "café 3" and then "nafta 45" from WhatsApp, and then sends "borrá eso"
- **THEN** the 45 expense is deleted and the café is untouched

#### Scenario: Web rows are not the last load
- **WHEN** the account loads "nafta 45" from WhatsApp, then adds an expense of 20 on the web, and sends "borrá eso"
- **THEN** the 45 expense is deleted and the web expense is untouched

#### Scenario: Nothing to change
- **WHEN** the channel's last load was already deleted and the account sends "no, era 40"
- **THEN** nothing changes and the reply says there is nothing to correct and points to the web

#### Scenario: A list is one load
- **WHEN** the account loads "café 3, súper 25 y nafta 40" and then "propina 500"
- **THEN** the channel's last load is the 500 income alone, and the three expenses can no longer be changed from the chat

### Requirement: Deleting the last load

`borrar` SHALL soft-delete the rows of the channel's last load: each row stops counting in every total and keeps its message id, so a retry of the original message does not load it again. When `borrar` names a movement and the last load has several rows, it SHALL delete only the one row whose description, or else whose category, matches that name, ignoring case and accents; when no row or more than one row matches, it SHALL change nothing and the reply SHALL list the load's rows and ask which one. Deleting some rows of a load SHALL keep the remaining rows as the channel's last load. When a deleted row had completed a recurring charge, deleting it SHALL instead return that charge to pending, at the definition's expected amount and on its usual day in that cycle. The recurring charge SHALL NOT be deleted from the cycle. The reply SHALL say what was deleted: amount, category or type, and day, or, for several rows, how many and their total.

#### Scenario: Delete an expense
- **WHEN** the channel's last load is an expense of 45 in Transporte today and the account sends "borrá eso"
- **THEN** that row is soft-deleted, the cycle's totals no longer include it and the reply names 45, Transporte and "hoy"

#### Scenario: Delete a completed recurring charge
- **WHEN** the channel's last load completed October's "Netflix" charge at 13, the definition expects 13 on day 5, and the account sends "borrá eso"
- **THEN** October's Netflix row is pending again at 13 dated on day 5 of the cycle, and no Netflix row is deleted

#### Scenario: Retry after delete
- **WHEN** "nafta 45" from `wamid.A` was loaded and deleted, and Meta delivers `wamid.A` again
- **THEN** it is discarded as a retry and nothing is loaded

#### Scenario: Delete a whole list
- **WHEN** the channel's last load is "café 3, súper 25 y nafta 40" and the account sends "borrá eso"
- **THEN** the three rows are soft-deleted and the reply says 3 movements were deleted

#### Scenario: Delete one row of a list
- **WHEN** the channel's last load is "súper 25, nafta 40 y cine 12" and the account sends "borrá el cine"
- **THEN** only the 12 expense is deleted, and "no, era 30" would now ask between súper and nafta

### Requirement: Correcting the last load

`corregir` SHALL change one row of the channel's last load in place. When the last load has one row, that row SHALL be changed. When it has several, the row SHALL be the one whose description, or else whose category, matches the movement the message names, ignoring case and accents; when the message names none, or no row or more than one row matches, nothing SHALL change and the reply SHALL list the load's rows with their amounts and ask which one, with an example, without holding a question on the channel. A `monto` SHALL replace its amount; a savings withdrawal SHALL stay a withdrawal. A `categoria` SHALL move an expense to that category, resolved by name like a load, with case and accents ignored. A category that matches none SHALL leave the category unchanged and the reply SHALL list the account's categories. A category correction on an income or a savings movement SHALL change nothing and the reply SHALL say that only expenses have a category. A corrected recurring charge SHALL change only that cycle's row, never its definition. The reply SHALL confirm the row as it now stands.

#### Scenario: Amount
- **WHEN** the last load is an expense of 50 in Comida and the account sends "no, era 40"
- **THEN** the row's amount is 40, still in Comida, and the reply names 40 and Comida

#### Scenario: Category
- **WHEN** the last load is an expense of 50 in Otros and the account sends "osea lo que gaste esos 50 eran comida"
- **THEN** the row is in Comida with amount 50

#### Scenario: Withdrawal keeps its sign
- **WHEN** the last load is a savings withdrawal of 100 and the account sends "no, eran 80"
- **THEN** the row is a withdrawal of 80

#### Scenario: Category on an income
- **WHEN** the last load is an income and the account sends "era comida"
- **THEN** nothing changes and the reply says only expenses have a category

#### Scenario: Recurring charge
- **WHEN** the last load completed "Luz" at 72, the definition expects 60, and the account sends "no, era 70"
- **THEN** this cycle's Luz row is 70 and the definition still expects 60

#### Scenario: A list, naming the row
- **WHEN** the last load is "súper 25, nafta 40 y cine 12" and the account sends "la nafta era 45"
- **THEN** the nafta row is 45 and the other two are unchanged

#### Scenario: A list, without naming the row
- **WHEN** the same load is the last one and the account sends "no, era 45"
- **THEN** nothing changes and the reply lists Súper 25, Nafta 40 and Cine 12 and asks which one, with an example

### Requirement: Undo removes the load it belongs to

A load confirmed with an Undo button SHALL be deleted when that button is pressed, exactly as `borrar` without a name would delete it: every row of that load still standing, including the recurring-charge case. The button SHALL delete the load whose confirmation it is attached to, even when newer loads exist. When those rows belong to another account, the press SHALL change nothing. When every row of the load is already deleted, the press SHALL change nothing and the reply SHALL say it was already undone. When the undone load is the channel's last load, the channel SHALL remember none.

#### Scenario: Undo right away
- **WHEN** the account loads "nafta 45", receives the confirmation with Undo and presses it
- **THEN** the 45 expense is deleted and the reply says it was undone

#### Scenario: Undo an older confirmation
- **WHEN** the account loads "café 3", then "nafta 45", then presses Undo on the café confirmation
- **THEN** the café is deleted, the 45 stays, and "borrá eso" would still delete the 45

#### Scenario: Pressed twice
- **WHEN** the Undo button of a load is pressed again after it was undone
- **THEN** nothing changes and the reply says it was already undone

#### Scenario: Undo a list
- **WHEN** the account loads "café 3, súper 25 y nafta 40", deletes the café with "borrá el café", and presses Undo on the list's confirmation
- **THEN** the súper and nafta rows are deleted and the reply says 2 movements were undone
