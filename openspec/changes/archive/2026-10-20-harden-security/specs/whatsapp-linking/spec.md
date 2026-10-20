## ADDED Requirements

### Requirement: Linking attempts are limited per number
A number with no `whatsapp` channel SHALL be able to send at most 5 linking messages (`vincular` followed by a six-symbol word, as the linking message is recognised today) per hour. From the sixth within the hour, the bot SHALL not check the code, SHALL change nothing, and SHALL reply, in Spanish and English, to wait an hour and try again with the code from the web. A successful link SHALL count as an attempt like any other. The count SHALL survive between server instances.

#### Scenario: Guessing codes
- **WHEN** an unknown number sends "vincular AAAAAA" through "vincular AAAAAE" (five invalid codes) and then a sixth linking message within the same hour
- **THEN** the first five are answered that the code is not valid, and the sixth is answered to wait, without checking its code

#### Scenario: After the hour
- **WHEN** that number sends a live code an hour after its first attempt
- **THEN** the chat is linked

### Requirement: The linking code is issued by the database
The web SHALL get the account's linking code from the database, which SHALL return the live code if there is one and otherwise create a new one with its request time; the code and its request time SHALL NOT be writable any other way with the person's token. The code's format, lifetime and uniqueness SHALL stay as they are.

#### Scenario: Live code reused
- **WHEN** the account asked for a code three days ago and taps "Vincular WhatsApp" again
- **THEN** the same code is shown

#### Scenario: New code
- **WHEN** the account's code is eight days old and it taps "Vincular WhatsApp"
- **THEN** a new six-symbol code is shown and is live for seven days
