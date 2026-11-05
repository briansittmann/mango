## ADDED Requirements

### Requirement: A long note is acknowledged first

Every message from a linked chat that passes the retry and media checks SHALL mark the chat as read and show the platform's typing indicator before the bot's logic runs, so the person sees the bot working while the models think. A voice note whose measured duration is 10 seconds or more SHALL additionally be answered at once with a fixed text ("dame un momento, estoy escuchando el audio") in the account's language, before any model call; a shorter note, a text, a note that could not be downloaded and a stranger's message SHALL NOT get that text. The text SHALL NOT be stored in the account's conversation history. The second model call over a voice note (the retry) SHALL run with the reduced thinking level the parser uses for text, so a note that times out once still gets an answer.

#### Scenario: Long note
- **WHEN** a linked chat sends a voice note of 15 seconds
- **THEN** the chat shows the typing indicator, receives "⏳ Dame un momento, estoy escuchando el audio…" and then the note's reply

#### Scenario: Short note
- **WHEN** a linked chat sends a voice note of 4 seconds
- **THEN** the chat shows the typing indicator and receives only the note's reply

#### Scenario: A text
- **WHEN** a linked chat sends "súper 30"
- **THEN** the chat shows the typing indicator and receives only the confirmation

#### Scenario: A stranger or a retry
- **WHEN** an unknown number sends a note, or Meta redelivers a processed message
- **THEN** no typing indicator and no wait text are sent
