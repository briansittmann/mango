## REMOVED Requirements

### Requirement: The bot asks whether a change is permanent, and the adapter owns the answer
**Reason**: Decision of 2026-09-30: a differing amount loaded from the chat changes only that cycle's charge. The bot never asks whether it is permanent. Changing a definition's amount is done on the web with "Desde este mes en adelante".
**Migration**: See *A differing amount from the bot changes only this cycle* below. The adapter drops its pending-decision type and discrepancy log. The logic's discrepancy reply becomes an ordinary load reply whose text carries the note.

## ADDED Requirements

### Requirement: A differing amount from the bot changes only this cycle

When a message loads an amount for a recurring expense that differs from its definition's expected amount, this cycle's charge SHALL be completed and confirmed at the loaded amount, and the definition's expected amount SHALL NOT change. The bot SHALL ask nothing about it and SHALL hold no state for it. The reply SHALL say that only this cycle changed and the expected amount stays. The following cycles SHALL be generated and projected at the definition's expected amount.

#### Scenario: Loading an amount that differs
- **WHEN** a user whose "Alquiler" definition expects 600 sends "alquiler 630"
- **THEN** this cycle's "Alquiler" charge is 630 and confirmed, the definition still expects 600, and the reply says Alquiler stays at 600

#### Scenario: Next cycle
- **WHEN** the next cycle is generated after that
- **THEN** its "Alquiler" charge is pending at 600

#### Scenario: Nothing asked
- **WHEN** the user's next message is "sí"
- **THEN** no definition changes
