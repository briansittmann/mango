## MODIFIED Requirements

### Requirement: Expense card states
Each expense card SHALL start collapsed. Collapsed, it SHALL show a colour dot, the name, the total aligned right (or "spent of budget" for a category with a budget), and a chevron. A category with a budget SHALL also show its progress bar and remaining-amount text under the header while collapsed. No expense rows SHALL be shown while collapsed. Expanded, it SHALL list its expenses one row each (name left; date in muted text under the name; amount aligned right), with rows at least 48px tall, followed by an "add expense" row. Several cards SHALL be able to be open at once, and a "collapse all" control SHALL close every open card.

#### Scenario: Open two cards then collapse all
- **WHEN** the user expands the "comida" card, expands the "ocio" card, then activates "collapse all"
- **THEN** both cards were open at the same time, and both are collapsed afterwards

#### Scenario: Two expenses with the same name
- **WHEN** a card contains two expenses both named "Lidl"
- **THEN** both rows are rendered

#### Scenario: Collapsed card with a budget
- **WHEN** the "comida" card (budget 400, 310 spent, day 10 of a 30-day cycle) is collapsed
- **THEN** its header shows 310 of 400, its progress bar and "30 left per week" text are visible, and none of its expense rows are rendered

#### Scenario: Collapsed card without a budget
- **WHEN** a category without a budget is collapsed
- **THEN** it shows only the colour dot, name, total and chevron

### Requirement: Category colour placement
A category's colour SHALL appear only as the dot next to its name, as the border of its card while the card is expanded, as its slice in the pie chart, and as its dot in the pie legend. It SHALL NOT colour the card surface in any state, and a collapsed card's border SHALL use a theme token. The pie chart SHALL have one slice per expense card with a non-zero total, a thin separator between slices, the cycle total in the centre, and a legend with one entry per slice (colour dot, name, total) in the same order as the expense cards.

#### Scenario: Expanded card border
- **WHEN** the "comida" card is expanded
- **THEN** its border colour equals the colour of its dot, and its surface keeps the card token colour

#### Scenario: Collapsed card border
- **WHEN** a card is collapsed
- **THEN** its border uses the border theme token, not the category colour

#### Scenario: Pie matches cards
- **WHEN** the dashboard shows the fixed-expenses card and five category cards with non-zero totals
- **THEN** the pie has six slices whose colours match the cards' dots, and the legend lists the same six entries with matching dots, names and totals, in card order

### Requirement: Cycle header and free margin
The top of the dashboard SHALL show a bar with the Mango logo and the app name on the left and the account avatar on the right. Below it, the cycle name SHALL be shown as a title between previous/next chevrons, plus an "in progress" indicator while the cycle contains today. The cycle SHALL be named after the month in which it ends. Below that, a large free-margin card SHALL show the supplied free-margin amount as the most prominent number on the screen, in the brand colour, with an "available" badge and a line stating the cycle's income total.

#### Scenario: Cycle crossing months
- **WHEN** the cycle runs from 26 August to 25 September
- **THEN** the title shows September in the active language

#### Scenario: Top bar
- **WHEN** the dashboard is rendered
- **THEN** the logo (decorative, with an empty accessible name) and the app name appear at the top left, and the avatar at the top right

#### Scenario: Free-margin card content
- **WHEN** the free margin is 540 and the cycle income is 2 400, in Spanish
- **THEN** the card shows "540 €" as the largest text on the page, an "available" badge, and a line containing "2.400 €"

### Requirement: Account avatar and menu
The top-right corner SHALL show a 40px circular avatar with the user's photo, or the initial of the user's name when there is no photo. The avatar SHALL have a thin brand-coloured border and a faint brand tint, with the initial in the brand text colour. Activating it SHALL open a floating bottom sheet: inset from the sides and bottom of the screen, rounded on all corners, with a translucent blurred surface over a dimmed page and a drag handle on narrow screens. The sheet SHALL contain the user's photo or initial, name and phone number, a theme control, a language control, and a log-out action separated by a divider at the bottom. Activating the dimmed page SHALL close the sheet. Menu rows SHALL be at least 48px tall and menu text at least 12px.

#### Scenario: User without photo
- **WHEN** the user named "Brian" has no photo
- **THEN** the avatar shows "B"

#### Scenario: Account details
- **WHEN** the account menu opens
- **THEN** it shows the user's name and phone number, and no e-mail address or plan badge

#### Scenario: Floating glass sheet
- **WHEN** the account menu opens on a 390px-wide viewport
- **THEN** the sheet leaves a gap to the left, right and bottom edges, the page behind it is dimmed and blurred, and activating the dimmed page closes the sheet

## ADDED Requirements

### Requirement: Dashboard follows the v0 visual reference
The dashboard SHALL reproduce the visual design of the v0 reference dashboard kept in the repository's `referencia/` folder, in both themes. It SHALL use the Geist Sans typeface and a single centred column at most 480px wide. Measured at a 390px-wide viewport, it SHALL match these reference values:

| Element | Value |
|---|---|
| Expense card | 24px corner radius, header at least 72px tall, name 18px |
| Expense row amount | 16px, tabular figures |
| Free-margin card | 26px corner radius; number 64px |
| Summary card | 22px corner radius, at least 104px tall; value 24px |
| Month selector | fully rounded bar 48px tall |
| Open chevron | brand text colour |
| "Add" rows | dashed border |
| Monthly bars | value label above each bar; current cycle bar in brand colour; no value axis |

An open summary card's panel SHALL span the full width of the three-card row.

#### Scenario: Computed sizes match the reference
- **WHEN** `/demo` is rendered at a 390px-wide viewport
- **THEN** the computed corner radius, height and font size of each element listed above equal the reference values

#### Scenario: Typeface
- **WHEN** `/demo` is rendered
- **THEN** the computed font family of the body text starts with Geist

#### Scenario: Summary panel spans the row
- **WHEN** the income summary card is activated
- **THEN** its panel is as wide as the row that holds the three summary cards
