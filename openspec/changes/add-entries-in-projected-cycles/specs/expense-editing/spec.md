## MODIFIED Requirements

### Requirement: Expense changes go through injected operations
The page that mounts the dashboard SHALL supply expense changes as four operations. Every data source SHALL provide them with the same inputs and outcomes:
- **create:** adds an expense to a category from an amount, a description and a calendar date in the user's time zone
- **update:** replaces an existing expense's amount, description and calendar date
- **soft delete:** marks an expense as deleted without removing it
- **restore:** clears that mark

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged.

Dashboard components SHALL change expenses only through these operations. Every delete path (swipe button, long swipe, the sheet's delete action) SHALL use soft delete, and no data source SHALL permanently remove an expense in response to them.

Update SHALL NOT change an expense's category, its type, its fixed flag, the recurring fixed-expense definition it came from, or any other expense.

A soft-deleted expense SHALL NOT count anywhere: not in expense lists, card totals, budget progress, the expenses total, the charts or the free margin. Once restored, it SHALL count in all of them again.

How an expense moves the free margin SHALL follow `category-editing` → *A budget reserves its amount in the free margin*: an expense in a category with a budget, recurring charges included, moves the free margin only by the part of the category's spending beyond its budget, and an expense in a category without a budget moves it by its whole amount.

The four operations SHALL be offered in a projected cycle (`cycle-projection` → *What a projected cycle shows and allows*) for the cycle's real rows, with the same inputs and outcomes; the calendar date SHALL then fall inside that cycle. A projected recurring charge SHALL NOT be passed to any of them.

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
- **THEN** the recorder receives create (the "ocio" category, amount, description, date), update ("Cine", amount, description, date), soft delete ("Conciertos") and restore ("Conciertos"), in that order
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
- The header SHALL name what is being edited (see *Entry points*).
- The sheet SHALL add a delete action below the fields.
- The sheet SHALL NOT show the recurrence switch, in any state, whether the expense is recurring or not. Recurrence is changed only from the definition (`recurring-expenses` → *Where you touch decides what you change*).

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
- **AND** nothing in the sheet changes the definition's expected amount, day or active state

#### Scenario: Same layout in both modes
- **WHEN** the sheet is opened from the "comida" card at a 390px-wide viewport, first in create mode and then in edit mode
- **THEN** the header and the amount, description and date rows have the same positions and sizes in both modes
- **AND** only create mode shows the recurrence switch, and only edit mode shows a divider and the delete action below the fields
