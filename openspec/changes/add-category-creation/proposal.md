## Why

The dashboard can rename, recolour, rebudget, reorder and delete a category, but it cannot create one. The seven demo categories are hardcoded in `lib/demo/demo-data.ts`, so the only way to get an eighth is to edit the source. ARCHITECTURE.md §9 already settles where the affordance lives — a dashed "Añadir categoría" tile at the end of the list, "hueco a llenar, no categoría" — and that slot is simply missing from the screen.

It matters now because the next milestone is the real data layer: `CategoryMutations` is about to get a Supabase implementation, and shipping that contract without `create` would mean a second pass over every implementation later. Creating categories is also the first thing a new user does, so it blocks onboarding.

## What Changes

**The tile**
- A dashed "Añadir categoría" tile is added after the last category card, inside the same list container the cards live in. It reads as an empty slot: no colour dot, no total, no chevron, no solid surface — the brushed-metal background shows through a thin dashed muted-grey border, fully rounded, visibly shorter than a real card, with a `+` and the label centred.
- It is legible at rest in both themes at mobile width, where there is no hover. It uses existing tokens only, and never the brand lime (reserved for the hero number, the active month and progress bars), so it is deliberately **not** an *Add action row* (`dashboard-ui`) — those rows are lime-labelled and live inside an expanded card.
- It is absent while reorder mode is on, and disabled when the mounting page supplies no category `create`.

**Interaction and motion**
- Hover (fine pointers only): the border gains contrast, a faint surface fades in and the `+` rotates 90°, ~200ms.
- Press: scales to ~0.98 and springs back.
- Activating it opens the existing `category-sheet` in a new **create** mode: empty name field focused with the virtual keyboard up, the same colour picker the edit sheet shows today with the first colour no existing category uses preselected, the budget field empty and optional. The delete, reorder and progress rows are not part of create mode.
- On confirm, the dashed tile morphs in place into the new category card — border goes solid, the surface fills in, the dot and name appear — and a fresh dashed tile slides in below it. GSAP FLIP keeps the surrounding list moving smoothly rather than jumping.
- Every part of the above collapses to an instant state change when the user prefers reduced motion.

**Validation**
- The primary action stays disabled while the name is empty or whitespace, and while the budget holds an invalid amount.
- A duplicate name — case-insensitive, trimmed, against every existing category — reports inline next to the field, not as a toast, keeping what was typed.

**Data**
- `CategoryMutations` gains `create(draft): Promise<string>`, resolving with the new category's id so the caller can animate the right card. It is implemented in `lib/demo/demo-categories.ts` and derived in `lib/demo/demo-expenses.ts`. The new category is collapsed, total 0, no expenses, `orden` = last + 1.
- No component queries data on its own; the tile and the sheet receive everything through the existing injected contracts.

**Strings**
- New keys in `messages/es.json` and `messages/en.json`.

### One spec correction, no code change

`category-editing` says the picker offers **eight** colours and that red is never offered. The shipped `ColorSwatchPicker` has offered **fifteen** since it was built, `rojo` among them, and `--cat-rojo` is a distinct token from the `--destructive` the budget state uses, so that signal still reads. The delta drops the stale count and restates the exclusion in terms of the reserved *tokens* (brand lime, warning, destructive) rather than the word "red". This is the spec catching up to the code — no picker, palette or category changes — and it is needed here because create mode's preselected colour is defined against that same palette.

## Capabilities

### New Capabilities
- `category-creation`: the "Añadir categoría" tile, its appearance and motion, the category sheet's create mode, and the injected `create` operation.

### Modified Capabilities
- `category-editing`: *Category sheet layout*, *Category fields and validation* and *Saving, dismissal and errors* are today written as if the sheet always opens on an existing category. They are scoped to the edit mode, so create mode's different body, title, primary action and preloaded values do not contradict them.
- `category-reordering`: *What reorder mode shows* enumerates what the screen holds while the mode is on; it gains the tile's absence.
- `dashboard-ui`: *Controls without a handler are disabled* gains the tile for the case where the mounting page supplies no category operations.

## Impact

**Code**
- `lib/data/categories.ts` — `create` added to `CategoryMutations`; `CategoryDraft` reused as-is.
- `lib/demo/demo-categories.ts` — `create` implemented, `DemoCategoryEdits` gains created rows.
- `lib/demo/demo-expenses.ts` — `deriveDemoData` appends created categories after the survivors and before the stored-order sort.
- `components/organisms/category-sheet.tsx` — a `mode: 'create' | 'edit'` prop; create hides the delete, reorder and progress rows, swaps the primary action's label and starts from an empty draft.
- `components/molecules/color-swatch-picker.tsx` — its palette order becomes importable so the preselected colour can be derived; no visual change.
- `components/templates/dashboard-template.tsx` — renders the tile at the end of `categoryListRef`'s list, owns the create sheet state and the FLIP transition.
- A new `components/molecules/add-category-tile.tsx`.
- `messages/es.json`, `messages/en.json`.

**Dependencies** — none new. `gsap` 3.15 is already a dependency and ships `Flip`.

**Not affected** — no migration; `categorias` already has every column this needs. Real Supabase persistence and creating a category from the WhatsApp bot are out of scope.

**Tests** — new Playwright specs on `/demo`: create a category, empty-name validation, duplicate-name validation, the tile hidden in reorder mode, and the new card appearing collapsed at the end of the list.
