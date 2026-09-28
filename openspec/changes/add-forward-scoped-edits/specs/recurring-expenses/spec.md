## MODIFIED Requirements

### Requirement: Where you touch decides what you change

A change to a definition SHALL apply to future cycles, and to this cycle's charge only while that charge is still pending. No change, from any surface, SHALL alter any charge of an earlier cycle than the one it was made from.

**From "Próximos cobros".** The definition sheet SHALL keep changing every cycle from the cycle in progress on, without asking:
- Saving a new expected amount SHALL update this cycle's charge **only if it is still pending**. A charge already confirmed SHALL keep its amount, because that is what was really paid.
- Saving a new day, name or category SHALL update this cycle's charge while it is pending, and SHALL leave a confirmed charge untouched.

**From a row.** Editing or deleting a row that belongs to a definition — a charge in a category card or an income entry in the income panel, real or projected, in the cycle in progress or in a projection — SHALL ask how far it reaches (*Every change to a recurring row asks how far it reaches*):
- **"Solo este mes"** SHALL change or delete that cycle's slot only. It SHALL NOT change the definition's expected amount, day, name, category, active state or number of repetitions, nor any other cycle.
- **"Desde este mes en adelante"** SHALL change that cycle's slot and the definition, so that every later cycle follows. Cycles between the one in progress and the one the change was made from SHALL keep what they showed before the change. A later cycle's pending slot that differed from the definition ("solo este mes" edits) SHALL take the new values; a confirmed row SHALL keep what was paid.

**Confirmation copy.** After a definition is saved from its sheet, the message announced SHALL state that this is now the amount of every month rather than a generic "saved". After a row is saved with "Desde este mes en adelante", the message SHALL state that the change applies from that month on. After a row is saved with "Solo este mes", or a row not linked to a definition is saved, the message SHALL be "Cambios guardados".

#### Scenario: A pending charge follows the new expectation
- **WHEN** on `/demo` in Spanish the visitor opens the "Gimnasio" definition (40 €, day 22, pending) and saves an expected amount of 45 €
- **THEN** the "Salud" card shows 45 €, the "Próximos cobros" row for "Gimnasio" shows 45 €, the footer total shows 1.030 €, and the free margin shows 859 €

#### Scenario: A confirmed charge keeps what was paid
- **WHEN** the visitor opens the "Alquiler" definition (820 €, day 1, already charged) and saves an expected amount of 880 €
- **THEN** the "Vivienda" card still shows 900 €, the "Alquiler" row in "Próximos cobros" still shows 820 €, and the free margin still shows 864 €
- **AND** the "Alquiler" row shows a muted caption stating that 880 € is expected

#### Scenario: Editing the charge leaves the definition alone
- **WHEN** the visitor changes this cycle's "Alquiler" charge to 880 € from the "Vivienda" card, chooses "Solo este mes" and saves
- **THEN** the "Alquiler" definition still holds an expected amount of 820 €, its active state and its day are unchanged
- **AND** the October projection lists "Alquiler" at 820 €

#### Scenario: From this month on, from the cycle in progress
- **WHEN** the visitor changes this cycle's pending "Gimnasio" charge to 45 € from the "Salud" card, chooses "Desde este mes en adelante" and saves
- **THEN** the "Salud" card shows 45 €, the "Gimnasio" definition holds 45 €, and every projection lists "Gimnasio" at 45 €
- **AND** the message announced states that the change applies from September on

#### Scenario: From this month on, from a projection
- **WHEN** September is in progress and the visitor opens the December projection, changes "Gimnasio" to 50 €, chooses "Desde este mes en adelante" and saves
- **THEN** December and every later projection list "Gimnasio" at 50 €
- **AND** September still shows 40 €, and the October and November projections still list it at 40 €

#### Scenario: Onward overrides a later exception
- **WHEN** the November "Gimnasio" slot was set to 60 € with "Solo este mes", and the visitor then sets October's to 50 € with "Desde este mes en adelante"
- **THEN** October and November both list "Gimnasio" at 50 €

#### Scenario: The confirmation states the scope
- **WHEN** the visitor saves an expected amount of 880 € for "Alquiler" from its definition sheet, in Spanish
- **THEN** the message announced names the definition and states that this is the amount of every month
- **AND** saving a charge with "Solo este mes" announces "Cambios guardados"

## ADDED Requirements

### Requirement: Every change to a recurring row asks how far it reaches

Whenever a save or a delete from the entry sheet targets a row that belongs to a recurring definition, expense or income, real or projected, in any cycle, the sheet SHALL ask "Solo este mes" or "Desde este mes en adelante" (in the active language) before it runs. The question SHALL be the same control, with the same two labels in the same order, that the category sheet uses for a projected budget (`category-editing` → *A future cycle's budget asks how far it reaches*):

- a single choice with neither option preselected, shown in the sheet itself and not in a separate dialog
- for a save, shown when any field differs from the value it opened with; the save action SHALL be unavailable until one is chosen
- for a delete, shown as the delete confirmation step, where each option is its own destructive action and Cancel is the safe default, reachable first by keyboard
- never shown for a row that belongs to no definition

**Swipe.** Swiping a recurring row, real or projected, SHALL delete that cycle's slot only ("Solo este mes"), without asking, and SHALL offer "Deshacer" as any swipe does. The toast SHALL state that only this month's row was deleted.

#### Scenario: The question appears on save
- **WHEN** the visitor opens the "Gimnasio" charge in the "Salud" card and changes its amount
- **THEN** the sheet shows "Solo este mes" and "Desde este mes en adelante", neither selected, and the save action is unavailable
- **AND** after choosing one, the save action becomes available

#### Scenario: No question for a plain expense
- **WHEN** the visitor opens the "Cine" expense and changes its amount
- **THEN** no scope choice is shown and the save action is available

#### Scenario: Delete asks in the confirmation step
- **WHEN** the visitor activates the delete action on the "Gimnasio" charge
- **THEN** the confirmation step offers "Solo este mes", "Desde este mes en adelante" and Cancel, and Cancel receives keyboard focus first
- **AND** cancelling returns to the fields with nothing deleted

#### Scenario: Swipe deletes this month only
- **WHEN** the visitor long-swipes the "Gimnasio" charge in September
- **THEN** it is no longer listed in September, the toast states that only this month's row was deleted and offers "Deshacer"
- **AND** the October projection still lists "Gimnasio" at 40 €

### Requirement: A definition's slot in a cycle can be changed on its own

The page that mounts the dashboard SHALL supply, with the recurring operations, three operations on the slot a definition holds in one cycle. Every data source SHALL provide them with the same inputs and outcomes, and each SHALL resolve once the change is durable and reject with nothing changed:

- **edit in cycle:** takes the definition, the cycle, the row's amount, description, date and, for an expense, its category, and the scope. With "only", it SHALL write that cycle's slot with those values: the existing linked row when there is one, otherwise a new pending row linked to the definition and the cycle. With "onward", it SHALL also write, for every cycle after the one in progress and before the given one that holds no slot yet, a pending row with the values that cycle showed before the change; then update the definition's expected amount, day, name and category from the values; then rewrite every pending slot of a later cycle with the new values.
- **delete in cycle:** takes the definition, the cycle and the scope. With "only", it SHALL soft-delete that cycle's linked row, writing a soft-deleted linked row when there is none, so the slot stays held and nothing re-inserts it. With "onward", it SHALL write the rows of the cycles in between as edit does, soft-delete the slot of the given cycle and of every later cycle, and make the definition inactive. Rows of earlier cycles and confirmed rows of the cycle in progress before the given one SHALL NOT change.
- **restore in cycle:** clears the deletion mark of that cycle's slot, bringing back what the swipe removed.

A soft-deleted slot SHALL count nowhere and SHALL hold its cycle: neither the projection nor the daily generation SHALL list or insert that definition in that cycle.

#### Scenario: Only this month in a projection writes one row
- **WHEN** September is in progress and the visitor sets the December "Gimnasio" to 50 € with "Solo este mes"
- **THEN** one pending row linked to "Gimnasio" and to December exists at 50 €, the definition still holds 40 €, and no row exists for October or November

#### Scenario: Onward from a projection writes the cycles in between
- **WHEN** September is in progress, generated, and the visitor sets the December "Gimnasio" to 50 € with "Desde este mes en adelante"
- **THEN** pending rows linked to "Gimnasio" exist for October and November at 40 €, and for December at 50 €
- **AND** the definition holds 50 €

#### Scenario: Deleting onward from a projection
- **WHEN** the visitor deletes "Netflix" from the December projection with "Desde este mes en adelante"
- **THEN** the October and November projections still list "Netflix", December and later ones do not, and the definition is inactive
- **AND** September's "Netflix" charge is unchanged

#### Scenario: A deleted slot is not re-inserted
- **WHEN** the visitor swipes the November "Netflix" projected charge away and November later becomes the cycle in progress
- **THEN** the daily generation inserts no "Netflix" row for November, and the December projection still lists it

#### Scenario: A failed slot operation changes nothing
- **WHEN** the injected edit in cycle rejects
- **THEN** every cycle lists what it listed before, the definition is unchanged, and the sheet stays open holding the typed values with an alert
