## MODIFIED Requirements

### Requirement: A VIP account's open question is answered with the account's figures

For a VIP account, a message the parser returns as `preguntar` or `no_entendido` SHALL be answered by an agent: a model that reads and changes the account through the MCP server's tools (the same nineteen the server lists) and writes the reply itself. The agent SHALL run only after the parser and only for those two actions: a load, a list, a question for a missing datum, a correction, a deletion, a query and a category creation SHALL keep their deterministic path. The agent SHALL NOT change the channel's last load.

The agent SHALL be told, in its instructions, that every figure in its reply must come from a tool called in that turn, the account's language, currency and amount format (with an example written as the bot writes amounts), the day and time zone, the account's categories, the same cycle rules the MCP server gives its clients, that a tool that writes never runs until the person confirms, that it reads the id of what it changes before proposing a change and never invents one, that it asks in text when it is not clear what to change (two rows with the same amount, a category that does not exist, a budget change in the cycle in progress without a scope), and that a plain movement of today is typed as a load. Its reply SHALL be plain WhatsApp text, short, starting with an emoji like every other reply of the bot. The agent's tools SHALL run on the bot's own data context for that account, through the same envelope as the MCP server, so an invalid argument comes back to the model as an error and every call leaves one log line without content.

The agent SHALL make at most four model calls per message, the last one without tools; a call that throws SHALL be retried once with the same conversation; two failures in a row, or the turn's budget spent (30 seconds at most, less when the parser already used part of the webhook's time), SHALL make the turn `no_disponible`, with the same reply as when the parser's model never answers, and nothing written. For a voice note the agent SHALL receive the transcription; a note with no speech SHALL be answered as not understood, without calling the agent. The outcome recorded for the message SHALL be `agente` when the agent answered, `pregunta_agente` when it asked to confirm writes, and `agente_no_disponible` when it could not.

A non-VIP account SHALL NOT reach the agent: `preguntar` SHALL be answered with the month query, which already lists every category, and `no_entendido` as before.

#### Scenario: One category
- **WHEN** a VIP account whose cycle in progress has Comida at 86,88 € of a 300 € budget sends "¿cómo vengo en comida?"
- **THEN** the agent calls `get_summary`, nothing is written, and the reply names Comida, 86,88 € and 300 € in the account's amount format

#### Scenario: A concrete movement
- **WHEN** a VIP account with Netflix charged at 12,99 € this cycle sends "cuánto gasté en netflix este mes"
- **THEN** the agent calls `list_movements` or `list_fixed_charges` and the reply names Netflix and 12,99 €

#### Scenario: Advice with the account's numbers
- **WHEN** a VIP account sends "Que me recomendas hacer con mi dinero ?"
- **THEN** the agent reads the summary and replies with one or two concrete suggestions about its spending, budgets or savings, with figures read from the tools and no investment advice

#### Scenario: A greeting
- **WHEN** a VIP account sends "Hola" or "Hola cómo estás ?"
- **THEN** the agent calls no tool and the reply greets back and says in a line what the bot can do

#### Scenario: A plain load the parser missed
- **WHEN** a VIP account sends a message the parser did not take as a load, asking to log an expense of today
- **THEN** nothing changes in the account and the reply says how to write it as a load, for example «café 3»

#### Scenario: The model never answers
- **WHEN** the agent's model call fails twice in a row, or the turn's budget is spent
- **THEN** the reply is the "could not process it now" text, nothing is written, and the outcome recorded is `agente_no_disponible`

#### Scenario: Not VIP
- **WHEN** a non-VIP account sends "¿cómo vengo en comida?"
- **THEN** no agent runs and the reply is the month query, with every category listed

## ADDED Requirements

### Requirement: A write the agent proposes waits for a tap

When the agent asks for a tool that writes (any MCP tool that is not read-only), the bot SHALL NOT run it. The model SHALL be told the call is not run yet and SHALL answer with a question of one or two lines naming exactly what will change: for a movement its description, amount and day; for a category its name and what changes, with the scope; for a fixed charge its name and what changes. The bot SHALL send that question with two reply buttons, «Sí, dale» and «No, dejalo», and SHALL hold the proposed writes (tool names and arguments, in the model's order) as the channel's pending question for 30 minutes. Several writes asked for in one response SHALL be one question and one pair of buttons.

«Sí, dale», or a message that starts with a word of assent («sí», «dale», «ok», «confirmo») while that question is pending, SHALL run the held writes in order, one by one, through the same tools and envelope, so an invalid argument is an error the reply names and never a write of something else; then one model call without tools SHALL say in one to three lines what was done, with the figures the tools returned, naming anything that failed. When that call does not answer, the reply SHALL be a fixed text ("listo", or "something could not be done" with the web's link when a write failed), because the writes already happened. The outcome recorded SHALL be the button pressed, or `agente_escribio` for a typed yes.

«No, dejalo» SHALL drop the held writes, write nothing and reply that nothing was touched. Any other message SHALL go to the agent as usual and SHALL clear the held writes. A button pressed after the question expired, or with another question pending, SHALL be discarded as every other button. Nothing the agent proposes SHALL be undone from the chat afterwards: the question names what changes before it changes.

#### Scenario: Three orders in one note
- **WHEN** a VIP account whose Comida (budget 300 €) holds Súper 32,40 € of the 4th and Mercado 54,48 € of the 3rd sends "eliminá los 32,40 de comida. no hay límite para comida este mes. borrá los 54,48"
- **THEN** nothing is written, and the reply asks in one message whether to delete Súper 32,40 € of the 4th, leave Comida without a budget this month only and delete Mercado 54,48 € of the 3rd, with the buttons «Sí, dale» and «No, dejalo»

#### Scenario: Yes
- **WHEN** that account presses «Sí, dale» within 30 minutes
- **THEN** the two movements are deleted and Comida has no budget in the cycle in progress only, the reply says so with the amounts, and the channel holds no pending question

#### Scenario: No
- **WHEN** that account presses «No, dejalo»
- **THEN** nothing changes, the reply says nothing was touched, and the channel holds no pending question

#### Scenario: Typed yes
- **WHEN** the question is pending and the account types "dale"
- **THEN** the writes run as if the button had been pressed, and the outcome recorded is `agente_escribio`

#### Scenario: Another message instead
- **WHEN** the question is pending and the account sends "¿cuánto gasté en comida?"
- **THEN** the held writes are dropped, nothing is written, and the question is answered

#### Scenario: Not clear what to change
- **WHEN** a VIP account sends "cambiame el presupuesto de comida a 400" in the cycle in progress, without saying the scope
- **THEN** nothing is proposed and the reply asks whether it is only this month or from this month on

#### Scenario: Nothing to change
- **WHEN** a VIP account without a Delivery category sends "eliminar los 7.000 de delivery"
- **THEN** nothing is proposed and the reply says there is no Delivery and names what there is

#### Scenario: A write fails on Yes
- **WHEN** the account presses «Sí, dale» and a held delete names a row that no longer exists
- **THEN** the other writes still run, and the reply names what was done and what could not be
