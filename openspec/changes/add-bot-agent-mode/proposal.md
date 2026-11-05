## Why

The bot is a one-shot parser: a message becomes one of eight JSON actions and a fixed text answers it. Every question that is not exactly "¿cómo vengo?" or "libre" ends in `no_entendido`: "¿cómo vengo en Comida?", "¿cuánto gasté en Netflix este año?", "Que me recomendas hacer con mi dinero ?", "Hola". `lib/bot/agent-cases.json` already holds seven real messages of Brian's that failed that way (1/10 to 26/10), and `eventos_bot` (0048) was added on 26/10 to measure before this step: stage 3 of the bot plan, agent mode. Brian asked (5/11) that VIP accounts can use the chat "as if it were an MCP": Gemini with Mango's tools. The MCP server already exposes the account as nineteen annotated tools over the same contracts the dashboard uses; the agent reuses the three that read.

## What Changes

- **A ninth parser action, `preguntar`.** `consultar` keeps only the two exact queries; any other question or request about the account's money (a category, a concrete movement, another month, savings, advice, what the bot can do) is `preguntar`. A bare greeting stays `no_entendido`.
- **Agent mode for VIP accounts, read-only.** When the parser returns `preguntar` or `no_entendido` for a VIP account, a function-calling loop over the MCP's three read tools (`get_summary`, `list_movements`, `list_fixed_charges`) answers with the account's figures, in the account's language and amount format, with the recent conversation as previous turns. At most four model calls, 30 s in all; a failure is the same "could not process it now" as today. Nothing writes; a request to log, correct or delete is answered with how to say it as a load.
- **Non-VIP accounts** get the month query for `preguntar` (it already lists every category) and "no te entendí" for `no_entendido`, as today.
- **An eval of its own**, `npm run test:agent`: the read cases of `agent-cases.json` against real Gemini with fake tools over a fixed account, checking the tools called, the names the reply must contain and that every figure in the reply was read from a tool.
- **`eventos_bot`** records `agente` and `agente_no_disponible`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bot-message-parsing`: *A message becomes exactly one action* — nine actions, with `preguntar`; *The parser is evaluated against the recorded cases* — the cases include a category question, a concrete movement in another period and an advice request as `preguntar`, and a greeting as `no_entendido`.
- `bot-conversation`: new requirement *A VIP account's open question is answered with the account's figures*.
- `bot-conversation-history`: new requirement *The agent sees the recent conversation as previous turns*.

## Impact

- **Bot**: `lib/bot/agent.ts` (pure loop and system prompt, new), `lib/bot/agent-tools.ts` (the MCP read tools on the bot's data context, new), `lib/bot/gemini.ts` (`createGeminiAgentCall`), `lib/bot/parser.ts` (`preguntar`), `lib/bot/logic.ts` (`askAgent`, the two cases of `act`, `outcomeOf`, `BotReply` kind `agent`), `lib/mcp/instructions.ts` (`MCP_INSTRUCTIONS` moved out of `server.ts` so the bot and the eval can import it without `server-only`).
- **Tests**: `lib/bot/agent.test.mjs` (new), `lib/bot/parser.test.mjs`, `lib/bot/parser-cases.json` (four cases), `lib/bot/agent-cases.json` (eval fields and five read cases), `lib/bot/agent.eval.mjs` and the `test:agent` script.
- **Database**: nothing. No migration; `eventos_bot.resultado` is free text.
- **Adapter**: unchanged; an `agent` reply is sent as text like any other.
- **Privacy**: `/privacidad` says that, on accounts with conversation history, answering a question also sends the model the account figures the question needs.
- **Docs**: CLAUDE.md, ARCHITECTURE.md §5 (advisor mode) and §11, ROADMAP.md block 13.
- **Not touched**: the web, the MCP server's behaviour for Claude and ChatGPT, writes by the agent (stage 4).
