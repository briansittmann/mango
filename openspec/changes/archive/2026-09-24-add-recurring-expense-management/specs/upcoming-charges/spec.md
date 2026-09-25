## MODIFIED Requirements

### Requirement: Expanded state lists the cycle's charges

Expanded, the card SHALL push the content below it rather than cover it, and SHALL list every charge of the cycle, one row each. Each row SHALL show, in this order: the day of the month in a contained chip, a 6px category dot, the name, and the amount aligned to the card's inner edge.

**What a row may add under the name**, in muted text and never both on the same line:
- the **progress** of a recurrence that ends, as the count produced out of the total (`recurring-expenses` → *A recurrence can end, and ends itself*). A charge whose definition has no end SHALL show nothing in its place — no dash, no placeholder, no "no end" label.
- the **expected amount**, only while the charge's amount differs from its definition's expected amount (`recurring-expenses` → *A charge that differs from its expectation says so, quietly*).

**Order and grouping.** Charges already taken SHALL be listed first, then the pending ones. Within each group, rows SHALL be ordered by day of the month, ascending. No header, label, divider, "today" marker or date separator SHALL be drawn between the two groups: the change of appearance at the boundary is the only marker.

**Telling the two apart.**
- A taken charge SHALL be dimmed to between 45% and 55% opacity and SHALL carry a checkmark. The dimming SHALL come from opacity and weight only — never from a different text colour.
- A pending charge SHALL be at full opacity and SHALL carry no checkmark.
- The distinction SHALL NOT rely on colour alone, and each row's state SHALL be available as text to assistive technology.

**Columns.** Day numbers and amounts SHALL use tabular figures and SHALL form true columns: every day chip SHALL have the same width, and every amount SHALL end at the same inner edge, whatever the number of digits. A caption under a name SHALL NOT break those columns and SHALL NOT shift the amount.

Rows SHALL be at least 48px tall, captions included. Opening and closing SHALL animate height as any other disclosure on the dashboard does, and SHALL honour a reduced-motion request (`design-system` → *Motion respects user preference*).

#### Scenario: Charged on top, pending below
- **WHEN** the card is expanded on `/demo` in Spanish
- **THEN** the rows read, in order: Alquiler día 1 · 820 €, Internet día 3 · 45 €, Seguro día 8 · 35 €, Parking día 15 · 50 €, Limpieza día 20 · 35 €, Gimnasio día 22 · 40 €
- **AND** the first three are dimmed and each carries a checkmark, and the last three are at full opacity with none
- **AND** no divider, label or marker is rendered between "Seguro" and "Parking"

#### Scenario: Progress only where there is an end
- **WHEN** the card is expanded on `/demo` in Spanish, the "Seguro" definition being 4 of 10
- **THEN** the "Seguro" row shows "4 de 10"
- **AND** no other row shows a progress, and none shows a placeholder in its place

#### Scenario: Dimming is opacity, not colour
- **WHEN** the card is expanded in both themes
- **THEN** each taken row's computed opacity is between 0.45 and 0.55
- **AND** the text colour of a taken row's name equals the text colour of a pending row's name

#### Scenario: True columns
- **WHEN** the card is expanded at a 390px-wide viewport
- **THEN** every day chip has the same width and every day number is rendered with tabular figures
- **AND** every amount's right edge is at the same x position, with tabular figures

#### Scenario: A caption does not move the columns
- **WHEN** the visitor changes "Alquiler" to 880 € from the "Vivienda" card, so its row gains an expected-amount caption
- **THEN** every amount's right edge is still at the same x position, and every day chip still has the same width
- **AND** every row is still at least 48px tall

#### Scenario: State reaches assistive technology
- **WHEN** assistive technology reads the expanded card in Spanish
- **THEN** each row exposes its name, its day and its amount, whether it is already charged or still pending, and its progress or expected amount when it has one

#### Scenario: Expanding pushes content down
- **WHEN** the card is expanded on `/demo`
- **THEN** the first expense card below it moves down by the card's added height and is not covered

### Requirement: The card takes no accent colour

Every colour in the card SHALL come from a theme token, and the card SHALL render correctly in the light and the dark theme.

- The brand colour SHALL NOT appear in the card, in any state: not on the chevron, not on the checkmark, not on the day chip, not on the next-charge line, not on a row's progress or expected-amount caption, and not on a row in its pressed, hovered or focused state, apart from the focus indicator every control on the dashboard shares (`design-system` → *Interaction states*).
- The warning and danger colours SHALL NOT appear. A charge that is due soon is not a warning, and a charge that cost more than expected is not an error.
- Category dots SHALL be the only colour in the card, drawn from the stored palette (`theming` → *Category colours resolve per theme*).
- Its title, its next-charge line, its rows, their captions and its footer SHALL each reach at least 4.5:1 contrast against the card, in both themes — the dimmed rows included.

#### Scenario: No accents
- **WHEN** `/demo` is rendered in both themes with the card collapsed and again expanded
- **THEN** no element inside the card computes to the brand, warning or danger colour

#### Scenario: No accents on a difference
- **WHEN** a row is showing an expected-amount caption, in both themes
- **THEN** no element of that row computes to the brand, warning or danger colour

#### Scenario: Both themes
- **WHEN** the expanded card is rendered in the light theme and in the dark theme
- **THEN** the title, the next-charge line, every name, day, amount and caption, and the footer line each reach at least 4.5:1 against the card in both

#### Scenario: Only dots carry colour
- **WHEN** the computed colours inside the expanded card are collected
- **THEN** the only ones outside the neutral tokens are the category dots, each matching its category card's dot, and the focus indicator of a focused row

## REMOVED Requirements

### Requirement: The card is read-only and looks read-only

**Reason**: The definition of a recurring expense had nowhere to live. ARCHITECTURE §7 and §9 sent it to a fixed-expenses screen of the dashboard that was never built and is now ruled out, so the only surface that lists the definitions' effects has to be the one that owns them. This card stops being read-only, and only in that one respect: a row opens the definition, and nothing else about the card changes.

**Migration**: Replaced by *A row opens its definition, and nothing else does* in this same capability. Every guarantee of the removed requirement is carried over verbatim except the first bullet: there is still no swipe, no add row, no inline editing, no amount on a lighter surface, and no helper text explaining what the card does. Editing a *charge* is unchanged and still happens only in its category card (`expense-editing` → *Entry points*).

## ADDED Requirements

### Requirement: A row opens its definition, and nothing else does

Activating a row by tap, click, Enter or Space SHALL open the definition sheet for that charge's definition (`recurring-expenses` → *The definition sheet*). Each row SHALL be a button, named by its charge, at least 48px tall, reachable in reading order by keyboard, and with a visible focus indicator.

Nothing else in the card SHALL be editable, and nothing else SHALL suggest it is:

- The card's only controls SHALL be its disclosure and its rows. No row SHALL offer a delete panel or respond to a drag; the card SHALL NOT have an add row; and no value inside a row SHALL be a form field.
- No amount, name, day or caption in the card SHALL sit on a surface lighter than the card, other than the day chip. Amounts in particular SHALL have a transparent background, unlike the amounts on an expense card, which look editable at rest.
- The card SHALL NOT explain what a row opens: no helper text, caption, tooltip or hint SHALL say that the rows change every month, that they are counted in their categories, or that editing happens elsewhere. The sheet that opens states its own scope.
- Activating a row SHALL NOT change any value, and SHALL NOT open the entry sheet.
- When the mounting page supplies no definition operations, the rows SHALL be rendered disabled rather than inert (`dashboard-ui` → *Controls without a handler are disabled*).

A charge SHALL remain editable in its own category card, which is the only place the charge itself is opened from (`expense-editing` → *Entry points*).

#### Scenario: A row opens the definition
- **WHEN** the card is expanded on `/demo` in Spanish and the "Alquiler" row is activated by tap, and separately by click and by Enter
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
- **WHEN** the visitor moves keyboard focus through the expanded card
- **THEN** focus reaches the disclosure and then each row in the order the rows are listed, each exposed as a button named by its charge and showing a visible focus indicator
- **AND** each row's hit area is at least 48px tall

#### Scenario: No explanation
- **WHEN** the card is rendered in Spanish and in English, collapsed and expanded
- **THEN** no text states what activating a row does, that the charges are included in their categories, or that they are counted once

#### Scenario: No add row
- **WHEN** the card is expanded
- **THEN** it has no add row, and its last element is the footer line
