## Why

The mobile dashboard at `/demo` works, but at 390px many elements compete for attention and there is no clear order of importance. Measured on the current build (screenshots and computed styles in both themes):

- **Competing elements.** 18 bordered surfaces are visible and 10 font sizes are in use (11–44px). Seven labels are uppercase and tracked. Five effects surround the free-margin number (gradient, orb, border, glow, badge). A second lime number with its own glow sits right below it (savings).
- **Month is barely visible.** The month, the context every number depends on, is 13px text inside a 40px glass pill. Its chevrons are 36px, below the 44px touch minimum. "In progress" is shown only by a pinging dot.
- **Repeated data.** Income appears three times when its panel is open. Category totals appear three times: expenses panel, cards and pie legend. The pie repeats its own total.
- **Nested containers.** A card holds a panel, which holds a header row and a dashed box. Every expense amount has its own pill. The bar chart sits in a box inside a card.
- **Colour-only signals.** An over-budget or near-limit category is shown only by a red or amber bar; its text still reads "0 € left per week". The bar chart shows only every other month label, and its value labels overlap.
- **Glass on content.** Glass effects are applied to content as well as controls: the demo notice and the month pill.

With the data layer and the real dashboard route next on the roadmap, this is the point to set hierarchy, spacing, type and material rules. Every later screen will inherit them.

This is a refinement. Mango's palette, lime accent, brushed background, fonts, logo, card-per-category unit, disclosure behaviour and data contract stay as they are.

## What Changes

### A) Changes to existing components
- **Template** (`dashboard-template`):
  - Brand row: logo + wordmark + avatar.
  - The month becomes a large left-aligned screen title. It shows the cycle date range and an "in progress" label. On scroll it collapses into a pinned compact glass bar.
  - One spacing rhythm: gutter, section and stack tokens.
  - Expenses section title in sentence case. "Collapse all" appears only while a card is open.
- **Month selector**:
  - Two variants: large title and compact bar.
  - 44px targets.
  - The visible month name becomes the accessible name.
  - No infinite ping.
- **Free-margin card**: label and number only. The "available" badge, the lime label dot and the duplicated income line are removed. The light theme loses its off-palette green→blue wash.
- **Summary cards**: the three separate cards become one grouped surface with three columns. The disclosed panel opens inside the same surface, with animated height, and no longer repeats the column total. The savings value loses lime and glow.
- **Category card**:
  - Category name in body type instead of a display heading.
  - Flat dot.
  - Animated disclosure that stays reachable only while open, with `aria-expanded`.
- **Budget progress**: solid bar. Near-limit and over-budget states get an icon and text ("30 € over budget"), plus progressbar semantics.
- **Expense and summary rows**: plain right-aligned amounts, with no pill. Savings movements show +/− signs.
- **Add row**: a light `+` row in brand ink instead of a dashed box (reverses restyle-dashboard-to-v0 decision #6 and returns to ARCHITECTURE.md §9).
- **Monthly bars chart**:
  - One title.
  - No inner plot box.
  - Every month is labelled.
  - Only the selected bar shows its value. Tapping a bar selects it; the current cycle is selected by default.
  - Glow only on the current bar.
  - Month totals exposed as text to assistive technology.
- **Pie chart**: no duplicated total in the title. The legend shows percentage share instead of repeating amounts.
- **Demo notice**: opaque surface instead of glass, and a 44px close target.
- **Account menu**: behaviour and look unchanged. Its literal `rgba`/`white`/`black` colours move to `app/globals.css`, which fixes an existing theming-guard violation.
- **AnimatedContent**: honours `prefers-reduced-motion`.

### B) New components
- `atoms/collapsible`: an animated height disclosure that is `inert` while closed. It is shared by the category card, the summary group panel and the demo notice.
- `molecules/month-picker`: the year stepper and month grid, extracted from `month-selector` so both variants reuse them.
- `organisms/summary-group`: the grouped income/expenses/savings surface. It replaces `organisms/summary-card`, which is deleted.

### C) Design-token changes (`app/globals.css`)
- **Type scale**:
  - `display-mobile`: weight 800→700.
  - `headline-lg`: 700.
  - `headline-md`: 22→20.
  - `headline-sm`: 18→17.
  - `tabular-numeric-lg`: 24→20.
  - `tabular-numeric-md`: 15→16.
  - `body-sm`: 12→13.
  - `label-caps`: 11→12.
- **New layout spacing tokens**: `gutter`, `section`, `stack`, `inset`, `row` (48px) and `target` (44px).
- **New interaction utility**: `pressable` (pressed scale and background, focus ring, reduced-motion safe).
- **Effects**:
  - `.glass-bar` tint raised so bar text stays legible.
  - `.hero-card` light variant built from tokens.
  - `.text-glow-sm` removed.
  - Segmented-control track and thumb classes added.
- **`DESIGN.md`**: typography and spacing front-matter updated to match.

### D) Architectural implications
- `DashboardTemplate` is the **mobile composition**. Atoms, molecules and organisms stay container-sized and data-driven. New code adds no viewport-width layout variants; existing `sm:` rules are left untouched.
- The data contract (`DashboardData`, `DashboardActions`), `lib/`, the actions and routes do not change. Derived display values (percentage share, over-budget amount, cycle range) are simple presentation arithmetic in components. No business logic moves into components.
- A new `design-system` capability records the cross-cutting foundations: type roles, spacing, touch targets, interaction states, materials and motion. Future screens and the desktop phase build on these foundations.

### E) Explicitly postponed to the desktop phase
- Desktop template and composition: multi-column layout, `display` 58px hero, wider charts.
- Hover-only affordances, chart tooltips and menus anchored to the cursor. The existing `sm:` anchored account menu stays as it is.
- Desktop gutter and section values.
- Extracting shared dashboard UI state (open cards, open summary) into a hook. This happens once a second template exists.

Also out of scope (not desktop): the editable-amount affordance (returns with inline editing), swipe-to-delete, reorder mode, a bottom tab bar, background motion, and committed Playwright specs (roadmap step 7).

## Capabilities

### New Capabilities
- `design-system`: shared visual foundations every screen follows. It covers the type scale and hierarchy limits, spacing rhythm, touch-target minimums, pressed/focus/selected states that do not rely on colour alone, where translucent materials may be used, and reduced motion.

### Modified Capabilities
- `dashboard-ui`: the following requirements change:
  - **Cycle header and free margin**: month as large title with date range; compact pinned bar; free-margin card without badge or income line.
  - **Summary cards**: one grouped surface; panel inside it without a repeated total; signed savings movements.
  - **Expense card states**: animated disclosure, not reachable while collapsed; "collapse all" only while a card is open; plain amounts; light add row.
  - **Budget progress on budgeted categories**: text and icon for near-limit and over-budget; accessible value.
  - **Category colour placement**: legend shows percentage share.
  - **Dashboard follows the v0 visual reference** is removed.
  - **Mobile visual hierarchy** and **Monthly spend chart** are added.
- `theming`: *Hero glow only in dark theme* now forbids any other glow and requires the light free-margin card to be built from theme tokens.

## Impact

- **Code:**
  - `app/globals.css`
  - `components/atoms/{category-dot,progress-bar,money,collapsible}.tsx`
  - `components/molecules/{month-selector,month-picker,budget-progress,expense-row,summary-row,add-row,demo-notice}.tsx`
  - `components/organisms/{free-margin-card,summary-group,category-card,monthly-bars-chart,category-pie-chart,account-menu}.tsx`
  - `components/templates/dashboard-template.tsx`
  - `components/ui/animated-content.tsx`
  - `messages/{es,en}.json`: new keys `categoria.nearLimit` and `categoria.overBudget`; `dashboard.available` and `dashboard.freeMarginIncome` removed.
  - `DESIGN.md`
- **Deleted:** `components/organisms/summary-card.tsx`.
- **Unchanged:** `lib/`, the data contract, `app/demo/page.tsx`, the database and the WhatsApp bot.
- **Dependencies:** none added.
- **Prerequisite:** `openspec/specs/` is empty. The requirements modified here live in the unarchived `land-finance-dashboard` and `restyle-dashboard-to-v0` changes. Archive both, in that order, before archiving this change.
- **Docs:**
  - Restores three ARCHITECTURE.md §9 intentions: the month as "a title with arrows, not a bar", a light `+` add row, and a pinned top bar that is transparent at the top and frosted once scrolled.
  - Keeps restyle-dashboard-to-v0's departures from §9: the pie legend and the brand-tinted avatar.
  - Places the compact month in the centre of the bar rather than on the left.
  - ARCHITECTURE.md is not edited; design.md lists the deltas.
