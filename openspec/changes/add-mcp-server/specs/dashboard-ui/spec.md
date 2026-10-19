## ADDED Requirements

### Requirement: Connected assistants in the account sheet
The account sheet SHALL hold a section "Claude y ChatGPT" ("Claude and ChatGPT") below the WhatsApp section. It SHALL show the server URL `https://www.usemango.dev/api/mcp` in a read-only field with a "Copiar" button that copies it and confirms with "Copiado" for two seconds, and two short lines on where to paste it: in Claude, *Settings → Connectors → Add custom connector*; in ChatGPT, *Settings → Apps & Connectors → Create*. Below, it SHALL list the assistants connected to the account, newest first, each with its name as it registered, the date it was connected, and a "Desconectar" button; with none, a muted line "Ningún asistente conectado". "Desconectar" SHALL ask for confirmation naming the assistant, then revoke its access (see `mcp-server` → *Revoking a connected assistant*) and remove the row; a failure SHALL keep the row with a message that it could not be disconnected. The list SHALL load when the sheet opens, with a short loading line, and SHALL NOT delay the dashboard. The demo SHALL NOT show the section (the demo's account sheet does not open). Texts SHALL come from the translation files, and the controls SHALL meet the sheet's existing focus, target size and reduced-motion rules.

#### Scenario: Copy the URL
- **WHEN** "Copiar" is activated in the section
- **THEN** the clipboard holds `https://www.usemango.dev/api/mcp` and the button reads "Copiado" for two seconds

#### Scenario: Listed assistant
- **WHEN** the account approved Claude on 19/10 and the sheet is opened
- **THEN** the section lists "Claude", connected on 19/10, with "Desconectar"

#### Scenario: Disconnect
- **WHEN** "Desconectar" is activated on "Claude" and confirmed
- **THEN** the row disappears and Claude's next call to Mango is refused

#### Scenario: None connected
- **WHEN** the account has no connected assistant and the sheet is opened
- **THEN** the section shows the URL, the two lines and "Ningún asistente conectado"

#### Scenario: English
- **WHEN** the active language is English
- **THEN** the section reads "Claude and ChatGPT", "Copy", "Disconnect" and "No assistant connected"
