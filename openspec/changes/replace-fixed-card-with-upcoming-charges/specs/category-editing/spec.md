## MODIFIED Requirements

### Requirement: Opening the category sheet

Every expense card SHALL carry an options control in its header, positioned between the amount and the chevron. The `upcoming-charges` card is not an expense card and SHALL NOT carry one.

- The control SHALL have a hit area of at least 44 × 44 CSS pixels, and pressing it SHALL NOT activate the disclosure.
- Its accessible name SHALL include the category's name, so that the controls of two cards never share an accessible name.
- Activating it by tap, click, Enter or Space SHALL open the category sheet for that category.
- On a narrow viewport the sheet SHALL rise from the bottom edge. On a wide viewport it SHALL be anchored to the control that opened it.
- When the mounting page supplies no category operations, the control SHALL be rendered disabled (*Controls without a handler are disabled*).

The sheet SHALL be reachable without a gesture. Any press-and-hold or swipe SHALL only ever be an addition to this control, never the sole route to it.

#### Scenario: One options control per category card

- **WHEN** `/demo` is rendered in Spanish
- **THEN** each of the seven category cards has an options control in its header, "Vivienda" included
- **AND** the "Próximos cobros" card has no options control, its disclosure being its only control

#### Scenario: Accessible names name the category

- **WHEN** the options controls are listed by their accessible names, in Spanish and then in English
- **THEN** the "comida" card's control reads "Opciones de Comida" and then "Food options"
- **AND** no two controls on the page share an accessible name

#### Scenario: Control and disclosure are separate targets

- **WHEN** the "comida" card header is rendered at a 390px-wide viewport
- **THEN** the disclosure and the options control are two controls, neither containing the other
- **AND** each has a hit area at least 44px wide and 44px tall that responds to a pointer press at its centre
- **AND** a press at the centre of the options control leaves the disclosure's expanded state unchanged
- **AND** the category name is still truncated with an ellipsis when it is too long for the row

#### Scenario: Keyboard reaches the control

- **WHEN** the user moves keyboard focus forward from the "comida" card's disclosure
- **THEN** focus reaches that card's options control, and pressing Enter opens the sheet

#### Scenario: Opening does not toggle the card

- **WHEN** the "comida" card is collapsed and the visitor activates its options control
- **THEN** the sheet opens and the card is still collapsed
