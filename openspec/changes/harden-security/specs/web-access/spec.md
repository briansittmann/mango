## ADDED Requirements

### Requirement: Sign-in returns to the site's own address
In production, the address the Google sign-in asks Supabase Auth to return to SHALL be the site's own address (`https://www.usemango.dev/auth/confirm`), never one built from the request's host header. Outside production (local development, previews) it SHALL keep using the request's origin, so a local sign-in returns to the local server.

#### Scenario: Forged host header
- **WHEN** a request to `/auth/google` in production arrives with `Host: evil.example`
- **THEN** the returned provider URL asks to come back to `https://www.usemango.dev/auth/confirm`

#### Scenario: Local development
- **WHEN** the Google sign-in starts from `http://localhost:3000`
- **THEN** it comes back to `http://localhost:3000/auth/confirm`
