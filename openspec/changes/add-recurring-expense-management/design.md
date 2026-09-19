## Context

See `proposal.md` → *Why* for the motivation and *The rule that orders everything* for the rule the whole design hangs on.

What exists and constrains this:

- **The dashboard is injection-only.** `DashboardTemplate` receives `data` and `actions`; the demo supplies in-memory implementations and the eventual real route will supply Supabase ones. `ExpenseMutations` (4 ops) and `CategoryMutations` set the shape a third operation set must copy.
- **A charge has no link to what produced it.** `Expense.fixed` is `{ day, charged }` — enough to render a calendar, not enough to open anything. `UpcomingCharge` is derived from those rows by a pure selector, `selectUpcomingCharges`, over the cycle's groups.
- **There is no toggle in the codebase.** `components/atoms/` has a dot, a chevron, a day chip, a collapsible, money, a progress bar. Every existing on/off choice is either a set of swatches or a three-way theme control in the account menu.
- **Sheets are already a system.** `SheetShell` owns the panel, the glass, the handle, the swipe-to-dismiss, the dirty guard and focus return. `EntrySheet` is config-driven over field descriptors; `CategorySheet` is hand-composed on the same shell with an in-sheet confirmation step.
- **`gastos_fijos` exists and is unused by the app.** Rows come from the seed. Nothing reads them at runtime; the day and state the demo renders are hard-coded on the sample expenses.
- **The demo's figures are load-bearing.** 1.700 € / 974 € / 1.025 € are asserted across `dashboard-ui`, `expense-editing`, `category-editing`, `category-reordering` and `upcoming-charges`. Any sample change that moves them cascades into five capabilities.

## Goals / Non-Goals

**Goals:**

- One definition entity, reachable from exactly one surface, with the two scopes distinguishable without a help label.
- New components that are indistinguishable in finish from the ones already shipped — same shell, same tokens, same easings, same 44/48px rules.
- A data contract the Supabase implementation can satisfy later without any component changing.
- A sample that demonstrates instalments and the expected-vs-actual difference while leaving every asserted figure at its current value.

**Non-Goals:**

- Deciding the cron's clamping rule for day 29–31 in short months. The column already allows 1–31; the rule belongs with the job that inserts.
- Any concurrency design. There is one user per dataset and no real backend yet.
- Making `EntrySheet`'s config general enough for arbitrary composite fields. One composite kind is added, for this one case.

## Decisions

### 1. A third operation set, not a fifth expense operation

`RecurringMutations { create, update, stop, delete }` in a new `lib/data/recurring.ts`, added to `DashboardActions` as `actions.recurring`, mirroring `actions.expenses` and `actions.categories`.

*Why:* the existing contract already says update "never changes the recurring fixed-expense definition". Folding definition writes into `ExpenseMutations` would contradict the sentence that makes the two scopes provable, and would make the recording-implementation scenarios (which assert *which* recorder was called) untestable.

*Alternative rejected:* a single `update(expenseId, draft, { scope: 'cycle' | 'forever' })`. One call site with a scope flag is exactly the ambiguity the UI design spends its effort removing; it would also let a component pick the scope, which is the user's choice.

`stop` is its own operation rather than `update({ active: false })` because it is the only write with a different blast radius (forward-only, never touches an amount), and because the spec asserts it moves no figure — easier to guarantee when it cannot carry a draft.

### 2. `Expense.fixed` gains the definition's id

```ts
fixed?: { definitionId: string; day: number; charged: boolean }
```

*Why:* it is the minimum that lets `selectUpcomingCharges` produce a row that knows what to open, and it keeps the derivation pure — the card still renders from the same rows the category cards render, which is what `upcoming-charges` → *Charges are derived, never queried* requires.

`UpcomingCharge` then gains `definitionId`, `expectedAmount` and `progress: { done: number; total: number } | null`. The expected amount is carried on the charge rather than looked up by the card, so the "esperado 820 €" caption is a comparison of two fields on one object and cannot go stale.

*Alternative rejected:* passing a `definitions` array to the card alongside `charges` and joining in the component. That puts a join in a presentational organism and gives it two sources that can disagree.

### 3. The switch is a new atom; the definition sheet is a new organism; nothing else is new

- **`components/atoms/switch.tsx`** — there is nothing to reuse. Built on `@base-ui/react` for the semantics (`role="switch"`, keyboard, disabled), styled with the existing tokens: `--ease-spring` for the thumb, `pressable` for the press and focus ring, `min-h-target` for the hit area. Haptics are one guarded call (`navigator.vibrate?.(10)`) inside the change handler, wrapped in `try`, skipped under `prefers-reduced-motion`.
- **`components/organisms/recurring-sheet.tsx`** — composed on `SheetShell` the way `CategorySheet` is, reusing `FieldRow`, `AmountField`, `Collapsible` and `CategoryDot`, and reusing `CategorySheet`'s two-step pattern for the delete confirmation.
- **`EntrySheet`** gains one field kind, `recurrence`, which renders the switch plus its revealed block. `expenseEntry` includes it; a future config simply omits it.

*Why a second sheet organism rather than a second `EntryConfig`:* the definition needs a category picker, two switches with revealed fields, a non-destructive "stop" row, a destructive row and a confirmation step. Expressing all of that as field descriptors would grow `FieldKind` by four kinds and add branching to a component whose value is that it is small. `CategorySheet` already set the precedent for "different body, same shell", and the shell is where the finish lives — which is the part that must not diverge.

*Why one composite kind instead of three descriptors (`switch`, `day`, `end`):* the three are one unit — they appear together, validate together, and the explanation line reads values from all of them plus the amount field. Three independent descriptors would need cross-field wiring through the config, which is the config's one job it currently does not have.

### 4. The current cycle's charge is updated by the data source, not the sheet

When `update` changes the expected amount and this cycle's charge is still pending, the charge moves too. That reconciliation lives in the **operation implementation** (demo now, Supabase later), not in the sheet.

*Why:* it is the same rule §7 gives the cron, and the sheet has no business knowing whether a charge is pending. It also keeps the component's contract to one call, so the recording-implementation scenario stays a single assertion.

*Trade-off:* the demo implementation gets a little logic (find the charge for this definition in the current cycle, update it only if pending). That mirrors what a Supabase `update ... where estado = 'pendiente'` will do in one statement, so the two sources stay comparable.

### 5. Counter semantics: always increment, read conditionally

`repeticiones_insertadas` increments on every insert, open-ended definitions included. Only definitions with `repeticiones_totales` read it.

*Why:* one code path in the cron, no branch, and a free "how long has this been running" datum. The alternative — increment only when there is a total — saves nothing and adds a condition to the hot path.

*Known imprecision:* if a charge is soft-deleted, the counter still counts it, so an instalment plan could end one payment "early" in the counter's view. Accepted: the counter tracks *insertions*, not surviving rows, and a soft-deleted instalment is a data correction the user made deliberately. Documented in the migration's comment, which is where this table's other semantics already live.

### 6. Demo: six definitions, one with an end, zero figures moved

`lib/demo/demo-recurring.ts` alongside `demo-expenses.ts` and `demo-categories.ts`, following the same edits-record-and-derive shape (`DemoRecurringEdits` folded into `deriveDemoData`). The sample's six existing charges each get a definition with `expectedAmount` equal to the charge's current amount; "Seguro" gets `repeticiones_totales: 10, repeticiones_insertadas: 4`.

*Why "Seguro" carries the instalments:* a policy paid in ten monthly instalments is credible, it is already in the sample, and using an existing row means the totals do not move. Adding a seventh charge would move 1.700 €, 974 € and 1.025 € and force edits across five capabilities for a demo affordance.

*Why no seeded discrepancy:* the difference caption is reachable in one interaction that is already a scenario elsewhere (editing "Alquiler" to 880 €). Seeding one would mean the demo opens showing a mismatch, which reads as sample data being wrong.

**Derivation order matters.** In `deriveDemoData`, definition edits must resolve *before* expense edits, because a definition update can change a pending charge's amount and a later expense edit on that same charge must win. The step list becomes: definitions → expenses → categories → deletions → order → totals.

### 7. Copy lives in one new namespace

`gastoRecurrente` in `messages/es.json` and `en.json`, with ICU arguments for the explanation line (`{dia}`, `{monto}`, `{categoria}`), the progress (`{hechas}`, `{total}`), the pending total (`{pagos}`, `{monto}`) and the expected caption (`{monto}`). Peninsular register, matching the file — see `proposal.md` → *Where this contradicts decisions already written down*, point 6.

The explanation line is one message with three arguments rather than concatenated fragments, so the English word order can differ from the Spanish.

## Risks / Trade-offs

- **The card gains a control and could start reading as an editable list.** → Everything but the tap stays: no swipe, no add row, flat amounts, no lighter surfaces, no helper text. The specs assert each of those individually so a later change cannot quietly erode them.
- **Two sheets that look alike, opened from rows that look alike, with opposite scopes.** → Four independent signals (title, field label, both figures on screen, the after-the-fact confirmation), each specified and each testable on its own. If one is dropped later, the scenarios fail one at a time rather than the distinction silently degrading.
- **"Dejar de repetir" and "Eliminar" sit next to each other; picking the wrong one loses history.** → Different colour, different tint, a divider between them, and confirmation on the destructive one only. The reversible one is first, which is also the one people mean 95% of the time.
- **The counter can drift from reality** (decision 5). → Bounded to soft-deleted instalments; the constraint `repeticiones_insertadas <= repeticiones_totales` still holds, so drift can end a plan early but can never overrun it.
- **The demo's in-memory derivation grows a fourth edit source.** → Same shape as the three that exist, one new file, and the ordering rule stated in decision 6 is the only new coupling.
- **The migration adds a `not null default 0` column to a table that exists in a deployed database.** → Two integer columns with a default on a table holding a handful of rows per user. No rewrite risk worth planning around at this size.
- **The `recurrence` field kind makes `EntryConfig` slightly less generic.** → Accepted; one configuration uses it and the other configuration that exists (none yet) can omit it. Revisit if a third entry type ever needs its own composite.

## Migration Plan

1. `supabase/migrations/0013_gastos_fijos_repeticiones.sql` — two columns and one cross-column check (see `proposal.md` → *Schema*). Additive, with a default, no backfill: existing rows become open-ended definitions with a zero counter, which is the correct reading of a definition created before instalments existed.
2. Apply locally against the Supabase project and confirm the seed in `0012_seed_brian.sql` still loads.
3. Rollback is `alter table gastos_fijos drop column repeticiones_totales, drop column repeticiones_insertadas;` — nothing else in the schema references them.
4. No application deploy is coupled to it: no runtime code reads `gastos_fijos` yet, so the migration can land before, with, or after the UI.

## Open Questions

- **Where the definition sheet's "Categoría" picker sits on desktop.** The `CategorySheet` anchors to its opener above `sm`; the entry sheet does not. Either is defensible for this sheet and neither changes a requirement — a layout call to make while building.
- **Whether the "esperado" caption should also appear on the charge's row inside its category card.** Out of scope here and deliberately not specified; the category card's row is about this cycle, and adding the expectation there would re-import the ambiguity this change removes. Worth revisiting only with real usage.
