## Purpose

Separates a Mango account from the messaging channels it uses: the bot identifies who writes through a linked channel (WhatsApp today, Telegram later), not through the account's phone, and message idempotency is kept per channel.

## Requirements

### Requirement: An account exists without a phone
An account SHALL be valid without a phone number. When an account has a phone, it SHALL be in E.164 form and no other account SHALL have the same phone.

#### Scenario: Account without phone
- **WHEN** an account is stored with no phone
- **THEN** the database accepts it

#### Scenario: Malformed phone
- **WHEN** an account is stored with the phone `353871234567` (no `+`)
- **THEN** the database rejects it

### Requirement: Channels link an account to a messaging identity
A channel SHALL belong to one account and SHALL have a type, `whatsapp` or `telegram`, and an external identifier. A `whatsapp` identifier SHALL be a phone in E.164 form. An external identifier SHALL be linked to at most one account per channel type. An account SHALL have at most one channel of each type, and MAY have one of each type at the same time. Deleting an account SHALL delete its channels. Channels SHALL NOT be readable or writable with the public (anon or signed-in) key; only the server-side service role reaches them.

#### Scenario: Same number on two accounts
- **WHEN** a `whatsapp` channel with `+353871234567` exists for one account and the same identifier is linked to a second account
- **THEN** the database rejects the second link

#### Scenario: Two WhatsApp numbers on one account
- **WHEN** an account with a `whatsapp` channel gets a second `whatsapp` channel
- **THEN** the database rejects it

#### Scenario: WhatsApp and Telegram on one account
- **WHEN** an account with a `whatsapp` channel gets a `telegram` channel
- **THEN** both channels exist and point to the same account

#### Scenario: Signed-in user reads channels
- **WHEN** a signed-in user queries channels with the public key
- **THEN** no row is returned, including their own

### Requirement: Existing phones become WhatsApp channels
When the channel table is introduced, every account that has a phone SHALL get a `whatsapp` channel with that phone as its identifier, so a number that the bot recognised before keeps being recognised.

#### Scenario: Phone migrated
- **WHEN** the migration runs over an account with phone `+353871234567`
- **THEN** that account has a `whatsapp` channel with identifier `+353871234567`

### Requirement: The bot identifies the sender by channel
The WhatsApp webhook SHALL resolve the sender by looking up a `whatsapp` channel whose identifier is the sender's number in E.164 form. It SHALL NOT resolve the sender through the account's phone. A number with no channel SHALL be treated as unknown, even if some account has that phone stored.

#### Scenario: Known number
- **WHEN** a text message arrives from a number linked as a `whatsapp` channel
- **THEN** the message is handed to the bot logic for the account that owns the channel

#### Scenario: Phone without channel
- **WHEN** a text message arrives from a number stored as an account's phone but not linked as a channel
- **THEN** the sender is treated as an unknown number

### Requirement: Message idempotency is per channel
A transaction created from a chat message SHALL record the channel it came from and the channel's message id; either both are recorded or neither is. The same channel message id SHALL NOT produce two transactions for the same account on the same channel. A message whose id is already recorded for that account and channel, deleted transactions included, SHALL be discarded as a retry. The same message id on a different channel SHALL NOT count as a retry.

#### Scenario: Meta retries a message
- **WHEN** a transaction exists for an account with channel `whatsapp` and message id `wamid.X`, and a message with id `wamid.X` arrives again from that account's WhatsApp
- **THEN** the message is discarded and nothing is written

#### Scenario: Retry after delete
- **WHEN** the transaction for `wamid.X` was soft-deleted and `wamid.X` arrives again
- **THEN** the message is discarded and the transaction stays deleted

#### Scenario: Same id on another channel
- **WHEN** a transaction exists with channel `whatsapp` and message id `42`, and a message with id `42` arrives for the same account on `telegram`
- **THEN** the message is not treated as a retry

#### Scenario: Message id without channel
- **WHEN** a transaction is stored with a message id and no channel
- **THEN** the database rejects it

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

### Requirement: The WhatsApp invitation is a switch
Whether an unknown WhatsApp number needs an invitation code SHALL be decided by the `WHATSAPP_REQUIRE_INVITE` server environment variable. Only the exact value `false` SHALL turn the requirement off; a missing variable or any other value SHALL keep it on. Changing it SHALL NOT require a code change.

#### Scenario: Variable missing
- **WHEN** `WHATSAPP_REQUIRE_INVITE` is not set and an unknown number writes
- **THEN** an invitation is required

#### Scenario: Variable is false
- **WHEN** `WHATSAPP_REQUIRE_INVITE` is `false` and an unknown number writes
- **THEN** no invitation is required

#### Scenario: Unrecognised value
- **WHEN** `WHATSAPP_REQUIRE_INVITE` is `False`, `0` or `no`
- **THEN** an invitation is required

### Requirement: Nothing depends on the test number's limits
No code SHALL cap the number of WhatsApp recipients, count messages against a monthly quota, or hard-code the sending number. The sending number SHALL come from `WHATSAPP_PHONE_NUMBER_ID`. Moving to an owned number SHALL require only new credentials and the invitation switch.

#### Scenario: Sixth account
- **WHEN** a sixth account is linked to a WhatsApp channel
- **THEN** nothing in Mango rejects it; only Meta's own limit applies while the test number is in use

#### Scenario: Changing the number
- **WHEN** `WHATSAPP_PHONE_NUMBER_ID` changes and the app is redeployed
- **THEN** the app uses the new number with no code change

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
