## MODIFIED Requirements

### Requirement: Closing step stores a WhatsApp request and sends nothing
The last step SHALL explain in one or two lines that loading by WhatsApp is optional. It SHALL show a phone field and no other field: there is no invitation code and no configuration that adds one. "Vincular" SHALL be enabled when the phone is a valid international number; a number typed without a country prefix SHALL take the account's country's prefix. Activating it SHALL store the number as the account's phone and the time of the request, and SHALL complete the onboarding. A number already stored by another account SHALL be refused with a message and the step SHALL stay. "Seguir sin WhatsApp" SHALL complete the onboarding storing no phone.

No WhatsApp message SHALL be sent by this step: the sending is a documented stub until the linking message exists. The screen's confirmation SHALL say the number was saved and that Mango will write, and SHALL NOT say a message was sent. No channel SHALL be created. Completing the onboarding, by either action, SHALL mark the account as onboarded and lead to `/dashboard`, which from then on SHALL render instead of redirecting.

#### Scenario: Link
- **WHEN** the person types "11 5555 1234" with Argentina as the country and activates "Vincular"
- **THEN** the account stores phone `+541155551234` and the request time, the onboarding is complete, no message is sent, no channel exists, and `/dashboard` renders

#### Scenario: No code field
- **WHEN** the closing step is shown, in any environment
- **THEN** the only field is the phone, the explanation does not mention an invitation, and "Vincular" needs only a valid phone

#### Scenario: Continue without WhatsApp
- **WHEN** the person activates "Seguir sin WhatsApp"
- **THEN** the onboarding is complete, the account has no phone, and `/dashboard` renders

#### Scenario: Phone taken
- **WHEN** another account already holds the typed number
- **THEN** a message says the number belongs to another account, the step stays, and the onboarding is not complete

#### Scenario: Malformed phone
- **WHEN** the person types "abc" as the phone
- **THEN** "Vincular" stays disabled and nothing is stored
