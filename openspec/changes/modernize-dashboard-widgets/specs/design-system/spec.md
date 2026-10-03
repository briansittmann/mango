## ADDED Requirements

### Requirement: Wide viewports
At a viewport 1024px wide or wider the dashboard SHALL widen to a page column of at most 1120px, centred, with a gutter of at least 24px on both sides. Between 640px and 1023px it SHALL keep the 640px column and the 16px gutter. The top bar's content SHALL span the same column as the page, so the logo, the month controls and the avatar align with the page edges at every width. No bordered surface SHALL exceed the page column.

#### Scenario: Laptop width
- **WHEN** `/demo` is rendered at a 1280px-wide viewport
- **THEN** the page column is 1120px wide and centred, and the logo's left edge and the avatar's right edge align with the page column's left and right edges: the free-margin card's left edge and the widget column's right edge respectively

#### Scenario: Tablet width
- **WHEN** `/demo` is rendered at an 820px-wide viewport
- **THEN** the page column is 640px wide and centred, with every card inside it

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
- a progress bar SHALL be drawn at its final width, and the rows of a summary panel SHALL be at full opacity and in place in the first frame after the panel opens
- every chart mark — a bar, a donut slice, a sparkline, a heatmap cell, the hero's composition strip — SHALL be drawn at its final size and opacity in the first frame it is visible, and a tooltip SHALL appear and leave without movement
- a held card SHALL still follow the pointer, because that movement is the user's own and not the interface's

Every state change SHALL still happen when motion is reduced; only the movement SHALL be dropped.

No dashboard element SHALL animate indefinitely in either motion setting.

Without the reduced-motion request:
- opening and closing an expense card or a summary panel SHALL animate its height
- a progress bar SHALL grow from zero width to its value over successive frames the first time it is revealed, and SHALL NOT replay that growth on later openings of whatever contains it
- chart marks SHALL draw once, the first time their widget is revealed: bars grow from their baseline, donut slices sweep in, sparklines draw from left to right, heatmap cells and the composition strip fade in. The drawing SHALL finish within 900 ms, SHALL NOT replay on a later scroll, and SHALL NOT replay when a figure changes after an edit — a changed mark SHALL move from its previous size to its new one over at most 400 ms instead
- the rows of a summary panel SHALL enter one after another rather than all at once, and the whole sequence SHALL finish within the panel's own opening
- the entry sheet, the category sheet and the definition sheet SHALL move in from below their resting position and leave the same way
- turning a switch on or off SHALL move its thumb over successive frames on an eased curve rather than a linear one, and its track colour SHALL change over that same movement rather than after it
- fields revealed or hidden by a switch SHALL animate their height, in place, and SHALL NOT displace anything above them or be overlaid on the content below, in a transition between 150 ms and 250 ms that uses one of the project's easing tokens
- a released expense row SHALL move to its resting position rather than jump to it
- a deleted row SHALL slide out and collapse over successive frames
- in reorder mode, a card displaced by the held one SHALL move aside over successive frames, a released card SHALL travel to its resting position over successive frames, and a card reverted by a failed save SHALL travel back rather than jump

#### Scenario: Reduced motion
- **WHEN** reduced motion is emulated and `/demo` is loaded
- **THEN** every section is visible without scrolling it into view and has no transform applied
- **AND** opening the "comida" card shows its rows at full height immediately

#### Scenario: Reduced motion on the savings card
- **WHEN** reduced motion is emulated and `/demo` is loaded with a savings target supplied
- **THEN** in the first frame, the savings bar's fill is already at its final width
- **AND** in the first frame after the savings panel is opened, every movement row is at full opacity and in its final position

#### Scenario: Reduced motion on the charts
- **WHEN** reduced motion is emulated and `/demo` is scrolled to the chart widgets
- **THEN** in the first frame each is visible, every monthly bar, weekly bar, donut slice, sparkline and heatmap cell is at its final size and full opacity
- **AND** after an expense is added, the changed bar is at its new size in the first frame after the render

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
- **AND** the savings bar's fill and the check mark at its end are both at rest once the fill has finished

#### Scenario: Animated disclosure
- **WHEN** motion is not reduced and the user opens the "comida" card
- **THEN** the card's height grows over successive frames before settling, rather than jumping to its final height

#### Scenario: The savings bar fills once
- **WHEN** motion is not reduced and `/demo` is loaded with a savings target supplied
- **THEN** the bar's fill width changes over successive frames from zero to its value
- **AND** after opening and closing the savings panel, the fill stays at its value rather than growing again

#### Scenario: Chart marks draw once
- **WHEN** motion is not reduced and `/demo` is scrolled until the monthly spend chart and the weekly widget are revealed
- **THEN** their bars grow from the baseline over successive frames and are at rest within 900 ms
- **AND** scrolling away and back does not replay the growth
- **AND** after an expense of 20 € is added to "comida", the September bar and the week's "comida" bar move to their new size over successive frames without restarting from zero

#### Scenario: Staggered panel rows
- **WHEN** motion is not reduced and the savings panel is opened
- **THEN** the movement rows reach full opacity one after another rather than in the same frame
- **AND** every row has finished entering by the time the panel has finished opening

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
