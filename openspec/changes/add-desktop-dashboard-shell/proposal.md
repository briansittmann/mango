## Why

On a laptop the dashboard is still the phone's page made wider: the phone's top bar, the phone's accordion of summary tiles, every card collapsed, and the four chart widgets pinned in a sticky column that scrolls on its own. Someone on a phone wants a glance on the go; someone who sits down at a desk wants to look at everything at once and configure it. Two of the sheets (category, recurring definition) can also land off-screen on a laptop, because the anchored popover is placed from `document.activeElement` without clamping to the viewport. Fase 2 opens Mango to other people, and the desk is where they will set their categories, budgets and fixed charges up.

## What Changes

- **A desktop shell at ≥1024px**: a left sidebar (logo, "Resumen", one entry per category with its colour dot, "Gráficos", a small savings summary, and an account card at the bottom that opens the account menu) and a top bar (previous/next cycle and month, the "en curso" / "proyección" status pill, "Añadir gasto"). Both start flush with the page edges and, once the page is scrolled, detach into floating frosted-glass surfaces (`liquid-glass`), with the same trigger the phone bar uses today. The sidebar highlights the section in view and a click scrolls to it. The phone's top bar and the cycle title under it are not rendered at this width.
- **One page scroll**: the widget column no longer sticks or scrolls on its own; the expense breakdown and the widget column scroll together with the page. Below 1024px nothing changes.
- **Four stat tiles in one row**: free margin, income, expenses and savings, equal height, each with its label, total and one line of context. The phone's one-panel-at-a-time accordion is not used on desktop: activating the income or savings tile opens its panel (entries or movements plus the add row) as a side panel; activating the expenses tile scrolls to the breakdown.
- **Breakdown ready to work on**: on desktop every category card starts open, and the section header carries "Contraer todas" / "Expandir todas" and "Nueva categoría".
- **Widgets you can arrange**: the four chart widgets are a vertical list that can be reordered by dragging (and by keyboard); the order is saved per user and the demo keeps it in memory.
- **Side panels instead of bottom sheets**: at ≥1024px the entry, category, recurring and account sheets slide in from the right edge as a frosted-glass panel. The account menu and the month picker stay anchored popovers, placed from an explicit opener and clamped to the viewport, which also fixes the off-screen sheets.
- **Motion**: static-to-floating transition, side panels, scroll-spy highlight and widget drag follow `motion-skills/` (durations, easings, reduced motion); React Bits is browsed through the shadcn MCP and ported by hand where a piece earns it.
- Not in this change: inline editing of amounts on the cards, a "Filtrar" control, any change to the phone or tablet layout, moving "Próximos cobros", reordering categories outside their existing mode.

## Capabilities

### New Capabilities
- `desktop-shell`: the dashboard at ≥1024px — sidebar and top bar, their static and floating states, scroll-spy, the stat-tile row, the two scrolling columns, side panels, and the reorderable, persisted widget order.

### Modified Capabilities
- `dashboard-ui`: *Desktop layout* (replaced: no sticky column, columns scroll with the page, widget order is the user's), *Cycle header and free margin* (at ≥1024px the title and the phone bar give way to the shell), *Summary cards* (at ≥1024px the three columns are tiles with no accordion; panels open as side panels), *Expense card states* (at ≥1024px cards start open and the section header gains "Expandir todas" and "Nueva categoría"), *Account avatar and menu* (at ≥1024px the menu opens from the sidebar's account card).
- `dashboard-data`: *Every dashboard operation persists* (the widget order is a per-user property, saved and returned by the data layer; the demo keeps it in memory).
- `design-system`: *Translucent materials* (the floating sidebar and top bar, and the side panels, are allowed materials), *Motion respects user preference* (static-to-floating, side panels, scroll-spy and widget drag).

## Impact

- `components/templates/dashboard-template.tsx`: renders the shell at `lg`, hides the phone bar and title there, mounts the tile row, the open-by-default cards, the reorderable widget list and the side-panel variant of every sheet; keeps all state and handlers.
- New organisms: `desktop-sidebar.tsx`, `desktop-top-bar.tsx`, `stat-tile-row.tsx` (or the tile variant inside `summary-group.tsx` / `free-margin-card.tsx`), `widget-list.tsx` (reorder).
- `components/organisms/sheet-shell.tsx`: a `side` presentation at `lg`; an explicit `opener` for anchored popovers with viewport clamping (also `account-menu.tsx`).
- `lib/data/dashboard.ts`: `user.widgetOrder` and `DashboardActions.setWidgetOrder`; implemented in `lib/data/supabase/profile.ts` (or `dashboard.ts`) and in `lib/demo/`.
- Database: migration `0032` adding `usuarios.orden_widgets` (`text[]`, nullable; covered by the existing self-update policy).
- `messages/es.json`, `messages/en.json`: sidebar, top bar, tiles and widget-reorder strings; `app/globals.css`: floating-shell tokens and transitions.
- Tests: Playwright specs on `/demo` at 1280px (shell, floating transition, tiles, side panels, widget reorder with keyboard, scroll-spy, reduced motion, axe); existing `widgets-desktop.spec.js` scenarios on the sticky column are replaced.
- Depends on `modernize-dashboard-widgets` being archived first: its *Desktop layout* and *Wide viewports* requirements are what this change builds on and partly replaces.
- No new dependency: drag via `motion` (already installed), glass via the existing `liquid-glass` class.
