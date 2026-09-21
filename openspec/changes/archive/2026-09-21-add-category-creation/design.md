## Context

See proposal.md — *Why*. What shapes the approach:

- **The sheet already exists and is single-surface.** `components/organisms/category-sheet.tsx` holds name, colour and budget in one `FieldState`, resolves delete as a second `step` on the same panel, and takes its initial values from the `ExpenseGroup` that opened it. Create mode has no such group.
- **Mutations are injected, never imported.** `DashboardActions.categories` is a `CategoryMutations` the page supplies; `lib/demo/` is the only implementation today, and it works by pushing an *edit record* into React state which `deriveDemoData` replays over the frozen `buildDemoData` output. Creation has to fit that replay, not bypass it.
- **The list already animates in three different ways.** `AnimatedContent` runs the entrance cascade and leaves an inline transform on each card's wrapper; reorder mode runs a hand-rolled FLIP in `animateOrderChange`; the drag runs its own transforms. A fourth animation has to coexist with the transforms the other three leave behind.
- **`gsap` 3.15 is already installed** and ships `Flip`, which the codebase has not used yet — `animateOrderChange` measures and tweens by hand.
- **The palette lives in a component.** `CATEGORY_COLORS` is a module-private array in `color-swatch-picker.tsx`, and its order is what "the first colour not in use" means.

## Goals / Non-Goals

**Goals**

- One sheet component serving both modes, so the panel, validation, busy and failure behaviour cannot drift between them.
- A create-morph that composes with the existing entrance, reorder and drag transforms rather than fighting them.
- The demo's `create` reaching the screen through `deriveDemoData`, like every other demo mutation.

**Non-Goals**

- Refactoring `animateOrderChange` onto GSAP Flip. It works; touching it risks reorder mode for no gain here.
- Generalising the tile into a reusable "empty slot" primitive. There is one.
- Any change to how the entrance cascade picks its delays.

## Decisions

### D1 · `create` resolves with the new category's id

```ts
create(draft: CategoryDraft): Promise<string>
```

`update` and `delete` resolve with `void` because the caller already knows which category it acted on. The create caller does not: it needs the id to key the new card and to hand GSAP the right element. Returning it from the operation keeps the id's allocation with the data source, where it belongs — the demo mints `cat-${counter}`, Supabase will return the inserted row's uuid.

*Alternatives:* resolve `void` and diff the next `groups` array to find the newcomer (fragile — two creates in flight, or a name that matches an existing one, break the diff); pass a client-generated id in (forces every data source to accept a foreign key rather than issue its own).

### D2 · One sheet, a `mode` prop, `target` optional

`CategorySheet` takes `mode: 'create' | 'edit'`; `target` becomes `ExpenseGroup | null`, and `onSave`/`onDelete`/`onReorder`/progress props are only read in edit mode. `buildFieldState` gains a create branch: empty name, empty budget, and the colour from D3. The delete, reorder and progress rows render only when `mode === 'edit'`, and the primary action's label and the `onSave`-vs-`onCreate` call site switch on the same flag.

Everything else — `SheetShell`, `isDirty`, `busy`, the duplicate-name error path, the failure alert — is shared as-is. The duplicate rejection already travels as `Error(DUPLICATE_CATEGORY_NAME)` and is already mapped to the inline `nameError`, so create gets inline duplicate reporting for free.

The name field needs focus on open in create mode; the sheet passes `initialFocus={nameRef}` instead of the `false` it passes today, which is what raises the virtual keyboard.

*Alternative:* a separate `CategoryCreateSheet`. Rejected — the two would share about 80% of their body and every geometry, busy and failure rule the specs state once for both, and they would drift on the first change to either.

### D3 · The preselected colour is derived, not stored

`CATEGORY_COLORS` is exported from `color-swatch-picker.tsx` (no new module, no visual change) and the template picks the first entry no current group uses, falling back to `CATEGORY_COLORS[0]` when all are taken.

On today's demo the seven categories use `granate` among others, so the first free colour is `rojo` — the second swatch. That is a consequence worth seeing before it ships: `--cat-rojo` is a category token and distinct from the `--destructive` the budget bar uses, so the reserved signal still reads, but a brand-new category arriving in red is a design call rather than an accident. Changing it means either reordering `CATEGORY_COLORS` or having the scan skip the red-family tokens — both are one-liners, and neither is in this change as written.

*Alternative:* always preselect a fixed colour (e.g. `gris_calido`). Rejected — with eight categories the user would rename and recolour every one.

### D4 · Demo creation is an edit record replayed by `deriveDemoData`

`DemoCategoryEdits` gains `created: { id: string; draft: CategoryDraft }[]`. `createDemoCategoryMutations.create` checks the trimmed, case-folded name against the current groups, rejects with `DUPLICATE_CATEGORY_NAME` on a hit, otherwise mints an id, appends the record and resolves with that id.

In `deriveDemoData` the created groups are appended **after the deletion pass and before the stored-order sort** (step 5 → 6 in `lib/demo/demo-expenses.ts`). That placement matters: appending before deletions would let a create be swept up by a delete's reassignment, and appending after the sort would ignore a stored order that already names the new id. Each created group is built with `expenses: []`, `total: 0`, and a `budget` from `getBudgetStatus` only when the draft carries one — the same shape `buildCategory` produces, so nothing downstream (pie chart, summary row, upcoming charges) needs to know the category is new.

Because the sort ranks ids the stored order does not name *after* the ones it does, an appended creation lands last without `create` having to write an order — which is exactly "`orden` = last + 1".

### D5 · Case-insensitive duplicate check, applied to `update` too

Create compares `name.trim().toLocaleLowerCase()` against existing names folded the same way. The demo's `update` compares with `===` today, so without a matching change "Comida" would be refused at creation and accepted at rename. The one-word fix goes in the same file. It tightens rename slightly; no existing spec scenario or test depends on the looser comparison.

*Alternative:* leave `update` alone and accept the asymmetry. Rejected — the asymmetry is visible to a user in two taps, and this is the only implementation of the contract.

### D6 · The morph is GSAP Flip on the card, not a tile that mutates

Idiomatic React renders the new card and the tile as two elements; the tile is not literally transformed into the card. The impression the spec asks for is produced instead by:

1. Before committing, record the tile's `getBoundingClientRect()` and take `Flip.getState()` over the list's card wrappers.
2. `flushSync` the state update that adds the card — so the new card and the relocated tile exist in the DOM in the same frame, and measurements below are of the final layout.
3. `Flip.from(state, { duration: 0.4, ease: 'power2.out' })` so every pre-existing card travels rather than jumps, and the tile travels from its old box down to its new one.
4. Separately tween the new card from the tile's recorded box to its own: `y`, `height` and `scaleX` if needed, with its content faded in over the second half, and a dashed-border overlay layer that starts opaque and fades out — `border-style` does not interpolate, so the resolve from dashed to solid is a cross-fade of two borders, not a tween of one.

The tile is rendered **outside** the `AnimatedContent` wrappers the cards use, as the list's last child. `AnimatedContent` leaves an inline transform behind, and a residual transform is exactly what makes Flip measure the wrong box. The tile gets its own entrance instead, on the same cascade timing but through a wrapper this code controls and can clear.

*Alternative:* extend the hand-rolled `animateOrderChange` FLIP to cover an insertion. Rejected — it tweens `translateY` only, and the morph needs size and cross-fade on one element while the rest of the list translates. Flip handles the two cases in one timeline and is already a dependency.

### D7 · Reduced motion is a branch at the call site, not a CSS override

Following `animateOrderChange`, the create path calls the existing `prefersReducedMotion()` helper and, when it is true, commits the state and returns before any GSAP call. The tile's hover rotation and press scale are handled the other way, with `motion-safe:` variants as `AddRow` already does, because those are CSS states rather than a scripted timeline.

### D8 · The tile is disabled, not hidden, when no handler is supplied — but absent in reorder mode

Two different absences, for two different reasons. Without `actions.categories` the tile follows *Controls without a handler are disabled* like every other data control and stays in place, so the end of the list keeps its shape. In reorder mode it is unmounted, because the mode's contract is that the list holds cards and handles and nothing else, and a dimmed-but-present slot would sit in the drop zone.

## Risks / Trade-offs

- **The morph runs while the entrance cascade may still be in flight** (a user who taps within ~800ms of load) → Flip measures live boxes, so a mid-cascade card would be captured mid-transform. Kill any running entrance tween on the list before `Flip.getState`, and cover it with a Playwright case that creates immediately after load.
- **Three transform systems on the same nodes** (entrance, reorder, create) → the create path never runs while `reordering` is true, because the tile does not exist then; and the entrance wrapper is bypassed for the tile by D6. The remaining overlap is entrance-vs-create, mitigated above.
- **`rojo` as the default colour for the first new category** (D3) → flagged rather than mitigated; changing it is a one-line reorder of `CATEGORY_COLORS` or a skip in the scan.
- **The dashed border is a two-layer cross-fade** → two stacked borders can show a 1px seam at fractional device pixel ratios. Draw the overlay border on the same box with `inset: 0` and no extra size, and check at 2x and 3x.
- **Duplicate detection is client-side only** → true for `update` today as well. The real data source will have to enforce it with a unique index and keep rejecting with the same distinguishable error; the contract is already written that way.
- **Playwright cannot assert "no jump" directly** → the test compares an existing card's `boundingBox().y` across `flushSync`'s commit frame rather than sampling the tween, which is what the scenario is worded against.

## Migration Plan

None. No migration, no schema change — `categorias` already carries every column (`nombre`, `color`, `orden`, and the budget row is separate). The change is additive to `CategoryMutations`: a data source that does not implement `create` fails to typecheck, which is the intended signal, and `lib/demo/` is the only implementation today.
