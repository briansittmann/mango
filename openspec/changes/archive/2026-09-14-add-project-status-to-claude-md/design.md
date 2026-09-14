## Context

Ver proposal.md (Why). Estado observado en el repo al 2026-09-14, que es la materia prima del snapshot:

- **Web:** `/demo` monta el dashboard completo (`components/templates/dashboard-template.tsx`, atoms/molecules/organisms, Recharts) con datos en memoria de `lib/demo/demo-data.ts`. `app/page.tsx` sigue siendo el boilerplate de `create-next-app`: no hay ruta real del dashboard, ni auth, ni lectura de Supabase desde la web.
- **i18n y tema:** next-intl con `messages/es.json` y `en.json` + `messages/parity.ts`; cambio de idioma por server action (`app/actions/language.ts`); tema claro/oscuro con `components/theme/theme-sync.tsx`. La traducción al inglés (fase 3 en ARCHITECTURE §13) ya está adelantada.
- **Bot de WhatsApp:** `app/api/whatsapp/route.ts` (GET de verificación + POST), validación HMAC (`lib/whatsapp/signature.ts`), extracción de payload y adaptador. `lib/bot/logic.ts` es stub: `processMessage` y `processUnknownNumber` devuelven `{ kind: 'none' }` con TODOs (parser Gemini + Zod, onboarding, invitaciones, rate limiting). Zod y el SDK de Gemini no están en `package.json`.
- **Datos:** 12 migraciones en `supabase/migrations/` (tablas, ciclo de facturación, helpers, RLS, seed de Brian). `lib/data/` tiene tipos del dashboard, `getBudgetStatus`, `findUserIdByPhone` y `messageAlreadyProcessed`; no hay `resumenMensual` ni queries del dashboard.
- **Tests:** `tests/example.spec.js` es el ejemplo de Playwright; no hay tests propios ni script `test`.
- **Deploy/entorno:** no hay `.env.local` en el repo local; no hay evidencia de deploy en Vercel.
- **OpenSpec:** `translate-code-to-english` y `land-finance-dashboard` completos pero sin archivar (`openspec/specs/` vacío); `restyle-dashboard-to-v0` en 17/20 (faltan 6.1–6.3, verificación final).

Restricción: `CLAUDE.md` se carga en todas las sesiones, así que cada línea cuesta contexto siempre.

## Goals / Non-Goals

**Goals:**
- Que una sesión nueva sepa en ~1 minuto de lectura qué existe, qué es stub y cuál es el próximo paso.
- Que el estado sea verificable: cada ítem apunta a un archivo o a un change de OpenSpec.

**Non-Goals:**
- No duplicar decisiones de diseño ni el roadmap completo de `ARCHITECTURE.md`.
- No reescribir las 13 reglas existentes ni el `README.md`.
- No automatizar la actualización (scripts, hooks).

## Decisions

1. **Dentro de `CLAUDE.md`, no en un archivo aparte (`STATUS.md`).** Es lo que pidió el usuario y es lo único que se carga solo. Alternativa descartada: archivo aparte referenciado desde `CLAUDE.md` — obliga a una lectura extra que es justo lo que se quiere evitar.
2. **Al final del archivo, después de la regla 13**, con dos secciones `## Estado actual (al AAAA-MM-DD)` y `## Proyección`. Las reglas siguen arriba porque son lo prioritario; el estado es contexto.
3. **Formato de lista por área con marcador de estado** (hecho / a medias / pendiente), una línea por ítem con la ruta del archivo. Alternativa descartada: tabla — más ancha y más cara de editar a mano.
4. **Proyección en dos niveles:** (a) próximos pasos inmediatos, ordenados y concretos; (b) una línea por fase de ARCHITECTURE §13 indicando qué falta, con referencia a la sección en vez de copiarla.
5. **Próximos pasos propuestos (orden):**
   1. Cerrar `restyle-dashboard-to-v0` (6.1–6.3) y archivar los tres changes, para que `openspec/specs/` refleje lo construido.
   2. Capa de datos real: `resumenMensual` y queries del dashboard en `lib/data/`, manteniendo la inyección de datos que ya usa `/demo` (§12).
   3. Ruta real del dashboard (reemplazar el boilerplate de `app/page.tsx`) + Supabase Auth con magic link.
   4. Bot: parser Gemini + Zod, carga de transacciones con `otros` por defecto, confirmación progresiva (§3).
   5. Onboarding por chat e invitaciones con rate limiting (§4, §10).
   6. Cron de gastos fijos, deploy en Vercel y variables de entorno (§2, §7).
   7. Tests propios (Playwright sobre `/demo`, unitarios de `getBudgetStatus`/ritmo).
   Es una propuesta derivada de las fases de §13; el usuario puede reordenarla al revisar.
6. **Regla de mantenimiento como una línea**, dentro de la sección de estado: actualizar al archivar un change o cerrar un hito, y cambiar la fecha.
7. **Idioma español, mismo tono directo y breve que las reglas existentes.** Tope orientativo: ≤ 70 líneas nuevas.

## Risks / Trade-offs

- [El snapshot se desactualiza] → fecha en el título + regla de mantenimiento; ante la duda, el código y `openspec list` mandan.
- [Más contexto fijo por sesión] → tope de ~70 líneas y referencias a §N en vez de contenido copiado.
- [El orden de próximos pasos no coincide con la prioridad real del usuario] → queda explícito en la propuesta; se ajusta en revisión antes del apply.
