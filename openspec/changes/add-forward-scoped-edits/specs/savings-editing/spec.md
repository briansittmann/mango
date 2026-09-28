## MODIFIED Requirements

### Requirement: Savings changes go through an injected operation
The dashboard SHALL change savings movements only through savings operations supplied by the page that mounts it. The dashboard SHALL NOT know which data source is behind it. There SHALL be three operations:

- **add**, which SHALL take:
  - the movement type, deposit or withdrawal
  - a name, trimmed, never empty
  - an amount greater than 0
  - a calendar date inside the displayed cycle
- **soft delete**, which SHALL take a movement and mark it as deleted without removing it
- **restore**, which SHALL clear that mark

Each SHALL resolve once the change is durable, and SHALL reject with nothing changed. A withdrawal SHALL be recorded as a savings movement with a negative amount; a deposit with a positive one. The caller SHALL never pass a signed amount: the sign comes from the type. No data source SHALL permanently remove a movement in response to a delete.

Every data source SHALL implement them with the same inputs and outcomes. When the page supplies no add operation, the "add savings movement" row SHALL be disabled (`dashboard-ui` → *Controls without a handler are disabled*); when it supplies no soft delete, movement rows SHALL offer no swipe.

#### Scenario: A withdrawal reaches the operation as a positive amount and a type
- **WHEN** a recording implementation of the savings operations is mounted and the user saves a withdrawal of 30 named "Viaje" dated 12 September 2026
- **THEN** the recorder receives one add call with the withdrawal type, "Viaje", 30 and 2026-09-12

#### Scenario: No operation, no sheet
- **WHEN** the dashboard is mounted without savings operations
- **THEN** the "Añadir movimiento de ahorro" row is disabled and activating it opens nothing, and no movement row can be swiped

#### Scenario: Delete and undo reach the operations
- **WHEN** a recording implementation is mounted and the user long-swipes a movement and then activates "Deshacer"
- **THEN** the recorder receives soft delete and then restore, both for that movement

## ADDED Requirements

### Requirement: A savings movement deletes like an income entry

A savings movement row in the savings panel SHALL be deleted the way an income entry is (`income-editing` → *Income deletes like an expense*): a swipe reveals the delete panel, a long swipe deletes, the toast offers "Deshacer", only one row on the page stays open, and a failed delete brings the row back with an alert. Deleting a movement SHALL move only savings figures and the free margin, exactly as saving one does, in reverse (*A saved movement moves only savings figures and the free margin*). Restoring it SHALL bring back the same figures.

This change SHALL provide no way to edit a movement.

#### Scenario: Deleting a deposit
- **WHEN** on `/demo` in Spanish the visitor saves a deposit of 50 and then long-swipes it
- **THEN** it is no longer listed, the savings and the free margin show what they showed before the deposit, and a toast offers "Deshacer"
- **AND** activating "Deshacer" lists it again and the figures show the deposit again

#### Scenario: Deleting a withdrawal
- **WHEN** the visitor saves a withdrawal of 30 and then deletes it
- **THEN** the savings and the free margin show what they showed before the withdrawal

#### Scenario: Deleting in a projection
- **WHEN** on the October projection the visitor saves a deposit of 350 above a savings target of 300 and then deletes it
- **THEN** the October savings show 300 again, the floor
