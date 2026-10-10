## Purpose

Lets a linked chat talk to the bot with a voice note instead of typing: the note is understood as the same single action a text would be, answered in text with what was heard, limited to 30 seconds and never stored; and gives every other media type one fixed answer.

## ADDED Requirements

### Requirement: A voice note is handled as a message

A WhatsApp voice note (an `audio` message recorded in the chat, Ogg/Opus) from a linked chat SHALL be handled as one message of that chat: it SHALL produce exactly one action from the same set a text produces, executed the same way, with the same pending question, last load and category rules. The audio SHALL be understood in one model request, with no separate transcription step, and the action SHALL carry the transcription of what was heard. Idempotency SHALL be by channel and message id, as for a text: a voice note whose id is already recorded on a movement SHALL be discarded with no download, no model call and no reply.

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

#### Scenario: Retry of a voice note
- **WHEN** a voice note with id `wamid.V` was loaded and Meta delivers `wamid.V` again
- **THEN** nothing is downloaded, nothing is written and nothing is sent

### Requirement: A voice note is at most 30 seconds

The bot SHALL measure the note's duration from the audio data itself before any model call. A note longer than 30 seconds SHALL NOT be sent to the model: nothing is written, the channel's pending question and last load are untouched, and the reply asks for a note of up to 30 seconds or a text. The limit SHALL be one constant for every account. A file whose size makes a note of 30 seconds impossible SHALL be refused without downloading it.

#### Scenario: Long note
- **WHEN** the chat sends a voice note of 45 seconds
- **THEN** no model call is made, nothing is written and the reply asks for one of up to 30 seconds or a text

#### Scenario: Long note with a question pending
- **WHEN** the chat was asked a category and sends a 45-second note
- **THEN** the question is still pending

#### Scenario: Just under the limit
- **WHEN** the chat sends a voice note of 29 seconds
- **THEN** it is handled as a message

### Requirement: Replies to a voice note are text and show what was heard

Every reply to a voice note SHALL be text and SHALL begin with a line that quotes the transcription, so the person can check what the bot heard. A load from a voice note SHALL be confirmed in text with the Undo button, whatever the account's confirmation count or mode, and SHALL still add one to the count. When the model returns no action for the note, the reply SHALL quote the transcription and then say it was not understood, with the usual example. When the model heard no intelligible speech, the reply SHALL say nothing was heard and ask to try again or type it.

#### Scenario: Confirmation after many loads
- **WHEN** an account in mode `auto` with a count of 40 sends a voice note saying "nafta cuarenta y cinco"
- **THEN** the reply is text that quotes "nafta cuarenta y cinco", confirms 45 in Transporte and carries Undo, and the count becomes 41

#### Scenario: Forced reaction mode
- **WHEN** an account in mode `reaccion` loads from a voice note
- **THEN** the reply is text with Undo, not a reaction

#### Scenario: Not understood
- **WHEN** the chat sends a voice note saying "hola, ¿qué tal?"
- **THEN** nothing is written and the reply quotes that transcription and says it was not understood, with an example

#### Scenario: Nothing heard
- **WHEN** the chat sends a voice note with only background noise
- **THEN** nothing is written and the reply says nothing was heard and asks to try again or type it

### Requirement: An audio that cannot be fetched or decoded is answered without writing

When the audio cannot be downloaded from the messaging platform, or the downloaded data is not a decodable voice note, the bot SHALL write nothing, SHALL make no model call, SHALL keep the channel's pending question and last load, and SHALL reply that it could not listen to the audio now and to resend it later or type it. A later delivery of the same message SHALL be processed again.

#### Scenario: Download fails
- **WHEN** the platform's media request returns an error for the note
- **THEN** nothing is written, the pending question stays, and the reply says the audio could not be listened to now

#### Scenario: Retry after a failed download
- **WHEN** the download of `wamid.V` failed and Meta delivers `wamid.V` again
- **THEN** the note is processed again

### Requirement: The audio is never stored

The audio data of a voice note SHALL exist only in memory while its message is processed and SHALL NOT be written to the database, to file storage or to the logs, for any account. For a VIP account only the transcription SHALL be stored, as `bot-conversation-history` defines; for any other account nothing of the note SHALL be stored beyond the movement it loaded. Logs SHALL name the message id and the duration at most, never the content.

#### Scenario: VIP voice note
- **WHEN** a VIP account loads from a voice note saying "café tres cincuenta"
- **THEN** the stored incoming message is the transcription text and no audio data is stored

#### Scenario: Non-VIP voice note
- **WHEN** an account without the VIP flag loads from a voice note
- **THEN** the expense exists and neither the audio nor its transcription is stored

### Requirement: Other media get one fixed answer

An image, video, document, sticker, location or contact card from a linked chat SHALL NOT be downloaded or sent to the model. The bot SHALL reply once per such message that it only understands text and voice notes of up to 30 seconds, and SHALL leave the channel's pending question and last load untouched. An audio file that is not a voice note (a forwarded or attached audio file) SHALL be treated the same way. A reaction emoji on a message SHALL be ignored with no reply. From an unknown number, any of these SHALL be treated like a text: answered once with the reply that sends the person to the web.

#### Scenario: Image from a linked chat
- **WHEN** a linked chat sends a photo of a receipt
- **THEN** nothing is downloaded, nothing is written and the reply says the bot only understands text and voice notes of up to 30 seconds

#### Scenario: Attached audio file
- **WHEN** a linked chat forwards an MP3 file
- **THEN** it gets the same reply as an image and no model call is made

#### Scenario: Reaction
- **WHEN** a linked chat reacts with 👍 to the bot's confirmation
- **THEN** nothing is sent

#### Scenario: Image from an unknown number
- **WHEN** a number with no channel sends a photo for the first time
- **THEN** it receives the once-only reply that sends it to the web, and nothing else
