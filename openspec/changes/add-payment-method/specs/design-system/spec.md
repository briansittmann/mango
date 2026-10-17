## ADDED Requirements

### Requirement: Payment-method surfaces follow the system

The surfaces of `payment-method` SHALL follow the rules of this capability with no exception of their own:
- **Materials:** the pockets block is financial content: opaque, with no background blur, its surface a token a step away from the free-margin card's. The "Mover plata" sheet and the pocket list are sheets: they use the entry sheet's material and scrim, and appear in the list of surfaces allowed to blur on the same terms.
- **Type:** the pocket balances, the "Mover plata" amount and the pocket list's balance use sizes of the named scale; the pocket balances are smaller than the free-margin number; at 390px with every card and panel collapsed the dashboard still shows no more than six distinct font sizes.
- **Targets:** each chip, each pocket block, the swap button of the card, the swap button of the sheet and the back control of the list have a hit area of at least 44 × 44 px; every row of the pocket list is at least 48px tall; the payment icon on a row is a decorative mark.
- **States:** a marked chip differs from an unmarked one by more than colour (weight or a check), and is exposed as pressed; every control shows pressed feedback and the focus ring.
- **Colour:** the brand colour marks a chosen chip and the border of the swap button; a negative balance takes the negative treatment; a transfer row uses the muted text colour and no category colour.
- **Motion:** both sheets open and close as the entry sheet does, and without movement under reduced motion; a balance that changes after a save animates like the free margin and changes without animation under reduced motion; nothing animates indefinitely.
- Every text of these surfaces has at least 4.5:1 contrast against what it sits on, in both themes.

#### Scenario: Opaque pockets
- **WHEN** `/demo` is rendered in either theme
- **THEN** the pocket blocks have `backdrop-filter: none` and a fully opaque background, and their balances' font size is smaller than the free-margin number's

#### Scenario: Targets
- **WHEN** at 390px the entry sheet is open, the "Mover plata" sheet is open, and the cash list is open
- **THEN** every chip, pocket block, swap button and back control is at least 44 × 44 px, and every list row is at least 48px tall

#### Scenario: Reduced motion
- **WHEN** reduced motion is emulated and the "Mover plata" sheet is opened, a move of 50 € is saved, and the cash list is opened
- **THEN** each sheet is at its resting position in the first frame after it opens, and the balances show their new values without an animated transition

#### Scenario: Chips not by colour alone
- **WHEN** the "Efectivo" chip is marked, in both themes
- **THEN** it differs from the unmarked "Tarjeta" chip in font weight or by a check mark as well as in colour, and is exposed as pressed
