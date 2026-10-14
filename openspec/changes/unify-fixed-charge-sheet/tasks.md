## 1. Data

- [x] 1.1 `RecurringMutations.setCharged(definitionId, cycle, charged)` and `setReminder(definitionId, reminder)` in `lib/data/recurring.ts` (design D4, D5); Supabase implementations as single-table updates with `expectRows`, server actions and wiring in `app/dashboard/supabase-dashboard.tsx`; verify with `npx tsc --noEmit`
- [x] 1.2 Demo: `charged` and `reminders` overrides in `DemoRecurringEdits`, applied to the sample cycle's fixed rows and to the demo's definitions (D4, D5); verify on `/demo` that marking "Parking" moves it to the charged group and undo moves it back, and that a reminder survives reopening the sheet

## 2. Sheet

- [x] 2.1 `ScopeChoice` optional `options` with the `'all'` reach and its label (D6); verify the category sheet and the existing two-option uses render unchanged
- [x] 2.2 `EntrySheet` `fixed` section: summary line with the plan's figures, "Marcar como cobrado", reminder with its days before, "Dejar de repetir", three-reach delete with hints; `extra.slotChanged` and `extra.reminder` on save (D1–D3, D6); verify every scenario of *One sheet for a fixed row* on `/demo`
- [x] 2.3 Recurrence switch in edit mode when the sheet gets `onSaveRecurrence` (D7); verify "Gasolina" and "Freelance" become fixed on `/demo` with one row each
- [x] 2.4 Strings in `messages/es.json` and `messages/en.json` (`gastoRecurrente.resumen`, `quedanPagos`, `hojaGasto.marcarCobrado`, `cobradoEsteMes`, `errorMarcar`, `eliminadoConHistorial`, the three delete hints, `alcance.todosLosMeses`); verify both languages render with no missing-key warnings

## 3. Dashboard

- [x] 3.1 Template: one opener for a fixed row from the category card, the income panel and "Próximos cobros" (`onOpenCharge`, D8); `fixed` props from `definitions`; save with slot then reminder; mark charged with its toast and undo; stop; delete every month; recurrence switch in edit mode for a one-off row of the cycle in progress; remove `RecurringSheet` and `components/organisms/recurring-sheet.tsx`; verify `npx tsc --noEmit` and `npm run lint`
- [x] 3.2 Screenshots on `/demo` at 390px and 1280px, light and dark: "Parking" from both places, "Seguro" with its plan line, the three-reach delete step, "Gasolina" with the switch on; check them against `motion-skills/AUDIT.md` (no new motion: `Collapsible` and the sheet's own)

## 4. Tests

- [x] 4.1 New `tests/fixed-sheet.spec.js` on `/demo` (390px and 1280px): same sheet from both places, both numbers, no mark on a charged row, fixed income entry, stop, reminder alone, unchanged save confirms nothing, the question from "Próximos cobros", mark and undo, three-reach delete and "every month", an entered expense and an income entry becoming fixed, no switch on a projected row, reduced motion, axe on the sheet in both themes
  > 16 tests, 48/48 in Chromium, Firefox and WebKit. Rows of "Próximos cobros" are pressed once the card and the taken group finish opening (a press mid-transition missed the row in Firefox and WebKit).
- [x] 4.2 Move the specs that opened the definition sheet to the one sheet (`recurring-scope`, `recurring-motion-a11y`, `upcoming-charges`, `desktop-sheets`, `projection-demo` as they apply); run them in Chromium, then Firefox and WebKit
  > `recurring-scope` rewritten over the one sheet (10, 30/30 in the three browsers); `recurring-motion-a11y` measures contrast with the amount field blurred (its focused "€" is 4.08:1 in light, now in *Deuda tecnica*); `upcoming-charges` and `projection-demo` read the name from "Descripción".
- [x] 4.3 Full `npm test` in Chromium and then in the three browsers, `npm run test:unit`, `npm run lint`, `npx tsc --noEmit`; report failures with their output and whether they are this change's
  > See `add-savings-sheet` 4.3: the same runs cover both changes.

## 5. Docs

- [x] 5.1 Update `CLAUDE.md` *Estado actual* (Web/dashboard, Tests, OpenSpec: archives after `restyle-upcoming-charges-card`) and move the Open Question and accepted risks into *Deuda tecnica* when archiving

## 6. "Cobrado este mes" as a switch (Brian, 2026-10-14)

- [x] 6.1 Migration `0037_no_cobrado.sql`; `setCharged` writes `no_cobrado` by the charge's day, `isCharged` honours it (D4)
- [x] 6.2 `EntrySheet`: the mark becomes a switch (`fixed.charged`, `extra.charged`), with hover, tint and an animated check (`.charge-toggle` in `globals.css`, at rest under reduced motion); the template applies it on save, after the slot, and keeps an edited slot pending with the switch off; strings `cobradoEsteMes`, `marcadoCobrado`, `marcadoPendiente`
- [x] 6.3 `tests/fixed-sheet.spec.js`: the switch waits for "Guardar" both ways, a charge taken by its date unmarks, an edited pending charge stays pending; screenshots in both themes
- [ ] 6.4 Apply `0037` to the real database (with Brian's confirmation) and check the switch on `/dashboard`
  > `0037` applied by the MCP on 2026-10-14 and read back (boolean, not null, default false, 0 of 171 rows marked); the `/dashboard` check is still open.
