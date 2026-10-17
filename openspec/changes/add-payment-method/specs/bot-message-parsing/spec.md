## MODIFIED Requirements

### Requirement: A message becomes exactly one action from the seven

Every message, whether it arrives as text or as a voice note, SHALL be parsed into exactly one action. The set of actions SHALL be: `cargar` (log a movement), `repreguntar` (a datum is missing), `no_entendido`, `consultar`, `corregir`, `borrar` and `crear_categoria`. Each action SHALL carry only the fields defined for it:

- `cargar`: `tipo` (`gasto` | `ingreso` | `ahorro` | `transferencia`), `monto` (a number; positive for `gasto`, `ingreso` and `transferencia`; non-zero for `ahorro`, negative meaning a withdrawal), `categoria` (one of the account's category names, or null; always null for `ingreso`, `ahorro` and `transferencia`), `descripcion` (short text or null), `dias_atras` (integer ≥ 0, 0 when the message names no day), `recurrente` (the name of one of the account's active recurring expenses when the message refers to it, otherwise null; always null for `transferencia`), `medio_pago` (`efectivo` | `tarjeta` | null). For `gasto` and `ingreso`, `medio_pago` SHALL be the method the message says ("en efectivo", "con tarjeta", "cash", "by card") and null when it says none: the parser SHALL NOT guess it and SHALL NOT apply any default. For `transferencia` it SHALL be the pocket the money goes into and SHALL NOT be null: taking cash out of the bank or an ATM ("saqué 200", "saqué del cajero") is `efectivo`; putting cash into the bank ("deposité las propinas", "ingresé el efectivo al banco") is `tarjeta`. Taking money out of savings ("saqué 100 del ahorro") SHALL stay `ahorro` with a negative amount. For `ahorro` it SHALL be null.
- `repreguntar`: `falta` (`categoria` | `deposito`), `tipo`, `monto`, `dias_atras`. `deposito` SHALL be used only when the message puts an amount into the bank and could be either a new income or cash moved from the cash pocket ("ingresé 200 en el banco"); it carries `tipo` `ingreso` and the optional `descripcion`. A message that says which ("cobré 200 en el banco", "deposité 200 del efectivo") SHALL NOT produce it. The parser SHALL NOT ask for the payment method in any other case.
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

### Requirement: A pending question is context for the next message

When the bot's previous turn left a question pending on the channel, the parser SHALL receive it together with the new message. There are three kinds. A category question carries the type, amount and days ago: a message that answers it with a category SHALL produce `cargar` with the pending amount and that category. A category-creation question carries the name, the optional budget and the similar category: a message that affirms it ("sí", "dale", "creala") SHALL produce `crear_categoria` with that name and budget and `confirmada` true. A deposit question carries the amount, the days ago and the optional description: a message that says the money came from the cash pocket ("del efectivo", "lo pasé") SHALL produce `cargar` with `tipo` `transferencia`, the pending amount and `medio_pago` `tarjeta`; a message that says it is new money ("es nuevo", "me pagaron") SHALL produce `cargar` with `tipo` `ingreso`, the pending amount and `medio_pago` `tarjeta`. A message that does not answer the pending question SHALL be parsed on its own, as if nothing were pending, and SHALL never carry `confirmada` true.

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

#### Scenario: Answering the deposit question in words
- **WHEN** the pending question is "income or deposit for 200" and the account sends "lo pasé del efectivo"
- **THEN** the action is `cargar` with `tipo` `transferencia`, `monto` 200 and `medio_pago` `tarjeta`

#### Scenario: New money
- **WHEN** the same question is pending and the account sends "es nuevo, me lo pagaron"
- **THEN** the action is `cargar` with `tipo` `ingreso`, `monto` 200 and `medio_pago` `tarjeta`
