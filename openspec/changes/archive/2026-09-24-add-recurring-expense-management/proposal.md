## Why

A recurring expense has two numbers that look identical on screen and mean opposite things: **what was paid this cycle** and **what is expected every cycle**. Today only the first one is reachable. A charge opens from its category card, where the sheet correctly says *"Solo el cargo de este mes"* — and there is nowhere else to go. The definition in `gastos_fijos` (its expected amount, its day, whether it is still active, its reminder) can be read by the cron and by nothing else. Nobody can create one either: `gastos_fijos` rows exist only because migration `0012_seed_brian.sql` inserted them.

So the two questions the model is built around have one answer and one silence:

- *"This month the rent was 630, not 600."* → works.
- *"From now on the rent is 630."* → impossible.

ARCHITECTURE §7 answers the second one with "la pantalla de gastos fijos del dashboard". **That screen was never built and is not going to be.** The only surface that lists the definitions' effects is the "Próximos cobros" card, which `upcoming-charges` deliberately made read-only.

This change gives the definition a home, and it picks the home that is already on screen.

## The rule that orders everything

**Where you touch decides what you change.**

| You touch | You edit | Scope |
|---|---|---|
| a row inside a **category card** | that `transacciones` row | this cycle — what was actually paid |
| a row inside **"Próximos cobros"** | the `gastos_fijos` definition | every cycle from here on |

Two surfaces, two scopes, no mode switch and no third screen. The card that answers *when* becomes the card that owns *every month*; the card that answers *how much* keeps owning *this month*.

## What Changes

### A) "Próximos cobros" stops being read-only — **BREAKING (spec)**

`upcoming-charges` currently requires that *"nothing in the card SHALL be editable, and nothing SHALL suggest it is"*, and `expense-editing` requires that activating one of its rows opens nothing. Both are reversed here, deliberately and narrowly:

- A row opens a **definition sheet**. That is the card's only new control; there is still no swipe, no add row, no inline editing, and no amount sitting on an editable-looking surface.
- The card keeps everything else: the collapsed strip that shows *when*, the charged/pending grouping, the dimming, the committed-total footer, and no brand, warning or danger colour.

What the card does **not** become is a second place to edit a charge. Tapping "Alquiler" there never changes September's 820 €.

### B) The recurrence toggle — creating a definition from the expense you are already adding

In the entry sheet in **create mode**, a toggle labelled **"Se repite todos los meses"**, off by default. Switching it on reveals, in place and with an animated height, inside the same sheet:

- **"Día del mes"**, preselected with today's day.
- **A single muted line** built from the values already typed: *"Cada día 15 anotaremos 50 € en Parking. Puedes cambiarlo cuando quieras."*
- **How it ends:** "Sin final" (the default — rent, gym) or "Un número de veces" (instalments), which reveals a count field.

Saving creates the definition and the row appears in "Próximos cobros" in the same render.

**The toggle does not appear in edit mode.** A row inside a category card is this cycle's charge; a toggle there would be a second door to the definition and would break the rule above. Editing a one-off into a recurring one is done by deleting it and adding it again — one extra step for a rare case, against a permanently ambiguous control.

### C) Instalments are a recurrence with an end, not a new entity

A `gastos_fijos` row already carries the amount, the day, the category and `activo`. The only thing an instalment plan adds is *how many times*. So:

- **Two new columns** on `gastos_fijos`: `repeticiones_totales` (`integer`, **nullable** — null means "sin final") and `repeticiones_insertadas` (`integer not null default 0`).
- The row in "Próximos cobros" shows the progress next to the day and the amount: **"4 de 10"**. Open-ended definitions show nothing there.
- When the insert that closes the plan runs, the same statement sets `activo = false`. Nobody has to remember to cancel it.
- **The pending total** — `(totales − insertadas) × monto_actual` — is shown, but **in the definition sheet under the expected amount, not in the row**: *"Quedan 6 pagos · 210 €"*. The row is a calendar line with three data points already; the sheet is where the number changes a decision.

Agreed on no separate "deudas" entity, with one boundary stated: this models *an expense that repeats N times*. It does not model principal, interest or an amortisation schedule. If those are ever wanted, they are a new capability that *references* a definition, not a rewrite of this one.

### D) The definition sheet

Opened from a "Próximos cobros" row, on the existing `SheetShell` (floating glass panel, side and bottom margins, drag handle), built the way `category-sheet.tsx` is:

- **Nombre**
- **Monto esperado**, with a support line directly under it: *"El valor de todos los meses."* Plus, when this cycle's charge differs, the actual figure named right there — see (E).
- **Día del mes**
- **Categoría**
- **Recordatorio** — a toggle that reveals a "días antes" field, the same disclosure as the recurrence toggle (`recordatorio_activo` / `dias_antes` already exist in the schema, §14.1).
- Below a divider, **"Dejar de repetir"** — sets `activo = false`, touches no history, asks no confirmation to undo something reversible.
- Below that, clearly separated, **"Eliminar y borrar el historial"** in the destructive colour, behind the same in-sheet confirmation step the category sheet uses. Two destructive-looking rows sitting flush would be the worst possible arrangement, so they are separated by weight, colour and a divider, and only the second one confirms.

**The current cycle.** Saving a new expected amount updates this cycle's charge **only while it is still pending**. A charge that was already confirmed is what was really paid and is never overwritten. This follows §7's reconciliation exactly — a pending row is a placeholder carrying the expected amount, so changing the expectation changes the placeholder.

### E) Making the distinction visible without a help label

Four signals, none of them a tooltip:

1. **Different sheets.** Category row → "Editar gasto", caption *"Vivienda · Solo el cargo de este mes"* (already built). Próximos cobros row → the definition's name as the title, caption *"Se repite · día 1"*.
2. **Different field label.** "Importe" in one, **"Monto esperado"** in the other. The label alone carries the scope.
3. **Both numbers on screen at once.** When this cycle's charge differs from the expectation, the definition sheet's support line reads *"El valor de todos los meses. Este mes se anotaron 880 €."* You cannot confuse the two when you can see both.
4. **A discreet difference on the row.** When a charge's amount differs from its definition's expected amount, the "Próximos cobros" row keeps showing the real amount and adds a muted caption under the name: *"esperado 820 €"*. Only when they differ. **No colour** — a difference is information, not a warning, and the card takes no accent colour.

And after the fact, the confirmation states the scope it just applied: *"Alquiler: 880 € cada mes"* rather than the generic "Cambios guardados".

### F) The bot's permanent-or-not question lives in the adapter

`lib/bot/logic.ts` decides *what* to reply; `lib/whatsapp/adapter.ts` decides *how* and owns the conversation's state across turns (§3). A follow-up question is a second turn, so:

- **Logic** parses *"alquiler 630"*, matches the pending charge of that definition, completes and confirms it at 630, and returns a reply that **declares a discrepancy** — the definition, its expected 600, the loaded 630 — without deciding anything.
- **The adapter** turns that into the question (*"¿Son 630 todos los meses?"*), holds the pending decision, and on a yes calls the definition update that sets `monto_actual = 630`.
- **No answer is not a state to store.** Silence leaves the cycle's charge at 630 and the definition at 600 — exactly the "excepción de ese ciclo" outcome, reached by doing nothing.

Specified here, built when the parser is built: §B of *Out of scope*.

### G) Schema

One migration, `0013_gastos_fijos_repeticiones.sql`:

```sql
alter table gastos_fijos
  add column repeticiones_totales integer
    check (repeticiones_totales is null or repeticiones_totales > 0),
  add column repeticiones_insertadas integer not null default 0
    check (repeticiones_insertadas >= 0),
  add constraint gastos_fijos_repeticiones_coherentes
    check (repeticiones_totales is null or repeticiones_insertadas <= repeticiones_totales);
```

Names follow the table's existing Spanish, and "repeticiones" rather than "cuotas" because the field describes any recurrence with an end, not only a purchase in instalments. The counter increments on every insert, open-ended definitions included — it costs nothing and is only *read* when `repeticiones_totales` is not null.

### H) The two schema questions raised, answered

**Medio de pago — recommend leaving it out.** It has no consumer: nothing in the dashboard groups, filters or totals by card, and §9 explicitly keeps it off the row. A free-text column added now is a field that gets filled and never read. It stays pending in §9, and the definition sheet has an obvious place for it the day a consumer exists.

**Ingresos recurrentes — recommend *not* adding a `tipo` to `gastos_fijos`, because the table already exists.** `supabase/migrations/0007_ingresos_esperados.sql` created `ingresos_esperados` with `nombre`, `monto_estimado`, `es_variable`, `dia_del_mes`, `activo` and `orden` — a salary already has a home, with the same shape and a day of the month, and the dashboard's `income.sources` (`estimated` / `actual`) already reads that shape. Giving `gastos_fijos` a `tipo` would give recurring income *two* homes and make every query filter on a discriminator that only ever has one value in that table.

> The reason this looked like an open question is a documentation gap: **ARCHITECTURE §8 lists `usuarios`, `invitaciones`, `categorias`, `transacciones`, `gastos_fijos` and `presupuestos` — and never mentions `ingresos_esperados`, which has existed in the schema since migration 0007.** Fixing §8 is a task here; building the recurring-income UI is not.

### I) Demo

The sample gains **six definitions backing the six charges it already has**, and **not one figure moves**: the expenses total stays 1.700 €, the free margin 974 €, the committed footer 1.025 €. Every assertion the existing capabilities make about the sample survives untouched.

| Definition | Category | Day | Expected | Ends |
|---|---|---|---|---|
| Alquiler | vivienda | 1 | 820 € | — |
| Internet | vivienda | 3 | 45 € | — |
| Seguro | vivienda | 8 | 35 € | **4 de 10** |
| Parking | transporte | 15 | 50 € | — |
| Limpieza | hogar | 20 | 35 € | — |
| Gimnasio | salud | 22 | 40 € | — |

"Seguro" carries the instalment case (a policy paid in ten monthly instalments), so "4 de 10" and the pending total are on screen at first load without inventing a row. **No seeded discrepancy**: every charge starts equal to its expectation, and the *"esperado 820 €"* caption appears the moment the visitor edits "Alquiler" to 880 € in its category card — which is already a scenario in `upcoming-charges`.

### J) Motion and finish

Weighted like the logic, not like decoration:

- **The toggle** is the most-looked-at control on the sheet: the thumb travels on `--ease-spring`, the track colour transitions *with* the movement rather than after it, and on touch devices it fires a short `navigator.vibrate` where the browser allows it, guarded and silent where it does not.
- **Everything that appears, animates.** The revealed day field, the revealed end options, the revealed "días antes" field and the new "Próximos cobros" row each animate their height through the existing `Collapsible` (200 ms, `--ease-drawer`). Nothing jumps.
- **No layout shift.** The end-options block reserves nothing and pushes rather than overlays; the sheet's own height animation absorbs it.
- 150–250 ms, existing easing tokens, `prefers-reduced-motion` honoured everywhere, visible focus and error states, 48px rows and 44px hit areas, and no colour that is not already a token — lime stays brand, amber and red stay budget state.

## Where this contradicts decisions already written down

Flagged rather than quietly resolved:

1. **ARCHITECTURE §7, *"Carga automática de fijos"*** — *"la definición … vive en la pantalla de gastos fijos del dashboard"*. That screen does not exist and is being ruled out. **Outdated; rewritten by this change** to name "Próximos cobros".
2. **ARCHITECTURE §9, *"La tarjeta «Próximos cobros»: cuándo, no cuánto"*** — *"es un calendario de solo lectura"* and *"Sin fila de añadir y sin edición: tocar y deslizar se hacen en la fila de la categoría"*. **Half outdated:** no add row and no swipe is still true and stays true; "solo lectura" is not. **Rewritten.**
3. **ARCHITECTURE §9, *"Cómo se entiende la recurrencia sin explicarla"*** — *"Lo que no va en la fila: medio de pago y el resto de la configuración. Eso vive en el detalle que se abre al tocarla."* That detail is now specified: it is the definition sheet, opened from "Próximos cobros". **Clarified, not reversed.**
4. **`upcoming-charges` → *The card is read-only and looks read-only*** — reversed in its first bullet only; every other guarantee in that requirement is kept verbatim.
5. **ARCHITECTURE §8** — does not list `ingresos_esperados`, which exists. **Corrected.**
6. **Copy register.** The brief's *"Podés cambiarlo cuando quieras"* is voseo; `messages/es.json` is consistently peninsular (*"Introduce un importe…"*, *"Inténtalo de nuevo"*). The specs use **"Puedes cambiarlo cuando quieras"** to match the file. Say the word and the whole file changes register instead — it is a find-and-replace, not a decision this change should make silently.

## Out of scope

- **Real Supabase queries and the cron.** The migration is written and applied; the operations are typed and injected; only the in-memory demo implements them — the same boundary every change in this repo has held, because no authenticated dashboard route exists yet. The cron that inserts charges, increments `repeticiones_insertadas` and flips `activo` is specified as behaviour and implemented later, with the rest of §7's automation.
- **The bot's parser.** (F) specifies where the permanent/exception decision lives and what each side returns. Neither `processMessage` nor the adapter is implemented — Gemini and Zod are still not in `package.json`.
- **Recurring income and a UI over `ingresos_esperados`** — see (H). Noted, not built.
- **Medio de pago** — see (H).
- **Reminders actually being sent** (§14.1, phase 2). The toggle and `dias_antes` are editable here; no message is ever sent.
- **Converting an existing one-off expense into a recurring one** — see (B).
- **Reordering definitions** (`gastos_fijos.orden`), and the *"día 3"* caption under a recurring row inside its category card.
- **A definition whose day exceeds the month's length** (day 31 in February). The column already allows 1–31; picking the clamping rule belongs with the cron that inserts the rows.

## Capabilities

### New Capabilities

- `recurring-expenses`: the definition itself — the injected operations over it, the recurrence toggle and its revealed fields in the entry sheet, recurrences with an end and their auto-deactivation, the definition sheet opened from "Próximos cobros" (its fields, its "dejar de repetir", its delete-with-confirmation), what a definition change does to the current cycle's charge, the microcopy and signals that keep "this cycle" and "every cycle" apart, and where the bot's permanent-or-not decision lives.

### Modified Capabilities

- `upcoming-charges`:
  - *The card is read-only and looks read-only* → **rows open the definition sheet**; every other read-only guarantee (no swipe, no add row, no editable-looking surfaces, no explanatory text) is kept.
  - *Expanded state lists the cycle's charges* → a row gains instalment progress and, when the charge differs from its expectation, a muted "esperado" caption. Rows become buttons and must stay 48px with the columns intact.
  - *The card takes no accent colour* → the new caption and progress take no colour either; a difference is not a warning.
- `expense-editing`:
  - *One entry sheet for creating and editing* → create mode carries the recurrence field; edit mode does not.
  - *Entry points* → a "Próximos cobros" row now opens the **definition** sheet, while a recurring charge's row in its category card still opens the **charge** sheet, scoped to this cycle. The "One way in" scenario is rewritten, not deleted: there is still exactly one way in *per scope*.
- `dashboard-ui`:
  - *Public demo route* → the sample carries six definitions, one of them with an end, with every existing figure unchanged; definition operations work in memory like the expense and category ones.
  - *Controls without a handler are disabled* → a "Próximos cobros" row with no definition operations supplied is disabled rather than inert.
- `design-system`:
  - *Motion respects user preference* → the definition sheet joins the list of sheets, and the recurrence and reminder disclosures join the list of animated heights, in both the reduced and the normal branch.

`theming` and `localization` are **not** modified: every colour is an existing token and every string goes through `messages/*.json`, which those capabilities already require of all new text.

## Impact

- **Database:** one migration, `0013_gastos_fijos_repeticiones.sql`. No table is created and no existing column changes type or nullability.
- **Data contract:** a new `lib/data/recurring.ts` (the definition type, its draft, and the four injected operations); `Expense.fixed` in `lib/data/dashboard.ts` gains the definition's id so a charge can point at what produced it; `UpcomingCharge` in `lib/data/upcoming-charges.ts` gains the definition id, the expected amount and the progress.
- **Components:** a new `components/atoms/switch.tsx` (there is no toggle in the codebase today) and `components/organisms/recurring-sheet.tsx`; changes to `entry-sheet.tsx` (one composite recurrence field in the config), `upcoming-charges-card.tsx` (rows become buttons, progress and "esperado" caption) and `dashboard-template.tsx` (mounting and wiring). `SheetShell`, `FieldRow`, `AmountField`, `Collapsible` and `DayChip` are reused as they are.
- **Demo:** `lib/demo/demo-data.ts` (six definitions, "Seguro" with an end) and a new `lib/demo/demo-recurring.ts` alongside `demo-expenses.ts` and `demo-categories.ts`.
- **Bot:** a contract note in `lib/bot/logic.ts` and `lib/whatsapp/adapter.ts` describing the discrepancy reply and who owns the pending decision. No behaviour, both are still stubs.
- **Messages and docs:** a new `gastoRecurrente` namespace in `messages/es.json` and `messages/en.json`; `DESIGN.md` gains the switch and the definition row; ARCHITECTURE §7, §8 and §9 are corrected as listed above.
- **Dependencies:** none new.
- **CSS:** none expected — `--ease-spring`, `--ease-drawer`, `pressable`, `liquid-glass` and the spacing tokens already cover the switch and the sheet.
