## MODIFIED Requirements

### Requirement: Category creation goes through an injected operation

The page that mounts the dashboard SHALL supply creation as one more injected operation, **create**, alongside those the `category-editing` and `category-reordering` capabilities describe. Every data source SHALL provide it with the same inputs and outcomes.

- It SHALL take the same name, colour and budget a saved category form produces, and the displayed cycle, and no other input.
- It SHALL complete asynchronously and then either succeed or fail. On success it SHALL resolve with the new category's identifier, so the caller can tell the new card apart from the others. A failed create SHALL leave the data unchanged and SHALL create nothing.
- A name already used by another of the user's live categories SHALL be rejected, and that rejection SHALL be distinguishable by the caller from every other failure — the same distinguishable rejection update uses.
- The created category SHALL start in the displayed cycle, or in the cycle in progress when a past cycle is displayed (`category-editing` → *A category lives from its first cycle to its last*): it SHALL NOT be shown in any earlier cycle.
- The created category SHALL have no expenses, a total of 0, and a stored order placing it after every existing category. It SHALL have a budget only when the form supplied one, and that budget SHALL start in the category's first cycle and reach every later cycle that holds no entry of its own (`category-editing` → *Budgets belong to one cycle*).
- Creating a category SHALL NOT change any other category, any expense or the expenses total. It SHALL move the free margin only through its budget, from its first cycle on: a category created with a budget SHALL lower the free margin of those cycles by that budget (`category-editing` → *A budget reserves its amount in the free margin*), and one created without a budget SHALL leave it unchanged.

Dashboard components SHALL create categories only through this operation.

#### Scenario: Same operation on another data source

- **WHEN** the dashboard is mounted with an implementation of the category operations that records its calls instead of the demo's
- **AND** the visitor creates a category named "Viajes" in `celeste` with no budget
- **THEN** the recorder receives create with that name, that colour, no budget and the displayed cycle, and no other call
- **AND** no dashboard component needed a change for that data source

#### Scenario: Creating changes no other figure

- **WHEN** on `/demo` in Spanish, with the expenses total at 1.700 € and the free margin at 864 €, the visitor creates "Viajes" with no budget
- **THEN** the expenses total still shows 1.700 € and the free margin still shows 864 €
- **AND** every existing card keeps its name, colour, total and budget

#### Scenario: Creating with a budget reserves it

- **WHEN** on `/demo` in Spanish, with the free margin at 864 €, the visitor creates "Viajes" with a budget of 200
- **THEN** the "Viajes" card shows 0 € of 200 € and the free margin shows 664 €
- **AND** the expenses total still shows 1.700 €, and every existing card keeps its name, colour, total and budget

#### Scenario: Creating from a projection

- **WHEN** on `/demo` in Spanish the visitor opens the November projection and creates "Viajes" with a budget of 200
- **THEN** the November and December projections show a "Viajes" card with a budget of 200 € and a free margin 200 € lower than before
- **AND** the sample cycle and the October projection show no "Viajes" card and the same free margin as before

#### Scenario: A failed create leaves nothing behind

- **WHEN** the injected create rejects
- **THEN** no new card is listed, the category list ends with the same card it did before, and the tile is still present
