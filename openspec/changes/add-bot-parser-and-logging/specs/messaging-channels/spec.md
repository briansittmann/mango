## ADDED Requirements

### Requirement: A channel holds at most one pending question

A channel MAY hold one pending question with an expiry. Writing a new question SHALL replace the previous one. A question whose expiry has passed SHALL be treated as absent. Clearing the question SHALL leave the channel without one. The pending question SHALL NOT be readable or writable with the public (anon or signed-in) key. Deleting the channel SHALL delete its question.

#### Scenario: Replace
- **WHEN** a channel holds a pending question and a new one is written
- **THEN** reading the channel returns only the new question

#### Scenario: Expired
- **WHEN** a channel's question expired one minute ago
- **THEN** reading the channel returns no pending question

#### Scenario: Public key
- **WHEN** a signed-in user reads or writes a channel's pending question with the public key
- **THEN** no row is returned and nothing is written

## MODIFIED Requirements

### Requirement: The bot logic does not know the channel's mechanics
The bot logic SHALL receive each message as the account, the text, the message id, the channel type and the channel's pending question when one is held and not expired, and SHALL NOT receive phone numbers or platform payloads for known senders. The logic SHALL return what to reply and, when it asks a question, the question to hold; storing, expiring and clearing that question SHALL be the adapter's job. For an unknown sender it SHALL receive the channel type, the external identifier, the text and whether an invitation is required.

#### Scenario: Known sender
- **WHEN** a known account writes on WhatsApp
- **THEN** the logic receives the account, the text, the message id and the channel `whatsapp`

#### Scenario: Known sender with a pending question
- **WHEN** a known account whose WhatsApp channel holds an unexpired question writes again
- **THEN** the logic receives that question together with the message, and the adapter clears or replaces it according to the reply

#### Scenario: Unknown sender
- **WHEN** an unknown number writes on WhatsApp
- **THEN** the logic receives the channel `whatsapp`, the number, the text and the current value of the invitation switch
