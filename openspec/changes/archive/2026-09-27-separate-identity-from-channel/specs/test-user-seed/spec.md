## MODIFIED Requirements

### Requirement: The account is linked the way RLS expects
The script SHALL link the `usuarios` row to the auth user through `usuarios.auth_user_id`, which is what the policies resolve through, and SHALL set the user's e-mail to the placeholder. It SHALL find an existing row for that auth user through `auth_user_id`, not through the phone. The `usuarios` row SHALL have no phone and the script SHALL NOT create any messaging channel for it; timezone Europe/Dublin, currency EUR, Spanish, cycle start day 26, onboarding complete and a monthly savings goal of 300. After logging in, the user SHALL see the seeded rows and nothing else.

#### Scenario: Login sees the seed
- **WHEN** the script has run and the user logs in with the placeholder e-mail
- **THEN** `/dashboard` shows the seeded categories, charges, income and savings, and the account menu shows the seeded name and no phone

#### Scenario: Another user sees nothing of it
- **WHEN** a different linked user logs in
- **THEN** none of the seeded rows appears in their dashboard

#### Scenario: No channel for the test user
- **WHEN** the script has run
- **THEN** the test user has no phone and no row in the channel table
