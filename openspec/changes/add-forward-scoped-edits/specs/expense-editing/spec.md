> Written over the `expense-editing` delta of the open change `add-entries-in-projected-cycles`. The requirements below replace those of the same name there.

## MODIFIED Requirements

### Requirement: Expense changes go through injected operations
The page that mounts the dashboard SHALL supply expense changes as four operations. Every data source SHALL provide them with the same inputs and outcomes:
- **create:** adds an expense to a category from an amount, a description and a calendar date in the user's time zone
- **update:** replaces an existing expense's amount, description, calendar date and category
- **soft delete:** marks an expense as deleted without removing it
- **restore:** clears that mark

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change expenses only through these operations, and rows that belong to a recurring definition through the slot operations (`recurring-expenses` → *A definition's slot in a cycle can be changed on its own*). Every delete path (swipe button, long swipe, the sheet's delete action) SHALL use soft delete, and no data source SHALL permanently remove an expense in response to them.

Update SHALL NOT change an expense's type, its fixed flag, the recurring fixed-expense definition it came from, or any other expense. The category it receives SHALL be one of the user's categories alive in the expense's cycle (`category-editing` → *A category lives from its first cycle to its last*); any other SHALL be rejected with nothing changed.

A soft-deleted expense SHALL NOT count anywhere: not in expense lists, card totals, budget progress, the expenses total, the charts or the free margin. Once restored, it SHALL count in all of them again.

How an expense moves the free margin SHALL follow `category-editing` → *A budget reserves its amount in the free margin*: an expense in a category with a budget, recurring charges included, moves the free margin only by the part of the category's spending beyond its budget, and an expense in a category without a budget moves it by its whole amount.

The four operations SHALL be offered in a projected cycle (`cycle-projection` → *What a projected cycle shows and allows*) for the cycle's real rows that belong to no definition, with the same inputs and outcomes; the calendar date SHALL then fall inside that cycle.

#### Scenario: Deleted expense leaves every figure
- **WHEN** the "Café" expense (62,40 €) in "comida" is soft-deleted on `/demo`, in Spanish
- **THEN** it is no longer listed
- **AND** the "comida" card shows 247,60 € of 400 €, the expenses total shows 1.637,60 € and the free margin still shows 864 €, because "comida" is still within its budget

#### Scenario: Restore brings the expense back
- **WHEN** the same expense is restored
- **THEN** "Café" is listed in "comida" with 62,40 € and its date, the card shows 310 € of 400 €, and the free margin shows 864 €

#### Scenario: Same operations on another data source
- **WHEN** the dashboard is mounted with an implementation of the four operations that records its calls instead of the demo's
- **AND** the user creates an expense in "ocio", edits "Cine", deletes "Conciertos" and undoes that deletion
- **THEN** the recorder receives create (the "ocio" category, amount, description, date), update ("Cine", amount, description, date, the "ocio" category), soft delete ("Conciertos") and restore ("Conciertos"), in that order
- **AND** no dashboard component needed a change for that data source

#### Scenario: An expense in a projected cycle moves the projected margin
- **WHEN** on `/demo` in Spanish the visitor opens the October 2026 projection, whose free margin is 475 €, and adds 20 € described as "Ferretería" to "hogar", which has no budget
- **THEN** "Ferretería" is listed in "hogar" with 20 €, the card shows 55 € and the free margin shows 455 €
- **AND** the "Próximos cobros" footer still reads 1.025 €

#### Scenario: Edit and delete in a projected cycle
- **WHEN** the visitor then changes "Ferretería" to 50 € and saves, and afterwards long-swipes it
- **THEN** after the save the "hogar" card shows 85 € and the free margin 425 €
- **AND** after the swipe "Ferretería" is no longer listed, the card shows 35 €, the free margin shows 475 € and a toast offers "Deshacer"
- **AND** activating "Deshacer" lists "Ferretería" again with 50 € and the free margin shows 425 €

### Requirement: One entry sheet for creating and editing
Creating and editing SHALL use one sheet with the same layout in both modes. The sheet SHALL show the fields of the field configuration it is opened with, in that configuration's order. Another kind of entry SHALL be able to use the same sheet by supplying a different configuration. The expense configuration SHALL list amount, description and date, in that order.

**Create mode:**
- The amount and description SHALL start empty.
- The date SHALL start at today in the user's time zone when the displayed cycle contains today, at the cycle's first day when the cycle is a projection, and otherwise at the cycle's last day.
- The header SHALL name the category the expense will be created in, with its colour dot.
- Below the last field, the sheet SHALL offer the recurrence switch and, while it is on, the fields it reveals (`recurring-expenses` → *The recurrence switch creates the definition*) — except in a projected cycle, where the sheet SHALL NOT show the recurrence switch or any field it reveals.

**Edit mode:**
- The fields SHALL start with the expense's amount, description and date.
- The header SHALL name what is being edited (see *Entry points*), and its category SHALL be a control that moves the expense (*Moving an expense to another category*).
- The sheet SHALL add a delete action below the fields.
- The sheet SHALL NOT show the recurrence switch, in any state, whether the expense is recurring or not. On a row that belongs to a definition, the sheet SHALL instead ask how far the change reaches (`recurring-expenses` → *Every change to a recurring row asks how far it reaches*).

#### Scenario: Create from a category card
- **WHEN** the "comida" card is open on `/demo` in Spanish and the visitor activates "Añadir gasto"
- **THEN** the sheet opens titled "Nuevo gasto", with "Comida" and its colour dot in the header
- **AND** the amount and description are empty, the date is 10 September 2026, and there is no delete action
- **AND** the recurrence switch is shown below the date, off

#### Scenario: Create in a projected cycle
- **WHEN** on `/demo` in Spanish the visitor opens the October 2026 projection, opens the "comida" card and activates "Añadir gasto"
- **THEN** the sheet opens titled "Nuevo gasto" with the date 1 October 2026, 30 September and 1 November cannot be selected, and no recurrence switch is shown

#### Scenario: Edit preloads the expense
- **WHEN** the visitor taps the "Restaurante" row (67,60 €, 7 September) in the "comida" card
- **THEN** the sheet opens titled "Editar gasto" with the amount 67,60, the description "Restaurante" and the date 7 September 2026
- **AND** a delete action is shown below the fields, and no recurrence switch is shown

#### Scenario: No switch on a recurring charge
- **WHEN** the visitor taps the "Alquiler" row in the "Vivienda" card, that charge coming from a definition
- **THEN** no recurrence switch is shown in the sheet, in any state
- **AND** changing the amount shows the "Solo este mes" / "Desde este mes en adelante" choice

#### Scenario: Same layout in both modes
- **WHEN** the sheet is opened from the "comida" card at a 390px-wide viewport, first in create mode and then in edit mode
- **THEN** the header and the amount, description and date rows have the same positions and sizes in both modes
- **AND** only create mode shows the recurrence switch, and only edit mode shows a divider and the delete action below the fields

### Requirement: Entry points
The sheet SHALL open from exactly these triggers:
- **The "add expense" row** at the end of an open category card: opens create mode for that card's category.
- **An expense row in any open card**, real or projected: activating it by tap, click, Enter or Space opens edit mode for that expense.

**Recurring charges.** A recurring charge is the slot a definition (`recurring-expenses`) holds in one cycle, shown in its category's card: a real row in the cycle in progress or a past one, and a real or projected row in a projection.
- Its category's card SHALL be the only place the **charge** is opened from. The `upcoming-charges` card SHALL NOT open this sheet for any charge it lists; activating one of its rows opens the **definition** instead (`upcoming-charges` → *A row opens its definition, and nothing else does*).
- Activating a recurring charge's row SHALL open edit mode for that charge. The header caption SHALL name its category and SHALL state that it repeats every month.
- Saving or deleting it SHALL reach as far as the scope chosen in the sheet, and no further (`recurring-expenses` → *Where you touch decides what you change*).

**Two ways in, one rule.** The category card changes a charge with the scope the visitor chooses; the `upcoming-charges` card edits the definition from the cycle in progress on. Neither SHALL change an earlier cycle.

#### Scenario: Recurring charge edits this month only
- **WHEN** the visitor opens the "Vivienda" card on `/demo` in Spanish and taps "Alquiler" (820 €)
- **THEN** the sheet opens in edit mode with a header caption naming "Vivienda" and stating that it repeats every month
- **AND** after changing the amount to 880, choosing "Solo este mes" and saving, the "Vivienda" card total is 960 € and the free margin is 804 €
- **AND** the "Alquiler" definition still holds an expected amount of 820 €

#### Scenario: Recurring charge update carries only the charge
- **WHEN** a recording implementation of the expense operations and another of the recurring operations are mounted and the user saves an edit to a recurring charge's row with "Solo este mes"
- **THEN** the only call is one edit in cycle, with the definition, the cycle, the amount, description, date, category and "only"
- **AND** the expense recorder receives nothing

#### Scenario: A projected charge opens the sheet
- **WHEN** the visitor opens the October 2026 projection on `/demo` and taps the projected "Alquiler" row in "Vivienda"
- **THEN** the entry sheet opens in edit mode holding 820 € and the date "Alquiler" falls on in October

#### Scenario: One way in
- **WHEN** the "Próximos cobros" card is expanded and its "Alquiler" row is tapped, clicked and activated with Enter
- **THEN** the entry sheet does not open, and the definition sheet opens each time
- **AND** tapping the "Alquiler" row in the "Vivienda" card opens the entry sheet in edit mode, and no definition sheet opens

#### Scenario: Every card has an add row
- **WHEN** the "Vivienda" card is open on `/demo`
- **THEN** its last row is the "Añadir gasto" row
- **AND** the "Próximos cobros" card has no add row

#### Scenario: Keyboard opens edit mode
- **WHEN** keyboard focus is on the "Cine" row and the user presses Enter
- **THEN** the sheet opens in edit mode for "Cine"

## ADDED Requirements

### Requirement: Moving an expense to another category

In edit mode, the category named in the sheet's header, with its colour dot, SHALL be a control. Activating it SHALL open a picker anchored to it, on the same glass surface as the month picker, listing every category alive in the expense's cycle with its colour dot and name, the current one marked. Choosing one SHALL change the header to that category, with its dot, and SHALL count as a change of the form; nothing SHALL be written until the sheet is saved.

- The control SHALL have a hit area of at least 44 × 44px, SHALL expose an accessible name that states the current category and that it can be changed, and SHALL be reachable by keyboard. The picker SHALL close on Escape, on a choice and on a pointer down outside it, returning focus to the control.
- The picker SHALL open and close with the month picker's motion, and without movement under reduced motion.
- On a row that belongs to a definition, a new category SHALL be saved with the chosen scope: "Solo este mes" moves that cycle's charge only, "Desde este mes en adelante" also moves the definition.
- Create mode SHALL keep naming the card's category without a control.

Saving SHALL move the row to the chosen card: both cards' totals, budget progress and the free margin SHALL follow, and the expenses total SHALL stay the same.

#### Scenario: Moving an expense
- **WHEN** on `/demo` in Spanish the visitor opens "Cine" in "ocio", activates the header's "Ocio", chooses "Compras" and saves
- **THEN** "Cine" is listed in the "compras" card and not in "ocio", both card totals changed by its amount, and the expenses total still shows 1.700 €

#### Scenario: The choice is not written before saving
- **WHEN** the visitor chooses "Compras" in the picker and then cancels the sheet
- **THEN** "Cine" is still listed in "ocio"

#### Scenario: Moving a fixed charge from this month on
- **WHEN** the visitor opens the "Gimnasio" charge in "Salud", moves it to "Ocio", chooses "Desde este mes en adelante" and saves
- **THEN** the September "Gimnasio" charge and the "Gimnasio" definition are in "Ocio", and every projection lists it in the "ocio" card

#### Scenario: The picker by keyboard
- **WHEN** keyboard focus is on the header's category control and the user presses Enter, moves to "Compras" and presses Enter
- **THEN** the picker closes, the header names "Compras", and focus is back on the control
