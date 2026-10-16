## ADDED Requirements

### Requirement: A fixed expense names the card it is charged to

A recurring expense definition SHALL carry an optional card (`card-wallet`): one of its user's cards, or none. A recurring income definition SHALL carry none. A new definition SHALL start with none. The card belongs to the definition, not to a cycle: it SHALL hold in every cycle, past ones included, and changing it SHALL NOT ask how far it reaches and SHALL NOT change any charge, amount, day, category, reminder or other field.

The definition operations SHALL include **set card**, which takes a definition and a card or none, and changes only that. It SHALL complete asynchronously and either succeed or fail; a failure SHALL leave the data unchanged.

The fixed's section of a fixed expense row's sheet (*One sheet for a fixed row*) SHALL hold a **"Tarjeta"** row while the user holds at least one card, after the reminder: a choice among the user's cards, each with its colour, and "Sin tarjeta", showing the current one. Saving the sheet with a changed card SHALL set it through set card, after any change to this month's values and the reminder; a changed card alone SHALL write nothing else. In a projected cycle the row SHALL work the same. A fixed income row SHALL NOT show it, and neither SHALL a user with no cards.

#### Scenario: Assigning a card from the fixed's sheet
- **WHEN** the visitor opens "Parking" on `/demo`, chooses "Débito" under "Tarjeta" and saves
- **THEN** the data source receives one set card for "Parking" with "Débito" and no slot edit or other definition operation, and reopening "Parking" shows "Débito"

#### Scenario: Removing the card
- **WHEN** the visitor opens "Alquiler", chooses "Sin tarjeta" and saves
- **THEN** "Alquiler" carries no card, and "Débito" no longer counts it

#### Scenario: No row without cards or on income
- **WHEN** the visitor deletes both demo cards and opens "Parking", or opens the fixed income "Salario"
- **THEN** the sheet shows no "Tarjeta" row

#### Scenario: The card holds in every cycle
- **WHEN** the visitor assigns "Parking" to "Débito" in September and moves to a projected cycle
- **THEN** the sheet of that cycle's "Parking" shows "Débito", and "Débito" counts its projected charge there
