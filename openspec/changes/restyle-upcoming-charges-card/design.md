## Context

See proposal.md for the why. Current state:

- `components/organisms/upcoming-charges-card.tsx` (123 lines) renders a 44px header (`min-h-11`, title `text-body-lg text-muted-foreground`, a bare `ChevronDown` in muted ink), then one `button` per charge: `DayChip` + 6px `CategoryDot` + name (with a `Check` after it when taken) + an expected-amount caption under the name, and the amount with the progress under it on the right. Taken rows get `opacity-[0.55]`. Footer: hairline + `proximosCobros.pie`.
- `lib/data/upcoming-charges.ts` → `selectUpcomingCharges(groups, definitions)` builds `UpcomingCharge` (no category name today) and sorts taken first, then by day. Called by `app/demo/demo-dashboard.tsx` and `app/dashboard/supabase-dashboard.tsx`; `selectNextCharge` lives in the card file.
- The card is mounted in `dashboard-template.tsx` inside `#category-cascade`, open state from `openIds` / `toggleCard(UPCOMING_CHARGES_ID)`, rows wired to `openRecurringSheet`. Nothing there changes.
- Reference language: `MovementRow` (`components/molecules/movement-row.tsx`) and `MovementsCard` (`add-transaction-list` design D7: 32px tinted mark, `text-body-lg` name over `text-body-sm` muted line, `text-tabular-numeric-md` amount in a `px-2 py-0.5` box, inset hairline from `left-[60px]`, day headings `text-label-ui text-muted-foreground px-inset pb-1 pt-4`). Category card header: `min-h-14`, full-header `button` under painted content, name `text-body-lg font-medium text-foreground`, `ExpandChevron`.
- `DayChip` is used only by this card.

## Goals / Non-Goals

**Goals:**
- "Próximos cobros" and "Movimientos" read as one list language: same header, same row geometry, same heading style, amounts on the same right edge.
- No new text size on the phone (the six-size rule in `widgets-motion-a11y` / `desktop-motion-a11y`): every class used already appears on the page (`text-body-lg`, `text-body-sm`, `text-label-ui`, `text-tabular-numeric-md`).
- Motion per `motion-skills/AUDIT.md`: only the existing disclosure motion, interruptible, under 300 ms, nothing on a frequently-opened list.

**Non-Goals:**
- Changing which charges are listed, the next-charge rule, the footer figure or what a row opens.
- Swipe, drag or edit inside the card (spec forbids them).
- Moving the card to the widget column at `lg` (existing debt, untouched).
- Restyling `MovementRow` or extracting a shared row base.

## Decisions

### D1. A separate `UpcomingChargeRow` molecule, not a variant of `MovementRow`
`components/molecules/upcoming-charge-row.tsx` takes `{ day, name, detail, amount, currency, color, charged, label, onActivate?, first }` and renders a `button` (disabled without `onActivate`). It repeats `MovementRow`'s row classes verbatim (`relative flex min-h-row w-full items-center gap-3 px-inset py-2.5 text-left hover:bg-foreground/[0.04]`, the `before:left-[60px]` inset hairline when not `first`, `pressable`, focus outline).

*Alternative considered:* a `mark` slot plus a `flat` flag on `MovementRow`. Rejected: `MovementRow` is driven by `kind` (sign, brand ink on income, chip on activatable rows, read-only `div` fallback) and none of that applies; bending it costs more than repeating one class string (CLAUDE.md rule 7).

### D2. The day mark
`span.relative.grid.size-8.shrink-0.place-items-center.rounded-full`, background `color-mix(in oklab, var(--cat-<color>) 16%, transparent)` exactly as `MovementRow`, plus an inset ring of 1.5px in the full category colour (`box-shadow: inset 0 0 0 1.5px var(--cat-<color>)`, so the mark stays 32px), holding the day in `text-label-ui font-medium text-foreground tabular-nums`. The ring came after the first commit (Brian asked how to show the category colour more clearly): at 16% the muted categories (Hogar, Vivienda) read as grey, and a dot next to the category name would have brought back a second mark per row. "Movimientos" keeps its plain tint, since its dot already carries the colour. Taken: a badge `absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-foreground text-card ring-2 ring-card` with `Check` (`size-2.5`, `strokeWidth={3}`, `aria-hidden`). Neutral tokens only, so it never reads as brand or success colour, and the `ring-card` cut-out separates it from the tint in both themes.

*Alternative considered:* swapping the number for a check when taken. Rejected: the day is the card's point ("when"), and a taken charge's day still matters when reading back the month.

### D3. Text block and the muted line
Name `block truncate text-body-lg text-foreground`. Muted line `block text-body-sm text-muted-foreground`, built from `[category, expected, progress]` with the empty parts dropped, joined by " · ". Unlike `MovementRow`, the muted line **wraps** instead of truncating: "Vivienda · esperado 820 € · 4 de 10" is ~35 characters and does not fit at 390px next to a four-digit amount, and truncation would hide exactly the information the caption exists for. Each part is `whitespace-nowrap`, so the line breaks only at a " · " and never inside "4 de 10" (found in the screenshot pass). Wrapping only grows that row; the mark and the amount stay vertically centred, so the columns hold.

### D4. Amount
`shrink-0 px-2 py-0.5 text-tabular-numeric-md text-foreground`, the `MovementRow` box without `bg-muted`. Same `px-inset` on the row and the same `px-2` on the box put the last digit on the same x as a "Movimientos" amount, which a spec scenario checks.

### D5. Groups and the fold
In the card: `pending = charges.filter(c => !c.charged)`, `taken = charges.filter(c => c.charged)`; both arrive in day order (D7).
- Pending: an `h3` "Pendientes" with the `MovementsCard` day-heading classes, then the rows. Not rendered when `pending` is empty.
- Taken: a full-width `button` (`pressable flex min-h-12 w-full items-center gap-3 px-inset text-left`, `aria-expanded`, `aria-controls="upcoming-charges-taken"`) with the count in `text-label-ui text-muted-foreground` and `ExpandChevron` at `size-4` (20px next to 13px text is heavy). Below it a nested `Collapsible id="upcoming-charges-taken"` with the taken rows; its `inert` takes them out of the tab order and the accessibility tree while folded. Not rendered when `taken` is empty.
- Fold state is `useState(false)` inside the card: folded on page load, kept while the card closes and reopens or the month changes. The header disclosure and `collapseAll` do not touch it.

*Alternative considered:* the "Cobrados" heading as plain text with the fold elsewhere. Rejected: one line that is both the group's heading and its control is the iOS grouped-list pattern and saves a row.

### D6. Header
Copy the category card header: `relative flex min-h-14 items-center gap-3 px-inset`, the full-header `button` (`pressable absolute inset-0 [--press-scale:1]`, `aria-expanded`, `aria-controls`, `aria-labelledby` title + next charge) under `pointer-events-none` painted content: title `flex-1 truncate text-left text-body-lg font-medium text-foreground`, next charge `shrink-0 text-label-ui text-muted-foreground`, `ExpandChevron open={open}` (muted closed, brand ink and turned open). Border stays `border-border` in both states (no category colour, no hover border: the card has no single colour to adopt).

### D7. Data: category name and day order
`UpcomingCharge` gains `category: string` (`group.name`), the one field the muted line needs. `selectUpcomingCharges` sorts by day only; grouping by state moves to the card, the one place the order matters. Ties keep input order (stable sort), as today. `selectNextCharge` is unchanged.

### D8. Accessible names and strings
Row `aria-label`: `[fila(name, day), category, amount, state, progress, expected]` joined with ", " — the visible muted line is inside the label (label-in-name), and the `^<name> ·` prefix the tests match stays. New keys in `proximosCobros` (es / en): `grupoPendientes` "Pendientes" / "Pending", `grupoCobrados` "{n, plural, one {# cobrado} other {# cobrados}}" / "{n} charged". `cobrado` / `pendiente` (state words in the label) and `pie` stay.

### D9. Motion, per `motion-skills/AUDIT.md`
| Moment | Motion | Why |
| --- | --- | --- |
| Card open / close | `Collapsible` (200 ms `ease-drawer`, grid rows + opacity), `ExpandChevron` rotation | Unchanged behaviour, now with the same chevron as every card. |
| Fold / unfold taken | Nested `Collapsible`, same timing | Spatial: the rows come from the line that names them. Transition, so a double tap retargets. |
| Row press | `pressable` | Feedback. |

No entrance or stagger on rows: the card is opened tens of times a day (AUDIT §1). Reduced motion is already honoured by `Collapsible` (`motion-reduce:transition-none`); `ExpandChevron` keeps its short rotation, as it does on every category card today.

### D10. Design pass and verification
During apply, run `design-taste-frontend` in audit mode over the card before coding (it was not loaded while planning), and compare to `MovementsCard` side by side. Screenshots of `/demo` at 390px and 1280px, light and dark: collapsed, expanded, expanded with taken unfolded, and a row with "esperado" + progress. A new `tests/upcoming-charges.spec.js` covers the new scenarios (order, fold, keyboard order, opacity 1, header height vs "Vivienda", amount edge vs "Movimientos", text-size set unchanged, reduced motion, axe in both themes).

### D11. `DayChip` goes
With this card off it, `components/atoms/day-chip.tsx` has no user and is deleted with the change.

## Risks / Trade-offs

- [A taken charge needs one more tap to open its definition] → Accepted by Brian (folded). Tests that open "Alquiler" or "Seguro" unfold first (`recurring-scope`, `recurring-motion-a11y`).
- [At the start of a cycle every charge is pending: 18 rows for Brian's real account] → Same length as today; the fold only shortens the card once things are taken, which is most of the month.
- [The tint at 16% over the dark card could fail 4.5:1 for the day number] → `text-foreground` on a 16% tint stays well above 4.5:1 in `MovementsCard`'s marks' neighbourhood; the contrast spec (`recurring-motion-a11y`) checks it with the fold open in both themes.
- [Wrapping muted line makes some rows taller] → Only rows with both "esperado" and a progress at narrow widths; the spec only requires ≥48px and stable columns.
- [Nested `Collapsible` inside `Collapsible`] → The outer grid row is `1fr` over `min-h-0 overflow-hidden`, so it follows the inner height change in the same transition; checked in the "pushes content down" scenario.

## Migration Plan

UI only: no data, no migration, no flag. Rollback is reverting the change's files.
