## ADDED Requirements

### Requirement: Sign-in returns to where it was sent from
`/login` SHALL accept a `next` query parameter naming where to land after signing in. It SHALL be honoured only when it is a path on Mango's own origin: it starts with a single `/`, is not `//…` or `/\…`, and carries no scheme or host. Any other value SHALL be ignored, as if absent. With a valid `next`, a successful code, a successful return from Google, and opening `/login` with a session already open SHALL land on that path, with its query, instead of `/dashboard`. Without it, every landing SHALL stay as *Sign-in by e-mail code*, *Sign-in with Google* and *A token in the confirm route opens a session* describe. `next` SHALL survive the trip to Google and back, and SHALL be used once: a later sign-in without it SHALL land on `/dashboard`. "Cambiar mail", "Volver" and a failed attempt SHALL keep it.

#### Scenario: Code with next
- **WHEN** `/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Dabc` is opened without a session and a valid code is entered
- **THEN** the person lands on `/oauth/consent?authorization_id=abc` signed in

#### Scenario: Google with next
- **WHEN** the same URL is opened and the person accepts at Google
- **THEN** they land on `/oauth/consent?authorization_id=abc` signed in

#### Scenario: Already signed in
- **WHEN** `/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Dabc` is opened with a session
- **THEN** the browser goes to `/oauth/consent?authorization_id=abc`

#### Scenario: Foreign destination ignored
- **WHEN** `/login?next=https%3A%2F%2Fevil.example` or `/login?next=%2F%2Fevil.example` is opened and a valid code is entered
- **THEN** the person lands on `/dashboard`

#### Scenario: Used once
- **WHEN** a sign-in with `next` landed on the consent page, the person signs out, and later signs in from `/login` with no `next`
- **THEN** they land on `/dashboard`

#### Scenario: Kept through a failed attempt
- **WHEN** a wrong code is entered on `/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Dabc`, then "Cambiar mail" is activated and the sign-in is completed
- **THEN** the person lands on `/oauth/consent?authorization_id=abc`
