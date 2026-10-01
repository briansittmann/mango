## ADDED Requirements

### Requirement: The daily job deletes old conversation messages

Each run of the daily job SHALL delete the stored conversation messages older than 30 days (`bot-conversation-history`) for every account, after generating and closing charges. A failure in that deletion SHALL be reported in the run's response and log, and SHALL NOT undo or block the charges of that run. The report SHALL say how many messages were deleted, without their text.

#### Scenario: Purge
- **WHEN** the job runs and 12 messages are older than 30 days
- **THEN** those 12 no longer exist, newer ones remain, and the report says 12 were deleted

#### Scenario: Purge fails
- **WHEN** the deletion fails
- **THEN** the charges generated in that run stay, and the report carries the error
