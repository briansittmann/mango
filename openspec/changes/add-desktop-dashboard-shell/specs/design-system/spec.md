## MODIFIED Requirements

### Requirement: Translucent materials
Translucent blurred materials SHALL be used only for navigation and transient controls:
- the pinned top bar once the page is scrolled
- at 1024px and wider, the sidebar and the top bar once the page is scrolled (the floating shell of `desktop-shell`), and never while static at the top of the page
- the month picker
- the account sheet and the scrim behind it
- the entry sheet and the scrim behind it
- the category sheet and the scrim behind it
- at 1024px and wider, every side panel and the scrim behind it
- the pushed-back layer of reorder mode, and only while that mode is on

These SHALL sit on opaque surfaces with no background blur:
- financial content: the free-margin card, the summary group and the stat tiles, expense cards and charts
- notices
- an expense row being swiped, with its delete panel
- toasts
- the options control in a category card header
- every category card and drag handle while reorder mode is on

**No two translucent materials SHALL overlap**: while a side panel or the reorder mode's layer is open over the floating shell, the shell SHALL drop its blur and keep an opaque-enough surface.

**The pushed-back layer** is the one case where financial content is blurred, and it is a transient mode rather than a resting state. Its blur SHALL be light and its dimming SHALL be the dominant cue, because the background it covers already carries a sheen that a heavy blur turns to mud. Nothing SHALL be drawn on top of it except the reorder bar, the category cards and their handles, all of which stay sharp and fully opaque.

Text on a translucent material SHALL keep at least 4.5:1 contrast against that material composited over the brightest and the darkest content that can scroll behind it. Where the operating system requests reduced transparency, these materials SHALL stay legible. The pushed-back layer SHALL then drop its blur and raise its dimming instead, so the separation between the list and the background is never carried by blur alone.

#### Scenario: Only navigation and controls blur
- **WHEN** `/demo` is scrolled halfway with the month picker open, separately when the account sheet is open, separately when the entry sheet is open, and separately when the category sheet is open
- **THEN** every element with a computed `backdrop-filter` other than `none` is one of: the pinned top bar, the month picker, the account sheet or its scrim, the entry sheet or its scrim, the category sheet or its scrim

#### Scenario: Only the shell blurs on a laptop
- **WHEN** `/demo` at 1280px is scrolled by 200px with nothing open
- **THEN** every element with a computed `backdrop-filter` other than `none` is the sidebar or the top bar
- **AND** at the top of the page, with nothing open, no element has a `backdrop-filter` other than `none`

#### Scenario: The shell yields to a side panel
- **WHEN** `/demo` at 1280px is scrolled by 200px and the entry sheet is opened
- **THEN** every element with a computed `backdrop-filter` other than `none` is the side panel or its scrim

#### Scenario: Content is opaque
- **WHEN** `/demo` is rendered in either theme, with an expense row swiped open and the undo toast shown
- **THEN** each of these has `backdrop-filter: none` and a fully opaque background colour: the free-margin card, the summary group, every expense card, both chart cards, the demo notice, the swiped row, its delete panel and the undo toast

#### Scenario: Legible pinned bar
- **WHEN** the pinned bar's material is composited over the current cycle's chart bar and over the page background, in both themes
- **THEN** the month title on the bar has at least 4.5:1 contrast in every case

#### Scenario: Legible entry sheet
- **WHEN** the entry sheet's material is composited over the expanded "comida" card, over the free-margin card and over the page background, in both themes
- **THEN** its title, caption, field labels, values, "Cancelar" and "Eliminar gasto" each have at least 4.5:1 contrast in every case

#### Scenario: Legible category sheet
- **WHEN** the category sheet's material is composited over the expanded "comida" card, over the free-margin card and over the page background, in both themes
- **THEN** its title, caption, field labels, values, colour names, "Cancelar", "Reordenar" and "Eliminar categoría" each have at least 4.5:1 contrast in every case
- **AND** each colour swatch stays distinguishable from the sheet behind it

#### Scenario: The pushed-back layer is light on blur and firm on dimming
- **WHEN** reorder mode is on, in both themes
- **THEN** the pushed-back layer's blur radius is at most 8px and its content is dimmed to at most 40% of its resting opacity
- **AND** the category cards, their handles and the reorder bar each have `backdrop-filter: none`, full opacity and at least 4.5:1 contrast for their text against what sits behind them

#### Scenario: Reduced transparency in reorder mode
- **WHEN** reduced transparency is requested by the operating system and reorder mode is on
- **THEN** the pushed-back layer has no blur, and its content is dimmed further than it is without that request
- **AND** each category name and the "Listo" control still have at least 4.5:1 contrast

### Requirement: Motion respects user preference
When the operating system requests reduced motion:
- content SHALL appear in its final position without entrance movement
- disclosures, the month picker, the account sheet, the entry sheet, the category sheet and the definition sheet SHALL open and close without animated movement; a side panel SHALL appear at and leave from its resting position
- the sidebar and the top bar SHALL switch between their static and floating appearance immediately, and the sidebar's current-entry highlight SHALL appear on the new entry rather than travel to it
- a switch SHALL change state without its thumb travelling, and the fields it reveals or hides SHALL appear and disappear at their final height
- a row appearing in or leaving the `upcoming-charges` card SHALL do so without animated movement
- after a drag is released, an expense row SHALL settle, slide out and collapse without animated movement
- toasts SHALL appear and disappear without movement
- entering and leaving reorder mode SHALL change the screen without animated movement, and a card moved by a drop, by a keyboard press or by a failed save SHALL appear in its new position rather than travel to it
- a widget moved by a drop, by a keyboard press or by a failed save SHALL appear in its new position, and the widgets it passes SHALL appear in theirs
- a progress bar SHALL be drawn at its final width, and the rows of a summary panel SHALL be at full opacity and in place in the first frame after the panel opens
- every chart mark — a bar, a donut slice, a sparkline, a heatmap cell, the hero's composition strip — SHALL be drawn at its final size and opacity in the first frame it is visible, and a tooltip SHALL appear and leave without movement
- a held card or widget SHALL still follow the pointer, because that movement is the user's own and not the interface's

Every state change SHALL still happen when motion is reduced; only the movement SHALL be dropped.

No dashboard element SHALL animate indefinitely in either motion setting.

Without the reduced-motion request:
- opening and closing an expense card or a summary panel SHALL animate its height
- a progress bar SHALL grow from zero width to its value over successive frames the first time it is revealed, and SHALL NOT replay that growth on later openings of whatever contains it
- chart marks SHALL draw once, the first time their widget is revealed: bars grow from their baseline, donut slices sweep in, sparklines draw from left to right, heatmap cells and the composition strip fade in. The drawing SHALL finish within 900 ms, SHALL NOT replay on a later scroll, and SHALL NOT replay when a figure changes after an edit — a changed mark SHALL move from its previous size to its new one over at most 400 ms instead
- the rows of a summary panel SHALL enter one after another rather than all at once, and the whole sequence SHALL finish within the panel's own opening
- the entry sheet, the category sheet and the definition sheet SHALL move in from below their resting position and leave the same way; at 1024px and wider every side panel SHALL move in from beyond the right edge over 300 ms to 450 ms and leave faster than it entered
- the sidebar and the top bar SHALL change between static and floating over 300 ms to 450 ms, changing their material, corners and shadow only — nothing inside them SHALL move — and a scroll reversed mid-way SHALL retarget the change rather than restart it
- the sidebar's current-entry highlight SHALL travel from the previous entry to the new one over at most 250 ms
- turning a switch on or off SHALL move its thumb over successive frames on an eased curve rather than a linear one, and its track colour SHALL change over that same movement rather than after it
- fields revealed or hidden by a switch SHALL animate their height, in place, and SHALL NOT displace anything above them or be overlaid on the content below, in a transition between 150 ms and 250 ms that uses one of the project's easing tokens
- a released expense row SHALL move to its resting position rather than jump to it
- a deleted row SHALL slide out and collapse over successive frames
- in reorder mode, a card displaced by the held one SHALL move aside over successive frames, a released card SHALL travel to its resting position over successive frames, and a card reverted by a failed save SHALL travel back rather than jump
- a widget displaced by the held one SHALL move aside over successive frames, a released widget SHALL settle into place over successive frames, and a widget reverted by a failed save SHALL travel back rather than jump

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

#### Scenario: Reduced motion on the shell
- **WHEN** reduced motion is emulated, `/demo` is at 1280px and the page is scrolled by 200px, then the "ocio" entry is activated
- **THEN** in the first frame after the scroll the sidebar and top bar are in their floating appearance with no transition running
- **AND** in the first frame after the activation the highlight is on "ocio"
- **AND** the category sheet, opened from the "ocio" card, is at its resting position in the first frame

#### Scenario: Reduced motion on the widget list
- **WHEN** reduced motion is emulated, `/demo` is at 1280px, and the calendar widget is moved down one position with the keyboard
- **THEN** in the first frame after the key press the calendar and the widget it passed are each in their new position
- **AND** a widget dragged by its grip still follows the pointer

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
- **WHEN** motion is not reduced and the entry sheet opens at a 390px-wide viewport
- **THEN** the panel's vertical position changes over successive frames, from below its resting position to it
- **AND** an expense row released after a 60px leftward drag reaches its open position over successive frames

#### Scenario: Animated side panel
- **WHEN** motion is not reduced and the entry sheet opens at a 1280px-wide viewport
- **THEN** the panel's horizontal position changes over successive frames, from beyond the right edge to its resting position, settling within 450 ms
- **AND** closing it takes less time than opening it did

#### Scenario: Animated shell
- **WHEN** motion is not reduced, `/demo` is at 1280px and the page is scrolled by 200px
- **THEN** the sidebar's corner radius and shadow change over successive frames and settle within 450 ms, while the month name's position within the top bar is the same in every frame
- **AND** scrolling back to 0 before the change has settled reverses it from where it was rather than from the floating end state

#### Scenario: Animated widget reorder
- **WHEN** motion is not reduced, `/demo` is at 1280px, and the donut is dragged by its grip above the first widget and released
- **THEN** the widgets it passes change position over successive frames while it is held
- **AND** after release it reaches its resting position over successive frames rather than jumping to it

#### Scenario: Animated category sheet
- **WHEN** motion is not reduced and the category sheet opens at a 390px-wide viewport
- **THEN** the panel's vertical position changes over successive frames, from below its resting position to it
- **AND** swiping it down dismisses it

#### Scenario: Animated definition sheet
- **WHEN** motion is not reduced and a "Próximos cobros" row is activated at a 390px-wide viewport
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
