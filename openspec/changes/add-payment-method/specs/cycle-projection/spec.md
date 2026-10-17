## ADDED Requirements

### Requirement: Payment methods in a projected cycle

A projected charge SHALL carry its definition's payment method and SHALL show its icon on its row like any stored row (`dashboard-ui` → *A row shows how it was paid*). A real row of a projected cycle SHALL show its own. The pocket balances SHALL NOT be computed or shown for a projected cycle, the free-margin card SHALL show no pockets block there, and no "Mover plata" sheet SHALL be offered: a projection holds no money that has moved. No transfer SHALL be projected. The entry sheet SHALL still offer the payment chips in a projected cycle, so a row entered there carries its method once its cycle is the one in progress.

#### Scenario: Icons, no pockets
- **WHEN** on `/demo` the visitor opens the October 2026 projection and the "Vivienda" card
- **THEN** "Alquiler" shows the card icon, and the free-margin card shows no pockets block and no "Mover plata" button
