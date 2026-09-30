## MODIFIED Requirements

### Requirement: A recurrence can end, and ends itself

A definition with a number of repetitions SHALL produce that many charges and no more.

- Each charge inserted for a definition — by the daily generation (`recurring-charge-generation`) or linked when the definition is created — SHALL increase its count of charges produced. A charge that already existed and was left in place SHALL NOT be counted again.
- When the charge that brings the count up to the number of repetitions is inserted, the definition SHALL become inactive in the same operation. No user action SHALL be required to stop it.
- An inactive definition SHALL NOT produce further charges, SHALL NOT be listed in "Próximos cobros" for later cycles, and SHALL NOT appear in any projected cycle. Charges it already produced SHALL stay exactly as they are.
- A projected cycle SHALL list a definition with a number of repetitions only while repetitions remain for it (`cycle-projection` → *A future cycle is computed, not stored*).
- A definition with no number of repetitions SHALL never become inactive on its own.

**Progress.** A definition with a number of repetitions SHALL expose its progress as the count produced out of the total. A definition without one SHALL expose no progress; no placeholder, dash, infinity mark or "sin final" label SHALL be shown in its place (`upcoming-charges` → *Expanded state lists the cycle's charges*).

**Pending total.** The definition sheet SHALL show, in muted text under the expected amount, how many charges are still to come and what they add up to at the current expected amount. That figure SHALL NOT be shown anywhere else, and SHALL NOT be shown for a definition with no end.

#### Scenario: Progress is visible on the charge
- **WHEN** the "Próximos cobros" card is expanded on `/demo` in Spanish, the "Seguro" definition being 4 of 10
- **THEN** the "Seguro" row shows its day, its amount and "4 de 10"
- **AND** the "Alquiler" row, whose definition has no end, shows no progress and no placeholder in its place

#### Scenario: Pending total in the sheet
- **WHEN** the visitor opens the "Seguro" row's definition sheet on `/demo` in Spanish, its expected amount being 35 €
- **THEN** a muted line under the expected amount states that 6 charges remain, totalling 210 €
- **AND** raising the expected amount to 40 € changes that line to 240 € before it is saved

#### Scenario: No pending total without an end
- **WHEN** the visitor opens the "Alquiler" definition sheet
- **THEN** no line states a number of remaining charges or a pending total

#### Scenario: The last charge stops the definition
- **WHEN** a definition of 10 repetitions that has produced 9 charges produces its tenth
- **THEN** the definition is no longer active, without any user action
- **AND** it produces no charge in the following cycle, and the nine earlier charges are unchanged

#### Scenario: An open-ended definition never stops itself
- **WHEN** a definition with no number of repetitions produces its twentieth charge
- **THEN** it is still active

#### Scenario: A plan leaves the projection after its last charge
- **WHEN** a definition of 3 repetitions has produced 1 and the cycle in progress is generated
- **THEN** the next two projected cycles list it and the third does not
