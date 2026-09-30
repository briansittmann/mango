# recurring-expenses Specification

## Purpose

The definition behind a recurring charge: what it is expected to cost every cycle, which day it falls on, whether it ever ends, and whether it is still running. It is created from the expense you are already adding and edited from "Próximos cobros", so that "this cycle" and "every cycle" are never the same control.

## Requirements

### Requirement: Recurring definitions go through injected operations

The page that mounts the dashboard SHALL supply changes to recurring definitions as four operations. Every data source SHALL provide them with the same inputs and outcomes:

- **create:** adds a definition from a name, an expected amount, a category, a day of the month, and an optional number of repetitions
- **update:** replaces an existing definition's name, expected amount, category, day of the month, and reminder settings
- **stop:** marks a definition as no longer active without removing it or any charge it produced
- **delete:** removes the definition and the charges it produced

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change definitions only through these operations. No component SHALL change a definition through the expense operations, and no expense operation SHALL change a definition (`expense-editing` → *Expense changes go through injected operations*).

A definition SHALL carry: a name, an expected amount greater than 0, a category, a day of the month from 1 to 31, an active state, a reminder setting (on or off, with a number of days before), a number of repetitions that is either absent — meaning it never ends — or a whole number greater than 0, and a count of how many charges it has produced.

#### Scenario: Creating a definition reaches the data source
- **WHEN** a recording implementation of the operations is mounted and the visitor adds an expense with the recurrence switch on, a day of 15 and no end
- **THEN** the recorder receives one create call carrying the name, the amount, the category, day 15, and no number of repetitions

#### Scenario: Definition operations never run expense operations
- **WHEN** recording implementations of both the expense and the definition operations are mounted, and the visitor saves a change to a definition from "Próximos cobros"
- **THEN** the definition recorder receives one update and the expense recorder receives no create, update, soft delete or restore

#### Scenario: A failed operation changes nothing
- **WHEN** the injected update fails while saving a new expected amount
- **THEN** every figure on the page is as it was before, and the definition still holds its previous expected amount

### Requirement: The recurrence switch creates the definition

The entry sheet in create mode SHALL offer a switch, labelled in the active language as repeating every month, below the last field. It SHALL start off. Edit mode SHALL NOT show the switch at all, in any state (`expense-editing` → *Entry points*).

**When the switch is on**, the sheet SHALL reveal, in place and without opening another sheet, step or screen:

- a **day of the month** field, from 1 to 31, starting at today's day in the user's time zone
- a **how it ends** choice, with two options: no end, and a number of times. It SHALL start at no end. Choosing a number of times SHALL reveal a count field, a whole number greater than 0.
- below them, exactly **one muted line** describing what will happen, built from the values currently in the sheet: the chosen day, the amount typed, and the name of the category the expense is being created in. It SHALL be one sentence. No tutorial, caption stack, tooltip or help link SHALL be shown.

**When the switch is off**, none of those fields SHALL be visible, focusable or exposed to assistive technology, and the sheet SHALL create an ordinary one-off expense.

**Saving with the switch on** SHALL create both the expense and the definition. The new charge SHALL appear in the "Próximos cobros" card in the same render (`upcoming-charges` → *Charges are derived, never queried*).

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

**Progress.** A definition with a number of repetitions SHALL expose its progress as the count produced out of the total. A definition without one SHALL expose no progress; no placeholder, dash, infinity mark or "sin final" label SHALL be shown in its place (`upcoming-charges` → *Expanded state lists the cycle's charges*).

**Pending total.** The definition sheet SHALL show, in muted text under the expected amount, how many charges are still to come and what they add up to at the current expected amount. That figure SHALL NOT be shown anywhere else, and SHALL NOT be shown for a definition with no end.

#### Scenario: Progress is visible on the charge
- **WHEN** the "Próximos cobros" card is expanded on `/demo` in Spanish, the "Seguro" definition being 4 of 10
- **THEN** the "Seguro" row shows its day, its amount and "4 de 10"
- **AND** the "Alquiler" row, whose definition has no end, shows no progress and no placeholder in its place

#### Scenario: Pending total in the sheet
- **WHEN** the visitor opens the "Seguro" row's definition sheet on `/demo` in Spanish, its expected amount being 35 €
- **THEN** a muted line under the expected amount states that 6 charges remain, totalling 210 €
- **AND** raising the expected amount to 40 € changes that line to 240 € before it is saved

#### Scenario: No pending total without an end
- **WHEN** the visitor opens the "Alquiler" definition sheet
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

### Requirement: The definition sheet

Activating a row in the "Próximos cobros" card SHALL open a sheet holding that charge's definition. It SHALL follow the same panel, material, header, row and size rules as the other sheets (`expense-editing` → *Entry sheet appearance*): a panel floating above the page at most 440px wide, 12–16px from the left, right and bottom edges plus the bottom safe area, all four corners rounded, a drag handle centred at the top, a dimmed scrim behind it, and rows at least 48px tall with hit areas of at least 44 × 44px.

**Header:** a cancel action on the leading side, the definition's name as the title, a save action on the trailing side, and a caption under the title stating that this repeats and naming its day.

**Fields**, in this order:
- **Name** — free text, required.
- **Expected amount** — greater than 0 and at most two decimals, shown with the user's currency symbol. Its label SHALL name it as the expected amount, never as the amount. Directly under it, a muted support line SHALL state that this is the value of every month. When this cycle's charge differs from the expected amount, that line SHALL also state this cycle's actual figure.
- **Day of the month** — 1 to 31.
- **Category** — one of the user's categories.
- **Reminder** — a switch that, when on, reveals a number-of-days-before field, with the same in-place disclosure as the recurrence switch.

**Stopping and deleting**, after the last field and separated from it:
- **Stop repeating** SHALL be offered first, below a divider, in the ordinary text colour. Activating it SHALL make the definition inactive, SHALL NOT ask for confirmation, and SHALL change no charge of this or any earlier cycle.
- **Delete** SHALL be offered below it, visibly distinct: the destructive colour on a faint destructive tint. Activating it SHALL open a confirmation step inside the same sheet, stating that the charges it produced will go with it. Only confirming SHALL delete.
- The two SHALL NOT be presented as equals: they SHALL differ in colour and be separated by a divider, so that the reversible one is not mistaken for the destructive one.

**Saving, dismissal and errors** SHALL behave as the entry sheet does (`expense-editing` → *Saving, dismissal and errors*): the sheet loads nothing when it opens, the activated action shows a progress indicator while the operation runs, the form is exposed as busy and cannot be dismissed, a failure keeps every typed value and shows an alert at the top of the form, and closing returns focus to the row that opened it.

#### Scenario: Opening a definition
- **WHEN** the visitor expands "Próximos cobros" on `/demo` in Spanish and activates the "Alquiler" row
- **THEN** a sheet opens titled "Alquiler", with a caption naming its day, holding the name "Alquiler", the expected amount 820, day 1, the category "Vivienda" and a reminder switch
- **AND** the amount's label names it as the expected amount, with a muted line under it stating it is the value of every month

#### Scenario: Both numbers are on screen at once
- **WHEN** the visitor has changed this cycle's "Alquiler" charge to 880 € from the "Vivienda" card, and then opens the "Alquiler" definition from "Próximos cobros"
- **THEN** the expected amount field holds 820
- **AND** the muted line under it also states that 880 € was recorded this month

#### Scenario: Stop repeating cuts forward only
- **WHEN** the visitor opens the "Gimnasio" definition and activates "Dejar de repetir"
- **THEN** no confirmation is requested, and the definition becomes inactive
- **AND** the "Gimnasio" charge of this cycle is still listed in the "Salud" card with 40 €, the "Salud" card total is unchanged, and the free margin is unchanged

#### Scenario: Deleting confirms first
- **WHEN** the visitor activates the delete action in a definition sheet
- **THEN** a confirmation step is shown inside the same sheet, stating that the charges it produced go with it
- **AND** cancelling returns to the fields with nothing deleted

#### Scenario: The two destructive paths do not look alike
- **WHEN** the definition sheet is open in both themes
- **THEN** "Dejar de repetir" computes to the ordinary text colour and the delete row to the destructive colour, and a divider separates them
- **AND** only the delete row sits on a destructive tint

#### Scenario: Reminder reveals its field
- **WHEN** the visitor turns the reminder switch on
- **THEN** a days-before field is revealed in the same sheet, and is reachable by keyboard
- **AND** with the switch off it is not visible, focusable or exposed to assistive technology

#### Scenario: Sheet geometry
- **WHEN** the definition sheet is open at a 390 × 844 viewport
- **THEN** the panel's left and right edges are 12–16px from the viewport edges and its bottom edge 12–16px above the bottom edge
- **AND** all four corner radii are non-zero, a handle is centred at the top, and every field row is at least 48px tall

#### Scenario: A failed save keeps the sheet
- **WHEN** the injected update fails after the visitor changes the expected amount to 900
- **THEN** the sheet stays open holding 900, an alert is shown at the top of the form, and the save action can be activated again

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

### Requirement: A charge that differs from its expectation says so, quietly

When a charge's amount differs from its definition's expected amount, the "Próximos cobros" row SHALL keep showing the charge's real amount and SHALL add, in muted text under the name, the expected amount.

- That caption SHALL appear only while the two differ.
- It SHALL take no colour: not the brand colour, not the warning colour, not the danger colour (`upcoming-charges` → *The card takes no accent colour*). A difference is information, not a warning.
- It SHALL reach at least 4.5:1 contrast against the card in both themes, and SHALL be available to assistive technology as part of the row.
- It SHALL NOT be shown anywhere else: no badge, no total of differences, no summary line in the footer.

#### Scenario: A difference appears where it happened
- **WHEN** on `/demo` in Spanish the visitor changes "Alquiler" from 820 € to 880 € in the "Vivienda" card and expands "Próximos cobros"
- **THEN** the "Alquiler" row shows 880 € and a muted caption reading "esperado 820 €"
- **AND** no other row shows such a caption

#### Scenario: Matching again removes it
- **WHEN** the visitor changes that charge back to 820 €
- **THEN** the caption is no longer shown on the "Alquiler" row

#### Scenario: A difference is not a warning
- **WHEN** a row is showing the caption, in both themes
- **THEN** no element of that row computes to the brand, warning or danger colour
- **AND** the caption reaches at least 4.5:1 against the card

#### Scenario: Nowhere else
- **WHEN** a row is showing the caption
- **THEN** the footer total is unchanged in form and still states only the committed total, and no badge or count of differences is rendered anywhere on the page

### Requirement: The bot asks whether a change is permanent, and the adapter owns the answer

When a message loads an amount for a recurring expense that differs from its definition's expected amount, the conversation SHALL offer to make the change permanent, and the decision to ask SHALL live outside the bot's message logic.

- **The message logic** SHALL complete and confirm this cycle's pending charge with the loaded amount, and SHALL report the discrepancy — which definition, its expected amount, the loaded amount — without asking anything and without changing the definition.
- **The adapter** SHALL turn that report into the follow-up question, hold the pending decision across turns, and on an affirmative answer SHALL update the definition's expected amount.
- **No answer SHALL be a stored state.** If the user does not answer, this cycle's charge keeps the loaded amount and the definition keeps its expected amount — the exception of that cycle, reached by doing nothing.
- A negative answer SHALL have the same effect as no answer, and SHALL clear the pending decision.
- The message logic SHALL remain free of anything specific to WhatsApp, so a second messaging platform SHALL require no change to it.

#### Scenario: Loading an amount that differs
- **WHEN** a user whose "Alquiler" definition expects 600 sends "alquiler 630"
- **THEN** this cycle's pending "Alquiler" charge is completed at 630 and marked confirmed
- **AND** the reply asks whether 630 is the amount from now on

#### Scenario: Yes makes it permanent
- **WHEN** the user answers affirmatively
- **THEN** the definition's expected amount becomes 630
- **AND** this cycle's charge stays at 630

#### Scenario: Silence leaves an exception
- **WHEN** the user does not answer and sends an unrelated expense instead
- **THEN** the definition's expected amount is still 600, this cycle's charge is still 630, and nothing further is asked about it

#### Scenario: The decision is not in the message logic
- **WHEN** the message logic processes "alquiler 630"
- **THEN** it returns a reply reporting the discrepancy and the definition it belongs to
- **AND** it performs no definition update and holds no state about the pending question

### Requirement: Every change to a recurring row asks how far it reaches

Whenever a save or a delete from the entry sheet targets a row that belongs to a recurring definition, expense or income, real or projected, in any cycle, the sheet SHALL ask "Solo este mes" or "Desde este mes en adelante" (in the active language) before it runs. The question SHALL be the same control, with the same two labels in the same order, that the category sheet uses for a projected budget (`category-editing` → *A future cycle's budget asks how far it reaches*):

- a single choice with neither option preselected, shown in the sheet itself and not in a separate dialog
- for a save, shown when any field differs from the value it opened with; the save action SHALL be unavailable until one is chosen
- for a delete, shown in the delete confirmation step, with a destructive action that stays unavailable until an option is chosen, and Cancel as the safe default, reachable first by keyboard
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
- **THEN** the confirmation step offers "Solo este mes", "Desde este mes en adelante", a delete action that is unavailable until one is chosen, and Cancel, which receives keyboard focus first
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
