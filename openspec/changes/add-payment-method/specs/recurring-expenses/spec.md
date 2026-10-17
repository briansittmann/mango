## ADDED Requirements

### Requirement: A recurring definition carries a payment method

A recurring definition SHALL carry a payment method, `efectivo` or `tarjeta`, or none (`payment-method`). A definition created with the recurrence switch SHALL take the method marked in the sheet that created it, and the row that same save created SHALL carry it too. The method SHALL belong to the definition the way its amount does, not the way its card or its reminder do: changing it from a row SHALL ask how far it reaches (*Every change to a recurring row asks how far it reaches*). "Solo este mes" SHALL write it on that cycle's row only; "Desde este mes en adelante" SHALL write it on the definition and on every pending slot of that cycle and later, and SHALL freeze the cycles in between as any other change from that row does. Rows of earlier cycles SHALL NOT change.

A definition's method and its wallet card (`card-wallet`) SHALL be independent: choosing a card SHALL NOT set the method, and choosing a method SHALL NOT set or clear the card.

#### Scenario: Created by card
- **WHEN** the visitor adds "Netflix" 12,99 to "Suscripciones" with "Tarjeta" marked and the recurrence switch on
- **THEN** the definition and this cycle's "Netflix" row both carry "Tarjeta", and the next projected cycle's "Netflix" charge shows the card icon

#### Scenario: Only this month
- **WHEN** the visitor opens this cycle's "Alquiler" (by card), marks "Efectivo", saves and chooses "Solo este mes"
- **THEN** this cycle's "Alquiler" row carries "Efectivo", and the next projected cycle's "Alquiler" still carries "Tarjeta"

#### Scenario: From this month on
- **WHEN** the visitor does the same and chooses "Desde este mes en adelante"
- **THEN** this cycle's row and every later cycle's "Alquiler" carry "Efectivo", and the previous cycle's row still carries "Tarjeta"
