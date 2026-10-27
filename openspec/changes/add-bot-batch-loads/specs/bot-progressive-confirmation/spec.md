## MODIFIED Requirements

### Requirement: Some replies are always text

A load that answered the bot's category question SHALL always be confirmed in text with Undo, whatever the day's count and mode. A load that completed a recurring charge at an amount different from its definition SHALL always be confirmed in text, so the note that only this cycle changed is read. A load made from a voice note SHALL always be confirmed in text with Undo, with the transcription quoted first, so the person can check what was heard (`bot-voice-messages`). A message that loaded several movements SHALL always be confirmed in one text with one Undo for all of them, so every row can be checked, and SHALL add one to the day's count. Every reply that is not a successful load SHALL be plain text: questions, corrections, deletions, undo, queries, category creation, not understood and unavailable. The only replies with buttons other than Undo SHALL be the questions that offer their answers as buttons (the ambiguous bank deposit and the fixed charge already charged this cycle).

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

#### Scenario: A list of movements
- **WHEN** an account with 12 loads today in mode `auto` sends "café 3, súper 25 y nafta 40"
- **THEN** the reply is one text with one Undo listing the three rows, and today's count becomes 13
