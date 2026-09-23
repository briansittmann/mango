## MODIFIED Requirements

### Requirement: Category creation goes through an injected operation

The page that mounts the dashboard SHALL supply creation as one more injected operation, **create**, alongside those the `category-editing` and `category-reordering` capabilities describe. Every data source SHALL provide it with the same inputs and outcomes.

- It SHALL take the same name, colour and budget a saved category form produces, and no other input.
- It SHALL complete asynchronously and then either succeed or fail. On success it SHALL resolve with the new category's identifier, so the caller can tell the new card apart from the others. A failed create SHALL leave the data unchanged and SHALL create nothing.
- A name already used by another of the user's categories SHALL be rejected, and that rejection SHALL be distinguishable by the caller from every other failure — the same distinguishable rejection update uses.
- The created category SHALL have no expenses, a total of 0, and a stored order placing it after every existing category. It SHALL have a budget only when the form supplied one, and that budget SHALL belong to the current cycle only (`category-editing` → *Budgets belong to one cycle*).
- Creating a category SHALL NOT change any other category, any expense or the expenses total. It SHALL move the free margin only through its budget: a category created with a budget SHALL lower the free margin by that budget (`category-editing` → *A budget reserves its amount in the free margin*), and one created without a budget SHALL leave it unchanged.

Dashboard components SHALL create categories only through this operation.

#### Scenario: Same operation on another data source

- **WHEN** the dashboard is mounted with an implementation of the category operations that records its calls instead of the demo's
- **AND** the visitor creates a category named "Viajes" in `celeste` with no budget
- **THEN** the recorder receives create with that name, that colour and no budget, and no other call
- **AND** no dashboard component needed a change for that data source

#### Scenario: Creating changes no other figure

- **WHEN** on `/demo` in Spanish, with the expenses total at 1.700 € and the free margin at 844 €, the visitor creates "Viajes" with no budget
- **THEN** the expenses total still shows 1.700 € and the free margin still shows 844 €
- **AND** every existing card keeps its name, colour, total and budget

#### Scenario: Creating with a budget reserves it

- **WHEN** on `/demo` in Spanish, with the free margin at 844 €, the visitor creates "Viajes" with a budget of 200
- **THEN** the "Viajes" card shows 0 € of 200 € and the free margin shows 644 €
- **AND** the expenses total still shows 1.700 €, and every existing card keeps its name, colour, total and budget

#### Scenario: A failed create leaves nothing behind

- **WHEN** the injected create rejects
- **THEN** no new card is listed, the category list ends with the same card it did before, and the tile is still present
