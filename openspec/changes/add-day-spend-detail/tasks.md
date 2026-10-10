## 1. Data

- [x] 1.1 `dayExpenses(groups, day, timeZone)` in `lib/data/weekly-spend.ts`, sharing the counted-row rule with `spentRows`; categories and rows by amount, highest first; verify with cases in `lib/data/weekly-spend.test.mjs` (`npm run test:unit`)

## 2. UI

- [x] 2.1 `spend-calendar.tsx`: `onSelectDay`, cells up to today activate on click and Enter/Space, no `touchToggle` with it, `STEP_CLASS` exported
- [x] 2.2 New `components/molecules/day-selector.tsx`: arrows and day name like the compact `MonthSelector`, in-place day grid on the heat ramp, Escape folds it
  > The ramp classes moved to `lib/ui/heat-step.ts` so the molecule does not import the organism. The shown day is marked with an outline, not `bg-primary`: a fill read as the darkest heat step.
- [x] 2.3 New `components/organisms/day-sheet.tsx` on `SheetShell`: selector, rows by category with subtotals, total with `aria-live`, empty state
- [x] 2.4 `dashboard-template.tsx`: `dayDetail` state, mount, `data-pushed-back`, row → `openEditSheet`
  > The detail's closing returned focus to the calendar cell after the expense sheet had taken it; `SheetShell`'s `finalFocus` now leaves focus alone when it already sits in another open dialog.
- [x] 2.5 Strings in `messages/es.json` and `messages/en.json` (`graficos`)

## 3. Verification

- [ ] 3.1 Scenarios of *Day detail* in `tests/spend-calendar.spec.js` (390px and 1280px, keyboard, axe in both themes); Chromium, then the full `npm test`
- [x] 3.2 Screenshots on `/demo` at 390px and 1280px, light and dark, grid open and closed
