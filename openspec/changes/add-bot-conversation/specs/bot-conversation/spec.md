## Purpose

Defines what the bot does with a message that is not a new load: deleting, correcting or undoing the chat's last load, answering short questions about the month, and creating a category on explicit request.

## ADDED Requirements

### Requirement: The chat's last load is the only row the chat can change

Each channel SHALL remember the last movement loaded through it: the row written or completed by the channel's most recent successful load. Deleting that load SHALL make the channel remember none, and a new load SHALL replace it. Movements created or edited on the web SHALL NOT become a channel's last load. `borrar` and `corregir` SHALL act only on the channel's last load, never on an older row, whatever its age. When the channel remembers no last load, or its row was deleted elsewhere, they SHALL change nothing and reply that there is nothing to change and that older rows are edited on the web.

#### Scenario: Last load of this chat
- **WHEN** the account loads "café 3" and then "nafta 45" from WhatsApp, and then sends "borrá eso"
- **THEN** the 45 expense is deleted and the café is untouched

#### Scenario: Web rows are not the last load
- **WHEN** the account loads "nafta 45" from WhatsApp, then adds an expense of 20 on the web, and sends "borrá eso"
- **THEN** the 45 expense is deleted and the web expense is untouched

#### Scenario: Nothing to change
- **WHEN** the channel's last load was already deleted and the account sends "no, era 40"
- **THEN** nothing changes and the reply says there is nothing to correct and points to the web

### Requirement: Deleting the last load

`borrar` SHALL soft-delete the channel's last load: the row stops counting in every total and keeps its message id, so a retry of the original message does not load it again. When the last load completed a recurring charge, deleting it SHALL instead return that charge to pending, at the definition's expected amount and on its usual day in that cycle. The recurring charge SHALL NOT be deleted from the cycle. The reply SHALL say what was deleted: amount, category or type, and day.

#### Scenario: Delete an expense
- **WHEN** the channel's last load is an expense of 45 in Transporte today and the account sends "borrá eso"
- **THEN** that row is soft-deleted, the cycle's totals no longer include it and the reply names 45, Transporte and "hoy"

#### Scenario: Delete a completed recurring charge
- **WHEN** the channel's last load completed October's "Netflix" charge at 13, the definition expects 13 on day 5, and the account sends "borrá eso"
- **THEN** October's Netflix row is pending again at 13 dated on day 5 of the cycle, and no Netflix row is deleted

#### Scenario: Retry after delete
- **WHEN** "nafta 45" from `wamid.A` was loaded and deleted, and Meta delivers `wamid.A` again
- **THEN** it is discarded as a retry and nothing is loaded

### Requirement: Correcting the last load

`corregir` SHALL change the channel's last load in place. A `monto` SHALL replace its amount; a savings withdrawal SHALL stay a withdrawal. A `categoria` SHALL move an expense to that category, resolved by name like a load, with case and accents ignored. A category that matches none SHALL leave the category unchanged and the reply SHALL list the account's categories. A category correction on an income or a savings movement SHALL change nothing and the reply SHALL say that only expenses have a category. A corrected recurring charge SHALL change only that cycle's row, never its definition. The reply SHALL confirm the row as it now stands.

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

### Requirement: Undo removes the load it belongs to

A load confirmed with an Undo button SHALL be deleted when that button is pressed, exactly as `borrar` would delete it, including the recurring-charge case. The button SHALL delete the load whose confirmation it is attached to, even when newer loads exist. When that row belongs to another account, the press SHALL change nothing. When the row is already deleted, the press SHALL change nothing and the reply SHALL say it was already undone. When the undone row is the channel's last load, the channel SHALL remember none.

#### Scenario: Undo right away
- **WHEN** the account loads "nafta 45", receives the confirmation with Undo and presses it
- **THEN** the 45 expense is deleted and the reply says it was undone

#### Scenario: Undo an older confirmation
- **WHEN** the account loads "café 3", then "nafta 45", then presses Undo on the café confirmation
- **THEN** the café is deleted, the 45 stays, and "borrá eso" would still delete the 45

#### Scenario: Pressed twice
- **WHEN** the Undo button of a load is pressed again after it was undone
- **THEN** nothing changes and the reply says it was already undone

### Requirement: The month and free-margin queries

`consultar` SHALL write nothing and SHALL answer from the same monthly summary the dashboard shows, for the cycle in progress, with no model call. `mes` SHALL reply with the cycle's total spent and up to five categories with the most spent, largest first, each with its amount. `margen_libre` SHALL reply with the cycle's free margin, negative when it is. Both replies SHALL end with the link to the dashboard. Amounts SHALL be in the account's currency and language. A category with nothing spent SHALL NOT be listed.

#### Scenario: How's the month
- **WHEN** the cycle in progress has 1240 spent, with Vivienda 700, Comida 280, Transporte 120, Ocio 80, Salud 40 and Otros 20, and the account sends "¿cómo vengo?"
- **THEN** the reply states 1240, lists Vivienda, Comida, Transporte, Ocio and Salud with their amounts in that order, omits Otros, and ends with the dashboard link

#### Scenario: Free margin
- **WHEN** the dashboard shows a free margin of 864 € for the cycle in progress and the account sends "libre"
- **THEN** the reply states 864 € and ends with the dashboard link

#### Scenario: Nothing spent yet
- **WHEN** the cycle has nothing spent and the account sends "¿cómo vengo?"
- **THEN** the reply states a total of 0 and lists no category

### Requirement: A category is created by chat only on explicit request

`crear_categoria` SHALL create a category only when the message asks for it. A load that names an unknown category never creates one. The new category SHALL live from the cycle in progress onward and SHALL take the first palette color no category of the account uses, or the first color when all are used. It SHALL come after the account's existing categories. A `presupuesto` SHALL become its budget from the cycle in progress. The reply SHALL name the category and its budget when one was given.

#### Scenario: Create
- **WHEN** the account has no category like "Mascotas" and sends "creá la categoría Mascotas"
- **THEN** a category "Mascotas" exists from the cycle in progress with an unused color, and the reply names it

#### Scenario: Create with a budget
- **WHEN** the account sends "nueva categoría Viajes, presupuesto 200"
- **THEN** "Viajes" exists with a budget of 200 in the cycle in progress

#### Scenario: A load never creates one
- **WHEN** the account sends "veterinario 40" and has no Mascotas category
- **THEN** the expense goes to Otros and no category is created

### Requirement: A similar name asks before creating

When a live category already has the same name, ignoring case and accents, the bot SHALL create nothing and SHALL say that category already exists. When a live category has a similar name, the bot SHALL create nothing yet. A name is similar when one contains the other or they differ by at most two letters, ignoring case and accents. In that case the bot SHALL ask whether to create it anyway, naming the similar category, and the channel SHALL hold that question like a pending category question: 30 minutes, replaced by any newer question, and cleared by any other reply. An affirmative answer within that time SHALL create the category as asked. Any other message SHALL be handled on its own and SHALL create nothing.

#### Scenario: Exact name
- **WHEN** the account has "Mascotas" and sends "creá la categoría mascotas"
- **THEN** nothing is created and the reply says Mascotas already exists

#### Scenario: Similar name, confirmed
- **WHEN** the account has "Mascotas", sends "creá la categoría Mascota" and then "sí"
- **THEN** the first reply asks whether to create Mascota even though Mascotas exists, and after "sí" a category "Mascota" exists

#### Scenario: Similar name, not confirmed
- **WHEN** the account has "Mascotas", sends "creá la categoría Mascota" and then "nafta 45"
- **THEN** no category "Mascota" exists, the 45 is loaded and no question is pending

#### Scenario: Confirmation expired
- **WHEN** the account answers "sí" 2 hours after the question
- **THEN** no category is created and "sí" is handled as a message on its own
