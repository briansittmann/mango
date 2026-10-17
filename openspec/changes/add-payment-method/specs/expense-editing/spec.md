## ADDED Requirements

### Requirement: Payment method on an expense

The expense configuration of the entry sheet SHALL show, right after the amount, a row of two chips labelled "Efectivo" and "Tarjeta", in a group named "Medio de pago". The chips SHALL be optional: none marked means no method; marking one SHALL unmark the other; activating the marked one SHALL unmark it. A marked chip SHALL take the selected treatment (the brand fill, its text in the brand's foreground) and SHALL be exposed as pressed; an unmarked one SHALL be quiet (no fill, the border token, the regular text colour) and exposed as not pressed. The chips SHALL NOT reveal or hide any other field.

In create mode the chip of the account's default SHALL start marked (none when the default is "Ninguno"); the visitor MAY change or unmark it. In edit mode the chips SHALL start with the row's own method, whatever the default. Create and update SHALL pass the chosen method, none included, to the injected operation (`payment-method` → *A movement may say how it was paid*). On a row of a recurring definition, a changed method SHALL count as a change of this month's values, so the sheet asks how far it reaches like any other change (`recurring-expenses` → *Every change to a recurring row asks how far it reaches*). The chips SHALL be shown in a projected cycle too.

#### Scenario: Chips with no default
- **WHEN** with the default "Ninguno" the visitor activates "Añadir gasto" in "Ocio" on `/demo`
- **THEN** the sheet shows "Efectivo" and "Tarjeta" right after the amount, neither pressed

#### Scenario: Marking, switching and unmarking
- **WHEN** the visitor activates "Efectivo", then "Tarjeta", then "Tarjeta" again
- **THEN** after the first only "Efectivo" is pressed, after the second only "Tarjeta", and after the third neither

#### Scenario: The default preselects
- **WHEN** the default is "Tarjeta" and the visitor activates "Añadir gasto", unmarks "Tarjeta", types 9 and saves
- **THEN** the sheet opened with "Tarjeta" pressed, and the new row carries no method

#### Scenario: Edit shows the row's method
- **WHEN** the default is "Tarjeta" and the visitor opens "Café", stored in cash
- **THEN** "Efectivo" is pressed and "Tarjeta" is not

#### Scenario: A fixed charge asks how far
- **WHEN** the visitor opens "Alquiler" (by card), marks "Efectivo" and saves
- **THEN** the "Solo este mes" / "Desde este mes en adelante" choice is shown before anything is written
