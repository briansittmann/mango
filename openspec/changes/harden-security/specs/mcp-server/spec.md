## ADDED Requirements

### Requirement: The consent page warns about unknown assistants
Because any client can register itself under any name, the consent page SHALL treat the host the assistant returns to as the source of truth. When that host is `claude.ai` or `chatgpt.com` (or a subdomain of either), the page SHALL show the assistant as recognised. When the host is the person's own computer (`localhost`, `127.0.0.1` or `[::1]`, as desktop and terminal assistants use), it SHALL say the access goes to an app on this computer, without the warning. For any other host it SHALL show, above the buttons, a warning in the active language that this app is not Claude or ChatGPT and that the person should allow it only if they recognise `<host>`; the warning SHALL be visible without scrolling, not depend on colour alone, and "Permitir" SHALL keep working.

#### Scenario: Claude
- **WHEN** a client registered as "Claude" asks for access returning to `claude.ai`
- **THEN** the page shows it as recognised and no warning

#### Scenario: App on this computer
- **WHEN** a client asks for access returning to `http://localhost:53682/callback`
- **THEN** the page says the access goes to an app on this computer, and shows no warning

#### Scenario: Look-alike
- **WHEN** a client registered as "Claude" asks for access returning to `claude-ai.example.com`
- **THEN** the page shows the warning naming `claude-ai.example.com`, above "Permitir" and "Cancelar"

### Requirement: Tool calls are limited per account
An account SHALL be able to make at most 120 tool calls per minute through the MCP server, counted across all its connected assistants. A call over the limit SHALL change nothing and SHALL return an error result with code `rate-limited` and a message saying to wait a minute; `rate-limited` SHALL join the closed list of error codes. The count SHALL survive between server instances.

#### Scenario: Over the limit
- **WHEN** an account makes its 121st tool call within one minute
- **THEN** the call returns `rate-limited` and writes nothing

#### Scenario: Next minute
- **WHEN** the same account calls again after the minute has passed
- **THEN** the call runs normally

### Requirement: Amounts are within the stored range
Every amount a tool takes SHALL be greater than 0, have at most two decimals, and be at most 9,999,999,999.99; a larger amount SHALL be `invalid-input` and SHALL change nothing.

#### Scenario: Oversized amount
- **WHEN** the assistant calls `add_movement` with amount 1e12
- **THEN** the result is `invalid-input` and no movement is created
