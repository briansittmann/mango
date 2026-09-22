## Why

ARCHITECTURE §9 describes the savings card as *"total del mes, saldo acumulado, **progreso hacia la meta**, movimientos individuales"*. Three of those four exist. There is no meta, so there is nothing to progress towards, and the card is the only one on the dashboard that answers *how much* without answering *how much of what*.

Every other number on the screen has a frame of reference. A category with a budget gets a bar and "180 € de 400 €". The free margin is deliberately frameless — §9 says so, because a margin has no ceiling to break. Savings is the opposite case and has been treated like the margin by omission: **a savings amount is meaningless without an intention**, and 146 € in a month is either good or bad depending on a number the app never asks for.

This change asks for that number once, per user, and spends the rest of its budget making the card read like the rest of the dashboard.

## How the card is built today

Everything below already works on `/demo`, and this change modifies it rather than replacing it.

**The surface.** The savings card is not a card. It is the third column of one grouped surface, `components/organisms/summary-group.tsx`: a `rounded-card border bg-card` wrapper holding a `grid grid-cols-3 divide-x` of three tile buttons, and below them one shared `Collapsible` panel (`id="summary-group-panel"`). Only one panel is open at a time; `SummaryGroup` keeps `lastKey` so the closing panel keeps its content while its height animates down.

**The tile.** Each tile is a `pressable` button carrying a muted label, an `ExpandChevron`, and the cycle total rendered by `AnimatedAmount` (`places={TOTAL_PLACES}`), which rolls from 0 on mount through the `Counter` in `components/ui/counter/`. The open tile gets a 2px lime indicator bar across its bottom inset and `aria-expanded`. Savings is the third of the three, so `[aria-controls="summary-group-panel"]:nth-child(3)` is how the existing `tests/animated-amount.spec.js` addresses it.

**The panel.** `components/templates/dashboard-template.tsx:1146-1170` builds it as a flat `flex flex-col`:

1. One `SummaryRow` with `name={tResumen('acumulado')}` and `amount={data.savings.accumulated}` — identical in every visual respect to the rows under it. No date, no colour dot, no `onClick`, so it renders as a `div`, not a button.
2. One `SummaryRow` per `data.savings.movements` entry, each with the movement name, a `ShortDate` under it, and `signed` — which sets `signDisplay: 'exceptZero'` on the `Money` atom, so `Intl` produces the locale's own sign glyph and its own spacing. In `es-ES` a withdrawal of −80 comes out as **"-80 €"** with the sign attached, but the row is `text-tabular-numeric-md` and the minus is a hyphen whose advance width is narrower than a tabular digit, so the column of amounts does not align on the sign and the negative row reads as if it had a gap. That is the "- 80 €" the brief points at.
3. An `AddRow` with `label={t('anadirMovimientoAhorro')}` wired to `actions.addSavingsMovement`, which on `/demo` is `showUnavailable` — it opens the "not in the demo" toast. Deposits and withdrawals cannot be created; only the shape is real.

**The data.** `DashboardData.savings` in `lib/data/dashboard.ts` is `{ cycle, accumulated, movements }`, built in `lib/demo/demo-data.ts` from three movements: +176 "Ahorro mensual", −80 "Retiro emergencia", +50 "Bono ahorro". So `cycle` is 146 and `accumulated` is 2.500 + 146 = 2.646. `deriveDemoData` reads `base.savings.cycle` to compute `freeMargin = income − expenses − savings`, and touches nothing else in the object. There is no savings mutation contract in `lib/data/` — savings is the one panel with no `*Mutations` type behind it.

**What is missing.** No target anywhere: not in `usuarios`, not in `presupuestos`, not in the type, not in the demo. No per-cycle savings history, so nothing can be plotted over time. No bar, and no reference number of any kind.

## What Changes

### A) One target per user, on `usuarios` — not in `presupuestos`

```sql
-- 0016_usuarios_meta_ahorro.sql
alter table usuarios
  add column meta_ahorro_mensual numeric(12,2)
    check (meta_ahorro_mensual is null or meta_ahorro_mensual > 0);
```

Nullable, and null is the resting state: a user who has never set one gets today's card exactly, with no bar and no caption. The next free migration number is **0016**, not 0014 — `0014_categorias_colores_extra.sql` and `0015_movimientos_recurrentes.sql` landed after 0013.

**Why not a `presupuestos` row**, which is where a "monto per period per user" would seem to belong:

1. **It does not fit the table's shape.** `presupuestos.categoria_id` is `not null references categorias(id)`. A savings target has no category. Making the column nullable to hold one row that is not about a category would then break the table's only real invariant: `unique (usuario_id, categoria_id, periodo)` does not dedupe rows where `categoria_id is null`, because Postgres treats NULLs as distinct in a unique index. One user could accumulate an unbounded number of savings targets and nothing in the schema would object. Fixing that needs a partial unique index added alongside — two schema changes to a healthy table, to avoid one column on another.
2. **It has the opposite polarity.** A budget is a ceiling you are trying not to cross, and crossing it is what produces the `warning` and `exceeded` levels that own amber and red. A savings target is a floor you are trying to reach, and exceeding it is the good outcome. Same numbers, opposite reading. Sitting in the same table invites `getBudgetStatus` to be pointed at it, which would colour a *successful* month red at 100 %.
3. **§9 draws a line the table would blur.** Budgets explicitly do not subtract from the free margin — they only track. Savings already does subtract (`freeMargin = ingresos − ahorro − gastos`). A row in `presupuestos` that belongs on the other side of that equation is a trap for the first query that sums the table.
4. **It is a per-user setting, and `usuarios` already holds those.** `dia_inicio_ciclo`, `recordatorio_diario`, `modo_confirmacion`, `moneda_default` — one value, no history, no period fan-out. The target is the same kind of thing.

**The cost, stated:** a column on `usuarios` keeps no history. Raising the target from 300 to 400 re-frames every past cycle's bar against 400. Accepted: the target is a current intention, not a ledger entry, and the bar is only ever drawn for a cycle the user is looking at now. The day a per-cycle target is genuinely wanted, it is `metas_ahorro (usuario_id, ciclo_mes, monto)`, which is a new table either way — not a `presupuestos` row we would then have to migrate out.

**Through the layers.** `DashboardData.savings` gains `target: number | null`, and `lib/demo/demo-data.ts` sets it to **300**. The component receives it as data and never holds a number of its own — the same rule `dashboard-ui`'s "renders only supplied data" already enforces everywhere else. **No editing UI in this change**: there is nowhere on the dashboard to set the target yet, so the demo seeds it and the real path waits for onboarding (Out of scope).

### B) `getSavingsProgress`, a pure function beside `getBudgetStatus`

`lib/data/savings.ts`:

```ts
export type SavingsProgress = {
  target: number
  deposited: number    // sum of movements > 0
  withdrawn: number    // sum of |movements < 0|
  net: number          // deposited − withdrawn
  netRatio: number     // net / target, floored at 0
  depositedRatio: number
  reached: boolean     // net >= target
}

export function getSavingsProgress(
  { target, movements }: { target: number; movements: { amount: number }[] },
): SavingsProgress
```

Same shape of contract as `getBudgetStatus`: plain inputs, no dates, no formatting, no clamping of the raw figures — only the two ratios are bounded, so a caller reading `net` always gets the truth and a caller drawing a bar always gets something between 0 and 1. On the demo's three movements it returns `deposited: 226, withdrawn: 80, net: 146, netRatio: 0.486…, depositedRatio: 0.753…, reached: false`.

`target` is non-null in the signature on purpose: **no target means no progress object**, so the caller decides at the call site and the function never invents a denominator. The card renders the bar when it has a `SavingsProgress` and renders today's card when it does not.

### C) The bar, in the tile

The savings tile gains, under its total: a 6px fully-rounded track, and under that a muted caption reading **"146 de 300"**.

This is the placement decided at review, against putting it at the top of the panel, and it has consequences worth naming:

- It **keeps `dashboard-ui`'s "A panel SHALL NOT repeat its column's total"** intact. A header inside the panel would have had to repeat 146 € to sit above the bar, and that requirement would have needed reversing.
- The three tiles are one grid row, so **all three columns grow** by the height of the bar and caption. Income and expenses gain bottom padding, not content. That is a visible change to the whole summary surface, and the spec delta says so rather than letting it arrive as a surprise.
- The bar is therefore **visible while the card is collapsed**, which is where the progress is most useful and which the panel placement could not offer.

**Colour.** The track is `--foreground/10` (the existing `ProgressBar` track) and the fill is **`var(--brand)`**, always — never `--warning`, never `--destructive`. Those two belong to budget state and nothing else, which the delta to `design-system` states as a rule rather than leaving to habit.

> The brief asks for the fill to be lime `#C3E86B`. It will be `var(--brand)`, not that literal: `theming`'s first requirement forbids literal colour values in components outright, and `#C3E86B` **is** the brand lime it names. The shipped token evaluates to `#149052` in light and `#84CC16` in dark — a drift from the spec's palette that `add-expense-sheet` recorded and `restyle-dashboard-to-v0` is mid-way through settling. Hardcoding the hex here would make this card the one place the theme cannot reach, and would read as a different green from the indicator bar 6px above it. If the token's value is wrong, that is one line in `globals.css` and every lime on the dashboard moves together.

**Withdrawals are drawn, not netted away.** The fill runs to `depositedRatio` (75 % on the demo), and its last stretch — exactly `withdrawn / target` wide — is diagonally hatched in muted grey, so the solid lime stops at `netRatio` (49 %). A user who put in 226 and took out 80 sees both facts in one 6px line, instead of a bar that silently shortened. The hatch is a `repeating-linear-gradient` on the fill's tail segment, at 45°, in `--muted-foreground` at low alpha — no image, no SVG pattern, and it inverts with the theme because it is a token.

**Reached.** When `net >= target`, a small check sits at the end of the track and the caption still reads both numbers ("312 de 300"). No confetti, no colour change, no size change — the bar is already full, which is the loud part.

**Accessibility.** `role="progressbar"` with `aria-valuenow` on the **net** ratio and an `aria-valuetext` that spells out both figures with their currency. The visible caption drops the currency symbol — it is on the total directly above, and at 390px the tile is 122px wide, so "146 € de 300 €" wraps where "146 de 300" does not. This deliberately differs from the category card's caption, which has a full-width header to spend.

### D) The "Acumulado" row stops looking like a movement

Today it is a `SummaryRow` among `SummaryRow`s, distinguished by nothing. It becomes its own block: the label in `text-muted-foreground`, the amount in regular weight rather than the row weight, and extra space between it and the list below, so the eye reads *balance, then this cycle's activity* instead of four equal rows.

Between the label and the amount, a **sparkline**: Recharts, ~80 × 24px, a lime stroke, no axes, no grid, no dots, no tooltip — the accumulated balance across the last 6 cycles. It answers "is this going up?" without a screen, a sheet or a number.

This needs data the type does not have, so `savings` gains `history: { month: string; accumulated: number }[]` — the same `{ month, total }` shape the expense chart's `history` already uses, so the demo builds it the same way and the real query will too. The demo's six entries end at 2.646, matching `accumulated`.

**No chevron and no tap target.** The row is richer but still inert; making it openable is the next change.

### E) Movements read as deposits and withdrawals

Each movement row gains a **28px circle** on its left holding an arrow: up for a deposit, down for a withdrawal, on `--muted` — a surface a step lighter than the card in dark and a step darker in light, which is what that token already does for every other inset surface. It occupies the slot the category dot occupies in the expenses panel, so the three panels keep one row grammar.

The amounts get fixed:

- A deposit is `+` in `--brand-ink` (lime as text, which is the token that passes contrast in the light theme; `--brand` as text does not).
- A withdrawal is **U+2212 MINUS SIGN**, not a hyphen, in the regular `--foreground`. **Never red** — a planned withdrawal is not an error, and red here would say the user did something wrong by spending their own savings. §9 makes the same argument for why a withdrawal is a negative savings movement rather than an expense.
- U+2212 is a tabular-width glyph, so the sign column aligns and the "- 80 €" gap closes as a consequence of the character, not of a margin hack.
- Every amount keeps `tabular-nums` and right alignment, including the accumulated figure above them.

`Money`'s `signDisplay` cannot produce this — `Intl` chooses the glyph per locale and `es-ES` gives a hyphen — so the row composes the sign itself and passes `Math.abs(amount)` to `Money`. The rendered string stays locale-formatted; only the sign is ours.

### F) Motion

- **The bar fills from 0** on first reveal, through the `ProgressBar` atom's existing `IntersectionObserver` gate, ~600ms on `--ease-out`.
- **Rows enter with a 40ms stagger** when the panel opens, on a gsap timeline, inside the height animation the `Collapsible` already runs.
- **Reduced motion** renders the final state immediately — the bar at its width, the rows in place — following the branch `AnimatedContent` and `ProgressBar` already take (`matchMedia` read once, `gsap.set(..., { clearProps })`).
- `gsap` only. No new animation dependency.

> **Two deviations from the brief, both forced by the tile placement.** The brief asks for the bar to fill *on expand*; in the tile it is visible before the panel is ever opened, so it fills when it first comes into view — which on `/demo` is on load. And the total already counts up from 0 on mount via `AnimatedAmount`; re-rolling it on every expand would re-animate a number that did not change and would contradict what `tests/animated-amount.spec.js` asserts. The count-up stays where it is. Say the word at review and the bar can instead hold at 0 until the panel is first opened.

### G) Strings

New keys in `messages/es.json` and `en.json` under `resumen`: the "X de Y" caption, the target-reached label for the check's accessible name, the bar's `aria-valuetext`, the sparkline's accessible description, and the deposit/withdrawal names for the movement icons. `resumen.deposito` and `resumen.retiro` already exist and are reused.

## Capabilities

### New Capabilities

_None._ The savings card is already specified inside `dashboard-ui`'s "Summary cards" requirement, and a target that exists to frame that one card does not earn a capability of its own. Splitting it out would put the savings panel's contents in two documents.

### Modified Capabilities

- `dashboard-ui`:
  - **MODIFIED — Summary cards** → the column description admits one thing below the savings total and nothing below the other two; the savings panel's contents are re-specified as an accumulated block with a sparkline plus movements with their icon and sign rules. The existing "Signed savings movements" scenario is tightened from "a minus sign" to U+2212 in the regular text colour, with no gap after the sign.
  - **ADDED — Savings progress towards a monthly target** → the target as optional supplied data, the track, the hatch, the caption, the check, the bounding rules for a net above the target and below zero, and the rule that an absent target hides the bar rather than disabling the column.
  - **ADDED — Savings target and history on the demo** → the sample carries a target of 300 and six cycles of accumulated balance, with the savings total, the accumulated balance, the free margin and every expense figure unchanged, and the add control still showing the demo message.

  *"Public demo route" and "Mobile visual hierarchy" are deliberately not modified.* The demo requirement's sample list and the hierarchy's size ordering both stay true as written; what this change adds to them is new behaviour, which belongs in an ADDED requirement rather than in a 140-line verbatim re-statement of an existing one. The constraints those two requirements impose — the caption must reuse an existing metadata font size, the movement icon must not be a nested surface — are carried as scenarios on the new requirements instead, so they are still tested.
- `design-system`:
  - **ADDED — A progress bar's colour says what it measures** → a bar measuring spend against a ceiling takes the ok/warning/exceeded ramp; a bar measuring accumulation towards a target is brand at every value. Amber and red are reserved to budget state. This is the rule the brief states as "never amber or red", written where the next bar will look for it.
  - **MODIFIED — Motion respects user preference** → a bar filling once on first reveal and a panel's rows entering with a stagger join both branches of the existing list, with the "no endless animation" scenario extended to the check mark.
  - **MODIFIED — Touch targets** → a decorative mark in a row is named as not a control, so the 28px icon is exempt from the 44px minimum while the row it sits in still has to clear 48px; the row-height scenario is extended to the savings panel.

`theming` and `localization` are **not** modified: every colour is an existing token and every string goes through `messages/*.json`, which both capabilities already require of all new work.

## Impact

- **Database:** one migration, `0016_usuarios_meta_ahorro.sql`. One nullable column, no table created, nothing altered.
- **Data contract:** new `lib/data/savings.ts` (`SavingsProgress`, `getSavingsProgress`); `DashboardData.savings` in `lib/data/dashboard.ts` gains `target: number | null` and `history`.
- **Components:** new `components/molecules/savings-progress.tsx` (bar + caption), `components/molecules/savings-movement-row.tsx` and `components/atoms/savings-sparkline.tsx`; `summary-group.tsx` gains an optional slot under a tile's total; `dashboard-template.tsx` builds the savings panel from the new pieces. `ProgressBar` gains an optional second segment for the hatch — the budget bar's behaviour is untouched.
- **Demo:** `lib/demo/demo-data.ts` gains `target: 300` and six history points; `deriveDemoData` carries both through unchanged.
- **Tests:** a new `tests/savings-progress.spec.js` covering both the pure function (four cases) and the rendered card. **No unit-test runner is added** — decided at review: the function's cases run as plain assertions inside a Playwright spec, so `npm test` stays the one command. `tests/animated-amount.spec.js` addresses the savings tile by `nth-child(3)` and must keep passing.
- **Messages and docs:** new keys in both catalogues; ARCHITECTURE §8 gains `meta_ahorro_mensual` in the `usuarios` list, and §9's savings bullet stops being aspirational.
- **Dependencies:** none. `recharts` and `gsap` are already in `package.json`.
- **Technical debt touched:** the *"UI de ahorro"* entry in CLAUDE.md is narrowed, not cleared — the panel stops being read-only in appearance but "Añadir movimiento de ahorro" still shows the demo message, because no `SavingsMutations` contract exists yet.

## Out of scope

- **`add-savings-history-sheet`** — tapping "Acumulado" to open a sheet with the full history, and the "Ajustar saldo" action that records an opening balance or accrued interest as an adjustment movement. That is why the row gets no chevron and no tap target here: an inert row that grows a chevron later is honest, a chevron that does nothing is not.
- **Asking for the target during onboarding** (screen 4), and any UI for editing it. The column exists, the demo seeds it, nothing writes it.
- **`SavingsMutations`** — creating, editing and deleting savings movements, with the swipe-and-undo the expense and income panels have. "Añadir movimiento de ahorro" stays a demo notice.
- **Multiple goals or savings pots** — discarded, not deferred. One number per user is the product decision, and the model above is deliberately the cheapest one to hold it.
- **Per-cycle target history** — see (A). The bar re-frames the past when the target changes, and that is accepted.
- **The real Supabase read.** `resumenMensual` does not exist; `target` and `history` reach the component through the demo only, like every other field on `DashboardData`.
