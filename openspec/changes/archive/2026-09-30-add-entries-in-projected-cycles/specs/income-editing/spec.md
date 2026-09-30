## MODIFIED Requirements

### Requirement: The income configuration of the entry sheet
Creating and editing an income entry SHALL use the same sheet expenses use, opened with an income field configuration (`expense-editing` → *One entry sheet for creating and editing*). The income configuration SHALL list amount, description and date, in that order, followed by the recurrence control in create mode.

The sheet SHALL differ from the expense one only in its wording and its header caption:
- **Titles:** "Nuevo ingreso" in create mode, "Editar ingreso" in edit mode.
- **Primary action:** "Añadir" in create mode, "Guardar" in edit mode, as for an expense.
- **Delete action (edit mode):** "Eliminar ingreso".
- **Caption:** the income label, with no colour dot and no category name. No category selector SHALL be rendered in either mode.

**Create mode:** the amount and description SHALL start empty, and the date SHALL start at today in the user's time zone when the displayed cycle contains today, at the cycle's first day when the cycle is a projection, and otherwise at the cycle's last day. In a projected cycle the sheet SHALL NOT show the recurrence control.

**Edit mode:** the fields SHALL start with the entry's amount, description and date, and a delete action SHALL be added below the fields.

Its panel, material, header order, row sizes, type sizes and colour use SHALL be those of the expense sheet (`expense-editing` → *Entry sheet appearance*).

#### Scenario: Create from the income panel
- **WHEN** the income panel is open on `/demo` in Spanish and the visitor activates "Añadir ingreso"
- **THEN** the sheet opens titled "Nuevo ingreso", with the income label in the header caption
- **AND** the amount and description are empty, the date is 10 September 2026, and there is no delete action

#### Scenario: Create in a projected cycle
- **WHEN** on `/demo` in Spanish the visitor opens the October 2026 projection, opens the income panel and activates "Añadir ingreso"
- **THEN** the sheet opens titled "Nuevo ingreso" with the date 1 October 2026, 30 September and 1 November cannot be selected, and no recurrence control is shown

#### Scenario: Edit preloads the entry
- **WHEN** the visitor activates the "Freelance" row (420 €, 5 September)
- **THEN** the sheet opens titled "Editar ingreso" with the amount 420, the description "Freelance" and the date 5 September 2026
- **AND** an "Eliminar ingreso" action is shown below the fields

#### Scenario: No category anywhere
- **WHEN** the sheet is open for an income entry, in create mode and again in edit mode
- **THEN** no colour dot, category name, category selector or category field is rendered in the sheet
- **AND** its rows are amount, description and date only, plus the recurrence control in create mode

#### Scenario: Same geometry as the expense sheet
- **WHEN** the sheet is opened for an expense and then for an income entry at a 390px-wide viewport, both in create mode
- **THEN** the panel, the header controls and the amount, description and date rows have the same positions and sizes in both

### Requirement: Income moves only income figures
Creating, editing, deleting or restoring an income entry SHALL, in the same render, update the income column's total, the rows of the income panel and the free margin, as defined in `category-editing` → *A budget reserves its amount in the free margin*. Income enters that definition with its whole amount, so an income change SHALL move the free margin by exactly the change in the income total.

It SHALL NOT change any expense figure: no card total, budget bar or remaining text, no expenses total or expenses panel row, no pie slice or legend entry, no bar of the monthly chart, and no row or footer total of the `upcoming-charges` card.

Income entries SHALL NOT appear in any expense surface: not in a category card, not in the expenses panel, not in the pie chart, and not in the monthly spend chart.

In a projected cycle the same SHALL hold for the cycle's real income entries, beside the projected recurring income entries, which SHALL stay read-only (`cycle-projection` → *What a projected cycle shows and allows*).

#### Scenario: Income does not touch expenses
- **WHEN** on `/demo` in Spanish the visitor adds 300 € of income, edits it to 350 €, and deletes it
- **THEN** after each of those steps the expenses total shows 1.700 €, the pie centre shows 1.700 €, every card total is unchanged, and the "Próximos cobros" footer reads 1.025 €
- **AND** the free margin reads 1.164 €, then 1.214 €, then 864 €

#### Scenario: Income in a projected cycle
- **WHEN** on `/demo` in Spanish the visitor opens the October 2026 projection (income 2.400 €, free margin 475 €) and adds 300 € described as "Bonus", edits it to 350 €, and deletes it
- **THEN** the income column reads 2.700 €, then 2.750 €, then 2.400 €, and the free margin 775 €, then 825 €, then 475 €
- **AND** "Salario" is listed throughout as a row that cannot be edited, swiped or deleted
- **AND** the September sample never lists "Bonus" and its income column still reads 2.820 €

#### Scenario: Income stays out of the expense surfaces
- **WHEN** an income entry named "Bonus" exists and every category card, the expenses panel, the pie legend and the monthly chart are inspected
- **THEN** "Bonus" appears in none of them

#### Scenario: Free margin follows the three totals
- **WHEN** on `/demo` the income total is 2 820, the cycle's savings 146, and the expense side of the free margin 1 810 (budgeted categories 680 — comida max(400, 310), ocio max(150, 130), transporte max(100, 130) — and unbudgeted categories 1 130, recurring charges included in both)
- **THEN** the free margin shows 864 €
- **AND** after an income entry of 300 € is added it shows 1.164 €
