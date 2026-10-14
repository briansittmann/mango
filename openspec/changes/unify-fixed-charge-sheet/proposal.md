## Why

A fixed charge opens two different sheets depending on where it is touched (Brian, 2026-10-14, from users' feedback). From "Próximos cobros", "Parking" opens the definition sheet: expected amount, day, reminder, stop repeating, delete with its history, "4 de 10". From the "Transporte" card, the same "Parking" opens the entry sheet: this month's amount and date with "Solo este mes / Desde este mes en adelante", and nothing else. A new user reads that as missing features. Two more gaps came with it: a pending charge cannot be marked as paid without typing an expense, and an expense entered once cannot later become a monthly one.

## What Changes

- **One sheet for a fixed row, wherever it opens**: the "Próximos cobros" row, the row in its category card and a fixed income entry in the income panel open the same sheet, with the same options. It is the entry sheet in edit mode (this month's name, amount and date, with the existing "Solo este mes / Desde este mes en adelante" question) plus a section for the fixed itself:
  - a muted line with what it repeats ("820 € cada mes, el día 1") and, for a plan, its progress and what is left ("4 de 10 · quedan 6 pagos · 210 €");
  - **"Cobrado este mes"**, a switch for this cycle's charge (see below);
  - **Recordatorio** with its days before (expenses);
  - **"Dejar de repetir"**;
  - **delete** with three reaches in its confirmation step: "Solo este mes", "Desde este mes en adelante" and "Todos los meses, también los anteriores" (what "Eliminar y borrar el historial" did).
- **The definition sheet goes away** (`recurring-sheet.tsx`). Its fields map onto the one sheet: name, amount, day and category change "from this month on" through the scope question; the reminder, stop and delete live in the fixed's section. **BREAKING** for the spec rule *Where you touch decides what you change*: "Próximos cobros" no longer edits the definition without asking; every surface asks the same question.
- **"Cobrado este mes"**: a switch that turns this cycle's charge charged at its current amount, without entering an expense, or back to pending, also after its day (Brian, 2026-10-14: first shipped as a one-tap action that closed the sheet; now it tints and checks, and "Guardar" applies it).
- **An entered expense or income can become fixed**: editing a row that belongs to no definition, in the cycle in progress, shows the same "Se repite todos los meses" switch as creating one (day, end, one line of explanation). Saving with it on keeps the row as this cycle's charge of the new definition.
- Saving the sheet no longer confirms a pending charge by accident: only the switch does, also when this month's values change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `recurring-expenses`: the operations gain *set charged* and *set reminder*; the recurrence switch also in edit mode for a row with no definition; *The definition sheet* and *Where you touch decides what you change* are replaced by *One sheet for a fixed row* and *Every surface changes a fixed row the same way*; the delete question gains a third reach; *A recurrence can end, and ends itself* moves the pending total to the new sheet; new *Marking a charge as charged*.
- `upcoming-charges`: *A row opens its definition, and nothing else does* is replaced by *A row opens its charge's sheet, and nothing else does*.
- `expense-editing`: *Entry points* (the charge opens from "Próximos cobros" too; one rule instead of two ways in).
- `income-editing`: *Entry points* (a fixed income entry shows the fixed's section; the definition sheet line goes).

The deltas on `upcoming-charges` and on *A recurrence can end, and ends itself* are written over `restyle-upcoming-charges-card`'s versions, so this change archives after that one.

## Impact

- `lib/data/recurring.ts` (`setCharged`, `setReminder`), `lib/data/supabase/recurring.ts` (two single-table updates; `setCharged` writes `no_cobrado`, migration `0037`), `lib/demo/demo-recurring.ts` and `lib/demo/demo-expenses.ts` (charged and reminder overrides), `app/dashboard/actions.ts` and `app/dashboard/supabase-dashboard.tsx`.
- `components/organisms/entry-sheet.tsx` (the fixed's section, recurrence switch in edit mode, three-reach delete), `components/molecules/scope-choice.tsx` (an optional third option), `components/organisms/upcoming-charges-card.tsx` (rows open the charge), `components/templates/dashboard-template.tsx` (one opener, the new handlers, no definition sheet), `components/organisms/recurring-sheet.tsx` removed.
- `messages/es.json`, `messages/en.json`.
- Tests: specs that open the definition sheet (`recurring-create`, `recurring-scope`, `recurring-motion-a11y`, `upcoming-charges`, `widgets-*`, `desktop-sheets` as they apply) move to the one sheet; a new `tests/fixed-sheet.spec.js`.
- No change to the database, the cron, the bot or the projection. The reminders cron (`app/api/cron/recordatorios`) reads the same columns the sheet writes.
