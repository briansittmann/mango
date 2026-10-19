# Localization Specification

## Purpose

Language support for the web app: every interface string lives in translation files for Spanish and English, the user switches language at runtime, and amounts and dates follow the active locale.

## Requirements

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
Money SHALL be formatted for the active language in the user's currency, with a thousands separator on four-digit amounts, decimals only when the amount has cents, and the currency's narrow symbol (`€`, `$`, `£`, never a three-letter code) placed as the locale dictates. Argentine pesos in Spanish SHALL be laid out as in Argentina: the symbol first, a space, then the figure (`$ 350.000`); in English the symbol first with no space (`$350,000`). Dates SHALL be formatted for the active language in the user's timezone. Month names and compact chart figures SHALL follow the active language. Sentences that embed numbers SHALL handle plural forms.

When the account's effective amount format is abbreviated (*Amount format preference*), every displayed amount of 1 000 or more in absolute value SHALL be shown abbreviated and every amount below 1 000 as above:
- from 1 000 to below 999 950: the amount divided by 1 000, rounded half away from zero to one decimal, the decimal dropped when zero, followed by `k` with no space (`1.500 → 1,5k`, `12.345 → 12,3k`, `350.000 → 350k`, `1.000 → 1k`)
- from 999 950: the amount divided by 1 000 000 with the same rounding, followed by `M` (`999.950 → 1M`, `1.500.000 → 1,5M`, `12.345.678 → 12,3M`); from a thousand million the figure keeps its thousands separator (`2.500.000.000 → 2.500M`)
- never cents and never more than one decimal in an abbreviated figure; the decimal separator is the locale's
- the sign and the symbol stay where the full form puts them (`-$ 1,5M` in Spanish, `-$1.5M` in English)
Amount fields SHALL always show and accept the full number; only displayed amounts abbreviate. Compact chart figures keep their own convention.

#### Scenario: Euros in Spanish
- **WHEN** the language is Spanish, the currency is EUR, and the amounts are 2400, 62.4 and 820
- **THEN** they render as "2.400 €", "62,40 €" and "820 €"

#### Scenario: Euros in English
- **WHEN** the language is English, the currency is EUR, and the amount is 2400
- **THEN** it renders as "€2,400"

#### Scenario: Pesos in Spanish, complete
- **WHEN** the language is Spanish, the currency is ARS, the format is complete, and the amounts are 350000, -1500000.5 and 62.4
- **THEN** they render as "$ 350.000", "-$ 1.500.000,50" and "$ 62,40"

#### Scenario: Pesos in Spanish, abbreviated
- **WHEN** the language is Spanish, the currency is ARS, the format is abbreviated, and the amounts are 350000, 1500, 12345, 999950, 1500000, 2500000000, -1500000.5 and 62.4
- **THEN** they render as "$ 350k", "$ 1,5k", "$ 12,3k", "$ 1M", "$ 1,5M", "$ 2.500M", "-$ 1,5M" and "$ 62,40"

#### Scenario: Pesos in English, abbreviated
- **WHEN** the language is English, the currency is ARS, the format is abbreviated, and the amounts are 350000 and -1500000.5
- **THEN** they render as "$350k" and "-$1.5M"

#### Scenario: Fields keep the full number
- **WHEN** the format is abbreviated and the category sheet opens for a category with a budget of 350000
- **THEN** the budget field reads "350000" and accepts "400000"

#### Scenario: Date in user timezone
- **WHEN** an expense happened at 2026-09-02T23:30:00Z and the user's timezone is Europe/Dublin
- **THEN** its date shows 3 September, not 2 September

#### Scenario: Singular day
- **WHEN** a budgeted category has 1 day left in the cycle
- **THEN** the remaining-amount sentence uses the singular form of "day" in the active language

### Requirement: Amount format preference
Each account SHALL hold an amount format, complete or abbreviated, complete by default. The format in effect SHALL be the stored one only when the account's country is Argentina, and complete for any other country whatever is stored. The format in effect SHALL be supplied to the dashboard and the onboarding with the user's currency, and every amount they paint — the free margin and its counter, totals, rows, captions, the panels, the charts' values exposed as text, the sheets' displayed amounts — SHALL follow it; the demo and any mount that supplies no format SHALL use complete. The bot's replies SHALL follow the same format in effect for the account (`bot-transaction-logging`).

#### Scenario: Stored but not in effect
- **WHEN** an account stores the abbreviated format and its country is Uruguay
- **THEN** every amount is shown complete on the dashboard and in the bot's replies

#### Scenario: In effect
- **WHEN** an account in Argentina stores the abbreviated format and has a free margin of 1 180 000 pesos
- **THEN** the dashboard's free margin reads "$ 1,2M" and its counter rolls in the same unit, and a bot confirmation shows its amounts abbreviated

#### Scenario: Demo stays complete
- **WHEN** `/demo` is rendered in Spanish
- **THEN** the free margin reads "864 €" and no amount is abbreviated
