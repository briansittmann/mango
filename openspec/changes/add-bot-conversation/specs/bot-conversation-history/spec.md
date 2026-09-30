## Purpose

Keeps a short conversation history for VIP accounts only, so the parser understands messages that depend on the previous turns, and stores no message text for anyone else.

## ADDED Requirements

### Requirement: Only VIP accounts have their messages stored

An account SHALL be VIP only when its VIP flag is set, and that flag SHALL be set by hand in the database, with no screen for the account or an administrator. For a VIP account, every processed incoming message SHALL be stored with its text, channel, direction, time and the movement it loaded, if any. The bot's reply to it SHALL be stored as outgoing, with the confirmation text even when the load was confirmed with a reaction. For any other account, no message text SHALL be stored anywhere. The stored messages SHALL NOT be readable or writable with the public (anon or signed-in) key. A retry of the same incoming message SHALL NOT be stored twice.

#### Scenario: VIP load
- **WHEN** a VIP account sends "nafta 45"
- **THEN** two messages are stored: incoming "nafta 45", linked to the 45 expense, and the outgoing confirmation text

#### Scenario: Not VIP
- **WHEN** an account without the VIP flag sends "nafta 45"
- **THEN** the expense is loaded and no message is stored

#### Scenario: Public key
- **WHEN** a signed-in user reads the stored messages with the public key
- **THEN** no row is returned

#### Scenario: Retry
- **WHEN** Meta delivers the same "¿cómo vengo?" message twice to a VIP account
- **THEN** the incoming message is stored once

### Requirement: The parser sees the recent conversation of a VIP account

For a VIP account, the parser SHALL receive the account's last 20 stored messages from the last 24 hours on any channel, oldest first, each marked as the user's or the bot's, before the new message. It SHALL use them only to understand the new message, and SHALL still return one action for the new message alone. Both limits SHALL be constants of the code. A non-VIP account's parser input SHALL carry no conversation.

#### Scenario: Same as yesterday
- **WHEN** a VIP account sent "almuerzo 12" 20 hours ago and now sends "lo mismo que ayer"
- **THEN** the action is `cargar` with `monto` 12 in the same category

#### Scenario: Older than a day
- **WHEN** a VIP account's only stored messages are from 30 hours ago
- **THEN** the parser receives no conversation

#### Scenario: More than twenty
- **WHEN** a VIP account has 30 stored messages in the last 24 hours
- **THEN** the parser receives only the 20 most recent, oldest first

### Requirement: Messages are kept for 30 days

Stored messages older than 30 days SHALL be deleted by the daily scheduled job. Retention SHALL be a constant of the code.

#### Scenario: Old message
- **WHEN** the daily job runs and a message was stored 31 days ago
- **THEN** that message no longer exists and messages from the last 30 days remain
