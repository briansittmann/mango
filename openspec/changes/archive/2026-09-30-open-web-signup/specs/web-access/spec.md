## MODIFIED Requirements

### Requirement: Home offers the demo and the login
The application SHALL serve `/` without a session. The page SHALL show exactly two actions: "Demo", leading to `/demo`, and "Entrar", leading to `/login`. Under the two actions it SHALL show one line of text that says what Mango is and that the WhatsApp bot is by invitation. It SHALL show nothing that depends on a session, SHALL NOT redirect a signed-in visitor, and SHALL make no request to a Supabase host. Its texts SHALL come from the translation files.

#### Scenario: Two actions
- **WHEN** an unauthenticated visitor opens `/`
- **THEN** the page shows "Demo" and "Entrar", "Demo" navigates to `/demo`, "Entrar" navigates to `/login`, and no request to a Supabase host is made

#### Scenario: What Mango is
- **WHEN** an unauthenticated visitor opens `/`
- **THEN** below the two actions, one line says what Mango is and that the WhatsApp bot is by invitation

#### Scenario: Home in English
- **WHEN** the active language is English and `/` is opened
- **THEN** the actions read "Demo" and "Log in", and the line is in English

#### Scenario: Signed-in visitor on Home
- **WHEN** a signed-in user opens `/`
- **THEN** the same two actions and the same line are shown and no redirect happens

### Requirement: Sign-in by e-mail code
`/login` SHALL be two steps on one page, and the same page SHALL serve to sign in and to create an account. The **e-mail step** SHALL show an e-mail field, a submit action, and one line saying that a first-time address gets its account created. Submitting a well-formed e-mail SHALL request a 6-digit one-time code for that address; when the address has no account, the request SHALL create one, so the code reaches the address and verifies like any other. The request SHALL carry the page's active language and the browser's timezone; they SHALL be stored with a newly created account and SHALL NOT change an existing one. After a successful request the page SHALL move to the **code step** for that address, whether or not the address had an account, so the page never tells which e-mails have one. A malformed e-mail SHALL be refused by the field without any request. When the request itself fails, the e-mail step SHALL stay with a message stating the code could not be sent.

While new accounts are switched off in the auth provider, an unknown address SHALL get the same code step and no account SHALL be created, as before registration opened.

The code step SHALL show the address the code was sent to, the six cells of *Code entry*, and a "Cambiar mail" action that returns to the e-mail step. The code step SHALL be addressable: opening `/login` with the address as a query parameter SHALL show the code step for that address without sending a code, so a reload keeps the step.

#### Scenario: Code requested
- **WHEN** the visitor submits the e-mail of a registered account
- **THEN** a one-time code is e-mailed to that address, and the page shows the code step with that address

#### Scenario: Unregistered address
- **WHEN** the visitor submits an e-mail that no account uses
- **THEN** an account is created for that address, a one-time code is e-mailed to it, and the page shows the same code step as for a registered address

#### Scenario: First-time hint
- **WHEN** `/login` is opened without a session
- **THEN** the e-mail step shows a line saying that a first-time address gets its account created, from the translation files in the active language

#### Scenario: Language and timezone travel with the request
- **WHEN** the visitor, with English active and the browser in `Europe/Madrid`, submits an e-mail
- **THEN** the request to send the code carries the address, `en` and `Europe/Madrid`

#### Scenario: New accounts switched off
- **WHEN** new accounts are off in the auth provider and the visitor submits an e-mail that no account uses
- **THEN** no account is created, no code can be verified, and the page shows the same code step

#### Scenario: Provider error
- **WHEN** the request to send the code is refused (rate limit, network)
- **THEN** the e-mail step stays visible with a message stating the code could not be sent

#### Scenario: Malformed e-mail
- **WHEN** the visitor submits "brian" as the e-mail
- **THEN** the field reports it as invalid and no request is sent

#### Scenario: Code step by URL
- **WHEN** `/login?email=tu%40mail.com` is opened without a session
- **THEN** the code step is shown for "tu@mail.com", the cells are empty, and no request to send a code is made

#### Scenario: Change the address
- **WHEN** "Cambiar mail" is activated on the code step
- **THEN** the e-mail step is shown, its field is empty or holds the previous address, and the URL no longer carries the address

### Requirement: Unlinked account
When the session's auth user has no `usuarios` row linked to it, `/dashboard` SHALL show a message saying the account is not linked yet and a log-out action. It SHALL show no figure, no row and no operation, and SHALL make no data query on that user's behalf. A person who registers through `/login` SHALL NOT reach this state: it remains only for an auth user whose row could not be created (see *Account created on first confirmed sign-in*).

#### Scenario: Auth user without a usuarios row
- **WHEN** a user created in the auth system but not linked to any `usuarios` row signs in and opens `/dashboard`
- **THEN** the "account not linked" message and a log-out action are shown, and no dashboard figure is rendered

#### Scenario: A new registration is never unlinked
- **WHEN** a person registers with a new address on `/login`, types the code and opens `/dashboard`
- **THEN** the dashboard renders, and the "account not linked" message is not shown

## ADDED Requirements

### Requirement: Account created on first confirmed sign-in
When an auth user's e-mail becomes confirmed for the first time — a new address typing its first valid code — or an auth user is created already confirmed, a `usuarios` row linked to that auth user SHALL exist before the session is used. The row SHALL carry the address, a name taken from the part of the address before `@`, the language stored with the account (`es` or `en`, Spanish when missing or unsupported), the timezone stored with the account (a valid IANA name, `UTC` when missing or unknown), currency `EUR`, billing cycle starting on day 1, onboarding not completed, and no country. An address that asked for a code and never confirmed it SHALL NOT get a row.

Creating the row SHALL NOT make the sign-in fail: if the row cannot be created, the person still signs in and sees *Unlinked account*. No existing `usuarios` row SHALL be modified: an auth user that already has a row, or whose address is already held by another row, gets no new row. An auth user whose e-mail was already confirmed before this requirement existed SHALL NOT get a new row or a changed one.

A new account's first visit to `/dashboard` SHALL render the dashboard of the cycle in progress, empty: no category, no row, no figure other than zero, and the actions to add categories, income and expenses available.

#### Scenario: First code of a new address
- **WHEN** a person registers with "ana@mail.com" from a page in English with the browser in `America/Argentina/Buenos_Aires`, and types the valid code
- **THEN** a `usuarios` row exists linked to that auth user, with e-mail "ana@mail.com", name "ana", language `en`, timezone `America/Argentina/Buenos_Aires`, currency `EUR`, cycle start 1 and onboarding not completed

#### Scenario: Code never typed
- **WHEN** a person submits a new address on `/login` and never types the code
- **THEN** no `usuarios` row exists for that address

#### Scenario: Unknown timezone
- **WHEN** the stored timezone is missing or not a valid IANA name
- **THEN** the new row's timezone is `UTC` and the sign-in succeeds

#### Scenario: Existing account untouched
- **WHEN** the owner of an existing account (with its `usuarios` row) signs in with a code
- **THEN** no `usuarios` row is created and no column of their row changes

#### Scenario: Empty dashboard for a new account
- **WHEN** a new account opens `/dashboard` after its first code
- **THEN** the dashboard of the cycle in progress is shown with no category and no row, the totals read zero, and "Añadir categoría" is available

### Requirement: Branded sign-in e-mail in the user's language
Every e-mail that carries a sign-in code — the first code of a new address and every later one — SHALL have the same design: Mango's logo, the `design-system` colours and typeface (with a system fallback where the mail client does not load it), and the code as a standalone number of six digits, next to the word for "code", with no link to click. Its subject and text SHALL be in the account's stored language, Spanish or English, and in Spanish when none is stored. It SHALL say how long the code lasts and that the mail can be ignored if the person did not ask for it.

The stored language SHALL be the one active when the account was created, and SHALL follow the user's choice when they switch the language in the account menu while signed in. Switching the language without a session SHALL change no account.

#### Scenario: New address in English
- **WHEN** a visitor with English active submits a new address
- **THEN** the mail with the code arrives with an English subject and text, the logo, and the six digits as a standalone number

#### Scenario: Account without a stored language
- **WHEN** an account created before this requirement (no language stored) requests a code
- **THEN** the mail arrives in Spanish with the same design

#### Scenario: Language switched while signed in
- **WHEN** a signed-in user switches to English in the account menu, signs out, and requests a code
- **THEN** the mail arrives in English

#### Scenario: No link in the mail
- **WHEN** any code mail is opened
- **THEN** it contains the code and no link that signs in
