# account-data-protection Specification

## Purpose
Defines what a signed-in person's token, an assistant's OAuth token and an anonymous visitor may change or read in Mango's database, and the security headers every page carries, so no account can be blocked, probed or taken over from another.

## Requirements

### Requirement: A person's token writes only the profile fields the web edits
With a signed-in person's token, the `usuarios` row SHALL be writable only in the fields the web itself edits: name, country, currency, timezone, cycle day, amount format, language, monthly savings target, onboarding step and completion, widget order and default payment method. The e-mail, the phone, the linking code and its request time, the VIP flag, the payment-method switch, the bot's confirmation counters and mode, the cron's generation mark and the link to the auth user SHALL NOT be writable with a person's token; an attempt SHALL fail and change nothing. Every write the dashboard, the onboarding and the account sheet make today SHALL keep working.

#### Scenario: Taking another person's e-mail
- **WHEN** a signed-in person sends an update of their own `usuarios` row that sets the e-mail to `ana@gmail.com`
- **THEN** the update is refused, their row keeps its e-mail, and when Ana later signs up she gets her account

#### Scenario: Probing a phone or a code
- **WHEN** a signed-in person tries to set their own phone or linking code to a value another account holds
- **THEN** the update is refused with the same error as for any other value, so it reveals nothing about other accounts

#### Scenario: Turning on a feature by hand
- **WHEN** a signed-in person tries to set their own VIP flag or payment-method switch to true
- **THEN** the update is refused and the flag keeps its value

#### Scenario: The account sheet still saves
- **WHEN** a person changes name, currency, timezone and default payment method in the account sheet and saves
- **THEN** all four are stored

### Requirement: An assistant's token cannot reach the profile or erase movements
A token issued to an OAuth client (any assistant connected through the consent page) SHALL NOT update any field of the `usuarios` row and SHALL NOT permanently delete movements, whether through the MCP tools or by calling the database API directly with that token. Deleting a movement through the tools (a soft delete that `restore_movement` undoes) SHALL keep working, and so SHALL every other tool. A browser session's token SHALL be unaffected.

#### Scenario: Direct profile write with an assistant's token
- **WHEN** a request to the database API with an assistant's token updates the account's currency
- **THEN** it changes nothing

#### Scenario: Direct hard delete with an assistant's token
- **WHEN** a request to the database API with an assistant's token deletes the account's movements
- **THEN** no movement is removed

#### Scenario: Tools keep working
- **WHEN** the assistant calls `delete_movement` and then `restore_movement`
- **THEN** the movement is hidden and then back, as before

### Requirement: The anonymous role reaches no data
A request without a signed-in session SHALL be able to read, write or call nothing in the application's tables and functions; sign-up, sign-in and the public pages SHALL keep working, since none of them reads the database without a session.

#### Scenario: Anonymous table read
- **WHEN** a request with only the public key selects from `transacciones`
- **THEN** it is refused for lack of privilege, not just answered empty

#### Scenario: Public pages
- **WHEN** a visitor without a session opens `/`, `/demo`, `/login` and `/privacidad`
- **THEN** each page renders as before

### Requirement: Every page carries security headers
Every response of the web application SHALL forbid being framed by any site (`frame-ancestors 'none'` and `X-Frame-Options: DENY`), SHALL carry `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that turns off camera, microphone, geolocation and payment. The protected-resource metadata SHALL stay readable from any origin.

#### Scenario: Consent page in a frame
- **WHEN** another site embeds `/oauth/consent` in an iframe
- **THEN** the browser refuses to render it

#### Scenario: Headers present
- **WHEN** `/`, `/dashboard`, `/oauth/consent` and `/api/mcp` are requested
- **THEN** each response carries the five headers
