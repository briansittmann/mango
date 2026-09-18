## Context

See proposal.md → *Why*. This section records the current-state audit the decisions rest on. It was measured on `/demo` at 390 × 844 in both themes (Spanish, all collapsed unless noted). Before/after screenshots for tasks come from the same states.

### Design system today

- **Sources.** There are two:
  - `DESIGN.md` (Stitch): front-matter tokens plus prose rules.
  - `app/globals.css`: what actually ships.
  
  They already disagree. For example, `display-mobile` is 32px in `DESIGN.md` and 44px/800 in CSS.
- **Colour.** Tokens are defined with `light-dark()` on `:root` and mapped in `@theme inline`. Components must not contain literal colours (theming spec). The palette covers brand/brand-ink, positive, warning, destructive, the `--cat-*` category colours, the `hero-*` tokens, the `shell-*` brushed background, scrim and handle.
- **Type.**
  - Fonts: Inter for text (`--font-sans`) and Manrope for display (`--font-display`).
  - Scale: 12 roles in `@theme inline` as `--text-<role>` with line-height, tracking and weight.
  - Tabular figures are set on `body`.
- **Radius.** `--radius-card` 20px, `--radius-inner` 16px, `--radius-sheet` 28px, plus the shadcn scale.
- **Spacing.** No tokens. Components use Tailwind's 4px scale ad hoc. `DESIGN.md` lists `space-*` values that were never ported.
- **Effects** (global classes):
  - hero: `.hero-card`, `.hero-value`
  - accents: `.text-hero-accent`, `.text-glow-sm`
  - glass: `.liquid-glass` (plus a denser `[role=dialog]` variant), `.glass-bar`
  - motion: `--ease-spring`, `--ease-bounce`, `segment-pop`
- **Motion.** `ui/animated-content.tsx` runs a GSAP/ScrollTrigger entrance on every section. The element starts at `visibility: hidden` and ignores `prefers-reduced-motion`.

### Components: shared vs mobile-specific today

| File | Role | Mobile-specific? |
|---|---|---|
| `templates/dashboard-template.tsx` | Composition, UI state, sticky header | **Yes.** Single 640px column; `sticky -top-[76px]`; avatar jumps from `top-6` to `top-[87px]`; `scrollY > 56` threshold |
| `organisms/summary-card.tsx` | Three cards plus a panel through `contents`/`order-*`/`col-span-3` | **Yes.** The three-column mobile grid is baked into the component |
| `organisms/account-menu.tsx` | Bottom sheet | Mixed: sheet below 640px, avatar-anchored popover at 640px and wider |
| `organisms/free-margin-card.tsx` | Hero | Shared (`sm:text-display` step) |
| `organisms/category-card.tsx`, `monthly-bars-chart.tsx`, `category-pie-chart.tsx` | Content | Shared (fixed `h-40` plot, `size-28` donut) |
| `molecules/*` (month selector, rows, add row, budget progress, demo notice) | Parts | Shared |
| `atoms/*`, `ui/animated-content.tsx` | Primitives | Shared |
| `lib/data/dashboard.ts` | `DashboardData` / `DashboardActions` contract | Shared, and untouched by this change |

### HIG audit

| Principle | Observed | Effect |
|---|---|---|
| Hierarchy | The hero number is 44px but carries five effects (gradient, orb, brand border, text glow, badge). Savings is a second lime number with its own glow. Seven category names are 18px Manrope headings. The month is 13px. | Several focal points compete. The context (month) is the weakest text at the top. |
| Clarity | "Margen libre" + "DISPONIBLE" say the same thing. Income is shown three times with its panel open (hero line, card, panel header). Category totals appear in three places (expenses panel, cards, legend). The pie total appears twice. The bar chart has two titles. | Repetition reads as noise and makes the screen longer. |
| Consistency | 10 font sizes (11, 12, 13, 14, 15, 16, 18, 22, 24, 44). Seven uppercase tracked labels mixed with sentence-case titles. `text-lg`, `text-xs` and `text-sm` bypass the scale. Pressed state exists only on the avatar. `aria-expanded` is set on summary cards but not on category headers. | No stable type system for later screens. |
| Spacing | Section gaps vary: 16 / 40 / 32 / 12 / 38 / 16px. The hero card is 173px tall for one number. | No rhythm, and sections don't read as groups. |
| Typography | Card name and amount are both 18px/600, so neither leads. Labels are 11px. | Weak ranking inside rows. |
| Density | Seven cards take about 900px. All six bars carry value labels, and they overlap ("1,8 mil 1,7 mil"). Only three of six month labels render (Recharts auto-skips ticks). | Crowded where it matters, repeated where it doesn't. |
| Navigation | The month is a glass pill: 40px tall, 36px chevrons, 13px title. On scroll the pill pins and the avatar slides down 63px to meet it. The picker grid is clear, with the selected month filled. | The month control looks like a generic web widget, and the avatar moves. |
| Touch targets | Under 44px: previous and next chevrons (36 × 36), month button (120 × 32), notice close (36 × 36). | Misses the 44px minimum stated in `DESIGN.md`. |
| Materials | `.liquid-glass` is used on the month pill, month picker, demo notice and account sheet. `.glass-bar` has a 45% tint. The light hero has a literal green→blue gradient and an emerald shadow (off-palette, and against `DESIGN.md` rule 1, no decorative washes). | Glass is used as decoration on content. |
| Progressive disclosure | Good base: cards start collapsed and summary panels open on demand. But panels mount and unmount instantly with no transition, "Colapsar todo" is visible even when nothing is open, and every bar shows its value. | Disclosure feels abrupt, and there are idle controls. |
| Visual feedback | No pressed state on cards, summary cards or add rows. Browser-default focus rings. The "en curso" dot pings forever. Entrance animation ignores reduced motion. | Taps feel dead; there is constant motion near the title. |
| Accessibility | Warning and over-budget states are shown by colour only ("Te quedan 0 € por semana" even when over). The month button's accessible name "Seleccionar mes" hides the visible month (WCAG 2.5.3). The bar chart has no text alternative. Category headers expose no expanded state. | Status is lost for colour-blind and screen-reader users. |

### Observed drift (recorded, not addressed unless noted)

- Commits `eb8f177` and `a44a762` brought back `.liquid-glass`/`.glass-bar`, even though restyle-dashboard-to-v0 task 2.4 removed glass. This change keeps glass only where D9 allows it.
- `organisms/account-menu.tsx` contains literal `rgba(…)` values plus `dark:bg-white/[0.09]` and `dark:bg-black/25`. This violates the theming guard, and D11 fixes it.
- `molecules/demo-notice.tsx` can be dismissed, while *Public demo route* says the notice is permanent. It is not changed here.
- The demo cycle is 1–30 September 2026 (`lib/demo/demo-data.ts`). *Ocio* is at the warning level (130 of 150) and *Transporte* is over budget (130 of 100). Both are useful for verifying D7.

### Constraints

- Guards from land-finance-dashboard stay in force:
  - no literal colours in components
  - no literal JSX text or `aria-label` literals (`jsx-no-literals` allows only `·`, `+`, `/`)
  - no `'use client'` below the template
  - downward-only imports
- Organisms may use hooks because they render under the client template (`account-menu.tsx` already does).
- Verified versions:
  - Tailwind 4.3.3: named `--spacing-*` theme keys feed padding, margin, gap and size utilities, and `@utility` is supported.
  - next-intl 4.14.4: `format.dateTimeRange` exists.
  - Recharts 3.10.1.
- Both themes, `es` and `en`. No new dependencies.

## Goals / Non-Goals

**Goals:**
- At 390px with everything collapsed, move from the current state to the target:

  | Measure | Now | Target |
  |---|---|---|
  | Font sizes | 10 | 6 (44 / 28 / 20 / 17 / 16 / 13px) |
  | Bordered surfaces | 18 | 11 (hero, summary group, 7 cards, 2 chart cards) |
  | Targets under 44px | 4 | 0 |
  | Glowing elements | 4 | 1 (2 in dark) |
  | Elements with backdrop blur | 3 | 0 at rest (the bar only once scrolled) |

- Keep every existing interaction, handler, sort, calculation and message-driven text.
- Give future screens and the desktop phase a small, named set of foundations: type roles, spacing, `pressable`, `Collapsible`, material allowlist.

**Non-Goals:**
- New colours beyond `warning-ink` (D7), new fonts, new radii.
- Changing the entrance choreography of `AnimatedContent` beyond honouring reduced motion.
- Redesigning the account sheet: only its colour literals move (D11).
- Committed Playwright specs and test scripts (roadmap step 7). Verification uses scratchpad scripts, as in earlier changes.
- Editing ARCHITECTURE.md.

## Decisions

### D1 — Hierarchy through type roles and position, not containers

The token names stay (they are `DESIGN.md`'s vocabulary); the values change. Each role has one job on the mobile dashboard:

| Role | Token | Before | After | Used for |
|---|---|---|---|---|
| Hero value | `display-mobile` | 44/50, 800, −0.02em | 44/48, **700**, −0.035em | Free-margin number |
| Screen title | `headline-lg` | 28/36, 600 | 28/34, **700**, −0.02em | Cycle title |
| Section title | `headline-md` | 22/28, 600 | **20/26**, 600 | "Desglose de gastos"; hero currency glyph |
| Group title | `headline-sm` | 18/24, 600 | **17/22**, 600 | Wordmark, compact month, chart titles, picker year, sheet title |
| Summary value | `tabular-numeric-lg` | 24/32, 600 | **20/26**, 600, −0.015em | Income / expenses / savings totals |
| Row value | `tabular-numeric-md` | 15/20, 500 | **16/22**, 500 | Card and row amounts, donut total |
| Body | `body-lg` | 16/24, 400 | unchanged | Card names (`font-medium`), row names, add rows, "Colapsar todo", hero label |
| Metadata | `body-sm` | 12/16, 400, +0.01em | **13/18**, 400, 0 | Dates, remaining text, estimates, cycle range, notice, legend, donut "Total" |
| Label | `label-ui` | 13/18, 500 | unchanged | Summary labels, chart ticks and value label, picker months, avatar initial |
| Caps label | `label-caps` | 11/14, 600, +0.06em | **12/16**, 600, +0.04em | Not used on the dashboard; kept for badges |
| Desktop display | `display` | 58/64, 800 | unchanged | Desktop phase |
| Body (sheet) | `body-md` | 14/20 | unchanged | Account sheet |

Rules:
- Numbers use Inter with tabular figures; titles use Manrope.
- Muted colour marks metadata. Brand ink appears only on the hero number, the "en curso" label, the current chart bar and its label, add rows and open chevrons (ARCHITECTURE.md §9: lime is brand, not free semantics).
- `text-lg`, `text-sm` and `text-xs` are removed from components.

*Alternatives rejected:*
- **Renaming to Apple's role names** (`title1`, `callout`…): the churn buys nothing, and `DESIGN.md` owns the vocabulary.
- **Adding new tokens alongside the old ones:** two scales would drift immediately.

### D2 — Layout spacing tokens

```css
@theme {
  --spacing-gutter: 1rem;    /* page sides */
  --spacing-section: 2rem;   /* between top-level sections */
  --spacing-stack: 0.75rem;  /* between sibling surfaces */
  --spacing-inset: 1rem;     /* padding inside a surface */
  --spacing-row: 3rem;       /* list row min height */
  --spacing-target: 2.75rem; /* touch target */
}
```

These generate `px-gutter`, `mt-section`, `gap-stack`, `px-inset`, `min-h-row`, `size-target` and so on. The tokens carry layout rhythm. Micro-spacing inside a component (icon gaps, `mt-0.5` under a name) keeps Tailwind's 4px scale.

Mobile page rhythm:

```
sticky bar (h-14)
  title block (pt-2)
  notice ─ mt-4
  free-margin card ─ mt-4
  summary group ─ mt-stack
  expenses section ─ mt-section (title row, cards mt-stack, gap-stack)
  charts section ─ mt-section (gap-stack)
  pb-section
```

*Alternatives rejected:*
- **Porting all of `DESIGN.md`'s `space-*`:** it duplicates Tailwind's scale one-to-one.
- **Staying with raw numbers:** today's 16/40/32/12/38 gaps show where that leads.

### D3 — Month as the screen title; one pinned bar that absorbs it on scroll

**Structure** (template):
1. **Top bar**, `sticky top-0 z-30 h-14`, full width, inner `max-w-[640px] px-gutter`:
   - logo `size-7` on the left
   - a slot holding either the wordmark (`headline-sm`) or the compact month selector
   - the avatar button (`size-target`) on the right
2. **Title block** under the bar, in the page column:
   - `MonthSelector variant="title"`: month name in `font-display text-headline-lg capitalize` inside a button with a `ChevronDown size-5` that rotates while the picker is open
   - previous/next buttons (`size-target`) on the right of the same row
   - a line under it in `text-body-sm`: `[• en curso] · {range}`. Dot and label use `text-brand-ink`, the range is muted, and the dot is static.
   - The range comes from `format.dateTimeRange(new Date(start), new Date(end), { day: 'numeric', month: 'short', timeZone: 'UTC' })`. The dates are date-only strings, so UTC avoids a one-day shift west of Greenwich.
3. **Scroll state:** an `IntersectionObserver` on the title block with `rootMargin: '-56px 0px 0px 0px'` sets `titleInView`.
   - While in view: the bar background is transparent, the wordmark is shown, and the compact selector is `inert`, at opacity 0 and offset 8px.
   - Otherwise: a `.glass-bar` layer fades in, the wordmark leaves, and `MonthSelector variant="compact"` (`‹ septiembre ›` with the title in `headline-sm`) arrives.
   - The swap uses `transition-[opacity,translate] duration-500 ease-spring motion-reduce:transition-none`. The avatar never moves.
   - This replaces `scrolled`, the `scrollY > 56` listener, `sticky -top-[76px]` and the avatar `top` transition.
4. **Picker:** the year stepper and month grid move to `molecules/month-picker.tsx` (props: `month`, `inProgress`, `open`, `onSelect`, `onClose`, `align: 'start' | 'center'`). Both variants use it; outside-press and Escape handling move with it. The selected month keeps the filled `bg-primary`, gains `font-semibold`, and keeps `aria-current`.
5. **Accessibility:** the title button has no `aria-label`. Its name is the visible month plus a `sr-only` `t('seleccionarMes')`, which satisfies label-in-name. The compact variant carries the same name. "En curso" stays readable text.

*Alternatives rejected:*
- **Enlarging the pill** (44px, 17px text): it keeps a generic control look and doesn't make the month the screen's context.
- **One header that morphs from large to compact with scroll-linked transforms:** more code and scroll listeners for the same result.
- **Pinning the large title:** it wastes about 90px of a 844px screen.

### D4 — Free-margin card: label and number

Content: `text-body-lg text-muted-foreground` label, then `hero-value font-display text-display-mobile` (currency glyph `text-headline-md`), padding `px-inset py-5`.

Removed: the "disponible" badge, the label dot, the brand divider and the income line. Income stays one row lower, in the summary group. Keys `dashboard.available` and `dashboard.freeMarginIncome` are deleted from both message files.

The dark hero glow and orb stay; they are Mango's signature, and the theming spec pins them. In light, `.hero-card` is built from tokens only (D9), with `--hero-end` lowered from brand 42 % to brand 8 % over white so it stays a tint, not a wash.

*Alternative rejected:* keeping the income line under a divider. It repeats the income column 12px below.

### D5 — Summary group: one surface, three columns, panel inside

`organisms/summary-group.tsx` replaces `summary-card.tsx`.

**Props:**
- `items: { key; label; total; panel: ReactNode }[]`
- `openKey`
- `onToggle(key)`
- `currency`

**Structure:**
- Surface: `rounded-card border border-border bg-card overflow-hidden`.
- Columns: `grid grid-cols-3 divide-x divide-border`.
- Each column is a `pressable` button (`aria-expanded`, `aria-controls`):
  - label row: `text-label-ui text-muted-foreground` + `ExpandChevron size-4`
  - value: `mt-2 whitespace-nowrap text-tabular-numeric-lg text-foreground`
  - while open, an indicator `absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand`
- Panel: one `Collapsible` (D6) with `border-t border-border` below the columns.
- So that closing animates with content still present, the component keeps the last opened key while `openKey` is `null`.
- Switching directly between panels swaps content and height without animation.

**Template panels:**
- **Income:** source rows plus the add row. The header row with the repeated total is removed.
- **Expenses:** sorted rows plus "Ver todos los gastos". The target list gets `scroll-mt-20` so it lands below the 56px bar.
- **Savings:** first row "Acumulado" with its amount, then movements with `signed` (D7), then the add row. The cycle total is not repeated, and savings loses `accent`/`.text-glow-sm`.

*Alternatives rejected:*
- **Three separate cards with a shared panel card:** that is the current nesting.
- **A segmented control above a single panel:** it hides the three totals behind a mode.

### D6 — `Collapsible` atom for every disclosure

```tsx
<div className={cn('grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
                   open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')} id={id}>
  <div className="min-h-0 overflow-hidden" inert={!open}>{children}</div>
</div>
```

- Content stays mounted: `inert` removes it from focus and the accessibility tree.
- The iOS sheet curve already used in the codebase avoids the spring's overshoot on layout.
- Used by `CategoryCard`, `SummaryGroup` and `DemoNotice`, which already hand-rolls this pattern and now uses the atom.

*Alternatives rejected:*
- **Conditional render** (today's approach): no closing animation, and the height jumps.
- **`interpolate-size: allow-keywords`:** not yet in Safari.
- **GSAP height tweens:** JavaScript for a CSS job.

### D7 — Category card, rows, add row and budget states

**`CategoryCard`:**
- Header: `pressable flex min-h-14 w-full items-center gap-3 px-inset` with `aria-expanded` and `aria-controls`.
- Dot: `size-2.5`.
- Name: `flex-1 truncate text-body-lg font-medium`.
- Amount: `text-tabular-numeric-md font-semibold` with the existing rich "de {presupuesto}" in muted.
- The open border keeps the category colour.
- Budget block: `px-inset pb-3`, outside the header button.
- Body: `Collapsible` with rows, then `AddRow` edge to edge.

**`CategoryDot`:** a flat `background: var(--cat-…)`. The radial gradient built from `white`/`black` is removed.

**`ExpenseRow` / `SummaryRow`:**
- `flex min-h-row items-center gap-3 px-inset py-2.5`, keeping the existing inset hairline.
- Amount: plain `text-tabular-numeric-md`, with no pill.
- `SummaryRow` drops its `size-8 bg-muted` circle around the dot and gains `signed?: boolean`, which passes `signDisplay: 'exceptZero'` to `Money`.
- `Money` gains `signDisplay`, applied in both of its formatting branches.

**`AddRow`:** `pressable flex min-h-row w-full items-center gap-3 px-inset text-body-lg font-medium text-brand-ink disabled:opacity-50`, with `Plus size-5`, left-aligned like a list row, and the inset hairline above it.

**`ProgressBar`:**
- Solid `var(--brand | --warning | --destructive)`; the gradient mixed with `white` is removed.
- `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow` set to usage × 100 (one decimal), `aria-valuetext` from a prop.

**`BudgetProgress`:**
- Builds `valueText` with `tCategoria.markup('gastadoDePresupuesto', { …, muted: (chunks) => chunks })`.
- Text line by level:

  | Level | Line under the bar |
  |---|---|
  | `ok` | Remaining text (unchanged) |
  | `warning` | `TriangleAlert size-4 text-warning-ink` + `t('nearLimit')` in `font-medium text-foreground` + `·` + remaining text |
  | `exceeded` | `CircleAlert size-4` + `t('overBudget', { monto: spent − amount })`, all `text-destructive font-medium` |

- New token `--warning-ink`: light `#8A5A00`, dark `#F0B429`, mapped as `--color-warning-ink`. The amber fill `#F0B429` is below 3:1 on white, which fails for a non-text icon. The contrast task confirms or adjusts the value.

**New keys** (params follow the existing `monto` convention):

| Key | es | en |
|---|---|---|
| `categoria.nearLimit` | Cerca del límite | Near limit |
| `categoria.overBudget` | {monto} por encima del presupuesto | {monto} over budget |

### D8 — Charts: less decoration, all months, values on demand

**`MonthlyBarsChart`:**
- Title row: `graficos.monthlySpend` only, in `font-display text-headline-sm`; `lastMonths` stays in the messages, unused.
- The inner plot box is removed; the plot sits in the card (`p-inset`, `h-44`).
- Colours: the `<defs>` gradient is removed. The current bar uses `var(--brand)` with `filter: drop-shadow(0 0 10px var(--hero-glow))` (transparent in light). The others use `var(--muted-foreground)` at `fillOpacity={0.25}` with no filter.
- `XAxis interval={0}`, ticks at 13px. The selected month's tick is `600` weight in brand ink when current, otherwise foreground.
- `const [selected, setSelected] = useState(currentMonth)`. `Bar onClick` selects the clicked entry's `month`. `LabelList` renders only for `selected`. Bars get `cursor: pointer`.
- `accessibilityLayer={false}`: Recharts 3 otherwise makes the SVG a keyboard stop with nothing to announce. The chart wrapper is `aria-hidden`, and a `sr-only` `<ul>` lists each month (long name and year) with its `Money` total.

**`CategoryPieChart`:**
- Title row: title only.
- Centre: "Total" plus `Money` (unchanged).
- Legend: dot, name and `format.number(slice.total / total, { style: 'percent', maximumFractionDigits: 0 })` in `text-body-sm`, guarded for `total > 0`.
- `accessibilityLayer={false}`. The legend is the text alternative.

*Alternatives rejected:*
- **Recharts `Tooltip`:** hover-first, it covers bars on a small screen.
- **Keeping all value labels at a smaller size:** still overlaps at 390px.
- **Amounts in the legend:** a third copy of the card totals.

### D9 — Material allowlist

| Element | Material |
|---|---|
| Top bar once scrolled | `.glass-bar`, tint raised from 45 % to 72 % (the contrast task's 72 % minimum) |
| Month picker (`role="dialog"`) | `.liquid-glass[role="dialog"]` (existing 88/74 % variant) |
| Account sheet + scrim | Unchanged |
| Month title, notice, hero, summary group, cards, charts | Opaque tokens, no `backdrop-filter` |

- The notice becomes `rounded-inner bg-muted`, with its close button `size-target` around a `size-8` visual.
- `.hero-card` loses its literal light-theme block and uses `--hero-border`, `--hero-start`/`--hero-end`, `--hero-shadow` and `--hero-highlight` for both themes. Those tokens already resolve per theme, so the `@variant dark` block goes too.
- `.text-glow-sm` and `.text-hero-accent` are deleted once unused (grep-verified).

### D10 — `pressable` utility for pressed and focus states

```css
@utility pressable {
  -webkit-tap-highlight-color: transparent;
  transition: scale 200ms var(--ease-spring), background-color 150ms ease-out;
  &:active:not(:disabled) {
    scale: var(--press-scale, 0.98);
    background-color: color-mix(in oklab, var(--foreground) 4%, transparent);
  }
  &:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { transition: none; }
}
```

- Applied to: category headers, summary columns, add rows, "Ver todos los gastos", "Colapsar todo", month title and chevrons, the avatar button and the notice close.
- Icon buttons set `[--press-scale:0.9]`.
- Buttons that already have their own selected fill (picker months, segmented options) keep their current `active:` scale.

*Alternative rejected:* per-component `active:` class strings, which are the source of today's inconsistency.

### D11 — Motion and account-menu clean-up

- **`AnimatedContent`:** before building the timeline, if `matchMedia('(prefers-reduced-motion: reduce)')` matches, run `gsap.set(el, { clearProps: 'transform,opacity', visibility: 'visible' })` and return. The choreography is otherwise unchanged.
- **Month picker** transition: gains `motion-reduce:transition-none`. **`animate-ping`** is removed.
- **Account menu:** the colour parts of `trackClassName`/`thumbClassName` (the `rgba` shadows, `dark:bg-white/[0.09]`, `dark:bg-black/25`, `bg-foreground/[0.05]`) move into `.segment-track` and `.segment-thumb` in `app/globals.css` using `light-dark()`. Layout and transition utilities stay in the component. The look is otherwise unchanged; the screenshot comparison confirms it.

### D12 — Architecture: the template is the mobile composition

| Layer | After this change | Desktop phase |
|---|---|---|
| `lib/data`, `DashboardData`, `DashboardActions` | Shared, unchanged | Shared |
| Atoms (`Money`, `CategoryDot`, `ProgressBar`, `Collapsible`, `Avatar`…) | Shared, container-sized | Reused |
| Molecules (rows, `AddRow`, `BudgetProgress`, `MonthSelector` variants, `MonthPicker`) | Shared | Reused; may add a variant |
| Organisms (`CategoryCard`, `SummaryGroup`, `FreeMarginCard`, charts, `AccountMenu`) | Shared, no viewport breakpoints added | Reused or swapped per composition |
| `templates/dashboard-template.tsx` | **Mobile composition**: order, sticky bar, disclosure defaults | A sibling desktop template; the page chooses. Shared UI state (open cards, open summary) is extracted into a hook then, not now |
| Tokens (`--text-*`, `--spacing-*`, `pressable`) | Mobile values | Desktop overrides `gutter`/`section` and uses `display` |

Rules for this change:
- No new `sm:`, `md:` or `lg:` layout classes. Existing ones stay: `FreeMarginCard` `sm:text-display`, `AccountMenu`'s anchored popover, the `#account-menu` media rule.
- Derived presentation values (percentage share, over-budget amount, cycle range) are one-line arithmetic or formatting in the component that shows them. Anything a second consumer needs (the bot, the desktop template) goes to `lib/data` in its own change.

### D13 — Deltas against restyle-dashboard-to-v0 and ARCHITECTURE.md §9

| Item | restyle-dashboard-to-v0 | ARCHITECTURE.md §9 | This change |
|---|---|---|---|
| Month control | 48px pill bar | "a title with arrows, not a bar" | Large title with arrows; compact in the pinned bar |
| Top bar | Not sticky | Sticky; transparent then frosted; month, avatar and logo | Sticky; transparent then frosted; month enters on scroll, centred |
| Hero content | Badge + income line | "A big card, on its own" | Label + number |
| Summary | Three cards + separate panel card | Three small cards that expand | One grouped surface, panel inside |
| Add row | Dashed box (#6) | Light `+` row, muted lime | Light `+` row, brand ink |
| Expense amount | Pill | Editable-looking surface once editing exists | Plain text until inline editing ships |
| Bar labels | Above every bar | — | Selected bar only |
| Pie legend | Amounts (#3) | No legend | Percentages |
| Expanded border colour (#2), avatar tint (#4), bars before pie (#8) | — | Differ from §9 | Unchanged |

### D14 — `DESIGN.md` follows the CSS

Update the `typography` front-matter to the D1 values. Add the D2 layout keys to `spacing`. Add two short prose rules:
- **Materials:** the D9 allowlist.
- **Hierarchy:** six sizes at most on a mobile screen; uppercase labels are not used for titles or values.

No other prose changes.

## Risks / Trade-offs

- **[Removing the badge and income line reverses a recent choice]** → They are listed in D13 and the proposal, so the user can reject them in review before apply. Income stays visible directly below.
- **[20px summary totals can overflow a 119px column from six digits]** → A task checks with a 999 999 value in devtools. If it overflows, the column switches to `text-tabular-numeric-md` when `total >= 100000`, a single presentational condition.
- **[The pinned bar covers anchors]** → `scroll-mt-20` on the expenses list; a scenario checks it.
- **[The `IntersectionObserver` margin must match the bar height]** → Both come from one constant in the template (56px = `h-14`).
- **[Keeping disclosure content mounted adds DOM]** → About 35 rows in total. `inert` keeps them out of the tab order and the accessibility tree.
- **[Tap-to-select bars is not discoverable]** → The default already shows the current month's value, and all values are in the screen-reader list. Selection is an enhancement, not the only access.
- **[Rounded percentages don't sum to 100]** → Accepted for a distribution legend.
- **[Raising the glass-bar tint reduces the frosted look]** → The contrast requirement takes priority. The task picks the lowest tint that passes.
- **[`accessibilityLayer={false}` removes Recharts keyboard navigation]** → It had no tooltip to announce. The `sr-only` list replaces it.
- **[`AnimatedContent` still hides content until JS runs when motion is allowed]** → Out of scope and flagged. Reduced-motion users get immediate content.
- **[Restyle and land changes are unarchived, so these deltas have no base spec yet]** → Archive order: `land-finance-dashboard`, then `restyle-dashboard-to-v0`, then this change (final task).
- **[Token value changes ripple into the account sheet and picker]** → The sheet and picker are in the screenshot and minimum-size checks.

## Migration Plan

Visual and component-only. No data, route, action or schema change.

Apply order:
1. Tokens and global CSS
2. Messages
3. Atoms and molecules
4. Organisms
5. Template
6. Docs
7. Verification

Intermediate commits may look inconsistent, but no behaviour breaks between them. Rollback: revert the change's commits.

## Open Questions

- ARCHITECTURE.md §9 still describes the month control, hero, summary cards and legend as before (D13). Updating that document can follow implementation without affecting these specs or tasks.
