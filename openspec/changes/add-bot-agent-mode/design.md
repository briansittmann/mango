## Context

`processMessage` (`lib/bot/logic.ts`) parses with `parseMessage` (`lib/bot/parser.ts`, one JSON action, two attempts) and dispatches in `act()`; every reply is a fixed text from `messages/*.json`. The MCP server (`lib/mcp/`) exposes nineteen tools; the three read ones (`lib/mcp/tools/read.ts`) call `resumenMensual` and shape it (`lib/mcp/shape.ts`). A tool runs on a `ToolContext = { ctx: DataContext, usuario }`, and the bot's turn already has both: `turn.data` (a `DataContext` on the admin client) and `turn.usuario`. `@google/genai` 2.x does function calling with `parametersJsonSchema` (plain JSON Schema, which zod 4 emits with `z.toJSONSchema`). VIP accounts keep 20 messages / 24 h of history (`lib/data/messages.ts`). The webhook has 60 s (`maxDuration`).

## Goals / Non-Goals

**Goals:**
- A VIP account's open question is answered from its own figures, read through the MCP's tools, in the bot's voice.
- Nothing that works today changes path: loads, lists, Undo, pending questions and the deterministic queries stay as they are.
- Measurable: an eval with fake tools, and `eventos_bot` outcomes for the agent.

**Non-Goals:**
- Writes by the agent (the sixteen other tools), with a confirmation turn and Undo: stage 4.
- A pending question held by the agent; if it needs to clarify, it asks in text and the next message starts from the history.
- The agent for non-VIP accounts (two or three model calls per question instead of one).
- A new MCP endpoint or transport: the bot calls the tool functions in process, not over HTTP.

## Decisions

### D1. The agent is the parser's fallback, not its replacement

The parser runs first as today (one call, deterministic, 45/45 in the eval). The agent runs only when the parser returns `preguntar` or `no_entendido` **and** `usuario.vip`. Replacing the parser with the agent would put every load through two or three model calls and lose the fixed confirmations, the batch rules and the pending questions.

### D2. A ninth action, `preguntar`

`{"accion":"preguntar"}`, no fields. The prompt rule: `consultar` only for the two exact queries (how much is left in general, how the month is going in general); any other question or request about the account's money is `preguntar`; a bare greeting or a loose "sí" stays `no_entendido`. For a non-VIP account `preguntar` is answered with `query(turn, 'mes')`, which already lists every category: today "¿cómo vengo en comida?" lands there or in "no te entendí", so nobody loses anything.

### D3. The MCP's read tools, as they are, on the turn's context

`readTools` (`get_summary`, `list_movements`, `list_fixed_charges`) wrapped in `lib/bot/agent-tools.ts`: `ToolContext = { ctx: turn.data, usuario: turn.usuario }`, each call through `callTool` (`lib/mcp/envelope.ts`) with `clientId` = the channel, so an invalid argument comes back as `invalid-input` and one log line goes out without content. The admin client has no RLS: isolation is the explicit `usuario_id` filter, which the three reads carry (`monthBounds`, `readFixedCharges`, `resumenMensual(client, usuario)`, the one the bot already uses). No write tool is given to the model, so `consumir_cupo_mcp` and `consumir_cupo_altas` are not involved. `MCP_INSTRUCTIONS` moves to `lib/mcp/instructions.ts` (pure) and `server.ts` re-exports it, so the bot and the eval import the same cycle rules without `server-only`.

### D4. The loop (`lib/bot/agent.ts`, pure)

Contents: the history as previous turns (`entrante` → user, `saliente` → model), then the message. `tools` as function declarations with `parametersJsonSchema = z.toJSONSchema(tool.input)` minus `$schema`, mode AUTO. Up to `MAX_AGENT_STEPS = 4` model calls; a response with function calls runs every tool in parallel, appends the model's turn as it came (thought signatures included) and the `functionResponse` parts, and calls again; text is the answer. The last step runs without tools. A call that throws is retried once with the same contents; a second failure in a row (a throw or an empty answer) is `unavailable`. `AGENT_TIMEOUT_MS = 30_000` for the whole turn, checked before each call and passed as the call's signal: the parser already spent a call and the reply still has to go out. Model and tools are injected: `agent.test.mjs` runs it with fakes, `agent.eval.mjs` with real Gemini and fake tools.

`createGeminiAgentCall` (`lib/bot/gemini.ts`) shares the parser's policy: `GEMINI_MODEL`, the switch to `GEMINI_FALLBACK_MODEL` after a failure, `GEMINI_TIMEOUT_MS` per call, `GEMINI_TEXT_THINKING_LEVEL`; the system prompt as `systemInstruction`, `temperature` 0.2, text out (no JSON mode).

### D5. The system prompt

`buildAgentPrompt` (`agent.ts`, pure): who it is (Mango's bot, read-only), today and the time zone, currency and two amounts written by `formatBotAmount` ("86,88 € o 300 €") so the model copies the format, the account's language (voseo for `es`), the categories, `MCP_INSTRUCTIONS` as the cycle rules, which tool answers what, and the reply rules: every figure from a tool called this turn (sums and differences only with figures read), plain WhatsApp text of 1–6 lines starting with an emoji, no investment advice, a request to write answered with how to say it as a load, the dashboard link only when it adds something.

### D6. Result and record

The reply is a new `BotReply` kind, `agent` (`text`, `tools`): the adapter sends it as text and clears the pending question like any text; no `lastLoad`. `outcomeOf` records `agente`, or `agente_no_disponible` when the agent's turn ends `unavailable` (same text as the parser's `no_disponible`). For a voice note the agent receives the transcription; none heard is `noEntendi` without calling the agent. `remember` stores the reply as any other.

### D7. The eval

`npm run test:agent` (`lib/bot/agent.eval.mjs`) runs the cases of `agent-cases.json` that carry `eval` against real Gemini with fake tools that answer a fixed account shaped as `summaryOf`, `movementsOf` and `fixedChargesOf` shape theirs. Per case it checks the tools called (`herramientas`, or one of `alguna`; none when both are empty), the texts the reply must name (`menciona`, case and accents aside), that every figure in the reply exists in the fixture (plus days 0–31 and the year: anything else was invented or computed) and the length. Cases without `eval` (the writes of stage 4) are skipped and listed. Like the parser's eval it runs on `GEMINI_MODEL` or `GEMINI_EVAL_MODEL`.

## Risks / Trade-offs

- **Invented figures** → the prompt rule, the eval's figure check and the stored history. If it shows up in use, force a read on the first step with `FunctionCallingConfigMode.ANY`.
- **Latency** → parser (3–5 s) + two or three agent calls (3–8 s each measured in the eval) ≈ 10–20 s, inside the 60 s; `eventos_bot.ms` for `resultado = 'agente'` measures it.
- **Amount format** → the model may write "864,00 €" where the bot writes "864 €"; the prompt shows both an amount with decimals and a whole one and says so.
- **Account data to the model** → figures and descriptions travel to Gemini (paid tier, not used for training, as the message text does today); `/privacidad` says it.
- **A computed figure fails the eval** → a sum or difference not in the fixture is reported as "not read"; the check is deliberately strict and the case is reviewed by hand when it happens.

## Open Questions

- Whether the agent should also take over `consultar` for VIP accounts (same figures, the model's wording): not now, the fixed texts are faster and byte-stable.
- When to open the agent to non-VIP accounts: after `eventos_bot` shows the share of `agente` turns and their latency over a few weeks.
