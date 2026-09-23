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

## Estado actual (al 2026-09-21)
> Se actualiza al archivar un change de OpenSpec o al cerrar un hito. Ante duda, mandan el codigo y `openspec list`.

**Donde estamos**: toda la UI del producto esta construida y funciona sobre `/demo` con datos en memoria. Nada esta conectado a Supabase todavia (salvo dos helpers del bot). El siguiente salto es la capa de datos real + auth, no mas UI.

**Web/dashboard**
- Hecho: `/demo` (`app/demo/page.tsx` + `app/demo/demo-dashboard.tsx`) monta el dashboard completo: resumen mensual, tarjeta de margen libre, grupos por categoria, graficos (`recharts`), menu de cuenta con idioma/tema.
- Hecho: interacciones completas — sheet de carga/edicion (`entry-sheet`), sheet de categoria con colores (`category-sheet`), sheet de gasto fijo (`recurring-sheet`), swipe-to-delete con undo, modo reordenar categorias con drag & drop, tarjeta de "Proximos cobros" (`upcoming-charges-card`), animaciones con `gsap` y respeto de `prefers-reduced-motion`.
- Hecho: todas las mutaciones pasan por contratos inyectados (`DashboardActions`, `CategoryMutations`, `ExpenseMutations`, `RecurringMutations`, `IncomeMutations` en `lib/data/`), implementados hoy solo por `lib/demo/*`. Enchufar Supabase es implementar esos contratos, no tocar componentes.
- Hecho: el panel de ingresos es editable igual que gastos — alta, edicion, borrado con deshacer y recurrencia, via el mismo `entry-sheet` y `swipe-to-delete` (`add-income-management`). Ya no quedan "fuentes estimadas"; el panel lista entradas fechadas.
- Hecho: el margen libre usa sobres (`fix-free-margin-envelope-budgets`): `getFreeMargin` en `lib/data/budget.ts` descuenta `max(presupuesto, gastado)` por categoria con presupuesto y lo gastado sin presupuesto, sin termino aparte de fijos: los cobros recurrentes cuentan dentro de su categoria (los pendientes a su monto esperado) y entran en la barra de presupuesto; el ritmo los deja afuera. Presupuestos por ciclo (`BudgetRow`, copia al ciclo actual) implementados solo en `lib/demo/demo-budgets.ts`; `/demo` arranca en 864 €. El boton de ciclo siguiente queda deshabilitado en el ciclo en curso.
- Pendiente: `app/page.tsx` sigue siendo el boilerplate de `create-next-app`. No hay ruta real del dashboard ni Supabase Auth (magic link).

**Bot de WhatsApp**
- Hecho: webhook (`app/api/whatsapp/route.ts`), validacion HMAC (`lib/whatsapp/signature.ts`), adaptador y extraccion de payload.
- A medias: `lib/bot/logic.ts` es stub — `processMessage` y `processUnknownNumber` devuelven `{ kind: 'none' }`. Faltan parser Gemini + Zod, onboarding, invitaciones y rate limiting (TODOs en el archivo).
- Pendiente: Zod y el SDK de Gemini no estan en `package.json`.

**Base de datos**
- Hecho: 13 migraciones en `supabase/migrations/` (tablas, RLS, ciclo de facturacion, seed de Brian, `0013_gastos_fijos_repeticiones.sql` con `repeticiones_totales` / `repeticiones_insertadas`).
- A medias: `lib/data/` es sobre todo tipos y funciones puras (`getBudgetStatus`, `selectUpcomingCharges`) mas los contratos de mutacion. Solo `users.ts` (`findUserIdByPhone`) y `transactions.ts` (`messageAlreadyProcessed`) hablan con Supabase. No existe `resumenMensual` ni queries del dashboard.
- Pendiente: el cron que inserta los gastos fijos y decrementa/desactiva por repeticiones.

**i18n/tema**
- Hecho: next-intl (`messages/es.json`, `en.json`), cambio de idioma por server action, tema claro/oscuro (`components/theme/theme-sync.tsx`).

**Tests**
- Hecho: script `npm test` (Playwright) y specs propias sobre `/demo`: `recurring-create`, `recurring-scope`, `recurring-motion-a11y`, `reorder-mode`, `category-sheet-header`, `animated-amount`, `income-create`, `income-edit-delete`, `income-recurring`, `income-motion-a11y`.
- Pendiente: unitarios de ritmo/presupuesto y cobertura de los sheets de gasto/categoria.

**Deploy/entorno**
- Pendiente: sin `.env.local` en el repo local, sin evidencia de deploy en Vercel.

**OpenSpec**
- Archivados (10): `translate-code-to-english`, `land-finance-dashboard`, `refine-mobile-ui-apple-hig`, `unify-add-action-rows`, `add-expense-sheet`, `add-category-sheet`, `add-category-reorder-mode`, `replace-fixed-card-with-upcoming-charges`, `add-project-status-to-claude-md`, `add-income-management` (26/27 — 1.4 quedo bloqueada, ver Deuda tecnica).
- Specs vivas en `openspec/specs/`: `dashboard-ui`, `design-system`, `theming`, `localization`, `expense-editing`, `category-editing`, `category-reordering`, `upcoming-charges`, `income-editing`.
- Abiertos: `add-recurring-expense-management` 26/27 (solo falta marcar/verificar 2.1, la migracion 0013 ya existe), `restyle-dashboard-to-v0` 17/20 (faltan 6.1-6.3, verificacion final).

## Proyeccion

Proximos pasos, en orden:
1. Cerrar los dos changes abiertos (`add-recurring-expense-management` 2.1, `restyle-dashboard-to-v0` 6.1-6.3) y archivarlos.
2. Capa de datos real (`resumenMensual` y queries del dashboard en `lib/data/`) implementando los contratos de mutacion que hoy cubre `lib/demo/`.
3. Ruta real del dashboard (reemplazar `app/page.tsx`) + Supabase Auth con magic link.
4. Bot: parser Gemini + Zod, carga de transacciones, confirmacion progresiva (ARCHITECTURE.md §3).
5. Onboarding por chat e invitaciones con rate limiting (ARCHITECTURE.md §4, §10).
6. Cron de gastos fijos (con repeticiones), deploy en Vercel y variables de entorno (ARCHITECTURE.md §2, §7).
7. Mas tests (unitarios de ritmo/presupuesto, Playwright sobre los sheets restantes).

Mapeo a fases (ARCHITECTURE.md §13):
- **Fase 1** (uso personal): la UI esta terminada; falta backend — pasos 2-4 (capa de datos, dashboard real con auth, bot funcional).
- **Fase 2** (amigos y demo): invitaciones y rate limiting (paso 5); la demo publica (§12) ya esta hecha via `/demo`.
- **Fase 3** (refinamiento): sin empezar, salvo la traduccion a ingles (§2) que ya esta hecha.

## Deuda tecnica
> Lo que un change dejo afuera a proposito. Se actualiza al archivar: lo que en el change vivia en *Out of scope* o en *Risks* se copia aca, porque al archivarse desaparece de la vista.

- **Cron de movimientos recurrentes** — nada genera la fila del ciclo ni descuenta `repeticiones_insertadas`; las definiciones existen y no producen cargos. Diferido por `add-recurring-expense-management` y `add-income-management` (ARCHITECTURE.md §7, §11).
- **`transacciones.estado`** — §7 y §8 lo dan por hecho (`pendiente` | `confirmada`) para reconciliar un fijo de monto variable con la carga manual, pero la columna nunca se creo: `0008` no la tiene. Hoy el estado "cobrado" del dashboard sale del dia del mes, no de la fila.
- **Capa de datos real** — los contratos de `lib/data/` solo tienen implementacion en memoria (`lib/demo/`). Falta la de Supabase para todos, incluido `IncomeMutations` (ya definido en `lib/data/income.ts` tras `add-income-management`, sin implementacion real).
- **Migracion 0015 sin aplicar contra una base real** — `add-income-management` (tarea 1.4) no pudo re-correr las migraciones desde cero: no hay docker/Supabase CLI/psql en este entorno. 1.1-1.3 se verificaron solo por revision estatica del SQL.
- **UI de ahorro** — el alta ya tiene `SavingsMutations` y hoja propia (`add-savings-mutations`); falta editar y borrar un movimiento (`add-savings-sheet`) y la implementacion real de Supabase.
- **Barra y sparkline de ahorro sin montar** — `components/molecules/savings-progress.tsx`, el `hatchedTo` de `progress-bar.tsx` y `components/atoms/savings-sparkline.tsx` existen pero no los renderiza nadie: se revirtieron del tile de Ahorro y del bloque Acumulado para reusarlos en la hoja de ahorro. `savings.target`, `savings.history` y `getSavingsProgress` siguen en los datos sin consumidor en la UI.
- **Meta de ahorro sin edicion** — `meta_ahorro_mensual` (migracion `0016`) no tiene UI en ningun lado para fijarla; el demo la siembra en 300, el camino real espera al onboarding. `add-savings-progress`.
- **Migracion 0016 sin aplicar contra una base real** — mismo limite que la `0015` (tarea 1.3 de `add-savings-progress`): no hay docker/Supabase CLI/psql en este entorno, se verifico solo por revision estatica del SQL.
- **Definiciones recurrentes de ingreso sin edicion** — la hoja de definicion abre desde "Proximos cobros", donde un ingreso nunca aparece, asi que una recurrencia de ingreso se corrige borrando y recargando. Aceptado en `add-income-management`.
- **`ingresos_esperados` sin usar** — tabla creada en `0007`, ningun TypeScript la lee. El "piso del mes" (§9) no esta construido; `add-income-management` reemplazo las fuentes estimadas por entradas planas sin tocar esta tabla.
- **`hojaGasto` guarda strings de ingreso** — el namespace quedo mal nombrado tras `add-income-management`; renombrarlo es mecanico y toca las dos catalogos.
- **Presupuestos por ciclo sin implementacion real** — `BudgetRow` y la copia al ciclo actual solo existen en `lib/demo/demo-budgets.ts`. La implementacion de Supabase (RPC `copiar_presupuestos_ciclo`, funciones de categoria que escriben el ciclo actual y la marca `monto` null) esta planeada en `add-supabase-data-layer-and-login` (D8, D12, D15). `fix-free-margin-envelope-budgets`.
- **`presupuestos.periodo` si cambia `dia_inicio_ciclo`** — las claves `periodo` son el primer dia del ciclo calculado con el `dia_inicio_ciclo` de ese momento; si el usuario lo cambia, las filas existentes dejan de caer en inicios de ciclo. Hoy no hay UI para cambiarlo. `fix-free-margin-envelope-budgets`.
- **Migracion 0018 sin aplicar contra una base real** — mismo limite que la `0015` y la `0016`: `0018_presupuestos_periodo_ciclo.sql` y el insert editado de `0012` se verificaron solo por revision estatica del SQL.
- **Sin tests unitarios** — `getBudgetStatus` y `selectUpcomingCharges` son funciones puras cubiertas solo de rebote por Playwright.