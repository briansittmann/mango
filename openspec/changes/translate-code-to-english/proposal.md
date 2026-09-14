## Why

Mango is a portfolio project that recruiters will read, and most of its code is in Spanish. That includes file and folder names (`lib/datos/`, `lib/bot/logica.ts`), functions and types (`buscarUsuarioIdPorTelefono`, `RespuestaBot`), and the comments that explain the webhook flow and its security choices. A reviewer who doesn't read Spanish can't follow any of it. On top of that, the in-progress `land-finance-dashboard` plan (design D2) calls for more Spanish identifiers (`DatosDashboard`, `estadoPresupuesto`, `cambiarIdioma`). Changing course now keeps the gap from growing.

## What Changes

- Rename the Spanish TS files and folders to English with `git mv`, so history follows each file:
  - `lib/datos/` → `lib/data/`, with `transacciones.ts` → `transactions.ts` and `usuarios.ts` → `users.ts`
  - `lib/bot/logica.ts` → `lib/bot/logic.ts`
  - `lib/whatsapp/adaptador.ts` → `lib/whatsapp/adapter.ts`, `lib/whatsapp/firma.ts` → `lib/whatsapp/signature.ts`
  - `i18n/formatos.ts` → `i18n/formats.ts`, `messages/paridad.ts` → `messages/parity.ts`
- Rename every Spanish function, type, field, parameter, local variable and internal string discriminant in `lib/`, `i18n/`, `messages/parity.ts` and `app/api/whatsapp/route.ts`, and update the imports. Examples: `buscarUsuarioIdPorTelefono` → `findUserIdByPhone`, and `RespuestaBot { tipo: 'sin_respuesta' }` → `BotReply { kind: 'none' }`.
- Translate every Spanish code comment (JSDoc, inline, `TODO`) and developer-facing log or error message (`console.*`, thrown `Error`) to English. References to `ARCHITECTURE.md §n` stay.
- Point the components lint guard in `eslint.config.mjs` at `@/lib/data/*` instead of `@/lib/datos/*`. Otherwise it silently stops blocking data-layer imports.
- Update the `land-finance-dashboard` change:
  - Rewrite design D2 to use English identifiers, and flip its rejected alternative.
  - Rename every Spanish path, type, function, field, prop and state name in its `design.md`, `tasks.md` and `proposal.md`, including references inside tasks that are already done. Examples: `lib/datos/presupuesto.ts` → `lib/data/budget.ts`, and `cambiarIdioma` in `app/acciones/idioma.ts` → `changeLanguage` in `app/actions/language.ts`.
- Runtime behavior stays the same: HTTP responses, database queries and rendered UI don't change.

### Non-goals

- **Database schema stays Spanish.** Migration file names, tables, columns and check values (such as `gris_oscuro`) are unchanged. Query strings like `.from('transacciones')`, and the members of the category-colour type that mirror the `0004_categorias.sql` check, keep their Spanish values.
- **Translation files aren't edited, key names included.** That covers `messages/es.json` and `messages/en.json` (keys like `resumen.ingresos` and `menuCuenta.cerrarMenu`). The request mentioned `i18n/messages/`, but the files live in the top-level `messages/` folder. The only code file there, `paridad.ts`, is in scope.
- Prose docs (`ARCHITECTURE.md`, `PROMPT.md`, `CLAUDE.md`, `README.md`), SQL comments in migrations, and `.claude/` are out of scope.
- `components/finance-dashboard.tsx` is left alone. Its Spanish text is UI content, task 5.6 of `land-finance-dashboard` deletes the file, and its broken `@/lib/translations` import is left to that task.
- `components/i18n/` doesn't exist, so there's nothing to change there.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change only renames code and translates comments, with no spec-level behavior change, so it sets `skip_specs: true`. The `land-finance-dashboard` specs don't contain any Spanish code identifiers and aren't touched.

## Impact

- **Code:** `lib/data/*`, `lib/bot/logic.ts`, `lib/whatsapp/*`, `lib/supabase/admin.ts`, `i18n/formats.ts`, `i18n/request.ts`, `messages/parity.ts`, `app/api/whatsapp/route.ts` and `eslint.config.mjs`. The renamed modules are imported only by `app/api/whatsapp/route.ts` and `lib/whatsapp/adapter.ts`. `formats.ts` and `parity.ts` have no importers.
- **Planning:** `openspec/changes/land-finance-dashboard/{proposal,design,tasks}.md`. Its pending tasks (3.4, 4.1–4.4) will now create English-named files.
- **Unchanged:** the `/api/whatsapp` webhook contract, dependencies, the database and environment variables.
