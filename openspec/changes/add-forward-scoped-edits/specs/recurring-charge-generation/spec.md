> Written over the `recurring-charge-generation` spec of the open change `add-cycle-projection-and-recurring-cron`, not yet synced to `openspec/specs/`. The requirement below replaces the one of the same name there.

## MODIFIED Requirements

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
