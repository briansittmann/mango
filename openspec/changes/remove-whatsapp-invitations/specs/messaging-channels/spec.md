## MODIFIED Requirements

### Requirement: The bot logic does not know the channel's mechanics
The bot logic SHALL receive each message as:

- the account, the text, the message id and the channel type;
- the channel's pending question, when one is held and not expired;
- the channel's last load, when it remembers one;
- for a button press, the load that button undoes.

It SHALL NOT receive phone numbers or platform payloads for known senders. The logic SHALL return what to reply. When it asks a question, it SHALL return the question to hold. When it loads, deletes or undoes a movement, it SHALL return how the channel's last load changes. Storing, expiring and clearing the question, storing the last load, and choosing between text, buttons and reactions SHALL be the adapter's job. For an unknown sender it SHALL receive the channel type, the external identifier and the text, and nothing about invitations: an unknown number cannot create an account from the chat, and no configuration decides otherwise.

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
- **THEN** the logic receives the channel `whatsapp`, the number and the text, no account is created, and no channel is linked

### Requirement: Nothing depends on the test number's limits
No code SHALL cap the number of WhatsApp recipients, count messages against a monthly quota, or hard-code the sending number. The sending number SHALL come from `WHATSAPP_PHONE_NUMBER_ID`. Moving to an owned number SHALL require only new credentials. Which numbers can receive messages while the test number is in use SHALL be Meta's recipient list, kept in Meta's panel, not anything in Mango.

#### Scenario: Sixth account
- **WHEN** a sixth account is linked to a WhatsApp channel
- **THEN** nothing in Mango rejects it; only Meta's own limit applies while the test number is in use

#### Scenario: Changing the number
- **WHEN** `WHATSAPP_PHONE_NUMBER_ID` changes and the app is redeployed
- **THEN** the app uses the new number with no code change

## REMOVED Requirements

### Requirement: The WhatsApp invitation is a switch
**Reason**: The invitation no longer exists (decision of 2026-10-03, `ARCHITECTURE.md` §4): accounts are created only on the web and WhatsApp is linked from the account, so there is nothing for the switch to gate. `WHATSAPP_REQUIRE_INVITE` is removed from the code and from the deployment.
**Migration**: None for users. Remove the variable from Vercel; an unknown number is handled as *The bot logic does not know the channel's mechanics* → *Unknown sender* describes.
