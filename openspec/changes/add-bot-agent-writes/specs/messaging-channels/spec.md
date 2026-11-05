## MODIFIED Requirements

### Requirement: A channel holds at most one pending question

A channel MAY hold one pending question with an expiry. The question SHALL be a category question, a category-creation confirmation, a deposit question, a repeated-charge question or the agent's confirmation, which carries the writes the agent proposed (tool names and arguments). Writing a new question of any kind SHALL replace the previous one. A question whose expiry has passed SHALL be treated as absent. Clearing the question SHALL leave the channel without one. The pending question SHALL NOT be readable or writable with the public (anon or signed-in) key. Deleting the channel SHALL delete its question.

#### Scenario: Replace
- **WHEN** a channel holds a pending question and a new one is written
- **THEN** reading the channel returns only the new question

#### Scenario: Replace across kinds
- **WHEN** a channel holds a category question and a category-creation confirmation is written
- **THEN** reading the channel returns only the confirmation

#### Scenario: The agent's writes wait on the channel
- **WHEN** the agent proposes two writes and the question is written
- **THEN** reading the channel within 30 minutes returns the question `agente` with both writes, in order

#### Scenario: Expired
- **WHEN** a channel's question expired one minute ago
- **THEN** reading the channel returns no pending question

#### Scenario: Public key
- **WHEN** a signed-in user reads or writes a channel's pending question with the public key
- **THEN** no row is returned and nothing is written
