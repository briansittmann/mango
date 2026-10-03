## Context

See proposal.md → Why. What shapes the approach:

- The dashboard is one template (`components/templates/dashboard-template.tsx`, ~1650 lines) mounted by `/demo` and `/dashboard` with the same `DashboardData`. Every figure the two new widgets need — each expense row's instant, amount, `fixed.charged`, `projected`, and each category's colour — is already in `data.expenses.groups`. The only figure missing for the restyle is income per cycle (`history` carries expenses only, `savings.history` the accumulated balance).
- Charts are `recharts` (`BarChart`, `PieChart`, `ResponsiveContainer`) with `isAnimationActive={false}`; entrances are `AnimatedContent` (gsap + ScrollTrigger, `once: true`, reduced-motion aware). `components/atoms/savings-sparkline.tsx` exists unmounted.
- Layout is a single `max-w-[640px]` column, repeated on the two header bars (`dashboard-template.tsx` lines ~1110, ~1133, ~1196). There is no `lg:` breakpoint anywhere in the template.
- Design tokens live in `app/globals.css` with `light-dark()`; category colours are `--cat-<name>`; the type scale is closed (no `text-sm`, at most six sizes at 390px collapsed; `design-system` → *Type scale*). The hero card already has its own gradient, orb and glow.
- The dataviz skill's validator fails the 15-colour category palette as a categorical set (adjacent CVD ΔE 5.9, three near-gray slots). Those colours are the user's own choice per category and are shown everywhere with the name beside them; the charts keep that rule (colour is reinforcement, never the only identity channel).
- Brian runs the Playwright specs and commits; Claude writes code, specs and unit tests and runs `tsc`, `lint` and `test:unit`.
- Motion is reviewed against `motion-skills/` (Emil Kowalski's and Apple's bars, with exact values in `AUDIT.md`), and React Bits is browsed through the shadcn MCP (`components.json` → `@react-bits`); see D9 and D12.

## Goals / Non-Goals

**Goals:**
- Every widget reads as one system: same card, same header anatomy (title · caption · controls), same tooltip, same mark specs, same first-reveal motion, both themes.
- Mobile stays one column with nothing new that needs horizontal scroll; desktop gets a real second column without a second code path for the widgets.
- The weekly and daily aggregation is one pure module with unit tests, shared by both widgets and by nothing else.
- Zero database changes, zero new dependencies.

**Non-Goals:**
- A weekly view inside the category cards, a weekly budget, or a "weeks" navigation outside the widget.
- Touching the onboarding, the landing or the bot's "¿cómo vengo?" summary.
- Editing from inside a widget (the bars only scroll to the card).
- Replacing `recharts`; it stays for the monthly bars and the donut.

## Decisions

### D1 — Weeks are 7-day slots from the cycle's first day, not calendar weeks
A cycle starting on the 28th has no natural Monday; cutting from day 1 keeps week 1 aligned with the salary day Brian's data is built around and makes every cycle's "week 1" comparable. The last slot is short (1–7 days). Alternative: ISO weeks (Mon–Sun) — would split the cycle's first days into a partial week and make "current week" straddle two cycles.

### D2 — Only taken rows count in a week or a day
A pending recurring charge (`fixed.charged === false`) or a projected one (`projected: true`) is not money that left yet. The category cards and the free margin count pending charges at their expected amount on purpose (envelope logic); the new widgets answer "what did I spend", so they exclude them. The spec names this rule once (`spend-insights` → *Weeks of a cycle*) and both widgets reuse it.

### D3 — Aggregation is a pure module, computed in the template
`lib/data/weekly-spend.ts` exports `weeksOfCycle(start, end, today)`, `localDayOf(instant, timeZone)`, `spentRows(groups)`, `weeklyTopCategories(groups, week, timeZone, { top: 5 })` and `dailyTotals(groups, start, end, timeZone)`, with `.test.mjs` next to it (the pattern of `projection.test.mjs`). The template calls them in `useMemo` over `data.expenses.groups` and `data.cycle`, so `/demo` and `/dashboard` get the widgets for free and an edit updates them in the same render as the cards (`spend-insights` → *Widgets recompute from the shown rows*). Alternative: compute in `resumenMensual` and `deriveDemoData` and ship through `DashboardData` — two implementations of the same arithmetic and a bigger contract for nothing.

Local day of an instant: the `Intl.DateTimeFormat('en-CA', { timeZone })` trick already used by `demo-data.ts` and `lib/data/supabase/cycle.ts` (`localDateOf`), moved to the pure module so the client can use it (`cycle.ts` imports Supabase types; the template must not).

### D4 — Income history is the one data-layer addition
`DashboardData.income.history: { month: string; total: number }[]` (six entries, same shape as `history`). Supabase: `rows` already holds every transaction of the six cycles (`.gte('fecha', oldest.inicio)`), so it is one more `ranges.map` beside `history`. Demo: five static totals in `demo-data.ts` plus the sample's income total, and `deriveDemoData` replaces the last point after income edits (as it does for `history`). Alternative: a sparkline on expenses and savings only — three columns with two trends would break the "same shape" rule.

### D5 — Desktop is a CSS grid over the existing DOM, not a second template
At `lg` (1024px) the content wrapper becomes `grid grid-cols-[minmax(0,1fr)_minmax(360px,400px)] gap-x-8` and the widgets `<div>` moves to the second column with `lg:sticky lg:top-[72px] lg:self-start lg:max-h-[calc(100dvh-88px)] lg:overflow-y-auto`. Page column `max-w-[1120px] px-6`, header bars share it. Order on mobile is kept because the widget container already sits after the breakdown; at `lg` grid placement puts it in column 2 row 1 spanning all rows (`lg:row-start-1 lg:row-span-3`). The existing entrance cascades do not care about columns. Sheets/month picker: `sm:max-w-[520px] mx-auto` on the panel (check `sheet-shell.tsx`, currently uncommitted edits there — read the working copy first). Alternative: `react-grid-layout`-style configurable dashboard — not asked, heavy.

Reorder mode: the pushed-back layer is `fixed inset-0` already, so it covers both columns; the lane (`pe-11`) is in the main column. Nothing to do beyond checking the overlay's z-index against the sticky column.

### D6 — One tooltip, one header, one sparkline
- `components/molecules/chart-tooltip.tsx`: a small positioned popover (`role="tooltip"`, `aria-describedby` on the trigger), rendered inside the card near the mark, opened on `pointerenter`/`focus`, closed on `pointerleave`/`blur`/Escape, motion per D9 (recipies.md → *Tooltip*: 150 ms `ease-out`, origin at the trigger, after the first tooltip in a row the next ones open without delay). Not `recharts`' `<Tooltip>`: it cannot be keyboard-opened and is unstyled. For `recharts` marks the trigger is the mark's wrapper `<g>` with `tabIndex`.
- `components/molecules/widget-header.tsx`: title (`font-display text-headline-sm`), optional caption (`text-label-ui text-muted-foreground`), optional trailing controls; every widget uses it so the four cards align on desktop.
- `components/atoms/sparkline.tsx`: generalises `savings-sparkline.tsx` (points → an SVG polyline, 2px round-join stroke in `--chart-muted`, last point an 8px dot in `--brand`, `aria-hidden`). The old file is deleted.
- `components/atoms/trend-delta.tsx`: arrow + signed percentage; `good: boolean | null` picks `--positive` / `--destructive-ink` / muted. Used by the summary tiles and the monthly caption.

### D7 — Charts: what is SVG by hand and what stays `recharts`
- Weekly bars and the calendar are plain HTML/CSS (flex rows with a `div` bar; a 7-column grid of cells). Horizontal bars with a label column and a 44px row are a list, not a plot; `recharts` would fight the label column and the hit areas. Widths animate with the CSS `width` transition after a first-reveal gsap tween.
- Monthly bars stay `recharts` `BarChart` (already tuned); the spec's gap/thickness come from `maxBarSize={24}`, `barCategoryGap`, and `radius={[4,4,0,0]}`; keyboard via a custom `shape` that renders a focusable `<g>`; tooltip via D6.
- Donut stays `recharts` `PieChart`; highlight via `activeIndex` + `activeShape` (outer radius +6) and a `fillOpacity` of 0.5 on the rest; the centre is an absolutely-positioned HTML block that swaps content with a 150 ms crossfade.
- Sparklines and the composition strip are hand-written SVG/HTML.

### D8 — Colour: tokens, a brand ramp, and category colours as reinforcement
New tokens in `globals.css`, both themes:
- `--chart-muted` (de-emphasis bars, sparkline stroke; today `--muted-foreground` at 25 % opacity is used inline — becomes a token),
- `--chart-baseline` (hairline, one step off the card),
- `--heat-1` … `--heat-4`: a four-step sequential ramp of the brand hue, light→dark, validated against `--card` in each theme (dark steps are chosen, not flipped: in dark the ramp goes dim→bright),
- `--tooltip-bg`, `--tooltip-fg`: opaque, 4.5:1.

Category colours stay the fill of the weekly bars and the donut because they are the user's own identity channel and the name is always beside them (dataviz: ≥2 series need a legend/label; text never wears the series colour). The validator's failure on the 15-slot set is recorded, not fixed here: a user has ~7–9 categories and picks their own colours; the charts never rely on hue alone.

### D9 — Motion: draw once, then transition — to the `motion-skills` bar
The repo's `motion-skills/` (AUDIT.md, animations.md, recipies.md, Apple-desing.md) is the review bar; every value below is taken from there, none approximated.

- **Gate.** The first reveal of a chart is the rare/first-time tier (once per page load, purpose: *preventing a jarring change* — the marks would otherwise teleport in) so it may take the delight budget. A value change after an edit is occasional (purpose: *state indication*) and stays under 300 ms. Hover highlights are the tens-a-day tier: colour/opacity only, `ease`, 150 ms, gated to `@media (hover: hover) and (pointer: fine)`.
- **First reveal.** `AnimatedContent` keeps the card's entrance; inside, a `useFirstReveal` hook (IntersectionObserver, once) flips `revealed`, which starts the marks: horizontal and vertical bars via `clip-path: inset(...)` (the sanctioned fourth property — it keeps the 4px rounded tip intact, where `scaleX` would squash it) from fully clipped to their value, 500 ms `var(--ease-out)` (`cubic-bezier(0.23, 1, 0.32, 1)`, already a token), 40 ms stagger (the 30–80 ms band), whole sequence ≤900 ms as the spec allows; donut via `recharts` `isAnimationActive` on that first mount only (`animationDuration={600}`, then `false`); sparkline via `stroke-dashoffset`; heatmap cells and the strip via `opacity` from 0 with the same stagger. Never `scale(0)`, never `width`/`height`.
- **Value changes.** CSS transitions, not keyframes, so a second edit retargets from the current value: `clip-path 250ms var(--ease-out)` on bars, `opacity`/`background-color 150ms ease` on cells, `transform 250ms var(--ease-in-out)` on a mark that moves on screen. No replay, ever.
- **Tooltip.** `opacity` + `transform: scale(0.97)` → 1 over 150 ms `var(--ease-out)`, `transform-origin` at the mark (the trigger), exit along the same path at 120 ms.
- **Press.** Bars and legend rows that are controls take the existing `pressable` class (`scale(0.97)`, 160 ms) — feedback on pointer-down, not on release.
- **Reduced motion** is gentler, not zero: marks and tooltips drop the clip/scale/stagger and keep a 150 ms opacity fade; `prefersReducedMotion()` (already in the template) is the switch. `prefers-reduced-transparency` does not matter here: every widget is opaque (`design-system` → *Translucent materials*).
- **Never ship** (self-check from animations.md): `transition: all`, `ease-in`, built-in `ease-out` on a deliberate animation, animated layout properties, ungated `:hover` motion, everything entering at once.

### D12 — React Bits through the shadcn MCP
> **Decision (2.0, 2026-10-03).** The shadcn MCP server was not exposed in the implementing session, so the four items were read straight from the registry `components.json` declares (`https://reactbits.dev/r/<Component>-TS-TW.json`), which is what the MCP serves.
> - `SpotlightCard` → **ported** as `components/ui/spotlight-card.tsx`: the one decorative hover that earns its tier (new desktop column, otherwise flat cards). The original re-renders on every `mousemove` through React state and fades over `500ms ease-in-out`; the port writes `--spot-x/--spot-y` on the node, fades over 150 ms `ease`, is gated to `(hover: hover) and (pointer: fine)` and does nothing under reduced motion.
> - `FadeContent` → **rejected**: it is `AnimatedContent` again (gsap + ScrollTrigger wrapper, blur option); cells and the strip only need `opacity` from a boolean, which the six-line `useFirstReveal` hook gives without a wrapper `<div>` per cell.
> - `CountUp` → **already ported** (`components/ui/counter/count-up.tsx`, through `AnimatedAmount`); reused as is for the week total.
> - `AnimatedList` → **rejected**: enters from `scale(0.7)` (AUDIT.md §3 wants 0.9–0.97), replays on every re-entry (`once: false`), and brings its own selection and arrow-key model; the weekly bars are a ranked list of plain buttons with a `clip-path` draw.

React Bits is reached with the shadcn MCP server (`.mcp.json` → `shadcn`, `npx shadcn@latest mcp`) over the `@react-bits` registry declared in `components.json` (`https://reactbits.dev/r/{name}.json`, items named `<Component>-TS-TW`). `components/ui/*` already holds hand-ported React Bits pieces (`animated-content`, `counter/*`, `star-border`, `dot-field`, …), so the rule is: **browse with the MCP, port by hand into `components/ui/` in the repo's style** (named export, `prefersReducedMotion()` gate, tokens instead of literals), never `shadcn add` into the tree (its files land as default exports with inline literals and a `registry` layout the repo does not use). Candidates for this change, to confirm with `view_items_in_registries` during 2.x: `SpotlightCard` (a pointer-following radial highlight on the widget cards at `lg`, fine pointer only — the one place a decorative hover earns its tier, because the desktop column is new and the cards are otherwise flat), `FadeContent` (first-reveal fade for cells and strip, if it beats a 6-line hook), and `CountUp` (already ported as `counter/count-up.tsx`, reused for the week total). Anything with a canvas or WebGL (`Dither`, `Aurora`, `Silk`) is out: it is marketing motion on a graph in a finance app, which AUDIT.md §1 names as a finding.

### D10 — Strings and formats
New keys under `graficos` (`semana`, `topSemana`, `gastoPorDia`, `otras`, `sinGastos`, `semanaAnterior`, `semanaSiguiente`, `menos`, `mas`, `vsMesAnterior`, `sinCambios`, `filas`), `resumen` (`tendencia`, `vsCicloAnterior`), `dashboard` (`composicion`, `gastado`, `ahorrado`, `libre`). Week names via `useFormatter().dateTimeRange` (short month, day) in the user's timezone. Amounts via `useAmountFormatter().money`; percentages via `format.number(x, { style: 'percent', maximumFractionDigits: 0 })` as the pie already does.

### D11 — Tests
- Unit (`npm run test:unit`): `lib/data/weekly-spend.test.mjs` — 30-day and 31-day cycles, a cycle from the 28th, boundary instants in Dublin and Buenos Aires, pending/projected exclusion, top-5 fold, quantile steps with ties and with fewer than four non-zero days.
- Playwright on `/demo` (Brian runs): `weekly-top.spec.js`, `spend-calendar.spec.js`, `summary-trends.spec.js`, `widgets-desktop.spec.js` (1280px grid + sticky), `widgets-motion-a11y.spec.js` (reduced motion, keyboard, tooltips). Existing specs to update: whichever assert the legend shows only a percentage or the columns carry nothing under the total (`grep -l "18 %"`, `savings-progress.spec.js`, `budget-envelope.spec.js`), plus the six-font-size check if a new size slipped in (it must not: captions use `text-label-ui`, numbers `text-tabular-numeric-*`).

## Risks / Trade-offs

- [The demo's "today" is clamped to 30 September since 1 October, so its current week is week 5 (29–30 Sep) and its calendar has no future days] → specs walk back to week 1 for stable numbers; the "future days" scenario is written against a generic in-progress cycle; the weekly widget's empty-state gets exercised by the demo as a side effect. Accepted (deuda: *Fecha fija del demo*).
- [Six-size rule at 390px] → every new text uses an existing scale step (`text-label-ui` 13px, `text-body-sm` 13px, `text-tabular-numeric-md` 16px). The spec check runs collapsed, and the widgets are below the fold but visible text counts: verify with the existing size scenario.
- [Three columns at 390px are ~119px wide each; a delta plus a sparkline must fit] → delta on one line (`−3 %` with arrow, 13px) and a 100% width, 20px-tall sparkline under it; totals over 100 000 already drop a size. Verify at 360px too.
- [Sticky column taller than the viewport on short laptops] → `max-h` with its own scroll; a 2px scrollbar gutter in dark could look like a line: `scrollbar-gutter: stable` and thin scrollbars via `scrollbar-width: thin`.
- [`recharts` keyboard focus on bars] → custom `shape` with `tabIndex=0` and `role="button"`; if `recharts` swallows key events, the fallback is a visually-hidden button row under the plot (the sr-only list already exists).
- [Hover tooltips on touch] → the tooltip opens on tap as well (`pointerdown` with `pointerType === 'touch'` toggles it), and closes on the next tap outside; a bar's tap still scrolls to the card after the tooltip shows for 1.2 s? No — on touch a bar tap scrolls immediately and the tooltip is skipped; only the calendar cells and the strip segments toggle a tooltip on tap, since they have no other action.
- [Donut `activeShape` re-renders the whole chart on every hover] → fine at ≤15 slices; `isAnimationActive` off after first reveal keeps it cheap.
- [`--heat` ramp contrast in light] → the darkest step must reach 3:1 on white; validated with the skill's script during 1.x; the lightest step may sit under 3:1 and is allowed because the day number is text and the tooltip/table carry the value.
- [Landing `?embed=1` frame] → the embedded demo shows the dashboard at phone width; the new widgets appear below the fold and the story's `postMessage` edits flow through the same `useMemo`. No change needed, but screenshot it.

## Open Questions

- Whether the widget column should also hold "Próximos cobros" on desktop (it is a card, not a chart). Left in the main column for now; moving it is a grid-placement change and no spec change.
