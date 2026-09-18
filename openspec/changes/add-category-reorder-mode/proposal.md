## Why

The dashboard renders categories in whatever order the data source hands them (`data.expenses.groups`, straight through `dashboard-template.tsx:394`). On `/demo` that is the literal array in `demo-data.ts`; on the real route it will be whatever Postgres returns. `categorias.orden` has existed since `0004_categorias.sql` and nothing reads or writes it.

The category card is the unit of the screen (ARCHITECTURE.md §9). With seven or more of them, the order *is* the information architecture: which card the thumb reaches first, which one is visible without scrolling. That is a per-user judgement the app currently makes for the user and gives them no way to change.

ARCHITECTURE.md already specifies the interaction ("Modo reordenar", §9) and files it under phase 3. `add-category-sheet` shipped the menu it is entered from and explicitly deferred the *Reordenar* entry. This change fills that hole — and only that hole.

## What Changes

### A) A reorder entry in the category sheet, and a revised field order

The sheet becomes: **Nombre · Presupuesto · Color · *(divisor)* · Reordenar · *(divisor)* · Eliminar categoría**.

- **Presupuesto moves above Color.** Name and budget are the two fields anyone opens this sheet to change; colour is the decorative one. Today it sits between them (`category-sheet.tsx:255-280`).
- **Reordenar is not a fourth field.** The first three are form fields saved by the one `Guardar` button. *Reordenar* changes the mode of the whole screen and saves nothing of this category — so it sits alone between two dividers, exactly as the destructive row already does.
- Activating it **closes the sheet and enters reorder mode**. Unsaved edits in the three fields are discarded, which is what the existing dirty-state guard already does for `Cancelar`.
- It is **disabled when the page supplies no reorder operation, and when there are fewer than two categories** (*Controls without a handler are disabled*).

### B) Reorder mode: a mode, not a screen

- **Everything but the category list is pushed back** — the top bar, the month title, the notice, the free-margin card, the summary group, the `upcoming-charges` card and both charts take a light blur and a firm opacity drop, and become inert. **Little blur, plenty of dimming:** the brushed-metal background already carries a sheen and a heavy blur muddies it.
- **The list narrows** to leave a lane for the handle, and every card **collapses and hides its amount, its budget bar and its remaining text. It keeps its colour dot and its name.** Card disclosure state is remembered and restored on exit.
- **The drag handle sits outside the card, over its right edge** — the Spotify-queue placement. Three horizontal lines. Nothing inside the card is replaced or displaced by it; the card gives up the width instead.
- **A fixed reorder bar takes the top-bar slot**, sharp and above the dimmed layer, holding the mode's title and a **Listo** button. The dashboard's own top bar is dimmed underneath it and cannot be reached.
- Inside the mode, every other card interaction is off: the disclosure, the options control, the add row, row editing and swipe-to-delete are all inert.

### C) Direct drag, no long press

- **Grab and move, with no press-and-hold**, because the mode is already on and the gesture has nothing left to disambiguate itself from.
- The card tracks the pointer 1:1 from **where it was grabbed**, its neighbours slide out of the way, and the lifted card gains a deeper shadow and a slightly larger scale.
- **On touch the drag starts from the handle; on a mouse, from anywhere on the card.** *Recorded deviation from the request, which asks for finger-drag anywhere on the card:* with seven cards the list is taller than a phone screen, and a finger-drag that starts anywhere leaves no gesture to scroll with. Spotify's queue — the pattern this change is asked to follow — resolves it the same way.
- Auto-scroll when the dragged card approaches the top or bottom of the viewport, rubber-band resistance past the ends of the list, and a spring settle that inherits the release velocity.
- **No haptics.** The Vibration API does not exist in Safari on iOS, so every signal in this mode is visual.

### D) A keyboard route, because a gesture is never the only route

The handle is a **focusable button**; with focus on it, **↑ and ↓ move the card one position** and save exactly as a drop does. Each move is announced in a live region ("Comida, posición 3 de 7"). This is the same rule `add-category-sheet` set when it refused to ship the long press as the sole route to the category menu.

### E) The order is saved on drop, not on Listo

- **Listo only leaves the mode.** It confirms nothing, because there is nothing left to confirm.
- Each drop (and each keyboard move) sends the **whole ordered list of category ids** through a new injected operation. Sending positions rather than a delta makes the call idempotent and keeps a failed one from leaving a half-order behind.
- **On failure the card returns to where it came from and a message says so.** The revert is animated, not instant, so the eye follows the card back rather than finding it somewhere new.

### F) Data contract and persistence

- **`CategoryMutations` gains `reorder(categoryIds: string[])`**, alongside `update` and `delete`, with the same guarantees: it resolves once durable and rejects with nothing changed.
- **The order is part of the data, not of the view.** Every data source SHALL return categories in their stored order, and the dashboard SHALL render `data.expenses.groups` in the order received — which is what it already does. The requirement is written now so the Supabase query cannot be built without it.
- **In-memory implementation for `/demo`** following `createDemoCategoryMutations` + `DemoCategoryEdits`: the order joins the edit log, `deriveDemoData` applies it on read, and nothing mutates base data.
- **No Supabase in this change.** `lib/data/` still has no category query at all (the only mention of `categorias` in `lib/` is a comment). The `orden` column and this requirement are the handshake for when that query is written.

### G) Copy, tokens, docs

- New keys in the **`hojaCategoria`** and a new **`modoReordenar`** namespace, in `messages/es.json` and `messages/en.json`. No literal strings in components.
- **One new CSS utility** for the pushed-back layer (blur radius, dim opacity, and its reduced-transparency variant). Every other token this needs — `--ease-out`, `--ease-spring`, `--ease-drawer`, `--scrim`, `pressable`, `min-h-target`, `px-inset` — already exists.
- `DESIGN.md` gains a *Reorder Mode* component entry (handle anatomy, the dim/blur recipe, lift treatment) and the revised sheet field order.
- `ARCHITECTURE.md` §9 *Modo reordenar* gains an implementation note like the two `add-category-sheet` left: the mode covers **categories only**, is entered from a menu row rather than a long press, and drags without a preceding press-and-hold.

**Out of scope:**

- **Reordering expenses inside a card.** Rows stay in their current order. ARCHITECTURE.md §9 puts both levels in one mode; this change ships the outer level only, and the mode is built so the inner one can be added without redesigning it.
- Moving an expense between categories — that is the row menu.
- Creating categories, and the "Añadir categoría" card.
- Any Supabase query or write, and the real dashboard route.
- Reordering income sources, savings movements or `gastos_fijos`.
- Any change to totals, budgets, the free margin, the pie chart or the expenses summary rows — the summary rows stay sorted by amount, descending (`dashboard-template.tsx:201-204`), which is a different question from card order and is not touched.

## Capabilities

### New Capabilities

- `category-reordering`: the reorder entry point, the mode's visual and interaction contract (what dims, what collapses, where the handle sits), direct drag and its keyboard equivalent, saving on drop, reverting on failure, and the injected reorder operation with the stored-order requirement that binds every data source.

### Modified Capabilities

- `category-editing`:
  - *The category sheet* — field order becomes name, budget, colour; the sheet gains a *Reordenar* row between two dividers, above the destructive row, which closes the sheet and enters the mode.
- `dashboard-ui`:
  - *Expense card states* — a card's appearance and its inert controls while reorder mode is on.
  - *Public demo route* — reordering works in memory, survives a language switch, and moves no figure on the page.
- `design-system`:
  - *Translucent materials* — the pushed-back layer joins the allowlist, as the one case where financial content is blurred, and only while the mode is on.
  - *Motion respects user preference* — now covers the lift, the displacement of neighbours and the revert.

> `openspec/specs/` is still empty because no change has been archived. `category-editing` is defined by `add-category-sheet` and `replace-fixed-card-with-upcoming-charges`; `dashboard-ui` and `design-system` by those two plus `land-finance-dashboard`, `restyle-dashboard-to-v0`, `refine-mobile-ui-apple-hig`, `unify-add-action-rows` and `add-expense-sheet`. Archive this change after all of them.

## Impact

- **Data contract:** `reorder` on `CategoryMutations` in `lib/data/categories.ts`.
- **Components:** a new reorder-mode organism owning the drag, a handle atom, changes to `components/organisms/category-card.tsx` (collapsed reorder appearance, inert controls), `components/organisms/category-sheet.tsx` (field order and the new row) and `components/templates/dashboard-template.tsx` (mode state, the dimmed layer, the reorder bar, the error toast).
- **Demo:** `lib/demo/demo-categories.ts` (an `order` entry in the edit log) and `lib/demo/demo-expenses.ts` (`deriveDemoData` applies it).
- **Messages and docs:** `messages/es.json`, `messages/en.json`, `DESIGN.md`, `ARCHITECTURE.md` §9.
- **CSS:** one utility in `app/globals.css` for the pushed-back layer.
- **Dependencies:** none new. The drag is Pointer Events plus transforms, the same tools `swipe-to-delete.tsx` already uses; no drag-and-drop library and no motion library.
- **Database:** no migration. `categorias.orden` is `integer not null default 0` since `0004_categorias.sql`.
- **Tests:** Playwright coverage on `/demo` for entering the mode, a drag, a keyboard move, a failed save and the reduced-motion variant.
