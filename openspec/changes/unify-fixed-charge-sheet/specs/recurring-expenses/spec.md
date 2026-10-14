## MODIFIED Requirements

### Requirement: Recurring definitions go through injected operations

The page that mounts the dashboard SHALL supply changes to recurring definitions as six operations. Every data source SHALL provide them with the same inputs and outcomes:

- **create:** adds a definition from a name, an expected amount, a category, a day of the month, and an optional number of repetitions
- **update:** replaces an existing definition's name, expected amount, category, day of the month, and reminder settings
- **stop:** marks a definition as no longer active without removing it or any charge it produced
- **delete:** removes the definition and the charges it produced
- **set charged:** takes a definition, a cycle and whether its charge in that cycle is charged; it SHALL change only that charge's state, pending or charged, and nothing else of it or of the definition
- **set reminder:** takes a definition and its reminder setting (on or off, with a number of days before); it SHALL change only that setting, and no charge

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change definitions only through these operations and the slot operations (*A definition's slot in a cycle can be changed on its own*). No component SHALL change a definition through the expense operations, and no expense operation SHALL change a definition (`expense-editing` → *Expense changes go through injected operations*).

A definition SHALL carry: a name, an expected amount greater than 0, a category, a day of the month from 1 to 31, an active state, a reminder setting (on or off, with a number of days before), a number of repetitions that is either absent — meaning it never ends — or a whole number greater than 0, and a count of how many charges it has produced.

#### Scenario: Creating a definition reaches the data source
- **WHEN** a recording implementation of the operations is mounted and the visitor adds an expense with the recurrence switch on, a day of 15 and no end
- **THEN** the recorder receives one create call carrying the name, the amount, the category, day 15, and no number of repetitions

#### Scenario: Definition operations never run expense operations
- **WHEN** recording implementations of both the expense and the definition operations are mounted, and the visitor turns the reminder of "Parking" on from its sheet and saves
- **THEN** the definition recorder receives one set reminder for "Parking" and the expense recorder receives no create, update, soft delete or restore

#### Scenario: A failed operation changes nothing
- **WHEN** the injected set charged fails while marking "Parking" as charged
- **THEN** every figure on the page is as it was before, and "Parking" is still listed as pending

### Requirement: The recurrence switch creates the definition

The entry sheet SHALL offer a switch, labelled in the active language as repeating every month, below the last field:
- in create mode, in any cycle that is not projected;
- in edit mode, for an expense or an income entry that belongs to no definition, in the cycle in progress.

It SHALL start off. Edit mode SHALL NOT show the switch for a row that belongs to a definition, nor for a row of a past or projected cycle (`expense-editing` → *Entry points*).

**When the switch is on**, the sheet SHALL reveal, in place and without opening another sheet, step or screen:

- a **day of the month** field, from 1 to 31, starting at today's day in the user's time zone in create mode, and at the row's own day in edit mode
- a **how it ends** choice, with two options: no end, and a number of times. It SHALL start at no end. Choosing a number of times SHALL reveal a count field, a whole number greater than 0.
- below them, exactly **one muted line** describing what will happen, built from the values currently in the sheet: the chosen day, the amount typed, and the name of the category the expense is in. It SHALL be one sentence. No tutorial, caption stack, tooltip or help link SHALL be shown.

**When the switch is off**, none of those fields SHALL be visible, focusable or exposed to assistive technology, and the sheet SHALL create or save an ordinary one-off row.

**Saving with the switch on** SHALL create the definition and keep exactly one row for this cycle: in create mode the new row, in edit mode the edited row, moved to the chosen day, as the definition's charge of this cycle, counted as its first repetition. The charge SHALL appear in the "Próximos cobros" card in the same render (`upcoming-charges` → *Charges are derived, never queried*), and the row SHALL open as a fixed row from then on (*One sheet for a fixed row*).

**Validity.** While the switch is on and the day is empty or outside 1–31, or the end is a number of times and the count is empty or not a whole number greater than 0, the primary action SHALL be disabled, and a message SHALL appear under the offending field once it loses focus. That message SHALL be exposed to assistive technology.

The switch SHALL be exposed to assistive technology as a switch, with its on or off state and its label, and SHALL be operable with the keyboard.

#### Scenario: The switch is off by default
- **WHEN** the entry sheet is opened in create mode from the "Transporte" card on `/demo` in Spanish
- **THEN** a switch reading "Se repite todos los meses" is shown, off
- **AND** no day field, no end options and no explanation line are visible or reachable by keyboard

#### Scenario: Turning it on reveals the day, preset to today
- **WHEN** the visitor turns the switch on, the sample's today being 10 September 2026
- **THEN** a day-of-the-month field is shown holding 10, and a choice of endings is shown with "no end" selected

#### Scenario: The line names this expense's own numbers
- **WHEN** the visitor types 50 as the amount in the "Transporte" card, turns the switch on and sets the day to 15, in Spanish
- **THEN** exactly one muted line under the fields reads "Cada día 15 anotaremos 50 € en Transporte. Puedes cambiarlo cuando quieras."
- **AND** changing the day to 20 changes that line to read día 20

#### Scenario: Saving creates the definition and the charge
- **WHEN** the visitor saves an expense of 50 € named "Peaje" in "Transporte" with the switch on and day 15
- **THEN** "Peaje" is listed in the "Transporte" card
- **AND** "Próximos cobros" lists "Peaje" with day 15 and 50 €, in its place by day

#### Scenario: An entered expense becomes fixed
- **WHEN** on `/demo` in Spanish the visitor opens "Gasolina" (80 €, 4 September) in the "Transporte" card, turns the switch on, keeps day 4 and saves
- **THEN** "Gasolina" is listed once in "Transporte", with 80 €, and the card total and the free margin are unchanged
- **AND** "Próximos cobros" lists "Gasolina" with day 4 and 80 €, and the October projection lists it in "Transporte"
- **AND** opening "Gasolina" again shows the fixed's section and no recurrence switch

#### Scenario: No switch on a past or projected row
- **WHEN** the visitor opens a one-off expense of the October 2026 projection
- **THEN** no recurrence switch is shown

#### Scenario: Turning it back off discards the recurrence
- **WHEN** the visitor turns the switch on, sets a day of 20, turns the switch off and saves
- **THEN** the expense is created and no definition is created
- **AND** the new row is not listed in "Próximos cobros"

#### Scenario: An incomplete recurrence blocks saving
- **WHEN** the switch is on and the day field is cleared
- **THEN** the primary action is disabled
- **AND** once the day field loses focus, a message under it states that a day from 1 to 31 is expected, and that message is exposed to assistive technology

#### Scenario: The switch reaches assistive technology
- **WHEN** assistive technology reads the sheet in create mode
- **THEN** the control is exposed as a switch, named by its label, with its off state
- **AND** it can be turned on and off with the keyboard alone

### Requirement: A recurrence can end, and ends itself

A definition with a number of repetitions SHALL produce that many charges and no more.

- Each charge inserted for a definition — by the daily generation (`recurring-charge-generation`) or linked when the definition is created — SHALL increase its count of charges produced. A charge that already existed and was left in place SHALL NOT be counted again.
- When the charge that brings the count up to the number of repetitions is inserted, the definition SHALL become inactive in the same operation. No user action SHALL be required to stop it.
- An inactive definition SHALL NOT produce further charges, SHALL NOT be listed in "Próximos cobros" for later cycles, and SHALL NOT appear in any projected cycle. Charges it already produced SHALL stay exactly as they are.
- A projected cycle SHALL list a definition with a number of repetitions only while repetitions remain for it (`cycle-projection` → *A future cycle is computed, not stored*).
- A definition with no number of repetitions SHALL never become inactive on its own.

**Progress.** A definition with a number of repetitions SHALL expose its progress as the count produced out of the total. A definition without one SHALL expose no progress; no placeholder, dash, infinity mark or "sin final" label SHALL be shown in its place (`upcoming-charges` → *Expanded state lists pending charges first*).

**Pending total.** The sheet of a fixed row (*One sheet for a fixed row*) SHALL show, in its muted summary line, how many charges are still to come and what they add up to at the expected amount, or at the amount typed once "Desde este mes en adelante" is chosen. That figure SHALL NOT be shown anywhere else, and SHALL NOT be shown for a definition with no end.

#### Scenario: Progress is visible on the charge
- **WHEN** the "Próximos cobros" card is expanded on `/demo` in Spanish, the "Seguro" definition being 4 of 10
- **THEN** the "Seguro" row shows its day, its amount and "4 de 10"
- **AND** the "Alquiler" row, whose definition has no end, shows no progress and no placeholder in its place

#### Scenario: Pending total in the sheet
- **WHEN** the visitor opens "Seguro" on `/demo` in Spanish, its expected amount being 35 €
- **THEN** the sheet's summary line states "4 de 10" and that 6 charges remain, totalling 210 €
- **AND** typing 40 € and choosing "Desde este mes en adelante" changes that total to 240 € before it is saved

#### Scenario: No pending total without an end
- **WHEN** the visitor opens "Alquiler"
- **THEN** no line states a number of remaining charges or a pending total

#### Scenario: The last charge stops the definition
- **WHEN** a definition of 10 repetitions that has produced 9 charges produces its tenth
- **THEN** the definition is no longer active, without any user action
- **AND** it produces no charge in the following cycle, and the nine earlier charges are unchanged

#### Scenario: An open-ended definition never stops itself
- **WHEN** a definition with no number of repetitions produces its twentieth charge
- **THEN** it is still active

#### Scenario: A plan leaves the projection after its last charge
- **WHEN** a definition of 3 repetitions has produced 1 and the cycle in progress is generated
- **THEN** the next two projected cycles list it and the third does not

### Requirement: Every change to a recurring row asks how far it reaches

Whenever a save or a delete from the entry sheet targets a row that belongs to a recurring definition, expense or income, real or projected, in any cycle, the sheet SHALL ask how far it reaches before it runs. The question SHALL be the same control the category sheet uses for a projected budget (`category-editing` → *A future cycle's budget asks how far it reaches*):

- a single choice with neither option preselected, shown in the sheet itself and not in a separate dialog
- for a save, "Solo este mes" or "Desde este mes en adelante" (in the active language), shown when this month's name, amount, date or category differs from the value it opened with; the save action SHALL be unavailable until one is chosen. A change to the reminder alone SHALL NOT ask: it belongs to the definition.
- for a delete, shown in the delete confirmation step with three options, in this order: "Solo este mes", "Desde este mes en adelante" and "Todos los meses, también los anteriores", each with a muted line saying what it leaves behind; a destructive action that stays unavailable until an option is chosen, and Cancel as the safe default, reachable first by keyboard
- never shown for a row that belongs to no definition

"Todos los meses, también los anteriores" SHALL delete the definition and every charge it produced, in every cycle, as the delete operation does. It SHALL offer no undo.

**Swipe.** Swiping a recurring row, real or projected, SHALL delete that cycle's slot only ("Solo este mes"), without asking, and SHALL offer "Deshacer" as any swipe does. The toast SHALL state that only this month's row was deleted.

#### Scenario: The question appears on save
- **WHEN** the visitor opens the "Gimnasio" charge in the "Salud" card and changes its amount
- **THEN** the sheet shows "Solo este mes" and "Desde este mes en adelante", neither selected, and the save action is unavailable
- **AND** after choosing one, the save action becomes available

#### Scenario: No question for the reminder alone
- **WHEN** the visitor opens "Parking" and only turns its reminder on
- **THEN** no scope choice is shown and the save action is available

#### Scenario: No question for a plain expense
- **WHEN** the visitor opens the "Cine" expense and changes its amount
- **THEN** no scope choice is shown and the save action is available

#### Scenario: Delete asks in the confirmation step
- **WHEN** the visitor activates the delete action on the "Gimnasio" charge
- **THEN** the confirmation step offers "Solo este mes", "Desde este mes en adelante", "Todos los meses, también los anteriores", a delete action that is unavailable until one is chosen, and Cancel, which receives keyboard focus first
- **AND** cancelling returns to the fields with nothing deleted

#### Scenario: Deleting every month
- **WHEN** the visitor deletes "Parking" choosing "Todos los meses, también los anteriores"
- **THEN** no "Parking" row is listed in September or in any projection, "Próximos cobros" no longer lists it, and no toast offers "Deshacer"

#### Scenario: Swipe deletes this month only
- **WHEN** the visitor long-swipes the "Gimnasio" charge in September
- **THEN** it is no longer listed in September, the toast states that only this month's row was deleted and offers "Deshacer"
- **AND** the October projection still lists "Gimnasio" at 40 €

## REMOVED Requirements

### Requirement: The definition sheet
**Reason**: A fixed charge opened two different sheets depending on where it was touched, and users read the difference as missing features (Brian, 2026-10-14).
**Migration**: Every option moves to the sheet of the fixed row (*One sheet for a fixed row*): name, amount, day and category change "Desde este mes en adelante" through the scope question; the expected amount and the pending total are on its summary line; the reminder, "Dejar de repetir" and the delete of the whole history are in its fixed's section.

### Requirement: Where you touch decides what you change
**Reason**: "Próximos cobros" no longer edits the definition directly; every surface opens the same sheet and asks the same question.
**Migration**: *Every surface changes a fixed row the same way* keeps the rules that still hold ("Solo este mes" and "Desde este mes en adelante", nothing earlier changes, the confirmation copy).

## ADDED Requirements

### Requirement: One sheet for a fixed row

A fixed row — a recurring charge in its category card, the same charge in "Próximos cobros", or a fixed income entry in the income panel, real or projected — SHALL open the same sheet, with the same content, wherever it is activated: the entry sheet in edit mode (`expense-editing` → *Entry points*, `income-editing` → *Entry points*), with this month's name, amount and date, the category control for an expense, and below them the fixed's section.

**The fixed's section**, separated from the fields by a divider, in this order:
- **Summary**: one muted line stating the definition's expected amount and its day ("820 € cada mes, el día 1"), and for a definition with a number of repetitions its progress and pending total ("4 de 10 · quedan 6 pagos · 210 €", *A recurrence can end, and ends itself*). When this month's amount differs from the expected amount, the line SHALL still state the expected one, so both figures are on screen at once.
- **"Marcar como cobrado"**, for an expense whose charge in the cycle in progress is pending (*Marking a charge as charged*). It SHALL NOT be shown for a charge already charged, for a projected cycle or a past one, or for an income entry.
- **Recordatorio**, for an expense: a switch with the definition's reminder setting that, when on, reveals a days-before field in place. Saving the sheet with a changed reminder SHALL set it through the set reminder operation, after any change to this month's values, and SHALL NOT ask how far it reaches.
- **"Dejar de repetir"**, below a divider, in the ordinary text colour, while the definition is active: it SHALL make the definition inactive without confirmation and change no charge of this or an earlier cycle.
- **Delete**, below a divider, in the destructive colour on a faint destructive tint, with the three reaches of *Every change to a recurring row asks how far it reaches*.

The header caption SHALL keep naming the category for an expense and stating that it repeats every month. Saving SHALL follow `expense-editing` → *Saving, dismissal and errors*. A save that changes nothing of this month's values SHALL write no slot, and so SHALL NOT turn a pending charge into a charged one.

When the mounting page supplies no recurring operations, the sheet SHALL show no fixed's section.

#### Scenario: Same sheet from both places
- **WHEN** on `/demo` in Spanish the visitor activates "Parking" in "Próximos cobros", closes the sheet, and activates "Parking" in the "Transporte" card
- **THEN** both times the same sheet opens, titled "Editar gasto", captioned "Transporte · Se repite cada mes", holding 50 € and 15 September 2026
- **AND** both times it shows "50 € cada mes, el día 15", "Marcar como cobrado", a reminder switch, "Dejar de repetir" and the delete action

#### Scenario: Both numbers at once
- **WHEN** the visitor changes this cycle's "Alquiler" to 880 € with "Solo este mes" and opens "Alquiler" again from "Próximos cobros"
- **THEN** the amount field holds 880 and the summary line states "820 € cada mes, el día 1"

#### Scenario: A charged row offers no mark
- **WHEN** the visitor opens "Alquiler", already charged
- **THEN** "Marcar como cobrado" is not shown, and the reminder, "Dejar de repetir" and delete are

#### Scenario: A fixed income entry
- **WHEN** the visitor opens "Salario" in the income panel
- **THEN** the sheet shows the summary line, "Dejar de repetir" and the delete action, and neither "Marcar como cobrado" nor a reminder switch

#### Scenario: Stop repeating cuts forward only
- **WHEN** the visitor opens "Gimnasio" and activates "Dejar de repetir"
- **THEN** no confirmation is requested and the definition becomes inactive
- **AND** the "Gimnasio" charge of this cycle is still listed in the "Salud" card with 40 €, and the October projection no longer lists it

#### Scenario: The reminder saves on its own
- **WHEN** the visitor opens "Parking", turns the reminder on, sets 2 days before and saves
- **THEN** opening "Parking" again shows the reminder on with 2 days, and this month's "Parking" is still pending at 50 €

#### Scenario: Saving nothing confirms nothing
- **WHEN** the visitor opens the pending "Gimnasio" and saves without changing anything
- **THEN** "Gimnasio" is still listed as pending in "Próximos cobros"

### Requirement: Every surface changes a fixed row the same way

A change to a fixed row SHALL reach as far as the scope chosen in its sheet, from whichever surface the sheet was opened, and no change from any surface SHALL alter any charge of an earlier cycle than the one it was made from:

- **"Solo este mes"** SHALL change or delete that cycle's slot only. It SHALL NOT change the definition's expected amount, day, name, category, active state or number of repetitions, nor any other cycle.
- **"Desde este mes en adelante"** SHALL change that cycle's slot and the definition, so that every later cycle follows. Cycles between the one in progress and the one the change was made from SHALL keep what they showed before the change. A later cycle's pending slot that differed from the definition ("solo este mes" edits) SHALL take the new values; a confirmed row SHALL keep what was paid.

**Confirmation copy.** After a row is saved with "Desde este mes en adelante", the message announced SHALL state that the change applies from that month on. After a row is saved with "Solo este mes", or a row not linked to a definition is saved, the message SHALL be "Cambios guardados".

#### Scenario: From "Próximos cobros", the question too
- **WHEN** on `/demo` in Spanish the visitor opens "Gimnasio" from "Próximos cobros" and changes its amount to 45
- **THEN** the sheet asks "Solo este mes" or "Desde este mes en adelante" before saving

#### Scenario: Editing the charge leaves the definition alone
- **WHEN** the visitor changes this cycle's "Alquiler" charge to 880 € from the "Vivienda" card, chooses "Solo este mes" and saves
- **THEN** the "Alquiler" definition still expects 820 €, its active state and its day are unchanged
- **AND** the October projection lists "Alquiler" at 820 €

#### Scenario: From this month on, from the cycle in progress
- **WHEN** the visitor changes this cycle's pending "Gimnasio" charge to 45 € from "Próximos cobros", chooses "Desde este mes en adelante" and saves
- **THEN** the "Salud" card shows 45 €, the summary line of "Gimnasio" states 45 € each month, and every projection lists "Gimnasio" at 45 €
- **AND** the message announced states that the change applies from September on

#### Scenario: From this month on, from a projection
- **WHEN** September is in progress and the visitor opens the December projection, changes "Gimnasio" to 50 €, chooses "Desde este mes en adelante" and saves
- **THEN** December and every later projection list "Gimnasio" at 50 €
- **AND** September still shows 40 €, and the October and November projections still list it at 40 €

#### Scenario: Onward overrides a later exception
- **WHEN** the November "Gimnasio" slot was set to 60 € with "Solo este mes", and the visitor then sets October's to 50 € with "Desde este mes en adelante"
- **THEN** October and November both list "Gimnasio" at 50 €

### Requirement: Marking a charge as charged

"Marcar como cobrado" in the sheet of a pending charge of the cycle in progress SHALL turn that charge into a charged one through the set charged operation, at its current amount, name and date, without creating, editing or deleting any row and without changing the definition. The sheet SHALL close; the charge SHALL be shown as charged in "Próximos cobros" and wherever else a charged charge differs from a pending one, and no total, budget or free margin SHALL change.

A toast SHALL state that the charge is charged this month and offer "Deshacer", which SHALL turn it back to pending through the same operation. A failed mark SHALL keep the sheet open with an alert and the charge pending.

A charge marked this way SHALL be what the chat finds when the user later sends its expense (`bot-transaction-logging`): an already charged charge, which is not loaded again.

#### Scenario: Marking Parking
- **WHEN** on `/demo` in Spanish, with "Parking" pending at 50 € on day 15, the visitor opens it from "Próximos cobros" and activates "Marcar como cobrado"
- **THEN** the sheet closes, "Parking" is listed among the charged ones of "Próximos cobros", and the "Transporte" card total, the footer total and the free margin are unchanged
- **AND** a toast offers "Deshacer", and activating it lists "Parking" among the pending ones again

#### Scenario: A failed mark
- **WHEN** the set charged operation rejects
- **THEN** the sheet stays open with an alert, and "Parking" is still pending
