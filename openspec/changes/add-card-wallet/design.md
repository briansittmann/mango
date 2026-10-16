## Context

See proposal.md for the motivation. What shapes the approach:

- Every dashboard mutation goes through an injected contract in `lib/data/` with two implementations, `lib/demo/*` (in memory, `/demo`) and `lib/data/supabase/*` (behind the server actions of `app/dashboard/actions.ts`). There are no REST route handlers for dashboard data, and the browser bundle carries no Supabase client. The prompt this change started from asked for "route handlers for the card CRUD"; this design follows the project's pattern instead.
- A fixed charge is a `movimientos_recurrentes` row (the definition) plus one `transacciones` row per cycle (the slot), linked by `movimiento_recurrente_id`; a projected cycle carries computed charges with `fixed` and `projected: true`. Each `Expense` with `fixed` knows its `definitionId`, and the template already holds `definitions: RecurringDefinition[]` next to `DashboardData`.
- References between a user's rows use composite FKs with `usuario_id` (0019), so the database rejects a reference to another user's row whatever the client. `on delete set null (col)` is already used there.
- `unify-fixed-charge-sheet` (open) made `EntrySheet` with `fixed` the one sheet of a fixed row; its section holds the summary line, "Cobrado este mes", the reminder, "Dejar de repetir" and delete, and its save writes the slot, then the charged state, then the reminder (`handleSaveEntry` in the template).
- The chart widgets are a `WidgetList` keyed by `WidgetId`, ordered by `usuarios.orden_widgets` through `normalizeWidgetOrder`, which appends any id it does not find. A projected cycle keeps only `'distribution'`.
- Category colours are the 15 `CategoryColor` tokens (`--cat-*`, `light-dark()`), several of them light (`blanco`, `verde_menta`, `celeste`, `turquesa`), so white text on the plain colour fails 4.5:1.

## Goals / Non-Goals

**Goals:**
- One more injected contract (`CardMutations`) and one narrow definition operation (`setCard`), following the existing shape exactly.
- Committed totals computed on the client from what the dashboard already has (rows + definitions), so the projection, "solo este mes" amounts and deleted slots are right without new queries.
- A card face that reads well in every palette colour and both themes, with motion inside the project's rules.

**Non-Goals:**
- A card on `transacciones` (one-off expenses): that is the later phase, and the reason the card lives on the definition now (see D2).
- Pointer-following tilt with a mouse: the hover is a fixed tilt in CSS; only touch follows the finger (D6).
- Showing the card on "Próximos cobros" rows or in the category cards (Open Questions).
- Card ordering by the user; cards keep creation order.

## Decisions

### D1. Table `tarjetas` and a nullable `tarjeta_id` on the definition
Migration `0038_tarjetas.sql`, additive:

```sql
create table tarjetas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 30),
  color text not null check (color in (/* the 15 of 0004 */)),
  creada_en timestamptz not null default now(),
  unique (id, usuario_id)
);
create unique index tarjetas_nombre_unico on tarjetas (usuario_id, lower(btrim(nombre)));
alter table tarjetas enable row level security;
create policy tarjetas_crud_propio on tarjetas for all
  using (usuario_id = usuario_actual_id()) with check (usuario_id = usuario_actual_id());

alter table movimientos_recurrentes
  add column tarjeta_id uuid,
  add constraint movimientos_recurrentes_tarjeta_id_fkey
    foreign key (tarjeta_id, usuario_id) references tarjetas (id, usuario_id)
    on delete set null (tarjeta_id),
  add constraint movimientos_recurrentes_tarjeta_si_gasto
    check (tarjeta_id is null or tipo = 'gasto');
```

`on delete set null (tarjeta_id)` is what makes *Deleting a card frees its fixed charges* a single `delete`: Postgres nulls only that column, keeping `usuario_id`. The check keeps income without a card in the database, as `categoria_si_gasto` does for categories.

*Alternatives:* a join table definition↔card (rejected: a fixed is charged to one card; a join table adds a uniqueness rule to enforce instead of a column); blocking the delete with `restrict` (rejected by the proposal: it would push the user through every fixed first).

### D2. The card is a field of the definition, without scope
A card answers "where does this fixed get charged", which is a property of the agreement, not of one month's amount; so `setCard` changes the definition and no slot, and asks no "Solo este mes / Desde este mes" (same reasoning as `setReminder`, `unify-fixed-charge-sheet` D5). The trade-off: totals of past cycles follow the current assignment (Risks). When one-off expenses get a card, that will be a `transacciones.tarjeta_id` and the fixed's slots can copy the definition's card at generation; nothing here blocks that.

### D3. Contracts
`lib/data/cards.ts`:

```ts
export type Card = { id: string; name: string; color: CategoryColor }
export type CardDraft = { name: string; color: CategoryColor } // name trimmed, 1-30
export type CardMutations = {
  create(draft: CardDraft): Promise<string> // the new card's id (D7)
  update(cardId: string, draft: CardDraft): Promise<void>
  delete(cardId: string): Promise<void>
  setFixedCharges(cardId: string, definitionIds: string[]): Promise<void>
}
export const DUPLICATE_CARD_NAME = 'duplicate-card-name' // the rejection's message, as categories do
export function committedByCard(groups: ExpenseGroup[], definitions: RecurringDefinition[]): Map<string, { total: number; count: number }>
```

`RecurringDefinition` gains `cardId: string | null`; `RecurringMutations` gains `setCard(definitionId, cardId | null)`. `DashboardData` gains `cards: Card[]` (creation order). `DashboardActions` gains `cards?: CardMutations`.

Supabase: `create`/`update`/`delete` are single-table writes with `expectRows`; a `23505` on `tarjetas_nombre_unico` rejects with `DUPLICATE_CARD_NAME`. `setFixedCharges` calls `asignar_fijos_tarjeta(p_usuario_id, p_tarjeta_id, p_definiciones uuid[])`, a `security invoker` function in `0038` (the `0017` pattern: RLS applies, `p_usuario_id` explicit) that in one statement pair sets `tarjeta_id = null` where it is this card and the id is not listed, and `tarjeta_id = p_tarjeta_id` where the id is listed and `tipo = 'gasto'`; it raises if a listed id is not the user's active expense definition. `setCard` is an `update … set tarjeta_id` on one definition (the composite FK rejects another user's card). `resumenMensual` selects `tarjetas` (ordered by `creada_en`) and `movimientos_recurrentes.tarjeta_id`.

*Alternative:* the checklist as N `setCard` calls from the client (rejected: a failure halfway leaves a mixed state, and the spec asks for one step).

### D4. Committed totals on the client
`committedByCard` walks `data.expenses.groups`, takes every expense with `fixed`, looks up its definition's `cardId` and sums `expense.amount` per card, counting rows. Because it reads the shown rows, a projected cycle counts projected charges, a "solo este mes" amount counts as changed, a deleted slot is absent, and income is never in `expenses.groups`. It is pure and gets `lib/data/cards.test.mjs`. The demo needs no special case: its `deriveDemoData` already yields those rows.

### D5. The widget
`WidgetId` gains `'wallet'`, appended to `DEFAULT_WIDGET_ORDER` (so `normalizeWidgetOrder` puts it last for any stored order). The projection filter keeps `'distribution'` and `'wallet'`. `components/organisms/wallet-widget.tsx` uses `WidgetHeader` (title "Tarjetas", the grip as `trailing`) and renders the stack:

- each card is a `<button>` with `aria-label` "Débito, 865 € este mes"; cards after the first get a negative top margin so only a 56px band of the previous one shows (the band holds name left and total right); the last one is whole and adds the count line;
- the face is `components/atoms/wallet-card.tsx`, shared with the sheet's preview;
- "Añadir tarjeta" is the existing `add-row.tsx`;
- empty state: a dashed outline with the card's proportions, the line, and the add row.

At 320–360px of widget column the card is ~300×190; at 390px phone width the widget is the column's width minus its padding. Five or more cards just grow the stack (each adds 56px).

### D6. The card face: drawn in CSS, tilted by CSS with a mouse and by a pan with a finger
Tokens in `globals.css`, per colour, built from the existing ones so the palette stays one source: `--card-from: color-mix(in oklch, var(--cat-X) 78%, black)` and `--card-to: color-mix(in oklch, var(--cat-X) 48%, black)`, with white ink. Mixing towards black is what lets `blanco` and `verde_menta` carry white text; the contrast is checked per colour and theme in the spec (axe plus a computed check in the test), and the percentages are tuned there if one fails. Layers: `linear-gradient(135deg, from, to)`; a sheen as a `::before` with a soft diagonal white gradient at low opacity; a 1px inner rim (`inset 0 1px 0 rgb(255 255 255 / .15)`); two-layer shadow like `HELD_SHADOW`. Hover, only under `@media (hover: hover) and (pointer: fine)` and `prefers-reduced-motion: no-preference`: `transform: perspective(800px) rotateX(4deg) rotateY(-6deg) translateY(-4px)` over 250 ms with the project's ease-out, the sheen shifting with it; `.pressable` gives the press. No blur, so the desktop blur allow-list is untouched. The values are checked against `motion-skills/AUDIT.md` before the screenshots.

**Touch (Brian, 2026-10-16).** A phone has no hover, so there the tilt follows the finger, with `motion`'s pan gesture (`motion/react`, already used by `widget-list.tsx`). Each card is a `motion.button` with:

```tsx
const offset = useMotionValue(0)
const rotateY = useSpring(useTransform(offset, [-120, 120], [-8, 8]), { stiffness: 300, damping: 25 })
const sheen = useTransform(rotateY, [-8, 8], ['0% 50%', '100% 50%'])
<motion.button
  style={{ rotateY, transformPerspective: 800, touchAction: 'pan-y' }}
  onPan={reduced || !coarse ? undefined : (_, info) => offset.set(info.offset.x)}
  onPanEnd={() => offset.set(0)}
/>
```

- **Pan, not drag**: drag moves the element; the card must stay in the stack and only rotate. Pan reports the finger's `offset` and moves nothing.
- **`touch-action: pan-y`**: Motion's docs require touch scrolling disabled on at least one axis for pan on touch. Keeping `pan-y` leaves the page's vertical scroll to the browser, so only a sideways slide tilts the card. The cost: on touch the tilt is around the vertical axis only (`rotateY`), no `rotateX`.
- **Only with a coarse pointer** (`coarse` from `(pointer: coarse)`), so the mouse keeps the CSS hover and the two never stack; **none under reduced motion** (`useReducedMotion`), where pan is not attached at all.
- **The sheen** follows `rotateY` through `background-position`, as with the hover.
- **A slide must not open the sheet**: Motion's docs do not say whether a pan cancels the click. The card ignores the click that ends a pan (a ref set on `onPanStart`, cleared on the next pointer down) — verified in the test, in WebKit with touch emulation as well.

*Alternatives:* the gyroscope (`DeviceOrientationEvent`; rejected: iOS asks a system permission for a decorative effect, and it is not Motion); `drag` with `dragSnapToOrigin` (rejected: it moves the card out of the stack); a pointer-tracking `TiltedCard` from React Bits for the mouse too (rejected: JavaScript per card for what a fixed CSS hover already does).

### D7. The card sheet
`components/organisms/card-sheet.tsx` on `SheetShell` (side panel at `lg`, bottom sheet below, anchored from its `opener` like the category sheet). Name with `FieldRow`; colour with `ColorSwatchPicker`; the checklist lists `definitions.filter(d => d.tipo === 'gasto' && d.active)` sorted by day, each row a `Checkbox` from `@base-ui/react/checkbox` (already a dependency; the first use, styled with the `Switch` tokens) with name, `Money` amount and a muted "En {tarjeta}" when `cardId` is another card. Saving: `create`/`update` when name or colour changed, then `setFixedCharges` when the checked set differs from the initial one. For a new card the checklist needs its id, while every other contract's `create` resolves with nothing, so `CardMutations.create` returns `Promise<string>` (the new id) — the one deviation from the other contracts, needed to save a new card with its fixed charges in one "Guardar". Delete uses the sheet's confirmation step like the category sheet (`ScopeChoice` is not needed: one reach).

### D8. The "Tarjeta" row in the fixed's section
`EntrySheet`'s `fixed` prop gains `cards: Card[]` (empty → no row) and the definition's `cardId`. The row is a `FieldRow` showing the current card with a `ChevronDown`, which expands in a `Collapsible` a list of the cards and "Sin tarjeta" as radio rows (each with a `CategoryDot` in the card's colour), the pattern of the sheet's own category control rather than a new popover inside a sheet; local state `cardChoice` and `cardDirty` like `reminderDirty`, and `onSave` extra gains `card: string | null | undefined` (undefined = unchanged). In `handleSaveEntry`, after `setReminder`: `if (card !== undefined) await actions.recurring.setCard(definitionId, card)`. Nothing in the create path (Open Questions).

### D9. Demo
`lib/demo/demo-cards.ts` holds `DemoCardEdits` (created, updated, deleted, assignments) applied over a seed of two cards and the four assignments of the spec; `buildDemoRecurringDefinitions` reads `cardId` from it. `/demo?e2e=fail-card-save` makes `update` and `setFixedCharges` reject, for the failure scenarios.

### D10. Five more colours, one of them a rainbow (added during apply, 2026-10-16)
Brian asked for amarillo, marrón, lila and fucsia, and one easter egg that keeps changing colour. The palette grows to twenty (`CategoryColor`, `CATEGORY_COLORS`, `--cat-*`, `--card-from-*`/`--card-to-*`, names in `hojaCategoria.colores`); categories need `0039` for their check, and `0038` creates `tarjetas` with the twenty. "arcoiris" is one colour whose hue turns: `@property --rainbow-hue` (a number, not inherited) is animated on every element whose `style` or `fill` names `--cat-arcoiris` (and on a rainbow card face), and `--cat-arcoiris` is redefined there as `oklch(L C var(--rainbow-hue))`, so every consumer that takes a colour (dots, borders, SVG fills, `color-mix`) keeps working and cycles. The card face adds a conic spectrum edge and the swatch shows the whole spectrum, after React Bits' `GradientText` animated border (rejected as is: one rAF loop per element). It is last in the picker and the automatic pickers skip it. Under reduced motion it rests on violet.

## Risks / Trade-offs

- [Past cycles follow today's assignment] Moving "Alquiler" from Débito to Crédito also moves it in August's totals. → Accepted (D2): the widget answers "where does it go", and history per card arrives with the card on `transacciones`. Goes to *Deuda tecnica*.
- [A colour too light for white text even mixed] `blanco` in dark theme is `#F2F5F2`. → The mix towards black is per theme via `light-dark()`; the contrast test runs all 15 × 2 and fails the build of the spec if one is under 4.5:1.
- [`create` returning an id] Different from the other contracts. → Documented on the type; the alternative (two saves, or re-reading the list to find the new card) is worse.
- [`orden_widgets` grows by one id] Old clients writing four ids drop `'wallet'`. → `normalizeWidgetOrder` appends it back; harmless.
- [The stack with many cards] Ten cards make a tall widget. → Each band is 56px; acceptable for a widget the user fills by hand. Revisit with a fan/scroll if real use shows it.

## Migration Plan

1. Apply `0038_tarjetas.sql` to the real database by the MCP, with Brian's confirmation, before the deploy (`resumenMensual` selects `tarjeta_id` and `tarjetas`). Additive: the running code ignores the new table and column.
2. Deploy. Brian starts with no cards; the widget shows its empty state.
3. Rollback: revert the deploy; the table and column can stay. Dropping them is `drop table tarjetas cascade` (removes the FK) plus `alter table movimientos_recurrentes drop column tarjeta_id`.

## Open Questions

- Choosing the card while creating a fixed (the recurrence switch of a new expense): needs the card in `crear_movimiento_recurrente` or a `setCard` after an id it does not return. Deferred; assigning from either sheet afterwards covers it.
- Showing the card on the "Próximos cobros" row's muted line ("Vivienda · Débito · esperado 820 €"): a one-line change once `restyle-upcoming-charges-card` is archived.
