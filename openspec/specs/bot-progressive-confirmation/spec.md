## Purpose

Decides how the WhatsApp adapter confirms a successful load, text with an Undo button or an emoji reaction, so that confirmations teach the format and stop costing a message once the day's quota of text confirmations is spent.

## Requirements

### Requirement: The first loads of each day are confirmed in text with Undo, later ones with a reaction

A successful load confirmed on WhatsApp SHALL be confirmed in one of two forms. The first is the confirmation text with one reply button labelled Undo in the account's language. The second is an emoji reaction on the user's own message, with the confirmation's icon. With the account's confirmation mode `auto`, a load SHALL be confirmed in text while the account has fewer than 10 counted loads on the current day, and with a reaction from then on. The day is the account's local calendar day, in its time zone; the day's count starts at 0 on each new day. Every successful load confirmed on WhatsApp SHALL add one to the day's count, whichever form it was confirmed in. The threshold SHALL be one constant for every account, not a stored value.

#### Scenario: First load of the day
- **WHEN** an account in mode `auto` with no loads today sends "nafta 45"
- **THEN** the reply is the confirmation text with an Undo button and today's count becomes 1

#### Scenario: Tenth load
- **WHEN** the account has 9 loads today and it sends "café 3"
- **THEN** the reply is text with Undo and today's count becomes 10

#### Scenario: Eleventh load
- **WHEN** the account has 10 loads today and it sends "café 3"
- **THEN** no text is sent, the user's message receives a ✅ reaction, and today's count becomes 11

#### Scenario: A new day
- **WHEN** the account loaded 25 times yesterday and sends "café 3" today, its first load of the day
- **THEN** the reply is text with Undo and today's count becomes 1

#### Scenario: Income reaction
- **WHEN** the account has 12 loads today and it sends "propina 500"
- **THEN** the user's message receives a 💰 reaction

### Requirement: The mode can force one form

With the account's confirmation mode `texto`, every load SHALL be confirmed in text with Undo. With `reaccion`, every load SHALL be confirmed with a reaction, except the loads covered by *Some replies are always text*. The count SHALL keep rising in both forced modes.

#### Scenario: Forced text
- **WHEN** an account in mode `texto` with 40 loads today loads an expense
- **THEN** the reply is text with Undo

#### Scenario: Forced reaction
- **WHEN** an account in mode `reaccion` with no loads today loads an expense
- **THEN** the user's message receives a reaction and no text is sent

### Requirement: Some replies are always text

A load that answered the bot's category question SHALL always be confirmed in text with Undo, whatever the day's count and mode. A load that completed a recurring charge at an amount different from its definition SHALL always be confirmed in text, so the note that only this cycle changed is read. A load made from a voice note SHALL always be confirmed in text with Undo, with the transcription quoted first, so the person can check what was heard (`bot-voice-messages`). Every reply that is not a successful load SHALL be plain text without buttons: questions, corrections, deletions, undo, queries, category creation, already-logged, not understood and unavailable.

#### Scenario: Answer to a question
- **WHEN** an account with 12 loads today sends "gasté 50", then "comida"
- **THEN** both replies are text and the second carries Undo

#### Scenario: Differing recurring amount
- **WHEN** an account with 12 loads today sends "luz 72" and Luz expects 60
- **THEN** the reply is text naming 72 and saying the fixed amount stays at 60

#### Scenario: Query
- **WHEN** an account with 12 loads today sends "¿cómo vengo?"
- **THEN** the reply is text without buttons

#### Scenario: Voice load
- **WHEN** an account with 12 loads today in mode `auto` sends a voice note saying "café tres cincuenta"
- **THEN** the reply is text with Undo that quotes the transcription, and today's count becomes 13

### Requirement: Progressive confirmation belongs to the WhatsApp adapter

Choosing the form, reading and raising the count and reading the mode SHALL happen in the WhatsApp adapter. The bot logic SHALL return the confirmation text, its icon and the loaded row, and SHALL know nothing about buttons, reactions or the count. A failed send or reaction SHALL be logged with the number masked and SHALL NOT undo the load. The count SHALL still rise.

#### Scenario: Reaction fails
- **WHEN** the load is written and the reaction request returns an error
- **THEN** the load stays, the count rises and the error is logged with the number masked
