# web-access Specification

## Purpose

Defines how a person reaches the product on the web: the public routes, sign-in and registration by e-mail code (the account created at the first confirmed code, the branded code mail), the session that protects the real dashboard, the state of an account that is not linked yet, and sign-out.

## Requirements

### Requirement: Home is the landing page
The application SHALL serve `/` without a session as the landing page. Its header SHALL show a language choice (ES/EN) and "Entrar", leading to `/login`. The hero and the closing section SHALL each offer "Empezar", leading to `/login`, and "Ver la demo", leading to `/demo`. Between them, a pinned scroll story SHALL show `/demo` inside a phone frame (`/demo?embed=1`, without the demo notice and without the animated background) while three WhatsApp messages and their bot replies appear beside it, each one adding its expense to the embedded dashboard so the free margin drops; with reduced motion the story is not pinned and shows its final state. The footer SHALL say what Mango is and that the WhatsApp bot is by invitation. The page SHALL show nothing that depends on a session, SHALL NOT redirect a signed-in visitor, and SHALL make no request to a Supabase host. Its texts SHALL come from the translation files. On the dark theme the dot field replaces the shell's diagonal streaks.

#### Scenario: Entry points
- **WHEN** an unauthenticated visitor opens `/`
- **THEN** "Entrar" and "Empezar" navigate to `/login`, "Ver la demo" navigates to `/demo`, and no request to a Supabase host is made

#### Scenario: What Mango is
- **WHEN** an unauthenticated visitor opens `/`
- **THEN** the footer says what Mango is and that the WhatsApp bot is by invitation

#### Scenario: Home in English
- **WHEN** the active language is English and `/` is opened
- **THEN** the header reads "Log in", the actions read "Get started" and "See the demo", and the footer line is in English

#### Scenario: The story lowers the margin
- **WHEN** the visitor scrolls through the phone story
- **THEN** each message's reply adds its expense to the embedded dashboard and its free margin goes from 864 € to 783,20 € after the third; scrolling back removes them in reverse

#### Scenario: Signed-in visitor on Home
- **WHEN** a signed-in user opens `/`
- **THEN** the same landing is shown and no redirect happens

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

### Requirement: Code entry
The code step SHALL hold exactly one real text input, invisible and laid over the row of cells, with numeric input mode, one-time-code autocompletion and a maximum length of six. Six visual cells SHALL display that input's value, one character each. Characters that are not digits SHALL be dropped. Pasting or autofilling six digits SHALL fill the six cells at once. The caret SHALL always sit at the end of the value, so a digit typed after a click in the middle of the row still lands in the next empty cell. Deleting SHALL empty the last filled cell.

While the input has focus and the code is incomplete, the next empty cell SHALL be the **active cell**: it SHALL show the active-field fill, halo, border and caret colour defined in `design-system` (*Active-field tokens*). No other cell SHALL be active at the same time.

When the sixth digit arrives, verification SHALL start on its own, with no submit action. While it runs, the input SHALL accept no more characters. On a pointer-first device the input SHALL NOT take focus automatically on load; elsewhere it SHALL.

#### Scenario: Typing fills the cells in order
- **WHEN** "4", "8" and "2" are typed on the code step
- **THEN** the first three cells read 4, 8 and 2, the fourth cell is the active one, and no verification request has been made

#### Scenario: Paste fills the row
- **WHEN** "48 29-13" is pasted into the row
- **THEN** the six cells read 4, 8, 2, 9, 1, 3 and verification starts

#### Scenario: The sixth digit submits
- **WHEN** the sixth digit is typed
- **THEN** exactly one verification request is made for that address and that code, and typing another digit changes nothing until the result arrives

#### Scenario: Delete
- **WHEN** four digits are typed and Backspace is pressed
- **THEN** the fourth cell is empty and active again, and the first three keep their digits

### Requirement: A valid code opens a session
A code that matches the latest one sent to the address, within its validity window and not used before, SHALL open a session for that user, stored so that later requests carry it, in the browser where the code was typed. The page SHALL then show "Listo, entraste" and an "Ir a mi mes" action that leads to `/dashboard`. That action SHALL NOT receive focus automatically. The address and the code SHALL NOT be sent anywhere but the verification request.

#### Scenario: Valid code
- **WHEN** the user types the code from the latest e-mail within its validity window
- **THEN** the success state is shown, "Ir a mi mes" leads to `/dashboard` signed in, and reloading `/dashboard` keeps them signed in

#### Scenario: Session lands where the code was typed
- **WHEN** the code was requested on the phone's browser and typed there, after reading it in the Mail app
- **THEN** the session is open in that browser, with no other tab or browser involved

### Requirement: A rejected code
A code that is wrong, expired or already used SHALL open no session. The cells SHALL return to their row, empty, and the input SHALL regain focus. A message SHALL state that the code is not the one that was sent and to check the latest e-mail or request a new one. When the provider refuses because of too many attempts, the message SHALL say so and ask to wait. When the verification request itself fails (network), the message SHALL state the code could not be checked. The message SHALL clear as soon as a new digit is typed. Every message SHALL come from the translation files in both languages.

#### Scenario: Wrong code
- **WHEN** a code that does not match is submitted
- **THEN** no session is opened, the six cells are empty, the input has focus, and the "not the code we sent" message is shown

#### Scenario: Expired or reused code
- **WHEN** a code that expired or was already used is submitted
- **THEN** the same outcome as a wrong code

#### Scenario: Too many attempts
- **WHEN** the provider refuses the verification for rate limiting
- **THEN** the cells are empty and the "too many attempts, wait" message is shown

#### Scenario: The message clears on the next digit
- **WHEN** the "not the code we sent" message is shown and a digit is typed
- **THEN** the message is gone and the first cell holds the digit

### Requirement: Resend with countdown
The code step SHALL show a "Reenviar" action, disabled for 60 seconds after the step is shown or a code is resent, with the remaining seconds visible. Once enabled, activating it SHALL request a new code for the same address, SHALL restart the countdown, and SHALL return focus to the input. The newest code is the one that verifies; an older one SHALL be treated as rejected. When the provider refuses the new code (rate limit), a message SHALL state that too many codes were requested and to wait.

#### Scenario: Countdown
- **WHEN** the code step is shown
- **THEN** "Reenviar" is disabled and shows the remaining seconds, and after 60 seconds it is enabled and reads "Reenviar código"

#### Scenario: Resend
- **WHEN** "Reenviar código" is activated
- **THEN** a new code is requested for the same address, the countdown restarts at 60 seconds, and the input has focus

### Requirement: Motion of the code step
Without the reduced-motion request:
- on every digit, the digit SHALL appear with a pop and a light in the ring colour SHALL travel once around the cell's frame, bright head and dim tail, in about 0.75 s, and go out
- when verification starts, the cells SHALL open from the row into a hexagon on a dotted ring, spin about 420° with acceleration and a hard stop while the request runs, and settle upright on the hexagon
- on success, the cells SHALL turn to the brand colour with a glow, pulse, and implode to the centre; the check square SHALL appear; two frames SHALL expand, retract and hit it; at the impact the square SHALL squash, bounce and settle at 1.65× its size, with expanding fading silhouettes, a burst of particles and about a dozen remains that float for 3–4 s and vanish; "Listo, entraste" and "Ir a mi mes" SHALL enter; "Ir a mi mes" SHALL pulse once and then every 6 s until it is touched
- on error, the row SHALL shake, the cells SHALL return to the row and empty

With the reduced-motion request: no orbit, no frame light, no particles, no pulse; the cells SHALL show the outcome in place and the result (success state or error message) SHALL be reached by a fade or a direct change. Every state change SHALL still happen; only the movement is dropped.

In both settings, keyboard focus on "Reenviar", "Cambiar mail" and "Ir a mi mes" SHALL be visible with a ring in the ring colour, and no particle, ghost or ring SHALL remain in the document once its animation ends.

#### Scenario: Reduced motion
- **WHEN** reduced motion is emulated and six digits are typed on the code step
- **THEN** no cell leaves the row and no dotted ring becomes visible while the code is verified
- **AND** after a rejection, the cells are empty and the message is shown, with no element translated or rotated

#### Scenario: Digit motion
- **WHEN** motion is not reduced and a digit is typed
- **THEN** the digit's scale changes over successive frames before settling, and the frame light's offset changes over successive frames and its opacity returns to zero within a second

#### Scenario: Orbit while verifying
- **WHEN** motion is not reduced and the sixth digit is typed
- **THEN** each cell's position changes over successive frames away from the row and the dotted ring becomes visible
- **AND** after a rejection every cell is back at its row position with no rotation, and the ring is hidden

#### Scenario: Success sequence
- **WHEN** motion is not reduced and a valid code is verified
- **THEN** the cells' opacity reaches zero, the check square reaches 1.65× its size, the success heading and "Ir a mi mes" become visible, and every particle and silhouette has been removed from the document within 6 s of the impact

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

### Requirement: Unlinked account
When the session's auth user has no `usuarios` row linked to it, `/dashboard` SHALL show a message saying the account is not linked yet and a log-out action. It SHALL show no figure, no row and no operation, and SHALL make no data query on that user's behalf. A person who registers through `/login` SHALL NOT reach this state: it remains only for an auth user whose row could not be created (see *Account created on first confirmed sign-in*).

#### Scenario: Auth user without a usuarios row
- **WHEN** a user created in the auth system but not linked to any `usuarios` row signs in and opens `/dashboard`
- **THEN** the "account not linked" message and a log-out action are shown, and no dashboard figure is rendered

#### Scenario: A new registration is never unlinked
- **WHEN** a person registers with a new address on `/login`, types the code and opens `/dashboard`
- **THEN** the dashboard renders, and the "account not linked" message is not shown

### Requirement: Session persistence and sign-out
A session SHALL survive page reloads and the expiry of its access token while its refresh token is valid: the refresh SHALL happen without the user's involvement. "Cerrar sesión" in the account menu SHALL be enabled on `/dashboard`, SHALL end the session, and SHALL lead to `/`.

#### Scenario: Log out
- **WHEN** the user activates "Cerrar sesión" in the account menu
- **THEN** they land on `/`, and opening `/dashboard` afterwards redirects to `/login`

#### Scenario: Expired access token
- **WHEN** a signed-in user returns after the access token expired but the refresh token is still valid
- **THEN** `/dashboard` renders their data without asking them to log in again

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
