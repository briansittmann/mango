## Context

See proposal.md → *Why*. What follows is only the state of the code and the documents that shapes the approach.

### Current code

- **`lib/data/dashboard.ts:27-36`** — `ExpenseGroup.kind` is `'fixed' | 'category'` and `name` is `string | null`, the null standing for the fixed group, whose label is resolved from `dashboard.gastosFijos` in four separate places (`category-card.tsx:42`, `dashboard-template.tsx:152,322`, `category-pie-chart.tsx:52`). `Expense` is `{ id, name, amount, date }` and carries no recurrence at all: the day of the month and the pending/confirmed state exist in the database and stop at the data layer.
- **`components/organisms/category-card.tsx`** — one component already renders both kinds, branching on `group.kind` twice: the options control and the add row. Both branches disappear with this change.
- **`components/atoms/collapsible.tsx`** — a grid-rows/opacity disclosure at 200ms `ease-drawer`, with `motion-reduce:transition-none` and `inert` while closed. It already satisfies the 200–250ms ease-out requirement and the reduced-motion rule, so the new card reuses it rather than animating anything itself.
- **`components/atoms/expand-chevron.tsx`** — turns `text-brand-ink` when open. Brand ink is the lime; the new card cannot use this atom as it stands.
- **`components/molecules/expense-row.tsx:20-23`** — the editable affordance is exactly `rounded-lg bg-muted px-2 py-0.5` applied to the amount only when `onActivate` is supplied. Not passing a handler already produces a flat, plain-text amount, which is the affordance this card needs to *not* have.
- **`lib/demo/demo-expenses.ts:47-86`** — `deriveDemoData` is pure and rebuilds rows, totals, `getBudgetStatus`, history and the free margin on every read. Anything the new card shows has to be computed inside this pass, or the card and the cards it mirrors will disagree after an edit.
- **`app/demo/demo-dashboard.tsx:21`** — the single `useMemo` that all of the above hangs from.

### Database

Everything this needs exists: `transacciones.es_fijo`, `transacciones.gasto_fijo_id`, `transacciones.estado` (`pendiente` | `confirmada`, default `confirmada`, only cron rows are born pending), `transacciones.borrado_en` and `gastos_fijos.dia_del_mes` (1–31). No migration, and no write of any kind — the card never mutates.

### Conflicts recorded

Two places where this change departs from a written decision. Both are resolved here and written back into the document in tasks.

1. **ARCHITECTURE.md §9, *"La tarjeta «Gastos fijos»: resumen, no contenedor"*** describes the card being removed: a total next to the title and the line *"ya incluidos en sus categorías"*. Its own premise is what this change acts on — if the card needs a sentence explaining that its number is not a second expense, the number is the problem. §9's two ordering lists (items 4 and 5 of the mobile and desktop orders) name *"Gastos fijos — total y detalle"* and are rewritten with it.
2. **§7 — *"Beneficio lateral: la tarjeta de fijos puede mostrar qué falta confirmar este ciclo."*** That sentence survives the card it was written about: it is now the whole point of this one, and the passage is updated to point at it rather than at a total.

## Goals / Non-Goals

**Goals:**

- One representation of a recurring charge — a row in its category — with the calendar reading those same rows, so the two can never disagree.
- A card whose read-only nature is carried by its appearance, not by a caption.
- No movement in any figure this change does not own: the free margin, the expenses total and every budget stay where they are, and the demo proves it.

**Non-Goals:**

- A `gastos_fijos` read, write or definitions screen. The card is derived entirely from the cycle's expense rows.
- Generalising the card into a reusable list. It is one component with one shape.
- Any Supabase implementation: the real dashboard route still does not exist, and this change keeps the injection contract the only thing components see.

## Decisions

### D1 — Recurrence rides on the row, not on the group

```ts
// lib/data/dashboard.ts
export type Expense = {
  id: string
  name: string
  amount: number
  date: string
  /** Present only on a charge generated from a recurring definition (§7). */
  fixed?: { day: number; charged: boolean }
}

export type ExpenseGroup = {
  id: string
  kind: 'category'
  name: string
  color: CategoryColor
  total: number
  budget: BudgetStatus | null
  expenses: Expense[]
}
```

`kind` is kept as a one-member union rather than deleted, because `ExpenseGroup` is the shape the future Supabase query returns and a second kind (an archived category, say) is plausible; keeping the discriminant costs one line and keeps every `switch` honest. `name` stops being nullable, which removes the four `?? t('gastosFijos')` fallbacks.

**Alternative rejected — a parallel `charges` array on `DashboardData`.** It would have let the card be fed directly, but the same charge would then exist twice in the data object, and the demo's edit log would have to be applied to both. The bug that follows is exactly the one the proposal is about: two representations of one charge drifting apart.

**`day` and `charged` rather than `diaDelMes` and `estado`:** the rest of the data layer is already translated (ARCHITECTURE.md §2 and the `translate-code-to-english` change), and `charged` is a boolean where `estado` is an enum with one other value that never reaches the dashboard.

### D2 — One pure selector, derived on read

```ts
// lib/data/upcoming-charges.ts
export type UpcomingCharge = {
  id: string; name: string; day: number
  amount: number; color: CategoryColor; charged: boolean
}
export function selectUpcomingCharges(groups: ExpenseGroup[]): UpcomingCharge[]
```

It flattens the groups, keeps rows with a `fixed` property, attaches each row's group colour, and sorts `charged` first then by `day` ascending. The card sums the footer total itself.

**Why a selector and not a field on `DashboardData`:** a field would have to be recomputed by every producer — the demo derivation, and later the Supabase query — and could fall out of step with the groups after an edit. A selector has one implementation and cannot disagree with its input. It is pure and takes no React, so it is verifiable with a `tsx` script the way `deriveDemoData` was.

**Why the card sums its own footer:** the total is the sum of the rows it just rendered. Passing it in adds a number that can be wrong.

### D3 — The next charge, and why there is no empty state

The collapsed strip shows the pending charge with the lowest day. When none is pending, it shows **the charge with the lowest day overall** — which, the definitions being monthly, is the first charge of the next cycle.

This is a deliberate approximation. The exact answer needs the active definitions (`gastos_fijos` where `activo`), which is a second query for a line of text that is about to be re-rendered on the first day of the next cycle anyway. It is wrong only for a definition deactivated mid-cycle, and only until the cycle turns over.

**What it buys:** there is no empty state, no "todo cobrado" copy, no branch in the layout, and the strip has exactly one shape in every condition. A card with no charges at all renders nothing, which is the only other case.

### D4 — Placement and subordination

The card is the first child of the expenses list, under the *Desglose de gastos* heading and above the first category card, in the same 12px stack. §9's *"fijos antes que variables"* reading order survives, but what comes first is now a calendar rather than a competing total.

It must not read as a peer of the cards it sits above. Four things carry that, and none of them is a new token:

| | Category card | Próximos cobros |
|---|---|---|
| Header height | 56px (`min-h-14`) | 44px (`min-h-11`) |
| Title | `body-lg` medium, foreground | `body-lg` regular, muted |
| Trailing value | total, `tabular-numeric-md` foreground | next charge, `label-ui` muted |
| Leading dot | 10px category colour | none |
| Chevron | `ExpandChevron`, brand ink when open | `ChevronDown` at 16px, muted in both states |
| Border when open | category colour | border token |

The chevron is the one place lime could leak in, so the card uses `ChevronDown` directly rather than the atom. Rotation plus `aria-expanded` still carry the open state without colour, as `design-system` → *Interaction states* requires.

### D5 — Row anatomy, and no separators

`[ day chip ][ 6px dot ][ name ··· ][ amount ]`, 48px minimum, `px-inset`.

- **Day chip** — `bg-muted`, radius 8px, fixed minimum width, the number in `label-ui` with tabular figures, muted. It is the only contained element in the card and the only piece of personality; monochrome, so it reads as a date and not as a badge with a count.
- **Dot** — `CategoryDot` at 6px (`size-1.5`), the same token as the category's card. The colour is the rhyme; the size is smaller here because the row already has a chip competing for the leading edge.
- **Amount** — `tabular-numeric-md`, transparent background, flush to the inset. Deliberately the same size as the name, so the column reads as a list rather than as a set of values.
- **Checkmark** — a 14px `Check` immediately after the name, inside the dimmed group. Not trailing the amount, which would break the amount column, and not leading the row, which would break the day column.

**No separators between rows.** ARCHITECTURE.md's structured rows use a 16px-inset hairline, and `DESIGN.md` documents it — but a hairline between every row would also draw one at the boundary between taken and pending, which is the one place this card must not draw a line: the spec forbids a today marker there, and a separator that happens to land on it is read as one. 48px rows with a chip on every leading edge carry the rhythm on their own. The only hairline in the card is above the footer.

### D6 — Dimming is opacity and a glyph

Taken rows get `opacity-50` on the whole row and a checkmark; nothing changes colour. Two reasons: grey-as-a-colour already means "muted metadata" everywhere else in the app, so spending it on "done" would make the two indistinguishable; and dimming the row as a unit keeps the amount's relationship to the name intact. The checkmark is what carries the state for anyone who cannot see the opacity difference, and the row's accessible name states it in words.

### D7 — The demo is re-homed, not re-priced

Every amount, budget and identifier in the sample stays. Only three things change: the `fixed` group becomes a `vivienda` category (same `gris_oscuro`, same three rows, same 900 € total, same first position), three existing rows gain a `fixed` property, and `Farmacia` becomes `Gimnasio`.

That keeps **expenses 1.700 € and free margin 974 €**, which is what every scenario in `expense-editing`, `category-editing` and `dashboard-ui` asserts. The alternative — inventing a `suscripciones` category with new charges — would have moved those two figures and forced rewrites of roughly fifteen scenarios across three capabilities for a Netflix row.

Charge days are also written onto those rows' dates, so a row that says *día 15* in the calendar says *15 sept* in its category card.

`charged` is authored data, not `day < today`. The sample's "today" follows the real clock (`demo-data.ts:151`), so deriving the state would make the split drift — all six taken by the end of the month — and the second visual state would vanish from the demo exactly when someone opened it. §7 backs this: the state is `estado` on the row, set by a cron and by manual confirmation, not a function of the date.

### D8 — Carrying `fixed` through the demo derivation

`resolveExpenses` rebuilds rows from `ExpenseDraft` through `toExpense`, which knows only amount, description and date — so an edited charge would silently lose its `fixed` property and drop out of the calendar. `toExpense` takes the previous row's `fixed` and passes it through; created rows have none, since the demo cannot create a recurring definition (out of scope). This is the one line in the change where a mistake is invisible in the type system and obvious on screen, so it gets its own verification step.

### D9 — Collapse-all owns the card

The card's open state joins the existing `openIds` set in `dashboard-template.tsx` under a reserved id, so "Colapsar todo" closes it with the rest and appears when it alone is open. Keeping a separate `useState` would produce the one case where the control is hidden while something is open.

### D10 — Copy

A new `proximosCobros` namespace, five keys: the title, `"{nombre} · día {dia}"`, the footer `"comprometido este ciclo · {monto}"`, and the two row states for assistive technology. `dashboard.gastosFijos` is deleted; the entry sheet's caption becomes the category name plus the existing *"Solo el cargo de este mes"*, which means `hojaGasto` keeps its key and gains a parameter.

## Risks / Trade-offs

- **The day chip is a lighter surface under a number, which is this app's "tap me" signal** → It is the only one in the card, it holds a day rather than money, and every amount stays flat. The spec pins both halves of that: a transparent background on amounts, and a checked scenario comparing the card against an expanded expense card in both themes.
- **The next-charge line shows a day from the next cycle with no label saying so** → Accepted (D3). The line is a prompt, not a figure; the cycle it belongs to is the one the month selector already names, and the alternative is a second query plus copy for a one-day-a-month edge.
- **Seven cards instead of six, plus a strip, is one more thing on a 390px screen** → The strip is 44px and replaces a 56px card, so the page is shorter than before. The *Mobile visual hierarchy* rule (no bordered surface inside another, at most six font sizes collapsed) is verified as part of the screenshot pass.
- **`Expense.fixed` is optional, so a forgotten spread silently empties the calendar** → D8 gives it a dedicated `tsx` verification asserting six charges before and after an edit, a delete and a restore.
- **Renaming `Farmacia` to `Gimnasio` touches a scenario in another change's delta** → One scenario in `expense-editing` → *Delete with undo*, modified here in full. The amount, the category and the resulting figures are unchanged, so nothing downstream of it moves.
- **Taken rows can't reach 4.5:1 contrast in the light theme within the spec's 45–55% opacity band** → `--foreground` (`#171A17`) blended onto `--card` (`#FFFFFF`) at 55% (the band's ceiling) measures ≈3.92:1; the light theme would need ≈63% opacity to clear 4.5:1, which is outside the band and would conflict with D6 ("opacity and weight only, never a different colour"). Accepted as-is: dimming is set to the band's ceiling (`opacity-[0.55]`), which clears 4.5:1 in the dark theme (5.66:1) but leaves the light theme short. Flagged during the verification pass (`tasks.md` 8.4) rather than resolved by exceeding the band or changing colour.

## Migration Plan

No data migration, no deploy step, no flag: the change is client-side and the only persistence involved is the demo's React state.

Implementation order is dictated by the type change — `ExpenseGroup.kind` narrowing breaks the template, the pie chart and the demo at once, so the contract and the demo data move together, before the card exists. Rollback is `git revert`; nothing outside the repository is touched.
