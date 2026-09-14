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

## Estado actual (al 2026-09-14)
> Se actualiza al archivar un change de OpenSpec o al cerrar un hito. Ante duda, mandan el codigo y `openspec list`.

**Web/dashboard**
- Hecho: `/demo` (`app/demo/page.tsx`) monta el dashboard completo con datos en memoria (`lib/demo/demo-data.ts`), sin Supabase ni login.
- Pendiente: `app/page.tsx` sigue siendo el boilerplate de `create-next-app`. No hay ruta real del dashboard ni Supabase Auth (magic link).

**Bot de WhatsApp**
- Hecho: webhook (`app/api/whatsapp/route.ts`), validacion HMAC (`lib/whatsapp/signature.ts`), adaptador y extraccion de payload.
- A medias: `lib/bot/logic.ts` es stub — `processMessage` y `processUnknownNumber` devuelven `{ kind: 'none' }`. Faltan parser Gemini + Zod, onboarding, invitaciones y rate limiting (TODOs en el archivo).
- Pendiente: Zod y el SDK de Gemini no estan en `package.json`.

**Base de datos**
- Hecho: 12 migraciones en `supabase/migrations/` (tablas, RLS, ciclo de facturacion, seed de Brian).
- A medias: `lib/data/` tiene tipos del dashboard, `getBudgetStatus`, `findUserIdByPhone`, `messageAlreadyProcessed`. No existe `resumenMensual` ni queries reales del dashboard.

**i18n/tema**
- Hecho: next-intl (`messages/es.json`, `en.json`), cambio de idioma por server action, tema claro/oscuro (`components/theme/theme-sync.tsx`).

**Tests**
- Pendiente: solo esta el ejemplo de Playwright (`tests/example.spec.js`). Sin tests propios ni script `test`.

**Deploy/entorno**
- Pendiente: sin `.env.local` en el repo local, sin evidencia de deploy en Vercel.

**OpenSpec**
- `translate-code-to-english` y `land-finance-dashboard`: completos, sin archivar.
- `restyle-dashboard-to-v0`: 17/20 (faltan tareas 6.1-6.3, verificacion final).

## Proyeccion

Proximos pasos, en orden:
1. Cerrar `restyle-dashboard-to-v0` (6.1-6.3) y archivar los tres changes completos, para que `openspec/specs/` refleje lo construido.
2. Capa de datos real (`resumenMensual` y queries del dashboard en `lib/data/`), manteniendo la inyeccion de datos que ya usa `/demo`.
3. Ruta real del dashboard (reemplazar `app/page.tsx`) + Supabase Auth con magic link.
4. Bot: parser Gemini + Zod, carga de transacciones, confirmacion progresiva (ARCHITECTURE.md §3).
5. Onboarding por chat e invitaciones con rate limiting (ARCHITECTURE.md §4, §10).
6. Cron de gastos fijos, deploy en Vercel y variables de entorno (ARCHITECTURE.md §2, §7).
7. Tests propios (Playwright sobre `/demo`, unitarios de ritmo/presupuesto).

Mapeo a fases (ARCHITECTURE.md §13):
- **Fase 1** (uso personal): pasos 2-4 arriba. Falta el grueso — capa de datos, dashboard real y bot funcional.
- **Fase 2** (amigos y demo): invitaciones y rate limiting (paso 5); la demo publica (§12) ya esta adelantada via `/demo`.
- **Fase 3** (refinamiento): sin empezar, salvo la traduccion a ingles (§2) que ya esta hecha.