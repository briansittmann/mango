---
name: Mango Finance
colors:
  surface: '#101511'
  surface-dim: '#101511'
  surface-bright: '#353a36'
  surface-container-lowest: '#0a0f0c'
  surface-container-low: '#181d19'
  surface-container: '#1c211d'
  surface-container-high: '#262b27'
  surface-container-highest: '#313631'
  on-surface: '#dfe4dd'
  on-surface-variant: '#c1cab0'
  inverse-surface: '#dfe4dd'
  inverse-on-surface: '#2c322d'
  outline: '#8b947d'
  outline-variant: '#424936'
  surface-tint: '#91db2a'
  primary: '#9ee939'
  on-primary: '#1f3700'
  primary-container: '#84cc16'
  on-primary-container: '#315200'
  inverse-primary: '#416900'
  secondary: '#4de082'
  on-secondary: '#003919'
  secondary-container: '#00b55d'
  on-secondary-container: '#003e1c'
  tertiary: '#a5e837'
  on-tertiary: '#213600'
  tertiary-container: '#8acb12'
  on-tertiary-container: '#345100'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acf847'
  primary-fixed-dim: '#91db2a'
  on-primary-fixed: '#102000'
  on-primary-fixed-variant: '#304f00'
  secondary-fixed: '#6dfe9c'
  secondary-fixed-dim: '#4de082'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#005227'
  tertiary-fixed: '#b2f746'
  tertiary-fixed-dim: '#98da27'
  on-tertiary-fixed: '#121f00'
  on-tertiary-fixed-variant: '#334f00'
  background: '#101511'
  on-background: '#dfe4dd'
  surface-variant: '#313631'
typography:
  display:
    fontFamily: Manrope
    fontSize: 58px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-mobile:
    fontFamily: Manrope
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.035em
  headline-lg:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Manrope
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  tabular-numeric-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  tabular-numeric-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.01em
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-ui:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-base: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 2.5rem
  space-4xl: 3rem
  sheet-corner: 1.75rem
  row-min-height: 3rem
  handle-width: 2.25rem
  handle-height: 0.25rem
  gutter: 1rem
  section: 2rem
  stack: 0.75rem
  inset: 1rem
  row: 3rem
  target: 2.75rem
---

## Brand & Style

This design system delivers a high-precision, tactile personal finance experience engineered for clarity, financial discipline, and speed. It merges the focused legibility of Swiss utilitarian typography with high-contrast tactical dark-mode ergonomics.

The visual style is **Tactile Minimalism & Dark Precision**:
- **Atmosphere:** Deep brushed-metal surfaces that eliminate eye strain during dense financial analysis, contrasted with piercing lime accents that direct attention to key indicators, net-worth trajectories, and actionable signals.
- **Tone:** Methodical, unyielding, reliable, and discreet. Financial telemetry is treated with structural seriousness rather than decorative whimsy.
- **Emotional Output:** Composure, absolute control, and instant comprehension of wealth flows without extraneous visual noise.

## Colors

The palette operates across two deliberate environments:

### Dark Mode (Default)
- **Base Canvas (`#0D110E`):** Deep, ultra-low-luminance background providing total optical depth.
- **Card & Container Surfaces (`#131814` to `#19201A`):** Low-contrast brushed-metal dark tints separating data modules without harsh borders.
- **Structural Outlines (`#232B24`):** Hairline borders framing interactive areas and modular grids.
- **Accents:** Electric Lime (`#84CC16`), Neon Accent (`#A3E635`), and Positive Growth Green (`#4ADE80`) serve as high-visibility catalysts for balances, trend badges, toggle active states, and focus halos.
- **Typography:** Crisp off-white (`#F3F4F6`) for numerical balances and headers; muted slate-tinted secondary gray (`#9CA3AF`) for labels, timestamps, and metadata.
- **Critical Signals:** Negative Delta/Destructive Red (`#EF4444`).

### Light Mode
- **Canvas (`#F4F7F4`):** Crisp, desaturated cool sage-frosted backdrop.
- **Surfaces (`#FFFFFF` & `#E8EFE8`):** Clean white sheet cards with pale elevated containers.
- **Accents:** Darker foliage green (`#65A30D`) and emerald growth (`#16A34A`) to maintain WCAG AAA contrast ratios on light backdrops.

### Rules of Engagement
1. Accent colors (`#84CC16`, `#A3E635`) are reserved strictly for positive fiscal delta, primary actions, and dynamic indicators—never for decorative fill washes.
2. Destructive actions (`#EF4444`) must never share real estate with primary green indicators to avoid alert fatigue.

## Typography

Typography balances structural authority with numerical legibility:
- **Headlines (`Manrope`):** Distinct geometric structure with soft rounded terminals that preserve character in big balance readouts, account overviews, and modal sheet headings.
- **Body & Tabular Telemetry (`Inter`):** Systematic, highly neutral, with mandatory tabular lining figures (`font-variant-numeric: tabular-nums`) across all data displays, transaction feeds, currency symbols, and percentage deltas.
- **Micro-Copy (`label-caps`):** Rendered in uppercase with +0.06em tracking for category categorizations, sheet section headers, and field indicators.

## Hierarchy

- Six sizes at most are visible on a mobile screen at once.
- Uppercase labels mark metadata only — never titles or values.

## Layout & Spacing

The layout is constructed on a 4px/8px base rhythm, prioritizing mobile-first tactile reachability.

### Grid & Ergonomics
- **Mobile Grid:** Single fluid column with 16px lateral guttering (`space-base`), scaling to 20px on wide viewports.
- **Tablet/Desktop Frame:** Fixed modular width maximum of 640px for focused single-task sheets, or a 12-column dashboard layout (24px gutter, 32px margin) with a max-width container of 1140px.
- **Touch Targets:** Absolute minimum target size of 44px, standard transaction rows enforced at a minimum height of 48px (`row-min-height: 3rem`).
- **Dense Grouping:** Related financial input fields and settings rows sit grouped inside unified container blocks rather than isolated floating elements.

## Elevation & Depth

Visual hierarchy uses tonal surface progression combined with low-contrast structural boundaries rather than heavy, muddy drop shadows:

- **Level 0 (Base Canvas):** Solid `#0D110E` (Dark) / `#F4F7F4` (Light). Completely flat ground.
- **Level 1 (Card/Container Surfaces):** Surface background `#131814` with a hairline stroke `1px solid #232B24`. No ambient blur required.
- **Level 2 (Active/Selected Items & Sticky Bars):** Elevated surface `#19201A` with top subtle highlight `inset 0 1px 0 0 rgba(255, 255, 255, 0.05)`.
- **Level 3 (Mobile Sheets & Modals):**
  - Frosted dimmed scrim: `rgba(0, 0, 0, 0.65)` layered with `backdrop-filter: blur(12px)`.
  - Sheet container: `#131814` background with `1px solid #232B24`, and an ultra-diffused shadow `0 -12px 32px rgba(0, 0, 0, 0.4)`.

## Shapes

The design system adopts **Level 3 (Pill-shaped)** ergonomics, balancing rounded silhouettes with sharp tabular grids:
- **Buttons, Badges & Toggles:** Fully pill-shaped (`rounded-full` / 9999px) to establish clear interactive affordance.
- **Containers & Master Cards:** 1rem (`16px`) inner radius to 1.25rem (`20px`) outer radius.
- **Bottom Sheets:** Distinct asymmetrical rounding with top corners at `28px` (`1.75rem`), flat bottom edges adhering to device edges.
- **Drag Handle:** Rounded pill strip measuring 36px wide by 4px high (`handle-width` x `handle-height`), centered 8px below the sheet apex.

## Materials

Translucency is an allowlist, not a default: the scrolled top bar (`.glass-bar`) and the month picker/account sheet dialogs are the only frosted surfaces. The month title, notice, hero, summary group, cards and charts stay opaque tokens with no `backdrop-filter`.

## Components

### Bottom Sheets & Modals
- **Backdrop:** Dimmed screen scrim with a 12px Gaussian blur.
- **Container Geometry:** Top-left and top-right radii set to `28px`. Background of brushed `#131814`.
- **Drag Pill Handle:** Centered horizontally, dimensions 36px × 4px, `#374151` neutral muted color, positioned 10px from the sheet's top edge.
- **Header:** Sticky top section displaying a centered or left-aligned `headline-sm` with a secondary dismiss icon button top-right.

### Structured List Rows
- **Dimensions:** Strict minimum height of 48px (`3rem`), vertical padding of 12px, horizontal padding of 16px.
- **Divider:** 1px hairline border `#232B24` inset by 16px from the left edge to align directly under typography, avoiding boundary collisions with leading icons.
- **Content Alignment:**
  - Left zone: Category iconography (32px circular pill container with `#19201A` fill) paired with two-tier text (Title in `#F3F4F6`, subtitle in `#9CA3AF`).
  - Right zone: Aligned controls including segmented toggles, chevrons (`#9CA3AF`), currency value pills (`+ $1,420.00` in `#4ADE80`), or status badges.

### Controls & Interactive Badges
- **Segmented Tabs:** Enclosed pill track (`#19201A`, 4px padding) with active pill tab in `#232B24` or lime tint (`#84CC16` with `#0D110E` black text).
- **Toggles:** 50px × 28px pill track. Inactive track `#1F2923`; active track `#84CC16`. Thumb indicator is crisp white `#FFFFFF` with micro-drop shadow.
- **Color Swatch Pickers:** Horizontal scroll of 28px circular tokens with a 2px inner selection gap and a 2px active accent ring.

### Buttons & Inputs
- **Primary Button:** Full pill shape, height 48px, background `#84CC16`, text `#0D110E` (bold weight). Hover state transitions to `#A3E635`.
- **Secondary / Ghost Button:** Hairline border `1px solid #232B24`, background `#131814`, text `#F3F4F6`.
- **Destruction Rows:** Isolated row item or bottom button styling with `#EF4444` text and red-tinted background hover states (`rgba(239, 68, 68, 0.08)`), demarcated by full-width hairline dividers.
- **Input Fields:** 48px height, rounded-xl (16px), background `#19201A`, border `1px solid #232B24`. Active focus state triggers an outer outline in `#84CC16` with zero displacement.

### Add Rows
- **Anatomy:** A Structured List Row whose leading element is a `28px` circular badge holding a `16px` plus icon, followed by the label in brand ink; same 48px minimum height and inset hairline as the rows above it.
- **Rest / Hover:** Transparent row with a brand-tinted badge (`#84CC16` at 15% opacity) at rest; on pointer hover the row tints like its sibling rows and the badge fills solid brand (`#84CC16`) with the plus in `#0D110E`, growing and turning 90° with spring motion.
- **Pressed / Reduced motion:** Pressing deepens the row tint beyond hover and shrinks the badge; under reduced motion the badge stops growing and the plus stops turning, but the colour change still applies.
- **Contrast:** Label reaches at least 4.5:1 against the card, and the plus at least 3:1 against the badge, in both themes.
