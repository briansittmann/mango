## Purpose

Shared visual foundations every screen of the web app follows: the type hierarchy, the spacing rhythm, touch-target minimums, pressed/focus/selected states that do not rely on colour alone, where translucent materials may appear, and motion that respects the user's preference.

## ADDED Requirements

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
Translucent blurred materials SHALL be used only for navigation and transient controls: the pinned top bar once the page is scrolled, the month picker, the account sheet and the scrim behind the account sheet. Financial content (free-margin card, summary group, expense cards, charts) and notices SHALL sit on opaque surfaces with no background blur. Text on a translucent material SHALL keep at least 4.5:1 contrast against that material composited over the brightest and the darkest content that can scroll behind it.

#### Scenario: Only navigation and controls blur
- **WHEN** `/demo` is scrolled halfway with the month picker open, and separately when the account sheet is open
- **THEN** the only elements with a computed `backdrop-filter` other than `none` are the pinned top bar, the month picker, the account sheet and its scrim

#### Scenario: Content is opaque
- **WHEN** `/demo` is rendered in either theme
- **THEN** the free-margin card, the summary group, every expense card, both chart cards and the demo notice have `backdrop-filter: none` and fully opaque background colours

#### Scenario: Legible pinned bar
- **WHEN** the pinned bar's material is composited over the current cycle's chart bar and over the page background, in both themes
- **THEN** the month title on the bar has at least 4.5:1 contrast in every case

### Requirement: Motion respects user preference
When the operating system requests reduced motion:
- content SHALL appear in its final position without entrance movement
- disclosures, the month picker and the account sheet SHALL open and close without animated movement

No dashboard element SHALL animate indefinitely in either motion setting. Without the reduced-motion request, opening and closing an expense card or a summary panel SHALL animate its height.

#### Scenario: Reduced motion
- **WHEN** reduced motion is emulated and `/demo` is loaded
- **THEN** every section is visible without scrolling it into view and has no transform applied
- **AND** opening the "comida" card shows its rows at full height immediately

#### Scenario: No endless animation
- **WHEN** `/demo` is rendered for a cycle that is in progress
- **THEN** no running animation on the page has an infinite iteration count

#### Scenario: Animated disclosure
- **WHEN** motion is not reduced and the user opens the "comida" card
- **THEN** the card's height grows over successive frames before settling, rather than jumping to its final height
