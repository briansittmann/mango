## ADDED Requirements

### Requirement: A generated charge copies its definition's payment method

Every row the job inserts for a definition SHALL carry that definition's payment method at the moment of generation, none included. It SHALL NOT take the account's default. A row the job leaves as it is (*Each cycle's charges are generated once, from the projection*) SHALL keep its own method. The job SHALL never generate a transfer, and SHALL NOT read or change any transfer.

#### Scenario: Card definition
- **WHEN** the "Gimnasio" definition carries "Tarjeta" and its November charge is generated
- **THEN** the November "Gimnasio" row carries "Tarjeta"

#### Scenario: Definition with none and a cash default
- **WHEN** the "Limpieza" definition carries no method, the account default is "Efectivo", and its November charge is generated
- **THEN** the November "Limpieza" row carries no method
