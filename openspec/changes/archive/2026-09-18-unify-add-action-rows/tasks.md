## 1. Baseline

- [x] 1.1 Before editing code, capture "before" screenshots on `/demo` at 390 × 844 in both themes (Spanish): the income panel, the savings panel and the "comida" card. Use a scratchpad Playwright script. Verify: six PNGs exist in the scratchpad and show the current indented income/savings add rows.

## 2. CSS and messages

- [x] 2.1 In `app/globals.css`, change only the `pressable` active background to `color-mix(in oklab, var(--foreground) var(--press-tint, 4%), transparent)` (D3). Verify: `npm run lint` passes, and the computed pressed background of an expense card header matches the value before the edit.
- [x] 2.2 Add `demo.accionNoDisponible` to `messages/es.json` ("Esta acción no está disponible en la demo") and `messages/en.json` ("This action isn't available in the demo") (D6). Verify: both files parse with `node -e 'JSON.parse(require("fs").readFileSync(process.argv[1]))'` and have the same `demo` keys.

## 3. Components

- [x] 3.1 Rework `components/molecules/add-row.tsx` per D1, D2 and D4:
  - tinted `size-7` badge with `Plus size-4`
  - `group-hover` fill and colour
  - `motion-safe:` badge scale and plus rotation with `ease-spring`
  - `[--press-tint:8%]` and badge press scale
  - props unchanged

  Verify: `npm run lint` passes, and the land-finance colour guard grep returns nothing for the file.
- [x] 3.2 Create `components/molecules/demo-toast.tsx` per D6: an always-mounted `sr-only` `role="status"` text and an `aria-hidden`, `pointer-events-none` inverted capsule with enter/exit motion and a reduced-motion fallback. Verify: `npm run lint` passes, and `grep -n "'use client'" components/molecules/demo-toast.tsx` returns nothing.

## 4. Composition

- [x] 4.1 In `components/templates/dashboard-template.tsx`, remove the `px-4 pb-3` wrappers so both panels render `AddRow` as their last child (D5). Edit only those two blocks. Verify: at 390px, the income and savings add rows measure 356 × 48 at x 17, the same as the "comida" add row.
- [x] 4.2 Create `app/demo/demo-dashboard.tsx` (`'use client'`, message state, 2.5s restartable timeout, add handlers) and make `app/demo/page.tsx` render it with `data` and `changeLanguage` (D6). Verify:
  - `/demo` returns 200
  - the three add rows are enabled
  - the month chevrons are still disabled

## 5. Docs

- [x] 5.1 Add a `### Add Rows` entry under *Components* in `DESIGN.md`: anatomy, states, contrast (D7). Verify: `git diff DESIGN.md` shows the new section as the only addition beyond the edits already uncommitted.

## 6. Verification

Scratchpad Playwright scripts on `/demo`, 390 × 844, in both themes unless stated.

- [x] 6.1 **Geometry** (*Same geometry in every place*). Measure the three add rows, their badges and labels, and the inner edges of their surfaces. Verify: rows are flush with the inner edges, and height, badge size, badge offset and label offset are equal across the three.
- [x] 6.2 **States** (*Rest appearance*, *Hover with a pointer*, *Pressed is stronger than hover*). In a desktop context, read the row background, badge background, badge scale and plus rotation at rest, on hover and while pressed (`mouse.down`), and again after leaving or releasing. Verify:
  - hover row background equals an income-source row's hover background
  - hover badge equals `--brand`
  - pressed background is more opaque than hover, with scale below 1
  - values return to rest afterwards
- [x] 6.3 **Contrast** (*Contrast in both themes*). Compute WCAG ratios from the rendered colours: label against surface, and plus against badge at rest and on hover. Verify: label ≥ 4.5:1 and plus ≥ 3:1 in light and dark. If a ratio fails, adjust the badge tint and re-run 6.2 and 6.3.
- [x] 6.4 **Touch and reduced motion** (*Touch without hover*, *Reduced motion*). In a `hasTouch` + `isMobile` context, tap "Añadir gasto". Verify: afterwards the badge has its rest background and scale 1. With `reducedMotion: 'reduce'` and a hover, verify: the badge background is `--brand`, its scale is 1 and the plus has no rotation.
- [x] 6.5 **Demo message** (*Add action in the demo*, *Repeated add actions*). Activate "Añadir gasto" in "comida". Verify:
  - the card total and row count are unchanged
  - the `role="status"` text reads "Esta acción no está disponible en la demo"
  - the capsule is visible, then hidden within 5s

  Then activate "Añadir ingreso" and, while the message is shown, "Añadir movimiento de ahorro". Verify: exactly one capsule is visible. Repeat once in English and check the English text.
- [x] 6.6 **Visual review.** Capture "after" screenshots matching 1.1, plus hover, pressed and toast states, and read them. Verify:
  - both themes look coherent, and hover is clearly visible
  - no bordered rounded surface sits inside another (*Mobile visual hierarchy*)
  - every visible button is at least 44 × 44px (*Touch targets*)
- [x] 6.7 **Regressions.** Run `npm run lint`, `npx tsc --noEmit` and `npm run build`, plus the land-finance-dashboard 6.1 guard greps. Verify: all pass, and the only guard hit is the pre-existing `demo-notice.tsx` `'use client'`.
- [x] 6.8 **OpenSpec.** Run `openspec validate unify-add-action-rows`. Verify: it reports the change as valid.
