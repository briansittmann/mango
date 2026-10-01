## Purpose

The web onboarding: the seven screens a new account goes through after its first sign-in, before it reaches the dashboard — what each one asks and stores, how an abandoned onboarding resumes, the free margin that moves while budgets are typed, the theme control, the closing WhatsApp request, the in-memory sandbox, and the motion of it all.

## ADDED Requirements

### Requirement: The onboarding is one route with seven steps, resumed where it was left
The application SHALL serve `/onboarding` to a signed-in user whose account has not completed the onboarding. It SHALL present seven steps in this order and no other: welcome, basics, categories, income and fixed expenses, budgets, savings target, WhatsApp. Each step SHALL show exactly one primary action ("Empezar" on the first, "Continuar" on the second to sixth, "Vincular" on the last) and, from the second step on, a "Volver" control that returns to the previous step with everything it stored still in place. The steps for categories, income and fixed expenses, budgets and savings target MAY be continued with nothing entered.

The account SHALL remember its pending step. Moving forward or back SHALL store the step reached, so that reopening `/onboarding` — after a reload, a closed tab or days later — opens on the step the person was on, with the data stored so far shown in it. The URL SHALL stay `/onboarding` throughout: steps are not addresses.

Progress SHALL be visible and discreet: a thin line at the top whose length grows with the step, exposed to assistive technology as a progress value with the step's title as its text. No "step N of 7" text SHALL be shown.

#### Scenario: Resume on the pending step
- **WHEN** a person completes the basics step, continues to the categories step, adds "Comida", closes the tab and opens `/onboarding` again
- **THEN** the categories step is shown with "Comida" listed, and "Volver" returns to the basics step with the stored name, country and currency shown

#### Scenario: Back keeps what was stored
- **WHEN** on the income and fixed expenses step the person activates "Volver"
- **THEN** the categories step is shown with its categories listed, and the definitions added before are still listed when the person continues again

#### Scenario: Progress is a line, not a count
- **WHEN** the third step is shown
- **THEN** the progress line's exposed value is 3 and its text is the step's title, and no text on the page reads "3 de 7" or "3 of 7"

#### Scenario: Completed accounts never see it
- **WHEN** a signed-in user whose onboarding is complete opens `/onboarding`
- **THEN** they are redirected to `/dashboard`

### Requirement: Welcome without a loaded expense
The first step SHALL greet the person and say, in three short lines, what the next steps set up: categories, fixed income and expenses, and budgets that give a free margin. It SHALL NOT congratulate the person for loading an expense, SHALL NOT show the account's stored name, and SHALL contain no field. "Empezar" SHALL be usable from the first frame the step is shown.

#### Scenario: Welcome content
- **WHEN** a new account opens `/onboarding` for the first time
- **THEN** the welcome shows the logo, a greeting, three lines naming categories, fixed income and expenses, and budgets, and the "Empezar" action; no text says an expense was loaded, and the e-mail's local part is not shown

### Requirement: Basics — name, country, currency, format and cycle day
The basics step SHALL ask for: a name; a country, chosen from a fixed list shown with the names of the active language; a currency; a cycle start day from 1 to 28, 1 by default; and, only when the chosen country is Argentina, an amount format with two options, abbreviated and complete, labelled with the same figure in each form ("350k" and "350.000"), complete by default.

Choosing a country SHALL set the currency to that country's currency and SHALL set the account's timezone: the stored timezone is kept when it belongs to the chosen country, otherwise the country's main timezone is used. The currency SHALL stay changeable after the country sets it. A line under the country SHALL state the resulting currency and timezone in words.

On first display the country SHALL be preselected to the one the stored timezone belongs to, or left unselected when no country of the list holds it; "Continuar" SHALL be disabled while no country is selected or the name is empty. The name field SHALL be prefilled with the stored name only when it consists of letters and spaces; otherwise it SHALL be empty and show the stored name as its placeholder.

"Continuar" SHALL store the name, the country as its two-letter code, the currency, the timezone, the cycle day and the format, all at once, and SHALL store the abbreviated format only for Argentina; for any other country the stored format SHALL be complete whatever the control held before. A change of the cycle day SHALL be accepted only while the account holds no category, no recurring definition, no budget and no movement; afterwards the day field SHALL be shown disabled with a line saying it was fixed with the first category, and a request that still changes it SHALL be rejected with nothing stored. Changing the cycle day on a fresh account SHALL re-key nothing, because nothing is stored per cycle yet.

#### Scenario: Argentina
- **WHEN** the person chooses Argentina
- **THEN** the currency reads Argentine pesos, the line under the country names pesos and Buenos Aires time, and the format control appears with "350.000" selected and "350k" as the other option

#### Scenario: Ireland
- **WHEN** the person chooses Ireland
- **THEN** the currency reads euros, the line names euros and Dublin time, and no format control is shown

#### Scenario: Default country from the timezone
- **WHEN** the account's stored timezone is `America/Argentina/Cordoba` and the basics step is shown for the first time
- **THEN** Argentina is preselected and the stored timezone is kept

#### Scenario: Timezone follows the country
- **WHEN** the stored timezone is `Europe/Dublin` and the person chooses Spain
- **THEN** on "Continuar" the account's timezone is `Europe/Madrid` and its country `ES`

#### Scenario: Currency stays editable
- **WHEN** the person chooses Argentina and then changes the currency to euros
- **THEN** "Continuar" stores country `AR`, currency `EUR`, Buenos Aires time, and the format control is still shown

#### Scenario: Format is complete outside Argentina
- **WHEN** the person chose Argentina and "350k", goes back, changes the country to Uruguay and continues
- **THEN** the stored format is complete and no amount on later steps is abbreviated

#### Scenario: Cycle day on a fresh account
- **WHEN** a fresh account sets the cycle day to 28 and continues
- **THEN** the day is stored, no budget, category or movement row changes, and the later steps name the cycle that starts on the 28th

#### Scenario: Cycle day locked after a category exists
- **WHEN** the person has added a category, goes back to the basics step
- **THEN** the day field is disabled and shows the "fixed with the first category" line, and a request that changes the day is rejected with nothing stored

#### Scenario: Name from a handle
- **WHEN** the stored name is "brianrebadj+alta1"
- **THEN** the name field is empty with "brianrebadj+alta1" as its placeholder, and "Continuar" is disabled until a name is typed

### Requirement: Categories step
The categories step SHALL show a row of suggested category names in the active language and a composer with a name field and an "Añadir" action, followed by the account's categories, each with its colour dot and name. Tapping a suggestion SHALL create that category and remove the suggestion from the row; the composer SHALL create the typed name. Each category SHALL be created alive from the cycle in progress with no budget, in the first palette colour no category of the account uses, and a name already used by another category of the account, compared trimmed and case-insensitively, SHALL be refused with the duplicate-name message and nothing created. Tapping a listed name SHALL let the person rename it in place; tapping its dot SHALL open the colour choice; swiping a row SHALL delete the category with an undo, and SHALL refuse with a message when the category holds a recurring definition. Every category created, renamed, recoloured or deleted here SHALL be stored exactly as the dashboard's category operations store it.

#### Scenario: A suggestion becomes a category
- **WHEN** the person taps "Comida" in the suggestions
- **THEN** "Comida" is listed with the first palette colour, is no longer among the suggestions, and after a reload of the onboarding is still listed

#### Scenario: Colours follow the palette
- **WHEN** the person taps three suggestions in a row
- **THEN** the three categories carry the first three palette colours in order

#### Scenario: Duplicate name
- **WHEN** "Comida" exists and the person types " comida " in the composer and activates "Añadir"
- **THEN** the duplicate-name message is shown and no category is created

#### Scenario: Swipe to delete with undo
- **WHEN** the person swipes "Ocio", activates delete, then activates undo
- **THEN** "Ocio" is removed and then listed again, with its colour

#### Scenario: A category with a fixed expense cannot be swiped away
- **WHEN** "Vivienda" holds the "Alquiler" definition and the person swipes it and activates delete
- **THEN** a message says to remove its fixed expenses first and "Vivienda" stays listed

### Requirement: Income and fixed expenses step, and the charges of the cycle in progress
The income and fixed expenses step SHALL show two lists, income first: each with its rows (name, amount, day of the month, and the category dot on expense rows) and a composer with a name, an amount, a day from 1 to 31 and, for expenses, the choice of one of the account's categories. "Añadir" SHALL create a recurring definition of that type without an end and without a reminder, stored exactly as the dashboard's definition operation stores it. The expense composer SHALL be disabled with a line pointing to the categories step while the account has no category. Tapping a row SHALL open the definition sheet of the `recurring-expenses` capability, from which the definition is edited, stopped or deleted.

When the person continues from this step, and again when the onboarding completes, every active definition of the account SHALL have its charge of the cycle in progress stored as a pending movement — the same row the charge generation of `recurring-charge-generation` produces: the definition's amount, its day placed in the cycle, the account's currency, pending — without a second row for a definition that already has one in that cycle, and without changing the generation marker. A definition deleted here SHALL take its charge with it; an amount changed from the sheet SHALL change the pending charge, as in the dashboard. After the onboarding, a run of the charge generation for that cycle SHALL insert nothing for those definitions and SHALL count each one's repetition once.

#### Scenario: Income and fixed rows
- **WHEN** the person adds "Sueldo" 2 000 on day 1 under income and "Alquiler" 820 on day 1 in "Vivienda" under fixed expenses
- **THEN** both are listed in their list with amount and "día 1", "Alquiler" with Vivienda's dot, and after a reload both are still listed

#### Scenario: No category, no expense composer
- **WHEN** the account has no category
- **THEN** the expense composer is disabled and a line points to the categories step, and the income composer works

#### Scenario: The sheet edits a definition
- **WHEN** the person taps "Alquiler", changes the amount to 850 and saves
- **THEN** the row reads 850 and the cycle's pending charge of "Alquiler" is 850

#### Scenario: Pending charges exist after the step
- **WHEN** the account has no generated cycle, the person added "Sueldo" and "Alquiler" and continues
- **THEN** the cycle in progress holds one pending income row for Sueldo and one pending expense row for Alquiler in Vivienda, dated their day inside the cycle, and the generation marker is unchanged

#### Scenario: The generation inserts nothing twice
- **WHEN** the charges of the cycle in progress are generated after the onboarding stored them
- **THEN** no second row exists for Sueldo or Alquiler, and each definition's count of produced charges is 1

#### Scenario: A cycle the cron already generated
- **WHEN** the cron generated the cycle in progress before the person added "Alquiler", and the person continues from the step
- **THEN** the cycle holds one pending "Alquiler" row and its definition's count of produced charges is 1

### Requirement: Budgets step with the live free margin
The budgets step SHALL show, above everything else, the free margin: its label and its amount as the most prominent number on the screen in the brand text colour, computed as `category-editing` → *A budget reserves its amount in the free margin* defines, from the account's recurring income, its recurring expenses by category and the budgets as typed. Under it, one line SHALL say what the number is, and an envelope bar SHALL show the income split into one segment per category that reserves something — the larger of its budget and its fixed expenses, in the category's colour — and the remainder in the brand colour. Below, each category SHALL have a row with its dot, its name, its fixed total when it has one, and a budget field; an empty field means no budget.

The free margin SHALL change on every keystroke in a budget field, with no request involved. A budget SHALL be stored when its field is committed (blur or Enter), as the budget of the cycle in progress and that cycle only, exactly as the category sheet stores a budget from the cycle in progress; an emptied field SHALL store the "no budget" marker. A value that is not greater than zero or has more than two decimals SHALL show the sheet's invalid-amount message and store nothing. When a store fails, the field SHALL return to its previous value and the sheet's "could not save" message SHALL be shown. When the reserved total exceeds the income, the bar SHALL be full, the remainder segment absent and the number negative in the destructive text colour. When the account has no recurring income, the bar SHALL be hidden and a line SHALL point back to the income step.

#### Scenario: The margin moves as budgets are typed
- **WHEN** the account has "Sueldo" 2 000, "Alquiler" 820 in "Vivienda", a "Comida" category with no fixed expense, and no budget
- **THEN** the free margin reads 1 180
- **AND** typing 300 in Comida's field makes it read 880 before the field is left
- **AND** typing 820 in Vivienda's field leaves it at 880
- **AND** changing Vivienda's field to 900 makes it read 800
- **AND** clearing Comida's field makes it read 1 100

#### Scenario: The budget is stored on commit
- **WHEN** the person types 300 in Comida's field and leaves it
- **THEN** Comida has a budget of 300 in the cycle in progress and no other cycle, and after a reload the field reads 300 and the margin 880

#### Scenario: Envelope bar
- **WHEN** the margin reads 880 with Vivienda reserving 820 and Comida 300 out of 2 000
- **THEN** the bar shows a Vivienda segment at 41 % of its width, a Comida segment at 15 %, and a brand-coloured remainder at 44 %

#### Scenario: Over the income
- **WHEN** the person types 1 500 in Comida's field with Vivienda at 820 and income 2 000
- **THEN** the number reads −320 in the destructive text colour and the bar is full with no remainder segment

#### Scenario: Invalid budget
- **WHEN** the person types "12,345" in a budget field and leaves it
- **THEN** the invalid-amount message is shown, nothing is stored, and the margin is computed as if the field were empty

### Requirement: Savings target step
The savings target step SHALL keep the free margin on screen, above one optional amount field for the monthly savings target. While the field holds a valid amount, a line under the margin SHALL read what is left per month after that target (margin minus target). "Continuar" SHALL store the target, or clear it when the field is empty, as the account's savings target that the dashboard data carries. The free margin shown SHALL NOT subtract the target.

#### Scenario: Target preview
- **WHEN** the margin reads 1 180 and the person types 300
- **THEN** the margin still reads 1 180 and the line reads that 880 are left per month after the target

#### Scenario: Target stored
- **WHEN** the person continues with 300 in the field
- **THEN** the account's savings target is 300, and the dashboard data later carries 300 as the target

#### Scenario: No target
- **WHEN** the person continues with the field empty
- **THEN** the account has no savings target

### Requirement: Closing step stores a WhatsApp request and sends nothing
The last step SHALL explain in one or two lines that loading by WhatsApp is optional and, while the invitation is required, by invitation. It SHALL show a phone field and, only while the invitation is required (`messaging-channels` → *The WhatsApp invitation is a switch*), an invitation code field. "Vincular" SHALL be enabled when the phone is a valid international number and, if required, the code is not empty; a number typed without a country prefix SHALL take the account's country's prefix. Activating it SHALL store the number as the account's phone, the code trimmed and uppercased, and the time of the request, and SHALL complete the onboarding. A number already stored by another account SHALL be refused with a message and the step SHALL stay. "Seguir sin WhatsApp" SHALL complete the onboarding storing no phone and no code.

No WhatsApp message SHALL be sent by this step: the sending is a documented stub until the linking message exists. The screen's confirmation SHALL say the number was saved and that Mango will write, and SHALL NOT say a message was sent. No channel SHALL be created. Completing the onboarding, by either action, SHALL mark the account as onboarded and lead to `/dashboard`, which from then on SHALL render instead of redirecting.

#### Scenario: Link with code
- **WHEN** the invitation is required and the person types "11 5555 1234" with Argentina as the country and "mng-7k2qx4" as the code, and activates "Vincular"
- **THEN** the account stores phone `+541155551234`, code `MNG-7K2QX4` and the request time, the onboarding is complete, no message is sent, no channel exists, and `/dashboard` renders

#### Scenario: Invitation not required
- **WHEN** the invitation switch is off
- **THEN** no code field is shown and "Vincular" needs only a valid phone

#### Scenario: Continue without WhatsApp
- **WHEN** the person activates "Seguir sin WhatsApp"
- **THEN** the onboarding is complete, the account has no phone and no code, and `/dashboard` renders

#### Scenario: Phone taken
- **WHEN** another account already holds the typed number
- **THEN** a message says the number belongs to another account, the step stays, and the onboarding is not complete

#### Scenario: Malformed phone
- **WHEN** the person types "abc" as the phone
- **THEN** "Vincular" stays disabled and nothing is stored

### Requirement: A floating theme control on every step
Every onboarding step SHALL show, at the top-right, a floating control on a translucent material with three choices — light, dark, system — exposed as a radio group with translated names. The choice SHALL apply at once to the whole page and persist in the browser as the `theming` capability describes. On entering the onboarding with no stored choice, the control SHALL show system selected and the page SHALL follow the operating system from its first frame, with no dark frame painted before; that choice SHALL be stored, so the dashboard afterwards follows the operating system too. A browser with a stored choice SHALL keep it. The control SHALL stay in place across steps and under any open sheet, and SHALL turn opaque when the operating system requests reduced transparency.

#### Scenario: System by default
- **WHEN** a browser with no stored theme and an operating system preferring light opens `/onboarding`
- **THEN** the first frame is light, "Sistema" is selected, and the stored choice is system

#### Scenario: Choose dark
- **WHEN** the person selects dark on the second step and reloads
- **THEN** the page is dark after the reload and dark is selected on the step shown

#### Scenario: Stored choice kept
- **WHEN** a browser that stored light opens `/onboarding` with an operating system preferring dark
- **THEN** the page is light and light is selected

#### Scenario: Reduced transparency
- **WHEN** reduced transparency is requested by the operating system
- **THEN** the control has no backdrop blur and an opaque background

### Requirement: An in-memory sandbox of the onboarding
The application SHALL serve `/demo/onboarding` without authentication: the same screens over in-memory data that starts empty, writes nothing over the network, makes no request to a Supabase host, and is discarded on reload. It SHALL show one line saying nothing is saved. It SHALL NOT be linked from any page and SHALL NOT be indexed. For tests it SHALL accept a query parameter that opens a given step, one that seeds two categories (Vivienda, Comida), an income (Sueldo 2 000, day 1) and a fixed expense (Alquiler 820, day 1, Vivienda), one that hides the invitation code field, and ones that set the country and the amount format.

#### Scenario: Sandbox runs without a session
- **WHEN** an unauthenticated visitor opens `/demo/onboarding` while network traffic is recorded, goes through every step and completes it
- **THEN** every step renders, the sandbox line is visible, no POST request and no request to a Supabase host is made, and reloading shows the welcome step with nothing stored

#### Scenario: Seeded budgets step
- **WHEN** `/demo/onboarding?paso=5&e2eSeed=1` is opened
- **THEN** the budgets step is shown with Vivienda (fixed 820) and Comida listed and the free margin reading 1 180

#### Scenario: Abbreviated sandbox
- **WHEN** `/demo/onboarding?paso=5&e2eSeed=1&pais=AR&formato=abreviado` is opened
- **THEN** the free margin reads "$ 1,2k" and the budget fields hold no abbreviated value

### Requirement: Motion of the onboarding
Without the reduced-motion request:
- the welcome SHALL enter once: the logo with a pop, the title from below, the three lines one after another at 50 ms intervals, and "Empezar" last, all within 700 ms and none of it blocking "Empezar"
- changing step SHALL move the outgoing content out in the direction of travel and the incoming content in from the opposite side, each by a small offset with a fade, both finishing within 300 ms; going back SHALL mirror going forward; the theme control, the progress line, the primary action's place and, from budgets to savings target, the free margin SHALL NOT move or re-enter
- the progress line SHALL grow to its new length over successive frames
- on the budgets step the free margin SHALL reach a new value over successive frames with a critically damped spring, retargeting from wherever it is when a key is pressed mid-motion, and the envelope segments SHALL resize over successive frames using transforms only
- a row added to a list SHALL fade in from a few pixels below; a suggestion taken SHALL fade out; no row and no field SHALL carry any other animation
- every button SHALL shrink slightly while pressed and return on release

With the reduced-motion request: the welcome SHALL appear in place; a step change SHALL cross-fade with no horizontal movement; the progress line, the envelope segments and the free margin SHALL take their new value at once; rows SHALL appear in place; the theme change SHALL be immediate. Every state change SHALL still happen.

In both settings no element SHALL animate indefinitely once the pending-action spinner is gone, and the material of the theme control SHALL NOT be stacked on another translucent surface.

#### Scenario: Step change moves
- **WHEN** motion is not reduced and the person continues from the welcome
- **THEN** the incoming step's content changes horizontal position over successive frames before settling, its opacity rises, and the theme control's position is the same before and after

#### Scenario: Step change under reduced motion
- **WHEN** reduced motion is emulated and the person continues from the welcome
- **THEN** in the first frame after the change the basics step is at its resting position with no horizontal transform, and it reaches full opacity by fading

#### Scenario: The margin rolls
- **WHEN** motion is not reduced and the person types a budget on the budgets step
- **THEN** the free margin's text changes over successive frames before reading its final value, and typing again before it settles starts the new motion from the current value

#### Scenario: The margin under reduced motion
- **WHEN** reduced motion is emulated and the person types a budget
- **THEN** the free margin reads its final value in the first frame after the keystroke

#### Scenario: Nothing endless
- **WHEN** the budgets step has been idle for two seconds
- **THEN** no running animation on the page has an infinite iteration count

### Requirement: Onboarding texts come from the catalogs
Every text of the onboarding — titles, lines, labels, suggestions, messages, accessible names — SHALL come from the translation files in Spanish and English, Spanish in the neutral `tú` form used by the web. Country names SHALL be shown in the active language without catalog entries for them. The person's own entries (name, category names, definition names) SHALL be shown as typed.

#### Scenario: English onboarding
- **WHEN** the active language is English
- **THEN** every step's title, action and suggestion is in English, and the country list shows "Argentina" and "Spain"

#### Scenario: Typed names stay as typed
- **WHEN** the person names a category "mercado" and switches the language
- **THEN** the row still reads "mercado"
