## Purpose

Turns a free-text chat message ("nafta 45 ayer") into one structured action the bot can act on, using the account's own categories and recurring expenses, and guarantees the shape of that action before anything is written.

## ADDED Requirements

### Requirement: A message becomes exactly one action from a fixed set

Every text message SHALL be parsed into exactly one action. The set of actions SHALL be: `cargar` (log a movement), `repreguntar` (a datum is missing), `no_entendido`, `consultar`, `corregir`, `borrar` and `crear_categoria`. Each action SHALL carry only the fields defined for it:

- `cargar`: `tipo` (`gasto` | `ingreso` | `ahorro`), `monto` (a number; positive for `gasto` and `ingreso`; non-zero for `ahorro`, negative meaning a withdrawal), `categoria` (one of the account's category names, or null), `descripcion` (short text or null), `dias_atras` (integer ≥ 0, 0 when the message names no day), `recurrente` (the name of one of the account's active recurring expenses when the message refers to it, otherwise null).
- `repreguntar`: `falta` (`categoria`), `tipo`, `monto`, `dias_atras`.
- `no_entendido`: no fields.
- `consultar`: `consulta` (`margen_libre` | `mes`).
- `corregir`: `monto` (optional), `categoria` (optional), at least one present.
- `borrar`: no fields.
- `crear_categoria`: `nombre`.

Output that is not valid JSON, names another action or carries fields outside this contract SHALL be rejected before it reaches the logging step.

#### Scenario: A plain expense
- **WHEN** an account with categories Vivienda, Comida, Transporte, Ocio, Salud, Suplementos, Suscripciones, Deudas and Otros sends "nafta 45 ayer"
- **THEN** the action is `cargar` with `tipo` `gasto`, `monto` 45, `categoria` "Transporte" and `dias_atras` 1

#### Scenario: Decimal comma and trailing punctuation
- **WHEN** the same account sends "cafe 3,5."
- **THEN** the action is `cargar` with `monto` 3.5, `tipo` `gasto`, `categoria` "Ocio" and `dias_atras` 0

#### Scenario: A word that is a description, not a date
- **WHEN** the account sends "date 80"
- **THEN** the action is `cargar` with `monto` 80, `categoria` "Ocio" and `dias_atras` 0

#### Scenario: Income
- **WHEN** the account sends "cobré 2100"
- **THEN** the action is `cargar` with `tipo` `ingreso`, `monto` 2100, `dias_atras` 0 and `recurrente` null

#### Scenario: Income with a description
- **WHEN** the account sends "propina 500"
- **THEN** the action is `cargar` with `tipo` `ingreso`, `monto` 500, `descripcion` "Propina" and `recurrente` null

#### Scenario: Savings deposit and withdrawal
- **WHEN** the account sends "ahorré 200" and then "saqué 100 del ahorro"
- **THEN** the first action is `cargar` with `tipo` `ahorro` and `monto` 200, and the second is `cargar` with `tipo` `ahorro` and `monto` -100

#### Scenario: Actions the bot does not execute yet are still recognised
- **WHEN** the account sends "no, era 40", "borrá eso", "crea categoria Musica", "libre" and "¿cómo vengo?"
- **THEN** the actions are `corregir` with `monto` 40, `borrar`, `crear_categoria` with `nombre` "Música", `consultar` with `consulta` `margen_libre` and `consultar` with `consulta` `mes`

#### Scenario: Gibberish
- **WHEN** the account sends "asdasda"
- **THEN** the action is `no_entendido`

### Requirement: The parser works with the account's own categories and recurring expenses

The category names offered to the parser SHALL be the account's categories as stored, read at parse time; no category name SHALL be fixed in the code. A `cargar` action's `categoria` SHALL be one of those names or null; a description that fits no category SHALL map to the account's "Otros" when it exists, without asking. The parser SHALL also receive the names of the account's active recurring expenses (`gasto` definitions only) and SHALL set `recurrente` only when the message refers to one of them by name. An `ingreso` SHALL never carry `recurrente`.

#### Scenario: Supermarket goes to Comida
- **WHEN** an account without a "Supermercado" category but with "Comida" sends "30 super"
- **THEN** the action is `cargar` with `monto` 30 and `categoria` "Comida"

#### Scenario: Nothing fits
- **WHEN** an account with an "Otros" category sends "regalo 40" and no category fits a gift
- **THEN** the action is `cargar` with `categoria` "Otros" and it is not `repreguntar`

#### Scenario: Renamed category
- **WHEN** the account renames "Ocio" to "Salidas" on the web and then sends "cine 12"
- **THEN** the action's `categoria` is "Salidas"

#### Scenario: A recurring expense by name
- **WHEN** the account has an active recurring expense "Netflix" and sends "netflix 13"
- **THEN** the action is `cargar` with `tipo` `gasto`, `monto` 13 and `recurrente` "Netflix"

#### Scenario: Salary is not a recurring match
- **WHEN** the account has a recurring income "Sueldo" and sends "cobré 2100"
- **THEN** the action is `cargar` with `tipo` `ingreso` and `recurrente` null

### Requirement: An amount without any description asks for the category

When a message states an expense amount and nothing that could identify what it was spent on, the action SHALL be `repreguntar` with `falta` `categoria`, the `tipo` and the `monto`. A message with any description SHALL NOT produce `repreguntar`: it maps to a category or to "Otros".

#### Scenario: Bare amount
- **WHEN** the account sends "gasté 50"
- **THEN** the action is `repreguntar` with `falta` `categoria`, `tipo` `gasto` and `monto` 50

#### Scenario: Vague description still loads
- **WHEN** the account sends "cosas 50"
- **THEN** the action is `cargar`, with "Otros" or a fitting category, never `repreguntar`

### Requirement: A pending question is context for the next message

When the bot's previous turn asked for the category of an amount, the parser SHALL receive that pending question (type, amount, days ago) together with the new message. A message that answers it with a category SHALL produce `cargar` with the pending amount and that category. A message that does not answer it SHALL be parsed on its own, as if nothing were pending.

#### Scenario: Answer to the question
- **WHEN** the pending question is "which category for an expense of 50" and the account sends "comida"
- **THEN** the action is `cargar` with `tipo` `gasto`, `monto` 50 and `categoria` "Comida"

#### Scenario: A new expense instead of an answer
- **WHEN** the same question is pending and the account sends "nafta 45"
- **THEN** the action is `cargar` with `monto` 45 and `categoria` "Transporte", and the pending 50 is not loaded

### Requirement: Invalid model output is retried once

When the model's output is not valid JSON or does not satisfy the action contract, the parser SHALL ask the model once more, telling it what was wrong. When the second output is invalid too, the result SHALL be `no_entendido`. The parser SHALL never call the model more than twice for one message, and SHALL never pass an unvalidated object on.

#### Scenario: First output broken, second valid
- **WHEN** the first output is truncated JSON and the second is a valid `cargar`
- **THEN** the result is that `cargar` and the model was called twice

#### Scenario: Both outputs invalid
- **WHEN** both outputs name an action outside the set
- **THEN** the result is `no_entendido` and the model was called exactly twice

#### Scenario: Model unavailable
- **WHEN** the model request fails with a network or quota error on both attempts
- **THEN** the result is `no_entendido` and nothing is written

### Requirement: The parser speaks the account's language

The parser SHALL receive the account's language (`es` | `en`) and SHALL understand messages written in it. Spanish SHALL be the default. Recognising a message in the other language SHALL NOT be required.

#### Scenario: English account
- **WHEN** an account with language `en` and a "Transport" category sends "gas 45 yesterday"
- **THEN** the action is `cargar` with `monto` 45, `categoria` "Transport" and `dias_atras` 1

### Requirement: The parser is evaluated against the recorded cases

The recorded parser cases (message, expected action and fields, the category list they assume) SHALL be runnable as one command that calls the real model and reports, per case, whether every expected field matches the parsed action, comparing only the expected fields, category names case-insensitively, and exiting with failure when any case fails. That command SHALL NOT be part of the unit test command, which SHALL keep running without network access or credentials.

#### Scenario: Running the evaluation
- **WHEN** the evaluation command runs with a valid model key and the 15 recorded cases
- **THEN** it prints one line per case with pass or fail and the parsed action on failure, and its exit code is zero only when all 15 pass

#### Scenario: Unit tests stay offline
- **WHEN** the unit test command runs without a model key
- **THEN** it does not call the model and passes
