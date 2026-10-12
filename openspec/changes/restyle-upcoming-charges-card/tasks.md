## 1. Design pass

- [x] 1.1 Run `design-taste-frontend` in audit mode over the current card next to "Movimientos" on `/demo` (390px, both themes) and read `motion-skills/AUDIT.md` §1–§5; note in this task anything that changes D2–D6, and verify by taking "before" screenshots (collapsed, expanded) to compare against in 4.3
  > The skill puts dashboards out of its scope; what applies: one accent, no em dash, no decorative dots (the 6px dot goes), at most one "·" per line. That last one is broken only when a row has both "esperado" and a progress; " · " is the project's separator, so D3 stays. Before screenshots taken (scratchpad).

## 2. Data

- [x] 2.1 `lib/data/upcoming-charges.ts` (D7): add `category: string` from `group.name`, sort by day only (stable); verify `npx tsc --noEmit` passes for both callers (`app/demo/demo-dashboard.tsx`, `app/dashboard/supabase-dashboard.tsx`)

## 3. Pieces

- [x] 3.1 New `components/molecules/upcoming-charge-row.tsx` (D1–D4): `MovementRow`'s row classes, tinted 32px day mark with the neutral check badge when taken, name over a wrapping muted line, flat amount in the `px-2 py-0.5` box, `button` disabled without a handler; verify on `/demo` at 390px in both themes that the mark, name and amount line up with a "Movimientos" row
- [x] 3.2 Rewrite `components/organisms/upcoming-charges-card.tsx` (D5, D6, D8): category-card header with `ExpandChevron`, "Pendientes" `h3` over pending rows, the "N cobrados" fold line with a nested `Collapsible` (folded on load), muted line `[category, esperado, progreso]` joined with " · ", row `aria-label` with the category, no opacity; footer unchanged; verify by toggling the card and the fold on `/demo` and on a projected month (no fold line)
- [x] 3.3 Strings `proximosCobros.grupoPendientes` and `proximosCobros.grupoCobrados` (ICU plural) in `messages/es.json` and `messages/en.json` (D8); verify "3 cobrados" / "3 charged" render with no missing-key warning in the console
- [x] 3.4 Delete `components/atoms/day-chip.tsx` (D11); verify `grep -rn DayChip app components lib` returns nothing and the build compiles

## 4. Verification

- [x] 4.1 Update the specs that open taken rows or read the panel: unfold "cobrados" before "Alquiler" / "Seguro" in `tests/recurring-scope.spec.js` and `tests/recurring-motion-a11y.spec.js` (contrast check with the fold open), and check `projection-demo` (only pending rows, the `#upcoming-charges-panel button` list has no fold line), `projected-entries`, `recurring-create`, `income-recurring`, `desktop-sheets`; verify each passes in Chromium
  > `recurring-scope` (its `openUpcomingCharges` now unfolds) and `recurring-motion-a11y` (four places) unfold the taken charges; the others needed nothing. 73/78 in Chromium with the default workers; the five failures (`desktop-motion-a11y` ×4, `projected-entries` income) pass 7/7 rerun with two workers, the known load flakiness.
- [x] 4.2 New `tests/upcoming-charges.spec.js` for the new scenarios of `upcoming-charges` and `dashboard-ui` (pending first, fold, nothing taken / nothing pending, one mark, muted line with "esperado" and progress, opacity 1, columns and amount edge equal to "Movimientos", header height and title style equal to "Vivienda", chevron colours, keyboard order, reduced motion, axe in both themes, at 390px and 1280px), plus a check that the expanded card adds no text size beyond the six already on the page; verify it passes in Chromium, Firefox and WebKit
- [x] 4.3 Screenshots on `/demo` at 390px and 1280px, light and dark: collapsed, expanded, expanded with the taken charges unfolded, and "Alquiler" at 880 € (muted line with "esperado"); compare to the "before" set and to "Movimientos"; check the taste pre-flight items that apply (one accent, contrast, no nested surfaces, no em dash)
  > Screenshots in the scratchpad (`before-*`, `after-*`). Fixed during the pass: the check badge sat on single-digit days (moved to `-bottom-1 -right-1`); the fold line's 16px chevron now sits centred in a 20px column under the header's; a wrapped muted line split "4 de 10", so each part is `whitespace-nowrap` and the line breaks only at " · " (D3 updated). One accent (brand ink on open chevrons only), no em dash, no nested surfaces.
- [ ] 4.4 `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`, then `npm test` in Chromium and the full run; report every failure with its output, separating the known flaky `/demo` ones in Firefox/WebKit
  > Lint, `tsc` and `test:unit` (169) clean. Chromium full run: 292 passed, 2 skipped, 24 failed while another session recorded a video against the same dev server; the 12 known (`home`, `login-code`, `onboarding-*`) aside, the other 12 passed 39/39 rerun with two workers. Still to do: the full run in the three browsers once the server is free.
- [x] 4.5 Update `CLAUDE.md` *Estado actual* (Web/dashboard, Tests, OpenSpec) with the change; no commit until Brian asks
