# Current animations — inventory and audit

Read-only inventory of every animation, transition and effect in the project as of 2026-09-17.
Nothing in the codebase has been modified.

Criteria applied: all five files in `motion-skills/` — `improveanimations.md` (posture and hard
rules), `AUDIT.md` (the 8 categories), `Apple-desing.md` (A§1–A§17), with `animations.md` and
`recipies.md` as the implementation reference.

> **Revised 2026-09-17** after the three empty skill files were filled in. The reference layer
> contradicted six of my earlier recommendations and I've corrected them rather than leave them
> standing — see §1, §5, §6, §7, §8, §10, each marked **↩︎ corrected**. Two rules from
> `improveanimations.md` reshaped the report as a whole:
>
> - **Hard Rule 5 — "don't re-litigate settled decisions."** Where DESIGN.md documents a motion
>   tradeoff deliberately, it is now *noted*, not reported as a finding. This moved three items
>   (AddRow hover, swipe removal easing, toast spring) out of the findings list.
> - **Hard Rule 1 — "never modify source code; plans go in `plans/`."** This conflicts with your
>   Step 2 ("tell me which ones to go ahead with"). Your instruction wins — see the closing note.
>
> **Gap:** `improveanimations.md:26` references `PLAN-TEMPLATE.md`, which does not exist in
> `motion-skills/`. If you want Phase 4 plan files rather than direct edits, I need that template
> or your say-so to use a reasonable structure.

---

## ✅ Applied — cards and charts (2026-09-17, from commit `2a05d56`)

Scope was "the cards effects and the graphics". These seven edits are **in the working tree**,
typechecked clean, and verified in a headless browser on `/demo`:

| Item | File | Change | Verified by |
| --- | --- | --- | --- |
| MEDIUM 6 (partial) | [globals.css:180-182](app/globals.css#L180-L182) | Added `--ease-out`, `--ease-in-out`, `--ease-drawer` | `.ease-drawer` utility confirmed emitting in compiled CSS |
| **HIGH 2 — your Q1** | [dashboard-template.tsx:383-388](components/templates/dashboard-template.tsx#L383-L388) | One trigger for all cards; delay `0.48 + min(index,5)*0.05`; duration `0.22 → 0.3` | Timing probe: cards now arrive in DOM order, 503→754ms |
| §1 (charts' share) | [dashboard-template.tsx:405-414](components/templates/dashboard-template.tsx#L405-L414) | Charts decoupled from the card cascade; own trigger, `distance 40 → 24`, `duration 1.0 → 0.3` | Renders settled, no stuck elements |
| MEDIUM 7 | [collapsible.tsx:15-16](components/atoms/collapsible.tsx#L15-L16) | `500ms → 200ms`, hand-typed curve → `ease-drawer` token, added the recipe's `opacity` half | Expand probe (below) |
| **HIGH 3** | [category-pie-chart.tsx:35](components/organisms/category-pie-chart.tsx#L35) | `isAnimationActive={false}` — kills the 1500ms `ease` sweep | Pie arc `d` stable across 83 samples / 2.6s |
| **HIGH 3** | [monthly-bars-chart.tsx:58](components/organisms/monthly-bars-chart.tsx#L58) | `isAnimationActive={false}` on `Bar` | Renders immediately |
| A3 | [monthly-bars-chart.tsx:80-83](components/organisms/monthly-bars-chart.tsx#L80-L83) | 150ms `fill` / `fill-opacity` transition on selection | Compiled; feel-check pending |

**Measured card entrance** (was: top card last at 480ms while the rest started at 0):

| Arrival | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DOM index | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| Time (ms) | 503 | 534 | 598 | 629 | 691 | 754 | 754 |

Strictly top-to-bottom, ~50ms apart. Indices 5 and 6 share 754ms — that's the `min(index, 5)` cap
doing its job, so a long category list can't drag the tail past budget.

**Not applied** — everything else in the tables below, including HIGH 1 (removing the scroll-reveal
system), HIGH 4, HIGH 5, and the rest of the MEDIUM/LOW items. HIGH 1 remains my top recommendation
and would supersede part of what's above.

**Legend:** ✅ correct as-is · ⚠️ finding · 🔒 touches a locked decision (proposal only)

---

## 0. The motion token layer

**Where:** [globals.css:177-196](app/globals.css#L177-L196)

| Token | Value | Notes |
| --- | --- | --- |
| `--ease-spring` | `linear(…)` 41 stops, peaks at **1.038** | ~3.8% overshoot |
| `--ease-bounce` | `linear(…)` 41 stops, peaks at **1.126** | ~12.6% overshoot |
| `--animate-segment-pop` | `segment-pop 600ms var(--ease-bounce) both` | keyframe, scale 0.5→1 + rotate |

⚠️ **There is no `ease-out`, `ease-in-out` or drawer token.** AUDIT §2 asks for three named
curves. The drawer curve `cubic-bezier(0.32, 0.72, 0, 1)` — which is exactly AUDIT's
`--ease-drawer` — is **hand-typed in three separate places**:

- [collapsible.tsx:15](components/atoms/collapsible.tsx#L15)
- [month-picker.tsx:56](components/molecules/month-picker.tsx#L56)
- [account-menu.tsx:114](components/organisms/account-menu.tsx#L114)

**Change:** add `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`
and `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` to the `@theme` block and replace the three
literals. **Why:** §7 — a curve repeated by hand in three files is a consolidation finding, and
§2 requires strong custom curves rather than the built-in weak ones.

⚠️ **`--ease-bounce` (12.6% overshoot) is a personality mismatch.** §7: "playful can be bouncier,
a dashboard stays crisp." DESIGN.md describes the product as *"methodical, unyielding, reliable
and discreet… structural seriousness rather than decorative whimsy."* A 12.6% overshoot on hover
states contradicts the product's own stated tone. **Change:** reserve `ease-bounce` for the
segment-pop (a deliberate, occasional selection) and drop it from hover states (§8 below).

---

## 1. Page entrance system — GSAP `AnimatedContent`

**Where:** [animated-content.tsx](components/ui/animated-content.tsx) — wraps 8 regions in
[dashboard-template.tsx](components/templates/dashboard-template.tsx)

**What it does:** every major dashboard region fades + slides up on first paint, sequenced by
hardcoded delays, played by a GSAP timeline gated on a `ScrollTrigger` (`once: true`).

**How:** GSAP 3.15 + ScrollTrigger. `gsap.set` places the element at `y: distance, opacity: 0`,
then `tl.to(…)` returns it to rest.

| Region | Line | Distance | Duration | Delay | Ease |
| --- | --- | --- | --- | --- | --- |
| Month title | [260](components/templates/dashboard-template.tsx#L260) | 20px | 0.8s | 0.12s | `power3.out` |
| Demo notice | [274](components/templates/dashboard-template.tsx#L274) | 12px | 0.6s | 0.06s | `power3.out` |
| Free margin card | [278](components/templates/dashboard-template.tsx#L278) | 32px + `scale .97` | **1.0s** | 0.20s | `power3.out` |
| Summary group | [281](components/templates/dashboard-template.tsx#L281) | 24px | 0.8s | 0.32s | `power3.out` |
| "Expense breakdown" heading | [366](components/templates/dashboard-template.tsx#L366) | 16px | 0.8s | 0.42s | `power3.out` |
| Category cards | [381-389](components/templates/dashboard-template.tsx#L381-L389) | 24px | **0.22s** | *see §2* | `power3.out` |
| Monthly bars chart | [405](components/templates/dashboard-template.tsx#L405) | 40px | **1.0s** | `(n-1)×0.06` | `power3.out` |
| Category pie chart | [414](components/templates/dashboard-template.tsx#L414) | 40px | **1.0s** | `n×0.06+0.1` | `power3.out` |

✅ `power3.out` is a strong ease-out — correct for entrances per §2.
✅ Reduced motion is handled properly at [animated-content.tsx:57-60](components/ui/animated-content.tsx#L57-L60):
it clears the transform and reveals the element rather than leaving it hidden.

### ↩︎ **Corrected — this is the highest-severity finding in the report, and I under-called it**

`recipies.md` § "Scroll reveal" is unambiguous:

> *"Marketing surfaces only. Don't do this to functional UI a user visits daily."*

That is exactly what this is. Eight scroll-triggered reveals on the dashboard of a personal finance
app — the screen the user opens several times a day to read one number. My first pass treated this
as a duration problem. It isn't: **the pattern itself doesn't belong on this surface.** It also
fails `animations.md`'s Step 1 gate independently (a daily-visited screen is the "near-imperceptible
only, or nothing" tier) and its Step 2 purpose test — a reveal on content that was already there
indicates no state, gives no feedback, and bridges nothing.

**Change:** delete the scroll-reveal behaviour. Keep at most a single quiet fade on first paint
(~200ms, `--ease-out`, no `y` offset, no per-region delays), or nothing at all. This subsumes the
duration and stagger findings below — they're fixes to a system I'm recommending you mostly remove.

This is also the cheapest fix in the report: it deletes code and a dependency rather than tuning
values, and it resolves the `visibility: hidden` flash and the category-card ordering bug (§2) as a
side effect.

⚠️ **Durations of 0.8–1.0s are 3× over the UI budget.** §2 caps UI animation at 300ms. A dashboard
is UI, not a marketing page. The whole entrance sequence currently finishes around **1.9s** after
load (0.42s delay + 1.0s duration on the charts, plus their own internal animation — see §13).
**Change:** bring all entrance durations into a single **260–320ms** band.
**Why:** §2 duration budget; the last thing to settle should not be a second and a half in.

⚠️ **Eight hand-tuned distance/duration/delay triplets, no shared scale.** §7 consolidation
finding. **Change:** two variants — `lead` (title/hero) and `section` (everything else) — with one
distance and one duration each.

⚠️ **The whole dashboard is `visibility: hidden` until JS runs.**
[animated-content.tsx:141](components/ui/animated-content.tsx#L141) sets an inline
`style={{ visibility: 'hidden' }}` that only the client effect clears. With JS disabled or a slow
hydration, the dashboard renders blank. **Change:** invert it — render visible by default and let
the animation opt *in* via a `data-mounted` attribute (§4's own suggested legacy fallback), or move
to `@starting-style`. **Why:** A§1 — the cost of the entrance should never be the content itself.

⚠️ **GSAP + ScrollTrigger is a heavy dependency for eight fade-ups.** The scroller lookup at
[animated-content.tsx:62](components/ui/animated-content.tsx#L62) references
`#snap-main-container`, **an element that does not exist anywhere in this codebase** — vestigial
code from wherever the component was copied from. **Change (proposal):** replace with
`@starting-style` + the new tokens, or a ~20-line IntersectionObserver. §5: CSS beats JS-driven
motion under load. This also drops a ~70kb dependency used for nothing else.

---

## 2. ⚠️ Category card entry order — *your question #1*

**Where:** [dashboard-template.tsx:380-389](components/templates/dashboard-template.tsx#L380-L389)

```jsx
id={index === 1 ? 'category-cascade' : undefined}
trigger={index === 0 ? undefined : '#category-cascade'}
delay={index === 0 ? 0.48 : (index - 1) * 0.06}
```

**Your read is correct, and here is exactly why it looks wrong.** There are two independent bugs
stacked on top of each other:

**Bug 1 — the delays are inverted.** Resolving the ternary per card:

| Card | Position on screen | Delay |
| --- | --- | --- |
| index 0 (fixed expenses) | **first / top** | **0.48s** |
| index 1 | second | **0.00s** |
| index 2 | third | 0.06s |
| index 3 | fourth | 0.12s |

The top card is given the **longest** delay and every card below it starts at zero. The stagger
runs 2→3→4 while card 1 arrives last. That is the "one of them arrived late" you're seeing — and
it's the *first* one, which is the most visible.

**Bug 2 — they're on two different clocks.** Card 0 has no `trigger`, so it waits for its own
element to scroll into view, then waits 0.48s. Cards 1…n trigger off `#category-cascade`, which is
*card 1's own wrapper*. So the two groups are timed from different events entirely; the gap between
card 0 and the rest depends on scroll position, not on the stagger value.

**Also:** `duration={0.22}` here vs **0.8–1.0s** on every neighbouring region. Even with the order
fixed, the cards would snap in while the hero and charts float — a second reason the block reads
as detached from the rest of the page.

**Change (recommended):** one trigger, one clock, delay following DOM order — which is also the
visual order, top to bottom:

```jsx
trigger="#category-cascade"        // same anchor for every card, incl. index 0
delay={0.48 + Math.min(index, 5) * 0.05}
duration={0.28}                    // match the unified band from §1
```

**Why:** §7 — "everything-at-once group entrances where a 30–80ms stagger belongs"; 50ms sits in
that window, and the `min(index, 5)` cap stops a long category list from dragging the tail out
past the budget. A§7 (spatial consistency) — a list that reads top-to-bottom should animate
top-to-bottom; any other order reads as an error, which is precisely the reported symptom.

**Alternative if you prefer:** drop the stagger entirely (`delay={0.48}` for all). Also correct per
§7, since the cards are one group. The stagger is the more refined option; both fix the bug.

*Note:* the cards render from `data.expenses.groups` in raw order, while
[the summary panel](components/templates/dashboard-template.tsx#L318) uses `sortedExpenseGroups`
(by total, descending). Not a motion issue, but worth knowing the two lists are ordered
differently — the stagger will follow whatever order the cards are in.

---

## 3. ⚠️ Free margin count-up — *your question #2: I recommend against it*

**Where:** [free-margin-card.tsx](components/organisms/free-margin-card.tsx) —
[`Money`](components/atoms/money.tsx) rendered at `text-display-mobile` / `text-display`.

**Current state:** no count-up. The number renders at its final value; the *card* fades and slides
up via `AnimatedContent` (32px, 1.0s, `scale .97`).

You asked me to decide on the skill's criteria and to tell you if it contradicts something rather
than applying it anyway. It does, on four counts:

1. **Frequency (§1).** This is the headline number on the home screen — seen every single time the
   app is opened, several times a day. §1's table puts that in "tens of times per day → remove or
   drastically reduce." The delight budget is explicitly reserved for "rare / first-time" moments.
   A count-up on the most-viewed element in the product is the exact case §1 warns about.

2. **Purpose (§1).** Every animation must answer *why does this animate?* — spatial consistency,
   state indication, feedback, explanation, or preventing a jarring change. A load count-up is none
   of those. The number isn't changing state; it's the same number it was yesterday. "It looks
   cool" on a frequently-seen element is explicitly not a purpose.

3. **It manufactures the latency A§1 tells you to kill.** A§1: "the moment lag appears, the feeling
   of directness falls off a cliff." A count-up means the one value the user opened the app to read
   is deliberately unreadable for its duration. It delays comprehension of the most important
   number on the screen, by design.

4. **Personality (§7) and the product's own brief.** DESIGN.md: *"financial telemetry is treated
   with structural seriousness rather than decorative whimsy"*, emotional output *"composure,
   absolute control, and instant comprehension of wealth flows without extraneous visual noise."*
   A rolling balance is the decorative-whimsy end of that axis. It also fights the `tabular-nums`
   setting the design system mandates for exactly this kind of readout.

**↩︎ The new reference layer strengthens this, it doesn't soften it.** `animations.md` Step 1 is a
gate that runs *before* any implementation decision, and a daily-visited screen lands in the
"near-imperceptible only — fast and subtle, or nothing" tier. Step 2 then requires naming the
purpose from a closed list — feedback, spatial consistency, state indication, preventing a jarring
change, explanation, delight — where delight is *"allowed only at the rare/first-time tier."* A load
count-up on the home screen can't claim any of the six. The skill is explicit that this should
produce zero lines of code: *"The gate below exists to produce zero lines of code sometimes. That's
a success, not a dodge."*

**What I'd do instead — animate it on *change*, not on load.** When the margin actually updates
(you add an expense, edit one, undo a delete), the number currently teleports to its new value.
*That* is a real §8 finding: "state changes that teleport where a brief transition would prevent a
jarring change." A short count-up **from the previous value to the new one**, ~200ms, only when the
value changes and only when the change was user-initiated, has a genuine purpose: it shows the
direction and rough size of the impact your entry just had. It costs nothing on load, and it fires
on a rare-ish moment rather than every app open.

If you still want it on load after reading this, say so and I'll implement it — it's your call, and
I'll cap it at ~400ms with a `prefers-reduced-motion` bypass. I just won't apply it silently against
the criteria you asked me to apply.

**Technical note either way:** [`Money`](components/atoms/money.tsx#L25) uses
`Intl.NumberFormat(...).formatToParts()` to split the currency symbol into its own span. A count-up
has to re-run that formatting every frame, so the component would need a client-side variant. The
hero is currently a server component.

---

## 4. 🔒 Sticky top bar

**Where:** [dashboard-template.tsx:203-257](components/templates/dashboard-template.tsx#L203-L257),
`.glass-bar` at [globals.css:322-328](app/globals.css#L322-L328)

**What it does:** transparent at rest; once the month title scrolls under it, the frosted panel
fades in, the "Mango" wordmark fades/slides out and the compact month selector fades/slides in.

**How:** `IntersectionObserver` (`rootMargin: -56px`) flips `titleInView`; three CSS transitions
react. `.glass-bar` is `backdrop-filter: blur(16px) saturate(160%)`.

| Element | Property | Duration | Ease |
| --- | --- | --- | --- |
| Frosted panel | `opacity` | 500ms | `ease-spring` |
| Wordmark | `opacity, translate` (−8px) | 500ms | `ease-spring` |
| Month selector | `opacity, translate` (+8px) | 500ms | `ease-spring` |

✅ The transparent→frosted design is locked and I'm not proposing to change it.
✅ `backdrop-filter: blur(16px)` is under §5's 20px ceiling.
✅ Reduced motion handled on all three (`motion-reduce:transition-none`).

⚠️ **500ms on a scroll-driven swap.** §2: UI stays under 300ms, and §1 puts scroll-triggered chrome
in the "seen constantly → drastically reduce" band. Scrolling past the title is one of the most
frequent things that happens in this app. **Change:** 200ms.

⚠️ **`ease-spring` on an opacity fade is meaningless.** An overshoot curve peaking at 1.038 on
`opacity` clamps at 1 — you're paying for a spring and getting a fade with a flat spot.
**Change:** `--ease-out` for all three. **Why:** §2 — entering/exiting is ease-out.

⚠️ **The two labels crossfade simultaneously** — both are at partial opacity mid-transition, so the
wordmark and the month selector are visibly double-exposed over each other for ~250ms. §7 names
this exact case. **Change:** the 200ms above mostly hides it; if it still reads, §7's remedy is a
subtle `filter: blur(2px)` on the outgoing label during the transition.

🔒 **Proposal only — the hard divider.** `.glass-bar` carries `border-bottom: 1px solid`.
A§12 says: "scroll edge effects, not hard dividers — instead of a 1px border under a sticky header,
fade a small blur/gradient mask where content meets floating chrome." This touches the locked bar
design, so I'm flagging rather than changing. A mask-image fade would read closer to the iOS
material you're referencing.

---

## 5. 🔒 Bottom sheets

**Where:** [sheet-shell.tsx](components/organisms/sheet-shell.tsx) (Base UI `Drawer`), used by
[entry-sheet.tsx](components/organisms/entry-sheet.tsx) and
[category-sheet.tsx](components/organisms/category-sheet.tsx)

| Element | Property | Duration | Ease |
| --- | --- | --- | --- |
| Backdrop | `opacity` + `blur(8px)` | 300ms | default |
| Popup enter | `transform` (`translateY(100%+1.5rem)`→0) | 500ms | `ease-spring` |
| Popup exit | `transform` | `--drawer-swipe-strength × 400ms` | ⚠️ `ease-in` |
| Anchored (≥sm) | `translate, scale .95, opacity` | 200ms exit | ⚠️ `ease-in` |

✅ **This is the best-implemented motion in the codebase.** Specifically:
- `data-swiping:transition-none` on both backdrop and popup — the drag tracks the finger 1:1 with
  no transition fighting it (A§2).
- The backdrop opacity is bound to `calc(1 - var(--drawer-swipe-progress))` — continuous feedback
  *during* the gesture, not just at the end (A§1).
- Exit duration scales with `--drawer-swipe-strength`, which is a real approximation of velocity
  handoff (A§5) — a fast flick closes faster than a slow drag.
- Transitions, not keyframes, so the sheet is interruptible and retargets mid-flight (§4).
- `translateY(100%)` percentages rather than hardcoded pixel offsets (§8).
- `transform-origin: top-right` on the anchored desktop variant, and it scales from `.95`, never
  from 0 (§3, A§7).

⚠️ **`ease-in` on both exits** ([sheet-shell.tsx:106](components/organisms/sheet-shell.tsx#L106),
[:112](components/organisms/sheet-shell.tsx#L112)). §2: "`ease-in` on UI is always a finding."
The honest nuance: a sheet leaving the screen entirely is the most defensible possible use of
ease-in, since nobody is watching where it lands. But the rule as written has no exception.
**Change:** `--ease-out` on exit, or mirror the enter curve per A§7 ("mirror the easing on
reversible transitions"). Low priority; this is the least wrong `ease-in` of the three.

⚠️ **`ease-spring` on the enter.** The sheet slides to a hard resting edge; a 3.8% overshoot means
it travels past its resting position and settles back. **Change:** `--ease-drawer`
(`cubic-bezier(0.32, 0.72, 0, 1)`) — the iOS drawer curve, which the repo already uses in three
other places. A§4 also applies: reserve bounce for momentum-driven gestures. A tap-opened sheet had
no flick behind it, so it shouldn't overshoot; a swipe-released one legitimately could.

↩︎ **Corrected — I was wrong to flag the 500ms.** `recipies.md` § "Drawer / sheet" specifies
exactly `transition: transform 500ms var(--ease-drawer)`. The duration here is already the
recommended value; only the **curve** is wrong. Retracting the "→ 400ms" recommendation — change
`ease-spring` to `--ease-drawer` and leave the timing alone.

🔒 **Proposal — stacked translucency.** A§12: "never stack a light translucent surface on another —
legibility collapses." The account menu (`liquid-glass`, `blur(22px)`) sits above a
`backdrop-blur-[8px]` scrim, and the month picker (`liquid-glass`) can open over the already-frosted
top bar. Since translucent floating sheets are a locked decision, I'm flagging rather than changing:
the fix would be raising the sheet's background opacity where it overlaps another blurred layer,
not removing the material.

---

## 6. 🔒 Swipe to delete

**Where:** [swipe-to-delete.tsx](components/molecules/swipe-to-delete.tsx)

**What it does:** horizontal drag on an expense row reveals a destructive panel; past 60% of row
width it arms and commits the delete directly (long-swipe); the row then collapses away.

**How:** raw Pointer Events, `transform: translateX(offset)` driven by React state.
Constants: `LOCK_THRESHOLD_PX = 10`, `PANEL_RATIO = 0.25`, `MIN_PANEL_PX = 44`, `ARM_RATIO = 0.6`.

| Phase | Implementation | Duration | Ease |
| --- | --- | --- | --- |
| Dragging | `transform` bound to pointer, no transition | — | 1:1 |
| Release / snap | `transition-transform` | 450ms | `ease-spring` |
| Removing | `transition-transform` | 220ms | ⚠️ `ease-in` |
| Row collapse | `Collapsible` grid-rows | 500ms | drawer curve |

✅ The gesture fundamentals are right: 10px intent lock before committing to a direction (A§10's
~10px hysteresis), `setPointerCapture` so tracking survives leaving the element (A§2), axis lock
that bails cleanly on vertical, `touch-pan-y` so vertical scroll still works, and the panel width
growing with the drag (`Math.max(panel, -offset)`) rather than clipping.
✅ Reduced motion branches to a no-animation path that still deletes.

⚠️ **The release decision ignores velocity entirely.**
[swipe-to-delete.tsx:113-119](components/molecules/swipe-to-delete.tsx#L113-L119) branches purely
on final position. A fast flick that releases at 30% does nothing; a slow drag parked at 61% deletes.
§4 names this exactly: "drags without velocity-based dismissal (dismiss on
`Math.abs(distance)/elapsedMs > ~0.11`, not distance thresholds alone)". A§5 and A§6 are the same
point — project where the gesture was *going*, then pick the target from the projection.
**Change:** `recipies.md` § "Drag to dismiss" gives the exact shape to copy:

```js
const timeTaken = Date.now() - dragStartTime.current;
const velocity = Math.abs(swipeAmount) / timeTaken;
if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11) dismiss();
```

Track the start timestamp in `handlePointerDown` and apply the `|| velocity > 0.11` clause at
release. This is a refinement inside your locked long-swipe design, not a change to it — a flick
will simply commit the delete the way it already looks like it should.

⚠️ **↩︎ New — no multi-touch protection.**
[handlePointerDown](components/molecules/swipe-to-delete.tsx#L64-L74) overwrites
`gestureRef.current` unconditionally (its only guard is `if (removing) return`). A second finger
landing on the row mid-drag replaces `startX` and `startOffset`, so the row **jumps** to track the
new pointer. `recipies.md` § "Drag to dismiss" names this as one of the four details that separate
a good drag from a bad one: *"multi-touch protection — `if (isDragging) return` on new touch
points, or switching fingers mid-drag makes the element jump."*
**Change:** bail out of `handlePointerDown` when a gesture is already active. One line.

⚠️ **Hard stop at the boundary.**
[:96](components/molecules/swipe-to-delete.tsx#L96) clamps with `Math.max(-width, …)`, so dragging
past the row edge freezes. A§9: a hard stop reads as "frozen", progressive resistance reads as
"responsive, but there's nothing more here." **Change:** apply the rubber-band function from A§9
past the bound.

⚠️ **Hardcoded sleeps coupled to CSS durations.**
[runDelete](components/molecules/swipe-to-delete.tsx#L136-L139) does `await wait(220)` →
`setRemoving(true)` → `await wait(250)` before calling `onDelete()`. That's **470ms of artificial
latency** before the delete fires, and the constants silently duplicate the CSS timings — change one
and they desync. A§1: "audit debounces, artificial timers, transition waits. Anything on the input
path that isn't essential is a regression." **Change:** drive it off `transitionend`, or fire
`onDelete()` optimistically and let the collapse play out underneath.

📝 **↩︎ Noted, not reported — `ease-in` on removal** ([:197](components/molecules/swipe-to-delete.tsx#L197)).
DESIGN.md § "Swipe Actions" documents this deliberately: *"removal collapses the row over 220ms
with a linear ease-in."* Under `improveanimations.md` Hard Rule 5 that's a settled decision, so I'm
noting it rather than reporting it. (For the record it still conflicts with §2; if you ever want it
revisited, say so and I'll treat it as an open question.)

⚠️ **450ms `ease-spring` snap-back** — over §2's budget for a frequent gesture, and overshoot on a
row returning to rest is unmotivated unless it carried velocity (A§4). **Change:** ~300ms
`--ease-out`, or once velocity tracking is in, the recipe's settle spring
`{ type: "spring", duration: 0.5, bounce: 0.2 }`. Note DESIGN.md documents "spring easing opens and
closes the panel", so keeping a spring here respects that; it's the 450ms fixed duration that's the
finding.
⚠️ **`armed` toggles `ml-auto` / `mx-auto`** ([:179](components/molecules/swipe-to-delete.tsx#L179)) —
a flex-alignment swap mid-gesture, which is a layout change on every armed/disarmed flip (§5).
Minor, but it's in the hot path of a drag. **Change:** `transform: translateX` on the button instead.

---

## 7. ⚠️ Collapsible — the most expensive animation in the app

**Where:** [collapsible.tsx](components/atoms/collapsible.tsx)
**Used by:** category card panels, summary group panel, demo notice, swipe-to-delete row removal.

**How:** `grid-template-rows: 0fr → 1fr`, 500ms `cubic-bezier(0.32, 0.72, 0, 1)`.

↩︎ **Corrected — I over-called this one.** My first pass flagged the layout animation as a §5
violation and proposed rewriting it to `transform: scaleY` or `clip-path`. `animations.md` § 4
explicitly carves out the exception:

> *"`height` is tolerated only for accordions, where there's no transform equivalent."*

So the technique is sanctioned and **I'm retracting the rewrite proposal.** What survives is the
duration. `recipies.md` § "Accordion / collapse" gives the target:

```css
.content {
  overflow: hidden;
  transition: height 200ms var(--ease-out), opacity 200ms var(--ease-out);
}
```

> *"Keep it short — this is one of the few animations that costs layout on every frame, so a long
> duration is expensive as well as sluggish."*

⚠️ **500ms is the finding, at 2.5× the recipe's 200ms.** The cost-per-frame argument is what makes
the duration matter here: every expense row, swipe wrapper and `Money` span in the panel is
re-laid-out on each of those frames, on the most common interaction in the product (§1 puts
expand/collapse in the "seen constantly → drastically reduce" band).

**Change:** 200ms `--ease-out`, and add the `opacity` half of the recipe, which the current
implementation omits. Keep `grid-template-rows` — it's the tolerated approach and it avoids the JS
height measurement the recipe otherwise requires.

⚠️ Hand-typed curve, third copy — see §0.

---

## 8. Press feedback and hover states

### `pressable` utility ✅ mostly right
**Where:** [globals.css:198-212](app/globals.css#L198-L212)
`transition: scale 200ms var(--ease-spring), background-color 150ms ease-out` with
`:active { scale: var(--press-scale, 0.98) }`.

✅ Feedback on `:active` — fires on pointer-down, not release (A§1, §3).
✅ `0.98` sits in §3's 0.95–0.98 band. Per-element overrides (`0.9` on icon buttons, `1` on the
card header) are a sensible use of the custom property.
✅ Focus-visible ring included.

⚠️ 200ms is slightly over §2's 100–160ms for button press feedback. ↩︎ **Change: 160ms** — the
exact value in `recipies.md` § "Button press" (`transition: transform 160ms var(--ease-out)`;
my earlier "140ms" was an invented value, which Hard Rule 2 forbids).
✅ The recipe also confirms the current approach needs no hover gating: *"`:active` is a real press
on touch."*
⚠️ `ease-spring` means the press *overshoots past* 0.98 and settles back — on the way down, that's
motion the user's finger didn't ask for. §4: press should be deliberate, the release should snap
(asymmetric); this is symmetric and springy in both directions. **Change:** `--ease-out`.
⚠️ `@media (prefers-reduced-motion) { transition: none }` removes the color feedback's *transition*
as well as the scale. The color still changes (instantly), so feedback survives — but §6 asks for
"fewer and gentler", not a hard cut. **Change:** keep `background-color 150ms ease-out` under
reduced motion and drop only the scale.

### ⚠️ AddRow hover
**Where:** [add-row.tsx:16-21](components/molecules/add-row.tsx#L16-L21)
Badge scales to `1.10` over **400ms** `ease-spring`; the plus icon rotates **90° over 400ms**
`ease-spring`; `group-active` shrinks to `0.90`.

§1: hover effects are "tens of times per day → remove or drastically reduce". §2: hover → `ease`,
and 400ms is well over budget for one. A 90° spring rotation is a lot of motion for an element you
brush past constantly.
📝 **↩︎ Downgraded to a note, not a finding.** DESIGN.md § "Add Rows" documents this deliberately —
*"growing and turning 90° with spring motion"*, with the reduced-motion behaviour spelled out too.
Hard Rule 5 says respect a documented tradeoff rather than re-litigate it. If you want it revisited
anyway, the change would be 150ms `ease` — but I'm not proposing it.

### ⚠️ Account menu hover flourishes
**Where:** [account-menu.tsx:171](components/organisms/account-menu.tsx#L171),
[:270](components/organisms/account-menu.tsx#L270)
Avatar: `transition-[scale,rotate,box-shadow]` **500ms `ease-bounce`** → `-rotate-6 scale-110` plus
a two-layer `box-shadow` change. Sign-out icon: `translate-x-1` **500ms `ease-bounce`**.

⚠️ 500ms + 12.6% overshoot on hover — §1 and §2 both. ⚠️ `box-shadow` is a paint property (§5);
survivable on one small avatar, but it's not free. ⚠️ §7 personality: bounce on a finance dashboard.
**Change:** 150ms `ease`, drop the bounce, and if the shadow flourish stays, accept it as the one
paint exception rather than the pattern.

---

## 9. Account menu — panel, segments, theme switch

**Where:** [account-menu.tsx](components/organisms/account-menu.tsx)

| Element | Line | Property | Duration | Ease |
| --- | --- | --- | --- | --- |
| Scrim | [142](components/organisms/account-menu.tsx#L142) | `opacity` + `blur(8px)` | 300 / 200ms | default |
| Panel enter | [158](components/organisms/account-menu.tsx#L158) | `translate, scale, opacity` | 500ms | `ease-spring` |
| Panel exit | [159](components/organisms/account-menu.tsx#L159) | same | 200ms | ⚠️ `ease-in` |
| Content blocks ×3 | [31](components/organisms/account-menu.tsx#L31) | `opacity, translate` | **700ms** | `ease-spring` |
| Block stagger | [189](components/organisms/account-menu.tsx#L189), [226](components/organisms/account-menu.tsx#L226), [263](components/organisms/account-menu.tsx#L263) | `transitionDelay` | 50 / 100 / 150ms | — |
| Segment thumb | [36](components/organisms/account-menu.tsx#L36) | `translate, scale` | 500ms | `ease-spring` |
| Theme icon | [217](components/organisms/account-menu.tsx#L217) | `@keyframes segment-pop` | 600ms | `ease-bounce` |
| Theme switch | [112-115](components/organisms/account-menu.tsx#L112-L115) | `clip-path` circle | 700ms | drawer curve |

✅ **The theme switch is genuinely good.** It expands a `clip-path` circle from the centre of the
button you actually clicked — spatially anchored to its trigger (A§7, §3), via the View Transition
API, and correctly bypassed under `prefers-reduced-motion`
([:100](components/organisms/account-menu.tsx#L100)). Theme switching is a rare, deliberate action,
which is precisely where §1 says the delight budget belongs. **No change.** (A§14's "ease dark↔light
theme changes" is satisfied.)
✅ The 50/100/150ms block stagger is in §7's 30–80ms window.
✅ `starting:` styles rather than keyframes — interruptible (§4).

⚠️ **700ms on the content blocks** — more than twice the budget (§2), on a menu you open regularly.
**Change:** 250ms, keeping the stagger.
⚠️ **The segment thumb is `ease-spring` at 500ms** — this is a toggle, hit repeatedly. §1/§2.
**Change:** 200ms. (The thumb is a `translate`, so it's cheap; it's the duration that's wrong.)
⚠️ **`animate-segment-pop` is a keyframe, forced to restart via `key={String(selected)}`**
([:215](components/organisms/account-menu.tsx#L215)). §4: "keyframes restart from zero… anything
triggered rapidly must use transitions or springs." Toggling theme twice quickly re-runs the 600ms
pop from scale 0.5 instead of retargeting. Also 600ms + 12.6% bounce (§2, §7).
**Change:** transition-based scale/rotate, ~250ms.
⚠️ `setTimeout(() => setMounted(false), 250)` at [:61](components/organisms/account-menu.tsx#L61)
duplicates the 200ms exit duration in JS — same coupling problem as swipe-to-delete.
⚠️ `ease-in` on exit — §2.

---

## 10. Toasts ✅

**Where:** [undo-toast.tsx:13](components/molecules/undo-toast.tsx#L13),
[demo-toast.tsx:20-21](components/molecules/demo-toast.tsx#L20-L21)

Both: `transition-[opacity,translate]`, enter 500ms `ease-spring` from `translateY(12px)`,
exit 200ms.

✅ **Transitions, not keyframes** — §4 calls out toasts by name as the case that must retarget
rather than restart. A replacement toast interrupts cleanly here.
✅ **Reduced motion done exactly as §6 asks:** `motion-reduce:translate-y-0` +
`motion-reduce:transition-[opacity]` keeps the fade and drops only the movement. This is the
reference implementation in the codebase — the pattern to copy elsewhere.
✅ Only one toast at a time (`limit={1}`), 5s timeout.

↩︎ **Corrected — retracting my "→ 250ms".** `recipies.md` § "Toast" deliberately breaks the generic
budget for this component:

```css
transition: opacity 400ms ease, transform 400ms ease;
```

> *"`ease` rather than `ease-out`, slightly slower than typical UI: Sonner reads as elegant partly
> because its motion is tuned to the component's personality rather than to the generic UI budget."*

So a toast is *supposed* to be slower than a popover, and 250ms would have been wrong. DESIGN.md
also documents the spring here (§ "Undo Toast"), which Hard Rule 5 protects.
**Remaining, minor:** 500ms → **400ms** and `ease-spring` → `ease` to match the recipe exactly.
Lowest-priority item in the report.

---

## 11. Month picker

**Where:** [month-picker.tsx:56](components/molecules/month-picker.tsx#L56),
[:95](components/molecules/month-picker.tsx#L95)

`transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]`, open state
`visible scale-100 opacity-100` ↔ `invisible -translate-y-2 scale-95 opacity-0`.
Month buttons: `transition-all duration-200`.

✅ Scales from `0.95`, never `scale(0)` (§3). ✅ `origin-top` roughly anchors it to its trigger.
✅ Reduced motion handled.

⚠️ **`transition: all` — twice.** §5: "always a finding." On the panel this is worst-case: the
element is `liquid-glass`, so `transition-all` is animating `backdrop-filter`, `background`
(a gradient) and `box-shadow` off the GPU alongside the transform. **Change:**
`transition-[opacity,transform]` on the panel and `transition-[background-color,color]` on the
buttons.
⚠️ 300ms on a dropdown — §2 says 150–250ms. **Change:** 200ms.
⚠️ Hand-typed curve, second copy — see §0.
⚠️ §3 nuance: `origin-top` is close but not the trigger. For `align="center"` the panel is
`left-1/2 -translate-x-1/2` under a centred button, so it's nearly right; for `align="start"`,
`origin-top-left` would be exact.

---

## 12. Expand chevron ⚠️ minor

**Where:** [expand-chevron.tsx:14-16](components/atoms/expand-chevron.tsx#L14-L16)
`transition-transform` (no duration → Tailwind's 150ms default) + `rotate-180`, and a colour change
to `text-brand-ink` when open.

⚠️ **The colour isn't in the transition list.** `transition-transform` covers only the rotation, so
the chevron *rotates* smoothly while its colour *teleports* — a small seam on a very frequent
interaction (§8). **Change:** `transition-[transform,color]`.
⚠️ Implicit duration/curve — §7 wants these tokenised. 150ms is a fine value; it just isn't a
decision anyone made.

---

## 13. ⚠️ Charts — uncontrolled library animation

**Where:** [category-pie-chart.tsx:26-39](components/organisms/category-pie-chart.tsx#L26-L39),
[monthly-bars-chart.tsx:53-85](components/organisms/monthly-bars-chart.tsx#L53-L85)

Neither chart passes `isAnimationActive`, so both inherit Recharts' defaults. Verified in
`node_modules/recharts`:

| Component | `isAnimationActive` | `animationDuration` | `animationEasing` |
| --- | --- | --- | --- |
| `Pie` | `'auto'` (on) | **1500ms** | `'ease'` |
| `Bar` | `'auto'` (on) | 400ms | `'ease'` |

⚠️ **1500ms is 5× the UI budget** (§2) and nobody chose it. Worse, it *compounds* with the wrapper:
the pie chart's `AnimatedContent` slides and fades for 1000ms after a `n×0.06+0.1` delay, while the
arcs independently sweep for 1500ms on their own clock. Two uncoordinated animations on one element.
⚠️ **`'ease'` on an entrance** is §2's hunt target — it's ease-in-out, so it starts slow, delaying
the moment the user is actually watching.
⚠️ **No reduced-motion gating at all.** Every other animation in this codebase respects
`prefers-reduced-motion`; Recharts doesn't, and nothing overrides it. A user with reduced motion set
still gets a 1.5s arc sweep. This is the clearest §6 violation in the project.
⚠️ Recharts animates via JS/rAF — §5 prefers CSS for predetermined motion.

**Change:** pass `isAnimationActive={false}` to `Pie` and `Bar` and let the existing
`AnimatedContent` wrapper own the entrance — one animation per element, one clock, inside budget,
and reduced-motion-correct for free. If you want the arcs to draw, gate it on a
`useReducedMotion()` check and cap it at 300ms.

⚠️ **Bar selection state teleports** ([monthly-bars-chart.tsx:74-84](components/organisms/monthly-bars-chart.tsx#L74-L84)):
clicking a bar swaps `fill`, `fillOpacity` and a `drop-shadow` filter with no transition, and the
label and axis tick swap weight/colour instantly. §8 — a state change the user initiated, rendered
as a hard cut. **Change:** a 150ms `fill-opacity` transition on the cells.

---

## 14. ⚠️ Progress bar — no animation at all

**Where:** [progress-bar.tsx:28-31](components/atoms/progress-bar.tsx#L28-L31)
`style={{ width: `${width}%` }}`, no transition.

The budget bar jumps instantly to its new width whenever an expense is added, edited or deleted —
and it can change colour band (`ok` → `warning` → `exceeded`) in the same jump.

⚠️ §8 missed opportunity, and a good one: this is a user-initiated state change with a meaningful
magnitude, currently rendered as a teleport. It's also the one place in the app where motion would
genuinely *explain* something — how much of the budget that expense just consumed.
**Change:** animate `transform: scaleX()` (not `width` — §5) over ~300ms `--ease-out`, with the
colour transitioning alongside. Worth doing *because* it has a purpose, unlike the hero count-up.

---

## 15. Hero card state transition ✅

**Where:** [globals.css:243-285](app/globals.css#L243-L285)
`.hero-card`: `border-color, background, box-shadow` 400ms `ease-out`.
`.hero-value`: `color, text-shadow` 400ms `ease-out`.
Triggered by `.hero-card--negative` when the free margin goes below zero.

✅ **Correct purpose (§1):** this is state indication — the card shifts to the destructive palette
when you cross into negative margin. Exactly what animation is for.
✅ `ease-out` is right (§2).
✅ No reduced-motion gate, and that's correct — §6 says keep colour/opacity changes that aid
comprehension; there's no movement here to remove.

⚠️ 400ms is over §2's 300ms. Minor — this is a rare, meaningful transition, so it's the most
defensible overage in the codebase. **Change:** 300ms, or leave it.
⚠️ `background` (a gradient), `box-shadow` and `text-shadow` are all paint properties (§5). Hard to
avoid for a palette shift, and it fires rarely. Noting, not proposing.

---

## 16. 🔒 Brushed metal background — no motion today

**Where:** [globals.css:226-241](app/globals.css#L226-L241)
Light: four stacked `radial-gradient`s + a `linear-gradient`. Dark: a
`repeating-linear-gradient` streak pattern (1px streaks every 6px) over a five-stop gradient.
`background-attachment: fixed`. **Currently static — no animation.**

✅ Nothing to audit yet, and the material itself is a locked decision.

🔒 **Proposal — read this before adding the planned slow movement.** A§14 warns specifically
against three things that the planned motion would hit:
- *"avoid full-viewport moving backgrounds"* — this is exactly a full-viewport moving background;
- *"avoid slow looping oscillations (near 0.2 Hz / one cycle per 5s)"* — the frequency band most
  likely to cause discomfort, and the natural choice for "slow drift";
- the streak pattern is high-frequency (1px lines at 6px intervals), so any slow translation across
  it risks visible aliasing/shimmer, which A§11 flags as a frame-content problem.

If you still want it — and it's your locked call — the safe envelope is: animate `transform` on a
pseudo-element rather than `background-position` (§5), keep total travel under ~2% of viewport, use
a period well over 20s (far from 0.2 Hz), and hard-disable it under `prefers-reduced-motion`.

⚠️ **Separate, pre-existing finding:** `background-attachment: fixed` forces a repaint of the
full-viewport gradient stack on every scroll frame on mobile, and this app is mobile-first with a
`backdrop-filter` bar compositing on top of it during that same scroll. This is a real cost today,
before any animation is added. Worth measuring on a mid-range phone.

---

## 17. Minor / no action

- ✅ **`animate-spin` on `Loader2`** — [entry-sheet.tsx:281](components/organisms/entry-sheet.tsx#L281),
  [:320](components/organisms/entry-sheet.tsx#L320),
  [category-sheet.tsx:192](components/organisms/category-sheet.tsx#L192),
  [:329](components/organisms/category-sheet.tsx#L329). Tailwind's 1s `linear` infinite. §2 says
  constant motion → `linear`. Correct. No change.
- ⚠️ **`transition-all` in [button.tsx:7](components/ui/button.tsx#L7)** — §5 finding, no duration
  specified (150ms default). This component isn't on the dashboard path (the dashboard uses raw
  buttons with `pressable`), so it's low priority, but it's the shared primitive and will spread.
  **Change:** `transition-[background-color,border-color,box-shadow]`.
- **[app/page.tsx:43](app/page.tsx#L43), [:58](app/page.tsx#L58)** — `transition-colors` on the
  untouched `create-next-app` boilerplate. Per CLAUDE.md this page is due to be replaced. Ignore.
- **`.hero-card::after`** — a 150px orb at `filter: blur(32px)`. Static, so §5's 20px
  transition-time ceiling doesn't apply. No change.

---

## Summary — proposed changes by priority

*Re-ranked by leverage (impact ÷ effort) and re-severitied after the correction pass, using the
table format from `improveanimations.md` Phase 3.*

### HIGH — feel-breaking
| # | Category | Location | Finding | Fix summary |
| --- | --- | --- | --- | --- |
| 1 | Purpose & frequency | `animated-content.tsx` + 8 sites in `dashboard-template.tsx` | Scroll-reveal system on functional UI visited daily — `recipies.md` says marketing surfaces only | Remove the reveals; at most one 200ms fade on first paint |
| 2 | Cohesion | [dashboard-template.tsx:381-389](components/templates/dashboard-template.tsx#L381-L389) | **Your Q1** — card entry order inverted: top card delayed 0.48s, rest at 0, on two different triggers | One trigger + `0.48 + min(index,5)*0.05`, or fold into #1 |
| 3 | Accessibility / duration | [category-pie-chart.tsx:26](components/organisms/category-pie-chart.tsx#L26), [monthly-bars-chart.tsx:53](components/organisms/monthly-bars-chart.tsx#L53) | Recharts defaults: 1500ms `ease` on `Pie`, no reduced-motion gating anywhere | `isAnimationActive={false}`; let the wrapper own the entrance |
| 4 | Performance | [animated-content.tsx:141](components/ui/animated-content.tsx#L141) | Whole dashboard is `visibility: hidden` until JS runs | Render visible; opt into motion via `data-mounted` / `@starting-style` |
| 5 | Interruptibility | [swipe-to-delete.tsx:64-74](components/molecules/swipe-to-delete.tsx#L64-L74), [:113-119](components/molecules/swipe-to-delete.tsx#L113-L119), [:136-139](components/molecules/swipe-to-delete.tsx#L136-L139) | No velocity dismissal, no multi-touch guard, 470ms of hardcoded `wait()` on the delete path | `velocity > 0.11` clause; early-return on second pointer; drive off `transitionend` |

### MEDIUM — noticeably off
| # | Category | Location | Finding | Fix summary |
| --- | --- | --- | --- | --- |
| 6 | Cohesion & tokens | [globals.css:177](app/globals.css#L177) + 3 files | No `ease-out`/`ease-in-out`/`ease-drawer` tokens; drawer curve hand-typed 3× | Add the three tokens; replace the literals |
| 7 | Performance / duration | [collapsible.tsx:15](components/atoms/collapsible.tsx#L15) | 500ms layout animation on the app's most common interaction (technique itself is sanctioned) | 200ms `--ease-out`, add the recipe's `opacity` half |
| 8 | Easing & duration | [dashboard-template.tsx:207-229](components/templates/dashboard-template.tsx#L207-L229) | Sticky bar swaps at 500ms `ease-spring`; spring on an opacity fade is inert | 200ms `--ease-out` ×3 |
| 9 | Interruptibility | [account-menu.tsx:31](components/organisms/account-menu.tsx#L31), [:36](components/organisms/account-menu.tsx#L36), [:215](components/organisms/account-menu.tsx#L215) | 700ms content blocks, 500ms thumb, and a keyframe force-restarted via `key=` | 250ms / 200ms; convert the pop to a transition |
| 10 | Performance | [month-picker.tsx:56](components/molecules/month-picker.tsx#L56), [:95](components/molecules/month-picker.tsx#L95), [button.tsx:7](components/ui/button.tsx#L7) | `transition: all` ×3 — one on a `liquid-glass` surface, animating `backdrop-filter` off-GPU | Name the exact properties |
| 11 | Easing | [sheet-shell.tsx:104](components/organisms/sheet-shell.tsx#L104) | Sheet enter uses `ease-spring`; recipe specifies `--ease-drawer` (500ms duration is already correct) | Swap the curve only |
| 12 | Easing | [sheet-shell.tsx:106](components/organisms/sheet-shell.tsx#L106), [:112](components/organisms/sheet-shell.tsx#L112), [account-menu.tsx:159](components/organisms/account-menu.tsx#L159) | `ease-in` on three exits (the swipe one is excluded — DESIGN.md documents it) | `--ease-out`, or mirror the enter curve |
| 13 | Easing & duration | [globals.css:200](app/globals.css#L200) | `pressable` at 200ms with an overshoot curve on press-down | 160ms `--ease-out` (exact recipe value) |

### LOW — polish
| # | Category | Location | Finding | Fix summary |
| --- | --- | --- | --- | --- |
| 14 | Duration | [undo-toast.tsx:13](components/molecules/undo-toast.tsx#L13), [demo-toast.tsx:21](components/molecules/demo-toast.tsx#L21) | 500ms `ease-spring`; recipe specifies 400ms `ease` for toasts specifically | 500 → 400ms, spring → `ease` |
| 15 | Cohesion | [account-menu.tsx:171](components/organisms/account-menu.tsx#L171), [:270](components/organisms/account-menu.tsx#L270) | 500ms `ease-bounce` hover flourishes; 12.6% overshoot vs. a "methodical, discreet" brief | 150ms `ease`, drop the bounce |

### Missed opportunities — additive, not corrective
| # | Opportunity | Location | Why it earns its place |
| --- | --- | --- | --- |
| A1 | **Progress bar teleports** on every budget change | [progress-bar.tsx:28](components/atoms/progress-bar.tsx#L28) | The one place motion would genuinely *explain* something — how much of the budget that expense just ate. Animate `transform: scaleX`, ~300ms |
| A2 | Free margin animates **on change**, not on load | [free-margin-card.tsx:16](components/organisms/free-margin-card.tsx#L16) | My counter-proposal to the count-up — a real state change that currently teleports (§3) |
| A3 | Bar chart selection swaps fill + drop-shadow with a hard cut | [monthly-bars-chart.tsx:74-84](components/organisms/monthly-bars-chart.tsx#L74-L84) | User-initiated state change rendered as a teleport; 150ms `fill-opacity` |
| A4 | Expand chevron's colour teleports while its rotation animates | [expand-chevron.tsx:14](components/atoms/expand-chevron.tsx#L14) | `transition-transform` omits `color` — a visible seam on a constant interaction |

### 🔒 Proposals only — flagged, not to be applied
| # | Note | Section |
| --- | --- | --- |
| P1 | Planned brushed-metal movement hits three explicit A§14 warnings; safe envelope suggested | §16 |
| P2 | `background-attachment: fixed` repaint cost on mobile scroll (pre-existing, today) | §16 |
| P3 | Sticky bar's 1px `border-bottom` vs A§12's scroll-edge mask | §4 |
| P4 | Stacked translucency: `liquid-glass` over `backdrop-blur` scrim (A§12) | §5 |
| P5 | Replacing GSAP/ScrollTrigger with `@starting-style` — now folded into HIGH #1 and #4 | §1 |

### 📝 Settled decisions — noted, deliberately not reported
Per `improveanimations.md` Hard Rule 5. These conflict with AUDIT in places; they are documented
choices and I'm leaving them alone unless you reopen them.

| Decision | Documented in |
| --- | --- |
| AddRow's 400ms spring hover ("growing and turning 90° with spring motion") | DESIGN.md § Add Rows |
| Swipe removal at 220ms linear `ease-in` | DESIGN.md § Swipe Actions |
| Spring translate/opacity on the undo toast | DESIGN.md § Undo Toast |
| Sticky bar transparent → frosted; floating translucent sheets; swipe-left + long-swipe; brushed metal | Your four locked constraints |

### What's already right — don't touch
The sheet gesture layer (`data-swiping`, swipe-progress-bound backdrop, velocity-scaled exit), the
toasts' reduced-motion handling (the reference pattern in this codebase), the theme-switch
clip-path reveal, `pressable`'s press-down feedback, `animate-spin`, and the hero card's
state-driven palette shift.

---

## How to proceed

**Nothing in `app/`, `components/` or `lib/` has been changed.** Audited at commit `2a05d56`.

Three things need your call before I go further:

1. **Which items.** Give me numbers — e.g. "HIGH 1–5, MEDIUM 6–8" — and I'll do those only.
   Note that **HIGH #1 subsumes #2 and #4**: if you accept removing the scroll reveals, your
   category-card ordering question resolves as a side effect and there's nothing left to stagger.
   If you'd rather keep the reveals, take #2 on its own and I'll fix the ordering in place.

2. **A1/A2 (the hero).** I'd still like your answer on §3 — count-up on load (against my
   recommendation, which I'll implement if you want it) versus on change only.

3. **Direct edits, or plan files?** `improveanimations.md` Hard Rule 1 says this skill never
   modifies source and writes plans into `plans/` instead; your Step 2 says tell you which ones and
   go ahead. Your instruction wins unless you say otherwise, so my default is **direct edits to the
   working tree**, verified with a build plus before/after screenshots in both themes. If you want
   Phase 4 plan files instead, say so — but `PLAN-TEMPLATE.md` is referenced at
   `improveanimations.md:26` and doesn't exist in `motion-skills/`, so I'd need it or your
   permission to use a sensible structure. (`plans/` doesn't exist yet either, so the path is free.)

Whichever items you pick, several are feel-dependent and can't be settled from code alone — the
sticky-bar crossfade, the swipe settle spring, and the `Collapsible` opacity/height balance. I'll
flag those after implementing and check them at 2–5× duration in the animation inspector rather
than declaring them done on the values alone.
