## Why

On 5/11 Lean (a VIP account) sent a voice note with three orders: delete the 7.000 of delivery, no limit for Delivery this month, delete the 3.000. He got "⏳ No pude procesar tu mensaje ahora". Two things failed, one after the other. The parser's two calls over the audio both hit the 12 s timeout (24,6 s per message in `eventos_bot`, three times in a row), so the note never reached the agent. And had it arrived, the agent of `add-bot-agent-mode` is read-only: it would have said that the chat cannot do that yet and pointed to the web or to Claude/ChatGPT. Brian asked (5/11) that a VIP account can use the chat "as if it were an MCP", with every write asking first, and that the person is told when the bot is going to take a while.

## What Changes

- **The agent gets every MCP tool.** `agentToolsFor` maps the nineteen tools of `lib/mcp/tools`, not the three reads. A tool that is not read-only is a write: the loop never runs it. When the model asks for one, the call comes back as `needs-confirmation`, the model writes a one-line question naming exactly what will change, and the bot sends it with two buttons, «Sí, dale» / «No, dejalo». The writes wait on the channel as the pending question `agente` (30 minutes). «Sí» (the button, or a typed "sí"/"dale"/"ok") runs them in order through the same tools and one model call says what was done; «No» drops them. Several orders in one message are one question and one «Sí».
- **`add_movement` from the bot** spends the daily quota by account id (`consumir_cupo_altas_usuario`), because the admin client has no `auth.uid()`; `ToolContext.admin` says so.
- **A voice note's retry thinks less.** The second parser call over a voice note runs with `thinkingLevel LOW`, as text already does; the first keeps the default so the transcription stays in words.
- **The chat shows the bot working.** Every message of a linked chat marks it read and shows "typing…" (the Cloud API's typing indicator, up to 25 s). A voice note of 10 s or more also gets "⏳ Dame un momento, estoy escuchando el audio…" before the models run.
- **The agent's budget is what is left of the turn** (at most 30 s, within the webhook's 60 s), so a slow parser plus the agent still reply.
- **The eval** adds write cases with the plan each must propose (`plan` in `agent-cases.json`), and the person's own figures no longer count as invented.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bot-conversation`: *A VIP account's open question is answered with the account's figures* becomes a read-and-write agent that never writes without a tap; new requirement *A write the agent proposes waits for a tap*.
- `messaging-channels`: *A channel holds at most one pending question* admits the agent's question with its pending writes.
- `bot-voice-messages`: new requirement *A long note is acknowledged first*; the chat shows "typing…" for every message.

## Impact

- **Bot**: `lib/bot/agent.ts` (`confirm` tools, `confirm` result, `budgetMs`, `narrateResults`, the prompt's write rules), `lib/bot/agent-tools.ts` (`TOOLS`, `confirm`, `admin`), `lib/bot/logic.ts` (`QuestionAnswer` confirm/cancel, `askAgent` → `ask`, `confirmAgent`, `answerAgent`, `YES_WORDS`, `TURN_BUDGET_MS`, `agente_escribio`), `lib/bot/parser.ts` (`PendingQuestion` `agente`), `lib/bot/gemini.ts` (LOW on the voice retry).
- **MCP**: `lib/mcp/context.ts` (`ToolContext.admin`), `lib/mcp/tools/movements.ts` (`add_movement`'s quota RPC by `admin`). Nothing changes for Claude and ChatGPT.
- **Adapter**: `lib/whatsapp/handle-message.ts` (`agente:si` / `agente:no`, `markTyping`, `LONG_AUDIO_SECONDS`, `unMomento`), `lib/whatsapp/adapter.ts`, `lib/whatsapp/send.ts` (`sendTyping`).
- **Texts**: `bot.botonSiDale`, `botonNo`, `agenteCancelado`, `agenteHecho`, `agenteFallo`, `unMomento` in `messages/*.json`.
- **Tests**: `lib/bot/agent.test.mjs`, `lib/whatsapp/adapter.test.mjs`, `lib/bot/agent.eval.mjs`, `lib/bot/agent-cases.json`.
- **Database**: nothing. No migration; `eventos_bot.resultado` is free text (`pregunta_agente`, `boton_confirm`, `boton_cancel`, `agente_escribio`).
- **Docs**: CLAUDE.md, ARCHITECTURE.md §5, ROADMAP.md block 13. `/privacidad` unchanged: nothing new travels to the model.
- **Not touched**: the web, non-VIP accounts (they never reach the agent), Undo after a confirmed write (technical debt).
