# Upcoming Charges Specification

## Purpose

The billing calendar of a cycle: which recurring charges have already been taken and which are still coming, with their day of the month. It answers *when*, where the expense cards answer *how much*, and it never lets the same money be read twice.

## Requirements

### Requirement: Charges are derived, never queried

The card SHALL render from data supplied by the page that mounts it, and SHALL NOT read from the database or hold sample data of its own.

A charge of the displayed cycle is an expense that:
- is marked recurring and carries a day of the month (1–31) and a charged-or-pending state
- is not soft-deleted

Each charge SHALL carry the name, the amount and the colour of the category it belongs to. That colour SHALL be the same value as the dot on that category's card.

The charges SHALL be derived from the same expense rows the category cards render, so that any change to a charge — its amount, its description, its deletion or its restoration — moves the card, its footer total and the free margin in the same render.

The card SHALL NOT be rendered at all when the cycle has no charges.

#### Scenario: Same rows as the cards
- **WHEN** on `/demo` in Spanish the visitor opens the "Vivienda" card, changes "Alquiler" from 820 € to 880 € and saves
- **THEN** the "Próximos cobros" row for "Alquiler" shows 880 €, its footer total shows 1.085 €, the "Vivienda" card shows 960 €, and the free margin shows 914 €

#### Scenario: Deleted charge leaves the card
- **WHEN** the visitor deletes the "Parking" charge from the "Transporte" card
- **THEN** "Parking" is no longer listed in "Próximos cobros" and the footer total drops by 50 €
- **AND** after activating "Deshacer" it is listed again, in its place by day

#### Scenario: A dot is shared, not copied
- **WHEN** the card is expanded on `/demo`
- **THEN** the dot on the "Alquiler" row and the dot on the "Vivienda" card header resolve to the same colour value

#### Scenario: A cycle with no recurring charges
- **WHEN** the dashboard is mounted with a cycle whose expenses are all one-off
- **THEN** no "Próximos cobros" card is rendered, and no empty state or placeholder is shown in its place

#### Scenario: No database traffic
- **WHEN** `/demo` is loaded and the card is expanded
- **THEN** the browser makes no request to the Supabase project

### Requirement: Collapsed state answers when, not how much

Collapsed, the card SHALL show its title and, aligned right, **the next charge with its day** — a name and a day of the month, never an amount and never a total.

The next charge SHALL be the pending charge with the lowest day. When every charge of the cycle is already taken, it SHALL be the first charge of the next cycle, which is the charge with the lowest day among the cycle's charges, shown in the same format. No other collapsed state SHALL exist: the card SHALL NOT show an amount, a count, a "nothing pending" message or an empty right-hand side.

The collapsed card SHALL be visibly subordinate to the expense cards:
- it SHALL be shorter than a collapsed expense card
- it SHALL NOT show a colour dot, a total, a budget bar or an options control
- its chevron SHALL use the muted text colour in both the open and the closed state, and SHALL NOT take the brand colour
- its border SHALL use the border token in both states, and SHALL NOT take a category colour when open

#### Scenario: Next charge with its day
- **WHEN** `/demo` is rendered in Spanish with the card collapsed
- **THEN** the card shows "Próximos cobros" and "Parking · día 15"
- **AND** no amount and no total is shown anywhere in the collapsed card

#### Scenario: Everything already charged
- **WHEN** the card is mounted with a cycle whose charges are all confirmed, the lowest day among them being 1 for "Alquiler"
- **THEN** the collapsed card shows "Alquiler · día 1", in the same format as any other next charge
- **AND** no total, count or completion message is shown

#### Scenario: Shorter than an expense card
- **WHEN** `/demo` is rendered at a 390px-wide viewport with every card collapsed, in both themes
- **THEN** the "Próximos cobros" card is shorter than every collapsed expense card
- **AND** it contains no colour dot and no options control, and its chevron's computed colour equals the muted text colour

### Requirement: Expanded state lists the cycle's charges

Expanded, the card SHALL push the content below it rather than cover it, and SHALL list every charge of the cycle, one row each. Each row SHALL show, in this order: the day of the month in a contained chip, a 6px category dot, the name, and the amount aligned to the card's inner edge.

**Order and grouping.** Charges already taken SHALL be listed first, then the pending ones. Within each group, rows SHALL be ordered by day of the month, ascending. No header, label, divider, "today" marker or date separator SHALL be drawn between the two groups: the change of appearance at the boundary is the only marker.

**Telling the two apart.**
- A taken charge SHALL be dimmed to between 45% and 55% opacity and SHALL carry a checkmark. The dimming SHALL come from opacity and weight only — never from a different text colour.
- A pending charge SHALL be at full opacity and SHALL carry no checkmark.
- The distinction SHALL NOT rely on colour alone, and each row's state SHALL be available as text to assistive technology.

**Columns.** Day numbers and amounts SHALL use tabular figures and SHALL form true columns: every day chip SHALL have the same width, and every amount SHALL end at the same inner edge, whatever the number of digits.

Rows SHALL be at least 48px tall. Opening and closing SHALL animate height as any other disclosure on the dashboard does, and SHALL honour a reduced-motion request (`design-system` → *Motion respects user preference*).

#### Scenario: Charged on top, pending below
- **WHEN** the card is expanded on `/demo` in Spanish
- **THEN** the rows read, in order: Alquiler día 1 · 820 €, Internet día 3 · 45 €, Seguro día 8 · 35 €, Parking día 15 · 50 €, Limpieza día 20 · 35 €, Gimnasio día 22 · 40 €
- **AND** the first three are dimmed and each carries a checkmark, and the last three are at full opacity with none
- **AND** no divider, label or marker is rendered between "Seguro" and "Parking"

#### Scenario: Dimming is opacity, not colour
- **WHEN** the card is expanded in both themes
- **THEN** each taken row's computed opacity is between 0.45 and 0.55
- **AND** the text colour of a taken row's name equals the text colour of a pending row's name

#### Scenario: True columns
- **WHEN** the card is expanded at a 390px-wide viewport
- **THEN** every day chip has the same width and every day number is rendered with tabular figures
- **AND** every amount's right edge is at the same x position, with tabular figures

#### Scenario: State reaches assistive technology
- **WHEN** assistive technology reads the expanded card in Spanish
- **THEN** each row exposes its name, its day and its amount, and whether it is already charged or still pending

#### Scenario: Expanding pushes content down
- **WHEN** the card is expanded on `/demo`
- **THEN** the first expense card below it moves down by the card's added height and is not covered

### Requirement: Footer states what the cycle has committed

Below the last row, after a hairline divider, the card SHALL show one muted line with the total of every charge of the cycle, pending and taken alike, labelled as what the cycle has committed.

That figure SHALL be set smaller than the row amounts and SHALL use tabular figures. It SHALL be the only total anywhere in the card.

#### Scenario: Committed total
- **WHEN** the card is expanded on `/demo` in Spanish
- **THEN** a line under a hairline divider reads "comprometido este ciclo · 1.025 €", which is the sum of the three taken and the three pending charges
- **AND** its computed font size is smaller than that of the row amounts

#### Scenario: One total only
- **WHEN** the card is expanded
- **THEN** the footer figure is the only total rendered in the card, and no group subtotal is shown

### Requirement: The card is read-only and looks read-only

Nothing in the card SHALL be editable, and nothing SHALL suggest it is.

- The card's only control SHALL be its disclosure. No row SHALL be a button, a link or a form field; no row SHALL respond to tap, click, Enter, Space or a drag; no row SHALL offer a delete panel; and the card SHALL NOT have an add row.
- No amount, name or day in the card SHALL sit on a surface lighter than the card, other than the day chip. Amounts in particular SHALL have a transparent background, unlike the amounts on an expense card, which look editable at rest.
- The card SHALL NOT explain the absence of editing: no helper text, caption or tooltip SHALL say that the rows cannot be changed or that they are counted in their categories.
- A charge SHALL remain editable in its own category card, which is the single place a charge is opened from (`expense-editing` → *Entry points*).

#### Scenario: Nothing responds
- **WHEN** on `/demo` each row of the expanded card is tapped, then dragged 60px to the left, then focused with the keyboard and activated with Enter
- **THEN** no sheet opens, no delete panel is revealed, no row moves, and no value changes

#### Scenario: Flat amounts
- **WHEN** the card is expanded next to an expanded expense card, in both themes
- **THEN** every amount in "Próximos cobros" has a transparent background, while every amount in the expense card has an opaque background different from its row's

#### Scenario: One control
- **WHEN** the expanded card's controls are listed
- **THEN** the only one is the disclosure, exposed as expanded and named by the card

#### Scenario: No explanation
- **WHEN** the card is rendered in Spanish and in English, collapsed and expanded
- **THEN** no text states that the charges cannot be edited, that they are included in their categories, or that they are counted once

### Requirement: The card takes no accent colour

Every colour in the card SHALL come from a theme token, and the card SHALL render correctly in the light and the dark theme.

- The brand colour SHALL NOT appear in the card, in any state: not on the chevron, not on the checkmark, not on the day chip, not on the next-charge line.
- The warning and danger colours SHALL NOT appear in the card. A charge that is due soon is not a warning.
- Category dots SHALL be the only colour in the card, drawn from the stored palette (`theming` → *Category colours resolve per theme*).
- Its title, its next-charge line, its rows and its footer SHALL each reach at least 4.5:1 contrast against the card, in both themes — the dimmed rows included.

#### Scenario: No accents
- **WHEN** `/demo` is rendered in both themes with the card collapsed and again expanded
- **THEN** no element inside the card computes to the brand, warning or danger colour

#### Scenario: Both themes
- **WHEN** the expanded card is rendered in the light theme and in the dark theme
- **THEN** the title, the next-charge line, every name, day and amount, and the footer line each reach at least 4.5:1 against the card in both

#### Scenario: Only dots carry colour
- **WHEN** the computed colours inside the expanded card are collected
- **THEN** the only ones outside the neutral tokens are the category dots, each matching its category card's dot

### Requirement: Only expense charges are listed

The card SHALL list recurring **expense** charges only. A recurring movement of any other type — an income entry produced by a recurring definition, and later a savings movement — SHALL NOT be listed, SHALL NOT be counted in the committed-this-cycle total, and SHALL NOT be eligible to be the next charge shown in the collapsed state.

A salary that arrives on the same day every month is a recurrence, not a charge: the card answers what the cycle still owes, and money coming in never appears there.

This SHALL hold however the charge was created, including a recurring income entry added in the session that is being viewed, and SHALL hold whether or not the cycle has any expense charges at all: a cycle whose only recurring movements are income SHALL render no card (*Charges are derived, never queried*).

#### Scenario: A recurring salary is not a charge
- **WHEN** on `/demo` in Spanish the visitor adds an income entry of 2 400 € described as "Salario", with the recurrence switch on and day 1
- **THEN** "Salario" is listed in the income panel and the income total rises by 2 400 €
- **AND** "Próximos cobros" still lists six charges, none of them named "Salario", and its footer still reads 1.025 €

#### Scenario: Collapsed state ignores income recurrences
- **WHEN** an income recurrence falling on day 2 exists and the card is collapsed on `/demo` in Spanish
- **THEN** the collapsed card still shows "Parking · día 15" as the next charge

#### Scenario: A cycle whose only recurrences are income
- **WHEN** the dashboard is mounted with a cycle whose expenses are all one-off and whose only recurring definitions are income
- **THEN** no "Próximos cobros" card is rendered
