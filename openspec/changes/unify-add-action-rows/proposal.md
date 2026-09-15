## Why

The three "add" buttons look like three different controls. Measured on `/demo` at 390px:
- "Add income" and "add savings movement" sit inside an extra 16px side padding and 12px bottom padding: 324px wide, with the icon and hairline indented.
- "Add expense" spans its card edge to edge: 356px wide.

None of the three has a hover state. On `/demo` all three are disabled because the page supplies no handlers, so they render at 50% opacity and look broken. A bare "+" glyph is also a weak affordance next to the list rows above it.

## What Changes

- **One add-row design** is used by the income panel, the savings panel and every expense card:
  - a full-width list row with the same insets and hairline as its sibling rows
  - a leading circular badge with a plus, tinted with the brand colour
  - the label in brand ink
- **States follow Apple HIG:**
  - hover on pointer devices only: row highlight, the badge fills with the brand colour, spring motion
  - press: stronger highlight and a slight shrink
  - keyboard focus ring
  - reduced motion drops scale and rotation but keeps colour feedback
- **Theme tokens only.** Contrast is checked in light and dark.
- **The extra padding wrappers** around the income and savings add rows are removed.
- **`/demo` gets add handlers.** The three add rows are enabled there. Activating one changes no data and shows a short "not available in the demo" message, announced to assistive technology, in es and en. This fixes the washed-out look and makes hover and press visible on the demo.
- **`DESIGN.md`** gains a short "Add Rows" component entry.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `dashboard-ui`: new *Add action rows* requirement with shared appearance and states. *Expense card states* points its add row at it. *Public demo route* gains enabled add actions with a transient message.

> `openspec/specs/` is still empty because no change has been archived. `dashboard-ui` is defined by `land-finance-dashboard`, `restyle-dashboard-to-v0` and `refine-mobile-ui-apple-hig`. This change must be archived after those three.

## Impact

- **Components:**
  - `components/molecules/add-row.tsx` (anatomy and states)
  - `components/templates/dashboard-template.tsx` (wrappers removed)
  - a new presentational demo message molecule
- **CSS:** `app/globals.css` (`pressable` gains an optional press-tint variable, backward-compatible).
- **Demo:** `app/demo/page.tsx` plus a client wrapper under `app/demo/` that supplies the add handlers and the message state.
- **Messages:** one new key in the `demo` namespace of `messages/es.json` and `messages/en.json`.
- **Unchanged:** `DashboardActions` contract, data layer, routes. No new dependencies.
