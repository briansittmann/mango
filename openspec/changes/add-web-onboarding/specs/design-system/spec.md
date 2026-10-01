## MODIFIED Requirements

### Requirement: Translucent materials
Translucent blurred materials SHALL be used only for navigation and transient controls:
- the pinned top bar once the page is scrolled
- the month picker
- the account sheet and the scrim behind it
- the entry sheet and the scrim behind it
- the category sheet and the scrim behind it
- the pushed-back layer of reorder mode, and only while that mode is on
- the onboarding's floating theme control and back control

These SHALL sit on opaque surfaces with no background blur:
- financial content: the free-margin card, the summary group, expense cards and charts, and the onboarding's free margin, envelope bar and lists
- notices
- an expense row being swiped, with its delete panel
- toasts
- the options control in a category card header
- every category card and drag handle while reorder mode is on

**The pushed-back layer** is the one case where financial content is blurred, and it is a transient mode rather than a resting state. Its blur SHALL be light and its dimming SHALL be the dominant cue, because the background it covers already carries a sheen that a heavy blur turns to mud. Nothing SHALL be drawn on top of it except the reorder bar, the category cards and their handles, all of which stay sharp and fully opaque.

Text on a translucent material SHALL keep at least 4.5:1 contrast against that material composited over the brightest and the darkest content that can scroll behind it. Where the operating system requests reduced transparency, these materials SHALL stay legible: the pushed-back layer SHALL then drop its blur and raise its dimming instead, so the separation between the list and the background is never carried by blur alone, and the onboarding's floating controls SHALL drop their blur and take an opaque surface.

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

#### Scenario: Onboarding materials
- **WHEN** `/demo/onboarding` is on its budgets step, in either theme
- **THEN** the theme control and the back control have a computed `backdrop-filter` other than `none`, and the free margin, the envelope bar and the category list each have `backdrop-filter: none` and an opaque background colour
- **AND** with reduced transparency requested, the theme control has `backdrop-filter: none` and an opaque background and its selected icon keeps at least 4.5:1 contrast
