## Purpose

Defines the standalone SQL script that turns an auth user created in the Supabase dashboard into a test account with a believable current cycle, so the real dashboard can be exercised end to end.

## ADDED Requirements

### Requirement: Standalone, placeholder-driven and safe to run twice
The script SHALL live outside `supabase/migrations/` and SHALL never run automatically. Its e-mail SHALL be a placeholder set in exactly one place at the top of the file. When no auth user has that e-mail, the script SHALL fail with a message naming the e-mail and SHALL write nothing. Running the script a second time SHALL leave the same number of rows as the first run: rows it seeded SHALL be reset to the script's values, and rows added from the dashboard SHALL be left untouched. The file's header SHALL list the steps to run it, in order.

#### Scenario: Auth user missing
- **WHEN** the script is run before the auth user with the placeholder e-mail exists
- **THEN** it stops with a message naming that e-mail, and no `usuarios`, `categorias`, `movimientos_recurrentes`, `presupuestos` or `transacciones` row is written

#### Scenario: Second run
- **WHEN** the script is run twice in a row
- **THEN** the counts of the test user's rows in every table are the same after the second run as after the first

#### Scenario: Dashboard rows survive a re-run
- **WHEN** the user adds an expense from the dashboard and the script is run again
- **THEN** that expense is still listed, and every seeded row is back to the script's values

### Requirement: The account is linked the way RLS expects
The script SHALL link the `usuarios` row to the auth user through `usuarios.auth_user_id`, which is what the policies resolve through, and SHALL set the user's e-mail to the placeholder. The `usuarios` row SHALL use a placeholder phone of the required shape, timezone Europe/Dublin, currency EUR, Spanish, cycle start day 26, onboarding complete and a monthly savings goal of 300. After logging in, the user SHALL see the seeded rows and nothing else.

#### Scenario: Login sees the seed
- **WHEN** the script has run and the user logs in with the placeholder e-mail
- **THEN** `/dashboard` shows the seeded categories, charges, income and savings, and the account menu shows the seeded name and phone

#### Scenario: Another user sees nothing of it
- **WHEN** a different linked user logs in
- **THEN** none of the seeded rows appears in their dashboard

### Requirement: The seeded cycle is believable and current
The seed SHALL describe the cycle containing the moment the script runs, with every date placed relative to that cycle's start so the seed is current whenever it runs. It SHALL mirror the demo sample: seven categories with distinct colours (vivienda, salud, hogar, comida, ocio, transporte, compras), budget rows of 400 on comida, 150 on ocio and 100 on transporte for the current cycle and for each of the five past cycles, each row keyed by its cycle's first day, six expense definitions (alquiler 820 day 1, internet 45 day 3, seguro 35 day 8 as instalment 4 of 10, parking 50 day 15, limpieza 35 day 20, gimnasio 40 day 22) and one income definition (salario 2 400 day 1), each with this cycle's charge linked to it, variable expenses giving comida 310, ocio 130, transporte 130, hogar 95 and compras 95, income of 2 820 in total, savings movements of +176, −80 and +50, and five past cycles with expense totals of 1 400, 1 550, 1 600, 1 450 and 1 750 (oldest first) and one savings deposit of 500 each.

#### Scenario: Figures on first login
- **WHEN** the user logs in during the cycle the script was run in
- **THEN** the dashboard shows expenses 1.700 €, income 2.820 €, savings 146 €, accumulated 2.646 €, free margin 844 €, "comida" at 310 of 400, "transporte" at 80 of 100, and six bars in the monthly chart

#### Scenario: Past cycles carry their own budgets
- **WHEN** the user opens the previous cycle
- **THEN** "comida", "ocio" and "transporte" show bars against 400, 150 and 100, read from that cycle's own rows

#### Scenario: Charges in both states
- **WHEN** the dashboard is opened on a day between the 8th and the 14th of the cycle's second calendar month
- **THEN** "Próximos cobros" lists alquiler, internet and seguro as taken and parking, limpieza and gimnasio as pending

#### Scenario: Re-run in a later cycle
- **WHEN** the script is run again during a later cycle
- **THEN** the seeded rows move to that cycle and the dashboard shows the same figures for it
