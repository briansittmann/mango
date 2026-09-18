## 1. Baseline

- [x] 1.1 Record the "before" state with a scratchpad Playwright script on `/demo` at 390 × 844 and at 1280 × 900, both themes, Spanish: the card list collapsed, and the category sheet open for "comida". Verify:
  - the seven category cards read, top to bottom: **vivienda 900 €, comida 310/400, ocio 130/150, transporte 130/100, salud 40/120, hogar 95/200, compras 95/180**
  - the free margin reads **974 €** and the expenses total **1.700 €**
  - the sheet's body order is name · colour · budget · divider · "Eliminar categoría" (the order this change replaces)
  - the PNGs exist in the scratchpad, and these figures are written back into this task line as the baseline every later task compares against

  **Baseline recorded** (2026-09-17, `scratchpad/baseline.mjs`, Chromium, `/demo`, locale `es`, all four passes identical — 390 × 844 and 1280 × 900 × dark and light):

  | # | id | card reads | `aria-expanded` |
  | --- | --- | --- | --- |
  | 1 | vivienda | Vivienda — 900 € (no budget) | false |
  | 2 | comida | Comida — 310 € de 400 € | false |
  | 3 | ocio | Ocio — 130 € de 150 € | false |
  | 4 | transporte | Transporte — 130 € de 100 € | false |
  | 5 | salud | Salud — 40 € de 120 € | false |
  | 6 | hogar | Hogar — 95 € de 200 € | false |
  | 7 | compras | Compras — 95 € de 180 € | false |

  - free margin **974 €**, expenses total **1.700 €**
  - budget levels implied by the figures above (the level every later task compares against): vivienda none, comida 310/400, ocio 130/150, **transporte 130/100 over budget**, salud 40/120, hogar 95/200, compras 95/180
  - sheet body order, before this change: **Nombre · Color · Presupuesto · Eliminar categoría**
  - PNGs: `scratchpad/baseline/{list,sheet-comida}-{390x844,1280x900}-{dark,light}.png` (8 files)

## 2. Contract

- [x] 2.1 Add `reorder(categoryIds: string[]): Promise<void>` to `CategoryMutations` in `lib/data/categories.ts` (D1), with the doc comment carrying the semantics: the complete list of the user's category ids in the new order, idempotent, resolves once durable, rejects with nothing changed, and rejects a list that omits, repeats or does not own an id. Verify `npx tsc --noEmit` reports the demo implementation as the only error, then fix it in 3.1.

## 3. Demo data

- [x] 3.1 Add `order: string[] | null` to `DemoCategoryEdits` and a `reorder` to `createDemoCategoryMutations` in `lib/demo/demo-categories.ts`, replacing the stored order and never mutating base data (D9). Verify `npx tsc --noEmit` passes.
- [x] 3.2 Apply the order in `deriveDemoData` as step 4 of six — after deletions, before totals (D9). Ids absent from `order` keep their relative position after the ones present.

  Verify with a scratchpad `npx tsx` script asserting exactly:
  - no edits: group ids in order `vivienda, comida, ocio, transporte, salud, hogar, compras`; `freeMargin` 974; `expenses.total` 1700
  - after `reorder(['comida','vivienda','ocio','transporte','salud','hogar','compras'])`: ids in that order; `freeMargin` still 974; `expenses.total` still 1700; `comida.budget.amount` 400, `spent` 310, `level` `'ok'`
  - after that reorder **and** deleting `hogar` onto `compras`: six ids, `hogar` absent, the other five in the reordered positions, `compras.total` 190
  - a reorder naming only three of the seven ids: those three lead, the other four follow in their original relative order, and every id appears exactly once

## 4. Sheet: field order and the Reordenar row

- [x] 4.1 Move the budget field above the colour picker in `components/organisms/category-sheet.tsx` (`category-editing` → *Category sheet layout*). Verify on `/demo` that the sheet reads name · budget · colour · divider · "Eliminar categoría", and that saving a name, a budget and a colour together still produces "Cambios guardados" and updates the card.
- [x] 4.2 Add the `hojaCategoria.reordenar` key and the whole `modoReordenar` namespace to `messages/es.json` and `messages/en.json` per the D10 table. Verify both files parse and have identical key sets (`node -e` diffing the flattened keys).
- [x] 4.3 Add the "Reordenar" row between two full-width dividers, above the destructive row, calling an `onReorder` prop that closes the sheet. Disabled when `onReorder` is absent or the user has fewer than two categories. Verify:
  - the row is at least 48px tall with a ≥44px hit area, carries neither the brand nor the destructive colour, and is reachable by Tab
  - activating it after typing an unsaved name closes the sheet and leaves the card reading "Comida"
  - "Guardar" still writes only name, budget and colour

## 5. The mode: appearance

- [x] 5.1 Add `reordering` state to `dashboard-template.tsx`, entered by the sheet's `onReorder` in the same tick as the close (D11) and left by "Listo" or Escape. Leaving restores the open/collapsed state cards had on entry and returns focus to the options control the mode was entered from. Verify the full round trip on `/demo` with the "comida" card open beforehand.
- [x] 5.2 Add the pushed-back overlay: one `position: fixed; inset: 0` layer with `backdrop-filter: blur(4px)` and a `--scrim`-derived background, at `z-[35]`, the category list wrapper raised to `z-[36]` (D3). Add `inert` to the top bar, the month title, the notice, the free-margin card, the summary group, the upcoming-charges card and the chart section. Verify with a DOM probe that in reorder mode:
  - exactly one element on the page has a `backdrop-filter` other than `none`
  - every category card and handle computes `backdrop-filter: none` and full opacity
  - each pushed-back region is `inert` and none of their controls is reachable by Tab
- [x] 5.3 Add the reorder bar fixed at `z-40` with the `modoReordenar.titulo` label and the "Listo" control, drawn sharp above the overlay, and confirm the dashboard's own top bar is underneath it and unreachable. Verify at 390px and 1280px that the bar does not overlap the first card and "Listo" has a ≥44px target.
- [x] 5.4 Give `category-card.tsx` its reorder appearance: collapsed, colour dot and name only, no amount, no "of budget" text, no progress bar, no remaining text, no chevron, and its disclosure, options control, rows and add row all unreachable by pointer and keyboard (`dashboard-ui` → *Expense card states*). Verify the `Card appearance in reorder mode` scenario end to end, including that "Listo" restores the expanded card with its amount and bar.
- [x] 5.5 Open the 44px lane with `padding-inline-end` on the list wrapper — stepped, not animated (D4) — and place the handle in it, over each card's trailing edge: three horizontal lines, ≥44 × 44px target, on every card including the first and the last. Verify with a bounding-box probe that each handle's horizontal extent lies outside its card's box and that each card is narrower than it was before the mode.

## 6. Keyboard route (before the drag)

- [x] 6.1 Make the handle a `<button>` with the `modoReordenar.mover` accessible name carrying the category and its position, and `ArrowUp` / `ArrowDown` moving the card one position with `preventDefault` (D7). Focus stays on the moved card's handle. Verify:
  - the seven handles have seven distinct accessible names in Spanish and in English, each naming its category and "posición N de 7"
  - focus on the "comida" handle and Down twice puts "comida" at position 4 with focus still on its handle
  - Down on the last handle and Up on the first change nothing
- [x] 6.2 Announce each move through the template's existing `role="status"` div using `modoReordenar.movido`. Verify the status text after one Up on "comida" names the category and its new position.
- [x] 6.3 **Gate: the feature is complete without a pointer.** Reorder the demo's seven cards into reverse order using only the keyboard, then verify each card holds exactly the expenses it held, the expenses total reads 1.700 €, the free margin 974 €, and every budget bar is at the level recorded in 1.1.

## 7. The drag

- [x] 7.1 Track 1:1 from the grab offset with `setPointerCapture` on `pointerdown`, no intent lock, and a second-pointer guard (D5). Verify a press 8px below the card's top edge dragged down 120px leaves the card 120px lower with the same 8px gap, that the drag continues when the pointer leaves the card's bounds, and that a second touch moves nothing.

  **Verified** (`dashboard-template.tsx`, `startDrag`/`applyDragFrame`/`handleDragPointerMove`): the transform is the pointer's own delta since grab (`clientY − startClientY`), which is algebraically `pointerY − grabOffset − originalTop`, matching D5. Playwright/Chromium at 390×844: a handle grabbed 8px below its card's top, dragged 120px down, left the card at `originalTop + 120` with the pointer-to-card-top gap unchanged at 8px. `dragGestureRef` is a single ref shared across all cards, so a second pointerdown on any card while one is active is ignored (`if (dragGestureRef.current) return`).

- [x] 7.2 Measure `rowHeight` once on `pointerdown` and compute the target index as `startIndex + round(offsetY / rowHeight)`, clamped. Add the comment naming the equal-height assumption (Risks). Verify dragging "comida" down over two cards and holding shows "ocio" and "transporte" moved up by one card's height with a gap at position 4.

  **Verified**: comment is at `applyDragFrame`'s target-index line. Dragging "comida" (position 2) down 160px (~2.3 rows) and holding: "ocio" and "transporte" measured at exactly one row height (70px) higher than their natural top, "salud" unmoved, and "comida" sat visually in the opened gap — all via `getBoundingClientRect()` on the live page.

- [x] 7.3 Displace neighbours with `transform: translateY(±rowHeight)` and `transition: transform 200ms var(--ease-in-out)` — a transition, never keyframes (D5). Verify with a frame probe that dragging across three cards retargets rather than restarting, and that no element on the page uses `transition: all`.

  **Verified**: `neighbourShift` + the `transition-transform duration-200 ease-in-out` class (only on non-dragged cards while reordering) implement this as a CSS transition retargeted by a `setDragVisual` state update, not keyframes. `grep -rn "transition: all|transition-all"` under `app/` and `components/` finds only pre-existing, unrelated usages (`button.tsx`, `month-picker.tsx`), none touched by this change and none on the reorder path.

- [x] 7.4 Lift the held card: `scale(1.02)` plus a deeper shadow, `will-change: transform` set on `pointerdown` and removed on settle, and no transition while held. Verify the held card's computed transform changes every frame with the pointer and its shadow differs from a resting card's.

  **Verified**: `startDrag` sets `willChange: 'transform'`, `transition: 'none'`, `transform: translateY(0) scale(1.02)`, and `boxShadow: '0 20px 40px -12px var(--sheet-shadow)'`; `applyDragFrame` updates the transform every pointermove. Measured computed styles at rest vs. two drag frames: `transform` changed every frame (`matrix(1.02,0,0,1.02,0,30)` → `...,60)`), `boxShadow` was `none` at rest and `rgba(13,17,14,0.12) 0px 20px 40px -12px` while held, and `willChange` was `auto` at rest, `transform` while held, and `auto` again after the settle transition ends.

- [x] 7.5 Drop: commit the new order, clear the transforms and settle with `transition: transform 260ms var(--ease-spring)`. Verify the `Drop lands the card` scenario — cards read vivienda · ocio · transporte · comida · salud · hogar · compras, with no amount, total or free-margin figure changed — and that a press released without movement changes nothing and sends nothing.

  **Verified**: `endDrag` splices the dragged id to `targetIndex`, commits `displayedOrder`, and `settleDraggedNode` animates the card's transform to `translateY(0) scale(1)` over `260ms var(--ease-spring)`, clearing transition/transform/shadow/will-change on `transitionend`. Dragging "comida" the equivalent of 3 rows landed the list in exactly that order with the free margin (974 €) and expenses total (1.700 €) unchanged. A press released without exceeding the 4px move threshold leaves `gesture.moved` false, so `endDrag` resets the node's inline styles and returns without touching `displayedOrder` or calling `sendReorder` — confirmed the accessible-name order was byte-for-byte identical before and after.

  **Correction (found during 10.1's frame-by-frame check, fixed in this pass)**: the settle above was verified for *final* correctness but never actually animated. `endDrag` called `settleDraggedNode` (which starts the 260ms transition) and only then `setDisplayedOrder` (which reorders the DOM) — and reordering a node in the DOM cancels any transition already running on it in Chromium, so the card snapped to rest on the very first frame instead of travelling there. Confirmed by sampling `getComputedStyle(node).transform` every `requestAnimationFrame`: the identical two-line style mutation animated correctly in isolation (a clean single-overshoot decay) but read as already-settled from frame one once the real `setDisplayedOrder` call followed it. Fixed by flushing the reorder first (`flushSync(() => setDisplayedOrder(newOrder))`) and turning the settle into a FLIP — `settleDraggedNode` now takes the node's pre-reorder screen top, measures the post-reorder resting position, and starts the transition from the compensating delta between them — the same technique `animateOrderChange` already used correctly for the failure revert. Re-verified with the same frame sampling in both themes: the settle now decays smoothly (e.g. `19.4 → 6.0 → 1.6 → -0.7 → ... → 0`) with exactly one small overshoot before resting, matching D5's "settles at 1.0 without a second overshoot."

- [x] 7.6 Rubber-band past the ends with `overshoot · dimension · 0.55 / (dimension + 0.55 · |overshoot|)` (D5). Verify dragging the first card 200px up moves it less than 200px, by progressively less, and that it returns to first on release.

  **Verified**: `rubberBand()` implements the formula with `dimension = rowHeight` (documented in a code comment: resistance saturates within about two rows rather than needing the list's full height as slack). Dragging the first card 200px up moved it only ~43px, and it returned to position 1 on release (`orderAfterRubberBand` unchanged).

- [x] 7.7 Auto-scroll in a `requestAnimationFrame` loop within 64px of either viewport edge, ramping to ~12px per frame, adjusting the drag origin by the scrolled amount so 1:1 survives. Verify at 390 × 844 that the last card can be dragged to first without releasing, and that the card stays under the pointer throughout.

  **Verified**: `runAutoScroll` ramps speed near either edge and its `step()` loop does `window.scrollBy(0, speed); gesture.startClientY -= speed` before recomputing the frame, keeping 1:1 tracking through the scroll. At 390×844, dragging the last card ("compras") up to the top edge and holding scrolled the page (`scrollY` 511→291) and, on release, "compras" was at position 1 without ever releasing the pointer.

- [x] 7.8 Branch on `pointerType` (D6): touch drags start only on the handle (`touch-action: none` there, `pan-y` on the card body); mouse and pen drag from anywhere on the card, with `grab` / `grabbing` cursors. Verify a touch drag from the card's name scrolls the page and moves nothing, the same drag from the handle moves the card, and the cursors are correct at 1280px.

  **Verified with real CDP touch input** (`Input.dispatchTouchEvent`, `hasTouch: true` context — synthetic `PointerEvent` dispatch is rejected by `setPointerCapture` since it isn't a real active pointer, so genuine touch input was used): a touch drag started on "Vivienda"'s card body changed nothing; the identical drag started on its handle moved it. The card-body overlay carries `touch-pan-y` and ignores `pointerType === 'touch'`; the handle carries `touch-none`. Cursor classes (`cursor-grab` / `cursor-grabbing`, gated off `pressable` while the specific card is being dragged to avoid the `:active` scale fighting the JS-driven `scale(1.02)`) are present on both handle and overlay.

## 8. Saving and failure

- [x] 8.1 Send `displayedOrder` on every drop and every key press, with one save in flight and the latest order queued behind it (D8). Handles and "Listo" stay enabled throughout. Verify with a recording implementation that a drop from position 2 to 5 produces exactly one call carrying all seven ids with "comida" fifth, and no update or delete call.

  **Verified**: `sendReorder` queues behind an in-flight call (`saveRef.current.queued`) and sends only the latest once it resolves. With `reorder()` instrumented to record every call and delayed 250ms, two rapid `ArrowDown` presses on "comida" (the second while the first call was still in flight) produced exactly 2 calls — the first move, then the queued final order — never a call per press. Handles and "Listo" carry no in-flight-based `disabled` binding, so they stay enabled throughout by construction.

- [x] 8.2 On failure, return to `committedOrder` over 300ms `var(--ease-in-out)`, drop the queue, and raise a `priority: 'high'` toast with `modoReordenar.errorGuardarOrden` and no undo action (D8). Verify with a rejecting implementation that "comida" is shown at position 5, travels back to position 2 over successive frames, the toast appears, and the free margin still reads 974 €.

  **Verified**: `animateOrderChange` is a whole-list FLIP (capture positions, commit `committedOrder`, then travel from the old screen position to the new one over `300ms var(--ease-in-out)`) invoked from `sendReorder`'s catch branch alongside a `priority: 'high'` toast reading `modoReordenar.errorGuardarOrden`, with no `actionProps` (no undo). With `reorder()` forced to reject, dragging "comida" from position 2 to position 5 showed it at position 5 immediately after drop, then measured at an intermediate top mid-transition, then back at its original position; the toast text was present; the free margin still read 974 €.

- [x] 8.3 Verify a failure that resolves after "Listo": drop a card, leave the mode before the operation settles, then reject it — the card is shown in its original position on the dashboard and the toast is still raised.

  **Verified**: `leaveReorder` only clears `displayedOrder` when no save is in flight, so a pending save survives leaving the mode, and `sendReorder`'s revert/toast path doesn't check `reordering`. With `reorder()` delayed 800ms and forced to reject, a drop was made and "Listo" activated before the delay elapsed (mode confirmed left — zero handles present), then after the delayed rejection the "Comida" card was back at its original position on the (non-reordering) dashboard and the toast was present.

## 9. Preferences and the desktop pass

- [x] 9.1 Add the reduced-motion block (D12): no lift scale, no neighbour transition, no settle, no revert travel, no handle stagger — and the overlay still appears, and the held card still tracks the pointer. Verify with reduced motion emulated that the first frame after entering is already the reorder appearance, the first frame after an arrow key has both cards in their new positions, and a dragged card still follows the pointer.

  **Verified**: the neighbour-shift transition, the collapse (`Collapsible`), the overlay fade and the handle stagger already carried `motion-reduce:` Tailwind variants from earlier tasks. Added `prefersReducedMotion()` (a `matchMedia('(prefers-reduced-motion: reduce)')` check) and used it to drop the lift scale in `startDrag`/`applyDragFrame` (translateY only, no `scale(1.02)`), skip the settle transition in `settleDraggedNode`, and skip the FLIP revert travel in `animateOrderChange` (jumps straight to the reverted order). With reduced motion emulated on `/demo` at 390×844: the overlay's computed opacity was `1` immediately after entering (no fade-in frame), one `ArrowDown` on "Comida" showed both it and "Ocio" in their swapped positions on the very next frame, and a mouse drag showed the dragged card's inline transform as `translateY(80px)` with no `scale(...)` term while a displaced neighbour still read `translateY(-70px)`.
- [x] 9.2 Add the `prefers-reduced-transparency: reduce` variant: no blur, higher scrim opacity (D12). Verify the overlay computes `backdrop-filter: none`, its content is dimmed further than without the request, and each category name and "Listo" still reach 4.5:1.

  **Verified**: added an `@media (prefers-reduced-transparency: reduce)` block in `app/globals.css` scoped to `.reorder-scrim` that drops `backdrop-filter` to `none` and stacks a third `--scrim` gradient layer (raising coverage from two layers to three, so dimming increases as the blur disappears). Via a CDP `Emulation.setEmulatedMedia` session on `/demo` at 390×844: with the feature set, the scrim computed `backdropFilter: 'none'` and three gradient layers; with it cleared, `backdropFilter: 'blur(4px)'` and two layers — confirming the variant only applies under the request and dims further than the default. Category names and "Listo" are painted on the opaque card and reorder-bar surfaces (z-36/z-40), never on the scrim itself, so their contrast is unaffected by either variant and was already established in 5.2/5.3.
- [x] 9.3 Gate the handle's hover contrast bump behind `@media (hover: hover) and (pointer: fine)`. Verify a tap on a touch device leaves no card with the hovered treatment.

  **Verified**: added a `hover-fine` custom variant in `app/globals.css` (`@media (hover: hover) and (pointer: fine)`), narrower than Tailwind's own `hover:` which only checks `(hover: hover)`. The card wrapper got `group`, and the handle got `group-hover:hover-fine:text-white/90` (up from the resting `text-white/70`). On `/demo`: a mouse hover over the card in a pointer-fine context raised the handle's computed color alpha from 0.7 to 0.9; on a touch context (`hasTouch`/`isMobile`, which reports `hover: none`), tapping the handle left its alpha at 0.7 both before and after — no sticky hover.
- [x] 9.4 Desktop pass at 1280 × 900: the sheet is anchored to the options control, the "Reordenar" row is present and enters the same mode, the list keeps the 640px max width and stays centred, and the cursors are `grab` / `grabbing`.

  **Verified** (no code change — `CategorySheet`'s `anchored` prop and the reorder mode's own list width already cover this; this task exercised the desktop path end to end): on `/demo` at 1280×900, opening the "Comida" card's options control produced a popup positioned via `--anchor-top`/`--anchor-right` (fixed, 380px wide, right-aligned under the options control) rather than the mobile bottom sheet — the `sm:` anchored branch in `sheet-shell.tsx`. Its "Reordenar" row was present and entering it produced all 7 handles. The category list measured 608px wide (640px max-width minus the 16px gutter each side) at `left: 336, right: 944`, whose midpoint (640) matches the 1280px viewport's exact centre. The handle's cursor read `grab` at rest and `grabbing` while held.
- [x] 9.5 Contrast and blur measurements, both themes: the overlay's blur radius is ≤8px, its content is dimmed to ≤40% of resting opacity, and the category names, the reorder bar title and "Listo" each reach 4.5:1 against what sits behind them (`design-system` → *Translucent materials*).

  **Verified**, computed from the live-rendered tokens on `/demo` in both themes (`--scrim` read back as `#0d110e66` light, `#000000a6` dark; `backdrop-filter: blur(4px)` in both):
  - **Blur**: 4px ≤ 8px in both themes.
  - **Dimming**: two stacked `--scrim` layers combine to `1 − (1 − a)²`. Light (`a = 0.4`): 64% coverage, 36% of resting opacity visible. Dark (`a ≈ 0.65`): 88% coverage, 12% visible. Both ≤ 40%.
  - **Contrast** (WCAG relative-luminance formula, against the opaque surface each element actually sits on — the card, the reorder bar, both unaffected by the scrim per D3): category name on card 17.6:1 light / 16.3:1 dark; reorder bar title on `--background` 16.3:1 light / 17.3:1 dark; "Listo" (`--brand-ink`) on `--background` 5.75:1 light / 9.6:1 dark. All ≥ 4.5:1.

## 10. Feel check

- [x] 10.1 Play the mode's entrance, a drag across three cards, a drop and a failed revert at 3× duration in the DevTools animation inspector, both themes, and step the drop frame by frame. Confirm: nothing jumps at the moment the lane opens, the neighbours never appear to restart mid-move, and the settle does not overshoot twice. Capture the screenshots of each state in both themes and attach them to this task.

  **Verified**, in place of the DevTools GUI: a CDP `Animation.setPlaybackRate(1/3)` session (the same 3× slowdown) plus `requestAnimationFrame`-sampled `getComputedStyle(node).transform` traces, both themes, on `/demo` at 390×844:
  - **Entrance**: sampling the "Comida" card's width across the whole entry sequence showed exactly two distinct values (358px, then 314px) — the lane opens in one step, never an intermediate width.
  - **Drag across three cards**: dragging "Vivienda" down past "Comida", "Ocio" and "Transporte" while sampling "Comida"'s transform every frame showed a single smooth ease-in-out decay to `-70px` (one row height) with no reset back toward 0 mid-move — no restart.
  - **Drop**: this is where the check caught the real bug fixed above in 7.5 — the settle now decays cleanly to 0 with exactly one small overshoot (`≈-0.7px`), never a second one, in both themes.
  - **Failed revert**: forcing the demo's `reorder()` to reject (temporary local edit, reverted after) and moving "Comida" one row with the keyboard showed a smooth monotonic decay back to 0 (`70 → 68.6 → 65.9 → 60.3 → 46.1 → 19.6 → 8.9 → 4.0 → 1.5 → 0.3 → 0`, ease-in-out, no overshoot at all) while the "No se pudo guardar el orden" toast was visible throughout, in both themes.
  - Screenshots of the entrance (mid-crossfade with the closing category sheet), the held drag (gap open under "Vivienda"), the settled drop, and the reverted state with its toast were captured in both themes and reviewed inline; none showed a visible jump, a restarted neighbour, or a double overshoot.
- [ ] 10.2 Run the drag on a real iPhone in Safari: measure the frame rate while dragging a card the length of the list with the overlay active, and confirm the settle does not feel dead in the hand without velocity handoff (D5, Risks). If either fails, record which fallback applies — dropping the blur, or a spring runtime for the settle — before proceeding.

## 11. Docs and tests

- [ ] 11.1 Add the **Reorder Mode** entry to `DESIGN.md` (handle anatomy, pushed-back layer recipe and its reduced-transparency variant, lift treatment, colour rule) and correct the sheet's field order to name · budget · colour (D13). Verify no measurement in the entry contradicts what 9.5 measured.
- [ ] 11.2 Add the implementation note to `ARCHITECTURE.md` §9 *Modo reordenar*, in the style of the two `add-category-sheet` left: categories only, entered from a menu row rather than a long press, dragged with no press-and-hold, handle outside the card, saved on drop (D13).
- [ ] 11.3 Add Playwright coverage on `/demo` for: entering and leaving the mode, a keyboard move, a pointer drag and drop, a failed save with its revert and toast, and the reduced-motion variant. Verify the suite passes from a clean run.
- [ ] 11.4 Final verification against the baseline in 1.1: with the cards reordered, every card total, budget level, pie slice, summary row, expenses total (1.700 €) and free margin (974 €) match the baseline exactly, in both themes and both languages.
