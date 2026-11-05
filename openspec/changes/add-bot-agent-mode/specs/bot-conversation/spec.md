## ADDED Requirements

### Requirement: A VIP account's open question is answered with the account's figures

For a VIP account, a message the parser returns as `preguntar` or `no_entendido` SHALL be answered by an agent: a model that reads the account through the MCP server's three read tools (`get_summary`, `list_movements`, `list_fixed_charges`) and writes the reply itself. The agent SHALL run only after the parser and only for those two actions: a load, a list, a question for a missing datum, a correction, a deletion, a query and a category creation SHALL keep their deterministic path. The agent SHALL have no tool that writes; a message that asks it to log, correct or delete something SHALL be answered by telling the person how to say it as a load, and nothing SHALL change in the account. The agent SHALL hold no pending question and SHALL NOT change the channel's last load.

The agent SHALL be told, in its instructions, that every figure in its reply must come from a tool called in that turn, the account's language, currency and amount format (with an example written as the bot writes amounts), the day and time zone, the account's categories, the same cycle rules the MCP server gives its clients, and that it only reads. Its reply SHALL be plain WhatsApp text, short, starting with an emoji like every other reply of the bot. The agent's tools SHALL run on the bot's own data context for that account, through the same envelope as the MCP server, so an invalid argument comes back to the model as an error and every call leaves one log line without content.

The agent SHALL make at most four model calls per message, the last one without tools; a call that throws SHALL be retried once with the same conversation; two failures in a row, or a total budget of 30 seconds spent, SHALL make the turn `no_disponible`, with the same reply as when the parser's model never answers, and nothing written. For a voice note the agent SHALL receive the transcription; a note with no speech SHALL be answered as not understood, without calling the agent. The outcome recorded for the message SHALL be `agente` when the agent answered and `agente_no_disponible` when it could not.

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

#### Scenario: A request to write
- **WHEN** a VIP account sends a message the parser did not take as a load, asking the agent to log, correct or delete something
- **THEN** nothing changes in the account and the reply says how to write it as a load, for example «café 3», «no, era 40» or «borrá eso»

#### Scenario: The model never answers
- **WHEN** the agent's model call fails twice in a row, or the turn's budget of 30 seconds is spent
- **THEN** the reply is the "could not process it now" text, nothing is written, and the outcome recorded is `agente_no_disponible`

#### Scenario: Not VIP
- **WHEN** a non-VIP account sends "¿cómo vengo en comida?"
- **THEN** no agent runs and the reply is the month query, with every category listed
