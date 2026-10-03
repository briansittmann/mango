## MODIFIED Requirements

### Requirement: Home is the landing page
The application SHALL serve `/` without a session as the landing page. Its header SHALL show a language choice (ES/EN) and "Entrar", leading to `/login`. The hero and the closing section SHALL each offer "Empezar", leading to `/login`, and "Ver la demo", leading to `/demo`. Between them, a pinned scroll story SHALL show `/demo` inside a phone frame (`/demo?embed=1`, without the demo notice and without the animated background) while three WhatsApp messages and their bot replies appear beside it, each one adding its expense to the embedded dashboard so the free margin drops; with reduced motion the story is not pinned and shows its final state. The footer SHALL say what Mango is. No public page SHALL say the WhatsApp bot is by invitation or ask for an invitation code. The page SHALL show nothing that depends on a session, SHALL NOT redirect a signed-in visitor, and SHALL make no request to a Supabase host. Its texts SHALL come from the translation files. On the dark theme the dot field replaces the shell's diagonal streaks.

#### Scenario: Entry points
- **WHEN** an unauthenticated visitor opens `/`
- **THEN** "Entrar" and "Empezar" navigate to `/login`, "Ver la demo" navigates to `/demo`, and no request to a Supabase host is made

#### Scenario: What Mango is
- **WHEN** an unauthenticated visitor opens `/`
- **THEN** the footer says what Mango is, and nothing on the page mentions an invitation

#### Scenario: Home in English
- **WHEN** the active language is English and `/` is opened
- **THEN** the header reads "Log in", the actions read "Get started" and "See the demo", and the footer line is in English

#### Scenario: The story lowers the margin
- **WHEN** the visitor scrolls through the phone story
- **THEN** each message's reply adds its expense to the embedded dashboard and its free margin goes from 864 € to 783,20 € after the third; scrolling back removes them in reverse

#### Scenario: Signed-in visitor on Home
- **WHEN** a signed-in user opens `/`
- **THEN** the same landing is shown and no redirect happens
