## MODIFIED Requirements

### Requirement: Theme selection
The account menu SHALL offer light, dark and automatic themes, and the onboarding SHALL offer the same three choices in a floating control on every one of its steps (`onboarding` → *A floating theme control on every step*). Dark SHALL be the default for a browser with no stored choice, except on the onboarding: entering the onboarding with no stored choice SHALL select automatic, paint the page in the operating-system preference from the first frame, and store that choice, so the dashboard afterwards follows the operating system in that browser. Automatic SHALL follow the operating-system preference, including changes made while the page is open. The choice SHALL persist in the browser across reloads, and a choice made in either place SHALL be the one the other shows.

#### Scenario: Choose light on a dark OS
- **WHEN** the operating system prefers dark and the user selects light, then reloads
- **THEN** the page is light after the reload

#### Scenario: Automatic follows the OS
- **WHEN** the theme is automatic and the operating-system preference changes from light to dark
- **THEN** the page switches to dark without a reload

#### Scenario: No choice on the demo
- **WHEN** a browser with no stored choice and an operating system preferring light opens `/demo`
- **THEN** the page is dark

#### Scenario: No choice on the onboarding
- **WHEN** the same browser opens `/onboarding`
- **THEN** the page is light from the first frame, automatic is selected, and the stored choice is automatic, so `/dashboard` is light afterwards

#### Scenario: One choice, two controls
- **WHEN** the user selects dark in the onboarding, completes it, and opens the account menu on `/dashboard`
- **THEN** dark is selected in the account menu
