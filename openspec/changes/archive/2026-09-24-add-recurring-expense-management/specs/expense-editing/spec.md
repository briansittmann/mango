## MODIFIED Requirements

### Requirement: One entry sheet for creating and editing
Creating and editing SHALL use one sheet with the same layout in both modes. The sheet SHALL show the fields of the field configuration it is opened with, in that configuration's order. Another kind of entry SHALL be able to use the same sheet by supplying a different configuration. The expense configuration SHALL list amount, description and date, in that order.

**Create mode:**
- The amount and description SHALL start empty.
- The date SHALL start at today in the user's time zone when the displayed cycle contains today, and otherwise at the cycle's last day.
- The header SHALL name the category the expense will be created in, with its colour dot.
- Below the last field, the sheet SHALL offer the recurrence switch and, while it is on, the fields it reveals (`recurring-expenses` → *The recurrence switch creates the definition*).

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

### Requirement: Entry points
The sheet SHALL open from exactly these triggers:
- **The "add expense" row** at the end of an open category card: opens create mode for that card's category.
- **An expense row in any open card:** activating it by tap, click, Enter or Space opens edit mode for that expense.

**Recurring charges.** A recurring charge is a single charge of the current cycle that sits in its category's card, produced by a definition (`recurring-expenses`).
- Its category's card SHALL be the only place the **charge** is opened from. The `upcoming-charges` card SHALL NOT open this sheet for any charge it lists; activating one of its rows opens the **definition** instead (`upcoming-charges` → *A row opens its definition, and nothing else does*).
- Activating a recurring charge's row SHALL open edit mode for that charge only. The header caption SHALL name its category and SHALL state that only this cycle's charge changes.
- Saving or deleting a recurring charge SHALL NOT change the recurring definition it came from, that definition's expected amount, its day, its category, its active state, its number of repetitions, or the charge of any other cycle.

**One way in per scope.** There SHALL be exactly one surface for each of the two scopes, and neither SHALL offer the other's: the category card edits this cycle's charge, and the `upcoming-charges` card edits every cycle from here on.

#### Scenario: Recurring charge edits this month only
- **WHEN** the visitor opens the "Vivienda" card on `/demo` in Spanish and taps "Alquiler" (820 €)
- **THEN** the sheet opens in edit mode with a header caption reading "Vivienda · Solo el cargo de este mes"
- **AND** after changing the amount to 880 and saving, the "Vivienda" card total is 960 € and the free margin is 914 €
- **AND** the "Alquiler" definition still holds an expected amount of 820 €

#### Scenario: Recurring charge update carries only the charge
- **WHEN** a recording implementation of the expense operations and another of the definition operations are mounted and the user saves an edit to a recurring charge's row
- **THEN** the only call is one expense update, with that expense's identifier, amount, description and date
- **AND** the definition recorder receives nothing

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
