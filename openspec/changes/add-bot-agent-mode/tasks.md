## 1. Parser

- [x] 1.1 `lib/bot/parser.ts`: `preguntar` in `ActionSchema` and `VoiceActionSchema`, the action line, the rule that keeps `consultar` for the two exact queries and sends any other question to `preguntar` (a greeting stays `no_entendido`), two examples per language; verify with `parser.test.mjs` (schema in text and voice, prompt lines) and `npm run test:unit`
- [x] 1.2 `lib/bot/parser-cases.json`: "¿cómo vengo en comida?", "cuánto gasté en netflix este año" and "Que me recomendas hacer con mi dinero ?" as `preguntar`, "Hola" as `no_entendido`; verify `npm run test:parser` on both models
  - 2026-11-05: `gemini-3.8-flash` 48/49 and then 49/49; `gemini-3.7-flash` 48/49. The one failure each time is the known voice flake (`farmacia-doce-con-cuarenta.ogg` transcribed as "farmacia 12 con 40", right action and amount), not a text case; the four new cases passed in every run (1.3–2.8 s).

## 2. Agent

- [x] 2.1 `lib/bot/agent.ts` (pure): `runAgent` (D4) and `buildAgentPrompt` (D5), constants `MAX_AGENT_STEPS` and `AGENT_TIMEOUT_MS`; verify with `lib/bot/agent.test.mjs` (text without a call, one call and its echo, several calls in parallel, unknown tool, tool error, last step without tools, one retry and two failures, empty answers, budget spent, history as turns, prompt contents)
- [x] 2.2 `lib/bot/gemini.ts`: `createGeminiAgentCall` (same models, timeout, fallback and thinking level as the parser; `systemInstruction`, `parametersJsonSchema`, text out, the candidate's content echoed); verify by type-checking and in the eval
- [x] 2.3 `lib/bot/agent-tools.ts`: `agentToolsFor` (the MCP `readTools` through `callTool` on the turn's `ToolContext`, JSON Schema from zod) and `agentPromptFor`; `MCP_INSTRUCTIONS` moved to `lib/mcp/instructions.ts` and re-exported by `server.ts`; verify `npx tsc --noEmit`, `npx eslint lib/bot lib/mcp`
- [x] 2.4 `lib/bot/logic.ts`: `Turn.history`, `askAgent` (D1, D6), `preguntar` and `no_entendido` in `act` (VIP → agent, else the month query / `noEntendi`), `BotReply` kind `agent`, `outcomeOf` → `agente` / `agente_no_disponible`; verify `npm run test:unit` and `tsc`

## 3. Eval and verification

- [x] 3.1 `lib/bot/agent.eval.mjs` and `npm run test:agent` (D7); `agent-cases.json` with `eval` on the read cases and five new ones (one category, Netflix, this week's fixed charges, savings, a request to write); verify two runs on each model
  - 2026-11-05, first run on `gemini-3.8-flash`: 9/10, the failure an eval expectation (the deletion request answered without reading, which is right); fixed.
- [x] 3.2 Record the two runs per model of `test:agent` and `test:parser` in these notes
  - `test:agent`, 2026-11-05, with the amount example "86,88 € o 300 €": 3.8 9/10 then 10/10, 3.7 10/10 then 9/10; both failures "1200 €" without the thousands dot for "cuánto tengo ahorrado". With "1.234,56 € o 300 €" (thousands, decimals and a whole amount): 3.8 10/10 and 10/10, 3.7 10/10 and 10/10; per case 1.5–7.5 s, median 3.2 s, no `***` in any reply.
  - `test:parser`: see 1.2.
- [x] 3.3 Against the real database without WhatsApp, read-only: a local script (`agent-real.mts`, in the session's scratchpad) runs `runAgent` with the real `agentToolsFor` on the admin client and real Gemini for brianreba97, without `processMessage`, so nothing is written (no `mensajes`, `eventos_bot` or rows)
  - 2026-11-05 (`npx tsx --conditions=react-server`): "¿cómo vengo en Comida?" → get_summary, "0 de 150 €, quedan 150 €" (6.3 s); "¿y en Ocio?" with the previous turn as history → get_summary, Ocio without budget (5.4 s); "¿cuánto gasté en Netflix este mes?" → list_movements + list_fixed_charges, "0 €, no tenés ninguna suscripción con ese nombre" (10.0 s); "qué fijos se me cobran esta semana" → list_fixed_charges, names Alquiler, Luz and Ahorro viaje charged on the 1st (7.7 s); "Que me recomendas…" → get_summary, margin 831 € and two suggestions, no investment advice (5.5 s); "Hola" and "anotá café 3" → no tools, greeting and «café 3» (1.7–2.2 s). Every `callTool` line logged with `client=whatsapp`. One reply used `***150 €***`; the prompt now says a single asterisk each side. The `processMessage` path on a VIP account (history stored, `eventos_bot` = `agente`) is covered by the unit tests and by Brian's round (3.4): brianreba97 is not VIP and marking it is a write to `usuarios`.
- [ ] 3.4 👤 Brian: a round by WhatsApp in production after the deploy; the exchanges go to `docs/bot-conversacion-ejemplo.md`; after a week, `select resultado, count(*), round(avg(ms)) from eventos_bot where resultado like 'agente%' group by 1`

## 4. Docs

- [x] 4.1 `/privacidad` ("Tus mensajes" / "Your messages"): on accounts with history, answering a question also sends the model the account figures the question needs
- [x] 4.2 CLAUDE.md (state and the open change), ARCHITECTURE.md §5 (advisor mode, implemented as the agent) and §11 (invented figures), ROADMAP.md block 13
- [ ] 4.3 Archive after `add-bot-batch-loads` (whose delta of *A message becomes exactly one action* this change builds on) and copy the Risks into *Deuda técnica*
