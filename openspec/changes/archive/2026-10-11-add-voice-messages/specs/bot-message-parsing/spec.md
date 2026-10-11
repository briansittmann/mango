## MODIFIED Requirements

### Requirement: A message becomes exactly one action from the seven

Every message, whether it arrives as text or as a voice note, SHALL be parsed into exactly one action. The set of actions SHALL be: `cargar` (log a movement), `repreguntar` (a datum is missing), `no_entendido`, `consultar`, `corregir`, `borrar` and `crear_categoria`. Each action SHALL carry only the fields defined for it:

- `cargar`: `tipo` (`gasto` | `ingreso` | `ahorro`), `monto` (a number; positive for `gasto` and `ingreso`; non-zero for `ahorro`, negative meaning a withdrawal), `categoria` (one of the account's category names, or null), `descripcion` (short text or null), `dias_atras` (integer ≥ 0, 0 when the message names no day), `recurrente` (the name of one of the account's active recurring expenses when the message refers to it, otherwise null).
- `repreguntar`: `falta` (`categoria`), `tipo`, `monto`, `dias_atras`.
- `no_entendido`: no fields.
- `consultar`: `consulta` (`margen_libre` | `mes`).
- `corregir`: `monto` (optional, positive), `categoria` (optional), at least one present.
- `borrar`: no fields.
- `crear_categoria`: `nombre`, `presupuesto` (optional, positive), `confirmada` (true only when the message confirms a pending category-creation question; false otherwise).

When the message is a voice note, the audio SHALL be given to the model in the same single request as the prompt, with no separate transcription step, and every action SHALL additionally carry `transcripcion`: the literal text heard, empty when no speech was intelligible. The parser SHALL understand amounts as they are spoken ("tres cincuenta" → 3.5, "doce con cuarenta" → 12.4, "dos mil cien" → 2100). A text message SHALL NOT carry `transcripcion`.

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

#### Scenario: A spoken expense
- **WHEN** the account sends a voice note saying "café tres cincuenta"
- **THEN** the action is `cargar` with `tipo` `gasto`, `monto` 3.5, a category that fits coffee or "Otros", and `transcripcion` "café tres cincuenta" (punctuation and case aside)

#### Scenario: A spoken amount with a decimal
- **WHEN** the account sends a voice note saying "farmacia doce con cuarenta"
- **THEN** the action is `cargar` with `monto` 12.4 and `categoria` "Salud"

#### Scenario: A spoken query
- **WHEN** the account sends a voice note saying "¿cuánto me queda?"
- **THEN** the action is `consultar` with `consulta` `margen_libre` and a `transcripcion`

#### Scenario: Noise only
- **WHEN** the account sends a voice note with no intelligible speech
- **THEN** the action is `no_entendido` with an empty `transcripcion`

#### Scenario: Text carries no transcription
- **WHEN** the account types "nafta 45"
- **THEN** the action has no `transcripcion` field

### Requirement: The parser is evaluated against the recorded cases

The recorded parser cases (message, expected action and fields, the category list they assume, and optionally a pending question) SHALL be runnable as one command that calls the real model. The recorded cases SHALL include voice notes: real Ogg/Opus recordings kept with the cases, each with its expected action and fields and, where it matters, the expected transcription compared loosely (case, accents and punctuation ignored). It SHALL report, per case, whether every expected field matches the parsed action. It SHALL compare only the expected fields, with category names compared case-insensitively, and SHALL exit with failure when any case fails. The cases SHALL include at least one of each conversation action: an amount correction, a category correction, a deletion, both queries, a creation with a budget and a confirmed creation. The voice cases SHALL include at least a load with a decimal amount spoken in words, a query, a correction and a note with no speech. That command SHALL NOT be part of the unit test command, which SHALL keep running without network access or credentials.

#### Scenario: Running the evaluation
- **WHEN** the evaluation command runs with a valid model key
- **THEN** it prints one line per case with pass or fail and the parsed action on failure, and its exit code is zero only when every case passes

#### Scenario: Voice cases run too
- **WHEN** the evaluation command runs
- **THEN** every recorded voice note is sent to the model as audio and reported like a text case

#### Scenario: Unit tests stay offline
- **WHEN** the unit test command runs without a model key
- **THEN** it does not call the model and passes
