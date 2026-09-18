## MODIFIED Requirements

### Requirement: Hero glow only in dark theme
The free-margin number, the free-margin card's corner glow and top highlight, and the current cycle's chart bar SHALL show a brand-coloured glow only in the dark theme. No other element SHALL have a glow, text shadow or drop-shadow filter in either theme. In the light theme, the free-margin card's surface SHALL be derived only from the card and brand theme tokens.

#### Scenario: Light theme hero
- **WHEN** the light theme is active
- **THEN** the free-margin number, the free-margin card and the current cycle's bar show no glow
- **AND** the card's background colours are mixes of the card and brand tokens only

#### Scenario: Dark theme hero
- **WHEN** the dark theme is active
- **THEN** the free-margin number has a brand-coloured glow and the free-margin card shows a brand-coloured corner glow

#### Scenario: No other glow
- **WHEN** the dark theme is active and every summary panel and card has been opened in turn
- **THEN** no text other than the free-margin number has a text shadow, and no chart bar other than the current cycle's has a drop-shadow filter
