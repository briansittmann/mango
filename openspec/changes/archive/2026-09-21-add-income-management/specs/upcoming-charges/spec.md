## ADDED Requirements

### Requirement: Only expense charges are listed

The card SHALL list recurring **expense** charges only. A recurring movement of any other type — an income entry produced by a recurring definition, and later a savings movement — SHALL NOT be listed, SHALL NOT be counted in the committed-this-cycle total, and SHALL NOT be eligible to be the next charge shown in the collapsed state.

A salary that arrives on the same day every month is a recurrence, not a charge: the card answers what the cycle still owes, and money coming in never appears there.

This SHALL hold however the charge was created, including a recurring income entry added in the session that is being viewed, and SHALL hold whether or not the cycle has any expense charges at all: a cycle whose only recurring movements are income SHALL render no card (*Charges are derived, never queried*).

#### Scenario: A recurring salary is not a charge
- **WHEN** on `/demo` in Spanish the visitor adds an income entry of 2 400 € described as "Salario", with the recurrence switch on and day 1
- **THEN** "Salario" is listed in the income panel and the income total rises by 2 400 €
- **AND** "Próximos cobros" still lists six charges, none of them named "Salario", and its footer still reads 1.025 €

#### Scenario: Collapsed state ignores income recurrences
- **WHEN** an income recurrence falling on day 2 exists and the card is collapsed on `/demo` in Spanish
- **THEN** the collapsed card still shows "Parking · día 15" as the next charge

#### Scenario: A cycle whose only recurrences are income
- **WHEN** the dashboard is mounted with a cycle whose expenses are all one-off and whose only recurring definitions are income
- **THEN** no "Próximos cobros" card is rendered
