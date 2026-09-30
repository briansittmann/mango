## MODIFIED Requirements

### Requirement: The bot logic does not know the channel's mechanics
The bot logic SHALL receive each message as:

- the account, the text, the message id and the channel type;
- the channel's pending question, when one is held and not expired;
- the channel's last load, when it remembers one;
- for a button press, the load that button undoes.

It SHALL NOT receive phone numbers or platform payloads for known senders. The logic SHALL return what to reply. When it asks a question, it SHALL return the question to hold. When it loads, deletes or undoes a movement, it SHALL return how the channel's last load changes. Storing, expiring and clearing the question, storing the last load, and choosing between text, buttons and reactions SHALL be the adapter's job. For an unknown sender it SHALL receive the channel type, the external identifier, the text and whether an invitation is required.

#### Scenario: Known sender
- **WHEN** a known account writes on WhatsApp
- **THEN** the logic receives the account, the text, the message id and the channel `whatsapp`

#### Scenario: Known sender with a pending question
- **WHEN** a known account whose WhatsApp channel holds an unexpired question writes again
- **THEN** the logic receives that question together with the message, and the adapter clears or replaces it according to the reply

#### Scenario: Button press
- **WHEN** a known account presses Undo on a load's confirmation
- **THEN** the logic receives the load that button belongs to and no platform payload

#### Scenario: Unknown sender
- **WHEN** an unknown number writes on WhatsApp
- **THEN** the logic receives the channel `whatsapp`, the number, the text and the current value of the invitation switch

### Requirement: A channel holds at most one pending question

A channel MAY hold one pending question with an expiry. The question SHALL be either a category question or a category-creation confirmation. Writing a new question of either kind SHALL replace the previous one. A question whose expiry has passed SHALL be treated as absent. Clearing the question SHALL leave the channel without one. The pending question SHALL NOT be readable or writable with the public (anon or signed-in) key. Deleting the channel SHALL delete its question.

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

## ADDED Requirements

### Requirement: A channel remembers its last load

A channel SHALL remember at most one last load: a movement of the channel's own account. A successful load through the channel SHALL replace it. Deleting or undoing that movement through the channel SHALL clear it. When the movement is hard-deleted, the channel SHALL remember none. The last load SHALL NOT be readable or writable with the public (anon or signed-in) key, and SHALL NOT point to another account's movement.

#### Scenario: Replaced by a new load
- **WHEN** the channel remembers the 45 expense and the account loads "café 3"
- **THEN** the channel remembers the café

#### Scenario: Cleared by delete
- **WHEN** the account sends "borrá eso"
- **THEN** the channel remembers no last load

#### Scenario: Another account's movement
- **WHEN** a write tries to set a channel's last load to another account's movement
- **THEN** the database rejects it
