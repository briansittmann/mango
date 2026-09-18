## Purpose

The monthly dashboard: the single-screen view of a billing cycle (free margin, summary cards, expense cards, charts, account menu). It renders only data it is given, so the same screen can run on real data or on in-memory sample data at `/demo`.

## ADDED Requirements

### Requirement: Dashboard renders only supplied data
The dashboard SHALL render entirely from a data object and optional action handlers supplied by the page that mounts it. No dashboard component SHALL read from or write to the database, call a data-access module, or hold sample data of its own. Amounts SHALL be supplied as numbers and dates as ISO-8601 strings, never as pre-formatted text.

#### Scenario: Different data, same screen
- **WHEN** the dashboard is mounted twice with two different data objects
- **THEN** each instance shows only the totals, groups, expenses and user details of its own data object

#### Scenario: No database traffic from the dashboard
- **WHEN** `/demo` is loaded and every card, summary panel and menu is opened
- **THEN** the browser makes no request to the Supabase project

#### Scenario: Component tries to access data directly
- **WHEN** a dashboard component imports a Supabase client or a data-access module for anything other than types
- **THEN** the project lint check fails

### Requirement: Controls without a handler are disabled
Every control that triggers a data action (previous/next cycle, add expense, add income, add savings movement, log out) SHALL be rendered disabled when the mounting page supplies no handler for it.

#### Scenario: Demo without month navigation
- **WHEN** the dashboard is mounted without previous/next cycle handlers
- **THEN** both month chevrons are disabled and activating them does nothing

### Requirement: Public demo route
The application SHALL serve `/demo` without authentication. It SHALL render the full dashboard from a fictional sample billing cycle held in memory: income sources, a fixed-expenses group, food and leisure categories with budgets partly spent, other variable categories, savings movements, and at least six cycles of history. All totals in the sample SHALL be derived from its own rows. The page SHALL show a permanent notice that the data is sample data. Reloading SHALL reset the page to the initial sample. The sample SHALL NOT contain any real user's data.

#### Scenario: Visitor opens the demo
- **WHEN** an unauthenticated visitor opens `/demo`
- **THEN** the dashboard renders with sample data and a visible "sample data" notice, and no login is requested

#### Scenario: Sample totals are consistent
- **WHEN** the demo is rendered
- **THEN** each card total equals the sum of its expense rows, and the expenses summary total equals the sum of all card totals

#### Scenario: Demo in English
- **WHEN** the active language is English
- **THEN** the sample category, expense and income-source names are shown in English

### Requirement: Expense cards group each expense exactly once
The dashboard SHALL show one "Gastos fijos" card containing every fixed expense of the cycle, followed by one card per spending category containing only that category's variable expenses. Every expense SHALL appear in exactly one card, and both kinds of card SHALL look and behave the same. The fixed-expenses card label SHALL come from the translation files. Category names SHALL be shown as the user entered them.

#### Scenario: Fixed expense in a category
- **WHEN** the cycle has a fixed "alquiler" expense in category "vivienda" and a variable "Tesco" expense in category "comida"
- **THEN** "alquiler" is listed only in the "Gastos fijos" card and "Tesco" only in the "comida" card

#### Scenario: No variable pseudo-category
- **WHEN** the dashboard is rendered
- **THEN** there is no card grouping all variable expenses together

### Requirement: Expense card states
Each expense card SHALL start collapsed. Collapsed, it SHALL show only a colour dot, the name, the total aligned right, and a chevron. Expanded, it SHALL list its expenses one row each (name left; date in muted text under the name; amount aligned right), with rows at least 48px tall, followed by an "add expense" row. Several cards SHALL be able to be open at once, and a "collapse all" control SHALL close every open card.

#### Scenario: Open two cards then collapse all
- **WHEN** the user expands the "comida" card, expands the "ocio" card, then activates "collapse all"
- **THEN** both cards were open at the same time, and both are collapsed afterwards

#### Scenario: Two expenses with the same name
- **WHEN** a card contains two expenses both named "Lidl"
- **THEN** both rows are rendered

### Requirement: Budget progress on budgeted categories
A card whose category has a budget SHALL show "spent of budget" in its header and a progress bar. The bar colour SHALL depend on consumption (spent ÷ budget): the brand colour below 80 %, the warning colour from 80 % to 100 %, and the danger colour above 100 %. Under the bar it SHALL show the amount left per week, calculated as (budget − spent) ÷ days left × 7 and rounded down to a whole amount. Days left SHALL count today. When fewer than 7 days remain, it SHALL show the total amount left for the remaining days instead. When spent exceeds the budget, the amount left SHALL be zero. Categories without a budget SHALL show only their total.

#### Scenario: Worked example from ARCHITECTURE.md
- **WHEN** a category has budget 400 and 310 spent on day 10 of a 30-day cycle (21 days left, today included)
- **THEN** the header shows 310 of 400, the bar uses the brand colour, and the text shows 30 left per week

#### Scenario: Last days of the cycle
- **WHEN** a category has budget 120, 98 spent, and 4 days left in the cycle
- **THEN** the text shows 22 left for the last 4 days instead of a weekly amount

#### Scenario: Over budget
- **WHEN** spent exceeds the budget
- **THEN** the bar is full and uses the danger colour

### Requirement: Category colour placement
A category's colour SHALL appear only as the dot next to its name and as its slice in the pie chart. It SHALL NOT colour the card surface or border in any state. The pie chart SHALL have one slice per expense card with a non-zero total, a thin separator between slices, the cycle total in the centre, and no legend.

#### Scenario: Expanded card border
- **WHEN** a card is expanded
- **THEN** its border uses a theme token, not the category colour

#### Scenario: Pie matches cards
- **WHEN** the dashboard shows the fixed-expenses card and five category cards with non-zero totals
- **THEN** the pie has six slices whose colours match the cards' dots, and no legend is rendered

### Requirement: Summary cards
Three summary cards (income, expenses, savings) SHALL each expand to a panel below the row when activated, with the same behaviour, and at most one open at a time. The income panel SHALL list each income source with its actual amount and its estimated amount as muted reference. The expenses panel SHALL list every expense card's name, colour dot and total, sorted from highest to lowest total, and end with a "view all expenses" row that scrolls smoothly to the expense cards. The savings panel SHALL show the cycle's savings, the accumulated balance and the individual movements, with deposits and withdrawals visually distinguished.

#### Scenario: Expenses panel sort order
- **WHEN** the expense cards have totals 1 833, 420 and 78
- **THEN** the expenses panel lists them in that order

#### Scenario: Switching summary panels
- **WHEN** the income panel is open and the user activates the savings card
- **THEN** the income panel closes and the savings panel opens

### Requirement: Cycle header and free margin
The top of the dashboard SHALL show the cycle name as a title with previous/next chevrons, plus an "in progress" indicator while the cycle contains today. The cycle SHALL be named after the month in which it ends. Below it, a large free-margin card SHALL show the supplied free-margin amount as the most prominent number on the screen.

#### Scenario: Cycle crossing months
- **WHEN** the cycle runs from 26 August to 25 September
- **THEN** the title shows September in the active language

### Requirement: Account avatar and menu
The top-right corner SHALL show a 36px circular avatar with the user's photo, or the initial of the user's name when there is no photo. The avatar SHALL NOT use the brand or green colours. Activating it SHALL open a bottom sheet containing the user's photo or initial, name and phone number, a theme control, a language control, and a log-out action separated by a divider at the bottom. Menu rows SHALL be at least 48px tall and menu text at least 12px.

#### Scenario: User without photo
- **WHEN** the user named "Brian" has no photo
- **THEN** the avatar shows "B"

#### Scenario: Account details
- **WHEN** the account menu opens
- **THEN** it shows the user's name and phone number, and no e-mail address or plan badge
