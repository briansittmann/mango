## MODIFIED Requirements

### Requirement: Entry points
The income sheet SHALL open from exactly these triggers:
- **The "add income" row** at the end of the open income panel: opens create mode.
- **An income row in the open income panel**, real or projected: activating it by tap, click, Enter or Space opens edit mode for that entry.

An income entry SHALL NOT be opened from anywhere else. In particular the `upcoming-charges` card SHALL never list it (`upcoming-charges` → *Only expense charges are listed*), and no category card SHALL contain it.

**Income entries produced by a recurring definition.** Such an entry is the slot a definition holds in one cycle, shown in the income panel like any other: a real entry in the cycle in progress or a past one, and a real or projected entry in a projection.
- Activating its row SHALL open edit mode for that entry, and the header caption SHALL state that it repeats every month.
- Saving or deleting it SHALL ask "Solo este mes" or "Desde este mes en adelante" and reach as far as the answer, and no further (`recurring-expenses` → *Where you touch decides what you change*, *Every change to a recurring row asks how far it reaches*). "Desde este mes en adelante" SHALL change the income definition itself: its expected amount, its day and its name, from that cycle on.
- Swiping it SHALL delete that cycle's entry only, with undo.
- The definition sheet SHALL NOT be reachable for an income definition; the income panel is where an income recurrence is changed.

#### Scenario: Keyboard opens edit mode
- **WHEN** keyboard focus is on the "Freelance" row and the user presses Enter
- **THEN** the sheet opens in edit mode for "Freelance"

#### Scenario: The panel's last row is the add row
- **WHEN** the income panel is open on `/demo`
- **THEN** its last row is the "Añadir ingreso" row, below every income row

#### Scenario: A recurring entry edits this month only
- **WHEN** the visitor activates the "Salario" row (2 400 €), which came from a recurring definition, changes the amount to 2 500, chooses "Solo este mes" and saves
- **THEN** the income column shows 2.920 € and the free margin 964 €
- **AND** a recording implementation receives one edit in cycle, for the "Salario" definition and the displayed cycle with "only", and no income update
- **AND** the October projection lists "Salario" at 2 400 €

#### Scenario: A recurring entry, from this month on
- **WHEN** the visitor changes "Salario" to 2 500 in the cycle in progress, chooses "Desde este mes en adelante" and saves
- **THEN** the income column shows 2.920 €, and every projection lists "Salario" at 2 500 €

#### Scenario: A raise from a future month
- **WHEN** September is in progress and the visitor opens the December projection, changes "Salario" to 2 600, chooses "Desde este mes en adelante" and saves
- **THEN** December and every later projection list "Salario" at 2 600 €, and September, October and November still show 2 400 €

#### Scenario: Deleting a fixed income from a month on
- **WHEN** the visitor opens "Salario" in the December projection, activates delete and chooses "Desde este mes en adelante"
- **THEN** the October and November projections still list "Salario", and December and every later projection do not
