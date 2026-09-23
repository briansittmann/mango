# savings-editing Specification

## Purpose
Lets the user record a savings deposit or withdrawal from the savings panel, through an injected operation every data source implements alike, and defines what a recorded movement moves on the dashboard.

## Requirements

### Requirement: Savings changes go through an injected operation
The dashboard SHALL add savings movements only through a savings operation supplied by the page that mounts it. The dashboard SHALL NOT know which data source is behind it.

The operation SHALL take:
- the movement type, deposit or withdrawal
- a name, trimmed, never empty
- an amount greater than 0
- a calendar date inside the displayed cycle

It SHALL resolve once the movement is durable, and SHALL reject with nothing changed. A withdrawal SHALL be recorded as a savings movement with a negative amount; a deposit with a positive one. The caller SHALL never pass a signed amount: the sign comes from the type.

Every data source SHALL implement it with the same inputs and outcomes. When the page supplies no savings operation, the "add savings movement" row SHALL be disabled (`dashboard-ui` → *Controls without a handler are disabled*).

#### Scenario: A withdrawal reaches the operation as a positive amount and a type
- **WHEN** a recording implementation of the savings operation is mounted and the user saves a withdrawal of 30 named "Viaje" dated 12 September 2026
- **THEN** the recorder receives one call with the withdrawal type, "Viaje", 30 and 2026-09-12

#### Scenario: No operation, no sheet
- **WHEN** the dashboard is mounted without a savings operation
- **THEN** the "Añadir movimiento de ahorro" row is disabled and activating it opens nothing

### Requirement: The add-movement sheet
Activating "Añadir movimiento de ahorro" in the savings panel SHALL open a bottom sheet with the same structure, dismissal, focus return, busy behaviour and error handling as the entry sheet in create mode (`expense-editing` → *Saving, dismissal and errors*). It SHALL have no delete action and no recurrence control.

It SHALL be titled "Nuevo movimiento de ahorro" and its primary action SHALL read "Añadir". Its fields, top to bottom:

**Type:**
- A two-option segmented control, "Depósito" and "Retiro", exposed to assistive technology as a single-choice group.
- "Depósito" SHALL be selected every time the sheet opens.

**Amount:**
- The same field as the entry sheet: focus on open, decimal keypad on touch devices, comma or period as decimal separator, at most two decimals, greater than 0, currency symbol shown.
- It SHALL NOT accept a sign. The typed value SHALL be the magnitude for both types.

**Name:**
- Free text, required. Leading and trailing spaces SHALL be removed on save; a name that is empty after trimming SHALL be invalid.

**Date:**
- The cycle's today by default. Only days inside the displayed cycle SHALL be selectable.

**Validity:**
- While the amount or the name is invalid, the primary action SHALL be disabled.
- A submit attempt with an invalid amount (for example Enter in the amount field) SHALL save nothing, keep the sheet open and mark the amount field invalid, with the message stating that an amount above 0 with up to two decimals is expected.
- When the name field loses focus empty, it SHALL be marked invalid with a message stating a name is required.
- A withdrawal SHALL NOT be limited by the savings balance: it MAY leave the cycle's savings total or the accumulated balance below zero.

**On success** the sheet SHALL close and announce "Movimiento de ahorro añadido" to assistive technology.

#### Scenario: Defaults on open
- **WHEN** on `/demo` in Spanish the visitor opens the savings panel and activates "Añadir movimiento de ahorro"
- **THEN** a sheet titled "Nuevo movimiento de ahorro" is shown with "Depósito" selected, the amount field focused and empty, the name empty and the date set to the cycle's today

#### Scenario: Saving without an amount does nothing
- **WHEN** the visitor types a name, leaves the amount empty and presses Enter in the amount field
- **THEN** the sheet stays open, no movement is added, the savings total still reads 146 €
- **AND** the amount field is marked invalid and its message is shown

#### Scenario: Saving without a name is not possible
- **WHEN** the visitor types 50 as the amount and leaves the name empty
- **THEN** "Añadir" is disabled
- **AND** once the name field loses focus, a message under it states a name is required

#### Scenario: A withdrawal larger than the cycle's savings
- **WHEN** the visitor saves a withdrawal of 500 named "Coche"
- **THEN** the sheet closes and the savings column shows −354 €

### Requirement: A saved movement moves only savings figures and the free margin
After a movement is saved, the dashboard SHALL show figures recomputed from the resulting list of movements, not from the previously shown figures:
- the savings column's total: the sum of the cycle's signed movements
- the accumulated balance: the balance before the cycle plus that sum
- the last point of the savings history, equal to the accumulated balance
- the progress against the savings target, when one is set
- the free margin, as defined in `category-editing` → *A budget reserves its amount in the free margin*, in which savings enter with their whole signed amount, so a movement moves the free margin by exactly its signed amount in the opposite direction

The new movement SHALL be listed in the savings panel among the others in ascending date order, after any movement already listed on the same date, with the deposit or withdrawal marker and a signed amount; a withdrawal SHALL show the true minus sign U+2212, never a hyphen.

The savings total, the accumulated balance and the free margin SHALL animate from their previous value to the new one, and SHALL change without animation when the user prefers reduced motion.

No savings movement SHALL move an income or expense figure: the income total, the expenses total, card totals, budget bars, the charts and the `upcoming-charges` card SHALL stay as they were.

#### Scenario: A deposit of 50
- **WHEN** on `/demo` in Spanish, with savings at 146 €, the accumulated balance at 2.646 € and the free margin at 844 €, the visitor saves a deposit of 50 named "Extra"
- **THEN** the savings column shows 196 €, the accumulated balance 2.696 € and the free margin 794 €
- **AND** "Extra" is listed in the savings panel with "+50 €"
- **AND** the income total still shows 2.820 € and the expenses total 1.700 €

#### Scenario: A withdrawal of 30
- **WHEN** on `/demo` in Spanish the visitor saves a withdrawal of 30 named "Imprevisto"
- **THEN** "Imprevisto" is listed with "−30 €", its minus sign being U+2212
- **AND** the savings column shows 116 €, the accumulated balance 2.616 € and the free margin 874 €

#### Scenario: Date order
- **WHEN** the visitor saves a deposit dated 5 September 2026 while the panel lists movements dated 3, 8 and 9 September
- **THEN** the new movement is listed second

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion and saves a deposit of 50
- **THEN** the savings total, the accumulated balance and the free margin show their new values without an animated transition
