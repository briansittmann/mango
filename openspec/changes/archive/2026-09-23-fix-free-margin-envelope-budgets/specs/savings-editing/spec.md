## MODIFIED Requirements

### Requirement: A saved movement moves only savings figures and the free margin
After a movement is saved, the dashboard SHALL show figures recomputed from the resulting list of movements, not from the previously shown figures:
- the savings column's total: the sum of the cycle's signed movements
- the accumulated balance: the balance before the cycle plus that sum
- the last point of the savings history, equal to the accumulated balance
- the progress against the savings target, when one is set
- the free margin, as defined in `category-editing` → *A budget reserves its amount in the free margin*, in which savings enter with their whole signed amount, so a movement moves the free margin by exactly its signed amount in the opposite direction

The new movement SHALL be listed in the savings panel among the others in ascending date order, after any movement already listed on the same date, with the deposit or withdrawal marker and a signed amount; a withdrawal SHALL show the true minus sign U+2212, never a hyphen.

The savings total, the accumulated balance and the free margin SHALL animate from their previous value to the new one, and SHALL change without animation when the user prefers reduced motion.

No savings movement SHALL move an income or expense figure: the income total, the expenses total, card totals, budget bars, the charts and the `upcoming-charges` card SHALL stay as they were.

#### Scenario: A deposit of 50
- **WHEN** on `/demo` in Spanish, with savings at 146 €, the accumulated balance at 2.646 € and the free margin at 844 €, the visitor saves a deposit of 50 named "Extra"
- **THEN** the savings column shows 196 €, the accumulated balance 2.696 € and the free margin 794 €
- **AND** "Extra" is listed in the savings panel with "+50 €"
- **AND** the income total still shows 2.820 € and the expenses total 1.700 €

#### Scenario: A withdrawal of 30
- **WHEN** on `/demo` in Spanish the visitor saves a withdrawal of 30 named "Imprevisto"
- **THEN** "Imprevisto" is listed with "−30 €", its minus sign being U+2212
- **AND** the savings column shows 116 €, the accumulated balance 2.616 € and the free margin 874 €

#### Scenario: Date order
- **WHEN** the visitor saves a deposit dated 5 September 2026 while the panel lists movements dated 3, 8 and 9 September
- **THEN** the new movement is listed second

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion and saves a deposit of 50
- **THEN** the savings total, the accumulated balance and the free margin show their new values without an animated transition
