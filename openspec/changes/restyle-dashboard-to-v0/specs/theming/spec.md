## MODIFIED Requirements

### Requirement: Colours come from theme tokens
Every colour used by application components SHALL come from a named theme token that has a value for both the light and the dark theme. Components SHALL NOT contain literal colour values (hex, rgb/rgba, hsl, or fixed white/black utilities). The base tokens SHALL use the confirmed palette from ARCHITECTURE.md §9 and the v0 reference: dark background `#0D100D`, surface `#171A17`, border `#262A26`, text `#F2F5F2`, muted `#8A918A`, muted surface `#202520`; light background `#FAFBFA`, surface `#FFFFFF`, border `#E6E9E6`, text `#171A17`, muted surface `#F1F4F1`; brand lime `#C3E86B`, warning amber `#F0B429`, danger red `#E5484D`.

#### Scenario: Scan for literal colours
- **WHEN** the dashboard component sources are searched for hex, rgb/rgba/hsl values or white/black colour utilities
- **THEN** no match is found

#### Scenario: Readable text in light theme
- **WHEN** the light theme is active
- **THEN** body text, muted text and brand-coloured text each meet a 4.5:1 contrast ratio against the surface they sit on, including the page background

#### Scenario: Readable text in dark theme
- **WHEN** the dark theme is active
- **THEN** body text, muted text and brand-coloured text each meet a 4.5:1 contrast ratio against the cards, the page background and the account sheet

### Requirement: Hero glow only in dark theme
The free-margin number, the free-margin card's corner glow and top highlight, and the current cycle's chart bar SHALL show a brand-coloured glow only in the dark theme.

#### Scenario: Light theme hero
- **WHEN** the light theme is active
- **THEN** the free-margin number, the free-margin card and the current cycle's bar show no glow

#### Scenario: Dark theme hero
- **WHEN** the dark theme is active
- **THEN** the free-margin number has a brand-coloured glow and the free-margin card shows a brand-coloured corner glow

## ADDED Requirements

### Requirement: Brushed page background
The page background SHALL be a diagonal gradient with fine directional streaks that stays fixed while the content scrolls. It SHALL be a dark gunmetal in the dark theme and a light silver in the light theme. Cards SHALL sit on it as solid or near-solid panels.

#### Scenario: Background follows the theme
- **WHEN** the user switches from dark to light
- **THEN** the page background changes from the dark gradient to the light gradient without a reload

#### Scenario: Background does not scroll
- **WHEN** the user scrolls the dashboard
- **THEN** the background gradient stays in place while the cards move

### Requirement: Theme-specific images
An image that has a light and a dark variant SHALL show exactly one variant, matching the active theme. The active theme is the explicit light or dark choice, or the operating-system preference when automatic. The variant SHALL update when the theme changes, without a reload, and SHALL be correct from the first paint.

#### Scenario: Stored dark theme on a light OS
- **WHEN** dark is stored, the operating system prefers light, and the page loads
- **THEN** only the dark logo variant is visible from the first paint

#### Scenario: Automatic follows the OS
- **WHEN** the theme is automatic and the operating-system preference changes from light to dark
- **THEN** the light logo is hidden and the dark logo is shown without a reload
