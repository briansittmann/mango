## 1. Baseline (before any rename)

- [x] 1.1 Save the output of `npx tsc --noEmit`, `npm run lint` and `npm run build` to `baseline-static.txt` in the scratchpad. Verify: `tsc` lists exactly the 3 errors in `components/finance-dashboard.tsx` (TS2307 for `@/lib/translations`, plus 2 × TS7006). `lint` shows 0 errors and 1 warning. Note whether the build passes.
- [x] 1.2 In the scratchpad, write `payload.json`: one Meta webhook body with a `statuses` entry and a text message from `353871234567`, id `wamid.TEST1`. Also write `smoke.sh`, which computes the `sha256=` HMAC of `payload.json` with `secret-test` and runs the 4 requests from design D6 against `localhost:3100/api/whatsapp` (challenge `12345`), printing the status and body of each. Start `env -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY WHATSAPP_VERIFY_TOKEN=verify-test WHATSAPP_APP_SECRET=secret-test npm run dev -- -p 3100` in the background, run `smoke.sh`, and save its output plus the `[whatsapp]` log lines to `baseline-smoke.txt`. Verify: the responses are `200 12345`, `403`, `401`, `200`, and exactly one error log line mentions `wamid.TEST1`.
- [x] 1.3 Check the pure functions with their current names: using `node --experimental-strip-types`, import `lib/whatsapp/payload.ts` and `lib/whatsapp/firma.ts`, extract messages from `payload.json`, and validate the good and a bad signature. Save the output to `baseline-unit.txt`. Verify: it prints exactly one message `{ telefono: '+353871234567', texto: …, mensajeId: 'wamid.TEST1' }`, then `true` and `false`.

## 2. File and folder renames (design D5)

- [x] 2.1 Use `git mv` for:
  - `lib/datos` → `lib/data`, then `lib/data/transacciones.ts` → `transactions.ts` and `lib/data/usuarios.ts` → `users.ts`
  - `lib/bot/logica.ts` → `logic.ts`
  - `lib/whatsapp/adaptador.ts` → `adapter.ts` and `lib/whatsapp/firma.ts` → `signature.ts`
  - `i18n/formatos.ts` → `formats.ts`
  - `messages/paridad.ts` → `parity.ts`

  Change only the import paths in `lib/whatsapp/adapter.ts` and `app/api/whatsapp/route.ts`, plus the 4 `@/lib/datos/*` patterns in `eslint.config.mjs`. Verify: `git status` shows the renames, `npx tsc --noEmit` matches the baseline, and `grep -c "lib/data/\*" eslint.config.mjs` prints `4`.
- [x] 2.2 Ask the user whether to commit the renames on their own now (so `git log --follow` stays reliable) or leave everything uncommitted until the end. Verify: the user answered. If they said yes, `git log -1 --stat` shows only the renames and the path lines from 2.1.

## 3. Identifiers and comments (design D2 map, D4 rules)

- [x] 3.1 In `lib/data/transactions.ts`, `lib/data/users.ts` and `lib/supabase/admin.ts`, rename the identifiers, translate the JSDoc, the `TODO` and the thrown `Error` message, and update the two call sites in `adapter.ts`. Keep every query string (`'transacciones'`, `'usuarios'`, `'usuario_id'`, `'telefono'`, `'wa_message_id'`) and the `§` references. Verify: `npx tsc --noEmit` matches the baseline.
- [x] 3.2 In `lib/bot/logic.ts`, rename to `IncomingMessage`, `BotReply` (with `kind: 'text' | 'none'`), `processMessage` and `processUnknownNumber`, translate all comments and TODOs, and update the call sites and the `kind` check in `adapter.ts`. Verify: `npx tsc --noEmit` matches the baseline, and `grep -rn "sin_respuesta\|tipo" lib app` prints nothing.
- [x] 3.3 In `lib/whatsapp/payload.ts` and `lib/whatsapp/signature.ts`, rename the identifiers and locals, translate the comments (keep the Argentina `wa_id` TODO), and update the imports and calls in `adapter.ts` and `route.ts`. Verify: `npx tsc --noEmit` matches the baseline. Rerun the 1.3 check with `extractTextMessages` and `isValidSignature`: the output matches `baseline-unit.txt` except for the field names `phone`, `text` and `messageId`.
- [x] 3.4 Finish `lib/whatsapp/adapter.ts` (`handleMessages`, `handleMessage`, `sendReply`, `maskPhone`, locals, comments, log messages) and `app/api/whatsapp/route.ts` (`mode`, `rawBody`, `messages`, comments, log messages). Keep the `[whatsapp]` prefix and the HTTP response bodies. Verify: `npx tsc --noEmit` matches the baseline. Then go through `git diff` for `signature.ts` and `route.ts` and confirm each original claim is still stated:
  - the signature is computed over the raw bytes, before parsing
  - the comparison runs in constant time
  - comparing digests avoids leaking the secret's length and avoids `timingSafeEqual` throwing on different lengths
  - the verify token has to match
  - the handler answers 200 first and does the real work in `after`
- [x] 3.5 Apply the design D2 renames in `i18n/formats.ts`, `i18n/request.ts` (`isLocale`) and `messages/parity.ts`. Verify: `npx tsc --noEmit` matches the baseline, and `git diff --quiet -- messages/es.json messages/en.json` exits 0.

## 4. Code verification

- [x] 4.1 Run the guard greps:
  - (a) `grep -rnwE "datos|logica|adaptador|firma|formatos|paridad|mensajeYaProcesado|buscarUsuarioIdPorTelefono|procesarMensaje|procesarNumeroDesconocido|MensajeEntrante|RespuestaBot|manejarMensajes|manejarMensaje|responder|enmascarar|firmaValida|comparacionSegura|extraerMensajesDeTexto|extraerMensaje|MensajeWhatsApp|aE164|esObjeto|comoArray|opcionesMoneda|opcionesCompacto|esLocale|cliente|cuerpoCrudo|modo|mensajes|mensaje|usuarioId|telefono|texto|respuesta" app lib i18n messages/parity.ts eslint.config.mjs`
  - (b) `grep -rnE "[áéíóúñÁÉÍÓÚÑ¿¡]" app lib i18n messages/parity.ts eslint.config.mjs`
  - (c) `grep -rnwiE "que|para|los|las|del|por|una|cuando|porque|acá|todavía|sin" app lib i18n messages/parity.ts`

  Verify: (a) prints only the `.eq('telefono', …)` line in `lib/data/users.ts`, and (b) and (c) print nothing.
- [x] 4.2 Lint guard probe: note whether `components/atoms/` exists, then create `components/atoms/_probe.tsx` that imports and calls `findUserIdByPhone` from `@/lib/data/users`. Verify: `npm run lint` reports `no-restricted-imports` for that file. Delete the probe (and `components/atoms/` if the probe created it), then confirm the lint output matches the baseline again.
- [x] 4.3 Rerun the full baseline. Restart the dev server with the 1.2 command (delete the gitignored `.next/` first if old module paths still resolve) and run `smoke.sh`. Verify: `tsc`, `lint` and `build` match `baseline-static.txt`. Status codes and bodies match `baseline-smoke.txt` exactly. The error log is now in English and still mentions `wamid.TEST1`. Then stop the dev server.
- [x] 4.4 Scope check. Verify: `git status --short` lists only the files named in proposal.md (Impact) plus this change's folder, and `git diff --stat -- supabase messages/es.json messages/en.json components/finance-dashboard.tsx ARCHITECTURE.md` is empty.

## 5. `land-finance-dashboard` plan (design D3)

- [x] 5.1 In `openspec/changes/land-finance-dashboard/design.md`:
  - Rewrite D2 as an English data contract using the D3 types and fields, and replace its rationale and rejected alternative. `CategoryColor` members keep their values.
  - Apply the D3 map to D3 (`lib/data/budget.ts`, `getBudgetStatus`, its inputs and outputs, `'ok' | 'warning' | 'exceeded'`), D4 (`@/lib/data/*`), D5 and D6 (`actions`, `openIds`, `openSummary`, `accountMenuOpen`), D7 (`--cat-<name>`), D9 (`changeLanguage` in `app/actions/language.ts`, `messages/parity.ts`, `i18n/formats.ts`, `user.timezone`, `user.currency`), D10 (`lib/demo/demo-data.ts`, `buildDemoData`, `DashboardData`, `expenses.total`, `freeMargin`, *warning* / *exceeded*), and the other mentions (`lib/data/*` in Context, the props `data` / `actions` / `notice` / `level`, `history` and `freeMargin` in later sections).
  - Keep the database references (`usuarios.idioma`, `categorias.color`, `transacciones.es_fijo`, `moneda_default`, `rango_ciclo_usuario()`), the message namespaces and ICU strings in D9, the UI text, and the ARCHITECTURE section titles.

  Verify: `grep -nwE "lib/datos|datos-demo|app/acciones|idioma\.ts|DatosDashboard|ColorCategoria|GrupoGasto|EstadoPresupuesto|Acciones|acciones|estadoPresupuesto|datosDemo|cambiarIdioma|enCurso|margenLibre|historial|abiertos|resumenAbierto|menuCuentaAbierto|aviso|nivel|alerta|excedido|disponibleSemanal|diasRestantes|restante|diaActual|diasCiclo|formatos|paridad|buscarUsuarioIdPorTelefono" design.md` prints nothing, and `grep -c "usuarios.idioma\|gris_oscuro\|menuCuenta" design.md` is still greater than 0.
- [x] 5.2 In `openspec/changes/land-finance-dashboard/tasks.md`, apply the D3 map:
  - 1.3 and 1.4: `findUserIdByPhone`
  - 3.2: `messages/parity.ts`
  - 3.3: `i18n/formats.ts`, in both the text and the verify command
  - 3.4: `changeLanguage` in `app/actions/language.ts`
  - 4.1: `lib/data/dashboard.ts`, `CategoryColor`, `DashboardData`, `ExpenseGroup`, `DashboardActions`
  - 4.2: `getBudgetStatus` in `lib/data/budget.ts`, with examples like `{ amount: 400, spent: 310, currentDay: 10, cycleDays: 30 }` → `weeklyAllowance 30`, `level 'ok'`, plus `daysLeft`, `remaining`, `'warning'`, `'exceeded'`
  - 4.3: `buildDemoData(locale)` in `lib/demo/demo-data.ts`, `inProgress: true`, *warning* / *exceeded*, and the grep path
  - 4.4: `buildDemoData`, `actions={{ changeLanguage }}`, `notice=`
  - 5.1: *warning* / *exceeded*
  - 5.4: `actions.changeLanguage`

  Don't change checkbox states, the quoted UI text, `gris_oscuro`, `blanco` or `comida`. Verify: the 5.1 grep on `tasks.md` prints nothing, and `openspec list --json` still reports `land-finance-dashboard` at 10 of 25 tasks done.
- [x] 5.3 In `openspec/changes/land-finance-dashboard/proposal.md`, change the paths to `lib/data/dashboard.ts`, `lib/data/budget.ts` and `lib/demo/demo-data.ts`, and keep `usuarios.idioma`. Verify: the 5.1 grep on `proposal.md` prints nothing, and `openspec validate land-finance-dashboard` passes.

## 6. Final gate

- [x] 6.1 Run `openspec validate translate-code-to-english` and `openspec validate land-finance-dashboard`, and delete the scratchpad smoke-test files. Verify: both validations pass, no dev server is still running on port 3100, and the working tree is left for the user to review (committed only if the user asked in 2.2).
