## Context

`add-bot-agent-mode` (5/11) gave VIP accounts an agent: `runAgent` (`lib/bot/agent.ts`, pure) loops Gemini function calling over the three MCP read tools, wrapped by `agentToolsFor` (`lib/bot/agent-tools.ts`) through `callTool` on a `ToolContext` built from the turn. The MCP's other sixteen tools (`lib/mcp/tools/{movements,categories,fixed,cards}.ts`) write through the dashboard's contracts and already filter by `usuario_id`; their hints (`lib/mcp/catalog.ts`) say which are read-only. The bot already holds one pending question per channel with buttons (`deposito`, `cargo_repetido`): `BotReply` kind `ask`, `ANSWER_BUTTONS` in `handle-message.ts`, `message.answer` in `processMessage`. `createGeminiModel` runs text with `thinkingLevel LOW` and voice with the default; `GEMINI_TIMEOUT_MS` is 12 s per call, two calls per parse. The webhook's `maxDuration` is 60 s.

What happened on 5/11 (`eventos_bot`, `mensajes`): Lean's three voice notes ended `no_disponible` after 24,6 s each (two timeouts), never reaching the agent; his short texts and short notes in the same minutes took 4–6 s. Brian's decisions: every write asks with buttons; fix the voice timeout here; tell the person when it will take a while.

## Goals / Non-Goals

**Goals:**
- A VIP account changes anything the MCP changes, from the chat, with one confirmation per message.
- Nothing is written without a tap (or a typed yes) on the question that names the change.
- A long voice note gets answered, and the person sees the bot working meanwhile.
- Measurable: the eval checks the plan proposed; `eventos_bot` records the question, the tap and the writes.

**Non-Goals:**
- Undo after a confirmed write (the question names exactly what changes; the web restores).
- A confirmation that chooses the scope with buttons (only_this_month / from_this_month): the model asks in text first, the next message carries the answer in the history.
- The agent for non-VIP accounts.
- Changing the MCP server's behaviour for Claude and ChatGPT.

## Decisions

### D1. The nineteen tools, the writes marked `confirm`

`agentToolsFor` maps `TOOLS` instead of `readTools`; each `AgentTool` carries `confirm = !tool.annotations.readOnlyHint`. The tools run on the same `ToolContext` as today, plus `admin: true`: `add_movement` spends the daily quota with `consumir_cupo_altas_usuario(p_usuario_id)` (service role, the RPC `load` already uses) instead of `consumir_cupo_altas()`, which reads `auth.uid()` and has none on the admin client. Nothing else in `lib/mcp/` changes; the admin client's isolation is the explicit `usuario_id` filter every tool carries (`readRow`, `inMonth`, `readFixedCharges`…).

### D2. A write is proposed, not run (`lib/bot/agent.ts`, pure)

In the loop, a response whose calls include a `confirm` tool runs the read calls as always and answers each write with `{ code: 'needs-confirmation', message }`. The next call runs without tools, so the model's text is the question. The result is `{ kind: 'confirm', text, calls: PlannedCall[], toolCalls }`: the writes in the order the model gave them, with their arguments as given. An empty question counts as a failed call (two in a row → `unavailable`), like today. Several orders in a message become one response with several write calls, hence one question.

The agent's model call gets 20 s per call (`GEMINI_AGENT_CALL_TIMEOUT_MS`) instead of the parser's 12 s: with nineteen tools declared, the call after a tool result passed 12 s in 9 of 76 eval cases and was aborted, once twice in a row (an `unavailable`); the budget still bounds the turn. `AgentInput.budgetMs` replaces the fixed `AGENT_TIMEOUT_MS`: the bot passes `min(30 s, 50 s − elapsed)` (`TURN_BUDGET_MS`), measured from the turn's start, so parser plus agent fit in the webhook's 60 s with the send.

`narrateResults` is one call without tools: the history, then a user message with "La persona tocó «Sí»…" and one line per write (`name args → response`). It returns the text or null after a failed and an empty attempt. A null falls back to a fixed text, because the writes already happened and must never go unanswered.

### D3. The pending question `agente` and its two buttons

`PendingQuestion` gains `{ pregunta: 'agente', llamadas: PlannedCall[] }`, stored on the channel like the others (30 minutes). `askAgent` turns a `confirm` result into `{ kind: 'ask', text, pending, buttons: [confirm, cancel] }`; the adapter already stores the question and sends the buttons. `QuestionAnswer` gains `confirm` and `cancel` (`agente:si`, `agente:no`, counted only while `agente` is pending, as every other button). `answerAgent`: cancel → `agenteCancelado`; confirm → `confirmAgent`, which runs the `llamadas` in order, one by one, through `agentToolsFor` (the envelope parses the arguments again, so a bad one is an error object, never a throw), then `narrateResults`; the reply is `agent` with `wrote: true`, and `eventos_bot` gets `boton_confirm` / `boton_cancel` from the press, or `agente_escribio` when the yes was typed. A typed "sí"/"dale"/"ok" (`YES_WORDS`) while `agente` is pending reaches `act` as `no_entendido` (the parser has no block for that question and a loose yes is `no_entendido` by rule) and is treated as the button. Any other message goes to the agent as usual and the adapter clears the question.

### D4. The prompt

`buildAgentPrompt` loses "Solo leés". New block ESCRIBIR: a write tool returns `needs-confirmation`, so answer only with a one-or-two-line question naming exactly what changes (a movement: description, amount and day; a category: name and what changes, with the scope; a fixed charge: name and what changes), without ✅; read before writing (ids from `list_movements`, `get_summary`, `list_fixed_charges`; never invent one); several orders → every write in the same response; ambiguity (two rows with the same amount, a missing category, a budget change in the cycle in progress without a scope) → ask in text before proposing; the scope words (`only_this_month` / `from_this_month`, "sin límite" → `budget: null`); a plain expense of today is typed as a load, `add_movement` only for another date or month; after a confirmation, 1–3 lines with what was done. The MCP section keeps the connection steps and drops "what it does and the chat does not": the chat does it now.

### D5. Voice: the retry thinks less, and the chat shows the bot working

- `createGeminiModel`: `thinkingConfig LOW` when `!audio || failed`. The first call over a note keeps the default (transcriptions in words); its retry, today on the fallback model with default thinking and a second 12 s timeout, runs with `LOW`. `GEMINI_TIMEOUT_MS` stays 12 s.
- `sendTyping(phone, messageId)` (`send.ts`): `POST /messages` with `status: 'read'`, `message_id` and `typing_indicator: { type: 'text' }`: read receipt and "typing…" until the reply, 25 s at most. A status has no `to`, so `send` splits into `send` (adds `to`) and `post`. `handleIncoming` calls it (dep `markTyping`) after the idempotency and media checks, for every message of a known number: it covers the agent's 4–13 s turns without a message.
- A note of `LONG_AUDIO_SECONDS` (10) or more, measured with `oggOpusDurationSeconds` already used for the 30 s limit, gets `bot.unMomento` before `handleKnown`: two model calls over it can outlast the indicator. The text is the adapter's (not stored in the history), like the linking replies.

### D6. The eval

`agent.eval.mjs` declares the sixteen write tools by hand (the real modules import Supabase through `@/`) with the same names, the gist of each description and the arguments the cases use, `confirm: true`. A case with `plan` must end `confirm` with exactly those writes (name and a subset of the arguments, order-free, no extra write) and nothing run; a case without `plan` must end `answered`. `menciona` applies to the question's text. Figures the person said in the message are not "invented". Cases: Lean's three orders over the fixed account (Súper 32,40 and Mercado 54,48 in Comida), Lean's literal text (no Delivery: no plan), "borrá el cine", a budget change with and without scope, a fixed charge paid, an expense in another month, and the old "Elimina categoría mascota" now expecting no plan.

## Risks / Trade-offs

- **A misheard note proposes the wrong delete** → the question names description, amount and day, and nothing runs without the tap; a confirmed delete is restored from the web (no Undo here, technical debt).
- **The model proposes a write with a wrong or invented id** → the envelope validates the arguments and the tool answers `not-found`; the narration says what was not done. The prompt forbids inventing ids and the eval checks the ids proposed.
- **Latency** → read calls + the question (3 calls) ≈ 8–15 s, then on «Sí» the writes + one narration call ≈ 3–8 s; the budget is what is left of the turn. "typing…" covers both.
- **The typing indicator** → if the number's API version rejects the status payload, `post` logs and nothing else changes; verified in the WhatsApp round.
- **A typed "sí" to an unrelated question** → only while `agente` is pending (30 minutes) and only words that start the message; any other text goes to the agent and clears the question.
- **`LOW` on a voice retry transcribes amounts in digits** → only on the retry, which today never answers; the action and the amount were right in the 26/10 measurement, only the quoted text changed.

## Open Questions

- Whether a confirmed `add_movement` should become the channel's last load and count in the progressive confirmation, like a parser load: not now.
- Whether `delete_category` should offer the scope with buttons instead of a text question: three buttons is Meta's limit and the «No» is needed.
