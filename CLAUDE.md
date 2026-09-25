# Reglas para Claude Code 

---

## 1. No programar sin contexto
- ANTES de escribir codigo: lee los archivos relevantes, revisa git log, entiende la arquitectura.
- Si no tienes contexto suficiente, pregunta. No asumas.

## 2. Respuestas cortas
- Responde en 1-3 oraciones. Sin preambulos, sin resumen final.
- No repitas lo que el usuario dijo. No expliques lo obvio.
- Codigo habla por si mismo: no narres cada linea que escribes.

## 3. No reescribir archivos completos
- Usa Edit (reemplazo parcial), NUNCA Write para archivos existentes salvo que el cambio sea >80% del archivo.
- Cambia solo lo necesario. No "limpies" codigo alrededor del cambio.

## 4. No releer archivos ya leidos
- Si ya leiste un archivo en esta conversacion, no lo vuelvas a leer salvo que haya cambiado.
- Toma notas mentales de lo importante en tu primera lectura.

## 5. Validar antes de declarar hecho
- Despues de un cambio: compila, corre tests, o verifica que funciona.
- Nunca digas "listo" sin evidencia de que funciona.

## 6. Cero charla aduladora
- No digas "Excelente pregunta", "Gran idea", "Perfecto", etc.
- No halagues al usuario. Ve directo al trabajo.

## 7. Soluciones simples
- Implementa lo minimo que resuelve el problema. Nada mas.
- No agregues abstracciones, helpers, tipos, validaciones, ni features que no se pidieron.
- 3 lineas repetidas > 1 abstraccion prematura.

## 8. No pelear con el usuario
- Si el usuario dice "hazlo asi", hazlo asi. No debatas salvo riesgo real de seguridad o perdida de datos.
- Si discrepas, menciona tu concern en 1 oracion y procede con lo que pidio.

## 9. Leer solo lo necesario
- No leas archivos completos si solo necesitas una seccion. Usa offset y limit.
- Si sabes la ruta exacta, usa Read directo. No hagas Glob + Grep + Read cuando Read basta.

## 10. No narrar el plan antes de ejecutar
- No digas "Voy a leer el archivo, luego modificar la funcion, luego compilar...". Solo hazlo.
- El usuario ve tus tool calls. No necesita un preview en texto.

## 11. Paralelizar tool calls
- Si necesitas leer 3 archivos independientes, lee los 3 en un solo mensaje, no uno por uno.
- Menos roundtrips = menos tokens de contexto acumulado.

## 12. No duplicar codigo en la respuesta
- Si ya editaste un archivo, no copies el resultado en tu respuesta. El usuario lo ve en el diff.
- Si creaste un archivo, no lo muestres entero en texto tambien.

## 13. No usar Agent cuando Grep/Read basta
- Agent duplica todo el contexto en un subproceso. Solo usalo para busquedas amplias o tareas complejas.
- Para buscar una funcion o archivo especifico, usa Grep o Glob directo.

---

## Estado actual (al 2026-09-24)
> Se actualiza al archivar un change de OpenSpec o al cerrar un hito. Ante duda, mandan el codigo y `openspec list`.

**Donde estamos**: la web ya corre sobre Supabase. `/dashboard` lee y escribe la base real como el usuario logueado (magic link + RLS), con la misma UI que `/demo`, que sigue en memoria. Verificado a mano contra el proyecto real (`add-supabase-data-layer-and-login`, 8.1–8.7). El siguiente salto es el bot y el cron, no mas web.

**Web/dashboard**
- Hecho: `/demo` (`app/demo/page.tsx` + `app/demo/demo-dashboard.tsx`) monta el dashboard completo: resumen mensual, tarjeta de margen libre, grupos por categoria, graficos (`recharts`), menu de cuenta con idioma/tema.
- Hecho: interacciones completas — sheet de carga/edicion (`entry-sheet`), sheet de categoria con colores (`category-sheet`), sheet de gasto fijo (`recurring-sheet`), swipe-to-delete con undo, modo reordenar categorias con drag & drop, tarjeta de "Proximos cobros" (`upcoming-charges-card`), animaciones con `gsap` y respeto de `prefers-reduced-motion`.
- Hecho: todas las mutaciones pasan por contratos inyectados (`DashboardActions`, `CategoryMutations`, `ExpenseMutations`, `RecurringMutations`, `IncomeMutations`, `SavingsMutations` en `lib/data/`), con dos implementaciones: `lib/demo/*` (en memoria, `/demo`) y `lib/data/supabase/*` (base real, `/dashboard`, via server actions de `app/dashboard/actions.ts`).
- Hecho: rutas reales (`add-supabase-data-layer-and-login`): `/` es Home con "Demo" y "Entrar"; `/login` pide el magic link (`shouldCreateUser: false`); `/auth/confirm` acepta `?token_hash=` y `?code=` (enmienda D5); `/dashboard` con sesion (redirige a `/login` sin ella, mensaje "cuenta sin vincular" si el auth user no tiene fila en `usuarios`), ciclo por `?mes=YYYY-MM` con clamp al ciclo en curso, y "Cerrar sesion" en el menu de cuenta. `proxy.ts` refresca la sesion. Todo Supabase corre del lado servidor; el bundle del navegador no lo incluye.
- Hecho: `resumenMensual` (`lib/data/supabase/dashboard.ts`) arma el dashboard real: seis ciclos, grupos por categoria, presupuestos del ciclo mostrado (copia al ciclo en curso via `copiar_presupuestos_ciclo`), ahorro con acumulado y meta, margen libre con `getFreeMargin`.
- Hecho: ajustes de UI en `dashboard-template.tsx` hechos fuera de las tasks: `pb-section` sobre el hero cuando no hay `notice` (la demo sigue con `pb-3`); el header se vuelve solido cuando la mitad del titulo del mes pasa bajo la barra (`intersectionRatio >= 0.5`); `pt-3` en el titulo; logo de 48px (`size-12`); "Mango" en `text-headline-md`.
- Hecho: el panel de ingresos es editable igual que gastos — alta, edicion, borrado con deshacer y recurrencia, via el mismo `entry-sheet` y `swipe-to-delete` (`add-income-management`). Ya no quedan "fuentes estimadas"; el panel lista entradas fechadas.
- Hecho: el margen libre usa sobres (`fix-free-margin-envelope-budgets`): `getFreeMargin` en `lib/data/budget.ts` descuenta `max(presupuesto, gastado)` por categoria con presupuesto y lo gastado sin presupuesto, sin termino aparte de fijos: los cobros recurrentes cuentan dentro de su categoria (los pendientes a su monto esperado) y entran en la barra de presupuesto; el ritmo los deja afuera. Presupuestos por ciclo (`BudgetRow`, copia al ciclo actual, marca `monto` null al borrar) implementados en `lib/demo/demo-budgets.ts` y en la base (funciones de `0017`). `/demo` arranca en 864 €. El boton de ciclo siguiente queda deshabilitado en el ciclo en curso.

**Bot de WhatsApp**
- Hecho: webhook (`app/api/whatsapp/route.ts`), validacion HMAC (`lib/whatsapp/signature.ts`), adaptador y extraccion de payload.
- A medias: `lib/bot/logic.ts` es stub — `processMessage` y `processUnknownNumber` devuelven `{ kind: 'none' }`. Faltan parser Gemini + Zod, onboarding, invitaciones y rate limiting (TODOs en el archivo).
- Pendiente: Zod y el SDK de Gemini no estan en `package.json`.

**Base de datos**
- Hecho: 19 migraciones en `supabase/migrations/`, todas aplicadas a la base real. `0017_funciones_dashboard.sql`: funciones `security invoker` con `p_usuario_id` explicito para categorias (crear/actualizar/eliminar/reordenar), presupuestos por ciclo (`copiar_presupuestos_ciclo`) y recurrentes (crear/actualizar/eliminar), atomicas. `0019_referencias_mismo_usuario.sql`: FKs compuestas con `usuario_id`, asi la base rechaza una transaccion, definicion o presupuesto que apunte a una categoria o definicion de otro usuario (lo encontro 8.3: RLS solo miraba `usuario_id`).
- Hecho: `lib/data/supabase/` (contexto, ciclo, usuario, `resumenMensual`, y las implementaciones de los cinco contratos). Toman un cliente y un `usuarios.id`, asi el bot las puede reusar con el cliente admin. El bot sigue usando solo `users.ts` (`findUserIdByPhone`) y `transactions.ts` (`messageAlreadyProcessed`).
- Hecho: usuario de prueba sembrado con `supabase/seed/test-user.sql` (e-mail placeholder en el repo; al correrlo se cambia solo `v_email`): 45 transacciones, 7 categorias, 7 definiciones, 18 presupuestos. Hoy los datos de la base son descartables hasta que se carguen los reales.
- Pendiente: el cron que inserta los gastos fijos y decrementa/desactiva por repeticiones.

**i18n/tema**
- Hecho: next-intl (`messages/es.json`, `en.json`), cambio de idioma por server action, tema claro/oscuro (`components/theme/theme-sync.tsx`).

**Tests**
- Hecho: script `npm test` (Playwright) y specs propias sobre `/demo`: `recurring-create`, `recurring-scope`, `recurring-motion-a11y`, `reorder-mode`, `category-sheet-header`, `animated-amount`, `income-create`, `income-edit-delete`, `income-recurring`, `income-motion-a11y`. Sin base: `home` (Home, sin requests a Supabase) y `login-access` (form de login, redirecciones sin sesion). `npm run test:unit` para funciones puras.
- Hecho: `/dashboard` contra la base real se verifico a mano con scripts de Playwright (sesion por token de un solo uso en `auth.one_time_tokens`, abierta en `/auth/confirm?token_hash=`); no hay spec automatica porque necesita la base.
- Pendiente: unitarios de ritmo/presupuesto y cobertura de los sheets de gasto/categoria.

**Deploy/entorno**
- Hecho: `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` del proyecto real (`noemlszbjqzqbzagahyd`).
- Hecho: MCP de Supabase conectado (`.mcp.json`, con escritura) — usar `list_tables`, `execute_sql`, `apply_migration` para consultar y migrar la base real en vez de pedirle SQL al usuario. Pedir confirmacion antes de cualquier escritura.
- Hecho: la base real tiene aplicadas `0001`–`0019` (2026-09-24). Antes de la `0018` hubo que pasar los dos `presupuestos` de Brian de `periodo = 'mensual'` a `2026-08-26` (venian del `0012` viejo). La `0017` paso los smoke tests de la 3.3; la `0019` se agrego y aplico durante la 8.3.
- Hecho: Auth por e-mail con sign-ups apagados; Site URL `http://localhost:3000` y redirect `http://localhost:3000/auth/confirm`. Para produccion hay que sumar la URL de Vercel.
- Pendiente: sin evidencia de deploy en Vercel.

**OpenSpec**
- Archivados (10): `translate-code-to-english`, `land-finance-dashboard`, `refine-mobile-ui-apple-hig`, `unify-add-action-rows`, `add-expense-sheet`, `add-category-sheet`, `add-category-reorder-mode`, `replace-fixed-card-with-upcoming-charges`, `add-project-status-to-claude-md`, `add-income-management` (26/27 — 1.4 quedo bloqueada, ver Deuda tecnica).
- Specs vivas en `openspec/specs/` (15): `dashboard-ui`, `design-system`, `theming`, `localization`, `expense-editing`, `category-editing`, `category-creation`, `category-reordering`, `upcoming-charges`, `income-editing`, `savings-editing`, `recurring-expenses`, `dashboard-data`, `web-access`, `test-user-seed`.
- Archivados 2026-09-24:
  - `add-supabase-data-layer-and-login` (36/36): suma las specs vivas `dashboard-data`, `web-access` y `test-user-seed`.
  - `add-recurring-expense-management` (27/27, la 2.1 verificada contra la base real): suma la spec viva `recurring-expenses`. Sus MODIFIED se integraron a mano sobre las specs actuales (`dashboard-ui`, `design-system`, `expense-editing`, `upcoming-charges`), con los montos al dia.
  - `restyle-dashboard-to-v0` (17/20, cerrado sin 6.1-6.3 y sin sincronizar): lo reemplazaron `refine-mobile-ui-apple-hig` y `design-system`.
- Abiertos: ninguno.

## Proyeccion

Proximos pasos, en orden:
1. Bot: parser Gemini + Zod, carga de transacciones, confirmacion progresiva (ARCHITECTURE.md §3), reusando `lib/data/supabase/*` con el cliente admin.
2. Cron de gastos fijos (con repeticiones) junto con `transacciones.estado`, que reemplaza las reglas provisorias de cobrado/pendiente (ARCHITECTURE.md §7).
3. Deploy en Vercel, variables de entorno, URL de produccion en Supabase Auth, y SMTP propio con el template de magic link (ARCHITECTURE.md §2).
4. Onboarding por chat e invitaciones con rate limiting (ARCHITECTURE.md §4, §10).
5. Mas tests (unitarios de ritmo/presupuesto, Playwright sobre los sheets restantes).

Mapeo a fases (ARCHITECTURE.md §13):
- **Fase 1** (uso personal): la UI y la web real (capa de datos, login, dashboard) estan hechas; faltan el bot funcional, el cron y el deploy (pasos 1-3).
- **Fase 2** (amigos y demo): invitaciones y rate limiting (paso 4); la demo publica (§12) ya esta hecha via `/demo`.
- **Fase 3** (refinamiento): sin empezar, salvo la traduccion a ingles (§2) que ya esta hecha.

## Deuda tecnica
> Lo que un change dejo afuera a proposito. Se actualiza al archivar: lo que en el change vivia en *Out of scope* o en *Risks* se copia aca, porque al archivarse desaparece de la vista.

- **Cron de movimientos recurrentes** — nada genera la fila del ciclo ni descuenta `repeticiones_insertadas`; las definiciones existen y no producen cargos. Desde el ciclo que empieza el 26 de septiembre, "Proximos cobros" del usuario de prueba queda vacio hasta que exista el cron. Diferido por `add-recurring-expense-management`, `add-income-management` y `add-supabase-data-layer-and-login` (ARCHITECTURE.md §7, §11).
- **`transacciones.estado`** — §7 y §8 lo dan por hecho (`pendiente` | `confirmada`) para reconciliar un fijo de monto variable con la carga manual, pero la columna nunca se creo: `0008` no la tiene. Regla provisoria en los dos lados: un cargo esta cobrado cuando su fecha local no es posterior a hoy (`isCharged` en `lib/data/supabase/dashboard.ts`, y `actualizar_movimiento_recurrente` en `0017` solo reescribe el cargo pendiente). Se reemplaza junto con el cron.
- **`dia_del_mes` null** — la columna admite null y el `0012` siembra las definiciones de Brian sin dia; la UI necesita un numero. Regla provisoria: null se muestra como dia 1 (mapeo de definiciones y `Expense.fixed.day`). Falta decidir si pasa a `NOT NULL`. `add-supabase-data-layer-and-login` (gap 3).
- **`repeticiones_insertadas` distinto entre demo y Supabase** — al crear un plan desde la hoja, Supabase vincula el cargo de este ciclo y cuenta 1 de N; el demo muestra 0 de N. Se resuelve cuando el cron sea duenio del contador. `add-supabase-data-layer-and-login` (gap 5).
- **Monedas mezcladas** — las mutaciones escriben `usuarios.moneda_default` y `resumenMensual` suma `monto` sin mirar `moneda`. Si el bot llega a guardar filas en otra moneda, se sumarian sin convertir. `add-supabase-data-layer-and-login` (gap 6).
- **UI de ahorro** — el alta ya tiene `SavingsMutations` y hoja propia (`add-savings-mutations`), en memoria y en Supabase; falta editar y borrar un movimiento (`add-savings-sheet`).
- **Barra y sparkline de ahorro sin montar** — `components/molecules/savings-progress.tsx`, el `hatchedTo` de `progress-bar.tsx` y `components/atoms/savings-sparkline.tsx` existen pero no los renderiza nadie: se revirtieron del tile de Ahorro y del bloque Acumulado para reusarlos en la hoja de ahorro. `savings.target`, `savings.history` y `getSavingsProgress` siguen en los datos sin consumidor en la UI.
- **Meta de ahorro sin edicion** — `meta_ahorro_mensual` (migracion `0016`) no tiene UI en ningun lado para fijarla; el demo la siembra en 300, el camino real espera al onboarding. `add-savings-progress`.
- **Definiciones recurrentes de ingreso sin edicion** — la hoja de definicion abre desde "Proximos cobros", donde un ingreso nunca aparece, asi que una recurrencia de ingreso se corrige borrando y recargando. Aceptado en `add-income-management`.
- **`ingresos_esperados` sin usar** — tabla creada en `0007`, ningun TypeScript la lee. El "piso del mes" (§9) no esta construido; `add-income-management` reemplazo las fuentes estimadas por entradas planas sin tocar esta tabla.
- **`hojaGasto` guarda strings de ingreso** — el namespace quedo mal nombrado tras `add-income-management`; renombrarlo es mecanico y toca las dos catalogos.
- **`presupuestos.periodo` si cambia `dia_inicio_ciclo`** — las claves `periodo` son el primer dia del ciclo calculado con el `dia_inicio_ciclo` de ese momento; si el usuario lo cambia, las filas existentes dejan de caer en inicios de ciclo. Hoy no hay UI para cambiarlo. `fix-free-margin-envelope-budgets`.
- **Sin tests unitarios** — `getBudgetStatus` y `selectUpcomingCharges` son funciones puras cubiertas solo de rebote por Playwright.
- **Mail de magic link sin marca y sin SMTP propio** — hoy sale el template por defecto de Supabase ("Supabase Auth", sin estilo de Mango), porque Supabase no deja editar templates sin SMTP propio. Ademas, el mailer incluido manda pocos mails por hora. Pendiente: configurar SMTP propio (p. ej. Resend, con remitente del dominio de Mango) y disenar el template *Magic Link* con la marca: logo, colores y tipografia de `design-system`, texto en es/en, y un solo boton. El link del template tiene que ser `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, que abre la sesion en cualquier navegador; hasta entonces el link `?code=` solo funciona en el mismo navegador donde se pidio (enmienda a D5 de `add-supabase-data-layer-and-login`). Mismo tratamiento para los demas templates de Auth que se usen.