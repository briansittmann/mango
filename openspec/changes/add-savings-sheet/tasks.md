## 1. Database

- [x] 1.1 Write `supabase/migrations/0033_ahorro_previo.sql` (column `ahorro_previo boolean not null default false`, check `not ahorro_previo or (tipo = 'ahorro' and monto > 0)`, comment) (design D1); verify the SQL reads as additive and every existing row satisfies the check (`select count(*) from transacciones where ahorro_previo` would be 0)
- [x] 1.2 Apply `0033` to the real database through the Supabase MCP **only after Brian confirms**; verify with reads of `information_schema.columns` and `pg_constraint`

## 2. Data

- [x] 2.1 `lib/data/savings.ts`: `alreadySaved` on `SavingsMovementDraft`, `update(movementId, draft)` on `SavingsMutations`, and the pure `splitSavings(movements)` (design D3, D4); `alreadySaved?: true` on `DashboardData['savings']['movements'][number]`; verify with `lib/data/savings.test.mjs` in `npm run test:unit`
- [x] 2.2 `lib/data/supabase/savings.ts`: write `ahorro_previo` on add, new `update` scoped to the user's undeleted `ahorro` row with `expectRows`; server action `updateSavingsMovement` in `app/dashboard/actions.ts` and its wiring in `app/dashboard/supabase-dashboard.tsx`; verify with `npx tsc --noEmit`
- [x] 2.3 `resumenMensual`: select `ahorro_previo`, savings column and projection floor from counted movements only, accumulated balance from every row, projected cycles in between as `max(target, counted) + already saved`, `alreadySaved` on each movement (design D3); verify with `npx tsc --noEmit` and the read-only check in 5.4
- [x] 2.4 Demo: `updated` list in `lib/demo/demo-savings.ts` with `update`, applied in `deriveDemoData` to base and created movements before sorting, and the same split for the sample cycle and the projection (design D3, D4); verify on `/demo` that editing "Bono ahorro" to 80 gives savings 176 €, accumulated 2.676 € and margin 834 €

## 3. Sheet and rows

- [x] 3.1 `EntrySheet`: `toggle` descriptor (`Switch` + hint in a `Collapsible` shown while `shownWhen` holds), boolean in `buildValues` and `false` while hidden; `savingsEntry` with the toggle and the edit title, submit and delete keys (design D5); verify on `/demo` that the switch hides with "Retiro" and the add sheet still saves a deposit
- [x] 3.2 Template: `{ kind: 'savings'; mode: 'edit'; movement }` target, `openSavingsEditSheet` (focus and select the amount), initial values from the movement, save through `update` with "Cambios guardados", delete from the sheet with the savings undo toast (design D5); verify the scenarios of `savings-editing` → *Editing a savings movement* on `/demo`
- [x] 3.3 `SavingsMovementRow` activatable (button, amount chip, "Ya ahorrado" on the date line) inside `SwipeToDelete`; `MovementsCard` `onEditSavings` and "Depósito · Ya ahorrado" on the muted line (design D6); verify tap opens the sheet and a horizontal drag still reveals the delete panel, in the panel and in the card
- [x] 3.4 `lib/csv.ts`: "Ya ahorrado" / "Already saved" in the status column for a marked deposit (design D7); verify by exporting from `/demo` after adding a marked deposit
- [x] 3.5 Strings in `messages/es.json` and `messages/en.json` (`hojaGasto.editarMovimientoAhorro`, `eliminarMovimiento`, `yaLoTenia`, `yaLoTeniaAyuda`, the "Ya ahorrado" tag, the CSV status); verify both languages render with no missing-key warnings

## 4. Tests

- [x] 4.1 New `tests/savings-edit.spec.js` on `/demo` at 390px and 1280px: every scenario of *Editing a savings movement*, *A deposit the user already had*, *The switch follows the type* and *Deleting from the sheet*, reduced motion and axe on the open sheet in both themes; run in Chromium, then Firefox and WebKit
- [x] 4.2 `tests/movements.spec.js`: "a savings row opens nothing" becomes "opens the savings sheet", plus the marked deposit's muted line; `savings-create` and `savings-delete` still pass; run them in the three browsers
- [x] 4.3 Full `npm test` in Chromium and then in the three browsers, `npm run test:unit`, `npm run lint` and `npx tsc --noEmit`; report failures with their output and whether they are this change's
  > Run together with `unify-fixed-charge-sheet` (same working tree). Chromium: 339 passed, 2 skipped, 8 failed: `home` (4), `login-code`, `onboarding-savings`, `weekly-top` "Otras (2)" (broken since the inline calendar of 13/10: `getByLabel('Fecha')` also finds "Elegir fecha") and `desktop-motion-a11y` (3/3 alone). Firefox + WebKit: 620 passed; the failures outside the known ones passed when rerun alone (`/demo` under load). `savings-edit` 42/42 and `movements` 54/54 in the three browsers. `npm run test:unit` 181/181, lint and `tsc` clean.

## 5. Verification and docs

- [x] 5.1 Screenshots on `/demo` at 390px and 1280px, light and dark: the edit sheet (deposit with the switch, withdrawal without), the panel row and the "Movimientos" row of a marked deposit; check them against `motion-skills/AUDIT.md` (the switch's reveal uses the sheet's `Collapsible`, no new motion)
- [ ] 5.2 After 1.2, `/dashboard` against the real database with a read-only script at 390px: savings rows open the sheet with the stored values and figures match `resumenMensual` (no writes)
- [x] 5.3 Update `CLAUDE.md` *Estado actual* (Web/dashboard, Base de datos with `0033`, Tests, OpenSpec) and remove "UI de ahorro — falta editar un movimiento" from *Deuda tecnica*; note that this change archives after `add-transaction-list`
