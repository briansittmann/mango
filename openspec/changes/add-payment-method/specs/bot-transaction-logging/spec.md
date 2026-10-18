## ADDED Requirements

### Requirement: A load carries its payment method

An expense or income written by a `cargar` action SHALL carry the method the message said (`bot-message-parsing`); when it said none, the account's default; when the default is "Ninguno", none. A savings load SHALL carry none. The bot SHALL NEVER ask for the payment method. When an expense completes a pending recurring charge (*An expense that names a recurring expense completes its pending charge*), the charge SHALL keep its definition's method unless the message said one, which SHALL then be written on that cycle's charge only, never on the definition. A correction (`bot-conversation` → *Correcting the last load*) SHALL NOT change the method.

The confirmation SHALL name the method only when the message said it, after the amount and category: "Anotado ✅ Cervezas · 15 € en Ocio, en efectivo." / "…, con tarjeta." A method taken from the default SHALL NOT be named. The rest of the confirmation, the budget line and the icon SHALL be as without a method.

#### Scenario: Said in the message
- **WHEN** an account with default "Ninguno" sends "pagué 15 en efectivo de cervezas", and Ocio has no budget
- **THEN** one expense row of 15 in Ocio is stored with the method `efectivo`, and the reply is "Anotado ✅ Cervezas · 15 € en Ocio, en efectivo."

#### Scenario: Taken from the default, not named
- **WHEN** an account with default "Tarjeta" sends "nafta 45"
- **THEN** the row carries `tarjeta` and the reply is "Anotado ✅ Nafta · 45 € en Transporte." with no method named

#### Scenario: No default, no method
- **WHEN** an account with default "Ninguno" sends "nafta 45"
- **THEN** the row carries no method, and no question is asked

#### Scenario: A fixed charge keeps its definition's method
- **WHEN** the "Gimnasio" definition carries `tarjeta`, the default is "Efectivo", and the account sends "gimnasio 40"
- **THEN** this cycle's "Gimnasio" charge is completed carrying `tarjeta`, and the definition is unchanged

### Requirement: A transfer from the chat

A `cargar` action with `tipo` `transferencia` SHALL write exactly one transfer row (`payment-method` → *Transfers move money between the pockets*) for the account: the amount, into the pocket the action names and out of the other, on the local day `dias_atras` before today, with the channel and its message id, confirmed. It SHALL become the channel's last load: Undo, "borrá eso" and an amount correction SHALL act on it as on any load; a category correction SHALL get the answer that only expenses have a category. The confirmation SHALL read "Anotado 🔁 Tarjeta a efectivo · 200 €." (or "Efectivo a tarjeta"), with the day when it is not today, and no budget line. A transfer SHALL move no figure of the month query or the free-margin query.

#### Scenario: ATM withdrawal
- **WHEN** the account sends "saqué 200"
- **THEN** one transfer of 200 from card to cash is stored, the reply is "Anotado 🔁 Tarjeta a efectivo · 200 €.", and "libre" answers the same free margin as before

#### Scenario: Undo a transfer
- **WHEN** the account presses Undo on that confirmation
- **THEN** the transfer is soft-deleted and the reply names it as undone

### Requirement: An ambiguous deposit asks with two buttons

A `repreguntar` action with `falta` `deposito` SHALL, for an account using the feature (`payment-method` → *Who uses the feature*), write nothing, hold a deposit question on the channel for 30 minutes and reply "🤔 ¿Esos 200 € los pasaste desde el efectivo o es un ingreso nuevo?" with two reply buttons, "Lo pasé desde efectivo" and "Es un ingreso nuevo". Pressing the first, or answering in words that it came from cash, SHALL write a transfer from cash to card of the pending amount; pressing the second, or answering that it is new money, SHALL write an income of the pending amount, with its description, carrying `tarjeta`. Either answer SHALL be confirmed in text, never with a reaction, and SHALL clear the question. A new, unrelated message SHALL be handled on its own and SHALL clear the question as any answer does.

For an account not using the feature the action SHALL ask nothing: it SHALL write an income of that amount, with the account's default method (none), confirmed as any income load.

#### Scenario: A user of the feature is asked
- **WHEN** an account holding cash rows sends "ingresé 200 en el banco"
- **THEN** nothing is written, the reply asks income or cash with the two buttons, and the channel holds the question

#### Scenario: Pressing "Lo pasé desde efectivo"
- **WHEN** the account then presses "Lo pasé desde efectivo"
- **THEN** one transfer of 200 from cash to card is stored, the free margin is unchanged, and the confirmation is in text

#### Scenario: Pressing "Es un ingreso nuevo"
- **WHEN** the account instead presses "Es un ingreso nuevo"
- **THEN** one income of 200 carrying `tarjeta` is stored, and the free margin is 200 higher

#### Scenario: Someone who does not use the feature
- **WHEN** an account with no marked movement and the default "Ninguno" sends "ingresé 200 en el banco"
- **THEN** no question is asked and one income of 200 with no method is stored

### Requirement: Only for accounts offered the feature

For an account not offered the payment-method feature (`payment-method` → *The feature is offered by country*), the bot SHALL load every expense and income with no method, whatever the message says and whatever the stored default, SHALL NOT load a transfer (a message the model reads as one is answered as not understood, with nothing written), and SHALL NOT ask the deposit question: money put in the bank is a plain income, as before this change.

#### Scenario: Cash in Spain
- **WHEN** an account in Spain with the switch unset sends "pagué 15 en efectivo de cervezas"
- **THEN** the expense is stored with no method and the confirmation does not name one

#### Scenario: No transfer in Spain
- **WHEN** that account sends "ingresé 200 en el banco"
- **THEN** no question is asked and a plain income of 200 is loaded
