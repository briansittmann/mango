## 1. Baseline

- [x] 1.1 Write a reusable audit script in the scratchpad for the browser-automation skill. It runs at 390 × 844 for es/en × light/dark.
  - **Screenshots**, one per state:
    - top of page, all collapsed
    - scrolled halfway
    - income panel open
    - "comida" card open
    - "Transporte" card (over budget)
    - charts
    - month picker open
    - account sheet open
  - **Output** (JSON):
    - distinct visible font sizes
    - visible text under 12px
    - buttons, links and radios under 44px in either dimension
    - bordered rounded surfaces (border ≥ 1px, radius ≥ 12px, height ≥ 64px) inside another such surface
    - elements whose `backdrop-filter` is not `none`
    - elements with a `text-shadow` or a `drop-shadow` filter
    - running animations with infinite iterations
    - console errors

  Run it on the current build and save `before.json` and the PNGs. Verify: 32 PNG files exist, and `before.json` records the baseline (10 font sizes, 4 targets under 44px, blur on the notice and the month pill).

## 2. Tokens and global CSS

- [x] 2.1 Apply the design D1 type-scale values in `app/globals.css`. Verify:
  - `npm run build` passes.
  - On `/demo`, devtools-injected spans compute:
    - `text-headline-lg`: 28px/34px/700
    - `text-headline-md`: 20px/26px/600
    - `text-headline-sm`: 17px/22px
    - `text-tabular-numeric-lg`: 20px
    - `text-tabular-numeric-md`: 16px
    - `text-body-sm`: 13px/18px
    - `text-label-caps`: 12px
    - `text-display-mobile`: weight 700
  - Remove the spans afterwards.
- [x] 2.2 Add the D2 `--spacing-*` tokens in `@theme` and the D10 `@utility pressable`. Verify on `/demo` with injected elements:
  - `px-gutter` computes 16px padding.
  - `mt-section` computes 32px margin.
  - `gap-stack` computes 12px.
  - `min-h-row` computes 48px.
  - `size-target` computes 44 × 44.
  - A `<button class="pressable">` computes `scale: 0.98` while `mouse.down()` is held, and back to none after `mouse.up()`.
  - Tabbing to that button shows a 2px solid outline in `--ring`.
  - Under `emulateMedia({ reducedMotion: 'reduce' })`, its `transition-duration` is `0s`.
- [x] 2.3 Effect and colour tokens (D4, D7, D9, D11):
  - `.hero-card` uses only `--hero-border`, `--hero-start`/`--hero-end`, `--hero-shadow` and `--hero-highlight` in both themes. Delete the literal light block and its `@variant dark` block.
  - Set the light `--hero-end` to brand 8 % over white.
  - Raise the `.glass-bar` tint to 80 %.
  - Add `--warning-ink` (`#8A5A00` / `#F0B429`) and `--color-warning-ink`.
  - Add `.segment-track` and `.segment-thumb` carrying the colours currently inlined in `organisms/account-menu.tsx`, expressed with `light-dark()`.

  Verify:
  - `npm run build` passes.
  - `grep -nE "167, 243, 208|16, 185, 129|224, 242, 254" app/globals.css` prints nothing.
  - In light theme, every colour in `.hero-card`'s computed `background-image` matches a resolved mix of `--card`/`--brand`.
  - The dark hero screenshot still shows the corner glow.
- [x] 2.4 Contrast pass: write or extend a scratchpad script that checks both themes against a 4.5:1 minimum for text and 3:1 for icons:

  | Colour | Against |
  |---|---|
  | `muted-foreground` | `card`, `muted`, `background` |
  | `brand-ink` | `card`, `background` |
  | `destructive` | `card` |
  | `warning-ink` (icon, 3:1) | `card` |
  | `foreground` | `muted` |
  | `foreground` on `.glass-bar` | the bar composited over `brand`, `card` and `background` |

  Set the glass-bar tint to the lowest value that passes, with a 72 % minimum. If any value changes, update `app/globals.css` and the matching table in `design.md`. Verify: the script's output table shows every pair passing.

## 3. Messages

- [x] 3.1 Add `categoria.nearLimit` and `categoria.overBudget` (design D7) to `messages/es.json` and `messages/en.json`. The keys `dashboard.available` and `dashboard.freeMarginIncome` are removed later, in 5.1. Verify: `npx tsc --noEmit` passes (`messages/parity.ts`).

## 4. Atoms and molecules

- [x] 4.1 Create `components/atoms/collapsible.tsx` (D6). Move `molecules/demo-notice.tsx` onto it, with an opaque `rounded-inner bg-muted` surface and a `size-target` close button (D9). Verify:
  - `npx tsc --noEmit` and `npm run lint` pass.
  - On `/demo`, the notice has `backdrop-filter: none` and a background alpha of 1.
  - Its close button is ≥ 44 × 44.
  - Dismissing it animates `grid-template-rows`, and afterwards Tab never lands inside it.
- [x] 4.2 Atoms:
  - `category-dot`: flat colour.
  - `progress-bar`: solid token colour, `role="progressbar"`, `aria-valuemin`/`aria-valuemax`/`aria-valuenow`, and a `valueText` prop for `aria-valuetext`.
  - `money`: `signDisplay` prop applied in both formatting branches.
  - `avatar`: initial in `text-label-ui font-semibold`, with `text-xs` removed.

  Verify:
  - `grep -nE "white|black|gradient|text-xs" components/atoms` prints nothing.
  - `npx tsc --noEmit` and `npm run lint` pass.
  - On `/demo`, the "comida" bar has `role="progressbar"` and `aria-valuenow="77.5"`.
- [x] 4.3 `molecules/budget-progress.tsx` levels (D7): pass `valueText` built with `t.markup`; show the warning line (`TriangleAlert`, `nearLimit`, `·`, remaining text) and the exceeded line (`CircleAlert`, `overBudget` with spent − amount). Verify on `/demo`:
  - Spanish:
    - "Ocio" shows the triangle icon and "Cerca del límite · Te quedan 6 € por semana".
    - "Transporte" shows the circle icon and "30 € por encima del presupuesto" in `--destructive`, with no "0 €" text.
    - "Comida" is unchanged, and its bar's `aria-valuetext` contains "310 € de 400 €".
  - English: "Near limit" and "€30 over budget".
- [x] 4.4 Rows and add row (D7):
  - `expense-row` and `summary-row`: plain amounts, `min-h-row px-inset`; `summary-row` loses the 32px circle and gains `signed`.
  - `add-row`: left-aligned `pressable` row in `text-brand-ink`, with no border or background.

  Verify on `/demo` with "comida" and income open:
  - Every expense amount has a transparent background and 0px border.
  - Every row and add row is ≥ 48px tall.
  - Add rows have `border-style: none`, a transparent background and a text colour equal to `--brand-ink`.
- [x] 4.5 Extract `molecules/month-picker.tsx` and give `molecules/month-selector.tsx` its `title` and `compact` variants (D3). Remove `animate-ping`, add `motion-reduce:transition-none` to the picker, and render the cycle range with `format.dateTimeRange` in UTC. Pass `variant="title"` plus the cycle start and end from the template's existing slot so the build stays green; the header restructure happens in 6.1. Verify:
  - `npx tsc --noEmit` and `npm run lint` pass.
  - Activating the title opens the picker. September has `bg-primary`, weight 600 and `aria-current`. October–December are disabled.
  - Escape and an outside press both close the picker.
  - Previous/next and the title button are ≥ 44 × 44.
  - The title button's accessible name contains "septiembre" and "Seleccionar mes".
  - `grep -rn "animate-ping" components` prints nothing.

## 5. Organisms

- [x] 5.1 Reduce `organisms/free-margin-card.tsx` to label + number (D4): remove the badge, label dot, divider, income line and the `income` prop and its template argument. Delete `dashboard.available` and `dashboard.freeMarginIncome` from both message files. Verify:
  - `npx tsc --noEmit` passes.
  - At 390px the card contains no badge and no "2.820 €".
  - The number is 44px Manrope 700 and the largest text on the page.
  - The card is under 130px tall.
- [x] 5.2 Create `organisms/summary-group.tsx` (D5), delete `organisms/summary-card.tsx`, and rewire the template's three panels: income without a header row, expenses unchanged, savings with an "Acumulado" row, `signed` movements and no repeated cycle total. Verify on `/demo`:
  - One bordered surface contains the columns and the open panel, and the panel is as wide as the surface.
  - The open column has `aria-expanded="true"`, a rotated chevron and the indicator mark, which no closed column has.
  - Opening savings closes income.
  - "2.820 €" appears exactly once inside the group while income is open.
  - Deposits show "+" and withdrawals show "−".
  - The expenses panel is sorted by total, descending.
  - Closing a panel animates its height.
  - Column totals compute 20px in `--foreground` with no `text-shadow`.
  - With a devtools-set total of 999 999, the value stays inside its column. If it doesn't, apply the design *Risks* fallback and re-check.
- [x] 5.3 Update `organisms/category-card.tsx` (D7):
  - `pressable` header with `aria-expanded`/`aria-controls` and `min-h-14 px-inset`.
  - Name in `text-body-lg font-medium`; amount in `text-tabular-numeric-md font-semibold` with `text-lg` removed.
  - `Collapsible` body with an edge-to-edge `AddRow`.

  Verify on `/demo`:
  - While collapsed, Tab moves from one card header straight to the next header.
  - When open, the border colour equals the dot colour.
  - The header is ≥ 56px tall; the name computes 16px/500 Inter and the amount 16px/600.
  - Holding the mouse down on a header computes `scale: 0.98`.
  - Two cards can be open at once.
  - Opening animates the height over several frames; under reduced motion it opens at full height immediately.
- [x] 5.4 Update `organisms/monthly-bars-chart.tsx` (D8). Verify at 390px:
  - Six tick labels are rendered, and no two bounding boxes overlap.
  - Exactly one value label is visible, above September: "1,7 mil" in es, "1.7K" in en.
  - Tapping the August bar moves the label to August, and the August tick computes weight 600.
  - The September bar's fill resolves to `--brand`.
  - In dark theme, only the September bar has a `drop-shadow` filter; in light theme that filter's colour is transparent.
  - The card has no inner rounded surface.
  - A `sr-only` list has six items, each with a month and its total.
  - No element in the chart has `tabindex="0"`.
- [x] 5.5 Update `organisms/category-pie-chart.tsx` (D8). Verify:
  - The title row contains no amount, and "1.700 €" appears once in the card.
  - The legend has seven entries in card order: "Gastos fijos 53 %" and "Comida 18 %" in es, "18%" in en.
  - No element in the chart has `tabindex="0"`.
- [x] 5.6 Replace the colour parts of `trackClassName`/`thumbClassName` in `organisms/account-menu.tsx` with `.segment-track`/`.segment-thumb` (D11). Verify:
  - `grep -nE "rgba?\(|#[0-9A-Fa-f]{3,8}\b|\b(white|black)\b" components/organisms/account-menu.tsx` prints nothing.
  - Account-sheet screenshots in light and dark match the 1.1 ones apart from the 2.1 text-size changes.
  - Choosing English keeps `/demo`.
  - Choosing light survives a reload on a dark-emulated OS.
- [x] 5.7 Make `components/ui/animated-content.tsx` honour reduced motion (D11). Verify:
  - Under `emulateMedia({ reducedMotion: 'reduce' })`, right after load and without scrolling, every wrapper has `visibility: visible` and no transform.
  - Without emulation, a screenshot 200ms after load still shows the hero offset mid-entrance.

## 6. Template

- [x] 6.1 Rebuild the header in `templates/dashboard-template.tsx` (D3):
  - Sticky `h-14` bar with the logo, a wordmark/compact-selector slot and the avatar.
  - Title block with `MonthSelector variant="title"`.
  - `IntersectionObserver` driving the glass layer and the swap, with the 56px margin shared with the bar height through one constant.
  - Remove `scrolled`, the scroll listener, `-top-[76px]` and the avatar `top` transition.

  Verify at 390px:
  - **At the top:** the glass layer has opacity 0, the wordmark is visible, and Tab never reaches the compact selector.
  - **Once the title is under the bar:** the glass layer has opacity 1 and a `backdrop-filter`, the compact month and chevrons are visible, and the wordmark is `inert`.
  - **Avatar:** its bounding box is identical in both states.
  - **Title line:** in es, the title is "Septiembre" at 28px Manrope 700, and the line under it contains "en curso" and a range covering 1 and 30 September. In en, it shows "in progress" and an English range.
  - **Motion:** the swap animates visibly by default and is instant under reduced motion.
  - **Clean-up:** `grep -n "scrollY\|-top-\[76px\]" components/templates/dashboard-template.tsx` prints nothing.
- [x] 6.2 Recompose the body (D2, D5, D7):
  - Spacing: `px-gutter`, `mt-stack` (hero → summary group), `mt-section` (expenses and charts sections), `gap-stack` (cards and charts).
  - Expenses title in `font-display text-headline-md`, sentence case.
  - "Colapsar todo" as a `pressable` `min-h-target text-body-lg font-medium text-brand-ink` text button, rendered only while at least one card is open.
  - `scroll-mt-20` on the card list.
  - Once `grep -rn "text-glow-sm\|text-hero-accent" components` prints nothing, delete both classes from `app/globals.css`.

  Verify at 390px, all collapsed:
  - Horizontal gutters are 16px on both sides.
  - Vertical gaps: summary group → expenses title 32px, last card → first chart 32px, hero → summary group 12px, card → card 12px.
  - "Colapsar todo" is absent with no card open, present after opening "comida", and absent again after activating it.
  - After "Ver todos los gastos", the first card's top edge is below the bar's bottom edge.
  - `npm run build` passes.

## 7. Docs

- [x] 7.1 Update `DESIGN.md` (D14): typography front-matter set to the D1 values, the D2 keys added to `spacing`, and short *Materials* and *Hierarchy* rules. Verify:
  - Every `typography` entry's size, line height and weight equals the matching `--text-*` value in `app/globals.css` (a scratchpad script prints the comparison with zero mismatches).
  - `git diff --stat DESIGN.md` shows only those sections changed.

## 8. Verification

- [x] 8.1 Re-run the 1.1 script, saving `after.json` and the after screenshots. Walk through every scenario in this change's `specs/` on `/demo` in es/en × light/dark. Verify:
  - At most 6 font sizes while collapsed.
  - No text under 12px with the picker or the sheet open.
  - 0 targets under 44px in every listed state.
  - 0 nested surfaces, both collapsed and with income + "comida" open.
  - `backdrop-filter` only on the scrolled bar, the picker, the sheet and its scrim.
  - Glow only on the hero number and card, and on the September bar in dark; none in light.
  - No infinite animations.
  - Hierarchy order holds.
  - The reduced-motion scenario passes.
  - No console errors or hydration warnings.
  - Every state has a before/after screenshot pair.
- [x] 8.2 Guards: run the land-finance-dashboard 6.1 greps unchanged, plus these:

  | Command | Expected |
  |---|---|
  | `grep -rnE "text-\[[0-9.]+(px\|rem)\]\|\btext-(xs\|sm\|base\|lg\|[0-9]?xl)\b" components` | nothing |
  | `grep -rnE "rgba?\(\|hsla?\(\|#[0-9A-Fa-f]{3,8}\b\|\b(white\|black)\b" components` | nothing |
  | `grep -rln "liquid-glass" components` | only `molecules/month-picker.tsx` and `organisms/account-menu.tsx` |
  | `grep -rln "glass-bar" components` | only `templates/dashboard-template.tsx` |
  | `grep -rn "animate-ping\|text-glow-sm\|text-hero-accent\|summary-card" app components` | nothing |
  | `git diff main -- components \| grep -E "^\+.*\b(sm\|md\|lg):"` | nothing (no new viewport layout variants, D12) |

  Verify: each command prints what the table expects, and `npm run lint` passes.
- [x] 8.3 Final gate: run `npx tsc --noEmit`, `npm run lint`, `npm run build` and `openspec validate refine-mobile-ui-apple-hig --strict`. Then check whether `openspec/specs/dashboard-ui/spec.md` and `openspec/specs/theming/spec.md` exist. Verify: all four commands pass. If either spec file is missing, tell the user to archive `land-finance-dashboard`, then `restyle-dashboard-to-v0`, before archiving this change.
