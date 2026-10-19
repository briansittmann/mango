## MODIFIED Requirements

### Requirement: Replies are plain text in the account's language

Every reply text SHALL be taken from the translation files, in the account's language (`es` | `en`), never a literal in the code. This covers the Undo button label. Spanish texts SHALL use voseo. A confirmation SHALL read "Anotado", its icon, the name of what was loaded and the amount in the account's currency, formatted as the web formats it for that account: the same symbol and layout (`localization` → *Locale-aware formatting*) and the account's amount format in effect (`localization` → *Amount format preference*), so an account in Argentina with the abbreviated format reads `$ 15k` where the web reads `$ 15k`. For an expense the name SHALL be its description, or the recurring definition's name, or the category when there is neither, and the category SHALL follow the amount when it differs from the name. For an income the name SHALL be its description, or "Ingreso" without one. For savings it SHALL be the movement type (savings, withdrawal). The day SHALL be omitted when it is today and shown as "yesterday" or a short date otherwise. When an expense falls in the cycle in progress and its category has a budget in that cycle, the confirmation SHALL add the category's spent and budget for the cycle, the same figures as the dashboard's budget bar after the write, and a light for the dashboard's budget level: green below 80 %, yellow from 80 %, red from 100 %. An income, a savings movement, an expense in another cycle or an expense in a category without a budget SHALL get no such line. When those figures cannot be read, the confirmation SHALL go out without the line. A successful load SHALL be reported to the adapter with its confirmation text, the icon that text starts with and the row it wrote or completed. The adapter then decides between text and reaction (`bot-progressive-confirmation`) and remembers the channel's last load (`messaging-channels`).

#### Scenario: Spanish confirmation
- **WHEN** an account with language `es` and currency EUR loads "nafta 45 ayer", and Transporte has no budget
- **THEN** the reply is "Anotado ✅ Nafta · 45 € en Transporte, ayer." with no budget line

#### Scenario: English confirmation
- **WHEN** an account with language `en` loads the same expense
- **THEN** the reply is in English and names Nafta, the same amount, Transporte and "yesterday", and the button reads "Undo"

#### Scenario: Expense in a budgeted category
- **WHEN** Comida has a budget of 300 in the cycle in progress with 33 spent, and the account loads "súper 15" today
- **THEN** the reply is "Anotado ✅ Súper · 15 € en Comida. Llevás 48 € de 300 € este mes 🟢"

#### Scenario: Pesos, abbreviated
- **WHEN** an account in Argentina with currency ARS and the abbreviated format in effect has Comida with a budget of 300 000 and 33 000 spent, and loads "súper 15000" today
- **THEN** the reply is "Anotado ✅ Súper · $ 15k en Comida. Llevás $ 48k de $ 300k este mes 🟢"

#### Scenario: Pesos, complete
- **WHEN** the same account has the complete format in effect
- **THEN** the reply reads "$ 15.000", "$ 48.000" and "$ 300.000" in the same places

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
