## RENAMED Requirements

- FROM: `### Requirement: A message becomes exactly one action from the seven`
- TO: `### Requirement: A message becomes exactly one action`

## MODIFIED Requirements

### Requirement: A message becomes exactly one action

Every message, whether it arrives as text or as a voice note, SHALL be parsed into exactly one action. The set of actions SHALL be: `cargar` (log a movement), `cargar_varios` (log several movements), `repreguntar` (a datum is missing), `no_entendido`, `consultar`, `corregir`, `borrar` and `crear_categoria`. Each action SHALL carry only the fields defined for it:

- `cargar`: `tipo` (`gasto` | `ingreso` | `ahorro` | `transferencia`), `monto` (a number; positive for `gasto`, `ingreso` and `transferencia`; non-zero for `ahorro`, negative meaning a withdrawal), `categoria` (one of the account's category names, or null; always null for `ingreso`, `ahorro` and `transferencia`), `descripcion` (short text or null), `dias_atras` (integer ≥ 0, 0 when the message names no day), `recurrente` (the name of one of the account's active recurring expenses when the message refers to it, otherwise null; always null for `transferencia`), `medio_pago` (`efectivo` | `tarjeta` | null). For `gasto` and `ingreso`, `medio_pago` SHALL be the method the message says ("en efectivo", "con tarjeta", "cash", "by card") and null when it says none: the parser SHALL NOT guess it and SHALL NOT apply any default. For `transferencia` it SHALL be the pocket the money goes into and SHALL NOT be null: taking cash out of the bank or an ATM ("saqué 200", "saqué del cajero") is `efectivo`; putting cash into the bank ("deposité las propinas", "ingresé el efectivo al banco") is `tarjeta`. Taking money out of savings ("saqué 100 del ahorro") SHALL stay `ahorro` with a negative amount. For `ahorro` it SHALL be null.
- `cargar_varios`: `cargas`, a list of 2 to 20 items, each one a `cargar` with exactly the fields and rules above, in the order the message names them. It SHALL be used when the message names more than one movement, whether separated by commas, by "y"/"and" or by lines; a message with one movement SHALL be a `cargar`. A list with a single item, or a bare list of `cargar` objects, SHALL be accepted as the equivalent `cargar` or `cargar_varios`.
- `repreguntar`: `falta` (`categoria` | `deposito`), `tipo`, `monto`, `dias_atras`. `deposito` SHALL be used only when the message puts an amount into the bank and could be either a new income or cash moved from the cash pocket ("ingresé 200 en el banco"); it carries `tipo` `ingreso` and the optional `descripcion`. A message that says which ("cobré 200 en el banco", "deposité 200 del efectivo") SHALL NOT produce it. The parser SHALL NOT ask for the payment method in any other case.
- `no_entendido`: no fields.
- `consultar`: `consulta` (`margen_libre` | `mes`).
- `corregir`: `monto` (optional, positive), `categoria` (optional), at least one present, and `cual` (optional): the movement the message names as the one to correct ("la nafta era 40" → `cual` "nafta"), null when it names none.
- `borrar`: `cual` (optional), the movement the message names as the one to delete ("borrá el cine" → `cual` "cine"), null when it names none.
- `crear_categoria`: `nombre`, `presupuesto` (optional, positive), `confirmada` (true only when the message confirms a pending category-creation question; false otherwise).

When the message is a voice note, the audio SHALL be given to the model in the same single request as the prompt, with no separate transcription step, and every action SHALL additionally carry `transcripcion`: the literal text heard, empty when no speech was intelligible. A voice note naming several movements SHALL be a `cargar_varios` with one `transcripcion`. The parser SHALL understand amounts as they are spoken ("tres cincuenta" → 3.5, "doce con cuarenta" → 12.4, "dos mil cien" → 2100). A text message SHALL NOT carry `transcripcion`.

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
- **THEN** the actions are `corregir` with `monto` 40 and no `cual`, `borrar` with no `cual`, `crear_categoria` with `nombre` "Música" and `confirmada` false, `consultar` with `consulta` `margen_libre` and `consultar` with `consulta` `mes`

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

#### Scenario: A method the message says
- **WHEN** the account sends "pagué 15 en efectivo de cervezas"
- **THEN** the action is `cargar` with `tipo` `gasto`, `monto` 15, `categoria` "Ocio" and `medio_pago` `efectivo`

#### Scenario: No method said
- **WHEN** the account sends "nafta 45"
- **THEN** the action is `cargar` with `medio_pago` null, whatever the account's default

#### Scenario: A withdrawal from the ATM
- **WHEN** the account sends "saqué 200"
- **THEN** the action is `cargar` with `tipo` `transferencia`, `monto` 200, `medio_pago` `efectivo`, `categoria` null and `recurrente` null

#### Scenario: A deposit of tips
- **WHEN** the account sends "deposité las propinas, 120"
- **THEN** the action is `cargar` with `tipo` `transferencia`, `monto` 120 and `medio_pago` `tarjeta`

#### Scenario: Savings withdrawal stays savings
- **WHEN** the account sends "saqué 100 del ahorro"
- **THEN** the action is `cargar` with `tipo` `ahorro`, `monto` -100 and `medio_pago` null

#### Scenario: Income or deposit
- **WHEN** the account sends "ingresé 200 en el banco"
- **THEN** the action is `repreguntar` with `falta` `deposito`, `tipo` `ingreso` and `monto` 200

#### Scenario: A transfer without a destination is rejected
- **WHEN** the model returns `cargar` with `tipo` `transferencia` and `medio_pago` null, or with a `categoria`
- **THEN** the output is rejected and retried as any invalid output

#### Scenario: A list separated by commas
- **WHEN** the account sends "café 3, súper 25 y nafta 40"
- **THEN** the action is `cargar_varios` with three items in that order: 3 in a category that fits coffee, 25 in "Comida" and 40 in "Transporte"

#### Scenario: A list by lines
- **WHEN** the account sends "súper 25", "nafta 40" and "cine 12" on three lines of one message
- **THEN** the action is `cargar_varios` with three items: 25 in "Comida", 40 in "Transporte" and 12 in "Ocio"

#### Scenario: A list in a sentence
- **WHEN** the account sends "gasté 25 en el súper y 40 de nafta"
- **THEN** the action is `cargar_varios` with two items: 25 in "Comida" and 40 in "Transporte"

#### Scenario: Mixed types in a list
- **WHEN** the account sends "propina 500 y nafta 40"
- **THEN** the action is `cargar_varios` with an `ingreso` of 500 and a `gasto` of 40 in "Transporte"

#### Scenario: A bare list is accepted
- **WHEN** the model returns a JSON array of two valid `cargar` objects
- **THEN** the result is the equivalent `cargar_varios`, with no retry

#### Scenario: A spoken list
- **WHEN** the account sends a voice note saying "café tres y nafta cuarenta"
- **THEN** the action is `cargar_varios` with 3 and 40 and one `transcripcion`

#### Scenario: A correction that names its movement
- **WHEN** the account sends "la nafta era 40"
- **THEN** the action is `corregir` with `monto` 40 and `cual` "nafta"

#### Scenario: A deletion that names its movement
- **WHEN** the account sends "borrá el cine"
- **THEN** the action is `borrar` with `cual` "cine"

### Requirement: The parser is evaluated against the recorded cases

The recorded parser cases (message, expected action and fields, the category list they assume, and optionally a pending question) SHALL be runnable as one command that calls the real model. The recorded cases SHALL include voice notes: real Ogg/Opus recordings kept with the cases, each with its expected action and fields and, where it matters, the expected transcription compared loosely (case, accents and punctuation ignored). It SHALL report, per case, whether every expected field matches the parsed action. It SHALL compare only the expected fields, with category names compared case-insensitively, and SHALL exit with failure when any case fails. The cases SHALL include at least one of each conversation action: an amount correction, a category correction, a deletion, both queries, a creation with a budget and a confirmed creation. They SHALL also include lists of movements separated by commas, by "y" and by lines, with the number of items and each item's amount and category compared, and a correction and a deletion that name their movement. The voice cases SHALL include at least a load with a decimal amount spoken in words, a query, a correction and a note with no speech. That command SHALL NOT be part of the unit test command, which SHALL keep running without network access or credentials.

#### Scenario: Running the evaluation
- **WHEN** the evaluation command runs with a valid model key
- **THEN** it prints one line per case with pass or fail and the parsed action on failure, and its exit code is zero only when every case passes

#### Scenario: Voice cases run too
- **WHEN** the evaluation command runs
- **THEN** every recorded voice note is sent to the model as audio and reported like a text case

#### Scenario: A list case
- **WHEN** the case "súper 25 / nafta 40 / cine 12" (one per line) runs
- **THEN** it passes only when the action is `cargar_varios` with three items whose amounts and categories match in order

#### Scenario: Unit tests stay offline
- **WHEN** the unit test command runs without a model key
- **THEN** it does not call the model and passes
