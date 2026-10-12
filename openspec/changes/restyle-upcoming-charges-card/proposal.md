## Why

"Movimientos" (`add-transaction-list`) set a row language for the dashboard: one mark on the left, the name over a muted line, the amount on the right, rows grouped under small headings. "Próximos cobros" sits a few cards above it and still speaks the older one, so the two lists read like different apps. Brian listed what is off today:

- The header is 44px with the title in grey and a plain chevron; the category cards and "Movimientos" use 56px, the title in the regular ink at medium weight, and `ExpandChevron`.
- Each row has two marks that compete: a day chip and a 6px category dot.
- Taken charges are dimmed to 55% and read as disabled; their state is only a small check after the name.
- The expected-amount caption sits under the name and the "4 de 10" progress under the amount, on opposite sides.

## What Changes

Visual and ordering only. Same data, same derivation, same footer total, and a row still opens its definition in the definition sheet.

- **Header like the other cards**: 56px, title in the regular ink at medium weight, the next charge ("Parking · día 15") muted on the right, `ExpandChevron` (which takes the brand ink while open, as on every card).
- **One mark per row**: a 32px circle tinted with the category colour (the same 16% mix as a "Movimientos" expense row) holding the day of the month. A taken charge carries a small check badge on the circle.
- **Name over one muted line**: the category name, then the expected amount ("esperado 68 €") and the progress ("4 de 10") when they apply, joined with " · ".
- **Two groups, pending first**: a "Pendientes" heading over the pending charges, then a "N cobrados" line that **starts folded** and opens the taken charges below it (Brian's decision, 2026-10-12). Nothing is dimmed: the group and the check say a charge was taken.
- **Amount on the right** with the same padding as a "Movimientos" row, so the amounts of both lists end on the same edge. It stays flat (no chip): the row opens the definition, not the charge.
- **Footer unchanged**: "comprometido este ciclo · X", the only total in the card.
- **BREAKING (spec)**: the order flips from "taken first, then pending, with no marker between" to "pending first, then the taken charges under a folded line". Tests that open a taken charge's row (Alquiler, Seguro) open the fold first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `upcoming-charges`: *Collapsed state answers when, not how much* becomes *Collapsed header answers when, not how much* (same header as the other cards instead of a shorter, subordinate one), and *Expanded state lists the cycle's charges* becomes *Expanded state lists pending charges first* (row anatomy, pending first, folded taken group, no dimming). Both go through REMOVED + ADDED because OpenSpec does not let a MODIFIED block drop a scenario ("Shorter than an expense card", "Charged on top, pending below", "Dimming is opacity, not colour"). *Charges are derived, never queried* (the category name travels with the charge), *A row opens its definition, and nothing else does* (the fold line is a control; the day mark replaces the chip) and *The card takes no accent colour* (the category tint on the day mark and the open chevrons' brand ink are allowed) are MODIFIED. The footer and income requirements do not change.
- `dashboard-ui`: *Category colour placement* (the tinted day mark replaces "the dot on its charges") and *Public demo route* (the six sample charges read pending first; "Peaje" sits under "Pendientes" after "Parking", no longer "after Seguro").
- `recurring-expenses`: *A recurrence can end, and ends itself*, only to point its cross-reference at the renamed *Expanded state lists pending charges first*.

## Impact

- `components/organisms/upcoming-charges-card.tsx`: header, groups, fold, footer.
- A new row molecule `components/molecules/upcoming-charge-row.tsx` (mark, text block, amount); `DayChip` and the 6px `CategoryDot` leave this card (both stay in the codebase if used elsewhere).
- `lib/data/upcoming-charges.ts`: `UpcomingCharge` gains the category name (`category`) for the muted line; the sort becomes pending first, then by day. `selectNextCharge` is unchanged.
- `messages/es.json`, `messages/en.json`: `proximosCobros.pendientes` and `proximosCobros.cobrados` (plural).
- Tests that click taken rows or read the panel: `recurring-scope`, `recurring-motion-a11y`, `projection-demo`, `projected-entries`, `recurring-create`, `income-recurring`, `desktop-sheets`. No test reads the old chip, dot or opacity.
- No data access, no migration. Same on `/demo` and `/dashboard`.
