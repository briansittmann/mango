## REMOVED Requirements

### Requirement: Collapsed state answers when, not how much
**Reason**: Replaced by *Collapsed header answers when, not how much*. The collapsed card is no longer shorter than a category card or subordinate to it: its header matches the category cards and "Movimientos", and its chevron behaves like theirs.
**Migration**: None. The next-charge rule and the "no amount, no total" rule carry over unchanged.

### Requirement: Expanded state lists the cycle's charges
**Reason**: Replaced by *Expanded state lists pending charges first*. The order flips to pending first with the taken charges folded behind a count line, taken rows are no longer dimmed, and the day chip and 6px dot become one tinted day mark.
**Migration**: References to the progress and expected-amount rules point to the new requirement, which keeps them.

## ADDED Requirements

### Requirement: Collapsed header answers when, not how much

Collapsed, the card SHALL show its title and, aligned right, **the next charge with its day** — a name and a day of the month, never an amount and never a total.

The next charge SHALL be the pending charge with the lowest day. When every charge of the cycle is already taken, it SHALL be the first charge of the next cycle, which is the charge with the lowest day among the cycle's charges, shown in the same format. No other collapsed state SHALL exist: the card SHALL NOT show an amount, a count, a "nothing pending" message or an empty right-hand side.

The collapsed card SHALL read as a peer of the other cards in the main column, with the same header as a category card and as the "Movimientos" card (`transaction-list`):
- its header SHALL be as tall as a collapsed category card's header
- its title SHALL use the regular text colour at medium weight, as a category card's name does; the next-charge line SHALL use the muted text colour
- its chevron SHALL be the dashboard's disclosure chevron: muted while collapsed, and in the brand ink and turned while expanded, as on a category card
- it SHALL NOT show a colour dot, a total, a budget bar or an options control
- its border SHALL use the border token in both states, and SHALL NOT take a category colour when open

#### Scenario: Next charge with its day
- **WHEN** `/demo` is rendered in Spanish with the card collapsed
- **THEN** the card shows "Próximos cobros" and "Parking · día 15"
- **AND** no amount and no total is shown anywhere in the collapsed card

#### Scenario: Everything already charged
- **WHEN** the card is mounted with a cycle whose charges are all confirmed, the lowest day among them being 1 for "Alquiler"
- **THEN** the collapsed card shows "Alquiler · día 1", in the same format as any other next charge
- **AND** no total, count or completion message is shown

#### Scenario: Same header as a category card
- **WHEN** `/demo` is rendered at a 390px-wide viewport and at a 1280px-wide viewport with every card collapsed, in both themes
- **THEN** the "Próximos cobros" header is as tall as the "Vivienda" card header, within 1px
- **AND** the title's computed colour and weight equal those of the "Vivienda" card's name, and the next-charge line's computed colour equals the muted text colour
- **AND** the card contains no colour dot and no options control

#### Scenario: Chevron follows the open state
- **WHEN** the card is expanded and collapsed again, in both themes
- **THEN** while expanded its chevron computes to the brand ink and is turned, and while collapsed it computes to the muted text colour, matching a category card's chevron in each state
- **AND** the card's border computes to the border token in both states

### Requirement: Expanded state lists pending charges first

Expanded, the card SHALL push the content below it rather than cover it, and SHALL list every charge of the cycle, one row each.

**Row anatomy**, in the same arrangement as a "Movimientos" row (`transaction-list` → *Movement rows*):
- **One mark** on the left: a 32px circle tinted with the category's colour and ringed with it at full strength, holding the day of the month in the regular text colour with tabular figures. A taken charge's mark SHALL carry a small check badge on its edge, in neutral tokens. No other mark, chip or dot SHALL be drawn on the row.
- **The name**, over **one muted line** that starts with the category's name and adds, joined with " · ":
  - the **expected amount** ("esperado 820 €"), only while the charge's amount differs from its definition's expected amount (`recurring-expenses` → *A charge that differs from its expectation says so, quietly*);
  - the **progress** of a recurrence that ends, as the count produced out of the total ("4 de 10") (`recurring-expenses` → *A recurrence can end, and ends itself*). A charge whose definition has no end SHALL show nothing in its place — no dash, no placeholder, no "no end" label.
- **The amount** on the right, with tabular figures, inset from the card's inner edge exactly as a "Movimientos" amount is, so the amounts of both cards end on the same vertical line.

**Order and grouping.**
- The **pending** charges SHALL come first, under a "Pendientes" heading drawn like a "Movimientos" day heading, ordered by day of the month, ascending. When no charge is pending, neither the heading nor the group SHALL be shown.
- The **taken** charges SHALL follow, behind a single disclosure line that names their count ("3 cobrados", "1 cobrado") with the dashboard's disclosure chevron. The line SHALL start folded when the page loads. Activating it SHALL show the taken charges below it, ordered by day ascending, and activating it again SHALL hide them. While folded, the taken rows SHALL be neither visible nor reachable by keyboard or assistive technology. When no charge is taken, the line SHALL NOT be shown.
- Folding or unfolding the taken charges SHALL NOT fold the card, SHALL NOT change the next charge shown in the header, and SHALL NOT change the footer total.

**Telling the two apart.**
- A taken charge SHALL sit in the taken group and SHALL carry the check badge on its mark. It SHALL be at full opacity, and its name, muted line and amount SHALL use the same colours as a pending row's.
- A pending charge SHALL carry no check badge.
- The distinction SHALL NOT rely on colour alone, and each row's state SHALL be available as text to assistive technology.

**Columns.** Every mark SHALL have the same width and every amount SHALL end at the same inner edge, whatever the number of digits. The muted line SHALL NOT break those columns and SHALL NOT shift the amount.

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
- **THEN** the "Parking" row has exactly one mark, a 32px circle holding "15", and its muted line reads "Transporte"
- **AND** no row contains a separate day chip or category dot

#### Scenario: Progress only where there is an end
- **WHEN** the visitor changes "Seguro" to 40 € from the "Vivienda" card and unfolds the taken charges, the "Seguro" definition being 4 of 10 with an expected 35 €
- **THEN** the "Seguro" row's muted line reads "Vivienda · esperado 35 € · 4 de 10"
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
- **AND** every row is still at least 48px tall

#### Scenario: State reaches assistive technology
- **WHEN** assistive technology reads the expanded card in Spanish with its taken charges shown
- **THEN** each row exposes its name, its day, its category and its amount, whether it is already charged or still pending, and its progress or expected amount when it has one
- **AND** the taken-charges line is exposed as a button with its count and its expanded state

#### Scenario: Expanding pushes content down
- **WHEN** the card is expanded on `/demo`, and then its taken charges are unfolded
- **THEN** each time, the first expense card below it moves down by the added height and is not covered

#### Scenario: Folding under reduced motion
- **WHEN** reduced motion is emulated and the visitor activates "3 cobrados"
- **THEN** in the first frame after the activation the three taken rows are at their final height and full opacity

## MODIFIED Requirements

### Requirement: Charges are derived, never queried

The card SHALL render from data supplied by the page that mounts it, and SHALL NOT read from the database or hold sample data of its own.

A charge of the displayed cycle is an expense that:
- is marked recurring and carries a day of the month (1–31) and a charged-or-pending state
- is not soft-deleted

Each charge SHALL carry the name, the amount, and the name and colour of the category it belongs to. That colour SHALL be the same value as the dot on that category's card.

The charges SHALL be derived from the same expense rows the category cards render, so that any change to a charge — its amount, its description, its deletion or its restoration — moves the card, its footer total and the free margin in the same render. The footer total SHALL equal the fixed expenses term of the free margin (`category-editing` → *A budget reserves its amount in the free margin*).

The card SHALL NOT be rendered at all when the cycle has no charges.

#### Scenario: Same rows as the cards
- **WHEN** on `/demo` in Spanish the visitor opens the "Vivienda" card, changes "Alquiler" from 820 € to 880 € and saves
- **THEN** the "Próximos cobros" row for "Alquiler" shows 880 €, its footer total shows 1.085 €, the "Vivienda" card shows 960 €, and the free margin shows 804 €

#### Scenario: Deleted charge leaves the card
- **WHEN** the visitor deletes the "Parking" charge from the "Transporte" card
- **THEN** "Parking" is no longer listed in "Próximos cobros" and the footer total drops by 50 €
- **AND** after activating "Deshacer" it is listed again, in its place by day among the pending charges

#### Scenario: A dot is shared, not copied
- **WHEN** the card is expanded on `/demo` and its taken charges are shown
- **THEN** the tint and the ring of the day mark on the "Alquiler" row are derived from the same colour value as the dot on the "Vivienda" card header
- **AND** the muted line of the "Alquiler" row names "Vivienda"

#### Scenario: A cycle with no recurring charges
- **WHEN** the dashboard is mounted with a cycle whose expenses are all one-off
- **THEN** no "Próximos cobros" card is rendered, and no empty state or placeholder is shown in its place

#### Scenario: No database traffic
- **WHEN** `/demo` is loaded and the card is expanded
- **THEN** the browser makes no request to the Supabase project

### Requirement: A row opens its definition, and nothing else does

Activating a row by tap, click, Enter or Space SHALL open the definition sheet for that charge's definition (`recurring-expenses` → *The definition sheet*). Each row SHALL be a button, named by its charge, at least 48px tall, reachable in reading order by keyboard, and with a visible focus indicator.

Nothing else in the card SHALL be editable, and nothing else SHALL suggest it is:

- The card's only controls SHALL be its disclosure, the taken-charges line and its rows. No row SHALL offer a delete panel or respond to a drag; the card SHALL NOT have an add row; and no value inside a row SHALL be a form field.
- No amount, name, day or caption in the card SHALL sit on a surface other than the card, apart from the day number on its tinted mark. Amounts in particular SHALL have a transparent background, unlike the amounts on an expense card, which look editable at rest.
- The card SHALL NOT explain what a row opens: no helper text, caption, tooltip or hint SHALL say that the rows change every month, that they are counted in their categories, or that editing happens elsewhere. The sheet that opens states its own scope.
- Activating a row SHALL NOT change any value, and SHALL NOT open the entry sheet.
- When the mounting page supplies no definition operations, the rows SHALL be rendered disabled rather than inert (`dashboard-ui` → *Controls without a handler are disabled*). The taken-charges line SHALL still fold and unfold.

A charge SHALL remain editable in its own category card, which is the only place the charge itself is opened from (`expense-editing` → *Entry points*).

#### Scenario: A row opens the definition
- **WHEN** the card is expanded on `/demo` in Spanish, its taken charges are shown, and the "Alquiler" row is activated by tap, and separately by click and by Enter
- **THEN** each time, the definition sheet opens titled "Alquiler" holding an expected amount of 820 €
- **AND** the entry sheet does not open, and no value on the page changes

#### Scenario: Two rows, two scopes
- **WHEN** the visitor activates "Alquiler" in "Próximos cobros" and, separately, the "Alquiler" row in the "Vivienda" card
- **THEN** the first opens the definition sheet, whose amount is labelled as the expected amount
- **AND** the second opens the entry sheet in edit mode, captioned "Vivienda · Solo el cargo de este mes"

#### Scenario: Still nothing else responds
- **WHEN** each row of the expanded card is dragged 60px to the left
- **THEN** no delete panel is revealed and no row moves

#### Scenario: Flat amounts
- **WHEN** the card is expanded next to an expanded expense card, in both themes
- **THEN** every amount in "Próximos cobros" has a transparent background, while every amount in the expense card has an opaque background different from its row's

#### Scenario: Rows are keyboard controls
- **WHEN** the visitor moves keyboard focus through the expanded card with its taken charges shown
- **THEN** focus reaches the disclosure, then each pending row in the order listed, then the taken-charges line, then each taken row in the order listed, each showing a visible focus indicator
- **AND** each row is exposed as a button named by its charge, and each row's hit area is at least 48px tall

#### Scenario: No explanation
- **WHEN** the card is rendered in Spanish and in English, collapsed and expanded
- **THEN** no text states what activating a row does, that the charges are included in their categories, or that they are counted once

#### Scenario: No add row
- **WHEN** the card is expanded
- **THEN** it has no add row, and its last element is the footer line

### Requirement: The card takes no accent colour

Every colour in the card SHALL come from a theme token, and the card SHALL render correctly in the light and the dark theme.

- The brand colour SHALL appear only on the chevrons of the card's disclosure and of the taken-charges line while each is expanded, as on every disclosure of the dashboard, and on the focus indicator every control shares (`design-system` → *Interaction states*). It SHALL NOT appear on the check badge, on a day mark, on the next-charge line, on a row's muted line, or on a row in its pressed or hovered state.
- The warning and danger colours SHALL NOT appear. A charge that is due soon is not a warning, and a charge that cost more than expected is not an error.
- A row's day mark SHALL be the only place a category colour appears, as a tint and a thin ring of the stored palette (`theming` → *Category colours resolve per theme*). Text SHALL never take a category colour.
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
- **THEN** the only ones outside the neutral tokens are the day marks' tints and rings, each derived from the colour of its category card's dot, the open chevrons in the brand ink, and the focus indicator of a focused control
