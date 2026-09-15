## Context

See proposal.md → *Why*.

### Audit

Measured on `/demo` at 390 × 844 in both themes, in Spanish, with a scratchpad Playwright script (bounding box and computed style):

| | Add income | Add savings movement | Add expense ("comida") |
|---|---|---|---|
| Row box | x 33, 324 × 48 | x 33, 324 × 48 | x 17, 356 × 48 |
| Parent padding | 16 / 16, bottom 12 (`px-4 pb-3` wrapper in the template) | same | none |
| Label | 16px/500, brand ink (`#4D6A0F` light, `#84CC16` dark) | same | same |
| State | disabled: 50 % opacity, `pointer-events: none` | same | same |

### Current code

- **`AddRow`** (`components/molecules/add-row.tsx`):
  - Classes: `pressable`, `min-h-row px-inset gap-3`, `Plus size-5`, inset hairline through `before:`.
  - No hover state.
  - Its siblings `ExpenseRow` and `SummaryRow` use `hover:bg-foreground/[0.04]`.
- **`pressable`** (`app/globals.css`):
  - `:active` applies `scale: var(--press-scale, 0.98)` and a 4 % foreground tint.
  - `:focus-visible` shows a 2px ring.
  - No transition under reduced motion.
- **Demo:** `app/demo/page.tsx` is a server component and passes only `changeLanguage`. *Controls without a handler are disabled* then disables the three add rows.
- **Tokens:**
  - `--brand`: `#149052` light / `#84CC16` dark
  - `--brand-ink`: `#4D6A0F` / `#84CC16`
  - `--primary-foreground`: `#0D110E`
  - `--ease-spring`
- **Guards in force:**
  - no literal colours and no JSX literals in `components/{atoms,molecules,organisms,templates}`
  - `grep -rln "'use client'" components/{atoms,molecules,organisms}` must return nothing (land-finance-dashboard 6.1)
  - downward-only imports

### External references

- **Tailwind 4** (context7, upgrade guide): `hover:` compiles inside `@media (hover: hover)`, so touch devices don't keep a sticky hover.
- **Apple HIG** (context7: Buttons, Pointing devices):
  - Custom buttons always include a press state.
  - The minimum hit region is 44 × 44pt.
  - Pointer hover effects use scale, tint or shadow.
  - Hover is an enhancement, not a requirement.

### Design skill

`.claude/skills/image-to-code-skill` is image-first, but this environment cannot generate images, so there are no reference renders.

Its component checklist (shape, radius, fill vs outline, icon, hover mood, hierarchy) and its anti-clutter rules (no nested boxes, no decorative pills or chips) drive D1 and D2. The before/after screenshots in the verification tasks serve as the visual reference.

### Observed drift (not addressed)

`components/molecules/demo-notice.tsx` declares `'use client'`, which the guard grep above forbids in molecules.

## Goals / Non-Goals

**Goals:**
- One component with identical geometry and states in all three places, measurable against the spec scenarios.
- Hover that is clearly visible on pointer devices and never sticks on touch.

**Non-Goals:**
- Hover for other `pressable` elements (card headers, summary columns, month controls).
- Real add flows, or adding rows in memory on the demo.
- Restyling the disabled look. After this change no page renders a disabled add row.
- Changing `DashboardActions`.

## Decisions

### D1 — Anatomy: a list row with a leading tinted badge

**Classes:**
- **Row:** keeps `pressable relative flex min-h-row w-full items-center gap-3 px-inset text-left`, plus the inset hairline (`before:left-4`).
- **Badge:** `grid size-7 shrink-0 place-items-center rounded-full`, with a `Plus size-4` icon at stroke width 2.5.
- **Label:** `text-body-lg font-medium text-brand-ink`.

**Geometry at 390px:**
- row: 356 × 48, flush with the surface's inner edges
- badge: 28px, starting at 16px
- label: starts at 56px

This is the add row of iOS inset-grouped lists (Contacts "add phone", Reminders "New Reminder"): a leading symbol and a tinted label, in line with the list.

*Alternatives rejected:*
- **Bare "+" glyph** (today): a weak affordance that, even when enabled, looks faded in light, and hover can only tint the row.
- **Tinted capsule button inside the panel:** a rounded shape inside the card (the skill's anti-nesting rule), heavier than the rows it serves.
- **Centred text button:** breaks the list's left alignment.
- **Dashed box:** already rejected in refine-mobile-ui-apple-hig D13.

### D2 — States and colours, tokens only

| State | Row | Badge | Plus | Motion |
|---|---|---|---|---|
| Rest | transparent | `bg-brand/15` | `text-brand-ink` | — |
| Hover (`hover:` / `group-hover:`, pointer devices only) | `bg-foreground/[0.04]`, same as sibling rows | `bg-brand` | `text-primary-foreground` | badge `scale 1.1` and plus `rotate 90°`, both 400ms `ease-spring`; colours 150ms ease-out |
| Pressed | 8 % foreground tint and row scale 0.98 (`pressable`, D3) | badge scale 0.9 | — | `pressable` spring |
| Focus-visible | `pressable` ring | — | — | — |
| Disabled | unchanged: `opacity-50`, no pointer events | — | — | — |

**Contrast** (WCAG relative luminance from token values; the contrast verification task measures the rendered colours):

| Pair | Light | Dark |
|---|---|---|
| Label on card | `#4D6A0F` on `#FFFFFF` ≈ 6.2:1 | `#84CC16` on `#131814` ≈ 9:1 |
| Plus on rest badge | ≈ 5:1 | ≈ 7:1 |
| Plus on hover badge | `#0D110E` on `#149052` ≈ 4.7:1 | `#0D110E` on `#84CC16` ≈ 9.7:1 |

**Why these choices:**
- **The badge fills on hover.** Sibling rows already tint on hover, so the fill is what marks this row as an action rather than data. Rotating the plus by 90° returns the same outline, so the turn shows only while it happens, and the fill carries the state.
- **The badge is tinted at rest.** Solid lime badges in every panel and card would compete with the one brand-coloured figure (`DESIGN.md` rule 1, refine D1).

*Alternatives rejected:*
- **Solid brand badge at rest** (the Contacts green circle): too loud when repeated across seven cards.
- **Shadow lift on hover:** `DESIGN.md` prefers tonal steps to shadows, and the theming spec forbids new glows.

### D3 — Press tint variable in `pressable`

`pressable`'s active background becomes `color-mix(in oklab, var(--foreground) var(--press-tint, 4%), transparent)`, and `AddRow` sets `[--press-tint:8%]`.

- **Why a variable:** `.pressable:active:not(:disabled)` has higher specificity than an `active:bg-*` utility, so a utility cannot override it. The pressed tint must exceed the 4 % hover tint.
- **Other callers:** they keep 4 %.

*Alternatives rejected:*
- **An `!important` active class:** it fights the utility.
- **A second press utility:** it duplicates `pressable`.

### D4 — Reduced motion

- **Badge:** its scale and the plus rotation are behind `motion-safe:`. The colour transitions stay.
- **Row:** under reduced motion `pressable` already removes its transition. The pressed scale still applies, instantly, as it does today.

### D5 — One component, no wrappers

- **Template:** renders `<AddRow>` directly as the last child of the income and savings panels, the same way `CategoryCard` does.
- **Corners:** both surfaces are `overflow-hidden` with rounded corners, so the hover and press tint is clipped to the bottom corners.
- **API:** unchanged (`label`, `onClick`).

### D6 — Demo handlers and transient message

- **Page:** `app/demo/page.tsx` stays a server component. It builds the data and renders `DemoDashboard` with `data` and the `changeLanguage` server action.
- **`app/demo/demo-dashboard.tsx`** (`'use client'`):
  - Holds `messageOpen` state and a timeout ref.
  - `addIncome`, `addExpense` and `addSavingsMovement` all call `showUnavailable()`. It opens the message and restarts a 2.5s timeout, which is cleared on unmount.
  - Renders `DashboardTemplate` with `notice={<DemoNotice />}`, followed by `<DemoToast open={messageOpen} />`.
- **`components/molecules/demo-toast.tsx`:**
  - Presentational, with no `'use client'`: it runs under the client wrapper, so the guard grep stays clean.
  - **Live region:** an always-mounted `<p role="status" className="sr-only">` whose text is `t('accionNoDisponible')` while open and empty otherwise. Screen readers announce each change.
  - **Visual:** an `aria-hidden`, `pointer-events-none` capsule fixed at the bottom centre: `bottom-[max(1rem,env(safe-area-inset-bottom))] z-40`.
    - Style: `rounded-full bg-foreground text-background px-4 py-2.5 text-body-sm font-medium`, with an `Info size-4` icon.
    - It always holds the text, so the exit fade keeps its content.
  - **Motion:**
    - Enter: opacity 0→1 and `translate-y` 12px→0, 500ms `ease-spring`.
    - Exit: 200ms ease-out.
    - `motion-reduce:`: opacity only.
  - **Material:** opaque and inverted, with no `backdrop-filter`. It stays inside the material allowlist, and the tokens swap per theme.
- **Message key:** `demo.accionNoDisponible`, matching the Spanish keys of the `demo` namespace:
  - es: "Esta acción no está disponible en la demo"
  - en: "This action isn't available in the demo"

*Alternatives rejected:*
- **A `demo` prop on the template:** it puts demo knowledge into the template that `/` will reuse.
- **Server-action handlers:** they cannot drive client UI feedback.
- **Scrolling back to `DemoNotice`:** it moves the viewport away from the tapped row.
- **Empty handlers:** the user chose visible feedback.

### D7 — `DESIGN.md`

Add a `### Add Rows` entry under *Components* with anatomy, states and contrast, in 3–4 bullets. Edit only that section: the file has uncommitted edits.

## Risks / Trade-offs

- **[A second `'use client'` entry in `app/demo/` contradicts land-finance "the template is the only entry"]** → It sits above the template and outside the guard's scope. The real dashboard route will not need it.
- **[While pressed, the 0.98 scale leaves a ~3.5px gap on each side inside the card]** → Card headers already behave this way with `pressable`. Accepted.
- **[The toast covers the bottom ~60px of content for 2.5s]** → It is non-interactive, lets pointer events through, and is brief.
- **[Hover media in headless Chromium]** → Hover scenarios run in a desktop context (`hover: hover`). The touch scenario runs in a `hasTouch` + `isMobile` context.
- **[`dashboard-ui` base requirements live in three unarchived changes]** → Archive `land-finance-dashboard`, `restyle-dashboard-to-v0` and `refine-mobile-ui-apple-hig` before this change.
- **[Uncommitted user edits in `dashboard-template.tsx`, `globals.css` and `DESIGN.md`]** → Partial edits only; never overwrite those files.

## Migration Plan

Visual and demo-only. No data, route or action-contract change.

Apply order:
1. CSS
2. Messages
3. Molecules
4. Template
5. Demo page
6. `DESIGN.md`
7. Verification

Rollback: revert the change's commits.
