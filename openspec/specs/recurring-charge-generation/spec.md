# recurring-charge-generation Specification

## Purpose

Makes recurring definitions produce their charges on their own: a daily job inserts each cycle's charges as pending from the cycle projection, counts and ends instalment plans, and closes what nobody confirmed when the cycle ends, while a charge entered by hand completes the pending one instead of duplicating it.

## Requirements

### Requirement: A movement is pending or confirmed

Every movement row SHALL be either pending or confirmed. Only charges inserted by the generation job SHALL be created pending; every other row — entered by hand, created with a recurring definition from the entry sheet, or written by any other caller — SHALL be created confirmed. A pending charge SHALL count in every total, bar and free margin at its amount, which is the expected amount it was inserted with until someone changes it. A confirmed row SHALL never become pending again.

When the state is introduced, existing rows SHALL be classified by the rule used until then: a row produced by a recurring definition whose local date is after the local today of its owner is pending; every other row is confirmed. The dashboard SHALL show the same charges as taken and pending right before and right after the change.

#### Scenario: Manual rows are confirmed
- **WHEN** the user adds an expense of 20 to "Comida" from the dashboard
- **THEN** the stored row is confirmed

#### Scenario: Back-fill keeps the screen as it was
- **WHEN** the state is introduced on 28 September 2026, the September cycle holding the "Sueldo" charge dated 29 September and the "Alquiler" charge dated 1 September
- **THEN** "Sueldo" is pending and "Alquiler" confirmed, and "Próximos cobros" shows the same taken and pending charges as before

### Requirement: Each cycle's charges are generated once, from the projection

A job SHALL run once a day. For each user, it SHALL generate, in order, every cycle after the user's last generated cycle up to and including the cycle in progress in the user's timezone. A user never generated before SHALL start with the cycle in progress. Generating a cycle SHALL:

- insert one pending row for each charge and income entry that the cycle's projection (`cycle-projection` → *A future cycle is computed, not stored*) lists, at its expected amount, on its date (`cycle-projection` → *A recurring charge falls on its day inside the cycle*), linked to its definition and to the cycle
- insert nothing for a definition that already has a row in that cycle, soft-deleted rows included — whether the job, the seed or the entry sheet wrote it — and leave that row as it is
- record the cycle as the user's last generated cycle, in the same operation as the inserts

A cycle SHALL never be generated twice. Running the job again, the same day or later, SHALL insert nothing for a generated cycle. A failure for one user SHALL NOT stop the job for the others, and SHALL leave that user's rows, counts and last generated cycle as they were, so the next run retries it. The job's result SHALL report, per user, the cycles generated and the rows inserted, and no amount or description.

#### Scenario: October is generated on its first day
- **WHEN** a user whose cycle starts on the 1st has September as last generated cycle, and the job runs on 1 October 2026 after local midnight
- **THEN** one pending row per active definition with repetitions left is inserted in October, dated on its day, and October becomes the last generated cycle

#### Scenario: Existing September rows are not touched
- **WHEN** the job runs on 28 September 2026 for a user whose last generated cycle is September and whose September charges were inserted by hand
- **THEN** nothing is inserted, no count changes, and "Préstamo DB Bank" (0 of 4, no September row) gets no September charge

#### Scenario: A missed run catches up
- **WHEN** the job did not run on 1 and 2 October and runs on 3 October
- **THEN** October is generated with the same rows it would have had on the 1st

#### Scenario: A second run inserts nothing
- **WHEN** the job runs twice on 1 October
- **THEN** the second run inserts no row and changes no count

#### Scenario: A deleted charge is not re-inserted
- **WHEN** the user deletes the October "Netflix" charge and the job runs again
- **THEN** no new "Netflix" row appears in October

#### Scenario: A definition created mid-cycle
- **WHEN** on 10 October, after October was generated, the user adds "Disney+" with the recurrence switch on
- **THEN** the October "Disney+" row is the one the entry sheet created, confirmed, and the job inserts it from November on

### Requirement: Generating a charge counts it and ends the plan

Generating a cycle SHALL add one to the count of charges produced of every definition that holds a slot in that cycle — a row linked to it for that cycle, whether the job inserted it, the entry sheet wrote it ahead of time (`recurring-expenses` → *A definition's slot in a cycle can be changed on its own*) or it was soft-deleted. A slot written in a cycle that was already generated SHALL add one when it is written; a slot written in a cycle not yet generated SHALL add nothing until that cycle is generated. So every slot is counted exactly once, a cycle is never generated twice, and a count set before any row existed (instalments paid before the app) is kept.

When the count reaches the definition's number of repetitions, the definition SHALL become inactive in the same operation (`recurring-expenses` → *A recurrence can end, and ends itself*). A soft-deleted slot SHALL count as a repetition: skipping one month of a plan SHALL NOT move its end.

#### Scenario: Instalments on the first October run
- **WHEN** October is generated, "Hacienda" being 1 of 3, "Préstamo DB Bank" 0 of 4 and "Préstamo Cetelem" 0 of 12
- **THEN** they become 2 of 3, 1 of 4 and 1 of 12, all still active

#### Scenario: The last instalment
- **WHEN** November is generated and "Hacienda" is 2 of 3
- **THEN** it becomes 3 of 3 and inactive, and December's projection and generation leave it out

#### Scenario: A slot written ahead is counted once
- **WHEN** "Préstamo Cetelem" is 1 of 12 after October, the user set its December slot with "Solo este mes" while October was in progress, and November and then December are generated
- **THEN** it is 2 of 12 after November and 3 of 12 after December, and a second run on the same day leaves it at 3 of 12

#### Scenario: A skipped instalment still counts
- **WHEN** October is in progress with "Hacienda" at 2 of 3, the user swipes away its projected November charge, and November is generated
- **THEN** "Hacienda" is 3 of 3 and inactive, and December lists no "Hacienda"

### Requirement: A cycle that ends closes its pending charges

When the job runs, every pending charge of a cycle that has ended in its owner's timezone SHALL become confirmed at its current amount. Nothing else about the row SHALL change.

#### Scenario: Rent nobody touched
- **WHEN** the October "Alquiler" charge of 1 000 € is still pending and the job runs on 1 November
- **THEN** it is confirmed at 1 000 €, dated as before

### Requirement: A charge entered for a definition completes the pending one

Saving a pending charge from its row SHALL confirm it with the amount, description and date entered; no second row SHALL be created. The data layer SHALL also offer, for a definition and a cycle, one operation that completes that cycle's pending charge of the definition with a given amount and date and confirms it, or, when the cycle has no row of that definition, inserts a confirmed row linked to it and counts it as the job would. When the cycle already holds a confirmed or soft-deleted row of that definition, the operation SHALL reject with nothing changed, and the rejection SHALL be distinguishable from other failures.

#### Scenario: A variable bill
- **WHEN** the October "Luz" charge is pending at 90 € and the user opens it and saves 120 €
- **THEN** October holds one "Luz" row, confirmed at 120 €, and the "Próximos cobros" row shows it as taken with the expected 90 € as its comparison

#### Scenario: Completing through the data layer
- **WHEN** the operation is called for "Luz" in October with 120 € while the pending row exists
- **THEN** that row is confirmed at 120 € and no row is added

#### Scenario: Nothing to complete
- **WHEN** the operation is called for "Luz" in October after the October row was confirmed
- **THEN** it rejects as already confirmed and no row changes

### Requirement: Only the scheduler can run the job

The job's endpoint SHALL act only on a request carrying the scheduler's secret; any other request SHALL receive an unauthorised response and change nothing. The job SHALL use a server-only credential that bypasses row-level security, and that credential SHALL NOT reach the browser bundle.

#### Scenario: Request without the secret
- **WHEN** someone requests the job's endpoint without the secret or with a wrong one
- **THEN** the response is 401 and no row, count or last generated cycle changes

#### Scenario: Scheduled run
- **WHEN** the scheduler calls the endpoint with its secret
- **THEN** the job runs for every user and responds with a success status and its per-user report
