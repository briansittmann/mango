## Purpose

Lets a user mark how each movement was paid, cash or card, see how much is left in each pocket, and move money between the two, without changing any other figure of the dashboard for anyone who does not use it.

## ADDED Requirements

### Requirement: A movement may say how it was paid

Every expense row and every income row SHALL carry a payment method: `efectivo`, `tarjeta`, or none (unspecified). A savings row SHALL carry none. A recurring definition of an expense or an income SHALL carry a payment method or none, and every charge it produces SHALL start with the definition's (`recurring-expenses`, `recurring-charge-generation`). A row's payment method SHALL be shown, set and changed only where this capability, `expense-editing`, `income-editing`, `recurring-expenses` and the bot say.

The payment method SHALL NOT change any figure other than the pocket balances: the income, expenses and savings totals, the free margin, every category total and budget bar, the pace line, the charts, the widgets, "Próximos cobros", the history and the projection SHALL be the same for a row with `efectivo`, with `tarjeta` and with none.

#### Scenario: The method moves no figure
- **WHEN** on `/demo` in Spanish the visitor changes "Restaurante" (67,60 €, "Comida") from "Tarjeta" to "Efectivo" and then to no method
- **THEN** after each save the expenses total is 1.700 €, the free margin 864 €, and "Comida" shows the same total and bar as before

#### Scenario: Savings carry none
- **WHEN** the visitor opens the savings sheet in create or edit mode
- **THEN** it shows no payment method control

### Requirement: An account default payment method

An account SHALL hold a default payment method: none ("Ninguno", the starting value), `efectivo` or `tarjeta`. The default SHALL only preselect the method of a new expense or income created from the entry sheet (`expense-editing`, `income-editing`) and fill the method of a bot load that does not say it (`bot-transaction-logging`). It SHALL NOT change any stored row, SHALL NOT apply to a charge generated from a definition, and SHALL NOT apply to an edit.

#### Scenario: Changing the default leaves rows alone
- **WHEN** an account with rows of every method sets its default to "Efectivo"
- **THEN** no stored row changes its method, and the next expense created from the entry sheet opens with "Efectivo" preselected

#### Scenario: Generated charges ignore the default
- **WHEN** the default is "Tarjeta" and a definition with no method gets its next cycle's charge generated
- **THEN** that charge carries no method

### Requirement: Who uses the feature

An account SHALL count as **holding marked movements** while at least one of its expense, income or transfer rows, not soft-deleted, in any cycle, carries a payment method. An account SHALL count as **using the feature** while it holds marked movements or its default is not "Ninguno". The pocket balances, their block and the pocket list SHALL be offered only to an account holding marked movements. The bot's deposit question SHALL be asked only of an account using the feature (`bot-transaction-logging`). The payment chips of the entry sheet and the default selector of the "Cuenta" sheet SHALL be offered to every account, as the two ways in.

#### Scenario: A new account sees no pockets
- **WHEN** an account with no row carrying a method and the default "Ninguno" opens the dashboard
- **THEN** the free-margin card is the same as before this change: no divider, no pocket blocks, no swap button

#### Scenario: The first marked movement shows the pockets
- **WHEN** that account saves an expense of 12 with "Efectivo"
- **THEN** after the dashboard refreshes, the pockets block is shown with "Efectivo" at −12 € and "Tarjeta" at 0 €

#### Scenario: Deleting the last marked movement hides them again
- **WHEN** the account then deletes that expense, and holds no other marked movement
- **THEN** the pockets block is no longer shown

#### Scenario: A default alone shows no pockets
- **WHEN** an account with no marked movement sets its default to "Tarjeta"
- **THEN** the pockets block is not shown, and the account counts as using the feature

### Requirement: Transfers move money between the pockets

A **transfer** SHALL be a movement of its own kind with an amount greater than 0 (at most 9 999 999 999,99, at most two decimals), a date and a direction: from card to cash (a withdrawal from the bank) or from cash to card (a deposit). It SHALL carry no category, no description, no recurring definition and no cycle mark. It SHALL count in no income, expenses or savings total, no free margin, no category total, budget bar or pace line, no chart or widget, no history entry, no "Próximos cobros", no "Movimientos" card and no projection. It SHALL only move the pocket balances, by its amount out of one pocket and into the other. It SHALL be soft-deleted, never removed, like any other movement.

#### Scenario: A withdrawal moves only the pockets
- **WHEN** the free margin is 864 €, the cash pocket 142,60 € and the card pocket 1.492,40 €, and the user moves 50 € from card to cash
- **THEN** the cash pocket shows 192,60 €, the card pocket 1.442,40 €, and the free margin, the income total and the expenses total are unchanged

#### Scenario: A transfer appears in no card
- **WHEN** the user has moved 100 € from card to cash on 4 September
- **THEN** no category card, income panel, savings panel, "Movimientos" card or widget lists or counts it

### Requirement: A pocket's balance

For the shown cycle, each pocket SHALL have a **balance**: the sum, over every cycle up to the end of the shown cycle, of the rows that count for it, where income rows add, expense rows subtract, and transfers add to the pocket they enter and subtract from the one they leave. A row SHALL count when it carries that pocket's method (a transfer always counts for both pockets), is not soft-deleted, is not a projected charge, and has happened:
- a row not linked to a recurring definition, and a transfer, when its local date is not after the shown cycle's today;
- a recurring charge, when it is shown as taken (`dashboard-data` → *Categories, budgets and recurring charges*).

Each pocket SHALL also have, for the shown cycle only, **what came in** (income rows and transfers into it) and **what went out** (expense rows and transfers out of it), counted by the same rule. There is no opening balance: a pocket starts at 0 before the account's first counted row, and a balance MAY be negative.

#### Scenario: The demo's balances
- **WHEN** `/demo` is rendered in Spanish
- **THEN** the cash pocket shows 142,60 € and the card pocket 1.492,40 €

#### Scenario: A pending charge does not count yet
- **WHEN** today is 10 October, the "Luz" charge of 72 € dated 20 October carries "Tarjeta" and is pending
- **THEN** the card balance does not include it, and once it is shown as taken it is 72 € lower

#### Scenario: A past cycle shows its own end
- **WHEN** the user opens the previous cycle
- **THEN** each balance is the one at that cycle's last day, and what came in and went out are that cycle's

#### Scenario: Rows with no method count nowhere
- **WHEN** the user adds an expense of 30 with no method
- **THEN** neither balance changes

### Requirement: The pockets block in the free-margin card

While the account holds marked movements and the shown cycle is not a projection, the free-margin card SHALL show the **pockets block** under everything else it shows, after a thin divider: two blocks side by side, "Efectivo" on the left and "Tarjeta" on the right, each with its icon (a banknote, a card), its label and its balance. The blocks SHALL be visibly subordinate to the free margin: their balance SHALL use a smaller size of the type scale than the free-margin number, and their surface SHALL differ only slightly from the card's. A negative balance SHALL take the negative treatment. Centred over the boundary between the two blocks SHALL be a round **swap button** with two arrows and a brand-coloured border, named "Mover plata", that opens the "Mover plata" sheet. Activating a block SHALL open that pocket's list. The pockets block SHALL NOT replace, split or recompute the free margin, and SHALL NOT fold with the composition strip: it is shown whether the strip is open or folded, and activating a block or the swap button SHALL NOT fold or unfold the strip.

#### Scenario: The block on a phone
- **WHEN** `/demo` is rendered at 390px in Spanish
- **THEN** under the free-margin number and a divider, "Efectivo 142,60 €" is on the left and "Tarjeta 1.492,40 €" on the right, each balance smaller than "864 €", and a round "Mover plata" button sits on the boundary between them
- **AND** activating "Efectivo" opens the cash list and leaves the strip folded

#### Scenario: No block in a projection
- **WHEN** the visitor opens the October 2026 projection on `/demo`
- **THEN** the free-margin card shows no divider, no pocket blocks and no swap button

### Requirement: The "Mover plata" sheet

The swap button SHALL open the "Mover plata" sheet, presented like every other sheet of the dashboard (`dashboard-ui`, `design-system`): a floating bottom sheet below 1024px, the side panel at 1024px and wider. It SHALL hold, in order:
- the title "Mover plata";
- the amount, large and centred, validated like the entry sheet's amount;
- two boxes side by side, "Sale de" and "Entra a", each naming a pocket with its icon, with a round button between them that swaps the two; a new sheet SHALL start from "Tarjeta" into "Efectivo";
- the date, starting at today when the shown cycle contains it and at the cycle's last day otherwise, limited to the shown cycle;
- a preview of both balances after the move, and the line "El margen libre no cambia";
- the primary action "Mover X €", disabled while the amount is empty or invalid.

It SHALL NOT offer a category, a description or a recurrence. Saving SHALL create the transfer through the injected operation; a failure SHALL keep the sheet open with its values and show an error message, with nothing changed.

Activating a transfer in the pocket list SHALL open the same sheet in edit mode, titled "Editar movimiento", with the transfer's amount, direction and date, a "Guardar" action and an "Eliminar movimiento" action that deletes it with undo as a swipe does.

#### Scenario: A withdrawal from the sheet
- **WHEN** on `/demo` in Spanish the visitor opens "Mover plata", types 50, leaves "Sale de Tarjeta · Entra a Efectivo" and the date, and activates "Mover 50 €"
- **THEN** the sheet closes, the cash pocket shows 192,60 € and the card pocket 1.442,40 €, and the free margin still shows 864 €

#### Scenario: Swapping the direction
- **WHEN** the visitor activates the swap button between the two boxes
- **THEN** "Sale de" names "Efectivo" and "Entra a" names "Tarjeta", and the preview shows the cash balance lower and the card balance higher by the amount

#### Scenario: Preview before saving
- **WHEN** the visitor types 50 with the default direction
- **THEN** the preview shows "Efectivo 192,60 €" and "Tarjeta 1.442,40 €" and the line "El margen libre no cambia"

#### Scenario: Nothing but amount, direction and date
- **WHEN** the sheet is open
- **THEN** it shows no category control, no description field and no recurrence switch

#### Scenario: Editing a transfer
- **WHEN** the visitor opens the cash list, activates the 100 € transfer of 4 September, changes it to 120 and saves
- **THEN** the cash pocket shows 162,60 € and the card pocket 1.472,40 €

### Requirement: The pocket list

Activating a pocket block SHALL open that pocket's list, presented like the other sheets. Its header SHALL hold a control to go back, the pocket's name, its balance in large type and, under it, "Entró X · Salió Y" for the shown cycle. It SHALL list, newest first, every row of the shown cycle that counts for that pocket (*A pocket's balance*):
- an expense with its category's colour dot, its name, its day and its amount with a "−" sign;
- an income entry with its name, its day and its amount with a "+" sign;
- a transfer in the muted text colour, with no sign, an arrows icon and "Tarjeta a efectivo" or "Efectivo a tarjeta" as its name, so it does not read as an expense or an income.

Activating an expense or an income row SHALL open its entry sheet as its card or panel would. Every row SHALL support swipe to delete with undo, as an expense row does (`expense-editing` → *Swipe to delete*, *Delete with undo*); a transfer's toast SHALL read "Movimiento eliminado". With no counted row in the cycle the list SHALL say so in one line under the header. Transfers SHALL be listed only here.

#### Scenario: The cash list on the demo
- **WHEN** on `/demo` in Spanish the visitor activates the "Efectivo" block
- **THEN** the list's header reads "Efectivo", "142,60 €" and "Entró 100 € · Salió 107,40 €"
- **AND** it lists "Cine" −45 €, "Tarjeta a efectivo" 100 € in muted text with no sign, and "Café" −62,40 €, newest first

#### Scenario: Deleting a transfer with undo
- **WHEN** the visitor swipes the 100 € transfer away and then activates "Deshacer"
- **THEN** after the delete the cash pocket shows 42,60 € and the toast reads "Movimiento eliminado"; after the undo it shows 142,60 € again

#### Scenario: An expense opens its sheet
- **WHEN** the visitor activates "Café" in the cash list
- **THEN** the entry sheet opens in edit mode for "Café" with "Efectivo" marked

### Requirement: Payment operations are injected

The page that mounts the dashboard SHALL supply, with the same inputs and outcomes in every data source (the demo in memory, the real one in the database):
- **transfer create:** an amount, a direction and a date;
- **transfer update:** a transfer's new amount, direction and date;
- **transfer soft-delete** and **restore:** set or clear the deletion mark;

Each SHALL complete asynchronously and either succeed or fail; a failure SHALL leave the data unchanged. Without the transfer operations the swap button and the edit and swipe of transfers SHALL NOT be offered; the default is set with the profile operations of the "Cuenta" sheet (`dashboard-ui` → *Default payment method in the account sheet*). A transfer operation given the id of a row of another account, or of a row that is not a transfer, SHALL reject with nothing changed.

#### Scenario: A failed transfer
- **WHEN** on `/demo?e2e=fail-transfer` the visitor tries to move 50 €
- **THEN** the sheet stays open with 50 typed and an error message, and both balances are unchanged

#### Scenario: Another account's row
- **WHEN** the transfer update is called with the id of another account's transfer, or of one of the user's expenses
- **THEN** it rejects and that row is unchanged
