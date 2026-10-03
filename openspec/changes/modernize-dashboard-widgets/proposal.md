## Why

The dashboard's widgets — the free-margin hero, the three summary tiles, the monthly bars and the distribution donut — still look like the first draft: flat cards, no context next to any figure, no hover layer, a 110px donut, and a single 640px column that leaves most of a laptop screen empty. The data behind them already answers "how is this cycle going?" and "where did the money go this week?", and nobody can see it. Fase 1 is closed and Fase 2 opens the product to other people, so this is the moment to make the first screen they land on look finished on a phone and on a desktop.

## What Changes

- **Free-margin hero** gains a composition strip under the number: income split into spent, saved and free, as proportions with text labels and a hover/focus tooltip. No second amount is printed on the card.
- **Summary tiles become stat tiles**: each column keeps its label and total and adds a trend under the total — a delta against the previous cycle and a six-cycle sparkline (expenses and income from their cycle totals, savings from the accumulated balance). Still one grouped surface, still at most one panel open, same three-column shape at 390px.
- **Monthly spend chart** is restyled to the dataviz mark specs (≤24px bars, 4px rounded tips, a 2px surface gap, no gridlines), gets a hover/focus tooltip on every bar, a header caption comparing the shown cycle with the previous one, and a taller plot on desktop. Selection behaviour and the assistive-technology list stay.
- **Distribution donut** grows, its legend shows amount and share per category, and hovering or focusing a slice or legend row highlights that category and swaps the donut centre to its name and amount (the cycle total returns on leave).
- **New widget: Top gastos de la semana** — horizontal bars ranking the categories by what was actually spent in the current week of the cycle, with chevrons to walk back through the cycle's earlier weeks. Computed from the rows the dashboard already receives (no data-layer change, no database change). Top five plus an "Otras" fold; bar tips carry the amount; tapping a bar scrolls to that category's card.
- **New widget: Gasto por día** — a calendar heatmap of the cycle's days coloured by daily spend on a single-hue ramp, today outlined, a tooltip per day. Also computed from the rows already received. This is the "one of my own choosing" the request allowed.
- **Desktop layout** at ≥1024px: the page widens to a two-column grid — title, hero, summary group and expense breakdown on the left; the four chart widgets stacked in a sticky right column. Below 1024px the single 640px column stays as it is. The top bar widens with the page.
- **Data**: `DashboardData.income` gains a six-cycle `history` (demo and Supabase) so the income tile can draw its sparkline. Nothing else in the contract changes; `history` keeps its shape.
- **Motion**: chart marks draw once on first reveal (bars grow from the baseline, donut sweeps, heatmap cells fade in), never replay, and are drawn at rest under reduced motion. Entrances keep using `AnimatedContent`.
- Projected cycles keep hiding the monthly chart and also hide the two new widgets (nothing was spent yet); the donut and the tiles stay.

## Capabilities

### New Capabilities
- `spend-insights`: the two new widgets and the rules behind them — how a cycle is cut into weeks, which rows count as spent in a week or a day, how categories are ranked and folded, and what each widget shows, announces and does on hover, focus and tap.

### Modified Capabilities
- `dashboard-ui`: *Cycle header and free margin* (composition strip on the hero), *Summary cards* and *Savings target in the data* (columns may carry a trend under the total; the "nothing below the total" rule is replaced), *Monthly spend chart* (marks, tooltip, caption), *Category colour placement* (legend with amounts, hover highlight, centre swap), *Mobile visual hierarchy* (the new captions are metadata), and a new *Desktop layout* requirement.
- `dashboard-data`: *Summary figures include savings* — the dashboard is also supplied with six cycles of income totals.
- `design-system`: *Motion respects user preference* — chart marks draw once on first reveal and are at rest under reduced motion; *Spacing rhythm* — the page width and gutters at ≥1024px.

## Impact

- `components/organisms/`: `free-margin-card.tsx`, `summary-group.tsx`, `monthly-bars-chart.tsx`, `category-pie-chart.tsx` restyled; new `weekly-top-chart.tsx` and `spend-calendar.tsx`; a shared tooltip molecule and a sparkline atom (`components/atoms/savings-sparkline.tsx` already exists unmounted and is the starting point).
- `components/templates/dashboard-template.tsx`: desktop grid, the widget column, the two new widgets wired to `scrollToCategory`; the header bars' max width.
- `lib/data/`: new pure module `weekly-spend.ts` (weeks of a cycle, daily and weekly totals, ranking and fold) with unit tests; `dashboard.ts` type gains `income.history`.
- `lib/data/supabase/dashboard.ts` and `lib/demo/demo-data.ts` + `lib/demo/demo-expenses.ts`: supply `income.history`.
- `messages/es.json`, `messages/en.json`: titles, captions, week labels, tooltip texts, assistive text.
- `app/globals.css`: chart tokens (sequential ramp from the brand hue, de-emphasis bar tone, tooltip surface) for both themes.
- Tests: new Playwright specs for the two widgets, the desktop grid and the restyled tiles on `/demo`; unit tests for `weekly-spend.ts`. Existing specs that assert on the donut legend ("18 %") and the summary columns ("nothing below the total") need updating.
- No migration, no change to Supabase functions, no new dependency (`recharts` and `gsap` are already in use).
