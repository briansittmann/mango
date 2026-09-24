# web-access Specification

## Purpose

Defines how a person reaches the product on the web: the public routes, magic-link sign-in, the session that protects the real dashboard, the state of an account that is not linked yet, and sign-out.

## Requirements

### Requirement: Home offers the demo and the login
The application SHALL serve `/` without a session. The page SHALL show exactly two actions: "Demo", leading to `/demo`, and "Entrar", leading to `/login`. It SHALL show nothing that depends on a session, SHALL NOT redirect a signed-in visitor, and SHALL make no request to a Supabase host. Its texts SHALL come from the translation files.

#### Scenario: Two actions
- **WHEN** an unauthenticated visitor opens `/`
- **THEN** the page shows "Demo" and "Entrar", "Demo" navigates to `/demo`, "Entrar" navigates to `/login`, and no request to a Supabase host is made

#### Scenario: Home in English
- **WHEN** the active language is English and `/` is opened
- **THEN** the actions read "Demo" and "Log in"

#### Scenario: Signed-in visitor on Home
- **WHEN** a signed-in user opens `/`
- **THEN** the same two actions are shown and no redirect happens

### Requirement: Magic-link sign-in
`/login` SHALL show an e-mail field and a submit action, and nothing else is required. Submitting a well-formed e-mail SHALL request a magic link for that address and SHALL NOT create an account for an address that has none. After a successful request the page SHALL replace the form with a message saying that, if an account exists for that address, a link was sent to it. The message SHALL be the same whether or not the address is registered. A malformed e-mail SHALL be refused by the field without any request. When the request itself fails, the form SHALL stay and a message SHALL state that the link could not be sent.

#### Scenario: Link requested
- **WHEN** the visitor submits the e-mail of a registered account
- **THEN** a magic-link e-mail is sent to that address, and the page shows the "check your inbox" message

#### Scenario: Unregistered address
- **WHEN** the visitor submits an e-mail that no account uses
- **THEN** no account is created, and the page shows the same "check your inbox" message

#### Scenario: Provider error
- **WHEN** the request to send the link is refused (rate limit, network)
- **THEN** the form stays visible with a message stating the link could not be sent

#### Scenario: Malformed e-mail
- **WHEN** the visitor submits "brian" as the e-mail
- **THEN** the field reports it as invalid and no request is sent

### Requirement: The magic link opens a session
The e-mail's link SHALL lead to `/auth/confirm` carrying a token hash and its type. A valid, unexpired, unused token SHALL open a session for that user, stored so that later requests carry it, and SHALL redirect to `/dashboard`. An invalid, expired or already-used token SHALL open no session and SHALL redirect to `/login` with a message stating the link is invalid or expired.

#### Scenario: Valid link
- **WHEN** the user opens the link from the e-mail within its validity window
- **THEN** they land on `/dashboard` signed in, and reloading `/dashboard` keeps them signed in

#### Scenario: Expired or reused link
- **WHEN** the user opens a link that expired or was already used
- **THEN** they land on `/login` with the "invalid or expired link" message, and opening `/dashboard` redirects to `/login`

### Requirement: The dashboard requires a session
`/dashboard` SHALL redirect to `/login` when the request carries no valid session, before rendering any dashboard content. With a session it SHALL render the dashboard of the linked user. A signed-in visitor opening `/login` SHALL be redirected to `/dashboard`. `/demo` SHALL stay reachable with or without a session and SHALL render its sample data either way.

#### Scenario: No session
- **WHEN** an unauthenticated visitor opens `/dashboard`, or `/dashboard?mes=2026-08`
- **THEN** they are redirected to `/login` and no dashboard figure or row is rendered

#### Scenario: Signed-in visitor on login
- **WHEN** a signed-in user opens `/login`
- **THEN** they are redirected to `/dashboard`

#### Scenario: Demo with a session
- **WHEN** a signed-in user opens `/demo`
- **THEN** the demo renders its sample data and its "sample data" notice, as for any visitor

### Requirement: Unlinked account
When the session's auth user has no `usuarios` row linked to it, `/dashboard` SHALL show a message saying the account is not linked yet and a log-out action. It SHALL show no figure, no row and no operation, and SHALL make no data query on that user's behalf.

#### Scenario: Auth user without a usuarios row
- **WHEN** a user created in the auth system but not linked to any `usuarios` row signs in and opens `/dashboard`
- **THEN** the "account not linked" message and a log-out action are shown, and no dashboard figure is rendered

### Requirement: Session persistence and sign-out
A session SHALL survive page reloads and the expiry of its access token while its refresh token is valid: the refresh SHALL happen without the user's involvement. "Cerrar sesión" in the account menu SHALL be enabled on `/dashboard`, SHALL end the session, and SHALL lead to `/`.

#### Scenario: Log out
- **WHEN** the user activates "Cerrar sesión" in the account menu
- **THEN** they land on `/`, and opening `/dashboard` afterwards redirects to `/login`

#### Scenario: Expired access token
- **WHEN** a signed-in user returns after the access token expired but the refresh token is still valid
- **THEN** `/dashboard` renders their data without asking them to log in again
