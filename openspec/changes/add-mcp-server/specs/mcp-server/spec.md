## Purpose

Lets a person connect Claude or ChatGPT to their Mango account through a remote MCP server, so the assistant can read their cycle and change it with the same operations, scopes and limits as the dashboard, acting as that person and nobody else.

## ADDED Requirements

### Requirement: One remote endpoint for every assistant
Mango SHALL serve an MCP server at `https://www.usemango.dev/api/mcp` over Streamable HTTP. The same endpoint, tools and behaviour SHALL serve Claude (claude.ai custom connectors, Claude Desktop, Claude Code) and ChatGPT (connectors). The server SHALL NOT offer the SSE transport, MCP resources or prompts. Its name SHALL be "Mango" and its instructions SHALL tell the assistant, in a few lines, what a cycle is, that amounts are in the account's currency, that deletes of single movements can be restored, and that any change to something that repeats asks "only this month" or "from this month on".

#### Scenario: Initialize
- **WHEN** a client sends an MCP `initialize` request with a valid token
- **THEN** the server answers with the name "Mango", the tools capability and its instructions

#### Scenario: Same tools for both clients
- **WHEN** Claude and ChatGPT each list the tools with a token for the same account
- **THEN** both receive the same tool names, inputs and annotations

### Requirement: Discovery and token check
Every request to the endpoint SHALL carry a bearer access token issued by Mango's Supabase Auth to an OAuth client. A request with no token, an unparseable token, a bad signature, a foreign issuer, an expired token, or a token with no OAuth client (a browser session token) SHALL get `401` with a `WWW-Authenticate: Bearer` header naming the protected resource metadata URL, and no tool SHALL run. Mango SHALL serve RFC 9728 protected resource metadata at `/.well-known/oauth-protected-resource` (and at `/.well-known/oauth-protected-resource/api/mcp`) naming `https://www.usemango.dev/api/mcp` as the resource and Supabase Auth's issuer as its only authorization server, readable cross-origin. A valid token whose user has no `usuarios` row, or whose onboarding is not complete, SHALL be accepted, and every tool call SHALL then fail with the `account-not-ready` error, saying to finish the setup at Mango's web.

#### Scenario: No token
- **WHEN** a client posts to `/api/mcp` with no `Authorization` header
- **THEN** the response is `401` with `WWW-Authenticate: Bearer resource_metadata="https://www.usemango.dev/.well-known/oauth-protected-resource"`

#### Scenario: Metadata
- **WHEN** `/.well-known/oauth-protected-resource` is requested
- **THEN** it returns JSON with `resource` `https://www.usemango.dev/api/mcp` and `authorization_servers` holding the Supabase Auth issuer, with CORS headers that allow any origin

#### Scenario: Expired token
- **WHEN** a client calls a tool with a token whose `exp` has passed
- **THEN** the response is `401` and nothing is read or written

#### Scenario: A web session token is not enough
- **WHEN** a client calls a tool with the access token of a browser session (valid, but issued to no OAuth client)
- **THEN** the response is `401`

#### Scenario: Unfinished account
- **WHEN** a person whose onboarding is not complete connects and the assistant calls `get_summary`
- **THEN** the call returns the `account-not-ready` error and nothing else

### Requirement: Consent page
Mango SHALL serve the consent page at `/oauth/consent?authorization_id=<id>`, the page Supabase Auth sends a person to when an assistant asks for access. Without a session it SHALL send the person to `/login` with `next` set to the consent page's own URL. With a session, it SHALL show, on the dark sign-in card: the assistant's name as it registered itself, the host it will return to, the e-mail of the Mango account being connected, and what the assistant will be able to do (read movements, categories, fixed charges and cards; create, change and delete them; never delete the account or change its profile), with "Permitir" and "Cancelar". "Permitir" SHALL approve and "Cancelar" SHALL deny the request, and either SHALL send the browser to the redirect Supabase Auth returns. An authorization the person already approved for that client SHALL redirect at once without showing the page. A missing, unknown or expired `authorization_id` SHALL show a message that the request expired and to start again from the assistant, with no buttons. An account whose onboarding is not complete SHALL see a message to finish the setup first with a link to `/onboarding`, and no "Permitir". The page SHALL be `noindex`, in the active language, and both buttons SHALL show they are busy and ignore further activations while the answer is sent.

#### Scenario: Not signed in
- **WHEN** `/oauth/consent?authorization_id=abc` is opened without a session
- **THEN** the browser goes to `/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Dabc`

#### Scenario: What it shows
- **WHEN** a signed-in person opens the consent page for a request from a client registered as "Claude" returning to `claude.ai`
- **THEN** the page shows "Claude", `claude.ai`, the account's e-mail, the list of what it will be able to do, "Permitir" and "Cancelar"

#### Scenario: Allow
- **WHEN** "Permitir" is activated
- **THEN** the request is approved and the browser goes to the assistant's redirect with an authorization code

#### Scenario: Cancel
- **WHEN** "Cancelar" is activated
- **THEN** the request is denied and the browser goes to the assistant's redirect with an `access_denied` error

#### Scenario: Expired request
- **WHEN** the page is opened with an `authorization_id` Supabase Auth does not know
- **THEN** it shows that the request expired and to start again from the assistant, without buttons

#### Scenario: Unfinished account
- **WHEN** a person whose onboarding is not complete opens a valid consent page
- **THEN** it says to finish the setup first, links to `/onboarding`, and offers no "Permitir"

### Requirement: Every tool acts as the signed-in person
Every tool SHALL read and write as the person the token belongs to, through the same row-level security as `/dashboard`, and SHALL reach no other account's rows. Every tool SHALL go through the same operations the dashboard uses, with their validations and their "rejects with nothing changed" outcome; no tool SHALL run SQL or address a table directly. No tool SHALL delete the account, write the profile (name, country, currency, cycle day, language, timezone, amount format), link or unlink WhatsApp, change the widget order, or write any column of `usuarios`. An id that belongs to another account SHALL behave exactly like an id that does not exist.

#### Scenario: Another account's id
- **WHEN** the assistant calls `delete_movement` with the id of a movement of another account
- **THEN** the call fails with `not-found` and that movement is untouched

#### Scenario: Nothing reaches the profile
- **WHEN** the tools are listed
- **THEN** none of them takes a currency, a cycle day, a country, a phone, a widget order or an account deletion

### Requirement: Tool results and errors
Every tool SHALL return its result as structured content and the same content as JSON text. Amounts SHALL be numbers in the account's currency with at most two decimals, and the result SHALL name the currency once. Dates SHALL be `YYYY-MM-DD` in the account's timezone, and a cycle SHALL be named by its month `YYYY-MM` as `/dashboard?mes=` names it. A tool that cannot do what was asked SHALL return an error result (`isError`) with a stable `code` and a one-line `message` in English, and SHALL change nothing. The codes SHALL be: `invalid-input`, `not-found`, `duplicate-name`, `out-of-range` (a month before the first cycle or after the sixth projected one), `category-not-alive` (a category that does not exist in that cycle), `fixed-row` (a fixed charge's row sent to a one-off movement tool, naming the tool to use), `payment-methods-not-offered`, `account-not-ready`, and `failed` for anything else. Write tools SHALL return the affected item as it is after the change, with its id.

#### Scenario: Error result
- **WHEN** the assistant calls `create_category` with a name the account already uses, in other letter case
- **THEN** the result is an error with code `duplicate-name`, and no category is created

#### Scenario: Write result
- **WHEN** `add_movement` creates an expense of 12.5 in "Comida" dated 2026-10-19
- **THEN** the result holds the new movement's id, kind `expense`, amount 12.5, the category's id and name, the date and the cycle month

### Requirement: Annotated tools
Every tool SHALL declare `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint` (`false` on every tool: nothing reaches outside the account). Read tools SHALL be read-only. A write SHALL be marked destructive when it removes something or overwrites what was there: every delete, every update, and a category reorder; creating, restoring and marking a fixed charge charged SHALL NOT be. Each delete's description SHALL say whether it can be restored and with which tool.

#### Scenario: Annotations of a delete
- **WHEN** the tools are listed
- **THEN** `delete_fixed_charge` has `destructiveHint: true` and `readOnlyHint: false`, and `get_summary` has `readOnlyHint: true`

### Requirement: Reading the account
The server SHALL offer three read tools, each taking an optional `month` (`YYYY-MM`, default the cycle in progress; any past month the account has, up to the sixth projected one):
- `get_summary`: the cycle's range and month, whether it is in progress or projected, income total, expenses total, savings of the cycle and accumulated, free margin, every category alive in the cycle (id, name, colour, total, budget with spent and remaining, whether it is shown with a bar) in the stored order, the cards with their committed total, the payment pockets when the account has them, and the currency.
- `list_movements`: every row the cycle shows, with an optional `kind` filter (`expense`, `income`, `savings`, `transfer`): id, kind, description, amount, date, category (id and name) for expenses, payment method, whether the deposit was already saved, and for a fixed charge's row its definition id, whether it is charged, and whether it is projected (a projected row's id is `proj:<definition id>`). Sorted by date, newest first.
- `list_fixed_charges`: every active and stopped fixed definition (id, kind, name, expected amount, day, category, card, payment method, reminder, repetitions with done and total, active) and, for the month asked, each one's row there (id, amount, charged, projected, deleted for this month).

The figures SHALL equal what `/dashboard?mes=<month>` shows for the same account.

#### Scenario: Summary equals the dashboard
- **WHEN** `get_summary` is called with no month
- **THEN** its free margin, totals and category totals equal those `/dashboard` shows for the cycle in progress

#### Scenario: Projected month
- **WHEN** `list_movements` is called for the third cycle after the current one
- **THEN** the fixed charges come as projected rows with ids `proj:<definition id>`, and the cycle is marked projected

#### Scenario: Month out of range
- **WHEN** `get_summary` is called for the eighth cycle after the current one
- **THEN** the result is an error with code `out-of-range`

### Requirement: One-off movements
The server SHALL offer four tools for one-off movements:
- `add_movement` with `kind` `expense` (with `category_id`), `income`, `savings` (with `direction` `deposit` or `withdrawal`, and `already_saved` for a deposit), or `transfer` (with `into` `efectivo` or `tarjeta`); `amount` greater than 0 with at most two decimals; `description` (required for savings, optional otherwise); `date` (default today, up to the end of the sixth projected cycle); `payment_method` (`efectivo`, `tarjeta` or none) for expenses and income. It SHALL NOT create a fixed charge.
- `update_movement` with the movement's id and only the fields to change; an expense may move to another category alive in its cycle.
- `delete_movement`: soft-deletes the movement, so it disappears from every figure and can be restored.
- `restore_movement`: undoes `delete_movement`.

A row of a fixed charge, real or projected, SHALL be refused by `update_movement` and `delete_movement` with `fixed-row`, naming `update_fixed_charge` or `delete_fixed_charge`. A payment method or a transfer SHALL be refused with `payment-methods-not-offered` for an account that is not offered payment methods. An expense in a category not alive in the date's cycle SHALL be refused with `category-not-alive`.

#### Scenario: Add an expense
- **WHEN** `add_movement` is called with kind `expense`, 4.5, "Café", today, and the id of "Comida"
- **THEN** the expense appears in "Comida" on `/dashboard` and the free margin drops by 4.5

#### Scenario: Delete and restore
- **WHEN** `delete_movement` is called on that expense and then `restore_movement` with the same id
- **THEN** the expense disappears from the dashboard after the first call and is back with the same id after the second

#### Scenario: A fixed row is refused
- **WHEN** `update_movement` is called with the id of this month's "Alquiler" row
- **THEN** the result is an error with code `fixed-row` naming `update_fixed_charge`, and nothing changes

#### Scenario: Transfer without the feature
- **WHEN** an account in Ireland, not switched on, calls `add_movement` with kind `transfer`
- **THEN** the result is an error with code `payment-methods-not-offered`

### Requirement: Categories
The server SHALL offer four category tools, each taking `month` (default the cycle in progress) and, where the dashboard asks it, `scope` (`only_this_month` or `from_this_month`):
- `create_category`: `name`, `color` from the palette (default the first one the account does not use, never the rainbow), optional `budget`, `scope` (default `from_this_month`).
- `update_category`: id, and any of `name`, `color`, `budget` (a number, or null for none), `show_progress`. In a projected cycle, a budget change requires `scope`; in the current cycle it writes the current cycle as the dashboard does.
- `delete_category`: id, `scope` (required), and `reassign_to` (another category alive in the cycle) when the scope reaches any row or fixed charge; without it in that case, the error SHALL say how many rows and fixed charges it reaches.
- `reorder_categories`: the complete list of the ids of the categories alive in the cycle in progress (the ones `get_summary` lists), each once, in the new order; every other category of the account keeps its stored position, so the same list changes nothing.

No scope SHALL reach a cycle before `month`.

#### Scenario: Create for one month
- **WHEN** `create_category` is called with "Valencia", month 2026-11 and scope `only_this_month`
- **THEN** "Valencia" exists in November's cycle and not in October's or December's

#### Scenario: Delete without a destination
- **WHEN** `delete_category` is called on a category with expenses this month, `from_this_month`, and no `reassign_to`
- **THEN** the result is an error with code `invalid-input` saying how many rows and fixed charges need a destination, and nothing changes

#### Scenario: Budget in a projection needs a scope
- **WHEN** `update_category` changes the budget of "Comida" for the second projected month without `scope`
- **THEN** the result is an error with code `invalid-input`, and no budget changes

### Requirement: Fixed charges
The server SHALL offer five tools for fixed charges:
- `create_fixed_charge`: `kind` (`expense` with `category_id`, or `income`), `name`, `amount`, `day` (1–31), optional `repetitions` (a plan of N; none = no end), `reminder_days_before` (expenses; none = no reminder), `payment_method`, `card_id` (expenses). It creates the definition and this cycle's row, as the dashboard does.
- `update_fixed_charge`: definition id, `month`, and any of `amount`, `name`, `day`, `category_id`, `payment_method` with `scope` (`only_this_month` changes that month's row; `from_this_month` changes that month and every later one and the definition, never an earlier month); and any of `reminder_days_before` (or null to turn it off) and `card_id` (or null), which belong to the definition and take no scope.
- `set_fixed_charged`: definition id, `month` (the cycle in progress only), `charged` true or false.
- `delete_fixed_charge`: definition id, `month`, and `mode`: `stop` (no more charges; rows stay), `only_this_month` (that month's row is deleted and can be restored), `from_this_month` (that month and later are deleted and the definition stops), or `everywhere` (the definition and its rows in every month, the earlier ones included, cannot be undone). Its description SHALL say that `everywhere` cannot be undone.
- `restore_fixed_charge_month`: definition id and `month`: undoes `only_this_month`.

Every `month` of these tools SHALL be the cycle in progress or a later one, as on the dashboard; an earlier month SHALL be refused with `out-of-range`, so no tool changes a fixed charge's past rows (except `delete_fixed_charge` with `everywhere`).

#### Scenario: Only this month
- **WHEN** `update_fixed_charge` sets "Luz" to 72 for the current month with `only_this_month`
- **THEN** this month's "Luz" row is 72, the definition keeps its amount, and next month's projected "Luz" shows the old amount

#### Scenario: From this month on
- **WHEN** `update_fixed_charge` sets "Gimnasio" to 55 for the next month with `from_this_month`
- **THEN** next month and later show 55, the current month keeps its amount, and no earlier month changes

#### Scenario: Reminder needs no scope
- **WHEN** `update_fixed_charge` sets `reminder_days_before` to 2 with no scope
- **THEN** the definition's reminder is on with 2 days, and no row changes

#### Scenario: Delete everywhere
- **WHEN** `delete_fixed_charge` is called with `everywhere`
- **THEN** the definition and all its rows are gone from every month, and `restore_fixed_charge_month` on it fails with `not-found`

#### Scenario: Mark charged
- **WHEN** `set_fixed_charged` marks this month's "Internet" charged
- **THEN** "Próximos cobros" shows "Internet" among the charged ones

### Requirement: Cards
The server SHALL offer three card tools: `create_card` (`name` 1–30 characters, `color` from the palette, optional `fixed_charge_ids`), `update_card` (id, any of `name`, `color`, `fixed_charge_ids`, the complete list the card carries afterwards), and `delete_card` (the fixed charges it carried are left with no card; nothing else changes). A name already used by another of the account's cards, in any letter case, SHALL be refused with `duplicate-name`. A `fixed_charge_ids` entry that is not an active fixed expense of the account SHALL be refused with `not-found`, applying nothing.

#### Scenario: Card with its fixed charges
- **WHEN** `create_card` is called with "Visa", colour "azul_electrico" and the ids of "Netflix" and "Gimnasio"
- **THEN** the "Tarjetas" widget shows "Visa" with those two fixed charges and their committed total

#### Scenario: Delete a card
- **WHEN** `delete_card` is called on "Visa"
- **THEN** "Visa" is gone, and "Netflix" and "Gimnasio" carry no card

### Requirement: Revoking a connected assistant
A person SHALL be able to disconnect an assistant from Mango's account sheet (see `dashboard-ui` → *Connected assistants in the account sheet*). After disconnecting, every token and refresh token issued to that assistant for that account SHALL stop working, and its next call SHALL get `401`.

#### Scenario: Disconnected
- **WHEN** the person disconnects "Claude" and Claude then calls `get_summary` with the token it held
- **THEN** the response is `401`, or the refresh fails and Claude asks to connect again

### Requirement: Tool calls are logged without content
Each tool call SHALL write one server log line with the tool name, the OAuth client id, the first eight characters of the `usuarios` id, the outcome (`ok` or the error code) and the duration. It SHALL NOT log amounts, descriptions, category names, tokens or e-mails.

#### Scenario: Log line
- **WHEN** `add_movement` succeeds
- **THEN** the server logs one line with `add_movement`, the client id, the shortened user id, `ok` and the milliseconds, and no amount or description
