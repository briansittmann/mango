## Purpose

Defines what the bot does once a message is understood: which movement it writes for the account and how, how a category or a recurring expense is resolved, how a missing category is asked for across turns, and what the bot replies, in the account's language.

## Requirements

### Requirement: A load writes one movement for the account

A `cargar` action SHALL write exactly one movement for the account that owns the channel: `tipo` as parsed, the amount, the account's default currency, the description when present, the local calendar day that is `dias_atras` days before today in the account's timezone, the channel and the channel's message id, and the confirmed state. A movement not linked to a recurring definition SHALL carry no cycle. A savings withdrawal SHALL be stored as a negative savings amount. Nothing SHALL be written when the action is not `cargar`.

#### Scenario: Expense today
- **WHEN** an account in Europe/Dublin with currency EUR sends "nafta 45" at 23:30 local on 3 October 2026 from WhatsApp message `wamid.A`
- **THEN** one expense row exists with amount 45, currency EUR, category Transporte, local date 3 October 2026, channel `whatsapp`, message id `wamid.A`, state confirmed and no cycle

#### Scenario: Expense yesterday
- **WHEN** the same account sends "nafta 45 ayer" on 1 October 2026
- **THEN** the row's local date is 30 September 2026

#### Scenario: Income
- **WHEN** the account sends "propina 500"
- **THEN** one income row exists with amount 500, description "Propina", no category, and no recurring definition is touched

#### Scenario: Savings withdrawal
- **WHEN** the account sends "saqué 100 del ahorro"
- **THEN** one savings row exists with amount -100

#### Scenario: Not understood writes nothing
- **WHEN** the account sends "asdasda"
- **THEN** no row is written

### Requirement: Categories are resolved by name, with Otros as the fallback

The parsed category SHALL be matched against the account's categories by name, ignoring case and accents. When it matches none, the movement SHALL go to the account's category named "Otros", without asking. When the account has no "Otros" either, the bot SHALL ask for the category as for a bare amount. Only an expense carries a category; incomes and savings SHALL carry none.

#### Scenario: Case and accents
- **WHEN** the parser returns "salud" for an account whose category is "Salud"
- **THEN** the expense is written in "Salud"

#### Scenario: Unknown name falls back
- **WHEN** the parser returns a name that matches no category and the account has "Otros"
- **THEN** the expense is written in "Otros" and the reply names "Otros"

#### Scenario: No Otros
- **WHEN** the parser returns a name that matches no category and the account has no "Otros"
- **THEN** nothing is written and the reply asks for the category, listing the account's categories

### Requirement: An expense that names a recurring expense completes its pending charge

When a `cargar` of type `gasto` names one of the account's active recurring expenses, the bot SHALL complete that definition's charge for the cycle that contains the movement's local date. The charge SHALL take the loaded amount and be confirmed, and no second row SHALL be written. The completed row SHALL record the channel and message id. When the loaded amount equals the definition's expected amount, the reply SHALL be the ordinary confirmation. When it differs, the charge SHALL still be completed at the loaded amount, and the definition SHALL NOT change. The reply SHALL be the ordinary confirmation followed by a note that only this cycle changed and the definition keeps its expected amount. The bot SHALL ask nothing about it (`recurring-expenses` → *A differing amount from the bot changes only this cycle*). When that cycle's charge is already confirmed or deleted, nothing SHALL be written and the reply SHALL say the charge is already logged this cycle. When the definition has ended or is inactive, the movement SHALL be written as an ordinary expense in the definition's category with the definition's name as description. An `ingreso` SHALL never complete a recurring definition.

#### Scenario: Pending charge at the expected amount
- **WHEN** the October cycle holds a pending "Netflix" charge of 13 and the account sends "netflix 13" on 5 October 2026
- **THEN** that row is confirmed at 13 dated 5 October, no second row exists, and the reply is the ordinary confirmation

#### Scenario: Pending charge at another amount
- **WHEN** the October cycle holds a pending "Luz" charge of 60 and the account sends "luz 72"
- **THEN** that row is confirmed at 72, the definition still expects 60, and the reply confirms 72 in the charge's category and says Luz stays at 60 from next cycle on

#### Scenario: Already confirmed this cycle
- **WHEN** October's "Netflix" charge is already confirmed and the account sends "netflix 13" again
- **THEN** nothing is written and the reply says Netflix is already logged this cycle

#### Scenario: Ended plan
- **WHEN** the account's "Cetelem" plan has reached its last repetition and the account sends "cetelem 50"
- **THEN** an ordinary expense of 50 is written in Cetelem's category with description "Cetelem"

#### Scenario: Salary
- **WHEN** the account has a recurring income "Sueldo" of 2100 and a pending Sueldo charge, and sends "cobré 2100"
- **THEN** a separate income of 2100 is written and the pending Sueldo charge is untouched

### Requirement: A missing category is asked in text and remembered for a while

When the action is `repreguntar` (or the category cannot be resolved and there is no "Otros"), the bot SHALL reply with a text question listing the account's categories and SHALL hold the pending amount, type and date as the channel's pending question for 30 minutes. The next message from that channel within that time SHALL be parsed with the question as context: an answer writes the movement and clears the question; anything else is handled on its own and clears the question. An expired question SHALL be dropped without any write. A new question SHALL replace an earlier one. The question SHALL never be asked because the category did not match: that case goes to "Otros".

#### Scenario: Ask and answer
- **WHEN** the account sends "gasté 50", then "comida" 5 minutes later
- **THEN** the first reply asks which category and lists the categories, and after the second message one expense of 50 exists in Comida and no question is pending

#### Scenario: Ignored question
- **WHEN** the account sends "gasté 50", then "nafta 45" 5 minutes later
- **THEN** one expense of 45 exists in Transporte, no expense of 50 exists and no question is pending

#### Scenario: Expired question
- **WHEN** the account sends "gasté 50", then "comida" 2 hours later
- **THEN** no expense of 50 exists and "comida" is handled as a message on its own

#### Scenario: Question replaced
- **WHEN** the account sends "gasté 50", then "gasté 20", then "comida"
- **THEN** one expense of 20 exists in Comida and none of 50

### Requirement: Replies are plain text in the account's language

Every reply text SHALL be taken from the translation files, in the account's language (`es` | `en`), never a literal in the code. This covers the Undo button label. Spanish texts SHALL use voseo. A confirmation SHALL read "Anotado", its icon, the name of what was loaded and the amount in the account's currency. For an expense the name SHALL be its description, or the recurring definition's name, or the category when there is neither, and the category SHALL follow the amount when it differs from the name. For an income the name SHALL be its description, or "Ingreso" without one. For savings it SHALL be the movement type (savings, withdrawal). The day SHALL be omitted when it is today and shown as "yesterday" or a short date otherwise. When an expense falls in the cycle in progress and its category has a budget in that cycle, the confirmation SHALL add the category's spent and budget for the cycle, the same figures as the dashboard's budget bar after the write, and a light for the dashboard's budget level: green below 80 %, yellow from 80 %, red from 100 %. An income, a savings movement, an expense in another cycle or an expense in a category without a budget SHALL get no such line. When those figures cannot be read, the confirmation SHALL go out without the line. A successful load SHALL be reported to the adapter with its confirmation text, the icon that text starts with and the row it wrote or completed. The adapter then decides between text and reaction (`bot-progressive-confirmation`) and remembers the channel's last load (`messaging-channels`).

#### Scenario: Spanish confirmation
- **WHEN** an account with language `es` and currency EUR loads "nafta 45 ayer", and Transporte has no budget
- **THEN** the reply is "Anotado ✅ Nafta · 45 € en Transporte, ayer." with no budget line

#### Scenario: English confirmation
- **WHEN** an account with language `en` loads the same expense
- **THEN** the reply is in English and names Nafta, the same amount, Transporte and "yesterday", and the button reads "Undo"

#### Scenario: Expense in a budgeted category
- **WHEN** Comida has a budget of 300 in the cycle in progress with 33 spent, and the account loads "súper 15" today
- **THEN** the reply is "Anotado ✅ Súper · 15 € en Comida. Llevás 48 € de 300 € este mes 🟢"

#### Scenario: Close to the budget
- **WHEN** Suplementos has a budget of 100 with 70 spent, and the account loads "proteína 15"
- **THEN** the budget line reads 85 € of 100 € with 🟡

#### Scenario: Over the budget
- **WHEN** Suplementos has a budget of 100 with 95 spent, and the account loads "creatina 20"
- **THEN** the budget line reads 115 € of 100 € with 🔴

#### Scenario: Income names itself
- **WHEN** the account loads "propina 500"
- **THEN** the reply is "Anotado 💰 Propina · 500 €." with no totals line

#### Scenario: Expense in the previous cycle
- **WHEN** the account loads an expense in a budgeted category dated before the cycle in progress started
- **THEN** the reply has no budget line

#### Scenario: Older date
- **WHEN** the account loads an expense with `dias_atras` 3
- **THEN** the reply shows the calendar day, not a relative word

#### Scenario: A load reports its row
- **WHEN** the account loads "nafta 45"
- **THEN** the adapter receives the confirmation text, the ✅ icon and the id of the 45 expense

### Requirement: Unparsed messages get a fixed answer

`no_entendido` SHALL write nothing and SHALL reply with a text saying the message was not understood and showing one example of the expected format. `no_disponible` SHALL write nothing, SHALL reply with a text saying the message could not be processed now and asking to send it again later, and SHALL keep the channel's pending question, so the resend can still answer it. `consultar`, `corregir`, `borrar` and `crear_categoria` SHALL be executed as `bot-conversation` defines.

#### Scenario: Not understood
- **WHEN** the account sends "asdasda"
- **THEN** nothing is written and the reply says it was not understood and shows an example

#### Scenario: Model down
- **WHEN** the account answers a pending category question with "comida" and both model requests fail
- **THEN** nothing is written, the reply asks to send the message again later, and the pending question is still on the channel

#### Scenario: Corrections are executed
- **WHEN** the account sends "no, era 40" after loading 50
- **THEN** the load is 40 and the reply is not the "not yet" text

### Requirement: Retries never write twice

A message whose channel and message id are already recorded on a movement SHALL be discarded before parsing, with no model call, no write and no reply (`messaging-channels` → *Message idempotency is per channel*). When the model or the write fails, no movement SHALL record the message id, so a later retry of that message is processed again.

#### Scenario: Retry after a successful load
- **WHEN** "nafta 45" from `wamid.A` was loaded and Meta delivers `wamid.A` again
- **THEN** no model call is made, nothing is written and nothing is sent

#### Scenario: Retry after a failed parse
- **WHEN** the model failed twice for `wamid.B` and Meta delivers `wamid.B` again
- **THEN** the message is parsed again

### Requirement: Bot writes reach only the resolved account

Every read and write the bot performs with the server-side key SHALL be filtered by the account resolved from the channel, and SHALL use the same data operations the web uses for the same movement, so the two never write different shapes. A write that matches no row of that account SHALL fail with nothing changed.

#### Scenario: Category of another account
- **WHEN** the resolved category id belongs to another account
- **THEN** the write is rejected and nothing is written

### Requirement: The reply is delivered on the channel the message came from

The adapter SHALL send the reply text to the sender over the channel's messaging API using the server-side credentials. A failed send SHALL be logged, without the phone number, and SHALL NOT undo the write. No reply SHALL be sent for a discarded retry.

#### Scenario: Send fails
- **WHEN** the movement is written and the messaging API returns an error
- **THEN** the movement stays written and the error is logged with the number masked
