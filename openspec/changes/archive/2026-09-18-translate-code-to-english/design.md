## Context

See proposal.md (Why) for the motivation.

- **Code in scope.** The Spanish names sit in 9 TS files plus `eslint.config.mjs`, and the import graph is small:
  - `app/api/whatsapp/route.ts` imports `lib/whatsapp/{adaptador,firma,payload}`.
  - `adaptador.ts` imports `lib/bot/logica.ts` and `lib/datos/{transacciones,usuarios}`.
  - `lib/datos/*` imports `lib/supabase/admin.ts`.
  - `i18n/formatos.ts` has no importers. `messages/paridad.ts` has none either; it is only there for type-checking.
- **Checks available.** There's no test suite. The scripts are `dev`, `build`, `start` and `lint`, and the repo has no `.env*` files.
- **Baseline (2026-09-14).** `npx tsc --noEmit` reports 3 errors, all in `components/finance-dashboard.tsx`: `@/lib/translations` doesn't exist (TS2307), and two parameters are implicitly `any` (TS7006). `npm run lint` reports 0 errors and 1 `no-img-element` warning in the same file. After the change, both must match this baseline exactly.
- **The dashboard plan.** In `land-finance-dashboard`, D2 picked Spanish identifiers. The tasks that would first create files with those names (3.4, 4.1–4.4) haven't started, so renaming the plan now costs nothing in code.

## Goals / Non-Goals

**Goals:**
- One naming rule (D1) that settles every case, so nobody has to judge identifiers one by one while applying the change.
- Evidence that behavior is unchanged: run the same type, lint, webhook and pure-function checks before and after.

**Non-Goals:**
- Improving code while it's open. That means no refactors, no fixes to `finance-dashboard.tsx`, and no work on the `supabase gen types` TODO.
- Changing how any name is structured beyond translating it. For example, `supabaseAdmin`, `payload.ts` and `waMessageId` are already English and stay as they are.

## Decisions

### D1 — Naming rule: TypeScript's own names go English; names defined outside TypeScript keep their spelling

**Stays as it is:**
- Database names in query strings: `.from('transacciones')`, `.eq('usuario_id', …)`, `.eq('telefono', …)`. Same for database names quoted in comments, such as `borrado_en`, `onboarding_completo`, `cargas_confirmadas`, `modo_confirmacion`, `invitaciones` and `usada_por`.
- Values that mirror database check constraints: the category colour names (`gris_oscuro`, `blanco`, …) and the `--cat-<name>` CSS variables built from them.
- Keys and values in `messages/*.json`, including the namespace names listed in `land-finance-dashboard` D9.
- UI text quoted in verification steps ("Colapsar todo", "310 de 400") and the ARCHITECTURE.md section titles (*Seguimiento*, *Cabecera*).

**Becomes English:**
- File and folder names.
- Every identifier, whether exported or local.
- Type and field names.
- Internal string discriminants (`'sin_respuesta'`, `'fijos'`, `'alerta'`).
- Comments.
- Log and error messages.

Spanish column names and English identifiers only meet inside `lib/data/*`. The future Supabase loader converts columns to English fields there, in one place.

*Alternatives rejected:*
- **Rename the schema as well.** The user declined: it means rewriting 12 migrations and recreating any database built from them, for names end users never see.
- **Keep Spanish wherever code touches the database** (the current `land-finance-dashboard` D2). Most of `lib/` would stay Spanish, while the column-to-field mapping it avoids is only a few lines.

### D2 — Rename map for existing code

| File (new path) | Old → new |
|---|---|
| `lib/data/transactions.ts` | `mensajeYaProcesado(usuarioId, waMessageId)` → `isMessageProcessed(userId, waMessageId)` |
| `lib/data/users.ts` | `buscarUsuarioIdPorTelefono(telefono)` → `findUserIdByPhone(phone)` |
| `lib/bot/logic.ts` | `MensajeEntrante { usuarioId, texto, mensajeId }` → `IncomingMessage { userId, text, messageId }`<br>`RespuestaBot { tipo: 'texto'; texto } \| { tipo: 'sin_respuesta' }` → `BotReply { kind: 'text'; text } \| { kind: 'none' }`<br>`procesarMensaje(mensaje)` → `processMessage(message)`<br>`procesarNumeroDesconocido(telefono, texto)` → `processUnknownNumber(phone, text)` |
| `lib/whatsapp/adapter.ts` | `manejarMensajes(mensajes)` → `handleMessages(messages)`<br>`manejarMensaje` → `handleMessage`<br>`responder(telefono, respuesta)` → `sendReply(phone, reply)`<br>`enmascarar` → `maskPhone`<br>locals `usuarioId`, `respuesta` → `userId`, `reply` |
| `lib/whatsapp/signature.ts` | `firmaValida(cuerpoCrudo, header, appSecret)` → `isValidSignature(rawBody, header, appSecret)`<br>`comparacionSegura` → `safeCompare`<br>locals `algoritmo`, `firmaRecibida`, `firmaEsperada` → `algorithm`, `receivedSignature`, `expectedSignature` |
| `lib/whatsapp/payload.ts` | `MensajeWhatsApp { telefono, texto, mensajeId }` → `WhatsAppMessage { phone, text, messageId }`<br>`extraerMensajesDeTexto` → `extractTextMessages`<br>`extraerMensaje` → `extractMessage`<br>`aE164(numero)` → `toE164(rawNumber)`<br>`esObjeto(valor)` → `isObject(value)`<br>`comoArray(valor)` → `asArray(value)`<br>locals `mensajes`, `entrada`, `cambio`, `mensaje`, `extraido`, `texto` → `messages`, `entry`, `change`, `message`, `extracted`, `text` |
| `lib/supabase/admin.ts` | `cliente` → `client` |
| `i18n/formats.ts` | `opcionesMoneda` → `currencyFormatOptions`<br>`opcionesCompacto` → `compactFormatOptions` |
| `i18n/request.ts` | `esLocale` → `isLocale` |
| `messages/parity.ts` | `_esTieneTodasLasClavesDeEn` → `_esHasAllEnKeys`<br>`_enTieneTodasLasClavesDeEs` → `_enHasAllEsKeys` |
| `app/api/whatsapp/route.ts` | locals `modo`, `cuerpoCrudo`, `mensajes` → `mode`, `rawBody`, `messages` |
| `eslint.config.mjs` | `@/lib/datos/*` → `@/lib/data/*` (4 blocks) |

`BotReply` changes its discriminant (`tipo` → `kind`). That's safe: the value is never stored or serialized, and `tsc` catches every place that narrows on it.

### D3 — Rename map for the `land-finance-dashboard` plan

| Kind | Old → new |
|---|---|
| Paths | `lib/datos/dashboard.ts` → `lib/data/dashboard.ts`<br>`lib/datos/presupuesto.ts` → `lib/data/budget.ts`<br>`lib/demo/datos-demo.ts` → `lib/demo/demo-data.ts`<br>`app/acciones/idioma.ts` → `app/actions/language.ts` |
| Types | `ColorCategoria` → `CategoryColor` (member values unchanged, see D1)<br>`DatosDashboard` → `DashboardData`<br>`GrupoGasto` → `ExpenseGroup`<br>`EstadoPresupuesto` → `BudgetStatus`<br>`Acciones` → `DashboardActions` |
| `DashboardData` | `usuario { nombre, telefono, fotoUrl, moneda, timezone }` → `user { name, phone, photoUrl, currency, timezone }`<br>`ciclo { inicio, fin, mes, enCurso }` → `cycle { start, end, month, inProgress }`<br>`margenLibre` → `freeMargin`<br>`ingresos { total, fuentes[{ id, nombre, estimado, real }] }` → `income { total, sources[{ id, name, estimated, actual }] }`<br>`ahorro { ciclo, acumulado, movimientos[{ id, nombre, fecha, monto }] }` → `savings { cycle, accumulated, movements[{ id, name, date, amount }] }`<br>`gastos { total, grupos }` → `expenses { total, groups }`<br>`historial[{ mes, total }]` → `history[{ month, total }]` |
| `ExpenseGroup` | `tipo: 'fijos' \| 'categoria'` → `kind: 'fixed' \| 'category'`<br>`nombre` → `name`<br>`presupuesto` → `budget`<br>`gastos[{ id, nombre, monto, fecha }]` → `expenses[{ id, name, amount, date }]` |
| `DashboardActions` | `cicloAnterior`, `cicloSiguiente`, `anadirGasto(grupoId)`, `anadirIngreso`, `anadirMovimientoAhorro`, `cerrarSesion`, `cambiarIdioma(l)` → `previousCycle`, `nextCycle`, `addExpense(groupId)`, `addIncome`, `addSavingsMovement`, `signOut`, `changeLanguage(locale)` |
| Budget function | `estadoPresupuesto({ monto, gastado, diaActual, diasCiclo })` → `getBudgetStatus({ amount, spent, currentDay, cycleDays })`<br>returns `{ amount, spent, usage, level: 'ok' \| 'warning' \| 'exceeded', remaining, daysLeft, weeklyAllowance }` (old: `consumo`, `nivel`, `'alerta'`, `'excedido'`, `restante`, `diasRestantes`, `disponibleSemanal`) |
| Demo | `datosDemo(locale)` → `buildDemoData(locale)` |
| Template props and state | `datos`, `acciones`, `aviso` → `data`, `actions`, `notice`<br>`abiertos` → `openIds`<br>`resumenAbierto: 'ingresos' \| 'gastos' \| 'ahorro'` → `openSummary: 'income' \| 'expenses' \| 'savings'`<br>`menuCuentaAbierto` → `accountMenuOpen`<br>the `nivel` prop → `level` |
| Placeholders | `--cat-<nombre>` → `--cat-<name>` |

Changes to D2 in the `land-finance-dashboard` design:
- **New rationale:** use English identifiers, like the rest of the code. `lib/data/*` converts Spanish columns to English fields in that one place. `CategoryColor` members stay the database check strings because they are stored data.
- **Rejected alternative, replaced:** Spanish identifiers that match the schema read 1:1 against the columns, but they make the data contract hard to read for reviewers who don't know Spanish. The code already switches language at the query strings anyway.
- **Tasks:** checkbox states don't change. Completed tasks get the new names too, so every path in the plan matches the repo.

### D4 — Translate comments for meaning

- Write natural English instead of word-for-word translations. Regional idioms ("pegarle al endpoint", "no se lleva puestos a los demás") become their plain meaning.
- Keep the structure: JSDoc stays JSDoc and `//` stays `//`. Also keep `**bold**` emphasis, the `TODO:` prefixes, `§n` references and backticked code or database names.
- Don't add, drop or soften any claim. The security reasoning in `signature.ts` and `route.ts` has to say exactly the same thing afterwards.
- For log and error messages, translate the text and keep the `[whatsapp]` prefix and the interpolated values. HTTP response bodies are already English and stay byte-for-byte the same.

*Alternative rejected:* a literal translation. It reads badly, which undercuts the reason for the change.

### D5 — Rename files with `git mv` before editing their content

Git matches a deleted file to an added one by content similarity (default 50%). Once a small file is mostly translated, like `lib/data/users.ts` at 17 lines, it can drop under that threshold and show up as a delete plus an add. The renames therefore happen first, with `git mv` and only the import-path and lint-pattern edits. Group 2 then stops so the user can decide whether to commit the renames on their own, which keeps `git log --follow` reliable. The tasks never commit without that answer.

*Alternative rejected:* translating first and renaming last. The final tree is the same, but the renames get lost in the content diff.

### D6 — Run the same checks before and after

- **Static checks.** `tsc` and `lint` must match the baseline, and `npm run build` must give the same result as its baseline run.
- **Webhook smoke test.**
  - Start the dev server with `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` set on the command line, and with the Supabase variables explicitly unset, so the database is never contacted.
  - GET with the correct verify token → 200 and the challenge echoed back.
  - GET with a wrong token → 403.
  - POST with a bad signature → 401.
  - POST with a valid HMAC and one text message → 200. The background handler then logs the missing-Supabase-config error for that message id.
  - Status codes and bodies must match exactly. Log lines may differ only because they're translated.
- **Pure functions.** Run `node --experimental-strip-types` (confirmed working on Node 23.11). `extractTextMessages` on a sample payload must return exactly the text message and ignore `statuses`. `isValidSignature` must return `true` for a good header and `false` for a bad one. The baseline run uses the old names.
- **Guard greps.** No old identifier may remain in `app lib i18n messages/parity.ts eslint.config.mjs`, except the database strings allowed by D1, and there must be no accented Spanish characters. The dashboard plan docs must not contain any old name from D3.
- **Lint guard probe.** A throwaway component that imports `@/lib/data/users` must fail `npm run lint`.

## Risks / Trade-offs

- [The ESLint patterns are plain strings. If one still says `@/lib/datos/*`, components can import the data layer without any error.] → Task 4.2 proves the guard still fires.
- [Translating a security comment could change what it claims.] → D4, plus a claim-by-claim review of `signature.ts` and `route.ts` in task 3.4.
- [A leftover Spanish word in a comment or string compiles fine.] → The accent and stop-word greps in task 4.1.
- [Spanish column names next to English identifiers in `lib/data/*` look inconsistent.] → Accepted under D1: that file is where the translation between the two happens.
- [Heavily translated small files can show in git as a delete plus an add.] → D5.
- [The dev server keeps resolving the old module paths from its `.next/` cache.] → Restart `npm run dev`. If old paths still resolve, delete `.next/`, which is a gitignored build cache.
- [Translation keys (`resumen.ingresos`, `menuCuenta.cerrarMenu`) stay Spanish, so a recruiter can still see Spanish identifiers in `useTranslations` calls.] → Out of scope by the user's instruction. Renaming the keys could be a small follow-up change.

## Migration Plan

Nothing to migrate: there are no data, deployment or API changes. To roll back, revert the commit or commits.
