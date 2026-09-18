## Context

See proposal.md → *Why*. What follows is only the state of the code, the documents and the motion reference that shapes the approach.

### Current code

- **`components/templates/dashboard-template.tsx:394-415`** — the category list is a `map` over `data.expenses.groups` in array order, each card wrapped in an `AnimatedContent` whose delay is `0.48 + min(index+1, 5) * 0.05`. The order the data arrives in is already the order on screen; nothing sorts it. `sortedExpenseGroups` (`:201-204`) sorts a *copy*, and only for the expenses summary panel.
- **`components/organisms/category-card.tsx:47-51`** — the card is a single wrapper `div` with `overflow-hidden rounded-card border bg-card`; the open-card colour border lives on it. The header is a stretched disclosure with the content painted above it (`:52-93`), then the budget bar (`:95-99`), then a `Collapsible` holding the rows (`:101-125`).
- **`components/organisms/category-sheet.tsx:230-292`** — the body renders name, then colour, then budget, then a divider and the delete row. Field order is literal JSX order; moving budget above colour is a block move.
- **`components/molecules/swipe-to-delete.tsx`** — the house pattern for a hand-rolled gesture: a `gestureRef` holding `pointerId` and the start point, a 10px intent lock before `setPointerCapture`, `offsetRef` shadowing state so the pointer handler reads the live value, a `transition-transform ... ease-spring` class applied **only while not dragging**, and `onClickCapture` swallowing the click after a drag.
- **`components/atoms/collapsible.tsx`** — 200ms, `ease-drawer`, height + opacity. Already the right shape for collapsing the cards on entry.
- **`app/globals.css:178-183`** — `--ease-spring` (a `linear()` spring), `--ease-bounce`, `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer`. `--scrim` at `:56`. `pressable` at `:201`.
- **`lib/demo/demo-categories.ts`** and **`deriveDemoData`** (`lib/demo/demo-expenses.ts:47-85`) — the edit-log pattern: the log is appended to, never mutated in place, and derivation is pure and recomputes everything on read.
- **`DashboardTemplate`** already mounts a `Toast.Provider` with `limit={1}` and an sr-only `role="status"` div (`:454-456`). Both are reused; neither needs a second instance.

### Dependencies

`package.json` has `gsap` (used only by `AnimatedContent`), `@base-ui/react`, `recharts`. **There is no spring runtime and no drag-and-drop library**, and this change adds neither. That constrains D5.

### Motion reference

The three files in `motion-skills/` are the bar this mode is built to. The rules that actually bind here: `transform`/`opacity` only; never `transition: all`; never `ease-in` on UI; UI durations under 300ms; transitions rather than keyframes for anything retriggered rapidly; reduced motion means gentler, not zero; hover motion gated behind `(hover: hover) and (pointer: fine)`; 1:1 tracking from the grab offset with pointer capture; rubber-banding rather than a hard stop; dim-to-focus for a modal task.

### Conflicts recorded

1. **ARCHITECTURE.md §9 enters reorder mode after a long press** and says that inside the mode "la pulsación larga ya no abre nada". This change never ships a long press at all: the mode is entered from a menu row, which is the same decision `add-category-sheet` already recorded for the category menu itself.
2. **§9's mode covers both levels** — categories among themselves *and* expenses inside a card. This change ships the outer level only. The inner one is not designed away: the mode's state is a screen-level flag and the handle is a self-contained control, so a second level is an addition rather than a redesign.
3. **The request asks for finger-drag from anywhere on the card.** Seven cards are taller than a phone screen, so a touch drag that starts anywhere leaves nothing to scroll with. Resolved in D6 the way the Spotify queue resolves it.

## Goals / Non-Goals

**Goals:**

- A mode that reads as one state change, not as six elements animating separately.
- A drag that is the user's own movement — 1:1, interruptible, never gated behind a delay.
- Exactly one blurred layer, not one per dimmed region, so the cost and the look are both predictable.
- Persistence that cannot half-apply, and a failure that puts the card back where the user took it from.
- A keyboard route built in from the start rather than bolted on.

**Non-Goals:**

- A general reorderable-list abstraction. This is one list of collapsed cards of equal height; the simplification that buys is the point (D5).
- Velocity handoff and momentum projection. There is no throw in this gesture (D5).
- Animating the card's width change (D4).
- Any change to `getBudgetStatus`, the free margin, the charts or the summary rows.

## Decisions

### D1 — `reorder(categoryIds: string[])`: the whole list, every time

```ts
// lib/data/categories.ts
export type CategoryMutations = {
  update(categoryId: string, draft: CategoryDraft): Promise<void>
  delete(categoryId: string, reassignTo: string | null): Promise<void>
  /** The user's every category id in its new order. Idempotent; rejects with nothing changed. */
  reorder(categoryIds: string[]): Promise<void>
}
```

**Alternative considered: `reorder(categoryId, toIndex)`.** Smaller payload, but not idempotent — a retry after an ambiguous failure moves the card twice — and the receiver has to renumber the neighbours anyway, which is the same write. The full list also gives the failure path a free gift: the order to revert to is the previous list, which the client already holds.

For Supabase later this is one statement: `update categorias set orden = v.orden from (values …) v where id = v.id and usuario_id = auth.uid()`. The rejection rules in the spec (omits, repeats, foreign id) are all expressible as a count check inside that statement.

### D2 — The order lives in the data, not in the template

The template already renders `data.expenses.groups` in array order, so **the rendering side needs no change at all**. What the spec adds is the obligation on the *source*: return categories in stored order. `/demo` satisfies it in `deriveDemoData`; the Supabase query satisfies it with `order('orden')` when it is written.

This is why the spec's first requirement is about storage rather than about the UI: the one way this feature can be quietly broken later is a query that forgets the `order by`, and that is a data-layer requirement, not a component one.

### D3 — One fixed overlay, not a class on six regions

The dimmed content is interleaved through the document with the list in the middle of it, so there is no single wrapper to blur. Two ways out:

- **A class on each pushed-back region.** Six `filter: blur()` layers, six composited surfaces, six things to keep in sync. Rejected.
- **One fixed overlay, with the list raised above it.** The overlay is `position: fixed; inset: 0` carrying `backdrop-filter: blur(4px)` and a `--scrim`-derived background. `backdrop-filter` only blurs what paints *below* it, so raising the list's wrapper into a higher stacking context leaves it sharp while everything else goes back — including content that scrolls past underneath, live. **Chosen.**

Layers, written down because they are easy to get wrong: dashboard top bar `z-30` (stays, gets blurred) · reorder overlay `z-[35]` · category list wrapper `z-[36]` · reorder bar `z-40`. The category sheet's own backdrop (`z-40`) and popup (`z-50`) only coexist with these during the crossfade in D11.

The overlay is visual only. **Inertness is separate**: each pushed-back region takes the `inert` attribute, which the template already uses for the top bar's two title states (`:224-236`). One concern, two mechanisms, because `backdrop-filter` has no semantics and `inert` has no appearance.

`filter` on an ancestor creates a containing block for `position: fixed` descendants — the reason the reorder bar is a sibling of the overlay at the page root and never inside a dimmed region.

**Values:** `blur(4px)` and a scrim that takes the pushed-back content to roughly a quarter of its resting presence. The proposal's constraint — little blur, plenty of dimming — is a statement about this background specifically: the brushed dark surface has a sheen that a heavy blur smears into grey. 4px is also far under the 20px ceiling the recipes set for Safari.

### D4 — The lane is stepped, not animated

The card narrows to open a 44px lane for its handle. Animating that means animating `width` or `margin`, which the rules forbid for good reason — both cost layout and paint on every frame, on seven cards at once.

**The width change is therefore instantaneous**, applied on the same frame the overlay begins to fade in and the cards begin to collapse. It is not an animation that was dropped; it is a step hidden inside two other transitions. The lane is `padding-inline-end` on the list wrapper, so the cards reflow once, not seven times.

The handles then arrive on their own: `opacity` 0→1 and `translateX(8px)`→0, 200ms `--ease-out`, staggered 30ms per card capped at five — the same cap the card cascade already uses (`dashboard-template.tsx:401`). Stagger is decorative, so the handles are interactive from the first frame regardless of where they are in their fade.

### D5 — The drag: pointer events, equal heights, a spring curve and no velocity handoff

**No library.** `dnd-kit` and friends bring their own keyboard model, their own announcements and ~30KB, to replace maths that this list makes trivial. `swipe-to-delete.tsx` already establishes how a gesture is written here, down to the `offsetRef`-shadows-state trick that keeps the pointer handler reading live values.

**Every card is collapsed in this mode, so every card is the same height.** That is the simplification the mode buys: the target index is `startIndex + Math.round(offsetY / rowHeight)`, clamped — no per-card measurement, no hit-testing, no re-measure as things move. `rowHeight` (card height plus the `gap-stack`) is measured once on `pointerdown`.

Mechanics, each one a rule from the reference:

- **1:1 from the grab offset.** `pointerdown` records `clientY` and the card's `getBoundingClientRect().top`; the card's transform is always `pointerY − grabOffset`. Never centred on the pointer.
- **`setPointerCapture` immediately** — no 10px intent lock, unlike the swipe. There is no competing gesture on the handle to disambiguate from, and a lock would reintroduce exactly the hesitation the "no long press" decision removes. The click-suppression half of the swipe's pattern is still needed, since the handle is a button.
- **Multi-touch guard:** `if (gestureRef.current) return` on a second `pointerdown`.
- **The held card:** `transform: translateY(Npx) scale(1.02)`, a deeper shadow, and `will-change: transform` set on `pointerdown` and removed on settle. No transition while held — the movement is the finger's.
- **The neighbours:** each displaced card gets `transform: translateY(±rowHeight)` with `transition: transform 200ms var(--ease-in-out)`. `ease-in-out` because this is movement *on screen* rather than an entrance, and a transition rather than keyframes because dragging across three cards retriggers it three times and a transition retargets from wherever it is.
- **Rubber-banding past the ends**, with the reference's function rather than a hard clamp: `overshoot · dimension · 0.55 / (dimension + 0.55 · |overshoot|)`.
- **Auto-scroll** inside a `requestAnimationFrame` loop while the pointer is within 64px of the viewport edge, ramping to ~12px per frame, with the drag origin adjusted by the scrolled amount so 1:1 survives it.
- **The settle:** on release, `transition: transform 260ms var(--ease-spring)` — the token in `globals.css:178`, which is a real spring curve and settles at 1.0 without a second overshoot.

**Velocity handoff is deliberately not implemented.** Apple's §5 seam matters when a gesture *throws* something; here the card is placed, and the gap it lands in is already open under the finger, so the settle distance is at most half a row. Faking momentum with a duration scaled by release speed would be an invented value, which the rules forbid more strongly than they require the handoff. If the settle feels dead in the hand on a real device, the honest fix is a spring runtime, not a fudge — noted in Risks.

### D6 — Touch starts at the handle; a mouse starts anywhere

`pointerdown` branches on `event.pointerType`:

- **`touch`** — the drag starts only on the handle, which carries `touch-action: none`. The card body keeps `touch-action: pan-y` so the list still scrolls, which with seven cards it must.
- **`mouse` / `pen`** — the drag starts anywhere on the card or its handle, with `cursor: grab` at rest and `grabbing` while held. A wheel scrolls independently of the button, so there is nothing to protect.

This is the Spotify queue's own resolution of the same conflict, and the request names that queue as the reference. The cost is real and stated in the spec: on a phone, the handle is the only place a drag begins, which is exactly why the handle is 44px and permanently visible rather than revealed on hover.

### D7 — The keyboard route is the handle itself

The handle is a `<button>`, not a decorative glyph beside one. That gives focus, Tab order, a focus ring and an accessible name for free.

- **Name:** "Mover Comida, posición 2 de 7" / "Move Food, position 2 of 7" — category *and* position, because with seven handles on screen a bare "Mover" is seven identical controls.
- **Keys:** `ArrowUp` / `ArrowDown` on `keydown`, with `preventDefault` so the page does not scroll under the move. No Space-to-lift / arrows / Space-to-drop model: that is a third interaction mode to teach for a feature used a few times a year, and each arrow press here already commits the same way a drop does.
- **Focus follows the card**, so repeated presses keep moving it. React re-renders the list in a new order; the handle keeps focus because it is keyed by category id.
- **Announcement** goes through the `role="status"` div already in the template. One message per move, naming the category and its new position.
- **Seven tab stops, no roving tabindex** — matching the colour picker's precedent from `add-category-sheet`, whose reasoning applies unchanged: a roving index adds keyboard code to controls that otherwise need none.

`aria-grabbed` is deprecated and is not used.

### D8 — One save in flight, and the previous order is the undo

```
committedOrder   — the last order a save succeeded for (or the order the mode was entered with)
displayedOrder   — what is on screen now; updated optimistically on every drop and key press
inFlight         — the save currently running, if any
queued           — the latest order that has not been sent yet, if a save was running
```

- A move updates `displayedOrder` at once and sends it, or queues it if a save is running. **Queued, not concurrent**: two calls resolving out of order would let an older list win, and dropping all but the latest queued order is correct because each call carries the complete state.
- On success, `committedOrder = ` the order that call carried, and the queue drains.
- **On failure, `displayedOrder` returns to `committedOrder`** — travelling back over 300ms `--ease-in-out`, because the card is moving on screen and the user needs to follow it — the queue is dropped, and a toast goes up through the existing manager at `priority: 'high'`, like `errorEliminar` does today.
- **No undo action on that toast.** Undo exists for a change the user made and regrets; this is a change that did not happen. Offering "deshacer" next to it would be offering to undo the revert.
- A save that fails after "Listo" still reverts and still reports, because the toast provider and the data both outlive the mode.

Handles and "Listo" are **never disabled while a save runs**. The whole point of saving on drop is that the mode never blocks; a spinner on a handle would put the user back in the "is it saved?" state that saving-on-drop exists to avoid.

### D9 — Demo derivation: order is the fourth step

`DemoCategoryEdits` gains `order: string[] | null`, and `createDemoCategoryMutations` gains a `reorder` that replaces it. `deriveDemoData` applies it **after deletions and before totals**:

1. expense edits
2. category updates
3. category deletions
4. **order** — survivors sorted by their index in `order`; any id not in `order` keeps its relative position after the ones that are
5. per-group total and `getBudgetStatus`
6. expenses total, history, free margin

Step 4 sits after 3 so a stored order that names a deleted category simply has no effect, and before 5 so nothing numeric can depend on position — which is the invariant the spec asserts and step ordering is the cheapest way to guarantee.

Base data is never mutated: `order` is a list of ids in the log, and derivation sorts a copy. Reloading discards it, as it discards every other demo edit.

### D10 — Messages

New `hojaCategoria.reordenar`. A new `modoReordenar` namespace for the mode itself:

| key | es | en |
| --- | --- | --- |
| `titulo` | Reordenar categorías | Reorder categories |
| `listo` | Listo | Done |
| `mover` | Mover {categoria}, posición {posicion} de {total} | Move {categoria}, position {posicion} of {total} |
| `movido` | {categoria}, posición {posicion} de {total} | {categoria}, position {posicion} of {total} |
| `instrucciones` | Usa las flechas para mover la categoría | Use the arrow keys to move the category |
| `errorGuardarOrden` | No se pudo guardar el orden | The order could not be saved |

### D11 — Entering: the two scrims crossfade

*Reordenar* closes the sheet and turns the mode on **in the same tick**. The sheet's exit (its popup translating away, its backdrop fading) then overlaps the reorder overlay fading in — and because both are dark scrims over the same page, the overlap reads as one continuous dimming rather than two events. Waiting for the sheet's exit to finish would put a 300–500ms dead beat between a tap and any response, which is the one thing §1 of the Apple reference will not allow.

The overlay fades over 240ms `--ease-out`; leaving fades it out the same way. Entering and leaving are the same path in reverse, per the spatial-consistency rule.

### D12 — Reduced motion and reduced transparency

- **`prefers-reduced-motion: reduce`** — no lift scale, no neighbour transitions, no settle transition, no revert travel, no handle stagger; positions change between frames. The overlay still appears, because an opacity change is not vestibular movement and it is the only thing telling the user the rest of the screen is off. **The held card still tracks the pointer** — that movement is the user's own, and freezing it would break the gesture rather than calm it.
- **`prefers-reduced-transparency: reduce`** — the overlay drops `backdrop-filter` entirely and raises its scrim opacity, so the separation is never carried by blur alone.

Both are written in the same rule block as the animation, not added afterwards.

### D13 — `DESIGN.md` and `ARCHITECTURE.md`

`DESIGN.md` gains a **Reorder Mode** component entry: the handle's anatomy (three 2px lines in a 44 × 44 target, in the lane over the card's trailing edge, never inside it), the pushed-back layer's recipe (4px blur, the scrim value, the reduced-transparency variant), the lift treatment (scale and shadow), and the mode's colour rule (brand only on "Listo" and focus rings; no warning, no destructive). The *Bottom Sheets & Modals* entry's field order is corrected to name, budget, colour.

`ARCHITECTURE.md` §9 *Modo reordenar* gets an implementation note in the style of the two `add-category-sheet` left: categories only, entered from a menu row rather than a long press, dragged with no press-and-hold, handle outside the card, saved on drop.

## Risks / Trade-offs

**The settle may feel dead without velocity handoff** → D5 argues the throw does not exist in this gesture, but that is an argument from the code and the feel can only be judged in the hand. Mitigation: the settle is one `transition` line; if a real device says otherwise, the fallback is a spring runtime for that single property, and no requirement in the spec changes either way. Feel-check it at 3× duration and then on a phone before calling the mode done.

**`backdrop-filter` over a tall scrolled page is the most expensive thing on this screen** → One layer at 4px is cheap; Safari's cost curve rises sharply with radius and with the number of blurred layers, both of which D3 holds at one. Mitigation: a scroll-while-dragging frame-rate check on a real iPhone is an explicit task, and the escape hatch is dropping to a plain scrim with no blur, which the reduced-transparency variant already implements and which changes no requirement except the blur value.

**Equal-height cards are load-bearing** → The index maths in D5 is only correct while every card in the mode is collapsed to the same height. A future addition — a subtitle on the card in reorder mode, a second level for expenses — silently breaks it into off-by-one drops. Mitigation: a comment at the measurement naming the assumption, and a spec scenario that drags across two cards and asserts the exact resulting order, which fails loudly if heights diverge.

**Touch drags only start at the handle** → A user who tries to drag the card body on a phone gets a scroll and may conclude the card is stuck. Mitigation: the handle is permanently visible, 44px, and the only thing in its lane; the mode's whole appearance exists to point at it. If it is still missed in real use, the fallback is an intent lock on the card body — a horizontal-vs-vertical decision like the swipe's, at the cost of the hesitation D5 removed.

**The mode is a second screen state on a page that already has several** → Sheets, toasts, the account menu and now a mode. Mitigation: reorder mode closes the sheet and is closed by Escape, so at most one of them is ever on; the layer table in D3 is the single place their stacking is written down.

**The revert animates a card the user may have stopped watching** → If a save fails slowly, the card travels back seconds after the drop, possibly after "Listo". Accepted, and the toast is what carries the message; a silent revert would be worse, and blocking the mode until each save resolves would be worse still.

## Migration Plan

No database migration, no deploy step, nothing written outside the page's memory. `categorias.orden` has existed since `0004_categorias.sql` and this change is the first reader of it — in a spec, not yet in SQL.

The only breaking surface is internal: `CategoryMutations` gains a third method, so every implementation must supply it. There are two — the demo's and the recording one in the specs' scenarios — and `categories` on `DashboardActions` stays optional, so an unchanged mount still compiles and renders the row disabled.

Implementation order, each step verifiable on its own:

1. `reorder` on `CategoryMutations`, and the demo's `order` log + derivation step — verified numerically before any UI exists, the way `add-category-sheet` task 4.2 was.
2. The sheet's field reorder and the *Reordenar* row, wired to a flag that renders nothing yet.
3. The mode's appearance: overlay, layers, inertness, collapsed cards, the lane, the reorder bar, "Listo" and Escape.
4. The handle, and the keyboard route — before the drag, so the feature is complete without a pointer at any point after this step.
5. The drag, in this order: 1:1 tracking → neighbour displacement → drop and index maths → rubber-band → auto-scroll → settle.
6. Save-on-drop, the queue, the revert and the toast.
7. Reduced motion, reduced transparency, hover gating and the desktop pass.
8. Messages, `DESIGN.md`, `ARCHITECTURE.md`, Playwright coverage.

Rollback at any point is a revert: no data is written and no schema moves.

## Open Questions

- **Should the mode also be reachable from the expenses section title, without going through a category's sheet?** Deferrable: the sheet route ships either way and a second entry point adds no requirement. Worth asking after real use whether anyone finds "Reordenar" where it lives now.
- **Should a new category be appended last or inserted first?** It cannot arise yet — category creation does not exist — and it belongs with the "Añadir categoría" proposal, which is where it will have to be decided.
