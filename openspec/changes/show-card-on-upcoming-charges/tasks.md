## 1. Data

- [x] 1.1 `UpcomingCharge.card` and `selectUpcomingCharges(groups, definitions, cards = [])` resolving it from the definition's `cardId` (design D1); both mounts pass `data.cards`; verify a new `lib/data/upcoming-charges.test.mjs` (a card, no card, a card not in the list, a missing definition) passes with `npm run test:unit`, and `npx tsc --noEmit`

## 2. UI

- [x] 2.1 `components/atoms/card-thumb.tsx` on the face's tokens, and `[data-card-thumb="arcoiris"]` in the rainbow rule of `globals.css` (D4); verify with a screenshot of the 20 colours' thumbnails in both themes
- [x] 2.2 `upcoming-charge-row.tsx`: thumbnail before the amount inside its box (D2); `upcoming-charges-card.tsx`: card name second in `details` and after the category in the label (D3); verify on `/demo` at 390px and 1280px, light and dark, with taken charges unfolded and in a projected cycle, by screenshots

## 3. Tests

- [x] 3.1 `tests/upcoming-charges.spec.js`: update the muted-line and column scenarios for the seed cards ("Salud · Crédito", "Vivienda · Crédito · esperado 35 € · 4 de 10"), and add *A charge names its card*, *The card follows its changes*, *Cards in a projected cycle*, thumbnails in the columns scenario, the card in the accessible name, *Only dots carry colour* admitting thumbnails, and *A rainbow card's thumbnail* (changes over time, still under reduced motion); run it in Chromium, then Firefox and WebKit
- [x] 3.2 `npm run test:unit`, `npm run lint`, `npx tsc --noEmit`, and the specs that read "Próximos cobros" rows (`fixed-sheet`, `recurring-scope`, `recurring-motion-a11y`, `projection-demo`, `card-wallet`) in the three browsers; report failures and whether they are this change's

## 4. Docs

- [x] 4.1 CLAUDE.md *Estado actual* (Web/dashboard, Tests, OpenSpec: archives after `restyle-upcoming-charges-card` and `add-card-wallet`), and move the design's Non-Goals worth keeping (card on the header line, filter by card) into *Deuda tecnica* on archiving
