## Purpose
The dashboard at a laptop or desktop width: a sidebar and a top bar that start flush with the page and float once it scrolls, a row of stat tiles, two columns that scroll together, sheets that open as side panels, and chart widgets the user can arrange and keep arranged.

## ADDED Requirements

### Requirement: Desktop shell at wide viewports
At a viewport 1024px wide or wider the dashboard SHALL be framed by a **sidebar** on the left and a **top bar** across the remaining width, and SHALL NOT render the phone's top bar or the cycle title block of `dashboard-ui` → *Cycle header and free margin*. Below 1024px neither the sidebar nor the desktop top bar SHALL be rendered or reachable, and the dashboard SHALL be as it is on a phone.

The sidebar SHALL contain, from top to bottom: the Mango logo and app name; a navigation list with "Resumen", and one entry per category in the displayed order (colour dot, name, and the category's total for the shown cycle); a savings block with the cycle's net savings and the composition strip described in `dashboard-ui` → *Cycle header and free margin*; and, at the bottom, an account card with the avatar, the user's name, the phone number when the account has one, and a chevron. Activating the account card SHALL open the account menu of `dashboard-ui` → *Account avatar and menu*, anchored to the card.

The top bar SHALL contain the previous/next cycle controls with the month name between them (activating the name opens the month picker), a status pill reading "en curso" while the cycle contains today or "Proyección" while it is a projection and nothing otherwise, and an "Añadir gasto" control. The next-cycle control SHALL follow the same six-cycle limit as the phone's controls.

The content SHALL be laid out as: the stat-tile row across the full content width; below it a main column holding the expense breakdown and the "Próximos cobros" card, and a widget column holding the chart widgets. Both columns SHALL scroll with the page; neither column, nor the widget list, SHALL have its own scrollbar or stick to the viewport.

#### Scenario: The shell replaces the phone chrome
- **WHEN** `/demo` is rendered at a 1280px-wide viewport
- **THEN** a sidebar is visible on the left with "Resumen", one entry per category and the account card, a top bar shows the month name with its controls, the "en curso" pill and "Añadir gasto", and no element shows the phone's title block or a second month name

#### Scenario: Nothing of the shell on a phone or a tablet
- **WHEN** `/demo` is rendered at 390px and at 820px
- **THEN** no sidebar and no "Añadir gasto" control exist in the accessibility tree, and the phone's top bar and cycle title are shown as before

#### Scenario: Columns scroll together
- **WHEN** at 1280px every category card is open and the page is scrolled by 800px
- **THEN** the first widget has moved up by 800px like the first category card, and no element other than the document has a vertical scrollbar

#### Scenario: Account menu from the sidebar
- **WHEN** at 1280px the account card at the bottom of the sidebar is activated
- **THEN** the account menu opens above or beside the card, entirely within the viewport, with the same contents as on a phone

### Requirement: Static and floating shell
While the page is at its top, the sidebar and the top bar SHALL be **static**: flush with the viewport edges, square-cornered, on an opaque surface, with a hairline separating each from the content. Once the content has scrolled under the top bar, both SHALL be **floating**: detached from the edges by an inset, rounded, on a frosted translucent material with a shadow, over the content scrolling behind them. Scrolling back to the top SHALL return them to static.

The transition between the two states SHALL change only the surfaces' material, edges and shadow; the controls inside them SHALL NOT move. Without a reduced-motion request the change SHALL take between 300 ms and 450 ms on an easing token and SHALL retarget if the scroll reverses mid-way; with reduced motion it SHALL be immediate. The floating material SHALL keep every text on it at 4.5:1 contrast over the brightest and darkest content that can scroll behind it, in both themes.

#### Scenario: Floating after a scroll
- **WHEN** at 1280px the page is scrolled by 200px
- **THEN** the sidebar and the top bar have rounded corners, a computed `backdrop-filter` other than `none` and a visible inset from the viewport edges, and the month name's position within the top bar is unchanged from before the scroll
- **AND** after scrolling back to 0 both are square-cornered and flush with the edges again

#### Scenario: Shell under reduced motion
- **WHEN** reduced motion is emulated and the page is scrolled by 200px
- **THEN** in the first frame after the scroll the sidebar and top bar are already in their floating appearance, with no transition running

#### Scenario: Legible floating bar
- **WHEN** the floating top bar is composited over the free-margin tile and over the page background, in both themes
- **THEN** the month name and the "Añadir gasto" label each have at least 4.5:1 contrast

### Requirement: Sidebar navigation follows the page
Each navigation entry SHALL be a link to its section: "Resumen" to the stat-tile row and a category entry to that category's card; the widget column has no entry. Activating an entry SHALL scroll the page so the target's top edge sits below the top bar, SHALL open the target category's card when it is collapsed, and SHALL move keyboard focus to the target. Exactly one entry SHALL be marked as current at any time: the entry whose section is at the reading line below the top bar, or the last entry once the page is scrolled to its end. The current entry SHALL be exposed to assistive technology as current and SHALL be marked visually by one highlight that moves from entry to entry rather than lighting each entry separately.

The category entries SHALL follow the displayed categories: a created category appears, a renamed one updates, a deleted one leaves, and the reorder mode's new order is reflected when it is left.

#### Scenario: Click lands below the bar
- **WHEN** at 1280px the "ocio" entry is activated
- **THEN** after scrolling ends the "ocio" card's top edge is below the top bar's bottom edge, the card is open, and the "ocio" entry is marked current

#### Scenario: Scroll moves the current mark
- **WHEN** at 1280px the page is scrolled from the top until the "ocio" card is at the reading line, and then to its end
- **THEN** "ocio" is the only entry exposed as current, and at the end the last category's entry is

#### Scenario: The list follows a rename
- **WHEN** at 1280px "comida" is renamed to "Mercado" from its sheet
- **THEN** the sidebar lists "Mercado" in the same position and no "comida"

### Requirement: Stat tiles
At a viewport 1024px wide or wider the free margin, the income, the expenses and the savings SHALL be shown as four tiles of equal height in one row, each tile with its label, its total and one line of context under the total: the free-margin tile the cycle's income, the income tile the number of income entries, the expenses tile the number of categories, the savings tile the monthly target when there is one and the accumulated balance otherwise. The free-margin amount SHALL remain the most prominent number on the page. The free-margin tile SHALL NOT show the composition strip and SHALL NOT be a control; the one-panel-at-a-time accordion of `dashboard-ui` → *Summary cards* SHALL NOT be used at this width.

The income and savings tiles SHALL be controls that open a **side panel** titled with the tile's label and holding the same contents the phone's panel holds (entries or movements, the accumulated block, the add row). The expenses tile SHALL be a control that scrolls to the expense breakdown, leaving the first card below the top bar. At most one side panel SHALL be open at a time.

#### Scenario: Four tiles in a row
- **WHEN** `/demo` is rendered at 1280px
- **THEN** the free-margin, income, expenses and savings tiles have their top edges at the same vertical position and the same height, the free-margin tile shows "864 €" as the largest text on the page and no strip, and no accordion indicator or panel is present under the tiles

#### Scenario: Income tile opens its panel
- **WHEN** at 1280px the income tile is activated
- **THEN** a side panel titled with the income label opens from the right edge, listing each income entry with its date and ending with the "add income" row, and "2.820 €" does not appear inside the panel

#### Scenario: Expenses tile scrolls
- **WHEN** at 1280px the expenses tile is activated
- **THEN** no panel opens and, after scrolling ends, the first category card's top edge is below the top bar

### Requirement: Sheets open as side panels
At a viewport 1024px wide or wider the entry sheet, the category sheet, the definition sheet, the account sheet and the summary side panel SHALL open as a panel docked to the right edge of the viewport, at least 400px wide, full height minus an inset, on a frosted translucent material, over a scrim that dims the page. They SHALL NOT open as a bottom sheet or as a popover at this width. The panel's header, fields, actions, dirty-state guard, focus handling and outcomes SHALL be those of the corresponding sheet on a phone.

Without a reduced-motion request a side panel SHALL move in from beyond the right edge to its resting position over 300 ms to 450 ms on an easing token and leave in less time than it entered; with reduced motion it SHALL appear and leave in place. Escape, the scrim and "Cancelar" SHALL close it as they close the phone's sheet. While a side panel is open the floating shell SHALL NOT keep its blur, so that no two translucent materials overlap.

#### Scenario: Entry sheet as a side panel
- **WHEN** at 1280px the "comida" card's add-expense row is activated
- **THEN** the entry sheet is a panel whose right edge is within 16px of the viewport's right edge, whose height is at least the viewport's minus 32px, with the amount field focused, and a scrim covers the page

#### Scenario: Category sheet from a card near the bottom
- **WHEN** at 1280px, in a viewport 700px tall, the page is scrolled so that the last category card's options control is in the lowest 100px of the viewport, and that control is activated
- **THEN** the category sheet opens as a side panel entirely within the viewport, with its "Cancelar" and save controls visible

#### Scenario: Side panel motion
- **WHEN** motion is not reduced and the category sheet opens at 1280px
- **THEN** the panel's horizontal position changes over successive frames, from beyond the right edge to its resting position
- **AND** with reduced motion emulated, in the first frame after opening the panel is at its resting position

#### Scenario: One material at a time
- **WHEN** at 1280px the page is scrolled by 200px and the entry sheet is opened
- **THEN** every element with a computed `backdrop-filter` other than `none` is the side panel or its scrim

### Requirement: Anchored popovers stay on screen
Where a control opens an anchored popover — the month picker, the account menu, and from 640px to 1023px the category, definition and account sheets — the popover SHALL be placed from the control that opened it, SHALL be entirely within the viewport whatever the control's position, SHALL scale in from the side of that control, and SHALL be placed from that control even when it does not hold keyboard focus.

#### Scenario: Account menu from the bottom of the screen
- **WHEN** at 1280px, in a viewport 700px tall, the sidebar's account card is activated
- **THEN** the menu's bottom edge is above the viewport's bottom edge and its top edge is below the viewport's top edge

#### Scenario: Category sheet on a tablet, from the bottom
- **WHEN** at 820px, in a viewport 600px tall, the page is scrolled so that a category card's options control is within 60px of the viewport's bottom, and the control is clicked with the pointer
- **THEN** the category sheet's panel is entirely within the viewport

### Requirement: Widget order is the user's
At a viewport 1024px wide or wider the chart widgets SHALL be a vertical list whose order the user can change by dragging a widget from a grip in its header, and from the keyboard: each grip SHALL be a focusable control named after its widget and stating its position and the number of widgets, and with focus on it the Up and Down arrow keys SHALL move the widget one position. A move at the first or last position SHALL do nothing. Focus SHALL stay on the moved widget's grip, and each move SHALL be announced to assistive technology naming the widget and its new position. Dragging SHALL start from the grip only, so that the widgets' own controls keep their behaviour.

The order SHALL be a per-user property supplied with the dashboard, SHALL be saved on every drop and every key move through an operation the mounting page supplies, and SHALL be shown optimistically: a rejected save SHALL return the widget to its previous position and SHALL show a status message. The order SHALL survive a reload and a change of the displayed cycle. When the mounting page supplies no such operation, no grip SHALL be rendered. Below 1024px the widgets SHALL follow the saved order but SHALL NOT be reorderable. On a projected cycle the hidden widgets stay hidden and the remaining ones keep their relative order.

Without a reduced-motion request a widget displaced by the held one SHALL move aside over successive frames and a released widget SHALL settle into place over successive frames; with reduced motion each SHALL appear in its new position, while a held widget still follows the pointer.

#### Scenario: Keyboard move
- **WHEN** at 1280px focus is on the calendar widget's grip (position 2 of 4) and Down is pressed
- **THEN** the calendar widget is third, its grip still has focus and names position 3 of 4, a status message naming the widget and its new position is exposed to assistive technology, and one save has been made

#### Scenario: Drag by the grip
- **WHEN** at 1280px the donut's grip is dragged above the first widget and released
- **THEN** the donut is first, the other three keep their relative order, and the order is saved once

#### Scenario: The order persists
- **WHEN** at 1280px the donut is moved to the first position and the next cycle is then displayed
- **THEN** the donut is still first, and on a projected cycle it is the first of the widgets shown

#### Scenario: Rejected save reverts
- **WHEN** the save operation rejects after the donut is moved to the first position
- **THEN** the donut returns to its previous position and a status message is shown

#### Scenario: Charts keep their own controls
- **WHEN** at 1280px a weekly bar is pressed and dragged 40px
- **THEN** no widget changes position and the bar's own action runs on release

#### Scenario: No grips without the operation
- **WHEN** the dashboard is mounted without a widget-order operation
- **THEN** no grip is rendered and the widgets are in the supplied order

### Requirement: Add an expense from the top bar
The top bar's "Añadir gasto" control SHALL open the entry sheet in create mode as a side panel, with the first category preselected and a category control in the header that lets the user pick another before saving, and with the amount field focused. Saving SHALL create the expense in the chosen category exactly as the card's add row does. The control SHALL be available on a projected cycle too.

#### Scenario: Add from the bar
- **WHEN** at 1280px "Añadir gasto" is activated, "ocio" is picked from the header's category control, 15 is entered and the sheet is saved
- **THEN** the "ocio" card lists the new expense at 15 € and the "ocio" total is 15 higher
