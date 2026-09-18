## Context

See proposal.md → *Why*. Behaviour is defined in `specs/`. This section records the current code and the constraints the decisions rest on.

### Current code

- **Contract** (`lib/data/dashboard.ts`):
  - `ExpenseGroup` is `{ id, kind: 'fixed' | 'category', name, color, total, budget, expenses: { id, name, amount, date }[] }`.
  - Dates are ISO strings.
  - `DashboardActions` is a `Partial` of handlers that includes `addExpense(groupId)`.
- **Template** (`components/templates/dashboard-template.tsx`, the only `'use client'` component under `components/`):
  - owns UI state: open cards, open summary panel, account menu
  - renders `CategoryCard` per group with `onAddExpense`
- **Rows:**
  - `ExpenseRow` is a presentational `div` with a `<p>` name, `ShortDate` and `Money`, and no interaction.
  - `AddRow` is final (unify-add-action-rows).
- **Existing sheet:** `AccountMenu` hand-rolls a floating glass sheet:
  - `.liquid-glass[role="dialog"]`, `inset-x-3`, literal `rounded-[32px]`
  - a `bg-handle` pill and a `bg-scrim backdrop-blur-[8px]` scrim
  - Escape to close, `starting:` enter transitions, delayed unmount

  It has no focus trap, no swipe to dismiss and no virtual-keyboard handling.
- **Demo:**
  - `app/demo/page.tsx` (server) builds `buildDemoData(locale)` and renders `DemoDashboard` (client), which maps all three add handlers to a 2.5 s "not available" `DemoToast`.
  - Cycle 1–30 Sep 2026; budgets use `CURRENT_DAY = 10`.
  - Free margin = income − expenses − savings = 2 820 − 1 700 − 146 = 974.
- **Database:**
  - `transacciones.borrado_en timestamptz` exists, commented "never DELETE". The partial index `transacciones_usuario_fecha_idx` filters `borrado_en is null`.
  - `categoria_id` is `NOT NULL`, so the fixed group is not a category.
  - `gastos_fijos` has `activo` and no `borrado_en`.
  - RLS `transacciones_crud_propio` lets the owner update their rows.
  - There is no browser Supabase client (`lib/supabase/admin.ts` only).
- **Tokens:**
  - `--destructive` is `#B91C1C` light / `#EF4444` dark, and there is no destructive foreground token.
  - White on `#EF4444` is about 3.8:1, and `#EF4444` on the dark sheet glass about 3.9:1. Both fail 4.5:1 for text.
- **Guards** (land-finance-dashboard 6.1, still in force) apply to `components/{atoms,molecules,organisms,templates}`:
  - no literal colours, `aria-label` literals or JSX text
  - no `'use client'` in atoms, molecules or organisms
  - downward-only imports
  - `@/lib/data/*` imports for types only (ESLint `no-restricted-imports`)

### External references

- **Base UI 1.8.0** (`node_modules/@base-ui/react/docs/react/components/`):
  - **`Drawer`** (stable) extends `Dialog`:
    - swipe to dismiss (`swipeDirection`, default `down`)
    - focus trap, scroll lock and inert outside content (`modal`)
    - `onOpenChange(open, details)` with `details.reason` and `details.cancel()`
    - `Popup` `initialFocus` / `finalFocus`, `Portal` `keepMounted`
    - CSS variables `--drawer-swipe-movement-y`, `--drawer-swipe-strength` and `--drawer-swipe-progress`
    - attributes `data-starting-style`, `data-ending-style` and `data-swiping`
  - **`Drawer.VirtualKeyboardProvider`** keeps the focused field visible above software keyboards and exposes `--drawer-keyboard-inset`. Header and footer content should sit outside the scrolling body.
  - **Dialog focus default:** when opened by touch, the popup itself gets focus "to avoid opening the virtual keyboard". This sheet needs the opposite (D5).
  - **`Toast`:**
    - `Toast.createToastManager()` for use outside the provider's subtree
    - `Toast.Provider` with `limit` and `timeout`
    - `actionProps` for an action button
    - `priority` `low` (polite) or `high` (urgent)
    - an F6 landmark
    - `ToastViewport` pauses timers on mouse enter and on focus (checked in its source)
- **Apple HIG** (context7):
  - **Sheets:** Cancel on the leading edge and Done on the trailing edge of the top bar. Support swiping down to dismiss. Protect unsaved changes on dismissal.
  - **Undo:** show the result of an undo.
  - **Destructive actions:** red.
- **Design skill** (`.claude/skills/image-to-code-skill`): it is image-first, and this environment cannot generate images. As in earlier changes, its checklist applies (hierarchy, no nested boxes, no decorative pills, calm density), and screenshots are the visual reference.
- **Project memory:** motion must be clearly visible and modern in both themes, keep reduced-motion fallbacks, and be verified with screenshots.

### Conflicts recorded

| Source | Says | This change |
|---|---|---|
| `DESIGN.md` *Shapes*, *Bottom Sheets & Modals* | Top corners rounded, flat bottom against the device edge | Floating panel rounded on all corners, as ARCHITECTURE.md §9 and `AccountMenu`; `DESIGN.md` updated (D12) |
| ARCHITECTURE.md §9 *Edición en el lugar* | Tap the amount, edit inline, save on blur | Tap the row, edit in the sheet |
| ARCHITECTURE.md §9 *Menú de fila individual* | Edit amount · change category · delete | No row menu; changing category is out of scope |
| ARCHITECTURE.md §9 *Filas de gastos fijos* | Tapping a fixed row opens its configuration | Tapping edits this cycle's charge; the definition moves to the §7 screen (user decision) |
| Theming spec palette (`#C3E86B`, `#E5484D`) | Brand and danger hex values | Shipped tokens (`#149052`/`#84CC16`, `#B91C1C`/`#EF4444`) are used as-is; that drift is not touched |

## Goals / Non-Goals

**Goals:**
- One sheet component whose fields come from a configuration, so the §7 fixed-expense form becomes a second configuration.
- One operations interface, so demo and Supabase implementations swap without touching components.
- Gestures that feel native on iOS Safari and Android Chrome, with a keyboard and screen-reader path for every action.
- Every spec scenario measurable on `/demo` in es/en × light/dark.

**Non-Goals:**
- The Supabase implementation, auth, the real route, and `borrado_en IS NULL` filters in real queries (roadmap steps 2–3).
- The fixed-expense definition form (§7 dependency).
- Reorder mode, category changes, and income or savings flows.
- Migrating `AccountMenu` or `DemoToast` to Base UI.
- A desktop composition: the sheet stays a bottom panel at every width, at most 440px wide and centred.
- Committed Playwright specs (roadmap step 7). Verification uses scratchpad scripts, as in earlier changes.
- Editing ARCHITECTURE.md.

## Decisions

### D1 — One operations interface, injected by the page

`lib/data/expenses.ts` holds types only in this change; the Supabase implementation will be added to this file later:

```ts
/** A calendar day in the user's time zone: 'YYYY-MM-DD'. */
export type LocalDate = string

export type ExpenseDraft = {
  amount: number        // > 0, at most two decimals
  description: string   // trimmed; '' means none
  date: LocalDate
}

export type ExpenseMutations = {
  create(categoryId: string, draft: ExpenseDraft): Promise<void>
  update(expenseId: string, draft: ExpenseDraft): Promise<void>
  softDelete(expenseId: string): Promise<void>
  restore(expenseId: string): Promise<void>
}
```

**Changes to `lib/data/dashboard.ts`:**
- `DashboardActions` loses `addExpense` and gains `expenses: ExpenseMutations`. It stays inside the `Partial`, so a page supplies all four operations or none.
- `DashboardData.cycle` gains `today: LocalDate`.
- `Expense` is exported as the element type of `ExpenseGroup.expenses`, where `name: ''` means no description.
- For `kind: 'category'`, `ExpenseGroup.id` is the category id that `create` receives. This is documented on the type.

**Semantics every implementation honours** (the specs state the observable part):
- A promise resolves once the change is durable and rejects with nothing changed.
- `update` writes amount, description and date only. It never writes `categoria_id`, `tipo`, `es_fijo`, `gasto_fijo_id` or `gastos_fijos`.
- `softDelete` and `restore` only set or clear `borrado_en`; `DELETE` is never issued.
- After a promise resolves, the implementation makes sure the page receives fresh `DashboardData`: the demo updates React state, and Supabase will refresh. Components never refetch.

**Supabase implementation (later change, recorded so the signatures hold):**
- `create` inserts `usuario_id`, `monto`, `moneda` (the user's currency), `fecha` (the local day at noon in `user.timezone`, as a timestamptz), `categoria_id`, `descripcion` (`description || null`), `tipo: 'gasto'` and `es_fijo: false`.
- `update` patches `monto`, `descripcion` and `fecha`.
- `softDelete` and `restore` set `borrado_en` to `now()` or `null`.
- RLS already scopes every write to the owner.
- Every read filters `borrado_en is null`, except `messageAlreadyProcessed`, which skips that filter on purpose.

*Alternatives rejected:*
- **Four loose handlers in `DashboardActions`:** there is no single object to swap, and nothing keeps the four together.
- **Returning the saved record:** no caller needs it, because fresh data arrives through props.
- **A Supabase implementation now:** there is no session or browser client to run it against (user decision).

### D2 — One sheet, fields from a configuration

The organism lives in `components/organisms/entry-sheet.tsx`. It renders field rows by walking an ordered descriptor list; each descriptor's `kind` picks the control, the parser and the value type. Layout, focus, validation, and the pending and error states live in the organism once.

```ts
type FieldKind = 'amount' | 'text' | 'date'        // the §7 change adds 'dayOfMonth' | 'category'

type FieldDescriptor<V> = {
  name: keyof V & string      // amount → number, text → string, date → LocalDate
  kind: FieldKind
  labelKey: string            // key in the `hojaGasto` messages namespace
  placeholderKey?: string
  optional?: boolean
}

export type EntryConfig<V> = {
  fields: FieldDescriptor<V>[]           // rendered in this order
  initialFocus: keyof V & string
  titleKeys: { create: string; edit: string }
  submitKeys: { create: string; edit: string }
  deleteKey: string
}

export const expenseEntry: EntryConfig<ExpenseDraft> = {
  fields: [
    { name: 'amount', kind: 'amount', labelKey: 'importe' },
    { name: 'description', kind: 'text', labelKey: 'descripcion', placeholderKey: 'opcional', optional: true },
    { name: 'date', kind: 'date', labelKey: 'fecha' },
  ],
  initialFocus: 'amount',
  titleKeys: { create: 'nuevoGasto', edit: 'editarGasto' },
  submitKeys: { create: 'anadir', edit: 'guardar' },
  deleteKey: 'eliminarGasto',
}

type EntrySheetProps<V> = {
  config: EntryConfig<V>
  open: boolean
  onOpenChange(open: boolean): void
  mode: 'create' | 'edit'
  context: { kind: 'category'; name: string; color: CategoryColor } | { kind: 'fixedCharge' }
  initialValues: Partial<V>              // create: { date }; edit: every field
  fieldOptions: { amount?: { currency: string }; date?: { min: LocalDate; max: LocalDate } }
  initialFocusRef: RefObject<HTMLInputElement | null>   // D5
  onSave(values: V): Promise<void>
  onDelete?(): Promise<void>             // passed only in edit mode; renders the delete row
}
```

For reference only, the §7 change would add:

```ts
fixedExpenseEntry = { fields: [name (text), amount, dayOfMonth, category], initialFocus: 'name', … }
```

plus the `dayOfMonth` and `category` kinds and `fieldOptions.category`.

*Alternatives rejected:*
- **A variant switch inside the sheet:** every new entry type would edit the sheet's markup.
- **Callers passing children:** each caller rebuilds the rows, and the "same layout" guarantee is lost.
- **Two sheets:** explicitly ruled out by the user.

### D3 — Shell: Base UI Drawer styled as the §9 floating glass panel

```
Drawer.Root modal swipeDirection="down" open onOpenChange
  Drawer.VirtualKeyboardProvider
    Drawer.Portal keepMounted
      Drawer.Backdrop    bg-scrim backdrop-blur-[8px]; opacity × (1 − --drawer-swipe-progress)
      Drawer.Viewport    fixed inset-0 flex items-end justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
        Drawer.Popup     liquid-glass rounded-sheet w-full max-w-[440px] max-h-[calc(100dvh-1.5rem)] flex flex-col
                         translate-y(--drawer-swipe-movement-y); starting/ending: translate-y(calc(100%+1.5rem))
          handle         aria-hidden, h-1 w-9 rounded-full bg-handle, 10px from the top
          header         outside the scroll body (VirtualKeyboardProvider guidance)
          form           Drawer.Content overflow-y-auto: alert slot, field rows, [divider + delete row]
```

**Material:**
- `Drawer.Popup` renders `role="dialog"`, so the existing `.liquid-glass[role="dialog"]` variant applies. It provides:
  - an 88/74 % tint
  - `blur(32px) saturate(180%)`
  - a 1px light border
  - an `inset 0 1px 0` highlight (the stronger top edge)
  - a soft drop shadow
- No new material is added.

**Radius:** `--radius-sheet` (28px). `AccountMenu`'s literal 32px is recorded, not changed.

**Motion:** enter over 500ms `ease-spring`; exit over `calc(var(--drawer-swipe-strength) * 400ms)` `ease-in`; `motion-reduce:transition-none`.

**Dismissal**, through `onOpenChange(false, details)`:
- while saving or deleting, `details.cancel()` for every reason
- while the form differs from its initial values, `details.cancel()` for the outside-press and swipe reasons (names taken from `Drawer.Root.ChangeEventReason`)
- Escape and "Cancelar" (`Drawer.Close`) always close

**Focus return:** a `finalFocus` function returns the opener when it is still connected, otherwise the card header.

**Swipe conflicts:** inputs carry `data-base-ui-swipe-ignore`, so selecting text never drags the sheet.

*Alternatives rejected:*
- **Copying `AccountMenu`'s shell:** the focus trap, swipe dismissal and keyboard handling would all be hand-written.
- **`Dialog`:** it has no swipe dismissal.
- **Extracting a shared sheet from `AccountMenu`:** refactors a finished component outside scope.

### D4 — Header, fields, delete row and states

Layout at 390px (panel 366px wide):

```
╭──────────────────────────────────────────╮
│                  ────                    │ handle
│ Cancelar       Nuevo gasto      [Añadir] │ header, min-h-14
│                 ● Comida                 │ caption, body-sm, muted
│ Importe                     [ 12,50 € ]  │ 56px, amount chip
│ ──────────────────────────────────────── │ inset hairline
│ Descripción                [ Panadería ] │ 48px
│ ──────────────────────────────────────── │
│ Fecha                   [ 10 sept 2026 ] │ 48px
│══════════════════════════════════════════│ edit only: full-width divider
│ 🗑  Eliminar gasto                        │ edit only: 48px destructive row
╰──────────────────────────────────────────╯
```

**Header:** `grid grid-cols-[1fr_auto_1fr] items-center px-4` (centred title, as in HIG sheets).
- **Cancel:** `Drawer.Close` as text, `text-body-lg text-foreground`, `min-h-target`, `pressable`.
- **Title and caption:** `Drawer.Title` in `font-display text-headline-sm`. `Drawer.Description` holds the caption:
  - category context: `CategoryDot` + name
  - fixed charge: `t('dashboard.gastosFijos')` · `t('hojaGasto.soloCargoDelMes')`
- **Primary:** a `type="submit"` pill, `h-9 px-4 rounded-full bg-primary text-primary-foreground font-semibold`, inside a `min-h-target` hit area.
  - While disabled it uses `bg-muted text-muted-foreground`, not reduced opacity (labels stay fully opaque).
  - While pending, a spinner replaces the label and the accessible name is kept.

**Field rows** (`components/molecules/field-row.tsx`):
- `<label>` on the leading side and the control on the trailing side
- `min-h-row` (the amount row `min-h-14`)
- an inset hairline like the other lists
- no grouping container, so no rounded surface sits inside the panel

Each editable value sits on a `bg-muted rounded-lg` chip, the same affordance as the row amounts (D7):
- **Amount:** `<input inputMode="decimal" enterKeyHint="done" autoComplete="off">` in `text-tabular-numeric-lg`, right-aligned.
  - The currency symbol is placed before or after it according to `Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1)`, as `Money` already does.
  - Edit prefill uses `minimumFractionDigits: 2, trailingZeroDisplay: 'stripIfInteger', useGrouping: false`, giving `67,60` and `180`.
  - The parser accepts `^\d{0,10}([.,]\d{0,2})?$` with at least one digit and a value above 0.
- **Description:** `<input type="text" enterKeyHint="done" autoCapitalize="sentences">` in `text-body-lg`, with the placeholder in `text-muted-foreground`.
- **Date:** the chip shows `format.dateTime` (`day: numeric, month: short, year: numeric`, `timeZone: 'UTC'` on the local date).
  - A transparent native `<input type="date" min max required>` is stretched over the chip. On touch devices it opens the platform picker directly; on pointer devices `onClick` calls `showPicker()` inside a `try`.
  - The native input is the labelled control for assistive technology.
- **Field error:** `text-body-sm text-destructive-ink` under the amount row, linked through `aria-describedby`, with `aria-invalid` on the input. It appears after blur.

**Delete row (edit only):**
- a full-width `border-t border-border` divider
- a `min-h-row` button: `flex items-center gap-3 px-4 text-body-lg font-medium text-destructive-ink`
- `Trash2 size-5` icon
- `hover:bg-destructive/[0.08]`, with an active tint slightly stronger

**Form states:**

| State | Primary | Fields | Close by Cancel/Escape | Close by scrim/swipe | Delete row | Message |
|---|---|---|---|---|---|---|
| Amount empty or invalid | disabled | editable | yes | only if unchanged | enabled | field error after blur |
| Ready | enabled | editable | yes | only if unchanged | enabled | — |
| Saving | spinner | `readOnly`, form `aria-busy` | no | no | disabled | — |
| Deleting | disabled | `readOnly`, form `aria-busy` | no | no | spinner | — |
| Save failed | enabled | values kept | yes | only if unchanged | enabled | `role="alert"`: `errorGuardar` |
| Delete failed | enabled | values kept | yes | only if unchanged | enabled | `role="alert"`: `errorEliminar` |

There is no loading state on open: the sheet receives every value synchronously.

The form alert is `rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink`, placed at the top of the form.

### D5 — Opening with the amount focused and the keypad up

iOS Safari raises the software keyboard only when `focus()` runs inside the user's gesture. Base UI moves initial focus after the popup opens and, for touch, deliberately focuses the popup instead.

1. `Drawer.Portal keepMounted` keeps the form, including the amount input, in the DOM while the sheet is closed (hidden and inert).
2. The template's open handler runs inside the tap handler:
   - `flushSync(() => setSheet({ open: true, target }))`
   - then `initialFocusRef.current?.focus({ preventScroll: true })`
   - in edit mode, also `select()`
3. `Popup initialFocus={initialFocusRef}` covers mouse and keyboard openings, and any case where step 2 had no effect.
4. `VirtualKeyboardProvider` keeps the focused row above the keyboard. The header, which holds the primary action, stays at the top of the panel.

**Spike before building the form** (task 1.2): confirm the input is `document.activeElement` right after the tap in WebKit emulation, and that the keypad appears on a real iPhone. If step 2 fails because Base UI un-hides the kept-mounted popup in an effect, use a focus proxy instead:
- the tap handler focuses a visually hidden `inputMode="decimal"` input rendered by the template
- `initialFocus` then moves focus to the amount field; iOS keeps the keyboard up when focus moves between inputs

*Alternatives rejected:*
- **Focusing in an effect:** no keyboard on iOS.
- **`autoFocus`:** it is applied at mount, and the input is already mounted.

### D6 — Swipe to delete: pointer events, no library

`components/molecules/swipe-to-delete.tsx` wraps a row's content:

```
Collapsible open={!removing}                           existing atom, collapses the row after it slides out
  div.relative.overflow-hidden
    div.absolute.inset-y-0.right-0.bg-destructive-fill  width = max(panel, −offset); inert + aria-hidden while closed
      button                                            Trash2 + t('hojaGasto.eliminar'), text-destructive-fill-foreground text-label-ui;
                                                        sits at the row's trailing edge once past 60 %
    div.relative.bg-card                                translate: offset px; shadow on the trailing edge while offset ≠ 0
      {row button}
```

**Gesture:**
- **Pointer down:** record the start. The row has `touch-action: pan-y`, so the browser keeps vertical scrolling.
- **Intent lock at 10px:** the drag is horizontal when `|dx| > |dy|`, and then `setPointerCapture` is called. A vertical gesture is ignored for the rest of its life; the browser scrolls and sends `pointercancel`.
- **Move:** `offset = clamp(startOffset + dx, −width, 0)`. The armed state starts at `offset < −0.6 × width`.
- **Release:**
  - armed → delete
  - `offset < −panel / 2` → open (`offset = −panel`, where `panel = max(0.25 × width, 44)`)
  - otherwise → close
- **Click after a horizontal drag:** swallowed, so the row doesn't open the sheet.
- **While open:** a document `pointerdown` outside the row, or a window `scroll`, closes it. Tapping the row closes it and swallows the click. Swiping another row counts as an outside press, so only one row stays open.
- **Settling:** `transition: translate 450ms var(--ease-spring)`, not applied while dragging. The shadow is `12px 0 24px -12px var(--sheet-shadow)`.

**Deleting:**
1. Slide to `translate: -100%` over 220ms `ease-in`.
2. Collapse over 250ms (the `Collapsible` curve).
3. `await onDelete()`. On rejection, reset the offset and re-open the `Collapsible`. On resolution the parent's data drops the row.

Under reduced motion both animations are skipped and `onDelete` runs immediately.

**Rows appearing:** new and restored rows expand in, through `starting:grid-rows-[0fr]` on their `Collapsible` (motion-safe only).

*Alternatives rejected:*
- **A gesture library:** a new dependency that fights the token and motion system. Base UI has no swipeable row.
- **Horizontal scroll-snap rows:** detecting the long swipe and keeping one row open are awkward, and nested scrollers misbehave on iOS.

### D7 — Rows and cards

**`ExpenseRow`:**
- With `onActivate` it renders a `button type="button"`; without it, a `div` as today. The button holds block `span`s, because `<p>` is not valid inside a button.
- The accessible name is the visible name, date and amount.
- The row keeps `hover:bg-foreground/[0.04]` and `pressable`.
- The amount is `rounded-lg bg-muted px-2 py-0.5` when the row is interactive, and plain otherwise. `bg-muted` is lighter than the card in dark (`#19201A` on `#131814`) and a soft tint in light (`#E8EFE8` on white).

**`CategoryCard`** gains `onEditExpense?(expense)` and `onDeleteExpense?(expense): Promise<void>`:
- It passes `name={expense.name || cardName}`.
- It wraps rows in `SwipeToDelete` only when `onDeleteExpense` is given.
- It renders `AddRow` only for `kind === 'category'`. The prop stays optional, so a page without operations still gets the disabled row.

### D8 — Template orchestration and the undo toast

**Sheet state:**

```ts
type SheetTarget =
  | { mode: 'create'; group: ExpenseGroup }
  | { mode: 'edit'; group: ExpenseGroup; expense: Expense }
const [sheet, setSheet] = useState<{ open: boolean; target: SheetTarget | null }>({ open: false, target: null })
```

The target is kept while closing, so the exit animation still shows content (the same approach as `SummaryGroup`).

**Values and limits:**
- `initialValues.date` for create is `clamp(cycle.today, cycle.start, cycle.end)`.
- The date range is `cycle.start` to `cycle.end`.
- An expense's local day comes from `new Intl.DateTimeFormat('en-CA', { timeZone: user.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(expense.date))`. That is one line of formatting in the component that needs it; there is no `lib` helper until a second consumer exists.
- `context` is `{ kind: 'category', … }` for category groups and `{ kind: 'fixedCharge' }` for the fixed group.

**Handlers:**
- `onSave`:
  - create → `actions.expenses.create(group.id, draft)`
  - edit → `actions.expenses.update(expense.id, draft)`
  - on success: close, then write `gastoAnadido` or `cambiosGuardados` into an `sr-only` `role="status"` node
- `onDelete` (sheet): `softDelete(expense.id)`, then close, then `showUndo(expense)`.
- Row delete: `softDelete(expense.id)`, then `showUndo(expense)`.

**Toasts:**
- `const toasts = useMemo(() => Toast.createToastManager(), [])`.
- The template's root is wrapped in `<Toast.Provider toastManager={toasts} limit={1} timeout={5000}>`. The template sits outside its own provider, which is why it uses a manager rather than the hook.
- `showUndo` closes the previous toast, then calls `toasts.add` with:
  - `title: t('gastoEliminado')`
  - `priority: 'low'`
  - `actionProps: { children: t('deshacer'), onClick: undo }`
- `undo` awaits `restore(id)`. On success it closes the toast; on failure it calls `toasts.update` with `title: t('errorDeshacer')`, `priority: 'high'` and no action.
- A rejected `softDelete` adds a toast with `title: t('errorEliminar')` and `priority: 'high'`.

**`components/molecules/undo-toast.tsx`** renders `Toast.Portal` › `Toast.Viewport` › each toast from `Toast.useToastManager()`:
- **Position:** `fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center`, below the sheet's z-50.
- **Capsule:** opaque and inverted, like `DemoToast`: `rounded-full bg-foreground text-background pl-4 pr-1 min-h-11 text-body-sm font-medium`.
- **Action:** `font-semibold text-background`, `min-h-target px-3 rounded-full hover:bg-background/10`, after a `bg-background/20` hairline. A brand-coloured action would fail contrast on the inverted capsule: `#84CC16` on `#F3F4F6` is about 1.8:1.
- **Motion:** in with `translate-y` 12px→0 over 500ms `ease-spring`, out over 200ms, `motion-reduce:` opacity only.

### D9 — Demo implementation behind the interface

`lib/demo/demo-expenses.ts`:

```ts
export type DemoExpenseEdits = {
  created: { id: string; categoryId: string; draft: ExpenseDraft }[]
  updated: Record<string, ExpenseDraft>
  deletedIds: string[]                                   // the demo's borrado_en: rows stay, flagged
}
export const noDemoEdits: DemoExpenseEdits
export function deriveDemoData(base: DashboardData, edits: DemoExpenseEdits): DashboardData
export function createDemoExpenseMutations(setEdits: Dispatch<SetStateAction<DemoExpenseEdits>>): ExpenseMutations
```

**`deriveDemoData`** is pure:
1. For each group, apply `updated` (name, amount, and date as `${date}T12:00:00Z`), append `created` rows to their category, and drop `deletedIds`.
2. Recompute:
   - group `total`
   - `budget`, through `getBudgetStatus` with `currentDay` and `cycleDays` taken from `cycle.today`, `start` and `end`
   - `expenses.total`
   - the current month's `history` entry
   - `freeMargin = income.total − expenses.total − savings.cycle`

`buildDemoData` builds the sample rows, sets `cycle.today = '2026-09-10'`, and returns `deriveDemoData(sample, noDemoEdits)`. One derivation serves the initial render and every edit, so the formulas cannot drift apart.

**`createDemoExpenseMutations`** returns the four operations. Each applies a functional `setEdits` and returns `Promise.resolve()`:
- `restore` removes the id from `deletedIds`.
- Created ids come from a module counter (`demo-new-${n}`), not `crypto.randomUUID()`, which is missing over plain-HTTP LAN addresses when testing on a phone.

**`app/demo/demo-dashboard.tsx`:**
- `const [edits, setEdits] = useState(noDemoEdits)`
- `const view = useMemo(() => deriveDemoData(data, edits), [data, edits])`
- `const expenses = useMemo(() => createDemoExpenseMutations(setEdits), [])`
- `actions={{ changeLanguage, expenses, addIncome: showUnavailable, addSavingsMovement: showUnavailable }}`

Edits are keyed by row id and applied over the server-built `data`. A language switch brings a new `data` through `router.refresh()`, and the edits are re-applied: untouched sample rows switch language and typed text stays.

*Alternatives rejected:*
- **Keeping a mutated copy of `DashboardData` in state:** a language switch would drop the edits or keep old-language names.
- **An external store with `useSyncExternalStore`:** more code for one page.
- **Simulated latency in the demo:** the demo should feel instant. Pending and failure states are verified through a temporary harness route (tasks 7.3).

### D10 — Messages

New `hojaGasto` namespace, with Spanish keys like the existing namespaces. `messages/parity.ts` enforces that both files have the same keys.

| Key | es | en |
|---|---|---|
| `nuevoGasto` | Nuevo gasto | New expense |
| `editarGasto` | Editar gasto | Edit expense |
| `cancelar` | Cancelar | Cancel |
| `anadir` | Añadir | Add |
| `guardar` | Guardar | Save |
| `importe` | Importe | Amount |
| `descripcion` | Descripción | Description |
| `opcional` | Opcional | Optional |
| `fecha` | Fecha | Date |
| `importeInvalido` | Introduce un importe mayor que 0 con hasta 2 decimales | Enter an amount above 0 with up to 2 decimals |
| `soloCargoDelMes` | Solo el cargo de este mes | This month's charge only |
| `eliminarGasto` | Eliminar gasto | Delete expense |
| `eliminar` | Eliminar | Delete |
| `gastoEliminado` | Gasto eliminado | Expense deleted |
| `deshacer` | Deshacer | Undo |
| `gastoAnadido` | Gasto añadido | Expense added |
| `cambiosGuardados` | Cambios guardados | Changes saved |
| `errorGuardar` | No se pudo guardar. Inténtalo de nuevo. | Couldn't save. Try again. |
| `errorEliminar` | No se pudo eliminar el gasto | Couldn't delete the expense |
| `errorDeshacer` | No se pudo deshacer | Couldn't undo |

`demo.accionNoDisponible` stays; it is still used by the income and savings add rows.

### D11 — Tokens

Added to `:root` in `app/globals.css`, and mapped in `@theme inline` as `--color-destructive-ink`, `--color-destructive-fill` and `--color-destructive-fill-foreground`:

```css
--destructive-ink: light-dark(#B91C1C, #F87171);   /* delete text on glass: ≈ 6.4:1 light, ≈ 5.3:1 dark */
--destructive-fill: light-dark(#B91C1C, #DC2626);  /* swipe panel */
--destructive-fill-foreground: #FFFFFF;             /* ≈ 6.5:1 and ≈ 4.8:1 on the fill */
```

The values are estimates from token colours. The contrast task measures the rendered colours and adjusts them if a pair fails. `--destructive` itself stays unchanged, because the budget states depend on it.

### D12 — `DESIGN.md`

Edit only these sections:
- **Shapes (bottom sheets bullet) and *Bottom Sheets & Modals*:**
  - floating panel with 12px margins plus the safe area
  - `--radius-sheet` on all corners
  - handle 36 × 4px, 10px from the top
  - header with Cancel, title and caption, and the primary action
  - destructive action last, after a divider
- **Materials:** the entry sheet joins the allowlist.
- **New *Swipe Actions* entry:** anatomy, the quarter-width panel, the 50 % and 60 % thresholds, contrast.
- **New *Undo Toast* entry:** inverted capsule, 5 s with pause, one at a time, contrast.

## Risks / Trade-offs

- **[iOS may not raise the keypad even with focus inside the tap, if Base UI un-hides the kept-mounted popup in an effect]** → Spike first (task 1.2); the focus-proxy fallback is in D5. Playwright cannot show a software keyboard, so the keypad check needs a real iPhone. If none is available, the task records it as unverified.
- **[`touch-action: pan-y` with pointer capture differs across iOS versions; a diagonal drag could both scroll and swipe]** → 10px intent lock; checks in a `hasTouch` context and on a device.
- **[A deleted row slides out before the operation resolves]** → On rejection the row returns and an alert explains. The demo resolves immediately.
- **[With a remote source, a collapsed row can disappear before the totals refresh]** → A brief inconsistency, accepted. The demo is synchronous.
- **[The exit animation delays the soft-delete call by about 470ms]** → Acceptable. Reduced motion calls immediately.
- **[Only the latest deletion is undoable from the toast]** → The usual toast pattern. Earlier deletions are soft, so the data is recoverable later.
- **[The undo toast and the demo "not available" toast share the bottom centre]** → Different triggers, both short. Accepted.
- **[A kept-mounted portal adds hidden DOM]** → One sheet for the whole dashboard, inert while closed.
- **[`AccountMenu` uses `text-destructive` on glass (about 3.9:1 in dark) and a literal 32px radius]** → Recorded, not fixed (Open Questions).
- **[The demo stores noon UTC; the Supabase implementation must convert the local day in `user.timezone`]** → Written into D1 for that change.
- **[The MODIFIED requirements build on four unarchived changes, and `restyle-dashboard-to-v0` is at 17/20]** → Archive order is in the proposal. Close tasks 6.1–6.3 of that change first (CLAUDE.md roadmap step 1).

## Migration Plan

Front end and demo only: no schema, route or dependency change. The `DashboardActions` change is internal; its only consumers, the template and the demo wrapper, are updated in this change.

Apply order:
1. Baseline and keypad spike
2. Contract types
3. Demo derivation and operations
4. Tokens and messages
5. Molecules
6. Organism
7. Card and template
8. Demo wiring
9. Docs
10. Verification

Intermediate commits may render the demo without editing; nothing breaks between steps. Rollback: revert the change's commits.

## Open Questions

- ARCHITECTURE.md §9 (*Edición en el lugar*, *Menú de fila individual*, *Filas de gastos fijos*) still describes inline editing and a row menu. That document can be updated after implementation without changing these specs or tasks.
- `AccountMenu`'s literal 32px radius and `text-destructive` on glass differ from this sheet's tokens. Aligning them is a separate clean-up.
