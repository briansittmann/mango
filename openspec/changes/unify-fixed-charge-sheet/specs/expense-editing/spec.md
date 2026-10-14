## MODIFIED Requirements

### Requirement: Entry points
The sheet SHALL open from exactly these triggers:
- **The "add expense" row** at the end of an open category card: opens create mode for that card's category.
- **An expense row in any open card**, real or projected: activating it by tap, click, Enter or Space opens edit mode for that expense.
- **A row of the `upcoming-charges` card**: opens edit mode for that charge, as its row in its category card does.

**Recurring charges.** A recurring charge is the slot a definition (`recurring-expenses`) holds in one cycle, shown in its category's card: a real row in the cycle in progress or a past one, and a real or projected row in a projection.
- Its category's card and the `upcoming-charges` card SHALL open the same sheet for it, with the same content (`recurring-expenses` → *One sheet for a fixed row*, `upcoming-charges` → *A row opens its charge's sheet, and nothing else does*).
- Activating a recurring charge's row SHALL open edit mode for that charge. The header caption SHALL name its category and SHALL state that it repeats every month, and the sheet SHALL show the fixed's section below the fields.
- Saving or deleting it SHALL reach as far as the scope chosen in the sheet, and no further (`recurring-expenses` → *Every surface changes a fixed row the same way*).

**Two ways in, one sheet.** Neither way in SHALL change an earlier cycle, and both SHALL ask the same question.

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
- **THEN** the entry sheet opens in edit mode for this cycle's "Alquiler" each time, with the fixed's section
- **AND** tapping the "Alquiler" row in the "Vivienda" card opens the same sheet with the same content

#### Scenario: Every card has an add row
- **WHEN** the "Vivienda" card is open on `/demo`
- **THEN** its last row is the "Añadir gasto" row
- **AND** the "Próximos cobros" card has no add row

#### Scenario: Keyboard opens edit mode
- **WHEN** keyboard focus is on the "Cine" row and the user presses Enter
- **THEN** the sheet opens in edit mode for "Cine"

