## MODIFIED Requirements

### Requirement: The bot logic does not know the channel's mechanics
The bot logic SHALL receive each message as:

- the account, the message id and the channel type, and the message's content: its text, or, for a voice note, the audio data and its MIME type;
- the channel's pending question, when one is held and not expired;
- the channel's last load, when it remembers one;
- for a button press, the load that button undoes, or the answer it gives to the pending deposit question (a transfer from cash, or a new income).

It SHALL NOT receive phone numbers, platform payloads, media ids or media URLs for known senders: fetching a voice note from the platform is the adapter's job, done before the logic runs. The logic SHALL return what to reply. When it asks a question, it SHALL return the question to hold. When it loads, deletes or undoes a movement, it SHALL return how the channel's last load changes. When the question it asks offers reply buttons (the deposit question), it SHALL return the buttons' labels and the answer each stands for, never a platform payload. Storing, expiring and clearing the question, storing the last load, sending the buttons, mapping a pressed button back to its answer, and choosing between text, buttons and reactions SHALL be the adapter's job. A pressed answer button with no deposit question pending on the channel SHALL be discarded without calling the logic. A linking message (`vincular <código>`) SHALL be resolved by the adapter before the logic, for known and unknown senders alike, and SHALL never reach the parser. A message of a media type the bot does not handle SHALL be answered by the adapter with the fixed reply (`bot-voice-messages`) and SHALL not reach the logic. For any other message from an unknown sender the logic SHALL receive the channel type, the external identifier, the text and whether that identifier was already answered, and nothing about invitations: an unknown number cannot create an account from the chat, and no configuration decides otherwise.

#### Scenario: Known sender
- **WHEN** a known account writes on WhatsApp
- **THEN** the logic receives the account, the text, the message id and the channel `whatsapp`

#### Scenario: Known sender with a voice note
- **WHEN** a known account sends a voice note on WhatsApp
- **THEN** the logic receives the account, the audio data with its MIME type, the message id and the channel `whatsapp`, and no media id or URL

#### Scenario: Known sender with a pending question
- **WHEN** a known account whose WhatsApp channel holds an unexpired question writes again
- **THEN** the logic receives that question together with the message, and the adapter clears or replaces it according to the reply

#### Scenario: Button press
- **WHEN** a known account presses Undo on a load's confirmation
- **THEN** the logic receives the load that button belongs to and no platform payload

#### Scenario: Unknown sender
- **WHEN** an unknown number writes "hola" on WhatsApp
- **THEN** the logic receives the channel `whatsapp`, the number, the text and whether the number was answered before; no account is created and no channel is linked

#### Scenario: Linking message
- **WHEN** an unknown number writes "vincular K7M2PX"
- **THEN** the adapter links or refuses as `whatsapp-linking` describes, and the logic is not called

#### Scenario: Unhandled media
- **WHEN** a known account sends a photo
- **THEN** the adapter sends the fixed reply and the logic is not called

#### Scenario: Answer button
- **WHEN** a known account whose channel holds a deposit question presses "Lo pasé desde efectivo"
- **THEN** the logic receives the account, the pending question and the answer "transfer from cash", and no platform payload

#### Scenario: Answer button after the question expired
- **WHEN** the account presses "Es un ingreso nuevo" after the question expired
- **THEN** the adapter discards the press and the logic is not called

### Requirement: A channel holds at most one pending question

A channel MAY hold one pending question with an expiry. The question SHALL be a category question, a category-creation confirmation, or a deposit question (an amount, the days ago and an optional description, asked as income or transfer from cash). Writing a new question of any kind SHALL replace the previous one. A question whose expiry has passed SHALL be treated as absent. Clearing the question SHALL leave the channel without one. The pending question SHALL NOT be readable or writable with the public (anon or signed-in) key. Deleting the channel SHALL delete its question.

#### Scenario: Replace
- **WHEN** a channel holds a pending question and a new one is written
- **THEN** reading the channel returns only the new question

#### Scenario: Replace across kinds
- **WHEN** a channel holds a category question and a category-creation confirmation is written
- **THEN** reading the channel returns only the confirmation

#### Scenario: Expired
- **WHEN** a channel's question expired one minute ago
- **THEN** reading the channel returns no pending question

#### Scenario: Public key
- **WHEN** a signed-in user reads or writes a channel's pending question with the public key
- **THEN** no row is returned and nothing is written

#### Scenario: Replace with a deposit question
- **WHEN** a channel holds a category question and a deposit question is written
- **THEN** reading the channel returns only the deposit question
