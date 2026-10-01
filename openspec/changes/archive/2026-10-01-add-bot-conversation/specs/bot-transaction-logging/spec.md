## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Recognised but unsupported actions get a fixed answer
**Reason**: `consultar`, `corregir`, `borrar` and `crear_categoria` are executed now (`bot-conversation`); only the answers to unparsed messages remain.
**Migration**: See *Unparsed messages get a fixed answer* below; the `todaviaNo` text is removed from both catalogs.

## ADDED Requirements

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
