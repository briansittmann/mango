## Context

A fixed charge is the slot a recurring definition holds in one cycle. Today it opens two sheets:
- from its category card (and a fixed income entry from the income panel): `EntrySheet` in edit mode with `context.recurring`, which edits the slot through `editInCycle` / `deleteInCycle` after asking `ScopeChoice` ("Solo este mes" / "Desde este mes en adelante");
- from "Próximos cobros": `RecurringSheet`, which edits the definition through `update` (name, expected amount, day, reminder), `stop` and `delete` (the definition and its history), and shows the pending total of a plan.

`editInCycle(…, 'onward')` already changes the definition's name, amount, day and category from a cycle on, so the definition sheet's fields are reachable from the row; what the row lacks is the reminder, "Dejar de repetir", the delete of the whole history and the plan's figures. The reminder became live today: `app/api/cron/recordatorios` (another session, migration `0035`) sends a WhatsApp template for pending charges of definitions with `recordatorio_activo`.

In the database, an `editar_cargo_en_ciclo` "solo" on the cycle in progress sets `estado = 'confirmada'` (0024), so today any save of a pending charge from its row, even with nothing changed, confirms it. A charge is shown as charged when it is confirmed or its day has passed (`isCharged`). The demo keeps static `charged` flags on its sample rows and sets `charged: true` on a slot saved from its row.

`RecurringMutations.update` (`actualizar_movimiento_recurrente`) also rewrites the amount of this cycle's pending charge and the name, amount and date of every later pending slot, so it would undo "solo este mes" exceptions if used to save only a reminder.

## Goals / Non-Goals

**Goals:**
- One sheet for a fixed row, whatever opened it, holding every option the two sheets held.
- No new data model: two narrow operations on existing columns, no migration.
- Keep the scope model of `add-forward-scoped-edits` as the single way a fixed row changes.

**Non-Goals:**
- A tick on the "Próximos cobros" row itself. Marking lives in the sheet; a one-tap mark on the row is an open question.
- "Marcar como recibido" for fixed income: income entries have no pending state on screen.
- Editing the number of repetitions of a plan (neither sheet did).
- Changing `RecurringMutations.update` or its SQL; it stays in the contract, now without a caller in the dashboard.
- Updating the stale "definition sheet" wording of `design-system` and `dashboard-ui` (owned by the open `add-desktop-dashboard-shell` deltas); the entry sheet already satisfies those motion and geometry rules.

## Decisions

### D1. The entry sheet is the one sheet
The fixed row's sheet is `EntrySheet` in edit mode, with a new optional prop `fixed` that renders the fixed's section below the fields:

```ts
fixed?: {
  definition: RecurringDefinition
  onMarkCharged?: () => Promise<void>   // present only for this cycle's pending expense charge
  reminder: boolean                      // expenses only
  onStop?: () => Promise<void>           // present only while the definition is active
}
```

`RecurringSheet` and its state in the template are removed. "Próximos cobros" rows call the same `openEditSheet(group, expense)` as the category card, looking the row up by `charge.id` in `data.expenses.groups` (projected charges included, `proj:<id>`).

*Alternatives considered:* keep both sheets and link them ("Más opciones del fijo" opening the definition sheet) — rejected, it keeps two places and a second step, which is what users stumbled on. Grow `RecurringSheet` with this month's fields — rejected, it would reimplement the slot editing, the category move and the scope question that `EntrySheet` already owns.

### D2. What the section shows
- **Summary line** (muted, `text-body-sm`): `gastoRecurrente.resumen` "{monto} cada mes, el día {dia}" from the definition, and for a plan `progreso` + "quedan {n} pagos · {total}" where the total uses the typed amount once "Desde este mes en adelante" is chosen and the expected amount otherwise.
- **"Marcar como cobrado"** row (`Check`, ordinary ink): only with `onMarkCharged`.
- **Recordatorio**: `FieldRow` + `Switch`, and `IntegerField` days-before in a `Collapsible`, as the definition sheet had them. Its own `mousedown` guard, as in `add-savings-sheet` D5.
- divider, **"Dejar de repetir"** (`Ban`, ordinary ink), divider, the existing delete row.

The section reuses the definition sheet's strings (`gastoRecurrente.recordatorio`, `diasAntes`, `dejarDeRepetir`, …) so both languages already read right.

### D3. Saving: slot first, reminder second, nothing when nothing changed
`onSave` receives a new `extra.slotChanged` (this month's fields or category differ) and `extra.reminder` (the new setting, or null when unchanged). The template:
1. runs `editInCycle(definitionId, cycle, entry, scope)` only when `slotChanged`;
2. then `setReminder(definitionId, reminder)` when `reminder` is not null;
3. closes the sheet; the message follows the slot's scope, or "Cambios guardados".

The scope question keeps showing only for slot changes. Skipping `editInCycle` on an unchanged save is what keeps a "Guardar" from silently confirming a pending charge (D4 makes that explicit).

### D4. `setCharged(definitionId, cycle, charged)`
Supabase: one `update transacciones set estado` on the row with `movimiento_recurrente_id = definitionId`, `ciclo_mes = cycle`, `tipo = 'gasto'`, `borrado_en is null` and the opposite `estado`, scoped by `usuario_id`, with `expectRows`. Demo: `charged: Record<slotKey, boolean>` in `DemoRecurringEdits`, applied to the sample cycle's fixed rows after the slot step.

The template marks, closes the sheet and shows a toast `hojaGasto.cobradoEsteMes` ("{nombre}: cobrado este mes") with "Deshacer" calling `setCharged(…, false)`. The bot's `completar_cargo_recurrente` already answers "ya cargado" for a confirmed charge, so a later chat message does not load it twice.

*Alternative considered:* reuse `editInCycle(…, 'only')` with the same values, which confirms in the database. Rejected: it has no inverse for "Deshacer", and in the demo it is a slot override, not a state.

### D5. `setReminder(definitionId, reminder)`
Supabase: one `update movimientos_recurrentes set recordatorio_activo, dias_antes` (like `stop`). It never touches `recordatorio_enviado_para` (0035): turning a reminder off and on again within the same charge does not resend. Demo: `reminders: Record<definitionId, reminder>` applied last when the demo computes its definitions.

### D6. Three reaches for delete
`ScopeChoice` takes an optional `options` list (default `['only', 'onward']`) and an `'all'` option labelled `alcance.todosLosMeses` ("Todos los meses, también los anteriores"). `EntrySheet`'s confirmation step passes all three, with `hints` per option. In the template, `'all'` runs `recurring.delete(definitionId)`, closes the sheet and announces `hojaGasto.eliminadoConHistorial`; it offers no undo, as the definition sheet's delete did not.

### D7. The recurrence switch in edit mode
`renderRecurrenceField` renders in edit mode too when the sheet gets `onSaveRecurrence`. The template passes it in edit mode only for a row with no definition (`!expense.fixed`, `!entry.recurring`) in the cycle the dashboard treats as current, `data.cycle.month === data.cycle.currentMonth`: the cycle in progress on `/dashboard`, and on `/demo` its September sample, which stopped being "in progress" on 1 October (*Fecha fija del demo*) but is still the last generated cycle the projections count from. "Marcar como cobrado" uses the same condition (found in 4.1). The submit path is the create path: the date's day is overridden by the recurrence day, `onSave` updates the row, then `onSaveRecurrence` creates the definition for the chosen category. `crear_movimiento_recurrente` links the most recent unlinked row with the same type, category, amount, name and day, which is the row just saved; the demo's `attachCreatedDefinitions` matches resolved (edited) rows the same way.

### D8. Rows of "Próximos cobros"
`UpcomingChargesCard`'s `onOpenDefinition` becomes `onOpenCharge(charge)`. The template passes it when both `actions.expenses` and `actions.recurring` exist, so the demo without operations still renders the rows disabled.

## Risks / Trade-offs

- [The expected amount can no longer be changed without touching this month] → "Desde este mes en adelante" from the cycle in progress also rewrites this month's slot. To keep a confirmed 880 € and expect 900 € from next month, the user edits next month's projection "Desde este mes en adelante". The summary line keeps both figures visible.
- [A fixed row with no description] → the definition takes the row's empty name, as creating one with the switch already does; the link then depends on the stored description matching. Not changed here.
- [Saving an unchanged pending charge used to confirm it] → behaviour change on purpose (D3); "Marcar como cobrado" is the explicit way. Users who relied on "Guardar" to confirm will see the charge stay pending.
- [Specs still name "the definition sheet" in `design-system` and `dashboard-ui`] → stale references, harmless; listed for the archive of `add-desktop-dashboard-shell`.
- [Archive order] → this change's deltas on `upcoming-charges` and *A recurrence can end, and ends itself* are written over `restyle-upcoming-charges-card`; archive that one first.

## Migration Plan

No database change. Deploy the code; nothing to apply. Rollback is a revert of the code.

## Open Questions

- A one-tap mark on the pending row of "Próximos cobros" (for example, tapping its day mark). Left out to keep the row a single control.
