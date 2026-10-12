## Context

The dashboard already receives every row the card needs for the shown cycle (`DashboardData`): `expenses.groups[].expenses` (with `fixed` on rows linked to a recurring definition and `projected` on computed charges), `income.entries` (with `recurring` / `projected`), and `savings.movements`. Rows are edited and deleted from three places today: `CategoryCard` (via `openEditSheet` / `handleDeleteExpense`), the income panel (`openIncomeEditSheet` / `handleDeleteIncome`) and the savings panel (`handleDeleteSavings`, no edit sheet). All three go through `SwipeToDelete` and the shared undo toast in `dashboard-template.tsx`.

The main column is: summary, breakdown header, "Próximos cobros", category cards, "Añadir categoría". Below `lg` the widget column follows the main column; at `lg` it sits to the right (`data-dashboard-widgets`). Category cards are folded by default on a phone (`openIds`) and open at `lg` (`closedIds`), driven by `useDesktop()`.

`dashboard-ui` → *Expense cards group each expense exactly once* forbids listing a recurring charge outside its card and any "variable expenses" card. The delta carves out this card (see specs), and the decisions below keep it honest: no recurring rows, no totals.

## Goals / Non-Goals

**Goals:**
- One pure, tested function decides which rows the card holds and how they are ordered and grouped. The template only renders.
- The card reuses the existing building blocks (disclosure, row press, swipe-to-delete, segment track, entrance) so it reads as part of the same dashboard in both themes.
- Motion follows `motion-skills/AUDIT.md`: every animation has a purpose, stays under 300 ms except the existing segment spring, uses `transform`/`opacity`, and drops movement under reduced motion.

**Non-Goals:**
- Text search (deferred by Brian).
- Showing the origin channel (web / WhatsApp) on a row: `canal` is not in `DashboardData` and adding it is a data change. See Open Questions.
- Editing a savings movement (still the `add-savings-sheet` debt).
- Sticky day headings: the card clips its content (`overflow-hidden` for the rounded border), and the floating top bar at `lg` would need offsets per viewport. The headings are plain.

## Decisions

### D1. `userMovements` in `lib/data/movements.ts`, pure
`userMovements(data, timeZone)` returns a flat list, newest first:
`{ kind: 'expense' | 'income' | 'savings', id, name, amount, date, day, group?, entry?, movement? }`, where `day` is the local day (`localDayOf` from `weekly-spend.ts`) and the original object is kept for the row's actions. A second helper, `groupByDay(movements, today)`, folds a slice into `{ day, label: 'today' | 'yesterday' | null, items }[]`.

Paging slices the flat list **before** grouping, so a page always holds exactly 15 or 25 rows and a day may continue onto the next page under the same heading (which is merged, not repeated, because grouping runs over the whole shown slice).

Ordering: by `date` instant descending; ties keep input order (expenses by group, then income, then savings), which is stable across renders. `node:test` cases in `lib/data/movements.test.mjs` cover the demo's 13 rows, the Dublin boundary row, exclusion of every `fixed` / `recurring` / `projected` row, ties, and "today" / "yesterday" labels.

*Alternative considered:* group in the component with `useMemo`. Rejected: the rule "what counts as user-entered" is the spec's core and deserves unit tests, like `weekly-spend.ts`.

### D2. "User-entered" means "not linked to a recurring definition"
An expense counts if it has neither `fixed` nor `projected`; an income entry if it has neither `recurring` nor `projected`; every savings movement counts. A fixed charge completed from the chat stays linked to its definition, so it is excluded, as Brian asked ("todo lo que sea fijo... no lo ponemos").

*Alternative considered:* filter by `canal` / `mensaje_id_externo` (who wrote the row). Rejected: a web expense has no channel either, and the cron-created rows are exactly the linked ones. No data change is needed.

### D3. No totals anywhere in the card
A sum over the card's rows would differ from the "Gastos" total (which includes recurring charges) and make the two figures compete. Under "Gastos" it would also turn the card into the "variable expenses" card the spec forbids. The header shows a count, and days show only their heading.

### D4. Placement and open state
The card renders inside `data-dashboard-main`, after the category list (`categoryListRef`), wrapped in its own `AnimatedContent` (same `distance`/`threshold` as the cascade, delay after the last category) with `aria-hidden` / `inert` while `reordering`. Its open state mirrors the categories' pattern with two booleans: `movementsOpenMobile` (default `false`) and `movementsClosedDesktop` (default `false`), read through `desktop`. It stays out of `collapseAll` / `expandAll` / `anyCategoryOpen`.

The card is a section with `id="movimientos"` (`SECTION_MOVEMENTS`) and `scroll-mt-20 lg:scroll-mt-[104px]`, appended to `sectionIds` and to the sidebar entries (label only, no colour, no total). `navigateTo(SECTION_MOVEMENTS)` opens a folded card first and scrolls once its 200 ms disclosure is done: it is the page's last section, so while folded the page is too short to bring it under the bar (found in 4.1).

### D5. Component split
- `components/organisms/movements-card.tsx`: header disclosure (the `CategoryCard` pattern: a full-header `button` under the painted content, `aria-expanded`, `aria-controls`), `Collapsible` body, filter, day groups, "Mostrar más/menos", live region, empty states. Props: `movements`, `today`, `currency`, `timeZone`, `open`, `onToggle`, `pageSize`, `cycleKey`, and three optional handlers (`onEditExpense`, `onEditIncome`, `onDelete(movement)`).
- `components/molecules/movement-row.tsx`: one row (D7).
- `components/molecules/segmented-control.tsx`: the filter (D6). It is generic (options + value + onChange) because the theme pill and toggle already repeat the same track/thumb pair, but those two are not migrated here (rule 7: no cleanup outside the change).

### D6. Filter on Base UI `RadioGroup` over `.segment-track`
`@base-ui/react/radio-group` gives the single-choice semantics and roving arrow-key focus the spec asks for, without hand-written key handling. The visual is the existing pair: `.segment-track` (rounded-full, `p-1`) with a `.segment-thumb` that moves with `translate: index * 100%` over four equal columns (`grid-cols-4`), `transition-[translate,scale] duration-500 ease-spring`, `group-active:scale-[0.96]`, and `motion-reduce:transition-none`, as in `theme-toggle.tsx`. Labels in `text-body-md font-medium`; the selected one in `text-foreground`, the others `text-muted-foreground hover-fine:hover:text-foreground`. Each option is `min-h-target` (44 px). Equal columns keep the thumb a pure `translate` (no width interpolation); "Ingresos" is the longest label and fits a quarter of a 358 px track at `text-body-md`.

*Alternative considered:* a thumb that measures each label (`left` + `width`). Rejected: animates layout properties, and equal segments read calmer on a phone.

### D7. Row anatomy
`MovementRow`, `min-h-row`, `px-inset`, `gap-3`:
1. **Leading mark, 32 px circle** (`size-8 rounded-full`): expense → tinted with its category colour (`color-mix(in oklab, var(--cat-<color>) 16%, transparent)`) holding a `CategoryDot` (`size-2.5`); income → `bg-muted` with `ArrowDownLeft` in `text-brand-ink`; savings → `bg-muted` with `PiggyBank` (deposit) or `ArrowUpRight` (withdrawal) in `text-foreground`. Icons from `lucide-react`, already the project's family (the taste skill allows the existing dependency), `size-4`, `aria-hidden`.
2. **Text block**: description in `text-body-lg text-foreground truncate` over the kind line in `text-body-sm text-muted-foreground` (category name, "Ingreso", "Depósito" / "Retiro").
3. **Amount**: `text-tabular-numeric-md`; income `+` in `text-brand-ink`; savings `+` / `−` (U+2212, as `SavingsMovementRow`) in `text-foreground`; expenses unsigned. Activatable rows (expense, income) wrap the amount in the same `rounded-lg bg-muted px-2 py-0.5` chip as `ExpenseRow`, which is the dashboard's cue that a row opens; savings rows have no chip.

Separators: an inset hairline between rows of the same day, starting after the leading mark (`before:left-[60px]`, the iOS inset list), none above a day's first row. The day heading (`text-label-ui text-muted-foreground`, `px-inset pt-4 pb-1`, first letter capitalised with `first-letter:uppercase` so "jue 10 sept" reads "Jue 10 sept" while the text stays the formatter's) separates days. This avoids a hairline on every row edge (taste skill §9.F) and no surface nests in another (`dashboard-ui` → *Mobile visual hierarchy*).

The heading uses `useFormatter().dateTime(..., { weekday: 'short', day: 'numeric', month: 'short', timeZone })` with every comma removed, since ICU versions disagree on it and a mismatch breaks hydration (the lesson of `weekly-top-chart.tsx`).

Row keys are `${kind}:${id}`: ids are unique per table, but the card mixes three sources.

### D8. Paging state
`const [paging, setPaging] = useState({ key, pages: 1 })` where `key = ${cycle.month}|${filter}`; when the current key differs from the stored one, render with `pages = 1` and store the new key during render (the repo's existing "adjust state on prop change" idiom, as `lastSummaryKey`). Shown rows: `filtered.slice(0, pageSize * pages)`. `pageSize` comes from `desktop` (15 / 25).

"Mostrar más" stores the id of the first new row and focuses it after commit (a ref map keyed by row key; `preventScroll` is not used, so the browser keeps it in view). "Mostrar menos" sets `pages = 1` and, after commit, calls `scrollIntoView({ block: 'nearest' })` on the card header (its `scroll-mt` keeps it below the bar). Its button reads "Mostrar menos" only when `pages > 1` and nothing remains.

The control is a full-width row button (`min-h-12`, `text-label-ui text-brand-ink`, centred, `pressable`) with a `ChevronDown` / `ChevronUp`, the same shape as "Ver todos los gastos" in the summary.

### D9. Motion, per `motion-skills/AUDIT.md`
| Moment | Motion | Why |
| --- | --- | --- |
| Card enters on first scroll | `AnimatedContent` (existing) | Same cascade as the cards above it. Once. |
| Open / fold | `Collapsible` (200 ms `ease-drawer`, grid rows + opacity) and `ExpandChevron` | Identical to categories: spatial consistency. |
| Filter thumb | `translate` 500 ms `ease-spring` (existing segment) | Interruptible transition that retargets on rapid taps. |
| New list after a filter | List wrapper keyed by filter with `animate-stat-in` (250 ms `ease-out`, small rise + fade) | Signals the content changed without moving rows across each other. |
| Rows revealed by "Mostrar más" | Each new row `animate-stat-in` with `animation-delay: min(i, 7) * 30ms` (≤ 210 ms) | Shows where the new page starts; stagger never blocks input. |
| Row press | `pressable` (existing) | Feedback. |
| Swipe delete / undo | `SwipeToDelete` (existing) | Same gesture as everywhere. |

Rejected: Motion `layout` / `AnimatePresence` on rows when filtering. Twenty-five rows sliding past each other is noise for a control used often, and it costs measurement on every change. Rejected: animating "Mostrar menos" (the list shortening under the user's eye is jarring; the scroll to the header is the feedback).

Reduced motion: `motion-reduce:animate-none` on the keyed list and new rows, `motion-reduce:transition-none` on the thumb; `Collapsible` and `AnimatedContent` already honour it.

### D10. Live region
One `sr-only` `aria-live="polite"` node inside the card, written only after a user action (filter or paging), never on mount: "Mostrando 3 movimientos" / "Showing 3 movements". A day heading is an `h3`; the card title is the header button's label, inside an `h3`-level heading like the category cards.

### D11. React Bits
The shadcn MCP (`@react-bits` registry) is not loaded in this planning session. During apply, search it for an animated-list or segmented-control item; port one by hand only if it meets D9 (transform/opacity, ≤ 300 ms, reduced motion) and `design-system`. `add-desktop-dashboard-shell` D10 already rejected React Bits for the widgets for the same reasons, so the plan does not depend on it.

### D12. Strings
New `movimientos` namespace in `messages/es.json` and `messages/en.json`: `titulo`, `filtro` (group label), `todo`, `gastos`, `ingresos`, `ahorro`, `ingreso`, `deposito`, `retiro`, `hoy`, `ayer`, `mostrarMas`, `mostrarMenos`, `mostrando` (ICU plural), `vacio`, `vacioDetalle`, `sinGastos`, `sinIngresos`, `sinAhorro`, `fila` (accessible name). Visible copy has no em dash (taste skill §9.G).

## Risks / Trade-offs

- **Hydration flip at `lg`** → `useDesktop()` snapshots `false` on the server, so the card first renders folded and opens after hydration, as the category cards already do. Same accepted behaviour; the `Collapsible` transition makes it read as an opening.
- **A row shown in two places** → swiping it in the card removes it from its category card through the same data refresh, and undo brings both back (`SwipeRestoreContext` is keyed by row id, so both wrappers reopen). Covered by a scenario.
- **Ties on the same instant** → web rows often share midnight-local timestamps; input order breaks ties. Not chronological truth, but stable, and the day is right.
- **Long main column at `lg`** → 25 rows plus the categories make the left column much taller than the widgets. Accepted: the page scrolls as one, and the sidebar entry jumps to the card.
- **The demo has 13 movements** → "Mostrar más" is not visible on load; the spec and tests add rows first.
- **`fixed` completed from the chat is hidden** → a user who types "luz 72" sees the charge complete in its category, not in the card. Intended (Brian's rule); if it confuses, it is a one-condition change in `userMovements`.

## Open Questions

- Should a row show a small WhatsApp mark when it came from the bot? Needs `canal` in `DashboardData` (a select and a field); can follow without changing this card's structure.
- Whether a day subtotal under "Gastos" would help once the list grows. Deferred on purpose (D3).
