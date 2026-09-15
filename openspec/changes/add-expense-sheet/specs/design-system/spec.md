## MODIFIED Requirements

### Requirement: Translucent materials
Translucent blurred materials SHALL be used only for navigation and transient controls:
- the pinned top bar once the page is scrolled
- the month picker
- the account sheet and the scrim behind it
- the entry sheet and the scrim behind it

These SHALL sit on opaque surfaces with no background blur:
- financial content: the free-margin card, the summary group, expense cards and charts
- notices
- an expense row being swiped, with its delete panel
- toasts

Text on a translucent material SHALL keep at least 4.5:1 contrast against that material composited over the brightest and the darkest content that can scroll behind it.

#### Scenario: Only navigation and controls blur
- **WHEN** `/demo` is scrolled halfway with the month picker open, separately when the account sheet is open, and separately when the entry sheet is open
- **THEN** every element with a computed `backdrop-filter` other than `none` is one of: the pinned top bar, the month picker, the account sheet or its scrim, the entry sheet or its scrim

#### Scenario: Content is opaque
- **WHEN** `/demo` is rendered in either theme, with an expense row swiped open and the undo toast shown
- **THEN** each of these has `backdrop-filter: none` and a fully opaque background colour: the free-margin card, the summary group, every expense card, both chart cards, the demo notice, the swiped row, its delete panel and the undo toast

#### Scenario: Legible pinned bar
- **WHEN** the pinned bar's material is composited over the current cycle's chart bar and over the page background, in both themes
- **THEN** the month title on the bar has at least 4.5:1 contrast in every case

#### Scenario: Legible entry sheet
- **WHEN** the entry sheet's material is composited over the expanded "comida" card, over the free-margin card and over the page background, in both themes
- **THEN** its title, caption, field labels, values, "Cancelar" and "Eliminar gasto" each have at least 4.5:1 contrast in every case

### Requirement: Motion respects user preference
When the operating system requests reduced motion:
- content SHALL appear in its final position without entrance movement
- disclosures, the month picker, the account sheet and the entry sheet SHALL open and close without animated movement
- after a drag is released, an expense row SHALL settle, slide out and collapse without animated movement
- toasts SHALL appear and disappear without movement

No dashboard element SHALL animate indefinitely in either motion setting.

Without the reduced-motion request:
- opening and closing an expense card or a summary panel SHALL animate its height
- the entry sheet SHALL move in from below its resting position and leave the same way
- a released expense row SHALL move to its resting position rather than jump to it
- a deleted row SHALL slide out and collapse over successive frames

#### Scenario: Reduced motion
- **WHEN** reduced motion is emulated and `/demo` is loaded
- **THEN** every section is visible without scrolling it into view and has no transform applied
- **AND** opening the "comida" card shows its rows at full height immediately

#### Scenario: Reduced motion while editing
- **WHEN** reduced motion is emulated, the entry sheet is opened from the "comida" card and closed, and an expense row is then dragged 60px left and released
- **THEN** in the first frame after opening, the sheet is at its resting position
- **AND** in the first frame after release, the row is at its open position

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
