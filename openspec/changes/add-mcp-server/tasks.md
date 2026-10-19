## 1. Setup and auth groundwork

- [x] 1.1 👤 Brian: in Supabase → Authentication → OAuth Server, turn the server on, allow dynamic client registration, and set the Authorization Path to `/oauth/consent` (design D1); verify `curl https://noemlszbjqzqbzagahyd.supabase.co/.well-known/oauth-authorization-server/auth/v1` returns metadata with a `registration_endpoint` instead of `feature_disabled`
- [x] 1.2 Install `mcp-handler@^2` and `@modelcontextprotocol/server@^2`; spike `getClaims(token)` on an OAuth access token (register a client by DCR with curl, run the flow once by hand, keep the token only in the scratchpad) and confirm it verifies the signature and exposes `client_id`; if not, add `jose` (D2). Verify `npm ls` shows the packages and record the result in design D2
- [x] 1.3 `lib/auth/next.ts` with `safeNext` and `lib/auth/next.test.mjs` (paths, query kept, `//host`, `/\host`, schemes, encoded tricks, empty); verify with `npm run test:unit`

## 2. `next` through `/login` (`web-access` → *Sign-in returns to where it was sent from*)

- [x] 2.1 `/login` page with a session redirects to `safeNext(next) ?? '/dashboard'`; `LoginSteps` keeps `next` in the URLs it writes and its `onDone` pushes it (D10); verify with a Playwright spec on the code step (verify-code mocked, as `login-code` does): lands on `next`, foreign values land on `/dashboard`, "Cambiar mail" and a wrong code keep it
- [x] 2.2 `POST /auth/google` takes `next` into the `mango-alta` cookie (`signup-prefs.ts` with an optional `next`, its unit test updated), and `/auth/confirm` lands on it on success (D10); verify `signup-prefs.test.mjs` and a spec with `/auth/google` mocked that the request carries `next`, and run `login-google`, `login-code`, `login-signup` and `login-access` in Chromium

## 3. Endpoint and discovery (`mcp-server` → *One remote endpoint*, *Discovery and token check*)

- [x] 3.1 `lib/mcp/context.ts`: `verifyToken` (issuer, `client_id`, signature, `exp`) and `toolContext` (`findCurrentUsuario`, `account-not-ready`) (D2, D3); verify with a unit test on the pure claim checks (`checkClaims` with a missing `client_id`, a foreign `iss`, a valid set)
- [x] 3.2 `app/api/mcp/route.ts` with `createMcpHandler` + `withMcpAuth`, server name, instructions, and `app/.well-known/oauth-protected-resource/route.ts` (and the `/api/mcp` suffix form) with CORS `OPTIONS`; `proxy.ts` matcher gains `/oauth/:path*` (D4); verify with curl against `next dev`: `POST /api/mcp` without a token gives `401` with the `WWW-Authenticate` header of the spec, the metadata JSON names the resource and the issuer, and a browser session token gives `401`
- [x] 3.3 `lib/mcp/errors.ts` (`McpToolError`, `toToolError`) and the envelope and log line in `registerTools` (D7, `mcp-server` → *Tool results and errors*, *Tool calls are logged without content*); verify `errors.test.mjs` (duplicate names, `not-found`, `PGRST116`, zod issue, unknown → `failed`) and that the log line carries no amount or description

## 4. Tools (`mcp-server` → *Reading the account*, *One-off movements*, *Categories*, *Fixed charges*, *Cards*, *Annotated tools*)

- [x] 4.1 `lib/mcp/months.ts` and `lib/mcp/shape.ts` (`summaryOf`, `movementsOf`, `fixedChargesOf`) with unit tests over a `DashboardData` fixture (projected rows with `proj:` ids, fixed rows with `charged`, deleted slots, pockets only when present, month range, currency once); verify with `npm run test:unit`
- [x] 4.2 Read tools `get_summary`, `list_movements`, `list_fixed_charges` in `lib/mcp/tools/read.ts`; verify against the real database with `scripts/mcp-smoke.mjs` as Brian that `get_summary`'s free margin, totals and category totals equal `/dashboard`'s for October and for one projected month
- [x] 4.3 `lib/mcp/map.ts` (inputs to drafts, partial update merged over the stored row, default colour without `arcoiris`, payment-method gate) with `map.test.mjs`, and `lib/mcp/rows.ts` (id resolution, `fixed-row`, `proj:`) (D5); verify with `npm run test:unit`
- [x] 4.4 Movement tools `add_movement`, `update_movement`, `delete_movement`, `restore_movement`; verify in the smoke script: add an expense, edit amount and category, delete, restore, and finally delete it, plus the refusals `fixed-row`, `category-not-alive`, `payment-methods-not-offered` on an account without the feature, and an id of no row
- [x] 4.5 Category tools `create_category`, `update_category`, `delete_category`, `reorder_categories`; verify in the smoke script: create "Prueba MCP" for one projected month only, rename it, budget in a projection without and with `scope`, `duplicate-name`, delete with and without `reassign_to`, reorder with the same list (no change)
- [x] 4.6 Fixed-charge tools `create_fixed_charge`, `update_fixed_charge`, `set_fixed_charged`, `delete_fixed_charge`, `restore_fixed_charge_month` (D6); verify in the smoke script on a test fixed charge: "only this month" vs "from this month" against the next projected month, reminder without scope, card, mark and unmark charged, the four delete modes and the restore, a month before the current one refused
- [x] 4.7 Card tools `create_card`, `update_card`, `delete_card`; verify in the smoke script: create with the test fixed charge, `duplicate-name`, an unknown fixed id applies nothing, delete leaves the fixed with no card
- [x] 4.8 Annotations and descriptions on all 19 tools (D8): every delete says whether and how it is restored, `everywhere` says it cannot be undone; verify a unit test that lists the registered tools and checks the four hints and the destructive set, and run `npx @modelcontextprotocol/inspector` against `next dev` to list them
- [x] 4.9 With Brian's confirmation, run the whole smoke script against the real database and confirm by query that it left no row behind (test category, card, fixed charge and movements hard-deleted)

## 5. Consent page (`mcp-server` → *Consent page*)

- [x] 5.1 (2026-10-19: page, actions, strings and `tests/login-next.spec.js` for the no-session states done; the consent card and "Cancelar" verified against the real project with a scratchpad script (DCR client registered and deleted, deny → `access_denied`), screenshots at 390px and 1280px; axe clean at 390px and 1280px, under reduced motion every piece is in place on the first frame (`animation: none`, opacity 1), both buttons 44px with a visible focus ring in tab order, on the test account brianreba97; "Permitir", which writes a grant, in 5.2) `app/oauth/consent/page.tsx` and its two server actions (D9), `noindex`, dark card like `/login`, strings `mcp.consentimiento.*` in `es.json` and `en.json`; verify with a Playwright spec that mocks the Supabase auth endpoints: no session → `/login?next=…`, the page shows name, host, e-mail and list, "Permitir" and "Cancelar" post once and follow the returned redirect, expired id, unfinished account, English, axe, reduced motion
- [x] 5.2 Run the flow by hand locally (D12): MCP Inspector → authorize → take the `authorization_id` to `localhost:3000/oauth/consent`, approve, and call `get_summary` through the Inspector with the issued token; then revoke from the account sheet (6.1) and see the next call get `401`

## 6. Account sheet (`dashboard-ui` → *Connected assistants in the account sheet*, `mcp-server` → *Revoking a connected assistant*)

- [x] 6.1 Server actions `listConnectedApps` and `disconnectApp` as optional `ProfileMutations` members, and the "Claude y ChatGPT" section in `account-sheet.tsx` (URL with "Copiar", two how-to lines, list loaded on open, "Desconectar" with confirmation and error) (D11); strings `mcp.cuenta.*` in both languages; verify against the real database with the one-time-token script at 390px and 1280px: the grant from 5.2 is listed and disconnecting removes it; screenshots in light and dark
- [x] 6.2 Motion and accessibility of the section against `motion-skills/AUDIT.md` (copy confirmation, row removal, reduced motion), focus and 44px targets; verify with screenshots and an axe pass on the open sheet

## 7. Tests, deploy and round

- [x] 7.1 `npm run test:unit`, `npm run lint`, `npx tsc --noEmit`, and `npm test` in Chromium, then the three browsers; report failures with output and whether they are this change's
- [ ] 7.2 👤 Brian deploys; verify on production with curl the `401` and the metadata, and that `/login` without `next` still lands on `/dashboard`
- [ ] 7.3 Manual round in production with Claude (claude.ai custom connector, then Claude Code via `claude mcp add --transport http mango https://www.usemango.dev/api/mcp`): connect, consent, "¿cómo vengo este mes?", load an expense, move it to another category, delete and restore it, change a fixed charge "solo este mes", and check every result on `/dashboard`; record the exchange in `docs/mcp-ejemplo.md`
- [ ] 7.4 Manual round with ChatGPT on Brian's plan: connect with developer mode or as an app, the same requests; record whether write tools are allowed on that plan and how it asks before a destructive call
- [ ] 7.5 Remove every row the rounds created that is not real, with Brian's confirmation

## 8. Docs

- [ ] 8.1 ARCHITECTURE.md: the MCP as a third entrance next to the web and WhatsApp (OAuth by Supabase, token as the person, tools over the contracts, no rate limit yet); ROADMAP.md: the MCP in block 13 and `/api/mcp` added to block 10's rate limiting; `/privacidad`: a paragraph on connected assistants (what they read, revocation); CLAUDE.md *Estado actual*; on archiving, copy the accepted risks (no audience binding, beta OAuth server, ChatGPT plans, DCR clutter) into *Deuda tecnica*
