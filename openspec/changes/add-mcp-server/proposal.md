## Why

Today Mango is reached through the web and through WhatsApp. People who already live in Claude or ChatGPT have no way to ask either assistant about their money or to change it ("¿en qué gasté más que en septiembre?", "pasá todos los cafés de esta semana a Ocio", "cargá este extracto"). A remote MCP server lets both assistants read and change a Mango account with the same operations the dashboard uses. The model is paid by the person's own assistant, not by Mango. Brian wants it now (2026-10-19), before the rate limiting of block 10: Mango is for him, his friends and his portfolio, and traffic will stay small.

## What Changes

- **A remote MCP server at `/api/mcp`** (Streamable HTTP, a Next.js route handler on Vercel). The same endpoint serves Claude (claude.ai custom connectors, Claude Desktop, Claude Code) and ChatGPT (connectors / developer mode).
- **Sign-in with OAuth 2.1, Supabase Auth acting as the authorization server.** The assistant registers itself and sends the person to Mango, who signs in with their usual e-mail code or Google and approves on a new **consent page** (`/oauth/consent`) that names the assistant and what it will be able to do. The access token is a Supabase JWT for that person, so every tool runs through RLS exactly like `/dashboard`.
- **The MCP server publishes Protected Resource Metadata** (`/.well-known/oauth-protected-resource`) and answers a missing or invalid token with `401` and `WWW-Authenticate`, so clients discover the flow on their own.
- **`/login` learns to return where it was sent from** (`?next=` with a same-origin path), for the e-mail code and for Google. The consent page needs it, and the dashboard flow is unchanged.
- **A curated set of 19 tools**, that wrap the existing contracts of `lib/data/supabase/*` (no SQL, no raw table access):
  - read: the cycle summary (totals, free margin, categories with budgets, savings, cards), the cycle's movements, and the fixed charges with their definitions;
  - write: create, edit, delete and restore a movement (expense, income, savings, and transfers only for accounts offered payment methods); create, edit, delete and reorder categories; create, edit, mark charged, stop and delete fixed charges; manage cards and the fixed charges each one carries.
  - Every operation that repeats takes the same scope the sheets ask for ("solo este mes" / "desde este mes en adelante"), and never reaches past cycles.
  - Tools are annotated (`readOnlyHint`, `destructiveHint`, `idempotentHint`), so the clients ask before a destructive call. Deletes stay soft wherever the dashboard's are, and the result names the restore tool.
- **Left out on purpose**: deleting the account, the profile (currency, cycle day, country), WhatsApp linking, the widget order, and the admin columns (`vip`, `medio_pago_habilitado`). No tool writes `usuarios`.
- **A "Claude y ChatGPT" section in the account sheet** with the server URL to copy and a short how-to for each assistant. The connected apps are listed and can be revoked from there.

Out of scope: rate limiting (block 10, after this), MCP resources and prompts, ChatGPT Apps SDK widgets (UI inside the chat), bank-statement parsing on Mango's side (the assistant does it and calls the create tool), and public listing in either directory.

## Capabilities

### New Capabilities

- `mcp-server`: the endpoint and its transport, OAuth discovery and token validation, the consent page and revocation, the tool catalogue with its inputs, outputs, annotations and error shape, and what stays out of reach.

### Modified Capabilities

- `web-access`: a new requirement, *Sign-in returns to where it was sent from*: `/login` accepts a same-origin `next` path and lands there after the e-mail code or Google. Written as ADDED so the existing sign-in requirements keep their text; without `next` they are unchanged.
- `dashboard-ui`: a new requirement, *Connected assistants in the account sheet* (ADDED, so it does not collide with `add-whatsapp-linking`'s rewrite of *Account avatar and menu*).

## Impact

- Supabase project: OAuth server enabled in the dashboard (Authentication → OAuth Server), with dynamic client registration and the consent page URL; Brian does this in the panel. No database migration: grants are listed and revoked with supabase-js.
- Dependencies: `mcp-handler@2` (Vercel) and `@modelcontextprotocol/server@2`, both server-only; `jose` only if `getClaims` cannot verify OAuth tokens (design D2).
- Code: `app/api/mcp/route.ts`, `app/.well-known/oauth-protected-resource/route.ts`, `app/oauth/consent/` (page and server actions), `lib/mcp/` (token to `DataContext`, tool definitions, output shaping, pure helpers with unit tests), `lib/auth/next.ts`, `/login`, `/auth/google` and `/auth/confirm` for `next`, the account sheet section, `proxy.ts` matcher for `/oauth`. Strings in `messages/es.json` and `en.json` (`mcp`).
- Tests: unit tests for the tool helpers and the `next` sanitiser; an integration script that calls each tool against the real database as Brian, leaving nothing behind; Playwright specs for `/login?next=` and the consent page with Supabase mocked; a manual round with Claude and with ChatGPT.
- Docs: ARCHITECTURE.md (a third entrance next to the web and WhatsApp), ROADMAP.md (block 13, and block 10 now also covers `/api/mcp`), CLAUDE.md *Estado actual*.
