## Purpose

Language support for the web app: every interface string lives in translation files for Spanish and English, the user switches language at runtime, and amounts and dates follow the active locale.

## ADDED Requirements

### Requirement: Interface text comes from translation files
Every piece of interface text (labels, headings, button text, accessible names, notices and composed sentences) SHALL come from translation files, and no component SHALL contain user-visible literal text. Spanish and English SHALL provide the same set of keys. User-entered content (category names, expense names, income-source names, the user's name) SHALL be shown as stored and never translated.

#### Scenario: Missing English key
- **WHEN** a key exists in the Spanish translation file but not in the English one
- **THEN** the project type check fails

#### Scenario: Accessible names are translated
- **WHEN** the active language is English
- **THEN** the avatar button's accessible name and the month chevrons' accessible names are in English

#### Scenario: Category name stays as entered
- **WHEN** a user's category is named "comida" and the active language is English
- **THEN** the card shows "comida"

### Requirement: Runtime language switching
The application SHALL support Spanish (`es`) and English (`en`), with Spanish as the default. The account menu SHALL let the user switch between them. The new language SHALL apply to the whole page right away, persist across reloads in that browser, and leave the URL unchanged. An unsupported or missing stored value SHALL fall back to Spanish. The document's `lang` attribute SHALL match the active language.

#### Scenario: Switch to English
- **WHEN** the user on `/demo` selects English in the account menu
- **THEN** all interface text changes to English, the URL remains `/demo`, and `<html lang>` is `en`

#### Scenario: Language persists
- **WHEN** the user has selected English and reloads the page
- **THEN** the page renders in English on first paint

#### Scenario: Unsupported stored value
- **WHEN** the stored language value is `fr`
- **THEN** the page renders in Spanish

### Requirement: Locale-aware formatting
Money SHALL be formatted for the active language in the user's currency, with a thousands separator on four-digit amounts, decimals only when the amount has cents, and the currency symbol placed as the locale dictates. Dates SHALL be formatted for the active language in the user's timezone. Month names and compact chart figures SHALL follow the active language. Sentences that embed numbers SHALL handle plural forms.

#### Scenario: Euros in Spanish
- **WHEN** the language is Spanish, the currency is EUR, and the amounts are 2400, 62.4 and 820
- **THEN** they render as "2.400 €", "62,40 €" and "820 €"

#### Scenario: Euros in English
- **WHEN** the language is English, the currency is EUR, and the amount is 2400
- **THEN** it renders as "€2,400"

#### Scenario: Date in user timezone
- **WHEN** an expense happened at 2026-09-02T23:30:00Z and the user's timezone is Europe/Dublin
- **THEN** its date shows 3 September, not 2 September

#### Scenario: Singular day
- **WHEN** a budgeted category has 1 day left in the cycle
- **THEN** the remaining-amount sentence uses the singular form of "day" in the active language
