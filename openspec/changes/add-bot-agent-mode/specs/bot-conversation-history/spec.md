## ADDED Requirements

### Requirement: The agent sees the recent conversation as previous turns

When a VIP account's message goes to the agent, the agent SHALL receive the same recent conversation the parser receives (the last 20 stored messages of the last 24 hours, oldest first) as previous turns of the chat: the account's messages as the user's and the bot's replies as the model's, before the new message. It SHALL use them to understand the new message ("¿y en Ocio?" after a question about Comida) and SHALL answer the new message alone. The agent's reply SHALL be stored like any other reply of the bot.

#### Scenario: A follow-up question
- **WHEN** a VIP account asked "¿cómo vengo en comida?" a minute ago and now sends "¿y en ocio?"
- **THEN** the agent receives both the earlier question and its reply as previous turns, and answers about Ocio

#### Scenario: The reply is stored
- **WHEN** the agent answers a VIP account
- **THEN** the incoming message and the agent's reply are stored as that account's exchange, like a parser reply
