# ROADMAP.md — Mango

> Lista de tareas a gran escala, al 27/9/2026. Cada bloque se baja a detalle cuando toque trabajarlo.
> **👤 = Brian** (cuentas, paneles, decisiones) · **🤖 = Claude Code** (código, migraciones)

Estado de partida: web y `/dashboard` sobre Supabase hechos, demo publicada en `https://www.usemango.dev/demo`, webhook de WhatsApp escrito pero con la lógica del bot en stub.

**Cambio de modelo (24/9):** Mango deja de tener una sola puerta de entrada. El dashboard ya permite cargar todo a mano, así que **cualquiera puede registrarse por la web** y usarlo sin bot. WhatsApp pasa a ser un canal opcional, limitado por el cupo de Meta.

**Decisión (1/10):** WhatsApp va a estar **abierto a todas las cuentas**; la landing promete el bot para todos.

**Decisión (3/10):** **se saca la invitación.** La cuenta nace solo por la web; WhatsApp se vincula desde la cuenta (cierre del onboarding o ajustes). Desaparecen el onboarding por chat, la tabla `invitaciones`, el código del cierre y el interruptor `WHATSAPP_REQUIRE_INVITE`. Mientras se use el número de prueba, los 5 destinatarios se cargan a mano en el panel de Meta. Detalle en ARCHITECTURE.md §4.

---

# Fase 1 — uso personal

## 0 · Arreglos rápidos de producción

- [x] 🤖 `metadata` en `app/layout.tsx`: título "Mango", descripción real, imagen Open Graph (hoy dice "Create Next App")
- [x] 🤖 Actualizar el estado en `CLAUDE.md` con el dominio `usemango.dev` (sacar "sin evidencia de deploy") y sumar `ROADMAP.md` al repo como referencia
- [x] 👤 Supabase Auth: Site URL `https://www.usemango.dev` + redirect `https://www.usemango.dev/auth/confirm`
- [x] 👤 Confirmar que las variables de Supabase están en Vercel y que `/dashboard` funciona en producción con magic link
- [x] 👤 Redeploy después de cualquier cambio de variables

## 1 · Cerrar los changes abiertos y poner la documentación al día

- [x] 🤖 `add-recurring-expense-management` — verificar y marcar la 2.1
- [x] 🤖 `restyle-dashboard-to-v0` — verificación final 6.1–6.3, archivar ambos (archivado sin 6.1–6.3: lo reemplazaron `refine-mobile-ui-apple-hig` y `design-system`)
- [x] 🤖 Actualizar `ARCHITECTURE.md` con el cambio de modelo, **antes de empezar el bloque 4**:
  - §1: la web deja de ser solo para ver y editar; también es puerta de entrada y se puede usar sin bot
  - §4: "El bot es la puerta de entrada" pasa a ser dos entradas (web abierta, WhatsApp por invitación) y dos onboardings que terminan en la misma cuenta; acceso a la web con Google o magic link
  - §8: tabla `canales`, `usuarios.telefono` nullable, `mensaje_id_externo` en vez de `wa_message_id`
  - §10: registro web abierto, WhatsApp sigue por invitación
  - §13: repartir las fases según este roadmap y sumar la Fase 4 (número propio y pagos)
- [x] 🤖 Reflejar lo mismo en el estado de `CLAUDE.md` (Proyección)

## 2 · WhatsApp de punta a punta (sin lógica todavía)

- [x] 👤 Registrar webhook en Meta: `https://www.usemango.dev/api/whatsapp` (con `www`), verify token, suscribir `messages`; suscribir la app a la WABA con `subscribed_apps` (ARCHITECTURE.md §2)
- [x] 👤 Mandar un mensaje de prueba y ver en los logs de Vercel que llega y que la firma HMAC valida
- [x] 👤 ~~Quitar el `setWebhook` del bot de Telegram~~ — no hace falta: nadie conoce el bot. Se revisa con `getWebhookInfo` en el bloque 11

## 3 · Insumos del parser (decisiones tuyas — bloquean el bloque 5)

- [x] 👤 Categorías reales (8–12) → 9, con Supermercado dentro de Comida; el ciclo pasa a empezar el día 1
- [x] 👤 Gastos fijos reales: nombre, monto, día, categoría. Decidir si se registra medio de pago → sin medio de pago por ahora; Gamepass Papá (13 €, día 14) se sumó a la base el 27/9 con su cargo de septiembre
- [x] 👤 15–20 mensajes de ejemplo tal como los escribirías (set de pruebas del parser) → `lib/bot/parser-cases.json`
- [x] 🤖 Reemplazar los datos de prueba de la base por los reales → `supabase/seed/brian.sql`, aplicado el 27/9; una sola cuenta (la de la web) con el canal de WhatsApp

## 4 · Identidad separada del canal (antes del bot)

> Va antes del bloque 5 a propósito: si el bot escribe pegado al teléfono, migrarlo después cuesta más que dejar el hueco ahora.

- [x] 🤖 Tabla `canales` (`usuario_id`, `tipo` = `whatsapp` | `telegram`, `identificador_externo`, único por tipo + identificador). El usuario pasa a ser una identidad sin teléfono; el teléfono es un canal más
- [x] 🤖 `usuarios.telefono` deja de ser obligatorio: una cuenta creada por la web no tiene
- [x] 🤖 Migrar el usuario de prueba a una fila de `canales`; `findUserIdByPhone` pasa a buscar en `canales`
- [x] 🤖 Idempotencia por canal: `wa_message_id` se generaliza a `mensaje_id_externo` + tipo de canal
- [x] 🤖 Nada asume el número de prueba: sin tope de 5 ni cupo de 1000 en el código; el número emisor sale de `WHATSAPP_PHONE_NUMBER_ID`
- [x] 🤖 Interruptor de invitación obligatoria: hoy encendido; con número propio se apaga sin tocar código (ARCHITECTURE.md §4) — retirado el 3/10: se quita en el bloque 10
- [x] 👤 Decidir si una cuenta puede tener WhatsApp y Telegram a la vez, o uno solo → las dos, una de cada tipo
- [x] 👤 Decidir dónde vive el interruptor: variable de entorno o valor en la base → `WHATSAPP_REQUIRE_INVITE` (retirado el 3/10)

## 6 · Cron de gastos fijos

> **Orden (27/9):** los bloques 6 y 7 van antes del bloque 5 y se hacen en un solo change de OpenSpec, `add-cycle-projection-and-recurring-cron`: el cron usa la misma `proyectarCiclo` que calcula los meses futuros. Fecha límite: el ciclo de octubre arranca el 1/10; si el cron no está en producción, se insertan los cargos de octubre a mano con `supabase/seed/octubre-2026.sql`.

- [x] 🤖 Migración `transacciones.estado` (`pendiente` | `confirmada`) y reemplazo de las reglas provisorias (`isCharged`, `actualizar_movimiento_recurrente`) → `0021`, aplicada el 27/9
- [x] 🤖 Reconciliación: carga manual completa la fila pendiente del mismo fijo en vez de duplicar → en la web, guardar la fila la confirma; para el bot, `completar_cargo_recurrente`
- [x] 🤖 Cron diario (`vercel.json`): inserta pendientes al inicio del ciclo, cuenta `repeticiones_insertadas`, desactiva al llegar al total, cierra pendientes al fin de ciclo → `/api/cron/recurrentes`, en producción desde el 27/9
- [x] 🤖 Constraint único por `gasto_fijo_id` + ciclo → ya existe desde la `0008` (`movimiento_recurrente_id` + `ciclo_mes`); el change lo usa y lo verifica
- [x] 👤 Decidir si `dia_del_mes` pasa a `NOT NULL` → sí, en la `0021`
- [x] 👤 Decidir a qué hora corre el cron → 05:00 UTC, todos los días; el ciclo de cada usuario se calcula en su timezone
- [x] 👤 Decidir cuándo un fijo se muestra cobrado → confirmado o con su día ya pasado; `estado` concilia
- [x] 👤 Confirmar que el cron dispara en producción — 29/9 05:34 UTC, visto en los logs de la API de Supabase (sin generar nada, como se esperaba)

## 7 · Meses futuros: proyección a 6 ciclos

> Un ciclo futuro **se calcula, no se guarda**. Lo valioso sale solo: ver que el margen sube cuando termina una cuota o baja cuando arranca otra.

- [x] 🤖 Función pura `proyectarCiclo` en la capa de datos compartida: ingresos recurrentes, fijos activos a `monto_actual` respetando `repeticiones_totales` (una cuota que termina deja de aparecer), presupuestos heredados, meta de ahorro
- [x] 🤖 El cron del bloque 6 usa esa misma función para decidir qué insertar: lo proyectado y lo insertado nunca se contradicen
- [x] 🤖 Margen libre proyectado con la misma `getFreeMargin`
- [x] 🤖 Selector de mes: habilitar hasta **6 ciclos adelante** (hoy `?mes=` se recorta al ciclo en curso)
- [x] 🤖 Vista de ciclo futuro: marca visible de "Proyección", barras en cero, sin ritmo ni "gastado"
- [x] 👤 Decidir cómo se muestra un fijo cuyo día no existe en ese mes del ciclo (el 31 en septiembre) → último día de ese mes
- [x] 🤖 `/demo` con proyección también
- [x] 🤖 Editar presupuestos de un ciclo futuro (`0022`, aplicada el 27/9):
  - la hoja pregunta **"solo este mes"** o **"desde este mes en adelante"**; "solo este mes" deja escrito el ciclo siguiente con el valor anterior para que el cambio no se arrastre
  - al editar, materializar **todas** las categorías de ese ciclo, no solo la tocada (si no, la copia ve el ciclo "con filas" y las demás quedan sin presupuesto)
  - levantar la regla "nunca crear filas para un ciclo futuro" de la `0018`
- [ ] 👤 Decidir si más adelante se suman gastos puntuales planificados ("viaje en febrero, 600") — necesita `transacciones.estado`. Fuera de `add-cycle-projection-and-recurring-cron`

## 5 · Bot funcional

> Va después de los bloques 6 y 7 (decisión del 27/9).

> **Estado (28/9), change `add-bot-parser-and-logging`, 28/28, archivado:** parser, lógica, adaptador y envío escritos; `0023` aplicada en la base real. Gemini es pago (Tier 1, `gemini-3.8-flash`). `npm run test:parser` dio 18/18 dos veces seguidas. La prueba local contra la base real (5.1) pasó: carga, pregunta pendiente en `canales` y reintento descartado. Sigue:
> Ronda por WhatsApp en producción (6.1–6.2) hecha el 28/9: los 15 casos y los dos fijos respondieron bien. Fallos para `add-bot-conversation`:
> - "osea lo que gaste esos 50 eran comida", después de cargar 50 en Otros: el bot no contestó nada. Causa, según el log de Vercel: la llamada a Gemini se colgó y la función murió a los 60 s sin reintentar ni responder. Arreglado con un timeout de 20 s por llamada (3.7 del change) y la respuesta "no pude procesarlo" (3.6); el parser da `corregir` → Comida, así que en ese caso el bot contesta "todavía no".
> - No fue un fallo, pero conviene saberlo: "gate 50" (por "gasté 50") se entendió bien y disparó la pregunta de categoría.

- [x] 🤖 Sumar Zod y el SDK de Gemini a `package.json`
- [x] 🤖 Parser: prompt con categorías del usuario, schema Zod, reintento ante JSON inválido
- [x] 🤖 Carga de transacciones reusando `lib/data/supabase/*` con cliente admin; idempotencia; lo que no matchea va a `otros`
- [x] 🤖 Tipos `gasto` / `ingreso` / `ahorro` (incluido retiro en negativo)
- [x] 🤖 Dato faltante ("gasté 50") → repregunta en texto
- [x] 🤖 Confirmación progresiva: `cargas_confirmadas`, `modo_confirmacion`, texto + Deshacer las primeras 15, reacción después. La respuesta a una pregunta de categoría y un fijo con otro monto van siempre en texto
- [x] 🤖 Correcciones por texto sobre la última carga del chat: "borrá eso", "no, era 40", "eran comida". Deshacer borra la carga de su confirmación
- [x] 🤖 Consultas cortas: "¿cómo vengo?" (total del mes, top 5 y una línea con el resto, para que sume) y "libre" (margen libre), con link a la web
- [x] 🤖 Crear categoría por chat, solo a pedido explícito ("creá la categoría Mascotas"); avisa si hay una parecida (ARCHITECTURE.md §3)
- [x] 🤖 Historial solo para VIP: `usuarios.vip` + tabla `mensajes`; guardar entrantes y salientes; el parser recibe los últimos 20 de 24 h (ARCHITECTURE.md §3)
- [x] 👤 Marcarte VIP por SQL → 1/10, por el MCP
- [x] 👤 Decidir cuánto tiempo se guardan los mensajes → 30 días, los borra el cron diario (ARCHITECTURE.md §3)
- [x] 🤖 El cron diario del bloque 6 borra los `mensajes` de más de 30 días (pasado acá desde el bloque 6: la tabla nace en este bloque)
- [x] 👤 Ronda de prueba con los mensajes del bloque 3 y lista de fallos
- [x] 👤 Ronda por WhatsApp de `add-bot-conversation` (1/10): todo pasó; "¿cómo vengo?" no sumaba el total y se le agregó la línea del resto. La charla quedó en `docs/bot-conversacion-ejemplo.md`
- [x] 🤖 Notas de voz (`add-voice-messages`, 8/10): el adaptador descarga el audio de Meta (`lib/whatsapp/media.ts`), la lógica mide la duración desde el contenedor Ogg (30 s máx., `lib/bot/audio.ts`), el parser manda el audio en la misma llamada a Gemini y toda acción trae `transcripcion`; cada respuesta empieza con "🎤 Escuché: «…»", la carga va siempre en texto con Deshacer, otros medios reciben una respuesta fija y del audio no se guarda nada (ARCHITECTURE.md §3)
- [ ] 👤 `add-voice-messages`: confirmar que la key de Gemini sigue en Tier 1 (1.1); grabar en WhatsApp las notas de `lib/bot/voice-cases/voice-cases.json` y exportarlas como Ogg/Opus a esa carpeta (1.2); `npm run test:parser` dos veces (6.2); deploy y ronda por el chat, con una nota de solo ruido de fondo real (8.1–8.2)

> **Estado (8/10), change `add-voice-messages`:** código, tests y docs escritos; `npm run test:unit` 162/162. Probado con voz sintética contra Gemini real: montos hablados bien ("doce con cuarenta" → 12.4), pero **sobre silencio o ruido blanco el modelo inventa una carga** aunque el prompt lo prohíba; la cita "Escuché" y Deshacer son la red hoy, y el ruido real de la ronda decide si hace falta un umbral de energía antes del modelo (ARCHITECTURE.md §11).

> **Estado (1/10), change `add-bot-conversation`:** correcciones, Deshacer, consultas, crear categoría, confirmación progresiva e historial VIP, con `0028` aplicada en la base real. Un fijo con otro monto cambia solo ese mes (decisión del 30/9): el bot no pregunta si es permanente. `npm run test:parser` dio 22/22 dos veces seguidas.

**→ Bloques 0–7 cerrados (1/10/2026): Fase 1 terminada, uso personal real.**

---

# Fase 2 — abrir a otras personas

## 8 · Acceso web y registro abierto

- [x] 👤 Activar sign-ups en Supabase Auth — 29/9, con `open-web-signup` desplegado; el tope real es el diario de Resend (100 mails, plan gratis)
- [x] 🤖 Al primer login, crear la fila en `usuarios` (hoy sale "cuenta sin vincular") y mandar al onboarding web — `open-web-signup`: un trigger sobre `auth.users` (`0025`) la crea con el primer código confirmado; la persona cae en un dashboard vacío hasta que el bloque 9 sume el onboarding y su redirección
- [x] 🤖 `/login`: dejar de fallar en silencio con un mail no registrado; con registro abierto, el mismo formulario sirve para entrar y para crear la cuenta — `open-web-signup`: `POST /auth/request-code` con `shouldCreateUser: true`, idioma y zona horaria, y una línea bajo el campo
- [x] 🤖 Home: "Demo" y "Entrar" con una línea que explique qué es Mango — `open-web-signup` (la landing actual promete el bot para todos)
- [x] 👤 SMTP propio (p. ej. Resend) con remitente del dominio — adelantado al change `replace-magic-link-with-email-otp` (28/9): Resend, remitente `no-reply@usemango.dev`
- [x] 🤖 Template del código con la marca, es/en (hoy sale solo en español; el idioma por usuario va con esto) — `open-web-signup`: `supabase/templates/codigo.html`, idioma por la metadata del auth user; 👤 pegarlo en *Confirm signup* y *Magic Link* (tareas 7.2 y 7.5)

## 9 · Onboarding web

> Una sola puerta: la web. WhatsApp se vincula desde la cuenta (3/10).

**Onboarding web** (registro abierto)
- [x] 🤖 Pantalla 1 nueva: bienvenida sin gasto cargado (reemplaza "Ya cargaste tu primer gasto") — `add-web-onboarding` (2026-10-01)
- [x] 🤖 Pantalla de datos básicos: nombre, país → moneda y timezone, día de inicio de ciclo — `add-web-onboarding`: país de una tabla fija, formato de montos abreviado para Argentina, día editable solo hasta la primera categoría
- [x] 🤖 Pantallas 2–4 de Stitch: categorías, ingresos y fijos, presupuestos (con margen libre en vivo) — `add-web-onboarding`, sin pasar por Stitch: chips y compositores en pantalla, margen en vivo con la misma `getFreeMargin`, cargos pendientes del ciclo en curso vía `insertar_cargos_pendientes` (`0029`)
- [x] 🤖 Meta de ahorro dentro del onboarding (hoy `meta_ahorro_mensual` no tiene UI) — `add-web-onboarding`
- [x] 🤖 Cierre: número de WhatsApp → Mango le manda un mensaje para vincular el canal; si no, "Seguir sin WhatsApp" — `add-web-onboarding` guarda número y fecha del pedido (y hoy un código de invitación, que el bloque 10 quita); el stub `lib/whatsapp/link-request.ts` lo reemplazó el link `wa.me` con código de `add-whatsapp-linking` (bloque 10)

**Comunes**
- [x] 🤖 `onboarding_completo` y redirección al paso pendiente si alguien lo abandona a mitad — `add-web-onboarding`: `usuarios.onboarding_paso`, `/dashboard` ↔ `/onboarding`
- [x] 🤖 Elección de tema (claro / oscuro / sistema, "sistema" por defecto) como control flotante arriba a la derecha con efecto cristal, en todas las pantallas del onboarding. Landing y login son oscuras siempre (`ForceDarkTheme`), así que el onboarding es el primer lugar donde se ve y se elige el tema — `add-web-onboarding` (`theme-pill.tsx`, `use-theme-choice.ts` compartido con el menú de cuenta)
- [x] 🤖 Sección "WhatsApp" en ajustes: estado del canal (sin vincular / pedido, escribile a Mango / vinculado), el botón "Vincular WhatsApp" que abre el chat con el código (mismo control que el cierre del onboarding), el campo del número con bandera y prefijo para quien lo saltó, y una línea de que con el número de prueba el bot llega de a pocos y por qué — `add-whatsapp-linking` (2026-10-03): sección en `account-sheet.tsx` entre el día de inicio y "Eliminar cuenta", `whatsapp-link.tsx` y `phone-field.tsx` compartidos con el cierre
- [ ] 👤 Revisar en Stitch la nueva pantalla 1 y la de datos básicos

## 10 · WhatsApp: vinculación y número propio

- [x] 🤖 Quitar la invitación del código: `lib/whatsapp/invite.ts` y `WHATSAPP_REQUIRE_INVITE` (adaptador, `app/onboarding/page.tsx`, Vercel), `inviteRequired` / `inviteCode` en `OnboardingData`, `ProfileMutations.requestWhatsApp` y el paso de cierre (`whatsapp-step.tsx`, textos `whatsapp.codigo` / `explicacion`), migración que borre `usuarios.codigo_invitacion` y la tabla `invitaciones`; specs `messaging-channels` (interruptor), `web-access` (footer) y `onboarding` (cierre) al día — `remove-whatsapp-invitations` (código y `0030` escritos el 3/10; la `0030` se aplica después del deploy, orden D3)
- [x] 🤖 Número desconocido: una sola respuesta que manda a registrarse en la web y vincular desde ajustes, con link (`processUnknownNumber`) — `add-whatsapp-linking` (2026-10-03): bilingüe, una vez por número gracias a `contactos_desconocidos` (`0031`), que el cron purga a los 90 días
- [x] 👤 Decidir cómo se vincula → por código en el primer mensaje (3/10): la web abre `wa.me/<Mango>?text=vincular ABC123`, el adaptador crea el canal con el `wa_id` de Meta y responde ahí; sin plantilla y sin depender del número tipeado (ARCHITECTURE.md §4)
- [x] 🤖 Vinculación de punta a punta: migración con `usuarios.codigo_vinculacion` (único, vence a los 7 días), generarlo al tocar "Vincular WhatsApp" (reemplaza el stub `link-request.ts`), botón con el link `wa.me` en el cierre y en ajustes, y en el adaptador: número desconocido + `vincular <código>` → fila en `canales` con el `wa_id` de Meta, `usuarios.telefono` pisado con ese número, código consumido, respuesta "✅ Listo, este chat ya está vinculado". El número de Mango sale de una variable de entorno (`WHATSAPP_PHONE_NUMBER`, distinta del `PHONE_NUMBER_ID`) — `add-whatsapp-linking` (2026-10-03): `0031` (`vincular_canal`, `canal_vinculado`), `lib/whatsapp/link.ts`, `handle-message.ts` con test unitario del orden del adaptador
- [x] 🤖 Campo del número con bandera y prefijo: `select` nativo con emoji de bandera (derivado del ISO de `lib/data/countries.ts`) y prefijo a la izquierda, número local a la derecha, país de la cuenta preseleccionado; `libphonenumber-js` a E.164 en lugar de `normalizePhone` (resuelve el 9 y el 15 argentinos y el cero troncal). Solo sirve para cargar el número en el panel de Meta mientras dure el número de prueba — `add-whatsapp-linking`: `phone-field.tsx`, `toE164` / `formatPhone` en `lib/data/phone.ts`
- [ ] 🤖 Rate limiting (mensajes al bot y registro web)
- [ ] 👤 Verificar RLS con dos usuarios reales
- [ ] 👤 Cargar los números en Meta (máx. 5 con el número de prueba; mientras se use ese número, es el único filtro de quién tiene bot)
- [ ] 👤 Medir consumo del cupo de 1000 mensajes en WhatsApp Manager (número de prueba)
- [ ] 🤖 Aviso de suscripción por vencer (template de Meta, §14.1)
- [x] 👤 Pedir en Meta la plantilla del mensaje de vinculación → no hace falta: la vinculación la inicia la persona (3/10)
- [ ] 👤 Decidir cuándo se compra el número propio y cuánto gasto se acepta (rompe el "coste cero")
- [ ] 👤 Número propio para la Cloud API (virtual o fijo, que no esté en WhatsApp) — adelantado desde el bloque 14. Plan: número virtual de EE. UU. en Twilio (~1,15 USD/mes, Voice + SMS), verificado en Meta por llamada de voz; si Meta lo rechaza por VoIP, SIM prepago
- [ ] 👤 Con el número propio: nombre visible (lo revisa Meta) y foto de perfil; en el número de prueba el nombre no se puede cambiar
- [ ] 👤 Suscribir la app a la WABA con `subscribed_apps` si el número propio queda en otra WABA (ARCHITECTURE.md §2)
- [ ] 👤 Cambiar credenciales en Vercel y redeploy
- [ ] 🤖 Con el número propio: vincular una cuenta nueva desde ajustes sin cargar nada en el panel de Meta; sacar el campo del número y dejar solo el botón

## 11 · Telegram como segundo canal

> Se activa cuando se llenen los 5 destinatarios de Meta, o cuando alguien prefiera Telegram. Depende del bloque 4. Las variables `TELEGRAM_BOT_TOKEN` y `TELEGRAM_WEBHOOK_SECRET` ya están en Vercel.

- [ ] 🤖 Adaptador en `/api/telegram`: validar el secret token del header, traducir al formato interno (`{ usuarioId, texto, mensajeId }`) y llamar a la misma lógica
- [ ] 🤖 Confirmación siempre en texto con botón Deshacer: sin cupo que cuidar, la regla de las 15 cargas no aplica
- [ ] 🤖 Vincular Telegram desde ajustes, igual que WhatsApp
- [ ] 👤 Registrar el webhook (`setWebhook`, un curl) y probar un alta de punta a punta

---

## 12 · Deuda técnica

- [ ] Monedas mezcladas: `resumenMensual` suma sin mirar `moneda`
- [ ] Ahorro: editar/borrar movimientos, montar barra y sparkline
- [x] Recurrencias de ingreso sin edición — `add-forward-scoped-edits`: los ingresos fijos se editan desde el panel, con alcance
- [ ] `ingresos_esperados` sin usar / "piso del mes"
- [ ] `presupuestos.periodo` si cambia `dia_inicio_ciclo`
- [ ] Renombrar namespace `hojaGasto`
- [ ] Tests unitarios de ritmo/presupuesto y Playwright sobre los sheets restantes
- [ ] Notas de voz (`add-voice-messages`): varios movimientos en una nota (hoy solo el primero); archivos de audio adjuntos (`voice: false`) reciben la respuesta fija; la cita "Escuché" va también en las consultas; Gemini inventa una transcripción sobre silencio o ruido (umbral de energía si el ruido real también falla)

## 13 · Fase 3 — refinamiento

- [ ] Alertas al acercarse al techo de una categoría
- [ ] Presupuestos sugeridos a partir del historial
- [ ] Modo asesor con más contexto
- [ ] Recordatorio diario opcional (apagado por defecto)
- [ ] Reordenar gastos dentro de su categoría
- [ ] Bot y parser en inglés
- [ ] Movimiento lento del fondo de metal cepillado
- [ ] 👤 Crear credenciales OAuth en Google Cloud y activar el proveedor Google en Supabase — pasado desde el bloque 8: el código por mail alcanza para el registro abierto
- [ ] 🤖 Login con Google, con el código por mail como alternativa

## 14 · Fase 4 — pagos (a futuro)

> Solo si la señal de Fase 2 aparece: gente cargando gastos a los tres meses. El número propio se adelantó al bloque 10.

- [ ] 👤 Decidir el modelo: qué es gratis (¿web?) y qué se paga (¿bot?)
- [ ] 👤 Decidir qué pasa si alguien deja de pagar: se corta el bot, el acceso, o nada de los datos
- [ ] 🤖 Tabla de suscripciones colgando de `usuarios` (plan, estado, renovación), independiente de los canales
- [ ] 🤖 Integración con el proveedor de pagos y sus webhooks

---

## Fuera del proyecto

- [ ] 👤 Revisar el `~/.git` en la carpeta de usuario (remote a `caloria-backend`) antes de borrar nada
