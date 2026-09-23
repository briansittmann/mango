## MODIFIED Requirements

### Requirement: Charges are derived, never queried

The card SHALL render from data supplied by the page that mounts it, and SHALL NOT read from the database or hold sample data of its own.

A charge of the displayed cycle is an expense that:
- is marked recurring and carries a day of the month (1–31) and a charged-or-pending state
- is not soft-deleted

Each charge SHALL carry the name, the amount and the colour of the category it belongs to. That colour SHALL be the same value as the dot on that category's card.

The charges SHALL be derived from the same expense rows the category cards render, so that any change to a charge — its amount, its description, its deletion or its restoration — moves the card, its footer total and the free margin in the same render. The footer total SHALL equal the fixed expenses term of the free margin (`category-editing` → *A budget reserves its amount in the free margin*).

The card SHALL NOT be rendered at all when the cycle has no charges.

#### Scenario: Same rows as the cards
- **WHEN** on `/demo` in Spanish the visitor opens the "Vivienda" card, changes "Alquiler" from 820 € to 880 € and saves
- **THEN** the "Próximos cobros" row for "Alquiler" shows 880 €, its footer total shows 1.085 €, the "Vivienda" card shows 960 €, and the free margin shows 784 €

#### Scenario: Deleted charge leaves the card
- **WHEN** the visitor deletes the "Parking" charge from the "Transporte" card
- **THEN** "Parking" is no longer listed in "Próximos cobros" and the footer total drops by 50 €
- **AND** after activating "Deshacer" it is listed again, in its place by day

#### Scenario: A dot is shared, not copied
- **WHEN** the card is expanded on `/demo`
- **THEN** the dot on the "Alquiler" row and the dot on the "Vivienda" card header resolve to the same colour value

#### Scenario: A cycle with no recurring charges
- **WHEN** the dashboard is mounted with a cycle whose expenses are all one-off
- **THEN** no "Próximos cobros" card is rendered, and no empty state or placeholder is shown in its place

#### Scenario: No database traffic
- **WHEN** `/demo` is loaded and the card is expanded
- **THEN** the browser makes no request to the Supabase project
