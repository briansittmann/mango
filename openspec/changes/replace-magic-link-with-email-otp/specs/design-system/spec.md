## ADDED Requirements

### Requirement: Active-field tokens
The appearance of a focused text field, and of the active cell of a code entry, SHALL come from named theme tokens: an active fill (brand tint over the field surface), a halo (the soft glow around the field), a border in the ring colour, a caret in the ring colour, and a neon glow colour for lights drawn in the brand colour (the light around a code cell's frame, the success glow). Components SHALL NOT set these values inline or with literal colours; a component that needs the halo, the fill or the glow SHALL reference the token. The tokens SHALL be defined for both themes: in the light theme the tint and the glow SHALL stay legible on the light surface, and in the dark theme they SHALL read as the neon treatment the amount field already has.

#### Scenario: The amount field and the active cell match
- **WHEN** the amount field of the entry sheet is focused on `/demo`, and separately the first cell of the code step is active on `/login?email=tu%40mail.com`, in each theme
- **THEN** the two compute the same border colour, the same background colour and the same box shadow within that theme, and the input's computed caret colour is the ring colour in both

#### Scenario: No literal colours in the code entry
- **WHEN** the source of the code-entry component and its styles is searched for hex, `rgb(` and `rgba(` literals
- **THEN** no match is found

#### Scenario: Tokens exist in both themes
- **WHEN** the active fill, halo and neon glow tokens are read from the root element in the light theme and in the dark theme
- **THEN** each resolves to a non-empty value in both, and the two themes resolve to different values
