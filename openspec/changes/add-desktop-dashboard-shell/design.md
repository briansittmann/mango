## Context

See proposal.md → Why. What shapes the approach:

- One template (`components/templates/dashboard-template.tsx`, ~1690 lines) holds every piece of state (open cards `openIds`, `openSummary`, the three sheet states, reorder mode, `titleInView`) and every handler, and is mounted by `/demo` and `/dashboard` with the same `DashboardData` / `DashboardActions`. Desktop today (`modernize-dashboard-widgets` D5) is `lg:` classes over that DOM: a two-column grid, the widget `<div>` sticky with its own scroll, the phone's top bar widened to 1120px.
- Surfaces: `sheet-shell.tsx` (Base UI `Drawer`) is the bottom sheet for entry, category, recurring and account; `anchored` turns category, recurring and account into a popover from `sm`, placed from `document.activeElement` with no viewport clamp (the off-screen bug). `account-menu.tsx` is its own dialog, anchored from `sm` via `[aria-controls="account-menu"]`, also unclamped. The month picker is already an anchored popover inside `month-selector.tsx`.
- Materials: `liquid-glass` (dialogs: 32px blur, near-opaque gradient) and `glass-bar` (the scrolled top bar: 16px blur) in `app/globals.css`, both `light-dark()`. The reorder-mode scrim is `fixed inset-0 z-[35]`; the top bar is `z-30`; drawers `z-40/50`.
- Motion bar: `motion-skills/` (AUDIT.md values, recipies.md → *Dropdown, popover*, *Drawer / sheet*, *Drag to dismiss*, *Tab indicator*; Apple-desing.md §12 materials). Tokens already exist: `--ease-out`, `--ease-in-out`, `--ease-drawer`, `ease-spring`. `motion` (v13) is installed and used by `components/ui/counter/*`; `gsap` by `AnimatedContent`.
- Category reordering already has a drag + keyboard model (`category-reordering` spec, `dragVisual` in the template) and persists through `CategoryMutations.reorder`; widgets get the same shape of contract at a smaller scale.
- `DashboardData.user` is built in `lib/data/supabase/dashboard.ts` from the `usuarios` row; `ProfileMutations` (`lib/data/supabase/profile.ts`) updates that row under `usuarios_update_propio`. The demo mounts without `profile`.
- `modernize-dashboard-widgets` is at 25/26 and archives before this change starts; its *Desktop layout* (dashboard-ui) and *Wide viewports* (design-system) requirements are the baseline the deltas here modify.

## Goals / Non-Goals

**Goals:**
- Desktop reads as its own product: chrome, density and surfaces made for a pointer and a wide screen, while every figure, handler and sheet body is the phone's code.
- Nothing moves on the phone or the tablet (<1024px): same DOM order, same bars, same sheets.
- Every new motion has a purpose and a value from `motion-skills/`; none animates a layout property.
- Widget order is a per-user property with the same optimistic-then-revert contract the category order has.

**Non-Goals:**
- A second template or a route-level split (`/dashboard` stays one page; the shell is a breakpoint of the same template).
- A configurable grid (resizing, multi-column widget placement, hiding widgets).
- Inline editing on cards; the "Filtrar" control; a desktop onboarding; the landing's embedded demo frame (phone width, untouched).

## Decisions

### D1 — Two chromes in one DOM, switched by CSS; behaviour switched by one media-query hook
The sidebar and the desktop top bar render always and are `hidden lg:flex`; the phone bar, the cycle title block and the hero's fold control are `lg:hidden` / already resolved by `lg:` classes. CSS keeps hydration honest (the server does not know the viewport) and the extra DOM is a short list. Behaviour that cannot be CSS — sheets' presentation, cards' default open state, the tiles' click targets, drag enablement — reads one `useDesktop()` hook (`useSyncExternalStore` over `matchMedia('(min-width: 64rem)')`, server snapshot `false`), the same query `sheet-shell.tsx` polls today, lifted into `components/hooks/`. Alternative: a `DesktopDashboardTemplate` composed from the same organisms — duplicates ~400 lines of state and handler wiring and every future handler twice. Rejected.

Reorder mode (categories) keeps its `fixed` scrim at `z-[35]`; the sidebar and desktop bar sit at `z-30` so they are dimmed with the rest, and the mode's own bar stays `z-40`.

### D2 — Static → floating by `clip-path`, shadow by a sibling, trigger by a sentinel
Both shell surfaces are `position: fixed` boxes that never move: the sidebar `inset-y-0 left-0 w-[272px]`, the bar `top-0 right-0 left-[272px] h-[88px]` (the 16px of future inset is inside the box). Their content has constant padding, so it does not shift. The *material* is what changes:
- `clip-path: inset(0 round 0)` at rest → `inset(16px 0 16px 16px round 24px)` (sidebar) / `inset(16px 24px 0 8px round 999px)` (bar) when floating, `transition: clip-path 400ms var(--ease-out)`. `clip-path` is the sanctioned reveal property (AUDIT §8); `inset`/`top`/`height` would be layout.
- Background and border cross-fade over the same 400 ms (`background-color`, `border-color`: paint only). At rest: opaque `--card` with a hairline divider on the inner edge. Floating: `liquid-glass` values (the dialog tier: 32px blur, near-opaque). `backdrop-filter` is set from the start and not transitioned — over the resting page nothing scrolls beneath, so the blur is invisible until content moves under it (Apple §12: "materialize", and it avoids a filter transition in Safari).
- A shadow cannot cross a clip, so each surface has an `aria-hidden` sibling with the floating geometry, `liquid-glass`' outer shadow only, and `opacity 0 → 1` over 400 ms.
- Trigger: a 1px sentinel at the top of the content observed with `IntersectionObserver` (`rootMargin: '-16px 0px 0px 0px'`); `floating = !intersecting`. Not `scroll` events, not the phone's `titleRef` (the title is not rendered at `lg`). The phone bar keeps its own `titleInView` observer unchanged.
- Reduced motion: `transition: none`; both states still exist.
- Interruptibility: transitions, not keyframes, so scrolling back before 400 ms retargets (AUDIT §4).

Alternative: animating `inset` + `border-radius` on the real box over 300 ms — layout on every frame for two fixed elements; cheap in practice but it is exactly the pattern the audit flags, and the clip approach costs the same lines.

### D3 — Sidebar: section anchors, one moving indicator, scroll-spy by observer
- Entries: "Resumen" → the tile row; one entry per category in the displayed order (dot in `--cat-<colour>`, name, the card's total in `text-label-ui tabular-nums`); "Gráficos" → the widget list; under them the savings block (label, the cycle's net savings via `AnimatedAmount`, and the composition strip extracted from `free-margin-card.tsx` into `components/molecules/composition-strip.tsx`); at the bottom the account card (`Avatar` md, name, phone or nothing, a chevron) which opens `AccountMenu` anchored to it.
- Targets carry `scroll-margin-top: 104px` (bar 88px + 16px) so `scrollIntoView` and `scrollToCategory` land below the bar; clicking a category entry calls `scrollToCategory(id)` (it also opens the card).
- Scroll-spy: one `IntersectionObserver` over the targets with `rootMargin: '-104px 0px -55% 0px'`; the active entry is the last target whose top is above the line. `aria-current="true"` on the active link. The highlight is a single absolutely positioned pill behind the list moved with `transform: translateY()` over 250 ms `var(--ease-in-out)` and its text colour over the same time (recipies → *Tab indicator*); no per-item background transitions (tens-a-day tier, AUDIT §1).
- Category create/rename/delete/reorder flow through `data.expenses.groups`, so the list follows them with no extra state; entering reorder mode leaves the sidebar under the scrim.

### D4 — Tiles: a `tile` presentation of the two existing organisms, panels become side panels
- `FreeMarginCard` gets `presentation: 'card' | 'tile'`; the tile keeps the label, the amount (as the largest number on the page) and the "de X de ingresos" line, drops the strip (it lives in the sidebar at `lg`) and the fold control, keeps the brand gradient so it reads as the first tile.
- `SummaryGroup` gets `layout: 'accordion' | 'tiles'`. Tiles: each column is its own bordered card (`rounded-card border bg-card`) with label, total, the one-line caption (`income`: "N entradas"; `expenses`: "N categorías"; `savings`: the target or the accumulated balance), and the existing trend slot (still behind `SHOW_SUMMARY_TRENDS`). The whole tile is a `<button>` (`pressable`): income and savings open the **summary side panel** (`SheetShell` in side presentation whose body is the same `items[].panel` ReactNode the accordion renders, title = the column's label); expenses calls the existing "view all expenses" scroll. `openSummary` keeps its meaning (which panel is open) so the add rows, the undo toasts and `useFirstReveal` inside the panels are untouched.
- The row is `grid grid-cols-4 gap-stack` at `lg`; tiles share height through the grid.
- Alternative: keep the accordion in a 4-wide surface — a 1120px-wide panel of income rows under four tiles is the phone pattern stretched; a side panel is the desktop one and reuses the sheet shell.

### D5 — Side panels: a third presentation of `SheetShell`, and explicit, clamped anchors
`SheetShell` resolves `presentation` per render: `'sheet'` below `sm`; `'anchored'` from `sm` to `lg` when `anchored` is set; `'side'` at `lg` for every sheet (the `anchored` prop is ignored there). Side: `Drawer.Popup` is `fixed top-4 bottom-4 right-4 w-[440px]` (`max-w-[calc(100vw-2rem)]`), `liquid-glass`, `rounded-sheet`, `swipeDirection="right"`, entering with `transform: translateX(calc(100% + 1rem)) → 0` over 400 ms `var(--ease-drawer)` and leaving over 250 ms `var(--ease-out)` (asymmetric: the system's response snaps, AUDIT §4). The scrim stays (a modal task dims the page, Apple §12). The handle span is hidden; the header's leading/trailing/title grid is unchanged, so every sheet body renders as is. Base UI's `data-starting-style` / `data-ending-style` drive it, as today.

Anchored placement gets an `opener` prop (`RefObject<HTMLElement>`; falls back to `document.activeElement` only when absent) and a `placeAnchored(rect, panel)` helper in `lib/ui/anchor.ts`: `top = min(rect.bottom + 8, innerHeight - panelHeight - 16)`, `right = max(16, innerWidth - rect.right)`, and `transform-origin` set to the opener's side (`top right` or `bottom right` when flipped above). The helper is pure and unit-tested. `account-menu.tsx` uses the same helper; at `lg` its opener is the sidebar account card, so the menu opens above-right of it (`bottom-left` placement variant: `left = rect.left`, `bottom = innerHeight - rect.top + 8`). The month picker keeps its own placement (already clamped by `align`).

Alternative for the fix alone: clamp inside the existing `useLayoutEffect` and keep `activeElement` — fixes the off-screen case but not the `body` case (menu closes → sheet opens with nothing focused). The explicit ref costs one prop per caller.

### D6 — Widget order: a `WidgetId[]` on the user, an optional action, `motion` `Reorder` with a handle
- Contract: `lib/data/dashboard.ts` adds `export type WidgetId = 'weekly' | 'calendar' | 'monthly' | 'distribution'`, `DEFAULT_WIDGET_ORDER`, `DashboardData.user.widgetOrder: WidgetId[]` (always four, always valid: the reader normalises — unknown ids dropped, missing ones appended in default order) and `DashboardActions.setWidgetOrder?: (order: WidgetId[]) => Promise<void>`. Without the action the handles are not rendered (the landing's sample).
- Supabase: `0032_orden_widgets.sql` adds `usuarios.orden_widgets text[]` (nullable, no check: the reader normalises; a `check` on an enum of ids would have to change with every widget). `resumenMensual` maps it; `ProfileMutations` gains `setWidgetOrder` (`update({ orden_widgets })`), and `app/dashboard/actions.ts` exposes it; the page wires `actions.setWidgetOrder`. Demo: `useState` in `demo-dashboard.tsx` with `view.user.widgetOrder` derived from it; `?e2e=fail-widget-order` rejects, mirroring `failReorder`.
- Template: `displayedWidgetOrder` optimistic state; on drop or key press → `setWidgetOrder(next)`; on rejection revert and `setStatusMessage(t('ordenNoGuardado'))` — the category-reordering contract (*The order saves on drop and reverts on failure*), one level down.
- Drag: `Reorder.Group axis="y"` / `Reorder.Item` from `motion` (installed, no new dependency), `dragListener={false}` with `useDragControls()` started from a grip in each `WidgetHeader`'s trailing slot (so the charts' own hover/tap/keyboard stay theirs), `layout` spring `{ type: 'spring', duration: 0.5, bounce: 0.2 }` (AUDIT §4), the held item `scale: 1.02` with the dialog-tier shadow, `whileDrag` cursor `grabbing`. `transform` only; `ResponsiveContainer` inside is unaffected because widths do not change. Reduced motion: `layout={false}` and no scale — items jump (`design-system` → *Motion respects user preference*).
- Keyboard: the grip is a `<button>` named "Mover <widget>, posición N de 4"; Up/Down moves one slot, saves, keeps focus on the same grip, announces through the template's existing `aria-live` status (`statusMessage`). Only at `lg` (below, the list is not reorderable and the grip is hidden).
- Projection: the three hidden widgets stay hidden; the list renders the remaining one(s) in the saved order.

Alternative: `@dnd-kit/sortable` — one more dependency for four items; `motion`'s `Reorder` already brings the spring and layout model this change wants.

### D7 — "Añadir gasto" from the bar
The bar's primary button opens the entry sheet in create mode with `context.categoryId` = the first category and the header's category control enabled in create mode (today it is an edit-mode affordance from `expense-move`; the sheet already receives `categories`). The sheet's initial focus goes to the amount field. In a projected cycle the button stays, since projected cycles accept entries.

### D8 — Materials and tokens
Floating surfaces use the dialog tier of `liquid-glass` (near-opaque: text on them must keep 4.5:1 over anything scrolling behind, `design-system` → *Translucent materials*). Two new tokens in `globals.css`, both themes: `--shell-rest` (the resting surface, `--card`) and `--shell-divider` (the resting hairline). The side panel reuses `liquid-glass[role="dialog"]`. No new blur radii.

### D9 — Strings
New keys: `escritorio` namespace (`resumen`, `graficos`, `ahorroDelCiclo`, `cuenta`, `abrirMenuDeCuenta`, `contraerTodas`, `expandirTodas`, `nuevaCategoria`, `anadirGasto`, `moverWidget` with `{nombre}`, `{posicion}`, `{total}`, `widgetMovido`, `ordenNoGuardado`, `entradas` plural, `categoriasActivas` plural, `metaMensual`, `acumulado`) in `messages/es.json` and `messages/en.json`. Widget names reuse the `graficos` titles.

### D10 — React Bits through the shadcn MCP
Browse before 2.x with `search_items_in_registries` on `@react-bits` for sidebar/dock/nav and glass pieces (`Dock`, `GooeyNav`, `GlassSurface`, `StaggeredMenu`, `CardNav`) and decide per item, recorded at the top of this section as `modernize-dashboard-widgets` D12 did: ported by hand into `components/ui/` in the repo's style, or rejected with the reason. Expected outcome: nothing canvas/WebGL (marketing motion on a finance app, AUDIT §1); `GlassSurface` only if its SVG displacement reads better than `liquid-glass` on the floating sidebar in both themes — otherwise rejected.

### D11 — Tests
- Unit (`npm run test:unit`): `lib/ui/anchor.test.mjs` (clamping at the bottom and right edges, flip above, origin), `lib/data/widget-order.test.mjs` (normalisation of stored orders).
- Playwright on `/demo` at 1280px, Claude runs them (Chromium first, then the full matrix): `desktop-shell.spec.js` (chrome present, phone bar absent, static → floating on scroll and back, scroll-spy `aria-current`, sidebar click lands below the bar, categories list follows a rename), `desktop-tiles.spec.js` (four tiles in a row, equal height, income tile opens the side panel with the entries and the add row, expenses tile scrolls, no accordion), `desktop-sheets.spec.js` (entry/category/recurring/account as side panels from the right, dirty guard, Escape; account menu and month picker stay within the viewport when opened from the bottom of the screen), `widget-order.spec.js` (drag by the grip, keyboard move, announcement, persisted across a demo cycle switch, `?e2e=fail-widget-order` reverts with the status message, hidden on a projection for the absent widgets), `desktop-motion-a11y.spec.js` (reduced motion: no transforms on the shell, panels at rest in the first frame; axe in both themes; six-size rule; no element with `backdrop-filter` beyond the allowed list).
- Existing: `widgets-desktop.spec.js` — the sticky-column test is removed, the "entry sheet centred" test becomes the side-panel one; `recurring-motion-a11y`, `category-sheet-header` run at phone width and stay.

## Risks / Trade-offs

- [Cards open by default at `lg` differ from the server render] → `openIds` keeps its meaning; a second `closedIds` set applies only when `useDesktop()` is true, so the server and the first client frame render collapsed, and the switch to open happens before `AnimatedContent` reveals the cards (its cascade starts at 200 ms). Verify no `aria-expanded` hydration warning.
- [`clip-path` + `backdrop-filter` on the same fixed element in Safari] → the floating shadow lives on a sibling; if Safari drops the blur under a clip, the fallback is the sibling carrying the whole material and the clipped box carrying only the resting surface. Test in WebKit early (task 2.1).
- [Two `liquid-glass` surfaces overlapping (side panel over the floating bar)] → the panel is `z-50` and the scrim dims the shell; the shell drops its blur while a panel is open (`data-pushed-back`, as the phone bar does under reorder mode) so no light material sits on another (Apple §12).
- [`Reorder` with `recharts` inside] → the held item is transformed, not re-laid out; `ResponsiveContainer`'s observer fires nothing. If a chart repaints on every frame, `will-change: transform` on the item and `isAnimationActive={false}` (already) are the first knobs.
- [Grip focus during a keyboard move] → the item keeps its React key, so focus survives the reorder; verify on Firefox, which sometimes blurs on DOM moves.
- [The tile row at exactly 1024px: four tiles of ~230px] → the hero amount drops one size at `lg` and back up at `xl`, the captions truncate with an ellipsis, never wrap to a third line.
- [`usuarios_update_propio` has no column list] → `orden_widgets` joins the columns a user may write; harmless. Noted in `Deuda técnica`.
- [The widget column may be shorter than the breakdown] → it simply ends; no filler. The reverse (more widgets than cards) is the demo's case and also fine.
- [Scroll-spy with a short last section] → when the page cannot scroll a section to the line, the last entry is marked active once the page is scrolled to its end (`scrollY + innerHeight >= scrollHeight - 2`).
- [The sidebar at `lg` steals 272px from a 1024px screen] → the content column is `calc(100% - 272px)` with `px-6`; the two content columns become `minmax(0,1fr) minmax(320px,360px)` and the page's 1120px cap applies to the content, not the viewport.

## Migration Plan

1. Apply `0032_orden_widgets.sql` through the MCP, with confirmation, before the deploy (additive, nullable; the old code ignores the column).
2. Deploy. No data backfill: a null order is the default order.
3. Rollback: redeploy the previous build; the column stays and is harmless.

## Open Questions

- Whether "Próximos cobros" should join the widget list as a fifth reorderable item in a later change (it is a card with its own sheet, not a chart). Stays in the main column here; adding it is a list entry and a spec line.
