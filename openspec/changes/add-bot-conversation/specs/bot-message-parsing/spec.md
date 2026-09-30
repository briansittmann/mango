## REMOVED Requirements

### Requirement: A message becomes exactly one action from a fixed set
**Reason**: Its scenario about actions the bot does not execute yet stops being true, and `crear_categoria` gains fields.
**Migration**: Replaced by *A message becomes exactly one action from the seven* below, with the same actions and fields plus `presupuesto` and `confirmada`.

## ADDED Requirements

### Requirement: A message becomes exactly one action from the seven

Every text message SHALL be parsed into exactly one action. The set of actions SHALL be: `cargar` (log a movement), `repreguntar` (a datum is missing), `no_entendido`, `consultar`, `corregir`, `borrar` and `crear_categoria`. Each action SHALL carry only the fields defined for it:

- `cargar`: `tipo` (`gasto` | `ingreso` | `ahorro`), `monto` (a number; positive for `gasto` and `ingreso`; non-zero for `ahorro`, negative meaning a withdrawal), `categoria` (one of the account's category names, or null), `descripcion` (short text or null), `dias_atras` (integer ≥ 0, 0 when the message names no day), `recurrente` (the name of one of the account's active recurring expenses when the message refers to it, otherwise null).
- `repreguntar`: `falta` (`categoria`), `tipo`, `monto`, `dias_atras`.
- `no_entendido`: no fields.
- `consultar`: `consulta` (`margen_libre` | `mes`).
- `corregir`: `monto` (optional, positive), `categoria` (optional), at least one present.
- `borrar`: no fields.
- `crear_categoria`: `nombre`, `presupuesto` (optional, positive), `confirmada` (true only when the message confirms a pending category-creation question; false otherwise).

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

#### Scenario: Conversation actions
- **WHEN** the account sends "no, era 40", "borrá eso", "crea categoria Musica", "libre" and "¿cómo vengo?"
- **THEN** the actions are `corregir` with `monto` 40, `borrar`, `crear_categoria` with `nombre` "Música" and `confirmada` false, `consultar` with `consulta` `margen_libre` and `consultar` with `consulta` `mes`

#### Scenario: A category correction in loose words
- **WHEN** the account sends "osea lo que gaste esos 50 eran comida"
- **THEN** the action is `corregir` with `categoria` "Comida"

#### Scenario: Category with a budget
- **WHEN** the account sends "nueva categoría Viajes, presupuesto 200"
- **THEN** the action is `crear_categoria` with `nombre` "Viajes", `presupuesto` 200 and `confirmada` false

#### Scenario: Gibberish
- **WHEN** the account sends "asdasda"
- **THEN** the action is `no_entendido`

## MODIFIED Requirements

### Requirement: A pending question is context for the next message

When the bot's previous turn left a question pending on the channel, the parser SHALL receive it together with the new message. There are two kinds. A category question carries the type, amount and days ago: a message that answers it with a category SHALL produce `cargar` with the pending amount and that category. A category-creation question carries the name, the optional budget and the similar category: a message that affirms it ("sí", "dale", "creala") SHALL produce `crear_categoria` with that name and budget and `confirmada` true. A message that does not answer the pending question SHALL be parsed on its own, as if nothing were pending, and SHALL never carry `confirmada` true.

#### Scenario: Answer to the question
- **WHEN** the pending question is "which category for an expense of 50" and the account sends "comida"
- **THEN** the action is `cargar` with `tipo` `gasto`, `monto` 50 and `categoria` "Comida"

#### Scenario: A new expense instead of an answer
- **WHEN** the same question is pending and the account sends "nafta 45"
- **THEN** the action is `cargar` with `monto` 45 and `categoria` "Transporte", and the pending 50 is not loaded

#### Scenario: Confirming a creation
- **WHEN** the pending question is "create Mascota even though Mascotas exists?" and the account sends "sí"
- **THEN** the action is `crear_categoria` with `nombre` "Mascota" and `confirmada` true

#### Scenario: A plain "sí" with nothing pending
- **WHEN** nothing is pending and the account sends "sí"
- **THEN** the action is `no_entendido`

### Requirement: The parser is evaluated against the recorded cases

The recorded parser cases (message, expected action and fields, the category list they assume, and optionally a pending question) SHALL be runnable as one command that calls the real model. It SHALL report, per case, whether every expected field matches the parsed action. It SHALL compare only the expected fields, with category names compared case-insensitively, and SHALL exit with failure when any case fails. The cases SHALL include at least one of each conversation action: an amount correction, a category correction, a deletion, both queries, a creation with a budget and a confirmed creation. That command SHALL NOT be part of the unit test command, which SHALL keep running without network access or credentials.

#### Scenario: Running the evaluation
- **WHEN** the evaluation command runs with a valid model key
- **THEN** it prints one line per case with pass or fail and the parsed action on failure, and its exit code is zero only when every case passes

#### Scenario: Unit tests stay offline
- **WHEN** the unit test command runs without a model key
- **THEN** it does not call the model and passes
