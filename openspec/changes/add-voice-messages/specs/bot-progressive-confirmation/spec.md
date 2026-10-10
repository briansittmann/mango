## MODIFIED Requirements

### Requirement: Some replies are always text

A load that answered the bot's category question SHALL always be confirmed in text with Undo, whatever the count and mode. A load that completed a recurring charge at an amount different from its definition SHALL always be confirmed in text, so the note that only this cycle changed is read. A load made from a voice note SHALL always be confirmed in text with Undo, with the transcription quoted first, so the person can check what was heard (`bot-voice-messages`). Every reply that is not a successful load SHALL be plain text without buttons: questions, corrections, deletions, undo, queries, category creation, already-logged, not understood and unavailable.

#### Scenario: Answer to a question
- **WHEN** an account with a count of 30 sends "gasté 50", then "comida"
- **THEN** both replies are text and the second carries Undo

#### Scenario: Differing recurring amount
- **WHEN** an account with a count of 30 sends "luz 72" and Luz expects 60
- **THEN** the reply is text naming 72 and saying the fixed amount stays at 60

#### Scenario: Query
- **WHEN** an account with a count of 30 sends "¿cómo vengo?"
- **THEN** the reply is text without buttons

#### Scenario: Voice load
- **WHEN** an account with a count of 30 in mode `auto` sends a voice note saying "café tres cincuenta"
- **THEN** the reply is text with Undo that quotes the transcription, and the count becomes 31
