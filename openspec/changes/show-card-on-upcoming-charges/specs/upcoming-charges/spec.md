## MODIFIED Requirements

### Requirement: Expanded state lists pending charges first

Expanded, the card SHALL push the content below it rather than cover it, and SHALL list every charge of the cycle, one row each.

**Row anatomy**, in the same arrangement as a "Movimientos" row (`transaction-list` → *Movement rows*):
- **One mark** on the left: a 32px circle tinted with the category's colour and ringed with it at full strength, holding the day of the month in the regular text colour with tabular figures. A taken charge's mark SHALL carry a small check badge on its edge, in neutral tokens. Besides it, the row SHALL draw only the card thumbnail below, and no other mark, chip or dot.
- **The name**, over **one muted line** that starts with the category's name and adds, joined with " · ":
  - the **card's name**, right after the category, when the charge's fixed expense carries a card (`card-wallet`; `recurring-expenses` → *A fixed expense names the card it is charged to*). A charge whose fixed expense carries no card SHALL show nothing in its place;
  - the **expected amount** ("esperado 820 €"), only while the charge's amount differs from its definition's expected amount (`recurring-expenses` → *A charge that differs from its expectation says so, quietly*);
  - the **progress** of a recurrence that ends, as the count produced out of the total ("4 de 10") (`recurring-expenses` → *A recurrence can end, and ends itself*). A charge whose definition has no end SHALL show nothing in its place — no dash, no placeholder, no "no end" label.
- **The card thumbnail**, when the charge's fixed expense carries a card: a small drawing of that card's face, about 22px wide in a payment card's proportions, in the same colours as its face in the "Tarjetas" widget, with no text, placed immediately left of the amount. It SHALL be hidden from assistive technology, the card's name on the muted line and in the row's accessible name being what conveys it. A charge without a card SHALL show no thumbnail and no empty space where one would go.
- **The amount** on the right, with tabular figures, inset from the card's inner edge exactly as a "Movimientos" amount is, so the amounts of both cards end on the same vertical line.

**Order and grouping.**
- The **pending** charges SHALL come first, under a "Pendientes" heading drawn like a "Movimientos" day heading, ordered by day of the month, ascending. When no charge is pending, neither the heading nor the group SHALL be shown.
- The **taken** charges SHALL follow, behind a single disclosure line that names their count ("3 cobrados", "1 cobrado") with the dashboard's disclosure chevron. The line SHALL start folded when the page loads. Activating it SHALL show the taken charges below it, ordered by day ascending, and activating it again SHALL hide them. While folded, the taken rows SHALL be neither visible nor reachable by keyboard or assistive technology. When no charge is taken, the line SHALL NOT be shown.
- Folding or unfolding the taken charges SHALL NOT fold the card, SHALL NOT change the next charge shown in the header, and SHALL NOT change the footer total.

**Telling the two apart.**
- A taken charge SHALL sit in the taken group and SHALL carry the check badge on its mark. It SHALL be at full opacity, and its name, muted line and amount SHALL use the same colours as a pending row's.
- A pending charge SHALL carry no check badge.
- The distinction SHALL NOT rely on colour alone, and each row's state SHALL be available as text to assistive technology.

**Columns.** Every mark SHALL have the same width and every amount SHALL end at the same inner edge, whatever the number of digits. Every thumbnail SHALL have the same size and end at the same distance from its amount's left edge. The muted line SHALL NOT break those columns and SHALL NOT shift the amount, and neither SHALL a thumbnail's presence or absence.

**The card follows the definition.** The thumbnail and the card's name SHALL show in every cycle, projected ones included, and SHALL follow an assignment, a rename, a recolour or a deletion of the card without a reload.

Rows SHALL be at least 48px tall, and the taken-charges line at least 44px. Opening and closing the card, and folding and unfolding the taken charges, SHALL animate height as any other disclosure on the dashboard does, and SHALL honour a reduced-motion request (`design-system` → *Motion respects user preference*).

#### Scenario: Pending first, taken folded
- **WHEN** the card is expanded on `/demo` in Spanish
- **THEN** it shows a "Pendientes" heading over, in order: Parking día 15 · 50 €, Limpieza día 20 · 35 €, Gimnasio día 22 · 40 €
- **AND** below them a "3 cobrados" line, folded, and no "Alquiler", "Internet" or "Seguro" row is visible or reachable by keyboard

#### Scenario: Unfolding the taken charges
- **WHEN** the visitor activates "3 cobrados" on the expanded card
- **THEN** the rows Alquiler día 1 · 820 €, Internet día 3 · 45 €, Seguro día 8 · 35 € are shown below the line, in that order, each with a check badge on its mark
- **AND** the line exposes its expanded state, the card stays expanded, and the header still shows "Parking · día 15"
- **AND** activating the line again hides the three rows

#### Scenario: A cycle with nothing taken
- **WHEN** a projected cycle is shown on `/demo` and the card is expanded
- **THEN** every charge is listed under "Pendientes" by day, and no taken-charges line is shown

#### Scenario: A cycle with nothing pending
- **WHEN** the card is mounted with a cycle whose charges are all confirmed and is expanded
- **THEN** no "Pendientes" heading is shown, and the taken-charges line and the footer are the card's only content

#### Scenario: One mark and one muted line
- **WHEN** the card is expanded on `/demo` in Spanish
- **THEN** the "Parking" row has exactly one mark, a 32px circle holding "15", no card thumbnail, and its muted line reads "Transporte"
- **AND** no row contains a separate day chip or category dot

#### Scenario: A charge names its card
- **WHEN** the card is expanded on `/demo` in Spanish and its taken charges are unfolded, "Débito" carrying Alquiler and Internet and "Crédito" carrying Gimnasio and Seguro
- **THEN** the "Gimnasio" row's muted line reads "Salud · Crédito" and a thumbnail drawn in "Crédito"'s colours sits immediately left of its amount
- **AND** the "Alquiler" and "Internet" rows show "Débito" and a thumbnail in "Débito"'s colours, and the "Parking" and "Limpieza" rows show neither

#### Scenario: The card follows its changes
- **WHEN** the visitor assigns "Parking" to "Crédito" from its sheet, and then renames "Crédito" to "Visa" and deletes "Débito" from their card sheets
- **THEN** without a reload the "Parking" row shows "Transporte · Visa" with a thumbnail, "Gimnasio" shows "Salud · Visa", and "Alquiler" and "Internet" show no card and no thumbnail

#### Scenario: Cards in a projected cycle
- **WHEN** the visitor moves to a projected cycle and expands the card
- **THEN** the "Alquiler" row shows "Vivienda · Débito" and a thumbnail in "Débito"'s colours

#### Scenario: Progress only where there is an end
- **WHEN** the visitor changes "Seguro" to 40 € from the "Vivienda" card and unfolds the taken charges, the "Seguro" definition being 4 of 10 with an expected 35 €
- **THEN** the "Seguro" row's muted line reads "Vivienda · Crédito · esperado 35 € · 4 de 10"
- **AND** no other row shows a progress, and none shows a placeholder in its place

#### Scenario: Taken is not dimmed
- **WHEN** the card is expanded with its taken charges shown, in both themes
- **THEN** every row's computed opacity is 1
- **AND** the text colour of a taken row's name equals the text colour of a pending row's name

#### Scenario: True columns
- **WHEN** the card is expanded with its taken charges shown at a 390px-wide viewport
- **THEN** every mark has the same width and every day number is rendered with tabular figures
- **AND** every amount's right edge is at the same x position, with tabular figures, and that x equals the right edge of the amounts in the "Movimientos" card

#### Scenario: A caption does not move the columns
- **WHEN** the visitor changes "Alquiler" to 880 € from the "Vivienda" card, so its muted line gains "esperado 820 €"
- **THEN** every amount's right edge is still at the same x position, and every mark still has the same width
- **AND** every thumbnail has the same size and its right edge is at the same distance from its amount's left edge, while the rows without a card keep their amount on the same right edge
- **AND** every row is still at least 48px tall

#### Scenario: State reaches assistive technology
- **WHEN** assistive technology reads the expanded card in Spanish with its taken charges shown
- **THEN** each row exposes its name, its day, its category, its card when it has one, and its amount, whether it is already charged or still pending, and its progress or expected amount when it has one
- **AND** the taken-charges line is exposed as a button with its count and its expanded state

#### Scenario: Expanding pushes content down
- **WHEN** the card is expanded on `/demo`, and then its taken charges are unfolded
- **THEN** each time, the first expense card below it moves down by the added height and is not covered

#### Scenario: Folding under reduced motion
- **WHEN** reduced motion is emulated and the visitor activates "3 cobrados"
- **THEN** in the first frame after the activation the three taken rows are at their final height and full opacity

### Requirement: The card takes no accent colour

Every colour in the card SHALL come from a theme token, and the card SHALL render correctly in the light and the dark theme.

- The brand colour SHALL appear only on the chevrons of the card's disclosure and of the taken-charges line while each is expanded, as on every disclosure of the dashboard, and on the focus indicator every control shares (`design-system` → *Interaction states*). It SHALL NOT appear on the check badge, on a day mark, on the next-charge line, on a row's muted line, or on a row in its pressed or hovered state.
- The warning and danger colours SHALL NOT appear. A charge that is due soon is not a warning, and a charge that cost more than expected is not an error.
- A row's day mark SHALL be the only place a category colour appears, as a tint and a thin ring of the stored palette (`theming` → *Category colours resolve per theme*). The card thumbnail SHALL be the only other place a palette colour appears, as the card's own face colours (`card-wallet` → *The card face*), never the category's. Text SHALL never take a palette colour; the card's name on the muted line is in the muted line's colour.
- Its title, its next-charge line, its group heading, its taken-charges line, its rows, their day numbers on the tinted marks, their muted lines and its footer SHALL each reach at least 4.5:1 contrast against what they sit on, in both themes.

#### Scenario: No accents
- **WHEN** `/demo` is rendered in both themes with the card collapsed, and again expanded with its taken charges folded
- **THEN** no element inside the card computes to the warning or danger colour
- **AND** the only element computing to the brand colour is the card's open chevron

#### Scenario: No accents on a difference
- **WHEN** a row is showing an expected amount on its muted line, in both themes
- **THEN** no element of that row computes to the brand, warning or danger colour

#### Scenario: Both themes
- **WHEN** the expanded card with its taken charges shown is rendered in the light theme and in the dark theme
- **THEN** the title, the next-charge line, the "Pendientes" heading, the taken-charges line, every name, day number, muted line and amount, and the footer line each reach at least 4.5:1 against their background in both

#### Scenario: Only dots carry colour
- **WHEN** the computed colours inside the expanded card are collected with its taken charges shown
- **THEN** the only ones outside the neutral tokens are the day marks' tints and rings, each derived from the colour of its category card's dot, the card thumbnails, each drawn from its card's face colours, the open chevrons in the brand ink, and the focus indicator of a focused control

#### Scenario: A rainbow card's thumbnail
- **WHEN** "Crédito" is recoloured to "arcoiris" and the card is expanded with its taken charges shown
- **THEN** the thumbnails of "Gimnasio" and "Seguro" change colour over time like the card's face, and under reduced motion they stay still
