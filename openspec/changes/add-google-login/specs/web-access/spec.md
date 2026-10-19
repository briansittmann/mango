## ADDED Requirements

### Requirement: Sign-in with Google
`/login` SHALL open on a choice between two ways in, under the title and the logo: "Continuar con Google" ("Continue with Google" in English), then a divider that reads "o" ("or"), then "Continuar con email" ("Continue with email") with an envelope icon, in the primary colour of "Enviar código". The same Google action SHALL serve to sign in and to create an account, like the code. The Google button SHALL follow Google's dark button on the card's own surface: the fill of the card it sits on (so it never reads as a block), a 1px border `#8E918F`, text `#E3E3E3`, and Google's "G" in its four standard colours, never recoloured; `/login` is always on the dark theme, so the button is always this variant. It SHALL sit with clear room below the logo, and the title SHALL keep a matching room above it. Both buttons SHALL have the e-mail step's control height, a visible focus ring and a pressed state, and their texts SHALL come from the translation files.

"Continuar con email" SHALL replace the two ways with the e-mail step (see *Sign-in by e-mail code*) and move the focus to the e-mail field. A "Volver" ("Back") control at the top left SHALL go back one level: from the e-mail step to the two ways, with the focus on "Continuar con Google"; from the two ways to Home. The pieces that go SHALL leave (softening, dropping a little and fading, in order) before the new ones rise in, and the card SHALL resize smoothly between the two heights. While Google prepares its redirect, the divider and "Continuar con email" SHALL leave the same way, and SHALL come back if the sign-in does not go through. With reduced motion every change SHALL be immediate, with nothing leaving or rising.

Activating it SHALL send the person to Google's account choice and consent, carrying the page's active language and the browser's timezone so they reach a newly created account. While the redirect is being prepared the button SHALL show it is busy and SHALL ignore further activations. Accepting at Google SHALL return the person to Mango signed in, landing where a valid code lands. Cancelling at Google, or any failure of the provider or of the return, SHALL open no session and SHALL return to the two ways of `/login` with a message saying the sign-in with Google did not work, distinct from the invalid-link message. When the redirect cannot be prepared, the two ways SHALL stay with that same message.

An address SHALL have one account whichever way it signs in: signing in with Google with the address of an existing account SHALL open that account's session, with its data, and SHALL create no `usuarios` row and change none of its columns; signing in with the code after a first sign-in with Google SHALL open the same account.

#### Scenario: Two ways in
- **WHEN** `/login` is opened without a session
- **THEN** "Continuar con Google" is shown with Google's four-colour "G", the card's fill, border `#8E918F` and text `#E3E3E3`, an "o" divider below it, "Continuar con email" below that, and no e-mail field

#### Scenario: Buttons in English
- **WHEN** the active language is English and `/login` is opened
- **THEN** the buttons read "Continue with Google" and "Continue with email", the divider reads "or", and the back control is named "Back"

#### Scenario: Continue with email
- **WHEN** "Continuar con email" is activated
- **THEN** the two ways leave, the e-mail field, the first-time line and "Enviar código" are shown, and the field has the focus

#### Scenario: Back to the two ways
- **WHEN** "Volver" is activated on the e-mail step
- **THEN** the two ways are shown again with the focus on "Continuar con Google", and the URL stays `/login`

#### Scenario: Back to Home
- **WHEN** "Volver" is activated on the two ways
- **THEN** the visitor lands on `/`

#### Scenario: The way not taken leaves
- **WHEN** "Continuar con Google" is activated and the redirect is not ready yet
- **THEN** the divider and "Continuar con email" fade out while the button folds into its spinner, and they come back if preparing the redirect fails

#### Scenario: Reduced motion
- **WHEN** reduced motion is requested and the visitor switches between the two ways and the e-mail step, or activates Google
- **THEN** every change is immediate and nothing fades out

#### Scenario: Language and timezone travel with the request
- **WHEN** the visitor, with English active and the browser in `Europe/Madrid`, activates "Continuar con Google"
- **THEN** the request that prepares the redirect carries `en` and `Europe/Madrid`, and the browser goes to the provider's URL it returns

#### Scenario: Busy while preparing
- **WHEN** the visitor activates the button and the redirect is not ready yet
- **THEN** the button shows it is busy and a second activation sends no second request

#### Scenario: New person with Google
- **WHEN** a person whose address has no account accepts at Google
- **THEN** they land signed in where a valid code lands, and their account exists (see *Account created on first confirmed sign-in*)

#### Scenario: Existing account with Google
- **WHEN** the owner of an existing account signs in with Google with the same address
- **THEN** `/dashboard` shows their own data, no `usuarios` row is created and no column of theirs changes

#### Scenario: Cancelled at Google
- **WHEN** the person cancels on Google's consent screen
- **THEN** they are back on the two ways of `/login` with no session and the message that the sign-in with Google did not work

#### Scenario: Redirect could not be prepared
- **WHEN** the request that prepares the redirect fails
- **THEN** the two ways stay, the button is active again, and the message that the sign-in with Google did not work is shown

## MODIFIED Requirements

### Requirement: Sign-in by e-mail code
`/login` SHALL be two steps on one page, and the same page SHALL serve to sign in and to create an account. The **e-mail step** SHALL be reached with "Continuar con email" from the two ways of *Sign-in with Google*, and SHALL show an e-mail field, a submit action, and one line saying that a first-time address gets its account created. Submitting a well-formed e-mail SHALL request a 6-digit one-time code for that address; when the address has no account, the request SHALL create one, so the code reaches the address and verifies like any other. The request SHALL carry the page's active language and the browser's timezone; they SHALL be stored with a newly created account and SHALL NOT change an existing one. After a successful request the page SHALL move to the **code step** for that address, whether or not the address had an account, so the page never tells which e-mails have one. A malformed e-mail SHALL be refused by the field without any request. When the request itself fails, the e-mail step SHALL stay with a message stating the code could not be sent.

While new accounts are switched off in the auth provider, an unknown address SHALL get the same code step and no account SHALL be created, as before registration opened.

The code step SHALL show the address the code was sent to, the six cells of *Code entry*, and a "Cambiar mail" action that returns to the e-mail step itself, not to the two ways. The code step SHALL be addressable: opening `/login` with the address as a query parameter SHALL show the code step for that address without sending a code, so a reload keeps the step.

#### Scenario: Code requested
- **WHEN** the visitor submits the e-mail of a registered account
- **THEN** a one-time code is e-mailed to that address, and the page shows the code step with that address

#### Scenario: Unregistered address
- **WHEN** the visitor submits an e-mail that no account uses
- **THEN** an account is created for that address, a one-time code is e-mailed to it, and the page shows the same code step as for a registered address

#### Scenario: First-time hint
- **WHEN** "Continuar con email" is activated on `/login` without a session
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
- **THEN** the e-mail step is shown directly, its field is empty or holds the previous address, and the URL no longer carries the address

### Requirement: A token in the confirm route opens a session
`/auth/confirm` SHALL keep accepting a token hash with its type, and a code to exchange. A valid, unexpired, unused token SHALL open a session for that user and redirect to `/dashboard`. An invalid, expired or already-used token SHALL open no session and SHALL redirect to `/login` with a message stating the link is invalid or expired. No sign-in e-mail sent by the application points to this route any more: it serves the one-time link the WhatsApp bot sends at the end of its onboarding and the return from Google.

The return from Google SHALL be told apart from a link: when it brings an error from the provider, or its code cannot be exchanged, `/login` SHALL show the message of *Sign-in with Google*, not the invalid-link one. When the return from Google opens the session of an account whose onboarding has not started, the language and timezone that travelled with the request SHALL be stored on that account (the timezone only when it is a valid IANA name); an account whose onboarding has started SHALL keep its own. They SHALL be used once: a later sign-in SHALL NOT apply them again.

#### Scenario: Valid token
- **WHEN** a valid token hash and type are opened on `/auth/confirm` within the validity window
- **THEN** the user lands on `/dashboard` signed in

#### Scenario: Invalid token
- **WHEN** an expired, used or malformed token is opened on `/auth/confirm`
- **THEN** the user lands on `/login` with the "invalid or expired link" message and no session

#### Scenario: Provider error on the return
- **WHEN** `/auth/confirm` is opened with the error the provider sends after a cancelled consent
- **THEN** the user lands on `/login` with the message that the sign-in with Google did not work and no session

#### Scenario: New account takes the request's language and timezone
- **WHEN** a person with no account starts the Google sign-in from a page in English with the browser in `America/Argentina/Buenos_Aires`, and accepts
- **THEN** their new account's language is `en` and its timezone `America/Argentina/Buenos_Aires`

#### Scenario: Started account keeps its own
- **WHEN** the owner of an account past the onboarding's first step signs in with Google from a page in English
- **THEN** the account's language and timezone do not change

### Requirement: Account created on first confirmed sign-in
When an auth user's e-mail becomes confirmed for the first time — a new address typing its first valid code — or an auth user is created already confirmed — a new person accepting at Google — a `usuarios` row linked to that auth user SHALL exist before the session is used. The row SHALL carry the address, a name, the language stored with the account (`es` or `en`, Spanish when missing or unsupported), the timezone stored with the account (a valid IANA name, `UTC` when missing or unknown), currency `EUR`, billing cycle starting on day 1, onboarding not completed and on its first step, the complete amount format, and no country. The name SHALL be the full name the sign-in provider gives, trimmed, when there is a non-empty one, and otherwise the part of the address before `@`. An address that asked for a code and never confirmed it SHALL NOT get a row.

Creating the row SHALL NOT make the sign-in fail: if the row cannot be created, the person still signs in and sees *Unlinked account*. No existing `usuarios` row SHALL be modified: an auth user that already has a row, or whose address is already held by another row, gets no new row. An auth user whose e-mail was already confirmed before this requirement existed SHALL NOT get a new row or a changed one.

A new account's first visit to `/dashboard` SHALL lead to the onboarding (`onboarding` capability), and the dashboard SHALL render only once the onboarding is complete, with whatever the onboarding stored.

#### Scenario: First code of a new address
- **WHEN** a person registers with "ana@mail.com" from a page in English with the browser in `America/Argentina/Buenos_Aires`, and types the valid code
- **THEN** a `usuarios` row exists linked to that auth user, with e-mail "ana@mail.com", name "ana", language `en`, timezone `America/Argentina/Buenos_Aires`, currency `EUR`, cycle start 1, onboarding not completed on step 1 and the complete amount format

#### Scenario: First sign-in with Google
- **WHEN** a person whose Google account is "Ana Pérez" with "ana@gmail.com", and who has no Mango account, accepts at Google
- **THEN** a `usuarios` row exists linked to that auth user, with e-mail "ana@gmail.com", name "Ana Pérez", currency `EUR`, cycle start 1 and onboarding not completed on step 1

#### Scenario: Provider without a name
- **WHEN** the provider gives no full name, or an empty one, for "ana@gmail.com"
- **THEN** the new row's name is "ana"

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
