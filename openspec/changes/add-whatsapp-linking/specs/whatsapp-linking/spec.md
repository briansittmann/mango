## Purpose

Links a WhatsApp number to a web account from the person's own first message: a short code the web puts into a `wa.me` link, which the bot recognises and turns into a channel, so no template, no typed number and no manual step stand between an account and its bot.

## ADDED Requirements

### Requirement: Each account can hold one live linking code
An account SHALL be able to hold at most one linking code: six characters from the uppercase letters and digits with `0`, `O`, `1` and `I` left out, unique across accounts. A code SHALL be created when the account asks to link (reaching the onboarding's closing step, or activating "Vincular WhatsApp" in the account sheet), and that moment SHALL be stored as the request time. A code SHALL be live for 7 days from its request time; asking again while it is live SHALL return the same code and SHALL NOT move the request time; asking after it expired SHALL replace it with a new code and a new request time. The code SHALL be readable only by its own account with the public key. Creating a code SHALL send nothing.

#### Scenario: First request
- **WHEN** an account with no code reaches the closing step
- **THEN** the account holds a six-character code and a request time of now

#### Scenario: Reused while live
- **WHEN** an account whose code was requested 3 days ago opens the account sheet's "WhatsApp" section and activates "Vincular WhatsApp"
- **THEN** the same code is shown and the request time is unchanged

#### Scenario: Replaced after expiry
- **WHEN** an account whose code was requested 8 days ago activates "Vincular WhatsApp"
- **THEN** a different code is shown and the request time is now

#### Scenario: Another account's code
- **WHEN** a signed-in user reads the users table with the public key
- **THEN** only their own row's code is returned

### Requirement: "Vincular WhatsApp" opens the chat with the message written
Wherever the web offers to link ("Vincular WhatsApp"), the action SHALL open WhatsApp against Mango's number with the message `vincular <código>` already written, using the `wa.me` link of the configured number and the account's live code. On a phone this SHALL open the WhatsApp app; on a desktop, WhatsApp Web, in a new tab. The code SHALL also be shown as text next to the action, so it can be typed by hand. When no number is configured for the deployment, the action SHALL NOT be offered: the screen SHALL show the code and a line that says to send `vincular <código>` to Mango.

#### Scenario: Link
- **WHEN** the configured number is `15551234567`, the account's code is `K7M2PX` and the person activates "Vincular WhatsApp"
- **THEN** `https://wa.me/15551234567?text=vincular%20K7M2PX` opens, and the screen shows "K7M2PX" beside the action

#### Scenario: No number configured
- **WHEN** the deployment has no WhatsApp number and the closing step is shown
- **THEN** there is no "Vincular WhatsApp" action, the code is shown, and a line says to send `vincular` plus the code to Mango

### Requirement: The first message with a live code links the chat
When a text message from a number with no `whatsapp` channel reads `vincular` followed by a live code (case, extra spaces and the surrounding whitespace ignored), the bot SHALL, in one atomic step: create the account's `whatsapp` channel with the sender's identifier exactly as the platform sent it (in E.164 form), store that identifier as the account's phone, clear that phone from any other account that only had it stored, and consume the code. It SHALL then reply, in the account's language, that the chat is linked. The reply SHALL be inside the platform's free reply window, with no template. From then on, messages from that number SHALL reach the bot as the account's own.

#### Scenario: Linked
- **WHEN** account A holds the live code `K7M2PX` and the number `+5491155551234`, unknown to any channel, sends "vincular K7M2PX"
- **THEN** account A has a `whatsapp` channel with identifier `+5491155551234`, its phone is `+5491155551234`, its code is gone, and the chat receives "✅ Listo, este chat ya está vinculado a tu cuenta."

#### Scenario: Case and spacing
- **WHEN** the same number sends "  Vincular   k7m2px "
- **THEN** the chat is linked the same way

#### Scenario: Typed number differed
- **WHEN** account A stored the typed phone `+541155551234` and links from `+5491155551234`
- **THEN** the account's phone is `+5491155551234`

#### Scenario: Typed number on another account
- **WHEN** account B has `+5491155551234` stored as its phone with no channel, and account A links from that number
- **THEN** account A's phone is `+5491155551234`, account B's phone is empty, and account B's data is otherwise untouched

#### Scenario: Next message is the account's
- **WHEN** the linked number then sends "super 15"
- **THEN** the expense is loaded on account A

### Requirement: A linking message that cannot link is answered with its reason
A linking message from an unknown number SHALL be refused, with one reply and no change, when: the code matches no account or has expired ("código inválido"); the sender's number is already another account's channel ("número en otra cuenta"); the code's account already has a `whatsapp` channel ("cuenta ya vinculada": the account must unlink on the web first — not offered yet, see design). A linking message from a number that already is a channel SHALL be answered that the chat is already linked, without parsing it, and SHALL write nothing. Replies to an unknown number SHALL be in Spanish and English.

#### Scenario: Expired code
- **WHEN** an unknown number sends "vincular K7M2PX" and the code's request time is 8 days ago
- **THEN** the reply says the code is not valid and to get a new one from the web, and no channel is created

#### Scenario: Unknown code
- **WHEN** an unknown number sends "vincular ZZZZZZ"
- **THEN** the reply says the code is not valid, and nothing changes

#### Scenario: Number already linked elsewhere
- **WHEN** `+5491155551234` is account B's channel and account A's code arrives from `+5491155551234`
- **THEN** the reply says the number is already linked to another account, and both accounts are unchanged

#### Scenario: Account already linked
- **WHEN** account A already has a `whatsapp` channel and an unknown number sends A's live code
- **THEN** the reply says that account already has a WhatsApp, and no second channel is created

#### Scenario: Linked chat sends a code
- **WHEN** a number that is account A's channel sends "vincular K7M2PX"
- **THEN** the reply says this chat is already linked, no movement is loaded, and the model is not called

### Requirement: An unknown number is answered once
A text from a number with no `whatsapp` channel that is not a linking message SHALL be answered once per number: a reply in Spanish and English that says the account is created on the web, with the site's link, and that WhatsApp is linked from the account. The system SHALL remember each unknown number with its first and last message times, its message count and when it was answered; later messages from the same number SHALL update the count and SHALL get no reply. Remembered numbers older than 90 days SHALL be purged by the daily cron, after which the number is answered once again. A button press from an unknown number SHALL be ignored. No account and no channel SHALL be created from the chat.

#### Scenario: First message
- **WHEN** `+353871234567`, unknown and never seen, sends "gaste 50"
- **THEN** the reply names the site's link, says the account is created there and WhatsApp is linked from it, in both languages, and the number is remembered with one message and an answered time

#### Scenario: Second message
- **WHEN** the same number sends "hola" a minute later
- **THEN** no reply is sent and the number's count reads two

#### Scenario: Later linked
- **WHEN** the same number, now remembered, sends "vincular K7M2PX" with a live code
- **THEN** the chat is linked as *The first message with a live code links the chat* describes

#### Scenario: Purge
- **WHEN** a remembered number's last message is 91 days old and the daily cron runs
- **THEN** the row is gone, and its next message is answered once again

### Requirement: The web shows the channel's state
The web SHALL show, in the onboarding's closing step and in the account sheet, one of three states for WhatsApp: *sin vincular* (no channel, no live code), *esperando tu mensaje* (a live code, no channel) and *vinculado* with the linked number (a channel exists). The state SHALL be read from the account's own channel through an operation that returns only the identifier, never the channel's pending question or last load. The web SHALL re-read the state when the page regains focus after "Vincular WhatsApp" was activated, so a link made in the chat appears without a manual reload.

#### Scenario: Waiting
- **WHEN** the person activated "Vincular WhatsApp" and no channel exists yet
- **THEN** the screen reads "Esperando tu mensaje" with the code still shown

#### Scenario: Linked after returning
- **WHEN** the person sent the message, the chat replied "Listo", and the browser tab regains focus
- **THEN** the screen reads "Vinculado" with the linked number, and the "Vincular WhatsApp" action is gone

#### Scenario: Channel columns stay private
- **WHEN** a signed-in user reads the channels table with the public key
- **THEN** no row is returned, while the state operation returns their own identifier

### Requirement: The typed number is optional, converted by the account's country, and never links
The phone field, wherever it is shown, SHALL be a country choice (the flag and the dialling prefix of each country in the countries table, the account's country preselected) and a local number. Saving SHALL store the number in E.164 as the chosen country's rules convert it: a trunk zero SHALL be dropped, and an Argentine mobile SHALL get the `9` after the country code. A number that is not valid for the chosen country SHALL be refused with a message. Saving the number SHALL NOT create a channel, SHALL NOT create a code and SHALL NOT change the request time. The screen SHALL say in one line what the number is for while the test number is in use: the bot reaches few people, because Meta limits who the test number can write to. A number already stored by another account SHALL be refused with a message.

#### Scenario: Argentine mobile
- **WHEN** Argentina is chosen and "11 5555 1234" is saved
- **THEN** the stored phone is `+5491155551234`

#### Scenario: Irish trunk zero
- **WHEN** Ireland is chosen and "085 152 8917" is saved
- **THEN** the stored phone is `+353851528917`

#### Scenario: Invalid for the country
- **WHEN** Ireland is chosen and "12" is saved
- **THEN** a message says to check the number, and nothing is stored

#### Scenario: Taken
- **WHEN** another account stores the same E.164 number
- **THEN** a message says the number belongs to another account, and nothing is stored

#### Scenario: Saving changes nothing else
- **WHEN** a number is saved on an account with a live code
- **THEN** the code and the request time are unchanged and no channel exists
