## Purpose

Visual theming for the web app: every colour comes from a light and a dark token set, category colours are stored by palette name and resolved per theme, and the user picks light, dark or automatic.

## ADDED Requirements

### Requirement: Colours come from theme tokens
Every colour used by application components SHALL come from a named theme token that has a value for both the light and the dark theme. Components SHALL NOT contain literal colour values (hex, rgb/rgba, hsl, or fixed white/black utilities). The base tokens SHALL use the confirmed palette from ARCHITECTURE.md §9: dark background `#0D100D`, surface `#171A17`, border `#262A26`, text `#F2F5F2`, muted `#8A918A`; light background `#FAFBFA`, surface `#FFFFFF`, border `#E6E9E6`; brand lime `#C3E86B`, warning amber `#F0B429`, danger red `#E5484D`.

#### Scenario: Scan for literal colours
- **WHEN** the dashboard component sources are searched for hex, rgb/rgba/hsl values or white/black colour utilities
- **THEN** no match is found

#### Scenario: Readable text in light theme
- **WHEN** the light theme is active
- **THEN** body text, muted text and brand-coloured text each meet a 4.5:1 contrast ratio against the surface they sit on

### Requirement: Category colours resolve per theme
A category's colour SHALL be identified by one of the eight stored palette names (`naranja_calido`, `verde_profundo`, `azul_apagado`, `gris_calido`, `violeta_metalico`, `gris_oscuro`, `blanco`, `granate`). Each name SHALL resolve to a value defined separately for each theme. Brand lime, warning amber and danger red SHALL NOT be available as category colours.

#### Scenario: White category in light theme
- **WHEN** a category with colour `blanco` is shown in the light theme
- **THEN** its dot and pie slice stay visible against the card surface

#### Scenario: Theme change recolours categories
- **WHEN** the user switches from dark to light
- **THEN** every category dot and pie slice updates to its light-theme value without reloading

### Requirement: Theme selection
The account menu SHALL offer light, dark and automatic themes. Automatic SHALL be the default and SHALL follow the operating-system preference, including changes made while the page is open. The choice SHALL persist in the browser across reloads.

#### Scenario: Choose light on a dark OS
- **WHEN** the operating system prefers dark and the user selects light, then reloads
- **THEN** the page is light after the reload

#### Scenario: Automatic follows the OS
- **WHEN** the theme is automatic and the operating-system preference changes from light to dark
- **THEN** the page switches to dark without a reload

### Requirement: No wrong-theme flash
On a full page load, the page SHALL paint in the persisted theme from the first frame and SHALL NOT log a hydration mismatch.

#### Scenario: Reload with stored light theme
- **WHEN** light is stored, the operating system prefers dark, and the page is hard-reloaded
- **THEN** no dark frame is painted before the light theme, and the console shows no hydration error

### Requirement: Hero glow only in dark theme
The free-margin number and the current cycle's chart bar SHALL show a brand-coloured glow only in the dark theme.

#### Scenario: Light theme hero
- **WHEN** the light theme is active
- **THEN** the free-margin number has no glow
