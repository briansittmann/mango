## MODIFIED Requirements

### Requirement: Only VIP accounts have their messages stored

An account SHALL be VIP only when its VIP flag is set, and that flag SHALL be set by hand in the database, with no screen for the account or an administrator. For a VIP account, every processed incoming message SHALL be stored with its text, channel, direction, time and the movement it loaded, if any; for a voice note the stored text SHALL be its transcription, and the audio data SHALL NOT be stored. The bot's reply to it SHALL be stored as outgoing, with the confirmation text even when the load was confirmed with a reaction. For any other account, no message text and no transcription SHALL be stored anywhere. The stored messages SHALL NOT be readable or writable with the public (anon or signed-in) key. A retry of the same incoming message SHALL NOT be stored twice.

#### Scenario: VIP load
- **WHEN** a VIP account sends "nafta 45"
- **THEN** two messages are stored: incoming "nafta 45", linked to the 45 expense, and the outgoing confirmation text

#### Scenario: VIP voice load
- **WHEN** a VIP account sends a voice note saying "nafta cuarenta y cinco"
- **THEN** the stored incoming message is the transcription, linked to the 45 expense, and no audio data is stored

#### Scenario: Not VIP
- **WHEN** an account without the VIP flag sends "nafta 45"
- **THEN** the expense is loaded and no message is stored

#### Scenario: Public key
- **WHEN** a signed-in user reads the stored messages with the public key
- **THEN** no row is returned

#### Scenario: Retry
- **WHEN** Meta delivers the same "¿cómo vengo?" message twice to a VIP account
- **THEN** the incoming message is stored once
