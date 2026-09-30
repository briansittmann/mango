## Purpose

Decides how the WhatsApp adapter confirms a successful load, text with an Undo button or an emoji reaction, so that confirmations teach the format at first and stop costing a message once the account trusts the bot.

## ADDED Requirements

### Requirement: The first loads are confirmed in text with Undo, later ones with a reaction

A successful load confirmed on WhatsApp SHALL be confirmed in one of two forms. The first is the confirmation text with one reply button labelled Undo in the account's language. The second is an emoji reaction on the user's own message, with the same icon the confirmation text starts with. With the account's confirmation mode `auto`, a load SHALL be confirmed in text while the account has fewer than 15 counted loads, and with a reaction from then on. Every successful load confirmed on WhatsApp SHALL add one to the account's count, whichever form it was confirmed in. The threshold SHALL be one constant for every account, not a stored value.

#### Scenario: First load
- **WHEN** an account in mode `auto` with a count of 0 sends "nafta 45"
- **THEN** the reply is the confirmation text with an Undo button and the count becomes 1

#### Scenario: Fifteenth load
- **WHEN** the account's count is 14 and it sends "café 3"
- **THEN** the reply is text with Undo and the count becomes 15

#### Scenario: Sixteenth load
- **WHEN** the account's count is 15 and it sends "café 3"
- **THEN** no text is sent, the user's message receives a ✅ reaction, and the count becomes 16

#### Scenario: Income reaction
- **WHEN** the account's count is 20 and it sends "propina 500"
- **THEN** the user's message receives a 💰 reaction

### Requirement: The mode can force one form

With the account's confirmation mode `texto`, every load SHALL be confirmed in text with Undo. With `reaccion`, every load SHALL be confirmed with a reaction, except the loads covered by *Some replies are always text*. The count SHALL keep rising in both forced modes.

#### Scenario: Forced text
- **WHEN** an account in mode `texto` with a count of 40 loads an expense
- **THEN** the reply is text with Undo

#### Scenario: Forced reaction
- **WHEN** an account in mode `reaccion` with a count of 0 loads an expense
- **THEN** the user's message receives a reaction and no text is sent

### Requirement: Some replies are always text

A load that answered the bot's category question SHALL always be confirmed in text with Undo, whatever the count and mode. A load that completed a recurring charge at an amount different from its definition SHALL always be confirmed in text, so the note that only this cycle changed is read. Every reply that is not a successful load SHALL be plain text without buttons: questions, corrections, deletions, undo, queries, category creation, already-logged, not understood and unavailable.

#### Scenario: Answer to a question
- **WHEN** an account with a count of 30 sends "gasté 50", then "comida"
- **THEN** both replies are text and the second carries Undo

#### Scenario: Differing recurring amount
- **WHEN** an account with a count of 30 sends "luz 72" and Luz expects 60
- **THEN** the reply is text naming 72 and saying the fixed amount stays at 60

#### Scenario: Query
- **WHEN** an account with a count of 30 sends "¿cómo vengo?"
- **THEN** the reply is text without buttons

### Requirement: Progressive confirmation belongs to the WhatsApp adapter

Choosing the form, reading and raising the count and reading the mode SHALL happen in the WhatsApp adapter. The bot logic SHALL return the confirmation text, its icon and the loaded row, and SHALL know nothing about buttons, reactions or the count. A failed send or reaction SHALL be logged with the number masked and SHALL NOT undo the load. The count SHALL still rise.

#### Scenario: Reaction fails
- **WHEN** the load is written and the reaction request returns an error
- **THEN** the load stays, the count rises and the error is logged with the number masked
