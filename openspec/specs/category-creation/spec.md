# Category Creation Specification

## Purpose

Lets people create a category from the dashboard itself, through a dashed tile at the end of the category list that reads as an empty slot rather than a category, and a create mode of the existing category sheet. The new category arrives collapsed, empty and last, and the tile becomes it in place rather than the list redrawing around a new card.

## Requirements

### Requirement: The "Añadir categoría" tile

The category list SHALL end with a tile that opens the category sheet in create mode. It SHALL sit after the last category card, inside the same list and with the same spacing between it and that card as between two cards, so it belongs to the list rather than floating below it.

**It reads as an empty slot, not a category.** It SHALL carry no colour dot, no amount, no chevron, no options control and no progress bar, and SHALL NOT be expandable.

**Appearance:**
- It SHALL have no solid surface: the page's background SHALL show through it, unlike a category card, which is an opaque panel.
- Its border SHALL be a hairline dashed stroke in a muted grey drawn from the existing border and muted tokens. Its corner radius SHALL equal a category card's.
- It SHALL be visibly shorter than a collapsed category card while keeping a hit area of at least 44px tall.
- A plus icon and the label SHALL be centred together on one row, horizontally and vertically. The label SHALL read "Añadir categoría" in Spanish and "Add category" in English.
- The brand lime SHALL NOT appear anywhere on the tile, at rest or in any state, that colour being reserved for the hero number, the active month and progress bars. For the same reason the tile is not an *Add action row* (`dashboard-ui`) and SHALL NOT be required to match one.

**Legibility at rest**, in both themes and with no pointer hovering, at a 390px-wide viewport:
- the label SHALL reach at least 4.5:1 against the page background
- the plus icon SHALL reach at least 3:1 against the page background
- the dashed border SHALL be visible against the page background rather than dissolving into it

The tile SHALL NOT be shown while reorder mode is on (`category-reordering` → *What reorder mode shows*), and SHALL be disabled when the mounting page supplies no category operations (`dashboard-ui` → *Controls without a handler are disabled*).

#### Scenario: Last in the list, and not a card

- **WHEN** `/demo` is rendered in Spanish at a 390 × 844 viewport
- **THEN** a control labelled "Añadir categoría" is the last child of the category list, after the "Compras" card
- **AND** the gap between it and that card equals the gap between two category cards
- **AND** it shows no colour dot, no amount and no chevron, and is not exposed as expandable

#### Scenario: A hole, not a panel

- **WHEN** the tile is rendered in the light theme and then in the dark theme
- **THEN** its background is transparent while a category card's is opaque
- **AND** its border style is dashed while a category card's is solid, and both have the same corner radius
- **AND** its height is smaller than a collapsed category card's and at least 44px

#### Scenario: Legible without hover

- **WHEN** the tile is rendered at a 390px-wide viewport with no pointer over it, in the light theme and then in the dark theme
- **THEN** its label reaches at least 4.5:1 and its plus icon at least 3:1 against the page background
- **AND** its border colour differs measurably from the page background behind it

#### Scenario: The label follows the language

- **WHEN** `/demo` is rendered in English
- **THEN** the tile reads "Add category"

#### Scenario: No lime on the tile

- **WHEN** the tile is rendered at rest, hovered and held down, in either theme
- **THEN** neither its label, its icon, its border nor its background is the brand lime in any of those states

### Requirement: Tile interaction and motion

The tile SHALL behave as a single button: one hit target, one accessible name, reachable by pointer, by touch and by keyboard.

**Hover** SHALL apply only on devices whose primary pointer can hover, while the pointer is over the tile. Within about 200ms the border SHALL gain contrast, a faint surface SHALL fade in behind it, and the plus SHALL rotate 90°. Leaving SHALL return all three to rest over the same duration. On a device that cannot hover, no hover appearance SHALL remain after a tap.

**Pressed:** while a pointer is held down the tile SHALL scale to about 0.98 and SHALL spring back on release.

**Focus:** keyboard focus SHALL show a ring per `design-system` → *Interaction states*.

**Activation** by tap, click, Enter or Space SHALL open the category sheet in create mode.

**Reduced motion:** when the user prefers reduced motion, the hover border and surface SHALL still change, the plus SHALL NOT rotate, and the tile SHALL NOT scale on press. Every state change SHALL still happen; only the movement SHALL be dropped.

#### Scenario: Hover lights the tile

- **WHEN** a mouse pointer moves over the tile
- **THEN** its border colour has more contrast against the background than at rest, a background tint is present that was absent at rest, and its plus is rotated about 90°
- **AND** after the pointer leaves, all three return to their rest values

#### Scenario: Touch leaves nothing behind

- **WHEN** a touch device that cannot hover taps the tile and the sheet is then dismissed
- **THEN** the tile shows its rest border, no background tint, an unrotated plus and a scale of 1

#### Scenario: Pressed feedback

- **WHEN** a pointer is held down on the tile
- **THEN** its computed scale is below 1, and it returns to 1 after release

#### Scenario: Keyboard reaches and activates it

- **WHEN** the user tabs forward from the last category card's options control
- **THEN** focus reaches the tile and a focus ring at least 2px wide is visible
- **AND** pressing Enter opens the category sheet in create mode

#### Scenario: Reduced motion on the tile

- **WHEN** reduced motion is emulated and a pointer hovers the tile and is then held down
- **THEN** the border and background tint change as they do otherwise
- **AND** the plus is not rotated and the tile's scale stays 1

### Requirement: Category creation goes through an injected operation

The page that mounts the dashboard SHALL supply creation as one more injected operation, **create**, alongside those the `category-editing` and `category-reordering` capabilities describe. Every data source SHALL provide it with the same inputs and outcomes.

- It SHALL take the same name, colour and budget a saved category form produces, and no other input.
- It SHALL complete asynchronously and then either succeed or fail. On success it SHALL resolve with the new category's identifier, so the caller can tell the new card apart from the others. A failed create SHALL leave the data unchanged and SHALL create nothing.
- A name already used by another of the user's categories SHALL be rejected, and that rejection SHALL be distinguishable by the caller from every other failure — the same distinguishable rejection update uses.
- The created category SHALL have no expenses, a total of 0, and a stored order placing it after every existing category. It SHALL have a budget only when the form supplied one, and that budget SHALL belong to the current cycle only (`category-editing` → *Budgets belong to one cycle*).
- Creating a category SHALL NOT change any other category, any expense or the expenses total. It SHALL move the free margin only through its budget: a category created with a budget SHALL lower the free margin by that budget (`category-editing` → *A budget reserves its amount in the free margin*), and one created without a budget SHALL leave it unchanged.

Dashboard components SHALL create categories only through this operation.

#### Scenario: Same operation on another data source

- **WHEN** the dashboard is mounted with an implementation of the category operations that records its calls instead of the demo's
- **AND** the visitor creates a category named "Viajes" in `celeste` with no budget
- **THEN** the recorder receives create with that name, that colour and no budget, and no other call
- **AND** no dashboard component needed a change for that data source

#### Scenario: Creating changes no other figure

- **WHEN** on `/demo` in Spanish, with the expenses total at 1.700 € and the free margin at 864 €, the visitor creates "Viajes" with no budget
- **THEN** the expenses total still shows 1.700 € and the free margin still shows 864 €
- **AND** every existing card keeps its name, colour, total and budget

#### Scenario: Creating with a budget reserves it

- **WHEN** on `/demo` in Spanish, with the free margin at 864 €, the visitor creates "Viajes" with a budget of 200
- **THEN** the "Viajes" card shows 0 € of 200 € and the free margin shows 664 €
- **AND** the expenses total still shows 1.700 €, and every existing card keeps its name, colour, total and budget

#### Scenario: A failed create leaves nothing behind

- **WHEN** the injected create rejects
- **THEN** no new card is listed, the category list ends with the same card it did before, and the tile is still present

### Requirement: The category sheet's create mode

Activating the tile SHALL open the category sheet in a create mode on the same surface, with the same panel, geometry, sizes and dismissal behaviour the `category-editing` capability specifies for it.

**Header:** the title SHALL be the sheet's create-mode title rather than a category's name, and SHALL show the colour dot of the colour currently selected in the picker. The leading action SHALL be "Cancelar". The primary action SHALL read "Añadir" in Spanish and "Add" in English.

**Body**, in this order: the name field, the budget field, the colour picker. Create mode SHALL NOT show the "Reordenar" row, the "Eliminar categoría" row or the progress-bar toggle, because none of them can act on a category that does not exist yet.

**Initial values:**
- The name field SHALL be empty and SHALL hold keyboard focus when the sheet opens, with the virtual keyboard raised on a device that has one.
- The budget field SHALL be empty, and SHALL be optional exactly as it is when editing.
- The colour picker SHALL offer the same swatches, in the same order, that it offers when editing. The preselected swatch SHALL be the first colour in that order that no existing category uses. When every colour is in use, the first colour in the order SHALL be preselected.

**Validation:**
- While the name is empty or holds only whitespace, the primary action SHALL be disabled.
- While the budget holds an invalid amount, the primary action SHALL be disabled, by the same rule editing uses.
- A name that matches an existing category's name, compared after trimming and ignoring case, SHALL report in place next to the field, SHALL keep what was typed, and SHALL be exposed to assistive technology. It SHALL NOT be reported as a toast.

**Saving, busy and failure** SHALL follow the same rules as editing: the sheet SHALL NOT close while the create is in flight, the primary action SHALL show a progress indicator, the form SHALL be exposed as busy, and a failure SHALL keep the sheet open with every typed value intact and an alert at the top of the form.

**On close**, whether the category was created or the sheet was dismissed, keyboard focus SHALL return to the tile.

#### Scenario: Create mode opens empty and focused

- **WHEN** the visitor activates the tile on `/demo` in Spanish
- **THEN** the sheet opens with an empty name field holding keyboard focus, an empty budget field, and the primary action reading "Añadir"
- **AND** its body shows the name field, the budget field and the colour picker, and no "Reordenar" row, no "Eliminar categoría" row and no progress-bar toggle

#### Scenario: The preselected colour is the first one free

- **WHEN** the visitor opens create mode on `/demo`, where the seven categories use `gris_oscuro`, `verde_profundo`, `gris_calido`, `naranja_calido`, `violeta_metalico`, `azul_apagado` and `granate`
- **THEN** the selected swatch is `rojo`, the first colour in the picker's order that none of them uses
- **AND** the dot beside the title shows that colour

#### Scenario: The primary action waits for a name

- **WHEN** create mode is open with an empty name field
- **THEN** the primary action is disabled
- **AND** typing only spaces leaves it disabled, and typing "Viajes" enables it

#### Scenario: A duplicate name reports in place

- **WHEN** the visitor types "  comida  " into the name field of create mode and activates "Añadir"
- **THEN** the sheet stays open with "  comida  " still in the field, and a message next to the field says the name is already used
- **AND** the message is exposed to assistive technology, no toast is shown, and no new card is listed

#### Scenario: A failed create keeps the typed values

- **WHEN** the injected create fails after the visitor has typed a name, chosen a colour and typed a budget
- **THEN** the sheet stays open with all three intact, an alert at the top of the form says the change could not be saved, and the primary action can be activated again

#### Scenario: Dismissing returns focus to the tile

- **WHEN** create mode is opened from the tile with the keyboard and closed with Escape
- **THEN** no category is created and keyboard focus is on the tile

### Requirement: The new category lands at the end, collapsed

On a successful create the sheet SHALL close, announce the change to assistive technology, and the new category SHALL appear as the last card of the list, immediately before the tile.

The new card SHALL be collapsed, SHALL show its colour dot, its name and a total of 0 in the user's currency, and SHALL carry an options control like every other card. It SHALL show a progress bar only when a budget was supplied. Its position SHALL persist as the stored order's last place, so leaving and re-entering reorder mode does not move it.

**The tile becomes the card.** Without a reduced-motion request, the transition SHALL be continuous rather than a redraw:
- the new card SHALL begin where the tile was, at the tile's size, and grow into its own — the dashed border resolving to solid, the surface filling in, the dot and the name appearing — so the tile reads as having become the card rather than being pushed aside by it
- a fresh tile SHALL then arrive below the new card
- every other card SHALL hold its position on screen throughout, with no jump at the moment the list gains a row

**With a reduced-motion request**, the new card and the fresh tile SHALL appear directly in their final positions, with no transform and no travel. The states SHALL still be the same ones; only the movement SHALL be dropped.

#### Scenario: The new card is last, collapsed and empty

- **WHEN** the visitor creates "Viajes" in `rojo` with no budget on `/demo` in Spanish
- **THEN** the sheet closes and a "Viajes" card is the last card of the list, followed by the tile
- **AND** it is collapsed, shows a `rojo` dot, the name "Viajes" and 0 €, shows no progress bar, and has an options control

#### Scenario: A budget given at creation shows its bar

- **WHEN** the visitor creates "Viajes" with a budget of 200
- **THEN** the "Viajes" card shows 0 € of 200 € and a progress bar at zero

#### Scenario: The list does not jump

- **WHEN** the visitor creates a category with the "Comida" card scrolled into view and reduced motion not requested
- **THEN** the "Comida" card's position on screen at the frame the new card first exists is the same as it was in the frame before
- **AND** in that frame the new card's box coincides with the box the tile occupied, and the tile is below it rather than above it

#### Scenario: Reduced motion creates without movement

- **WHEN** reduced motion is emulated and the visitor creates "Viajes"
- **THEN** in the first frame after the sheet closes, the "Viajes" card and the tile are both at their final positions with no transform applied

#### Scenario: The new order survives reorder mode

- **WHEN** the visitor creates "Viajes", then enters reorder mode and leaves it without dragging anything
- **THEN** "Viajes" is still the last card, and the tile is still absent during the mode and present after it
