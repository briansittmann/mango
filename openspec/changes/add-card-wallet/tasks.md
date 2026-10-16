## 1. Database

- [x] 1.1 Write `supabase/migrations/0038_tarjetas.sql` (design D1, D3): table `tarjetas` with RLS, case-insensitive unique name index, `movimientos_recurrentes.tarjeta_id` with the composite FK `on delete set null (tarjeta_id)` and the `tarjeta_si_gasto` check, and `asignar_fijos_tarjeta`; verify by reading it against 0004/0017/0019 for column names and patterns
- [x] 1.2 Apply `0038` to the real database by the MCP, with Brian's confirmation, before any deploy; verify with `list_migrations` and a read of `tarjetas` and the new column (0 rows, all `tarjeta_id` null), and that inserting a card and setting it on an income definition is rejected (inside a rolled-back transaction)

## 2. Data layer

- [x] 2.1 `lib/data/cards.ts`: `Card`, `CardDraft`, `CardMutations`, `DUPLICATE_CARD_NAME`, `committedByCard`; `RecurringDefinition.cardId`, `RecurringMutations.setCard`, `DashboardData.cards`, `DashboardActions.cards`, `WidgetId` `'wallet'` (D3, D4, D5); verify `lib/data/cards.test.mjs` (charged, pending and projected rows, a "solo este mes" amount, a deleted slot, income absent, card with none) and the updated `widget-order.test.mjs` pass with `npm run test:unit`
- [x] 2.2 Supabase: `lib/data/supabase/cards.ts`, `setCard` in `lib/data/supabase/recurring.ts`, `resumenMensual` reading cards and `tarjeta_id`, server actions in `app/dashboard/actions.ts` and wiring in `app/dashboard/supabase-dashboard.tsx`; verify `npx tsc --noEmit` and, against the real database with a script, create / rename / duplicate name / assign / delete on a test card, leaving nothing behind
- [x] 2.3 Demo: `lib/demo/demo-cards.ts` with the seed of *The demo's cards stay in memory*, `cardId` on the demo definitions, `?e2e=fail-card-save` (D9); verify on `/demo` that both cards show and reset on reload

## 3. UI

- [x] 3.1 Card face `components/atoms/wallet-card.tsx` and the per-colour tokens in `globals.css` (D6); verify with screenshots of the 15 colours in both themes and a computed contrast check of each face's text (≥ 4.5:1), tuning the mix if one fails
- [x] 3.2 `components/organisms/wallet-widget.tsx` (stack, bands, count line, empty state, "Añadir tarjeta") and its place in `renderWidget`, `widgetNames` and the projection filter (D5); verify on `/demo` at 390px and 1280px, in a projected cycle, and with no cards
- [x] 3.3 `components/organisms/card-sheet.tsx` (preview, name, colour, fixed-charge checklist, save order, delete with confirmation) and its state in `dashboard-template.tsx` (D7); verify every scenario of *The card sheet* and *Deleting a card frees its fixed charges* on `/demo`
- [x] 3.4 "Tarjeta" row in the fixed's section of `entry-sheet.tsx` and `setCard` after the reminder in `handleSaveEntry` (D8); verify the scenarios of *A fixed expense names the card it is charged to* on `/demo`
- [x] 3.5 Strings `tarjetas.*` in `messages/es.json` and `messages/en.json` (widget, sheet, row, empty state, confirmation with one, two and three or more names, errors); verify both languages with no missing-key warnings
- [x] 3.6 Motion and look: hover tilt (CSS), finger tilt with the pan gesture (`touch-action: pan-y`, coarse pointer only, the click after a pan ignored; design D6), press, reduced motion, sheet open/close, against `motion-skills/AUDIT.md`; screenshots of the widget and both sheets at 390px and 1280px in light and dark
- [x] 3.7 Palette (Brian, 2026-10-16, added during apply): amarillo, marrón, lila and fucsia, and one easter egg, "arcoíris", whose hue keeps turning (after React Bits' GradientText border, in CSS: a registered `--rainbow-hue` animated on each element that paints with it, a conic edge on its card face, still under reduced motion); last in the picker and never picked automatically. `0039_colores_extra.sql` widens `categorias_color_check`; `0038` takes the twenty colours. Verify the card contrast test over the 20 swatches and screenshots of the rainbow in both themes

## 4. Tests

- [x] 4.1 New `tests/card-wallet.spec.js` on `/demo` (390px and 1280px): wallet on load, open by pointer and keyboard, create with fixed charges, duplicate name, rename failure, move between cards, untick, delete and cancel, totals in a projected cycle and after a "solo este mes" change, the "Tarjeta" row (assign, remove, absent on income and without cards), hover tilt, finger tilt (sideways slide tilts and does not open the sheet, vertical slide scrolls; with touch emulation in Chromium and WebKit), reduced motion for both, axe on the widget and the sheet in both themes; run in Chromium, then Firefox and WebKit
- [x] 4.2 Update specs that count or order the widgets (`widgets-desktop`, `widget-order`, `desktop-motion-a11y` as they apply); run them in the three browsers
- [x] 4.3 Full `npm test` in Chromium and then the three browsers, `npm run test:unit`, `npm run lint`, `npx tsc --noEmit`; report failures with their output and whether they are this change's
- [ ] 4.4 Round on `/dashboard` against the real database at 390px and 1280px: create a card, assign two of Brian's fixed charges from both sheets, check the totals against "Próximos cobros", delete it; leave nothing behind

## 5. Docs

- [ ] 5.1 ARCHITECTURE.md §9: replace the open "medio de pago" note with the card (definition field, no scope, totals per cycle); CLAUDE.md *Estado actual* (Web/dashboard, Base de datos with `0038`, Tests, OpenSpec: archives after `unify-fixed-charge-sheet`); on archiving, move the accepted risk (past cycles follow today's assignment) and the Open Questions into *Deuda tecnica*
