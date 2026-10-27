## MODIFIED Requirements

### Requirement: A voice note is handled as a message

A WhatsApp voice note (an `audio` message recorded in the chat, Ogg/Opus) from a linked chat SHALL be handled as one message of that chat: it SHALL produce exactly one action from the same set a text produces, executed the same way, with the same pending question, last load and category rules. A note that names several movements SHALL load them all, as a typed list does. The audio SHALL be understood in one model request, with no separate transcription step, and the action SHALL carry the transcription of what was heard. Idempotency SHALL be by channel and message id, as for a text: a voice note whose id is already recorded on a movement SHALL be discarded with no download, no model call and no reply.

#### Scenario: Voice load
- **WHEN** a linked chat sends a voice note saying "café tres cincuenta" and the account has a Comida category
- **THEN** one expense of 3.5 exists in Comida (or Otros when nothing fits), with the note's message id, and the reply confirms it

#### Scenario: Voice query
- **WHEN** the chat sends a voice note saying "¿cómo vengo?"
- **THEN** nothing is written and the reply is the month summary, as for the typed question

#### Scenario: Voice answer to a pending question
- **WHEN** the chat typed "gasté 50", was asked the category, and answers with a voice note saying "comida"
- **THEN** one expense of 50 exists in Comida and no question is pending

#### Scenario: Voice correction
- **WHEN** the chat's last load is an expense of 50 and it sends a voice note saying "no, eran cuarenta"
- **THEN** that row's amount is 40

#### Scenario: Voice list
- **WHEN** the chat sends a voice note saying "café tres, súper veinticinco y nafta cuarenta"
- **THEN** three expenses are written and the reply quotes the transcription and then lists the three rows

#### Scenario: Retry of a voice note
- **WHEN** a voice note with id `wamid.V` was loaded and Meta delivers `wamid.V` again
- **THEN** nothing is downloaded, nothing is written and nothing is sent
