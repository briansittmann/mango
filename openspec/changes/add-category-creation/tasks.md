## 1. Data contract and demo implementation

- [x] 1.1 Add `create(draft: CategoryDraft): Promise<string>` to `CategoryMutations` in `lib/data/categories.ts`, documented like its siblings (resolves with the new id, rejects with `DUPLICATE_CATEGORY_NAME` on a taken name, creates nothing on failure — D1). Verify `npx tsc --noEmit` now reports the demo implementation as incomplete, which is the intended signal.
- [x] 1.2 Extend `DemoCategoryEdits` in `lib/demo/demo-categories.ts` with `created: { id: string; draft: CategoryDraft }[]`, add it to `noDemoCategoryEdits`, and implement `create`: trim and case-fold the name against `currentGroups`, reject with `DUPLICATE_CATEGORY_NAME` on a hit, otherwise mint an id, append the record and resolve with the id (D4). Verify `npx tsc --noEmit` passes.
- [x] 1.3 Fold `update`'s duplicate check to the same case-insensitive comparison so rename and create agree (D5). Verify the existing `category-sheet` Playwright coverage still passes.
- [x] 1.4 In `deriveDemoData` (`lib/demo/demo-expenses.ts`), append created groups after the deletion pass and before the stored-order sort, each with `expenses: []`, `total: 0` and a budget only when the draft carries one (D4). Verify a created category lands last, renders 0 €, and leaves the expenses total and free margin unchanged.

## 2. Strings

- [x] 2.1 Add the create-mode and tile keys to `messages/es.json` and `messages/en.json` — the tile label ("Añadir categoría" / "Add category"), the sheet's create title, the primary action ("Añadir" / "Add") and the created-category announcement — under the existing `dashboard` and `hojaCategoria` namespaces. Verify `/demo` renders both languages with no `next-intl` missing-message warning in the console.

## 3. The category sheet's create mode

- [x] 3.1 Export `CATEGORY_COLORS` from `components/molecules/color-swatch-picker.tsx` with no other change (D3). Verify the picker still renders the same swatches in the same order.
- [x] 3.2 Add `mode: 'create' | 'edit'` to `CategorySheet`, make `target` nullable, branch `buildFieldState` for create (empty name, empty budget, supplied initial colour), and render the delete, reorder and progress rows only in edit mode (D2). Verify create mode's body ends at the colour picker, per *Create mode shares the panel and drops the two rows*.
- [x] 3.3 Switch the header in create mode: the create title in place of the category name, the dot still following the picker, and the primary action reading "Añadir". Verify against *Create mode opens empty and focused*.
- [x] 3.4 Focus the name field on open in create mode by passing `initialFocus={nameRef}` to `SheetShell` instead of `false`, leaving edit mode's behaviour untouched. Verify the field holds focus on open and the virtual keyboard rises at a 390 × 667 viewport.
- [x] 3.5 Route create mode's submit to an `onCreate` prop, reusing the existing busy, failure-alert and `DUPLICATE_CATEGORY_NAME` inline-error paths. Verify *A duplicate name reports in place* and *A failed create keeps the typed values*.
- [x] 3.6 Keep the primary action disabled while the name is empty or whitespace, and while the budget is invalid. Verify *The primary action waits for a name*.

## 4. The tile

- [x] 4.1 Create `components/molecules/add-category-tile.tsx`: a single button with a transparent background, a dashed hairline border in the muted tokens, the card corner radius, a height below a collapsed card's but at least 44px, and a centred plus and label. Verify against *A hole, not a panel* and *Last in the list, and not a card*.
- [x] 4.2 Add the hover, pressed and focus states — border contrast, a faint surface fading in, the plus rotating 90° over ~200ms, a press scale of ~0.98 springing back — with the rotation and scale behind `motion-safe:` as `AddRow` does (D7). Verify *Hover lights the tile*, *Pressed feedback* and *Reduced motion on the tile*.
- [x] 4.3 Check the tile's label, icon and border against the page background in both themes at 390px with no pointer over it, and adjust tokens until it meets 4.5:1, 3:1 and a visible border. Verify *Legible without hover*, and confirm no brand lime appears in any state.
- [x] 4.4 Render the tile as the last child of the category list in `dashboard-template.tsx`, outside the `AnimatedContent` wrappers (D6), hidden while `reordering`, and disabled when `actions.categories` is absent (D8). Verify *The tile leaves and comes back* and *The tile without a create handler*.
- [x] 4.5 Give the tile its own entrance on the cascade's timing through a wrapper this code controls and can clear before a Flip capture (D6). Verify it fades in with the last cards on load and carries no residual inline transform once the entrance has finished.

## 5. Creating from the dashboard

- [x] 5.1 Wire the tile to open `CategorySheet` in create mode with the preselected colour derived from `CATEGORY_COLORS` and the current groups, falling back to the first entry when every colour is in use (D3). Verify *The preselected colour is the first one free*.
- [x] 5.2 Implement `handleCreateCategory`: call `actions.categories.create`, close the sheet on success, announce the new category through the existing `statusMessage` live region, and return focus to the tile. Verify *The new card is last, collapsed and empty*, *A budget given at creation shows its bar* and *Create mode returns focus to the tile*.
- [x] 5.3 Confirm the created category persists as last through reorder mode, including after entering and leaving without dragging. Verify *The new order survives reorder mode*.

## 6. The create transition

- [x] 6.1 Implement the create path's motion (D6): record the tile's rect, `Flip.getState()` over the card wrappers, `flushSync` the commit, `Flip.from` for the list, and a separate tween of the new card from the tile's box with its content fading in. Verify *The list does not jump*.
- [x] 6.2 Cross-fade a dashed-border overlay out over the new card's solid border rather than tweening `border-style`, drawn at `inset: 0` on the same box. Verify no seam at 1x, 2x and 3x device pixel ratios in both themes.
- [x] 6.3 Kill any in-flight entrance tween on the list before the Flip capture, so a create within the cascade window measures settled boxes (Risks). Verify by creating a category immediately after load.
- [x] 6.4 Branch on `prefersReducedMotion()` before any GSAP call and commit directly (D7). Verify *Reduced motion creates without movement*.

## 7. Tests and verification

- [x] 7.1 Add `tests/category-create.spec.js` on `/demo`: create a category and assert it is last, collapsed, 0 €, with its dot and an options control, and that the expenses total and free margin are unchanged.
- [x] 7.2 Add validation coverage: the primary action disabled for an empty and a whitespace-only name, and a duplicate name (differing only in case and surrounding spaces) reporting inline next to the field with no toast and no new card.
- [x] 7.3 Add tile-state coverage: absent during reorder mode and back afterwards, disabled without category operations, and rest-state contrast in both themes.
- [x] 7.4 Add motion coverage: an existing card's `boundingBox().y` unchanged across the commit frame, and, under emulated reduced motion, the new card and the tile at their final positions with no transform in the first frame after the sheet closes.
- [x] 7.5 Run `npm test`, `npx tsc --noEmit` and `npm run lint`, and confirm every suite passes with no new warnings.
- [x] 7.6 Take screenshots of the tile at rest, hovered and mid-morph in both themes at 390px and at desktop width, and confirm the result reads as native to the existing theme before calling the change done.
