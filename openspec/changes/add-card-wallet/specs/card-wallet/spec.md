## Purpose

Lets a user name the cards their fixed charges are paid with, and see how much each card carries in the shown cycle, without storing any card number or other sensitive data.

## ADDED Requirements

### Requirement: A card is a name and a colour

A user SHALL hold any number of cards, zero included. A card SHALL carry exactly a name (trimmed, 1 to 30 characters) and a colour from the categories' palette, and SHALL belong to one user. A card SHALL NOT carry a card number, any digits of it, an expiry date, a security code, a holder name, a bank or a network, and no surface SHALL ask for any of them.

Two cards of the same user SHALL NOT have names that are equal ignoring case and surrounding spaces; saving such a name SHALL fail with a message under the name field ("Ya tienes una tarjeta con ese nombre") and change nothing. Different users MAY have cards with the same name.

A user SHALL only read and change their own cards, whatever the client: a request on behalf of one user SHALL NOT read, change or reference another user's card. Deleting the account SHALL delete its cards.

#### Scenario: Creating a card
- **WHEN** the user creates a card named " Visa " with the colour "azul_electrico"
- **THEN** the wallet shows a card named "Visa" in that colour, and it is still there after a reload

#### Scenario: A repeated name is refused
- **WHEN** the user holds a card "Visa" and saves a new card named "visa"
- **THEN** the sheet stays open with "Ya tienes una tarjeta con ese nombre" under the name, and the user still holds one card

#### Scenario: Another user's card cannot be referenced
- **WHEN** a request signed in as one user tries to read another user's card, or to set another user's card on one of its own fixed charges
- **THEN** no row is returned and the write is rejected, with nothing changed

### Requirement: Cards go through injected operations

The page that mounts the dashboard SHALL supply changes to cards as operations, with the same inputs and outcomes in every data source (the demo in memory, the real one in the database):

- **create:** a name and a colour
- **update:** a card's new name and colour
- **delete:** removes the card; every fixed charge assigned to it is left with no card, and nothing else changes
- **set fixed charges:** a card and the full list of fixed expenses it carries; afterwards exactly those carry it — each listed one moves to it from whatever card it had, and each one that carried it and is not listed is left with no card — in one step that either fully happens or not at all

Each operation SHALL complete asynchronously and then either succeed or fail. A failed operation SHALL leave the data unchanged, keep the sheet open with its values, and show an error message. Without these operations (a mount that supplies none) the wallet SHALL show the cards read-only, with no "Añadir tarjeta".

#### Scenario: A failed save changes nothing
- **WHEN** the injected update fails while renaming "Débito" to "Cuenta sueldo"
- **THEN** the sheet stays open with "Cuenta sueldo" typed and an error message, and the wallet still shows "Débito"

#### Scenario: The checklist saves in one step
- **WHEN** the card sheet of "Crédito" is saved with "Parking" ticked and "Gimnasio" unticked
- **THEN** the data source receives one set fixed charges call for "Crédito" whose list holds "Parking" and "Seguro" and not "Gimnasio"

### Requirement: Deleting a card frees its fixed charges

Deleting a card SHALL NOT be blocked by the fixed charges assigned to it. The card sheet's delete action SHALL ask for confirmation first; when the card carries fixed charges the confirmation SHALL say how many (by name for one or two, "Gimnasio y Seguro quedan sin tarjeta", and as a count from three on, "3 gastos fijos quedan sin tarjeta"). On confirmation the card SHALL be removed and those fixed charges SHALL be left with no card; their amounts, days, categories, charges and every other field SHALL NOT change. There SHALL be no undo.

#### Scenario: Deleting a card with fixed charges
- **WHEN** the user deletes "Crédito", which carries "Gimnasio" and "Seguro", and confirms
- **THEN** the wallet no longer shows "Crédito", the sheets of "Gimnasio" and "Seguro" show "Sin tarjeta", and both still show their amounts and days in "Próximos cobros"

#### Scenario: Cancelling keeps the card
- **WHEN** the user opens the delete confirmation of "Crédito" and cancels
- **THEN** "Crédito" and its two fixed charges are unchanged

### Requirement: The "Tarjetas" widget

The dashboard SHALL show a widget titled "Tarjetas" among the chart widgets, in the user's widget order, reorderable like the others where they are. A user whose stored order predates it SHALL see it last. It SHALL also show in a projected cycle, where the other widgets but the distribution donut are hidden.

The widget SHALL show the user's cards as a stack of card faces in creation order, the newest last, each overlapping the one above so that the top band of every card stays visible and the last one is seen whole. The top band of each card SHALL hold its name and its committed total; the card seen whole SHALL also show how many fixed charges make up its total ("2 gastos fijos"). Text on a card face SHALL reach a contrast of 4.5:1 against the face in both themes, whatever the colour.

Each card SHALL be a button, named by its name and committed total, that opens its card sheet. Below the stack, an "Añadir tarjeta" row SHALL open the card sheet empty. A user with no cards SHALL see an outlined, empty card shape with one line ("Anota con qué tarjeta se paga cada fijo") and the "Añadir tarjeta" row.

#### Scenario: Wallet on the demo
- **WHEN** a visitor opens `/demo`
- **THEN** the "Tarjetas" widget shows "Débito" and then "Crédito", each with its committed total, and "Crédito" seen whole with "2 gastos fijos"

#### Scenario: Opening a card
- **WHEN** the visitor activates "Débito" in the wallet, by pointer or by keyboard
- **THEN** the card sheet opens titled "Débito"

#### Scenario: No cards
- **WHEN** the user holds no cards
- **THEN** the widget shows the empty card shape, its line, and "Añadir tarjeta"

#### Scenario: Existing widget orders
- **WHEN** a user whose stored widget order names the four chart widgets opens the dashboard
- **THEN** "Tarjetas" is shown after them, and moving it saves an order of five

### Requirement: A card's committed total

A card's committed total SHALL be the sum of the amounts of the shown cycle's fixed expense rows whose definition carries that card: rows already charged, rows pending, and in a projected cycle the projected charges, each at its own amount in that cycle (an amount changed "solo este mes" counts as changed). A row deleted for that cycle SHALL NOT count. Fixed income SHALL NOT count, and one-off expenses SHALL NOT count. The total SHALL follow the cycle shown, and SHALL update without a reload after any change to a fixed charge, a card or an assignment.

The count SHALL be the number of such rows. A card with none SHALL show "0 €" and "Sin gastos fijos".

#### Scenario: Totals follow the shown cycle
- **WHEN** "Crédito" carries "Gimnasio" and "Seguro" and the user moves to a projected cycle where "Seguro" has ended
- **THEN** "Crédito" shows only the projected amount of "Gimnasio", and "1 gasto fijo"

#### Scenario: A this-month change counts
- **WHEN** the user changes this month's "Gimnasio" from 40 € to 55 € with "Solo este mes"
- **THEN** "Crédito" grows by 15 € in this cycle and not in the next one

#### Scenario: Assigning updates the total
- **WHEN** the user assigns "Parking" (50 €) to "Débito" from the sheet of "Parking"
- **THEN** after saving, "Débito" grows by "Parking"'s amount in the shown cycle without a reload

### Requirement: The card sheet

The card sheet SHALL open titled "Nueva tarjeta" when empty or with the card's name when editing, and SHALL hold:

- a live preview of the card face with the typed name and the chosen colour;
- a name field and the colour picker the category sheet uses;
- "Gastos fijos": every active fixed expense of the user, ordered by day of the month, each with its name, amount, and a check that is on when it carries this card. A fixed expense carrying another card SHALL say which ("En Débito") on a muted line; checking it SHALL move it here. With no active fixed expense the section SHALL say so in one line and hold no checks;
- "Guardar", enabled once the name is valid and something changed, which saves the name and colour, then the checklist when it changed, and closes the sheet;
- when editing, "Eliminar tarjeta", below a divider, with the confirmation of *Deleting a card frees its fixed charges*.

A new card SHALL get the first colour of the palette no other card of the user uses (the first colour when all are used). Opening, closing and the confirmation step SHALL follow the motion and placement of the other sheets (a side panel at `lg`, a bottom sheet below), and nothing in the sheet SHALL move under reduced motion beyond what those sheets do.

#### Scenario: Creating a card with its fixed charges
- **WHEN** the visitor taps "Añadir tarjeta", types "Revolut", ticks "Parking" and "Limpieza" and saves
- **THEN** the wallet shows "Revolut" with the September total of "Parking" and "Limpieza" and "2 gastos fijos"

#### Scenario: Moving a fixed charge between cards
- **WHEN** the visitor opens "Crédito", ticks "Alquiler" (muted line "En Débito") and saves
- **THEN** "Alquiler" counts in "Crédito" and no longer in "Débito"

#### Scenario: Unticking leaves no card
- **WHEN** the visitor opens "Crédito", unticks "Seguro" and saves
- **THEN** the sheet of "Seguro" shows "Sin tarjeta" and "Crédito" counts "1 gasto fijo"

#### Scenario: Fixed income is not listed
- **WHEN** the visitor opens any card sheet on `/demo`
- **THEN** "Gastos fijos" lists the fixed expenses and not "Salario"

### Requirement: The card face

A card face SHALL be drawn with CSS, without images, in the proportions of a payment card (about 1.586:1): a gradient derived from the card's colour, deep enough that its text passes the contrast rule in both themes, a sheen across it, and a layered shadow. With a fine pointer that can hover, hovering a card SHALL lift it and tilt it slightly in 3D (at most 8 degrees on any axis) within 250 ms, and leaving SHALL return it. On a touch screen there SHALL be no hover state; instead, sliding a finger sideways across a card SHALL tilt it around its vertical axis in the direction of the slide, following the finger up to 8 degrees, with the sheen moving with it, and releasing SHALL spring it back flat. A vertical slide over a card SHALL scroll the page as anywhere else, and a sideways slide SHALL NOT open the card's sheet; a tap SHALL. Pressing a card SHALL scale it down as other pressable cards do. Under reduced motion there SHALL be no tilt or lift, by mouse or by finger. No card face SHALL use a blur.

#### Scenario: Hover tilt with a mouse
- **WHEN** at 1280px a mouse rests on "Débito"
- **THEN** the card is lifted and rotated by a non-zero angle of at most 8 degrees, and returns flat when the mouse leaves

#### Scenario: Tilt with a finger
- **WHEN** on a 390px touch screen the visitor slides a finger 80px to the right across "Débito" without lifting it
- **THEN** the card is rotated around its vertical axis towards the right by a non-zero angle of at most 8 degrees and has not moved in the stack; on release it returns flat and its sheet stays closed

#### Scenario: Vertical slide scrolls
- **WHEN** on a touch screen the visitor slides a finger upwards starting on "Débito"
- **THEN** the page scrolls and the card does not tilt

#### Scenario: Reduced motion
- **WHEN** the visitor prefers reduced motion and hovers "Débito", or slides a finger across it on a touch screen
- **THEN** the card's transform is unchanged

#### Scenario: Contrast in every colour
- **WHEN** a card is shown in each palette colour, in the light and the dark theme
- **THEN** its name and total reach at least 4.5:1 against the face

### Requirement: The demo's cards stay in memory

`/demo` SHALL start with two cards: "Débito" (`azul_apagado`) carrying "Alquiler" and "Internet", and "Crédito" (`violeta_metalico`) carrying "Gimnasio" and "Seguro" ("Debit" and "Credit" in English). Every card operation SHALL work on `/demo` in memory, without a request to the database, and SHALL reset on reload.

#### Scenario: Demo resets
- **WHEN** a visitor deletes "Crédito" on `/demo` and reloads
- **THEN** "Débito" and "Crédito" are both back with their fixed charges
