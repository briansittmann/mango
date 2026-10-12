## 1. Data

- [x] 1.1 `userMovements(data, timeZone)` and `groupByDay(movements, today)` in `lib/data/movements.ts` (design D1, D2): exclude every `fixed` / `recurring` / `projected` row, keep all savings movements, order by instant descending with input-order ties, local day via `localDayOf`; verify with `lib/data/movements.test.mjs` (demo's 13 rows in the spec's order, Dublin boundary "Café", exclusions, ties, today/yesterday labels) passing in `npm run test:unit`

## 2. Pieces

- [x] 2.1 New `components/molecules/segmented-control.tsx` on `@base-ui/react/radio-group` over `.segment-track` / `.segment-thumb`, four equal columns, 44px options, `ease-spring` thumb, reduced motion (D6); verify by rendering it on `/demo` inside the card (2.3) and checking arrow keys move the selection and focus
- [x] 2.2 New `components/molecules/movement-row.tsx` (D7): leading mark per kind, description over the kind line, signed amounts, amount chip only on activatable rows, inset hairline, accessible name with description, kind, day and signed amount; verify on `/demo` screenshots at 390px in both themes
- [x] 2.3 New `components/organisms/movements-card.tsx` (D5, D8, D9, D10): header disclosure with title and count (no amount), `Collapsible` body, filter, day headings (`h3`, Hoy/Ayer/short date with the separator normalisation of `weekly-top-chart.tsx`), paging with "Mostrar más" / "Mostrar menos", focus on the first new row, header scrolled into view on "menos", keyed `animate-stat-in` list and staggered new rows, polite live region after user actions, both empty states; verify by toggling, filtering and paging on `/demo`
  > Day headings drop the comma ICU puts after the weekday ("jue, 10 sept"): spec and design now say "jue 10 sept" (the formatter writes "sept", not "sep"). Filter and page are stored back during render so returning to the same cycle starts over.
- [x] 2.4 Strings in the `movimientos` namespace of `messages/es.json` and `messages/en.json` (D12), no em dash in visible copy; verify the card renders in both languages without missing-key warnings

## 3. Dashboard

- [x] 3.1 Mount the card in `dashboard-template.tsx` after the category list inside `data-dashboard-main`, wrapped in `AnimatedContent`, `aria-hidden` / `inert` while reordering, open state with `movementsOpenMobile` / `movementsClosedDesktop` outside collapse/expand all, page size from `desktop` (D4); verify folded at 390px and open at 1280px on `/demo`, and "Contraer todas" leaves it open
- [x] 3.2 Wire row actions: expense → `openEditSheet(group, expense)`, income → `openIncomeEditSheet(entry)`, delete → `handleDeleteExpense` / `handleDeleteIncome` / `handleDeleteSavings`, read-only when the matching `actions.*` is absent; verify edit and swipe-with-undo of "Conciertos" and "Electrónica" update both the card and their category cards on `/demo`
- [x] 3.3 Sidebar entry `SECTION_MOVEMENTS` after the categories in `sectionIds` and the sidebar entries, `navigateTo` opens the card before scrolling; verify at 1280px the entry scrolls below the top bar, opens the card and becomes current
  > A folded card opens first and the scroll waits for its disclosure: as the last section, the page was too short to bring it under the bar (design D4 updated).
- [x] 3.4 React Bits check (D11): with the shadcn MCP, search `@react-bits` for an animated list or segmented control; port by hand only if it meets D9, otherwise note the rejection in this task
  > The shadcn MCP was not loaded in this session; `AnimatedList-TS-TW` was read straight from the registry (`reactbits.dev/r/`). Rejected: it re-reveals items on every scroll (a marketing recipe on a daily list), runs 620 ms transforms (D9 caps at 300 ms), owns a 440 px scroll container, and is a `listbox` with window-level arrow keys, which fights the row buttons and swipe-to-delete.

## 4. Verification

- [x] 4.1 New `tests/movements.spec.js` covering every scenario of `transaction-list` and the new "Movimientos" lines of `dashboard-ui` → *Expense cards group each expense exactly once* at 390px and 1280px, with reduced motion and axe in both themes (reuse `tests/widgets-helpers.js` / `tests/desktop-helpers.js`); run it in Chromium, then the full `npm test`, and report failures with output
  > 17 tests, 51/51 in Chromium, Firefox and WebKit. Brian changed two things after the first commit: pages of 10 at every width (was 15 / 25) and category cards folded by default at `lg` too (edited in `add-desktop-dashboard-shell`'s delta). The full Chromium run: 291 passed, 12 failures outside this change (`home`, `login-code`, `onboarding-*`, `example.spec`, none renders the dashboard) and `desktop-shell` ocio flaky under load (3/3 alone).
- [x] 4.2 Existing specs that count cards or check nesting (`dashboard-ui` *Mobile visual hierarchy* checks, `desktop-shell`, `desktop-tiles`, `reorder-mode`) still pass with the new card; verify in the same `npm test` run
  > `desktop-shell` (sidebar list now ends with "Movimientos", the end of the page marks it), `desktop-tiles`, `desktop-sheets`, `desktop-motion-a11y`, `widgets-desktop` (open a card through `openCategory`) and `widgets-motion-a11y` (the filter's 14 px labels were a seventh text size: now 13 px) updated and passing in the three browsers.
- [x] 4.3 Screenshots on `/demo` at 390px and 1280px, light and dark: folded, open, each filter, after "Mostrar más" (with three added expenses), empty filter; check against `motion-skills/AUDIT.md` and the taste pre-flight items that apply (no em dash, one accent, contrast, no nested surfaces)
- [ ] 4.4 `npm run lint` and `npx tsc --noEmit` pass; `/dashboard` against the real database at 390px and 1280px shows only Brian's own entries (no Sueldo, no fixed charges) with a read-only script, no writes
- [x] 4.5 Update `CLAUDE.md` *Estado actual* (Web/dashboard, Tests, OpenSpec) and move the change's Open Questions and accepted risks into *Deuda tecnica* when archiving
  > *Estado actual* updated; *Deuda tecnica* moves at archive time.
