## Why

A fixed charge says what and when, never *where*: "Alquiler 820 €, el día 1" does not say whether it leaves the debit card or the credit card, so the user cannot see how much each card will carry this month. ARCHITECTURE.md §9 left it open ("el *medio de pago* … no está en el esquema"). Brian wants it now (2026-10-15), for fixed charges only.

## What Changes

- **Cards**: a user holds any number of cards, each with a name and a colour from the categories' palette. No number, no last digits, no bank or network, nothing sensitive. Cards are created, renamed, recoloured and deleted. Two cards of the same user cannot share a name.
- **A fixed expense names its card, or none**: the card is a field of the recurring definition, not of each charge, so it holds in every cycle and asks no "Solo este mes / Desde este mes en adelante" (like the reminder). Fixed income takes no card.
- **Assigning from both sides**:
  - the fixed's section of the entry sheet (`unify-fixed-charge-sheet`) gains a **"Tarjeta"** row: the user's cards plus "Sin tarjeta", applied on "Guardar" like the reminder;
  - the new **card sheet** lists the active fixed expenses with a check each; ticking one assigns it to this card (moving it from another card, which the row names), unticking leaves it with no card.
- **"Tarjetas" widget**: a new dashboard widget (`WidgetId` `'wallet'`) with the cards drawn as a stacked wallet. Each card shows its name, the **total committed in the shown cycle** (the sum of that cycle's fixed charges assigned to it: charged, pending and projected, at each row's amount) and how many fixed charges make it up. A card opens its sheet; "Añadir tarjeta" opens it empty. The card face is a 3D card drawn in CSS: gradient from the chosen colour, layered shadow and a sheen. With a mouse it tilts and lifts slightly on hover (CSS); on a touch screen it tilts sideways while a finger slides across it and springs back flat on release (`motion`'s pan gesture, already a dependency). Neither under reduced motion.
- **Deleting a card never blocks**: after a confirmation that says how many fixed charges it carries, the card goes and those fixed charges are left with no card. Nothing else changes.
- The widget also shows in a projected cycle (the projection's committed totals); cards can be managed there, since they are not tied to a cycle.
- The demo seeds two cards ("Débito", "Crédito") with some of its fixed charges assigned, in memory like the rest.

Out of scope: a card on one-off expenses or income (a later phase), choosing the card while creating a fixed (it is assigned afterwards from either sheet; see design Open Questions), the bot, the onboarding, card limits, closing dates or statements.

## Capabilities

### New Capabilities

- `card-wallet`: cards as data (fields, uniqueness, deletion that frees its fixed charges), their injected operations, the "Tarjetas" widget with its committed totals, and the card sheet with its fixed-charge checklist.

### Modified Capabilities

- `recurring-expenses`: a new requirement, *A fixed expense names the card it is charged to* (the definition's optional card, the "Tarjeta" row of the fixed's section, the set card operation). Written as ADDED so it does not touch the requirements that `unify-fixed-charge-sheet` replaces; it refers to that change's fixed's section, so this change archives after it.

## Impact

- Database: migration `0038_tarjetas.sql` (additive): table `tarjetas` with RLS by `usuario_id`, `movimientos_recurrentes.tarjeta_id` nullable with a composite FK `on delete set null (tarjeta_id)`, and `asignar_fijos_tarjeta` for the checklist's atomic save. Applied before the deploy.
- Data: `lib/data/cards.ts` (types, `CardMutations`, `committedByCard`, pure with a unit test), `lib/data/supabase/cards.ts`, `lib/demo/demo-cards.ts`; `RecurringDefinition.cardId` and `RecurringMutations.setCard`; `DashboardData.cards`; `resumenMensual` reads cards and `tarjeta_id`; server actions in `app/dashboard/actions.ts`; `DashboardActions.cards`; `WidgetId` gains `'wallet'` (`normalizeWidgetOrder` appends it for stored orders).
- UI: `components/organisms/wallet-widget.tsx`, `components/organisms/card-sheet.tsx`, `components/atoms/wallet-card.tsx` (the face), the "Tarjeta" row in `entry-sheet.tsx`, wiring in `dashboard-template.tsx`; strings in `messages/es.json` and `en.json` (`tarjetas`); card tokens in `globals.css`.
- Tests: `tests/card-wallet.spec.js` on `/demo`, `lib/data/cards.test.mjs`, `widget-order.test.mjs` updated for five widgets; specs that count the widgets (`widgets-desktop`, `widget-order`) as they apply.
- Docs: ARCHITECTURE.md §9 (the open "medio de pago" becomes the card) and CLAUDE.md *Estado actual*.
