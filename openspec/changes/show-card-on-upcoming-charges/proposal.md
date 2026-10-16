## Why

Since `add-card-wallet`, a fixed expense can name the card it is charged to, but "Próximos cobros" does not say it: to know which card a charge leaves from, the user opens each charge's sheet one by one. The card list is where the user looks at what is about to be charged, so it is where the card should be seen (Brian, 2026-10-16).

## What Changes

- Each row of "Próximos cobros" whose fixed expense carries a card shows a **card thumbnail** just left of the amount: about 22×14px, the same gradient as that card's face in the "Tarjetas" widget, rounded, no text. All thumbnails sit in one column next to the amounts, so the list can be scanned top to bottom.
- The row's **muted line names the card** right after the category ("Vivienda · Débito · esperado 820 €"), so colour is never the only cue: two cards may share a colour, and not everyone tells colours apart. The row's accessible name includes the card too.
- A row whose fixed expense carries no card shows neither, and its amount stays in the same column as the others.
- The card follows the definition (`card-wallet`): it shows in every cycle, projected ones included, and follows any assignment, rename, recolour or deletion without a reload. A rainbow card's thumbnail turns like its face, and rests under reduced motion.
- Nothing else in the card changes: header, groups, order, footer, and what a row opens.

Out of scope: the card on the collapsed header's next-charge line, filtering or grouping the list by card, and the card on category-card rows or in "Movimientos".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `upcoming-charges`: the row anatomy gains the card thumbnail and the card's name on the muted line (*Expanded state lists pending charges first*), and the colour rule admits the thumbnail as the one other place a palette colour appears, tied to the card, not the category (*The card takes no accent colour*). Both requirements are the ones `restyle-upcoming-charges-card` writes, so this change archives after it, and after `add-card-wallet`, which defines the cards.

## Impact

- Data: `UpcomingCharge` gains the card of its definition (`selectUpcomingCharges` takes the user's cards); the two mounts (`app/demo/demo-dashboard.tsx`, `app/dashboard/supabase-dashboard.tsx`) pass them. A unit test for `selectUpcomingCharges` (`lib/data/upcoming-charges.test.mjs`), which has none today.
- UI: `components/molecules/upcoming-charge-row.tsx` (thumbnail, muted line), `components/organisms/upcoming-charges-card.tsx` (details and label); a small thumbnail atom sharing the card face's colour tokens; the rainbow rule in `app/globals.css` extended to the thumbnail. No new strings.
- Tests: `tests/upcoming-charges.spec.js` (anatomy, columns, colour and accessibility scenarios), and new scenarios on `/demo` with the seed cards (Débito: Alquiler, Internet; Crédito: Gimnasio, Seguro).
- No database change.
