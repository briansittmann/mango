## MODIFIED Requirements

### Requirement: Cycle header and free margin
The top of the dashboard SHALL show a bar with the Mango logo and the app name on the left and the account avatar on the right.

Below the bar, the cycle name SHALL be the screen's title:
- It SHALL be left-aligned and larger than every other text except the free-margin number.
- Previous/next cycle controls SHALL sit beside it.
- The cycle SHALL be named after the month in which it ends.
- Under the title, the cycle's first and last day SHALL be shown as a date range in the active language. While the cycle contains today, the range SHALL be preceded by an "in progress" label. While the cycle is a projection, the range SHALL be preceded by a "Proyección" label instead.
- The title's accessible name SHALL contain the visible month name.

Activating the title SHALL open a month picker. In the picker, the selected month SHALL be marked by a filled shape and heavier weight, and exposed as current. Months more than six cycles after the cycle in progress SHALL NOT be selectable.

Navigation SHALL reach every earlier cycle and up to six cycles after the one in progress. While the sixth cycle after the one in progress is displayed, the next-cycle control SHALL be disabled, beside the title and in the top bar alike, even when the mounting page supplies a handler for it. No control SHALL display a cycle further ahead.

Once the title has scrolled under the top bar, the bar SHALL become a frosted surface and show the month name with previous/next controls in place of the app name. The avatar SHALL stay in the same position. While the title is in view, the bar SHALL be transparent and its month controls SHALL be hidden and unreachable, so the month is never shown twice.

Below the header, a free-margin card SHALL show a "free margin" label and the supplied free-margin amount as the most prominent number on the screen, in the brand colour. Under the number the card SHALL show a **composition strip**: one thin bar split into three segments — what the cycle's income went to in spending (budgets and spending as the free margin counts them), savings and the free margin — each segment's width proportional to its share of the income, separated by a 2px surface gap, with a text label under each segment in a text token and no amount or percentage printed. A segment with no share SHALL be omitted together with its label. When the free margin is negative or the income is zero, the strip SHALL NOT be shown. Hovering or focusing a segment SHALL show a tooltip naming it with its amount and its share of the income as a whole-number percentage. At a viewport 1024px wide or wider the strip SHALL always be shown and the card SHALL NOT be a control. Below 1024px the strip SHALL be folded away at rest, and activating the card anywhere SHALL disclose it and activating it again SHALL fold it; the card SHALL show no chevron, icon or other indicator that it opens, SHALL respond to a press with a slight scale, and SHALL expose its open state to assistive technology through a control named after the label and the amount. Activating a segment SHALL NOT fold the strip. The card SHALL NOT contain a badge or any amount other than the free margin at rest, with one exception: while the account holds marked movements and the cycle is not a projection, the card SHALL end with the pockets block of `payment-method` → *The pockets block in the free-margin card*, under the number (and under the strip when it is open), after a thin divider. The pocket blocks and their swap button SHALL be controls of their own, not part of the card's toggle: activating them SHALL NOT fold or unfold the strip. At 1024px and wider, where the card is the first stat tile, the pockets block SHALL sit inside the tile under the income line.

#### Scenario: Cycle crossing months
- **WHEN** the cycle runs from 26 August to 25 September
- **THEN** the title shows September in the active language

#### Scenario: Top bar
- **WHEN** the dashboard is rendered
- **THEN** the logo (decorative, with an empty accessible name) and the app name appear at the top left, and the avatar at the top right

#### Scenario: Title, range and progress label
- **WHEN** the cycle runs from 1 to 30 September 2026, contains today, and the language is Spanish
- **THEN** the title reads "septiembre", starting with a capital letter
- **AND** the line under it shows the "en curso" label followed by a date range covering 1 and 30 September
- **AND** the title's computed font size is larger than every other text on the page except the free-margin number

#### Scenario: Projection label
- **WHEN** the displayed cycle is the November 2026 projection and the language is Spanish
- **THEN** the line under the title shows "Proyección" followed by a date range covering 1 and 30 November, and no "en curso" label

#### Scenario: Month picker marks the selection
- **WHEN** the user activates the title
- **THEN** a month picker opens, in which September has a filled background and heavier weight than the other months and is exposed as current

#### Scenario: Navigation into the projection
- **WHEN** the displayed cycle is September 2026, in progress, and the mounting page supplies previous- and next-cycle handlers
- **THEN** the next-cycle control beside the title and the one in the top bar are both enabled
- **AND** in the month picker, October 2026 to March 2027 are enabled and April 2027 onwards is disabled

#### Scenario: No way past the current cycle
- **WHEN** the displayed cycle is March 2027, the last reachable one, six cycles past the September 2026 cycle in progress
- **THEN** the next-cycle control beside the title and the one in the top bar are both disabled, and the previous-cycle controls are enabled

#### Scenario: Month moves into the top bar
- **WHEN** the user scrolls until the title is under the top bar
- **THEN** the bar has a frosted surface and shows the month name between previous/next controls, and the avatar has not moved
- **AND** when the user scrolls back to the top, the bar is transparent, shows the app name, and its month controls cannot be reached by keyboard

#### Scenario: Free-margin card content
- **WHEN** the free margin is 864 and the cycle income is 2 820, in Spanish
- **THEN** the card shows its label and "864 €" as the largest text on the page, and contains no badge and no "2.820 €"
- **AND** under the number a strip shows three segments labelled for spending, savings and free, the free segment being about 31 % of the strip's width, and no number beside any label

#### Scenario: The strip folds on a phone
- **WHEN** `/demo` is rendered at a 390px-wide viewport
- **THEN** the strip is not visible, the card shows no chevron or icon, and its control is exposed as collapsed
- **AND** after the card is activated the strip is visible and the control is exposed as expanded, a tap on a segment leaves it open, and activating the card again folds it
- **AND** at a 1280px-wide viewport the strip is visible without any activation and the card contains no control

#### Scenario: Composition tooltip
- **WHEN** the pointer rests on the savings segment of the demo's strip (opened first below 1024px), in Spanish
- **THEN** a tooltip shows the savings label, "146 €" and "5 %", and leaves when the pointer leaves
- **AND** the same tooltip is shown while the segment has keyboard focus

#### Scenario: No strip when nothing is free
- **WHEN** the free margin is negative
- **THEN** the card shows the label and the negative amount in the negative treatment, and no strip

#### Scenario: Pockets under the number
- **WHEN** `/demo` is rendered at 390px in Spanish, the account holding marked movements
- **THEN** the card shows "864 €", then a divider, then the "Efectivo" and "Tarjeta" blocks with their balances, and "864 €" is still the largest text on the page
- **AND** activating the card folds and unfolds the strip while the pocket blocks stay visible, and activating a pocket block does not change the strip's state

#### Scenario: No pockets without marked movements
- **WHEN** the account holds no movement with a payment method
- **THEN** the card contains no divider, no pocket block and no amount other than the free margin, as before

## ADDED Requirements

### Requirement: A row shows how it was paid

An expense row of a category card and an income row of the income panel that carry a payment method (`payment-method`) SHALL show a small icon of it, a banknote for `efectivo` and a card for `tarjeta`, in the muted text colour, just before the date on the muted line under the name. The icon SHALL be decorative (`design-system` → *Touch targets*): not focusable and hidden from assistive technology, while the row's accessible name SHALL say the method in words ("en efectivo", "con tarjeta"). A row with no method SHALL look exactly as before this change, with no icon, placeholder or space in its place. The icon SHALL NOT change the row's height, the date's position relative to the name, or the amount's position.

#### Scenario: Cash and card rows
- **WHEN** the "Comida" card is open on `/demo` in Spanish
- **THEN** "Café" shows a banknote icon before its date and "Restaurante" a card icon, both in the muted colour, and "Café"'s accessible name contains "en efectivo"

#### Scenario: A row with no method is unchanged
- **WHEN** the "Compras" card is open on `/demo`
- **THEN** "Ropa" shows its date with no icon before it, and its date starts at the same x position as before this change

### Requirement: Default payment method in the account sheet

The "Cuenta" sheet SHALL hold, after the cycle start day line and before the WhatsApp section, a three-way control labelled "Medio de pago por defecto" with the options "Ninguno", "Efectivo" and "Tarjeta", showing the account's default (`payment-method` → *An account default payment method*). Changing it SHALL make the sheet dirty like any other field, and "Guardar" SHALL store it through the profile operations together with the other fields; a sheet whose only change is the default SHALL store only the default. A failed save SHALL keep the sheet open with the chosen option and the sheet's error message. After a successful save the next entry sheet opened in create mode SHALL preselect the new default, and the bot SHALL use it from its next message. The control SHALL exist only where the sheet does: on `/demo`, where "Cuenta" is disabled, it is not reachable.

#### Scenario: Choosing a default
- **WHEN** on `/dashboard` the user opens "Cuenta", chooses "Efectivo", activates "Guardar" and then activates "Añadir gasto" in "Ocio"
- **THEN** the sheet closes, reopening "Cuenta" shows "Efectivo" checked, and the entry sheet opens with the "Efectivo" chip marked

#### Scenario: Cancelling discards it
- **WHEN** the user chooses "Tarjeta" and activates "Cancelar"
- **THEN** the default is unchanged and reopening "Cuenta" shows the previous option

#### Scenario: A failed save
- **WHEN** the save fails after the user chose "Tarjeta"
- **THEN** the sheet stays open with "Tarjeta" checked and the error message, and the stored default is unchanged

### Requirement: The demo's payment methods

The `/demo` sample SHALL carry payment methods so the pockets show, without changing any figure this specification or another one states for the demo: income 2.820 €, expenses 1.700 €, savings 146 € and free margin 864 €. In September: "Café" and "Cine" in cash; "Supermercado", "Restaurante", "Gasolina", "Alquiler", "Internet", "Seguro", "Freelance" and "Salario" (and its definition) by card; every other row with none; and a transfer of 100 € from card to cash on 4 September. Before September, where the demo shows no cycle, it SHALL hold cash tips ("Propinas", 150 €, 28 August) that count only in the cash balance. The cash pocket SHALL therefore open at 142,60 € and the card pocket at 1.492,40 €. Everything the visitor changes SHALL stay in memory and reset on reload, as the rest of the demo does.

#### Scenario: Seeded pockets
- **WHEN** `/demo` is loaded in Spanish
- **THEN** the free margin is 864 €, the cash pocket 142,60 € and the card pocket 1.492,40 €

#### Scenario: Reset on reload
- **WHEN** the visitor moves 50 € to cash and reloads the page
- **THEN** the cash pocket is back at 142,60 €
