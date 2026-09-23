# Category Reordering Specification

## Purpose

Lets people decide the order of their category cards on the dashboard, in a mode that dims everything else and hands each card a drag handle. The order is a stored, per-user property of the data, not a derived one, and it is saved the moment a card is dropped.

## Requirements

### Requirement: Category order is stored, not derived

The order of category cards SHALL be a per-user property of the data, saved and returned by whatever supplies the dashboard.

- Every data source SHALL return the user's categories in their stored order, and the dashboard SHALL render the category cards in the order it receives them.
- The stored order SHALL NOT depend on a category's name, total, budget, colour or creation date.
- A category whose stored position is undefined or shared with another SHALL still be rendered exactly once, in a stable position that does not change between two renders of unchanged data.
- Card order SHALL NOT change the order of anything else derived from categories. The expenses summary rows SHALL stay sorted by amount descending, and the pie chart SHALL keep its own ordering.

#### Scenario: Cards render in the order supplied

- **WHEN** the dashboard is mounted with categories supplied in the order "compras, comida, vivienda, ocio, transporte, salud, hogar"
- **THEN** the category cards appear top to bottom in exactly that order
- **AND** the expenses summary rows are still listed from the largest amount to the smallest

#### Scenario: Order survives unrelated changes

- **WHEN** the visitor renames a category, changes another's colour, raises a third's budget and adds an expense to a fourth
- **THEN** every card is in the same position it was in before

### Requirement: Category order changes go through an injected operation

The page that mounts the dashboard SHALL supply reordering as a third category operation, alongside update and delete. Every data source SHALL provide it with the same inputs and outcomes.

- The operation SHALL receive **the complete list of the user's category identifiers in their new order**, not a single moved item and not a pair of positions.
- It SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the stored order unchanged.
- Sending the same list twice SHALL have the same result as sending it once.
- A list that omits a category, repeats one, or names one that is not the user's SHALL be rejected, and no part of it SHALL be applied.
- Dashboard components SHALL change the order only through this operation.

#### Scenario: The whole order is sent

- **WHEN** the dashboard is mounted with an implementation that records its calls, and the visitor moves "comida" from position 2 to position 5
- **THEN** the recorder receives one reorder call carrying all seven category identifiers, with "comida" fifth
- **AND** no update and no delete call is made

#### Scenario: Same operation on another data source

- **WHEN** the dashboard is mounted with a different implementation of the three category operations
- **AND** the visitor reorders two cards
- **THEN** that implementation receives the same calls, and no dashboard component needed a change for it

#### Scenario: A rejected list changes nothing

- **WHEN** a reorder call carrying a list that repeats one identifier is made
- **THEN** it is rejected and every category keeps the position it had

### Requirement: Entering and leaving reorder mode

Reorder mode SHALL be entered from a dedicated row in the category sheet, and left from a control in a bar fixed to the top of the viewport.

**Entering:**
- The category sheet SHALL carry a **"Reordenar"** row that is not a field of the form. Activating it SHALL close the sheet and turn the mode on for the whole screen.
- Unsaved edits to the name, budget or colour SHALL be discarded when it is activated, with no confirmation, exactly as cancelling the sheet does.
- The row SHALL be rendered disabled when the mounting page supplies no reorder operation, and when the user has fewer than two categories.
- It SHALL be reachable by pointer and by keyboard, and its accessible name SHALL identify it as reordering categories rather than as an edit to the category it was opened from.

**Leaving:**
- A bar fixed to the top of the viewport SHALL hold the mode's name and a **"Listo"** control. Activating "Listo" SHALL leave the mode.
- Pressing Escape SHALL also leave the mode.
- Leaving SHALL confirm nothing and save nothing: every move has already been saved when it was made.
- Leaving SHALL restore each card to the open or collapsed state it had before the mode was entered, and SHALL return keyboard focus to the options control of the card the mode was entered from.

#### Scenario: The row is not a field

- **WHEN** the category sheet is open for "comida"
- **THEN** a divider separates the colour picker from the "Reordenar" row, and a second divider separates that row from "Eliminar categoría"
- **AND** activating "Guardar" while nothing else was touched does not change any category's position

#### Scenario: Entering discards unsaved edits

- **WHEN** the visitor opens the sheet for "comida", types a new name, and then activates "Reordenar"
- **THEN** the sheet closes, reorder mode is on, and the card still reads "Comida"

#### Scenario: Disabled with one category

- **WHEN** the sheet is opened for the only category a user has
- **THEN** the "Reordenar" row is exposed as disabled and activating it does nothing

#### Scenario: Listo leaves the mode and restores the screen

- **WHEN** the visitor opens the "comida" card, opens its sheet, enters reorder mode, moves a card, and activates "Listo"
- **THEN** reorder mode is off, the "comida" card is open again, every amount and budget bar is visible, and focus is on the "comida" card's options control

#### Scenario: Escape leaves the mode

- **WHEN** reorder mode is on and no card is being dragged, and the visitor presses Escape
- **THEN** reorder mode is off and the moves already made are still in place

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

### Requirement: Moving a card by direct drag

Within the mode, a card SHALL be moved by grabbing it and dragging, with no press-and-hold first.

- **The card SHALL follow the pointer 1:1** from the point at which it was grabbed, and SHALL NOT jump so that its centre meets the pointer.
- The grab SHALL hold once the pointer leaves the card's bounds, and the drag SHALL continue until the pointer is released or cancelled.
- **A second pointer touching the screen mid-drag SHALL be ignored**, and SHALL NOT switch, cancel or jump the drag.
- While a card is held, it SHALL be raised above the others by a deeper shadow and a slightly larger scale, and the cards it passes SHALL move aside to open its gap rather than appearing in place after the drop.
- **Past the first and the last position the card SHALL resist progressively** rather than stop dead, and SHALL return inside the list when released.
- When the held card nears the top or bottom edge of the viewport, the page SHALL scroll in that direction so positions outside the viewport are reachable without releasing.
- On release the card SHALL travel to its resting position over successive frames rather than jumping there, settling without overshooting past it.
- A press that does not move beyond a small threshold SHALL be treated as no movement: the order SHALL be unchanged and no save SHALL be attempted.

**Where the drag can start:** on a touch pointer it SHALL start from the handle only, leaving the rest of the card free for scrolling the page. On a mouse pointer it SHALL start from anywhere on the card or its handle.

#### Scenario: The card follows the finger from where it was grabbed

- **WHEN** the handle of the "comida" card is pressed 8px below its top edge and dragged down 120px
- **THEN** the card's top edge is 120px lower than it started, and the gap between the pointer and the card's top edge is still 8px

#### Scenario: Neighbours open the gap during the drag

- **WHEN** the "comida" card (position 2 of 7) is dragged down over two cards and held there without releasing
- **THEN** "ocio" and "transporte" have moved up by one card's height, and a gap the size of the dragged card sits at position 4

#### Scenario: Drop lands the card and re-renders the list

- **WHEN** that drag is released over position 4
- **THEN** the cards read, top to bottom, vivienda · ocio · transporte · comida · salud · hogar · compras
- **AND** no amount, total or free-margin figure on the page has changed

#### Scenario: Resistance at the ends

- **WHEN** the first card is dragged 200px upward, past the top of the list
- **THEN** it moves less than 200px, by progressively less the further it goes
- **AND** on release it returns to the first position

#### Scenario: A press without movement changes nothing

- **WHEN** a handle is pressed and released without moving
- **THEN** the order is unchanged and no reorder call is made

#### Scenario: A second finger does not hijack the drag

- **WHEN** a card is being dragged and a second finger touches another card
- **THEN** the dragged card keeps following the first finger and the second touch moves nothing

#### Scenario: Touch drags start at the handle

- **WHEN** a touch pointer drags vertically from the middle of a card's name, away from its handle
- **THEN** no card moves and the page scrolls
- **AND** the same drag started on that card's handle moves the card

### Requirement: Moving a card by keyboard

Reordering SHALL be possible without a pointer gesture. A gesture SHALL never be the only route to it.

- Each handle SHALL be a focusable control, reachable by Tab, showing a visible focus ring.
- Its accessible name SHALL identify its category and SHALL state the category's position and the number of categories.
- With focus on a handle, **the Up and Down arrow keys SHALL move that card one position** in that direction, and SHALL save exactly as a drop does.
- An arrow key at the first or the last position SHALL do nothing and SHALL save nothing.
- Focus SHALL stay on the handle of the moved card, so repeated presses keep moving the same card.
- Each move SHALL be announced to assistive technology, naming the category and its new position.

#### Scenario: Arrow keys move the focused card

- **WHEN** focus is on the "comida" handle (position 2 of 7) and Down is pressed twice
- **THEN** "comida" is at position 4, focus is still on its handle, and two reorder calls have been made

#### Scenario: Handles name their position

- **WHEN** reorder mode is on and the handles are listed by accessible name, in Spanish and then in English
- **THEN** the "comida" handle names the category and reads as position 2 of 7 in each language
- **AND** no two handles share an accessible name

#### Scenario: Arrow at the end does nothing

- **WHEN** focus is on the last card's handle and Down is pressed
- **THEN** the order is unchanged and no reorder call is made

#### Scenario: A move is announced

- **WHEN** focus is on the "comida" handle and Up is pressed
- **THEN** a status message naming "Comida" and its new position is exposed to assistive technology

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
- **AND** a message says the order could not be saved, and the free margin still reads 864 €

#### Scenario: A failure after leaving the mode still reverts

- **WHEN** a card is dropped, "Listo" is activated before the operation resolves, and the operation then rejects
- **THEN** the card is shown in its original position on the dashboard and the message is shown

### Requirement: Reorder mode adapts to the pointer and the viewport

The mode SHALL present the same list and the same order on every device, and SHALL differ only where the input does.

**Narrow viewport:**
- The mode SHALL be entered from the category sheet rising from the bottom edge.
- Handles SHALL be fully visible at rest, because there is no hover to reveal them.
- The drag SHALL start at the handle, and the rest of the card SHALL scroll the page.

**Wide viewport:**
- The mode SHALL be entered from the category menu anchored to the control that opened it.
- The pointer SHALL show a "grab" cursor over a draggable card and a "grabbing" cursor while one is held.
- Hovering a card SHALL raise its handle's contrast. That hover treatment SHALL apply only to a fine pointer that supports hover, so a tap never leaves a card looking hovered.
- The drag SHALL start from anywhere on the card.

The list SHALL keep the dashboard's maximum content width and stay centred, and SHALL NOT stretch across a wide viewport.

#### Scenario: Entry surface follows the viewport

- **WHEN** the category sheet is opened at a 390px-wide viewport, and again at a 1280px-wide one
- **THEN** it rises from the bottom edge in the first case and is anchored to the options control in the second
- **AND** the "Reordenar" row is present in both, and enters the same mode

#### Scenario: Cursors on a wide viewport

- **WHEN** the pointer rests over a card in reorder mode at a 1280px-wide viewport, and then holds it
- **THEN** the cursor is "grab" and then "grabbing"

#### Scenario: No hover state left behind on touch

- **WHEN** a card is tapped on a touch device in reorder mode
- **THEN** no card is left with the hovered handle treatment

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
- **AND** the expenses total still reads 1.700 €, the free margin 864 €, and each budget bar is at the same level as before
