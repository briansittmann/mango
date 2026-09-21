## MODIFIED Requirements

### Requirement: What reorder mode shows

While the mode is on, the category list SHALL be the only part of the screen that is legible and interactive.

**Everything else is pushed back.** The top bar, the month title, the notice, the free-margin card, the summary group, the upcoming-charges card and both charts SHALL be blurred and dimmed together, and SHALL be inert: not clickable, not focusable and not exposed to assistive technology. The blur SHALL be light and the dimming SHALL be the dominant cue, so the background's own sheen is not turned to mud.

**The list narrows and the cards shrink to their identity.** Each card SHALL give up width on its trailing side to open a lane for its handle. Each card SHALL be collapsed, SHALL hide its amount, its budget bar and its remaining text, and SHALL keep its colour dot and its name.

**The "Añadir categoría" tile is not part of the mode.** It SHALL be absent from the list for as long as the mode is on — not merely dimmed or disabled — because it is an empty slot rather than a card and there is nothing to reorder it against. It SHALL return to the end of the list when the mode is left, in the same state it was in before.

**The handle sits outside the card.** It SHALL be drawn in the lane over the card's trailing edge, not inside the card, and SHALL replace no element of the card. It SHALL show three horizontal lines, SHALL have a hit area of at least 44 × 44px, and SHALL be present on every card including the first and the last.

**The reorder bar.** A bar fixed to the top of the viewport SHALL hold the mode's name and the "Listo" control, drawn sharp and above the pushed-back layer. The dashboard's own top bar SHALL be part of the pushed-back layer and SHALL NOT be reachable.

**Every other card interaction is off.** The disclosure, the options control, the add-expense row, expense rows and swipe-to-delete SHALL be unreachable by pointer and by keyboard while the mode is on.

**Colour.** The brand colour SHALL appear only on the "Listo" control and focus indicators. The warning and destructive colours SHALL NOT appear anywhere in the mode.

#### Scenario: Only the list stays sharp

- **WHEN** reorder mode is on at a 390 × 844 viewport, in either theme
- **THEN** the free-margin card, the summary group, the upcoming-charges card, both charts and the dashboard's own top bar are blurred, dimmed and exposed to assistive technology as hidden
- **AND** every category card and its handle have no blur and full opacity

#### Scenario: Cards keep their identity and nothing else

- **WHEN** reorder mode is on with the "comida" card having been open beforehand
- **THEN** each card shows its colour dot and its name, and shows no amount, no "of budget" text, no progress bar, no remaining text and no chevron
- **AND** no expense row is visible or focusable

#### Scenario: The tile leaves and comes back

- **WHEN** reorder mode is entered on `/demo`
- **THEN** no control labelled "Añadir categoría" is present in the document
- **AND** after "Listo" is activated, the tile is once more the last child of the category list

#### Scenario: The handle is beside the card, not inside it

- **WHEN** reorder mode is on at a 390px-wide viewport
- **THEN** each handle's horizontal extent lies outside its card's box, over the card's trailing edge
- **AND** each card is narrower than it was before the mode was entered
- **AND** each handle has a hit area of at least 44 × 44px, including on the first and the last card

#### Scenario: Card controls are off

- **WHEN** reorder mode is on and the visitor presses where the "comida" card's options control was, and then tabs through the page
- **THEN** no sheet opens, the card does not expand, and the only controls reached by Tab are the "Listo" control and the seven handles
