# Design System Specification

## Purpose

Shared visual foundations every screen of the web app follows: the type hierarchy, the spacing rhythm, touch-target minimums, pressed/focus/selected states that do not rely on colour alone, where translucent materials may appear, and motion that respects the user's preference.

## Requirements

### Requirement: Type scale and hierarchy limits
Components SHALL set font size, line height and weight only through the named type scale, and SHALL NOT use arbitrary or framework-default font sizes. On the dashboard at a 390px-wide viewport, with every card and panel collapsed, visible text SHALL use no more than six distinct font sizes. No text on the dashboard, in the month picker or in the account sheet SHALL compute below 12px. Values, section titles and card titles SHALL NOT be set in uppercase tracked lettering.

#### Scenario: Six sizes at most
- **WHEN** `/demo` is rendered at a 390px-wide viewport with every card and panel collapsed, in Spanish and in English
- **THEN** the set of computed font sizes of all visible text has at most six members

#### Scenario: Minimum text size
- **WHEN** the month picker is open, and separately when the account sheet is open
- **THEN** no visible text computes below 12px

#### Scenario: No sizes outside the scale
- **WHEN** the component sources are searched for arbitrary font-size utilities (for example `text-[13px]`) and framework-default size utilities (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl` and larger)
- **THEN** no match is found

#### Scenario: Titles in sentence case
- **WHEN** the expenses section title, the summary labels and the chart titles are rendered
- **THEN** their computed `text-transform` is `none`

### Requirement: Spacing rhythm
Layout spacing SHALL come from named spacing values:
- a page gutter on both sides
- a section gap between top-level sections
- a stack gap between sibling surfaces within a section
- an inset for padding inside a surface

At a 390px-wide viewport the gutter SHALL be 16px, the section gap 32px, the stack gap 12px and the inset 16px.

#### Scenario: Page gutter
- **WHEN** `/demo` is rendered at a 390px-wide viewport
- **THEN** the free-margin card, the summary group, every expense card and both chart cards start 16px from the left edge of the viewport and end 16px from the right edge

#### Scenario: Section and stack gaps
- **WHEN** `/demo` is rendered at a 390px-wide viewport with every card collapsed
- **THEN** the vertical gap is 32px between the summary group and the expenses section title, and 32px between the last expense card and the first chart card
- **AND** it is 12px between the free-margin card and the summary group, and 12px between consecutive expense cards

### Requirement: Touch targets
Every interactive element SHALL have a hit area of at least 44 × 44 CSS pixels at a 390px-wide viewport. Every list row SHALL be at least 48px tall. A control's visible shape can be smaller than its hit area.

#### Scenario: Targets in every state
- **WHEN** `/demo` is rendered at a 390px-wide viewport in each of these states: all collapsed, scrolled with the compact bar showing, the income panel open, the "comida" card open, the month picker open, and the account sheet open
- **THEN** every visible button, link and radio control has a bounding box at least 44px wide and 44px tall

#### Scenario: Row height
- **WHEN** the "comida" card and the income panel are open
- **THEN** every expense row, summary row and add row is at least 48px tall

### Requirement: Interaction states
Every tappable surface and button SHALL show pressed feedback while a pointer is held down on it. It SHALL show a focus ring at least 2px wide in the ring colour when it receives keyboard focus, and no ring after a pointer click. An open, selected or current state SHALL be conveyed by at least one cue other than colour: shape, icon orientation, font weight or text. That state SHALL also be exposed to assistive technology as expanded, checked or current.

#### Scenario: Pressed feedback
- **WHEN** a pointer is held down on an expense card header
- **THEN** the header's computed scale or background differs from its resting state, and returns to the resting state after release

#### Scenario: Keyboard focus ring
- **WHEN** the user moves keyboard focus to the income column of the summary group
- **THEN** a ring at least 2px wide in the ring colour is visible around it
- **AND** after activating the same column with a pointer click, no ring is visible

#### Scenario: Open state not shown by colour alone
- **WHEN** the income column is open
- **THEN** it is exposed to assistive technology as expanded, its chevron points up, and an indicator mark is shown under it that closed columns do not have

### Requirement: Translucent materials
Translucent blurred materials SHALL be used only for navigation and transient controls:
- the pinned top bar once the page is scrolled
- the month picker
- the account sheet and the scrim behind it
- the entry sheet and the scrim behind it
- the category sheet and the scrim behind it
- the pushed-back layer of reorder mode, and only while that mode is on

These SHALL sit on opaque surfaces with no background blur:
- financial content: the free-margin card, the summary group, expense cards and charts
- notices
- an expense row being swiped, with its delete panel
- toasts
- the options control in a category card header
- every category card and drag handle while reorder mode is on

**The pushed-back layer** is the one case where financial content is blurred, and it is a transient mode rather than a resting state. Its blur SHALL be light and its dimming SHALL be the dominant cue, because the background it covers already carries a sheen that a heavy blur turns to mud. Nothing SHALL be drawn on top of it except the reorder bar, the category cards and their handles, all of which stay sharp and fully opaque.

Text on a translucent material SHALL keep at least 4.5:1 contrast against that material composited over the brightest and the darkest content that can scroll behind it. Where the operating system requests reduced transparency, these materials SHALL stay legible. The pushed-back layer SHALL then drop its blur and raise its dimming instead, so the separation between the list and the background is never carried by blur alone.

#### Scenario: Only navigation and controls blur
- **WHEN** `/demo` is scrolled halfway with the month picker open, separately when the account sheet is open, separately when the entry sheet is open, and separately when the category sheet is open
- **THEN** every element with a computed `backdrop-filter` other than `none` is one of: the pinned top bar, the month picker, the account sheet or its scrim, the entry sheet or its scrim, the category sheet or its scrim

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
- disclosures, the month picker, the account sheet, the entry sheet and the category sheet SHALL open and close without animated movement
- after a drag is released, an expense row SHALL settle, slide out and collapse without animated movement
- toasts SHALL appear and disappear without movement
- entering and leaving reorder mode SHALL change the screen without animated movement, and a card moved by a drop, by a keyboard press or by a failed save SHALL appear in its new position rather than travel to it
- a held card SHALL still follow the pointer, because that movement is the user's own and not the interface's

Every state change SHALL still happen when motion is reduced; only the movement SHALL be dropped.

No dashboard element SHALL animate indefinitely in either motion setting.

Without the reduced-motion request:
- opening and closing an expense card or a summary panel SHALL animate its height
- the entry sheet and the category sheet SHALL move in from below their resting position and leave the same way
- a released expense row SHALL move to its resting position rather than jump to it
- a deleted row SHALL slide out and collapse over successive frames
- in reorder mode, a card displaced by the held one SHALL move aside over successive frames, a released card SHALL travel to its resting position over successive frames, and a card reverted by a failed save SHALL travel back rather than jump

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

#### Scenario: Animated reorder
- **WHEN** motion is not reduced, reorder mode is on, and "comida" is dragged down over two cards and released
- **THEN** the cards it passes change position over successive frames while it is held
- **AND** after release it reaches its resting position over successive frames rather than jumping to it
