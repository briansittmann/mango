## ADDED Requirements

### Requirement: Payment method on an income entry

The income configuration of the entry sheet SHALL show the same "Efectivo" / "Tarjeta" chips, in the same place and with the same behaviour, preselection and states as an expense (`expense-editing` → *Payment method on an expense*). Create and update SHALL pass the chosen method, none included. A fixed income row SHALL ask how far a changed method reaches like any other change. Marking an income entry "Efectivo" SHALL add its amount to the cash pocket and nothing else; the income total and the free margin SHALL move exactly as they would with no method.

#### Scenario: Cash tips
- **WHEN** on `/demo` in Spanish the visitor adds an income of 40 described as "Propinas" with "Efectivo"
- **THEN** the income column shows 2.860 €, the free margin 904 €, the cash pocket 182,60 €, and the card pocket is unchanged

#### Scenario: Chips on income
- **WHEN** the visitor activates "Añadir ingreso"
- **THEN** the sheet shows the "Efectivo" and "Tarjeta" chips right after the amount
