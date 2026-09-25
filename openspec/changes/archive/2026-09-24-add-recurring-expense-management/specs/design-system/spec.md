## MODIFIED Requirements

### Requirement: Motion respects user preference
When the operating system requests reduced motion:
- content SHALL appear in its final position without entrance movement
- disclosures, the month picker, the account sheet, the entry sheet, the category sheet and the definition sheet SHALL open and close without animated movement
- a switch SHALL change state without its thumb travelling, and the fields it reveals or hides SHALL appear and disappear at their final height
- a row appearing in or leaving the `upcoming-charges` card SHALL do so without animated movement
- after a drag is released, an expense row SHALL settle, slide out and collapse without animated movement
- toasts SHALL appear and disappear without movement
- entering and leaving reorder mode SHALL change the screen without animated movement, and a card moved by a drop, by a keyboard press or by a failed save SHALL appear in its new position rather than travel to it
- a held card SHALL still follow the pointer, because that movement is the user's own and not the interface's

Every state change SHALL still happen when motion is reduced; only the movement SHALL be dropped.

No dashboard element SHALL animate indefinitely in either motion setting.

Without the reduced-motion request:
- opening and closing an expense card or a summary panel SHALL animate its height
- the entry sheet, the category sheet and the definition sheet SHALL move in from below their resting position and leave the same way
- turning a switch on or off SHALL move its thumb over successive frames on an eased curve rather than a linear one, and its track colour SHALL change over that same movement rather than after it
- fields revealed or hidden by a switch SHALL animate their height, in place, and SHALL NOT displace anything above them or be overlaid on the content below
- a released expense row SHALL move to its resting position rather than jump to it
- a deleted row SHALL slide out and collapse over successive frames
- in reorder mode, a card displaced by the held one SHALL move aside over successive frames, a released card SHALL travel to its resting position over successive frames, and a card reverted by a failed save SHALL travel back rather than jump

Every one of these transitions SHALL run between 150 ms and 500 ms and SHALL use one of the project's easing tokens rather than a linear curve; the disclosures revealed by a switch SHALL run between 150 ms and 250 ms.

#### Scenario: Reduced motion
- **WHEN** reduced motion is emulated and `/demo` is loaded
- **THEN** every section is visible without scrolling it into view and has no transform applied
- **AND** opening the "comida" card shows its rows at full height immediately

#### Scenario: Reduced motion while editing
- **WHEN** reduced motion is emulated, the entry sheet is opened from the "comida" card and closed, and an expense row is then dragged 60px left and released
- **THEN** in the first frame after opening, the sheet is at its resting position
- **AND** in the first frame after release, the row is at its open position

#### Scenario: Reduced motion in the category sheet
- **WHEN** reduced motion is emulated and the category sheet is opened from the "comida" card
- **THEN** in the first frame after opening, the sheet is at its resting position
- **AND** selecting another colour and opening the delete confirmation each change state immediately, with no animated movement

#### Scenario: Reduced motion on a switch
- **WHEN** reduced motion is emulated and the recurrence switch is turned on in the entry sheet
- **THEN** in the first frame the switch is in its on state and the day field is at its full height
- **AND** the definition sheet, opened from "Próximos cobros", is at its resting position in the first frame

#### Scenario: Reduced motion in reorder mode
- **WHEN** reduced motion is emulated, reorder mode is entered, and "comida" is moved down one position with the keyboard
- **THEN** in the first frame after entering, the screen is already in its reorder appearance
- **AND** in the first frame after the key press, "comida" and the card it passed are each in their new position
- **AND** a card dragged with a pointer still follows that pointer

#### Scenario: No endless animation
- **WHEN** `/demo` is rendered for a cycle that is in progress
- **THEN** no running animation on the page has an infinite iteration count

#### Scenario: Animated disclosure
- **WHEN** motion is not reduced and the user opens the "comida" card
- **THEN** the card's height grows over successive frames before settling, rather than jumping to its final height

#### Scenario: Animated sheet and swipe
- **WHEN** motion is not reduced and the entry sheet opens
- **THEN** the panel's vertical position changes over successive frames, from below its resting position to it
- **AND** an expense row released after a 60px leftward drag reaches its open position over successive frames

#### Scenario: Animated category sheet
- **WHEN** motion is not reduced and the category sheet opens
- **THEN** the panel's vertical position changes over successive frames, from below its resting position to it
- **AND** swiping it down dismisses it

#### Scenario: Animated definition sheet
- **WHEN** motion is not reduced and a "Próximos cobros" row is activated
- **THEN** the panel's vertical position changes over successive frames, from below its resting position to it
- **AND** swiping it down dismisses it

#### Scenario: Animated switch
- **WHEN** motion is not reduced and the recurrence switch is turned on
- **THEN** the thumb's position changes over successive frames, on a non-linear easing, and the track's colour changes over those same frames
- **AND** the revealed day field's height grows over successive frames, in a transition between 150 ms and 250 ms
- **AND** the content above the switch stays at the same position throughout, and the content below it is pushed rather than covered

#### Scenario: Animated reorder
- **WHEN** motion is not reduced, reorder mode is on, and "comida" is dragged down over two cards and released
- **THEN** the cards it passes change position over successive frames while it is held
- **AND** after release it reaches its resting position over successive frames rather than jumping to it
