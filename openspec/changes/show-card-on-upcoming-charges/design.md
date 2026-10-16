## Context

- "Próximos cobros" gets its rows from `selectUpcomingCharges(groups, definitions)` (`lib/data/upcoming-charges.ts`), called by the two mounts (`app/demo/demo-dashboard.tsx`, `app/dashboard/supabase-dashboard.tsx`) and passed to the template as `charges`. Each `UpcomingCharge` already carries its `definitionId`, and since `add-card-wallet` every `RecurringDefinition` carries `cardId`; `DashboardData.cards` holds the user's cards. In the demo, `definitions` is the card-applied list (`applyDemoCardAssignments`), so assignments, renames and deletions already reach it.
- The row is `components/molecules/upcoming-charge-row.tsx` (`restyle-upcoming-charges-card`): mark, name over a muted line built from `details: string[]`, and an amount box `px-2 py-0.5` that ends on the "Movimientos" edge. The card (`upcoming-charges-card.tsx`) builds `details` and the accessible `label`.
- The card face is `components/atoms/wallet-card.tsx`, coloured by `--card-from-<color>` / `--card-to-<color>` in `globals.css`. The rainbow colour animates `--rainbow-hue` on elements matched by `[style*="cat-arcoiris"]`, `[fill*="cat-arcoiris"]` and `[data-wallet-card="arcoiris"]`.
- Molecules may not import runtime code from `lib/data` (lint); types are fine.

## Goals / Non-Goals

**Goals:**
- The card of each charge readable at a glance, in one column, without opening a sheet.
- Colour never the only cue: the card's name in text, in the muted line and the accessible name.
- No change to the columns `restyle-upcoming-charges-card` fixed (marks, amounts on the "Movimientos" edge).

**Non-Goals:**
- The card on the collapsed header's next-charge line, filters or grouping by card, the card on category-card rows or in "Movimientos".
- A per-card total in this card: the "Tarjetas" widget already shows it.

## Decisions

### D1. The charge carries its resolved card
`UpcomingCharge` gains `card: { name: string; color: CategoryColor } | null`, and `selectUpcomingCharges(groups, definitions, cards = [])` resolves it from the definition's `cardId` (null when the definition is missing, carries none, or names a card not in the list). The two mounts pass `data.cards` (the demo, its card-applied list). Resolving in the selector, not in the row, keeps the row a pure molecule (no lookups) and gives the selector its first unit test (`lib/data/upcoming-charges.test.mjs`: a card, none, a missing card, a missing definition).

*Alternative:* `cardId` on the charge and `cards` passed down to the row (rejected: two props for one fact, and the lookup in a component).

### D2. The thumbnail sits left of the amount, inside the amount's box
The row renders, when `card` is set, a `<span aria-hidden data-card-thumb={color}>` of 22×14px (≈1.586:1), radius 3px, `linear-gradient(135deg, var(--card-from-<c>), var(--card-to-<c>))` with the face's inner rim (`inset 0 0 0 1px rgb(255 255 255 / .15)`), immediately before the `Money` inside the existing amount box, which becomes `inline-flex items-center gap-2`. The box keeps its padding and its right edge, so every amount still ends on the "Movimientos" line, and a row without a card simply has no thumbnail: amounts are right-aligned, so nothing shifts. Thumbnails line up because each sits at a fixed `gap` from its amount's left edge; amounts of different widths put thumbnails at different x, which is what "same distance from its amount" in the spec means, and why the spec does not ask for one x for all thumbnails.

*Alternatives:* after the name (rejected: its x would depend on the name's length and it would take width from a name that already truncates at 390px); a fixed column for every row (rejected: rows without a card would carry an empty slot, and short amounts would float away from their thumbnail).

### D3. The card's name is the second part of the muted line
`details` becomes `[category, card?.name, expected, progress]` filtered, so the line reads "Vivienda · Débito · esperado 820 €". It wraps between parts as today, so a long card name never splits the progress. The accessible label adds the card's name after the category. No new strings: the card's name is user data.

### D4. The thumbnail is a small atom on the face's tokens
`components/atoms/card-thumb.tsx` (name and colour props, aria-hidden), so the face and the thumbnail draw from the same tokens and a palette change reaches both. The rainbow rule in `globals.css` adds `[data-card-thumb="arcoiris"]` to its selector list, so the thumbnail turns with the face and rests under reduced motion. No blur, no motion of its own.

### D5. Archive order
The delta MODIFIES *Expanded state lists pending charges first* and *The card takes no accent colour* as `restyle-upcoming-charges-card` writes them (the first is ADDED there), so `openspec validate` already reports that archive would refuse it today: it archives after `restyle-upcoming-charges-card` (and after `add-card-wallet`, which defines the cards).

## Risks / Trade-offs

- [Two cards with the same colour look alike] → The name on the muted line tells them apart; the thumbnail is for scanning.
- [A long card name lengthens the muted line] → The line wraps between parts (`restyle-upcoming-charges-card` D3); the row grows, the columns do not move.
- [Narrow screens] → The amount box grows by 30px (thumbnail and gap) only on rows with a card; the name truncates a little sooner on those rows at 390px. Checked in the spec at 390px.
- [Past cycles show today's card] → Inherited from `add-card-wallet` D2 (the card is on the definition); already in its accepted risks.
