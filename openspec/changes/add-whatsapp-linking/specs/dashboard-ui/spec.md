## MODIFIED Requirements

### Requirement: Account avatar and menu
The top-right corner SHALL show a 36px circular avatar with the user's photo, or the initial of the user's name when there is no photo. The avatar SHALL NOT use the brand or green colours. Activating it SHALL open a bottom sheet containing the user's photo or initial, name and, when the account has one, phone number, a "Cuenta" row, a theme control, a language control, and a log-out action separated by a divider at the bottom. An account without a phone SHALL show no phone line and no empty space in its place. Menu rows SHALL be at least 48px tall and menu text at least 12px.

The "Cuenta" row SHALL be enabled only when the mounting page supplies profile operations, and disabled otherwise (*Controls without a handler are disabled*). Activating it SHALL open the account sheet: the name, the country (the same list and names as the onboarding), the currency, the amount format control when the country is Argentina, and the cycle start day as a read-only line, with "Guardar" and "Cancelar". Saving SHALL store the name, country, currency, the timezone the country derives, and the format — the abbreviated format only for Argentina — through the profile operations, with the same validation as the onboarding's basics step, and every amount on the page SHALL then follow the new currency and format. When the account holds movements, one line under the currency SHALL say that movements already loaded keep their currency and are summed without conversion. The sheet SHALL NOT change the cycle day.

Below the basics the sheet SHALL show a "WhatsApp" section with the channel's state (`whatsapp-linking` → *The web shows the channel's state*): *sin vincular* with "Vincular WhatsApp"; *esperando tu mensaje* with the code, "Vincular WhatsApp" again and the line that the chat replies "Listo" when the message arrives; *vinculado* with the linked number and no action. Under the state, the phone field with its country choice (`whatsapp-linking` → *The typed number is optional…*) and the line that says what it is for while the test number is in use; the number is saved with "Guardar" together with the basics. "Vincular WhatsApp" SHALL act at once, without "Guardar", and SHALL keep the sheet open. The sheet SHALL re-read the state when the page regains focus. On the demo the section SHALL show the *sin vincular* state with a disabled "Vincular WhatsApp".

#### Scenario: User without photo
- **WHEN** the user named "Brian" has no photo
- **THEN** the avatar shows "B"

#### Scenario: Account details
- **WHEN** the account menu opens
- **THEN** it shows the user's name and phone number, and no e-mail address or plan badge

#### Scenario: Account without phone
- **WHEN** the account menu opens for an account with no phone
- **THEN** it shows the user's name, no phone line, and no e-mail address or plan badge

#### Scenario: Cuenta on the demo
- **WHEN** the account menu opens on `/demo`
- **THEN** the "Cuenta" row is present and exposed as disabled, and activating it opens nothing

#### Scenario: Cuenta sheet saves the format
- **WHEN** on `/dashboard` an account in Argentina opens "Cuenta", selects the abbreviated format and saves
- **THEN** after the page refreshes the free margin and every row amount are shown abbreviated, and the amount fields of the sheets still take full numbers

#### Scenario: Currency change warns about mixed sums
- **WHEN** an account with movements opens "Cuenta"
- **THEN** a line under the currency says that loaded movements keep their currency and are summed without conversion, and the cycle day is shown as text with no field

#### Scenario: WhatsApp not linked
- **WHEN** an account with no channel and no live code opens "Cuenta"
- **THEN** the WhatsApp section reads "Sin vincular" and offers "Vincular WhatsApp"

#### Scenario: Vincular from the sheet
- **WHEN** the person activates "Vincular WhatsApp" in the sheet
- **THEN** the chat opens with "vincular" and the code, the sheet stays open and reads "Esperando tu mensaje" with the code

#### Scenario: WhatsApp linked
- **WHEN** an account whose channel is `+5491155551234` opens "Cuenta"
- **THEN** the section reads "Vinculado" with "+54 9 11 5555-1234" and offers no "Vincular WhatsApp"

#### Scenario: Number saved with the basics
- **WHEN** the person chooses Ireland, types "085 152 8917" and saves
- **THEN** the account's phone is `+353851528917`, and the menu shows it
