## MODIFIED Requirements

### Requirement: Account avatar and menu
The top-right corner SHALL show a 36px circular avatar with the user's photo, or the initial of the user's name when there is no photo. The avatar SHALL NOT use the brand or green colours. Activating it SHALL open a bottom sheet containing the user's photo or initial, name and, when the account has one, phone number, a theme control, a language control, and a log-out action separated by a divider at the bottom. An account without a phone SHALL show no phone line and no empty space in its place. Menu rows SHALL be at least 48px tall and menu text at least 12px.

#### Scenario: User without photo
- **WHEN** the user named "Brian" has no photo
- **THEN** the avatar shows "B"

#### Scenario: Account details
- **WHEN** the account menu opens
- **THEN** it shows the user's name and phone number, and no e-mail address or plan badge

#### Scenario: Account without phone
- **WHEN** the account menu opens for an account with no phone
- **THEN** it shows the user's name, no phone line, and no e-mail address or plan badge
