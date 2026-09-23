## MODIFIED Requirements

### Requirement: The order saves on drop and reverts on failure

Each move SHALL be saved when it is made. The mode SHALL never hold unsaved moves.

- A drop and a keyboard move SHALL each send the new order immediately. Leaving the mode SHALL send nothing.
- The new order SHALL be shown at once, before the operation resolves. A save in flight SHALL NOT block a further move, and SHALL NOT disable the handles or "Listo".
- **When a save fails, the moved card SHALL return to the position it held before that move**, travelling back rather than jumping, and a message SHALL say the order could not be saved.
- The message SHALL be exposed to assistive technology and SHALL carry no undo action: the revert has already happened.
- A failure SHALL leave every other card where it was and SHALL change no amount, total, budget or free-margin figure.
- Leaving the mode while a save is in flight SHALL NOT cancel it, and a failure after leaving SHALL still revert the card and show the message.

#### Scenario: Saved on drop, not on Listo

- **WHEN** a card is dropped in a new position and "Listo" is never activated
- **THEN** one reorder call carrying the new order has already been made

#### Scenario: A failed save puts the card back

- **WHEN** the injected reorder operation rejects and the visitor drags "comida" from position 2 to position 5
- **THEN** "comida" is shown at position 5 and then returns to position 2 over successive frames
- **AND** a message says the order could not be saved, and the free margin still reads 844 €

#### Scenario: A failure after leaving the mode still reverts

- **WHEN** a card is dropped, "Listo" is activated before the operation resolves, and the operation then rejects
- **THEN** the card is shown in its original position on the dashboard and the message is shown

### Requirement: Reorder mode covers categories only

The mode SHALL change the order of category cards among themselves and nothing else.

- Expense rows inside a card SHALL NOT be reorderable, and SHALL keep the order they are given.
- No card and no expense SHALL be removed, duplicated or moved into another category by any part of the mode.
- The upcoming-charges card SHALL NOT take part in the order. It SHALL be part of the pushed-back layer, like the charts.
- No amount, total, budget, budget level, pie slice, summary row or free-margin figure SHALL change as a result of any reorder.

#### Scenario: Charges card is not in the list

- **WHEN** reorder mode is on
- **THEN** the upcoming-charges card is blurred and dimmed with the rest of the background, and carries no handle

#### Scenario: Nothing but position changes

- **WHEN** the seven cards are reordered into the reverse of their starting order
- **THEN** each card still holds exactly the expenses it held before, with the same amounts and dates
- **AND** the expenses total still reads 1.700 €, the free margin 844 €, and each budget bar is at the same level as before
