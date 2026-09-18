## Context

See proposal.md → *Why*. What follows is only the state of the code and the documents that shapes the approach.

### Current code

- **`components/organisms/category-card.tsx:46-67`** — the header is a single `<button>` wrapping the colour dot, the name, the amount (or "spent of budget") and the chevron. It carries `aria-expanded` / `aria-controls`; the open-card border colour lives on the card wrapper (`:42-45`), not on the button.
- **`components/organisms/entry-sheet.tsx`** — the sheet shell this change reuses: `Drawer.Root` with `swipeDirection="down"` and a dirty-state guard in `onOpenChange` (`:294-308`), `Drawer.Portal keepMounted` + `VirtualKeyboardProvider`, a `Backdrop` driven by `--drawer-swipe-progress`, and a `liquid-glass rounded-sheet` `Popup` with `initialFocus` / `finalFocus` (`:314-328`). Its header is a three-column grid of `Cancel` / title + `Drawer.Description` caption / trailing pill (`:331-371`). Its amount input (`:206-240`) resolves the currency symbol and its side through `Intl.NumberFormat.formatToParts`.
- **`EntryConfig<V>`** hardcodes `HojaGastoKey` as the message-key type (`:13-29`) and `primaryDisabled` requires a valid amount whenever a field of kind `amount` exists (`:149`). Both assumptions break for an *optional* budget.
- **`components/organisms/account-menu.tsx:74-83, 146-161`** — the one existing dual presentation: a `useLayoutEffect` measures the opener via `[aria-controls="account-menu"]` and writes `--anchor-top` / `--anchor-right`, which `sm:` classes consume to turn a bottom sheet into a popover anchored top-right.
- **`lib/demo/demo-expenses.ts`** — the edit-log pattern to follow: `DemoExpenseEdits` is a log, `deriveDemoData` is pure and recomputes rows, totals, `getBudgetStatus`, history and the free margin on every read, and `createDemoExpenseMutations` only appends to the log.
- **`lib/data/budget.ts`** — `getBudgetStatus` takes `amount` and `spent` and returns usage, level, remaining and `weeklyAllowance`. Nothing in it changes.

### Database

`categorias` already has `nombre`, `color` (a `check` over the eight names) and `unique (usuario_id, nombre)`. `presupuestos` has one row per category per period with `monto > 0` and `categoria_id ... on delete cascade`. `transacciones.categoria_id` is `NOT NULL`, so a delete must reassign rather than orphan. No migration.

### Conflicts recorded

Three places where this change knowingly departs from a written decision. Each is resolved here and written back into the document in tasks.

1. **§9 opens the category menu with a long press.** It also names a three-dot control in the header as plan B and calls the discoverability of the long press a *"riesgo asumido"*. This change ships plan B as the only route (D2) and implements no gesture.
2. **§9's category menu is a list of actions** (*Cambiar color · Renombrar · Reordenar · divisor · Eliminar*). This change ships one form (D3). Three of those four entries are a single field each, and §9 already concedes the colour list has to render *"en la misma hoja, no en una segunda"* — which is a form, not a menu.
3. **ARCHITECTURE.md states the free margin as `ingresos − fijos − presupuestos` in five places**, and the code has always computed `income − savings − spent` (`lib/demo/demo-expenses.ts:47`). The code is right and stays; the prose is aligned (D11). This is the decision the earlier draft of this change got backwards, and no behaviour changes with it.

## Goals / Non-Goals

**Goals:**

- One surface that edits a category's name, colour and budget and can also delete it, without ever stacking a second surface on top.
- A category contract that mirrors `ExpenseMutations` closely enough that the Supabase implementation is a drop-in later.
- Sheet chrome that is shared with the entry sheet rather than copied, because the design-system spec now asserts both sheets behave identically.
- A demo derivation that stays pure and recomputes everything, so the free-margin invariant is provable rather than asserted.

**Non-Goals:**

- Any change to `getBudgetStatus`, the free-margin card, or the free-margin formula.
- A general-purpose form abstraction. `EntryConfig` stays as it is; this is a sibling, not a generalisation.
- Desktop layout work beyond anchoring the surface to its opener.
- Creating categories, reordering them, or moving a single expense between them.

## Decisions

### D1 — Two operations, one `update`

```ts
// lib/data/categories.ts
export type CategoryDraft = {
  name: string              // trimmed, non-empty
  color: CategoryColor
  budget: number | null     // > 0 with at most two decimals, or null for no budget
}

export type CategoryMutations = {
  update(categoryId: string, draft: CategoryDraft): Promise<void>
  delete(categoryId: string, reassignTo: string | null): Promise<void>
}

/** `update` rejects with an Error carrying this message when the name is taken. */
export const DUPLICATE_CATEGORY_NAME = 'duplicate-category-name'
```

**Why one `update` and not `rename` / `recolour` / `setBudget`:** the sheet is one form with one Save. Three operations behind one button would need a partial-failure rule ("the rename landed, the budget did not") and a way to show it, for no gain — the Supabase implementation writes `categorias` and `presupuestos` in one call either way, and the two writes belong in one transaction.

**`budget: null` carries the removal**, so there is no `removeBudget`. This is what makes "clear the field" the only way to remove a budget, which is the behaviour the spec requires.

**Why a sentinel message and not a result union:** `ExpenseMutations` signals failure by rejecting, and the spec requires a duplicate name to be distinguishable from a generic failure. Returning `{ ok: false, reason }` from `update` alone would make the two contracts inconsistent for the sake of one case. A sentinel keeps the mirror and costs one string comparison in the sheet.

`reassignTo` is `null` only when the category has no expenses in any cycle; the sheet passes a category id in every other case.

### D2 — Header split: a stretched disclosure with the options control above it

The header must keep the visual order *dot · name · amount · options · chevron* (§9 plan B puts the control *"entre el total y el chevron"*), keep the chevron tied to the control whose state it reports, and nest nothing.

Three ways to get there:

| | Approach | Why not |
|---|---|---|
| A | Disclosure keeps dot+name+amount+chevron; options control placed after the chevron | Loses the stated position; the control lands outside the card's visual rhythm |
| B | Chevron leaves the button as a decorative sibling; order becomes `[disclosure][options][chevron]` | The chevron becomes a dead zone at the very edge the thumb aims for |
| **C** | **Disclosure is absolutely positioned across the header; content renders above it; the options button sits on top with a higher stacking order** | **Chosen** |

C keeps the exact order, keeps the chevron reporting the disclosure it belongs to, and produces two DOM siblings with no nesting.

What it costs, and how each cost is paid:

- **The disclosure has no text inside it**, so its accessible name must be supplied: `aria-labelledby={`${nameId} ${amountId}`}` gives "Comida 310 de 400". `aria-expanded` / `aria-controls` stay on it unchanged.
- **The hit areas overlap geometrically.** The options button is on top and takes the pointer, so the disclosure's *effective* area is the header minus a 44px square — still far above the minimum. This is why the spec asserts "a press at the centre of the options control leaves the expanded state unchanged" rather than a non-overlap of bounding boxes.
- **`pressable`'s scale would be invisible** on a transparent stretched button. Set `--press-scale: 1` on it and let the background tint carry the pressed state; `refine-mobile-ui-apple-hig` accepts "scale **or** background differs from its resting state". The tint paints between the card surface and the content, so it reads correctly.
- **The focus ring** traces the whole header, which is the correct target shape.

The open-card border colour is untouched: it already lives on the card wrapper and keys off `group.color`, so a recolour moves it for free.

### D3 — A shared sheet shell, not a second `EntryConfig` and not a copy

`CategorySheet` is a sibling component. It does **not** go through `EntryConfig`, for the reasons in Context: the config's message-key type is `hojaGasto`-only and its submit gate requires a valid amount, which an optional budget is not.

That leaves two ways to get the chrome, and copying it loses:

- The chrome is ~40 lines of subtle `Drawer` wiring — swipe-progress variables, `data-starting-style` / `data-ending-style` transforms, the swipe-strength exit duration, the dirty-state guard. Copied, it drifts.
- The design-system delta now asserts the two sheets share material, motion and focus behaviour. A spec that demands identical behaviour from two copies is a defect waiting to be written.

So: extract `components/organisms/sheet-shell.tsx` holding `Drawer.Root` → `Portal` → `VirtualKeyboardProvider` → `Backdrop` → `Viewport` → `Popup`, the drag handle, and the three-column header with slots for the leading action, title, caption and trailing action. It owns the dirty-state guard and the `busy` lock; each sheet owns its own fields, validation and state.

`EntrySheet` is refactored onto the shell in this change. Shipping the shell while leaving the entry sheet on its own copy is the one outcome worse than either option. See Risks.

Also extracted, for the same reason: `components/molecules/amount-field.tsx`, the currency-symbol-and-side input the budget field reuses verbatim.

### D4 — Desktop anchoring follows `account-menu`, not a second component tree

The sheet stays one `Drawer` at every width. Above `sm`, the `Popup` is restyled to a panel anchored to its opener, using the measured `--anchor-top` / `--anchor-right` variables exactly as `account-menu.tsx:74-83` already does.

Rejected: rendering `Popover` on desktop and `Drawer` on mobile. It duplicates the entire subtree and the sheet's state, and forces a media query to decide which one holds the truth during a resize.

`swipeDirection` is set to `undefined` above `sm`, so the swipe-to-dismiss transform cannot fight the anchored position on a touch-capable laptop.

### D5 — The delete confirmation is a step, not a surface

The sheet holds `step: 'form' | 'confirmDelete'`. Both steps render inside the same `Popup`:

- The form's fields are replaced by the confirmation's text and, when needed, the receiving-category picker.
- The header's trailing pill becomes the confirmation's cancel-side affordance; the destructive action renders in the body, in `destructive-ink`, never as the header's primary pill.
- Cancel returns to `'form'`. Field state lives in the sheet, above `step`, so nothing typed is lost.
- Focus moves to the confirmation's heading on entry and back to "Eliminar categoría" on cancel.

This is what satisfies "no modal over modal" while still confirming something irreversible.

The expense count in the confirmation is the count in the **displayed cycle**, which is what the card can show; the copy says so, because `delete` moves expenses in every cycle.

### D6 — Colour picker anatomy

A `role="radiogroup"` wrapping eight `role="radio"` buttons with `aria-checked`, each individually tabbable — the same shape `account-menu.tsx:193-223` already uses for the theme control. Roving tabindex is not worth the divergence for eight controls.

Each swatch: a 44px button (`size-11`, `grid place-items-center`) holding a 28px token (`--cat-<name>`), with `ring-1` in a hairline colour on every swatch so `blanco` and `gris_oscuro` separate from the glass in both themes.

**The checkmark does not sit on the token.** A check drawn over eight different fills cannot hold contrast on all of them — white disappears on `blanco`, dark disappears on `granate`. Instead the selected swatch gets the 2px active ring plus a small check badge overlapping its bottom-right corner, filled with the sheet's own background and the check in `foreground`. That reads identically on all eight because it is drawn against the sheet, not against the colour.

Accessible names are the colour names from `hojaCategoria`, never the hex.

### D7 — Demo derivation order

`deriveDemoData(base, expenseEdits, categoryEdits)` stays pure and runs in this order. The order is the whole design; getting it wrong is how the free-margin invariant breaks.

1. **Expense edits** — created, updated and deleted rows resolve per group (unchanged from today).
2. **Category updates** — override each group's `name`, `color`, and its budget amount (or drop the budget when `budget` is `null`).
3. **Category deletions** — append the deleted group's resolved rows to the receiving group and remove the group.
4. **Recompute per group** — total from the resolved rows, then `getBudgetStatus` from that total and the possibly-new budget amount.
5. **Recompute the page** — expenses total, the current history entry, and `freeMargin = income − total − savings`.

Because step 5 sums rows and never reads a budget, steps 2 and 3 cannot move the free margin: a budget change touches only step 4, and a deletion moves rows between groups without changing their sum. That is the invariant, and it is structural rather than asserted.

```ts
export type DemoCategoryEdits = {
  updated: Record<string, CategoryDraft>
  deleted: { id: string; reassignTo: string | null }[]
}
```

A renamed category survives a language switch for the same reason a typed description does: `buildDemoData(locale)` rebuilds the base in the new language and the edit log's `name` overrides it. Categories never renamed keep following the locale.

The demo's duplicate check compares the draft name against the other groups' currently derived names, exact match, mirroring the DB's case-sensitive `unique` constraint rather than being friendlier than production.

### D8 — Messages

One new `hojaCategoria` namespace, mirrored in both files (`messages/parity.ts` fails the build otherwise). It carries the sheet chrome, the field labels, the validation and error strings, the delete confirmation, and the eight colour names — which become user-facing labels here for the first time.

The options control's label is a parameterised string (`"Opciones de {categoria}"` / `"{categoria} options"`), which is what keeps seven of them distinguishable.

### D9 — Tokens

None added. The sheet uses `liquid-glass`, `rounded-sheet`, `bg-handle`, `px-inset`, `min-h-row`, `min-h-target`, `pressable`, `ease-spring` and `destructive-ink`; the swatches use the existing `--cat-*` variables. If a value seems to be missing, it is a sign of diverging from the entry sheet rather than of a gap in the palette.

### D10 — `DESIGN.md`

Two edits only, both anatomy the inventory does not yet cover:

- **Controls & Interactive Badges → Color Swatch Pickers** gains the 44px hit area, the hairline ring on every swatch, and the corner check badge with the reason it is not drawn on the token.
- A new **Header Options Control** entry under Components: 20px glyph, 44 × 44 area, `muted-foreground`, its position between amount and chevron, and the rule that its accessible name carries the category.

The Materials section already covers the sheet; only the spec's allowlist needed the category sheet added.

### D11 — `ARCHITECTURE.md` alignment

Five passages state the free margin as a formula the code does not use. Each is corrected to `ingresos − ahorro − gastos` with a sentence saying budgets do not reserve:

| Line | Today | Becomes |
|---|---|---|
| 509 | §9 item 2: `ingresos − fijos − presupuestos` | `ingresos − ahorro − gastos`, budgets noted as tracking only |
| 728 | *Cabecera del mes* table: `ingresos − ahorro − fijos − presupuestos_restantes` | `ingresos − ahorro − gastos` (fijos are already gastos) |
| 815 | "el sobrante después de ingresos, ahorro, fijos y presupuestos" | drops "y presupuestos" |
| 852 | "el **margen real** del mes es: `ingresos − fijos − presupuestos`" | `ingresos − ahorro − gastos` |
| 860-866 | Worked example subtracting "Presupuestos 520" | Recast to subtract actual spending |

The §9 long-press decision and the §9 menu contents are also annotated with the deviations recorded in Context. No other passage changes, and no behaviour changes with any of them.

## Risks / Trade-offs

**Refactoring the shipped entry sheet onto the shared shell** → `add-expense-sheet` is 31/32 tasks and verified. The refactor is mechanical (move markup, keep props), but it touches working code. Mitigation: the shell lands before the category sheet, and the entry sheet's own scenarios — floating geometry, header order, pending save, focus return, reduced motion — are re-run immediately after, before any category work starts. If they do not pass, the shell is wrong and the category sheet has not been built on it yet.

**The stretched disclosure is an unusual pattern** → A reader of `category-card.tsx` may not expect an absolutely positioned button under the content, and a later edit could reorder the stacking and swallow the options control. Mitigation: a comment at the split naming the constraint (no nested interactives, §9's required order), and a spec scenario that fails loudly if a press on the options control starts toggling the card.

**`Drawer` restyled as an anchored desktop popover** → Base UI's drawer assumes a bottom-anchored, swipeable popup; the `sm:` override fights that assumption. Mitigation: `swipeDirection` is dropped above `sm`, and the desktop pass is an explicit verification task. Fallback if it misbehaves: ship the bottom sheet at all widths and move anchoring to its own change — the spec's anchoring requirement is the only thing that would need revisiting.

**Eight tab stops in the colour picker** → Tabbing through the sheet is longer than it would be with a roving tabindex. Accepted: it matches the existing theme control, and the alternative adds keyboard-handling code to a control that has none today.

**The demo's derivation order is load-bearing** → Steps 2 and 3 running in the wrong order (deleting before applying a rename, say) would produce subtly wrong labels. Mitigation: `deriveDemoData` stays pure and is exercised by a scratchpad `tsx` script asserting the exact figures in the spec's scenarios, the way `add-expense-sheet` task 3.1 did.

**A category deleted onto another can push the receiver over budget** → This is correct behaviour, not a bug, and the spec pins it (compras 190 € of 180 €). Named here only so it is not "fixed" later.

## Migration Plan

No database migration and no deploy step. The only breaking surface is internal:

- `DashboardActions` gains an optional `categories`, so existing mounts keep compiling and render the control disabled.
- `deriveDemoData` gains a third parameter; its two callers are `buildDemoData` and `DemoDashboard`.

Implementation order, each step verifiable on its own:

1. `lib/data/categories.ts` and the `DashboardActions` field — nothing renders yet.
2. `sheet-shell.tsx` + `amount-field.tsx`, with `EntrySheet` moved onto them and its scenarios re-run.
3. The demo edit log and the derivation order, verified numerically before any UI exists.
4. The header split, with the control opening nothing.
5. `CategorySheet`: form, then colour picker, then delete confirmation.
6. Messages, `DESIGN.md`, `ARCHITECTURE.md`.

Rollback at any point is a revert: no data is written and no schema moves.

## Open Questions

- **Should a long press on the header later be added as an accelerator?** Deferrable: the control ships regardless, and adding a gesture on top changes no requirement in this change.
- **Should `Otros` be created automatically when a user deletes their only other category?** Today the picker simply has nothing to offer in that case, which cannot arise on the demo. It belongs with the "Añadir categoría" proposal, which is where category creation lives.
