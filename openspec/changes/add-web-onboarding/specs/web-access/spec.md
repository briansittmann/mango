## MODIFIED Requirements

### Requirement: The dashboard requires a session
`/dashboard` SHALL redirect to `/login` when the request carries no valid session, before rendering any dashboard content. With a session it SHALL render the dashboard of the linked user when that user's onboarding is complete, and SHALL redirect to `/onboarding` while it is not, before rendering any dashboard content. `/onboarding` SHALL redirect to `/login` without a valid session, and with one SHALL render the onboarding while it is not complete and redirect to `/dashboard` once it is. The session refresh SHALL cover `/onboarding` as it covers `/dashboard`. A signed-in visitor opening `/login` SHALL be redirected to `/dashboard`. `/demo` and `/demo/onboarding` SHALL stay reachable with or without a session and SHALL render their sample either way.

#### Scenario: No session
- **WHEN** an unauthenticated visitor opens `/dashboard`, or `/dashboard?mes=2026-08`, or `/onboarding`
- **THEN** they are redirected to `/login` and no dashboard or onboarding content is rendered

#### Scenario: Onboarding not complete
- **WHEN** a signed-in user whose onboarding is not complete opens `/dashboard`
- **THEN** they are redirected to `/onboarding` and no dashboard figure or row is rendered

#### Scenario: Onboarding complete
- **WHEN** a signed-in user whose onboarding is complete opens `/onboarding`
- **THEN** they are redirected to `/dashboard`

#### Scenario: Signed-in visitor on login
- **WHEN** a signed-in user opens `/login`
- **THEN** they are redirected to `/dashboard`

#### Scenario: Demo with a session
- **WHEN** a signed-in user opens `/demo`
- **THEN** the demo renders its sample data and its "sample data" notice, as for any visitor

### Requirement: Account created on first confirmed sign-in
When an auth user's e-mail becomes confirmed for the first time — a new address typing its first valid code — or an auth user is created already confirmed, a `usuarios` row linked to that auth user SHALL exist before the session is used. The row SHALL carry the address, a name taken from the part of the address before `@`, the language stored with the account (`es` or `en`, Spanish when missing or unsupported), the timezone stored with the account (a valid IANA name, `UTC` when missing or unknown), currency `EUR`, billing cycle starting on day 1, onboarding not completed and on its first step, the complete amount format, and no country. An address that asked for a code and never confirmed it SHALL NOT get a row.

Creating the row SHALL NOT make the sign-in fail: if the row cannot be created, the person still signs in and sees *Unlinked account*. No existing `usuarios` row SHALL be modified: an auth user that already has a row, or whose address is already held by another row, gets no new row. An auth user whose e-mail was already confirmed before this requirement existed SHALL NOT get a new row or a changed one.

A new account's first visit to `/dashboard` SHALL lead to the onboarding (`onboarding` capability), and the dashboard SHALL render only once the onboarding is complete, with whatever the onboarding stored.

#### Scenario: First code of a new address
- **WHEN** a person registers with "ana@mail.com" from a page in English with the browser in `America/Argentina/Buenos_Aires`, and types the valid code
- **THEN** a `usuarios` row exists linked to that auth user, with e-mail "ana@mail.com", name "ana", language `en`, timezone `America/Argentina/Buenos_Aires`, currency `EUR`, cycle start 1, onboarding not completed on step 1 and the complete amount format

#### Scenario: Code never typed
- **WHEN** a person submits a new address on `/login` and never types the code
- **THEN** no `usuarios` row exists for that address

#### Scenario: Unknown timezone
- **WHEN** the stored timezone is missing or not a valid IANA name
- **THEN** the new row's timezone is `UTC` and the sign-in succeeds

#### Scenario: Existing account untouched
- **WHEN** the owner of an existing account (with its `usuarios` row) signs in with a code
- **THEN** no `usuarios` row is created and no column of their row changes

#### Scenario: First visit goes to the onboarding
- **WHEN** a new account activates "Ir a mi mes" after its first code
- **THEN** the onboarding's welcome step is shown, and `/dashboard` renders no figure until the onboarding is complete

#### Scenario: Empty dashboard for a new account
- **WHEN** a new account completes the onboarding with nothing entered beyond the basics and opens `/dashboard`
- **THEN** the dashboard of the cycle in progress is shown with no category and no row, the totals read zero in the chosen currency, and "Añadir categoría" is available
