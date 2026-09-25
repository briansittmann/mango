# ROADMAP.md — Mango

> Lista de tareas a gran escala, al 24/9/2026. Cada bloque se baja a detalle cuando toque trabajarlo.
> **👤 = Brian** (cuentas, paneles, decisiones) · **🤖 = Claude Code** (código, migraciones)

Estado de partida: web y `/dashboard` sobre Supabase hechos, demo publicada en `https://www.usemango.dev/demo`, webhook de WhatsApp escrito pero con la lógica del bot en stub.

**Cambio de modelo (24/9):** Mango deja de tener una sola puerta de entrada. El dashboard ya permite cargar todo a mano, así que **cualquiera puede registrarse por la web** y usarlo sin bot. WhatsApp pasa a ser un canal opcional, por invitación, limitado por el cupo de Meta. Hay **dos onboardings** que terminan en la misma cuenta y el mismo dashboard.

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

- [ ] 👤 Registrar webhook en Meta: `https://www.usemango.dev/api/whatsapp` (con `www`), verify token, suscribir `messages`
- [ ] 👤 Mandar un mensaje de prueba y ver en los logs de Vercel que llega y que la firma HMAC valida
- [ ] 👤 Quitar el `setWebhook` del bot de Telegram si no se va a usar

## 3 · Insumos del parser (decisiones tuyas — bloquean el bloque 5)

- [ ] 👤 Categorías reales (8–12)
- [ ] 👤 Gastos fijos reales: nombre, monto, día, categoría. Decidir si se registra medio de pago
- [ ] 👤 15–20 mensajes de ejemplo tal como los escribirías (set de pruebas del parser)
- [ ] 🤖 Reemplazar los datos de prueba de la base por los reales

## 4 · Identidad separada del canal (antes del bot)

> Va antes del bloque 5 a propósito: si el bot escribe pegado al teléfono, migrarlo después cuesta más que dejar el hueco ahora.

- [ ] 🤖 Tabla `canales` (`usuario_id`, `tipo` = `whatsapp` | `telegram`, `identificador_externo`, único por tipo + identificador). El usuario pasa a ser una identidad sin teléfono; el teléfono es un canal más
- [ ] 🤖 `usuarios.telefono` deja de ser obligatorio: una cuenta creada por la web no tiene
- [ ] 🤖 Migrar el usuario de prueba a una fila de `canales`; `findUserIdByPhone` pasa a buscar en `canales`
- [ ] 🤖 Idempotencia por canal: `wa_message_id` se generaliza a `mensaje_id_externo` + tipo de canal
- [ ] 🤖 Nada asume el número de prueba: sin tope de 5 ni cupo de 1000 en el código; el número emisor sale de `WHATSAPP_PHONE_NUMBER_ID`
- [ ] 🤖 Interruptor de invitación obligatoria: hoy encendido; con número propio se apaga sin tocar código (ARCHITECTURE.md §4)
- [ ] 👤 Decidir si una cuenta puede tener WhatsApp y Telegram a la vez, o uno solo
- [ ] 👤 Decidir dónde vive el interruptor: variable de entorno o valor en la base

## 5 · Bot funcional

- [ ] 🤖 Sumar Zod y el SDK de Gemini a `package.json`
- [ ] 🤖 Parser: prompt con categorías del usuario, schema Zod, reintento ante JSON inválido
- [ ] 🤖 Carga de transacciones reusando `lib/data/supabase/*` con cliente admin; idempotencia; lo que no matchea va a `otros`
- [ ] 🤖 Tipos `gasto` / `ingreso` / `ahorro` (incluido retiro en negativo)
- [ ] 🤖 Dato faltante ("gasté 50") → repregunta en texto
- [ ] 🤖 Confirmación progresiva: `cargas_confirmadas`, `modo_confirmacion`, texto + Deshacer las primeras 15, reacción después
- [ ] 🤖 Correcciones por texto sobre la última carga: "borrá eso", "no, era 40"
- [ ] 🤖 Consultas cortas: "¿cómo vengo?", total del mes + top 5, link a la web
- [ ] 👤 Ronda de prueba con los mensajes del bloque 3 y lista de fallos

## 6 · Cron de gastos fijos

- [ ] 🤖 Migración `transacciones.estado` (`pendiente` | `confirmada`) y reemplazo de las reglas provisorias (`isCharged`, `actualizar_movimiento_recurrente`)
- [ ] 🤖 Reconciliación: carga manual completa la fila pendiente del mismo fijo en vez de duplicar
- [ ] 🤖 Cron diario (`vercel.json`): inserta pendientes al inicio del ciclo, cuenta `repeticiones_insertadas`, desactiva al llegar al total, cierra pendientes al fin de ciclo
- [ ] 🤖 Constraint único por `gasto_fijo_id` + ciclo
- [ ] 👤 Decidir si `dia_del_mes` pasa a `NOT NULL`
- [ ] 👤 Confirmar que el cron dispara en producción

## 7 · Meses futuros: proyección a 6 ciclos

> Un ciclo futuro **se calcula, no se guarda**. Lo valioso sale solo: ver que el margen sube cuando termina una cuota o baja cuando arranca otra.

- [ ] 🤖 Función pura `proyectarCiclo` en la capa de datos compartida: ingresos recurrentes, fijos activos a `monto_actual` respetando `repeticiones_totales` (una cuota que termina deja de aparecer), presupuestos heredados, meta de ahorro
- [ ] 🤖 El cron del bloque 6 usa esa misma función para decidir qué insertar: lo proyectado y lo insertado nunca se contradicen
- [ ] 🤖 Margen libre proyectado con la misma `getFreeMargin`
- [ ] 🤖 Selector de mes: habilitar hasta **6 ciclos adelante** (hoy `?mes=` se recorta al ciclo en curso)
- [ ] 🤖 Vista de ciclo futuro: marca visible de "Proyección", barras en cero, sin ritmo ni "gastado"
- [ ] 🤖 `/demo` con proyección también
- [ ] 🤖 Editar presupuestos de un ciclo futuro:
  - la hoja pregunta **"solo este mes"** o **"desde este mes en adelante"**; "solo este mes" deja escrito el ciclo siguiente con el valor anterior para que el cambio no se arrastre
  - al editar, materializar **todas** las categorías de ese ciclo, no solo la tocada (si no, la copia ve el ciclo "con filas" y las demás quedan sin presupuesto)
  - levantar la regla "nunca crear filas para un ciclo futuro" de la `0018`
- [ ] 👤 Decidir si más adelante se suman gastos puntuales planificados ("viaje en febrero, 600") — necesita `transacciones.estado`

**→ Con los bloques 0–7 cerrados, Fase 1 terminada: uso personal real.**

---

# Fase 2 — abrir a otras personas

## 8 · Acceso web y registro abierto

- [ ] 👤 Activar sign-ups en Supabase Auth
- [ ] 👤 Crear credenciales OAuth en Google Cloud y activar el proveedor Google en Supabase
- [ ] 🤖 Login con Google + magic link como alternativa
- [ ] 🤖 Al primer login, crear la fila en `usuarios` (hoy sale "cuenta sin vincular") y mandar al onboarding web
- [ ] 🤖 `/login`: dejar de fallar en silencio con un mail no registrado; con registro abierto, el mismo formulario sirve para entrar y para crear la cuenta
- [ ] 🤖 Home: "Demo" y "Entrar" con una línea que explique qué es Mango y que el bot de WhatsApp es por invitación
- [ ] 👤 SMTP propio (p. ej. Resend) con remitente del dominio
- [ ] 🤖 Template de magic link con la marca, es/en, link `?token_hash=` (arregla el link que solo abre en el mismo navegador)

## 9 · Dos onboardings, una cuenta

> Los dos terminan en el mismo dashboard. La diferencia es de dónde viene la persona y qué datos ya se tienen.

**Onboarding web** (registro abierto, sin bot)
- [ ] 🤖 Pantalla 1 nueva: bienvenida sin gasto cargado (reemplaza "Ya cargaste tu primer gasto")
- [ ] 🤖 Pantalla de datos básicos: nombre, país → moneda y timezone, día de inicio de ciclo
- [ ] 🤖 Pantallas 2–4 de Stitch: categorías, ingresos y fijos, presupuestos (con margen libre en vivo)
- [ ] 🤖 Meta de ahorro dentro del onboarding (hoy `meta_ahorro_mensual` no tiene UI)
- [ ] 🤖 Cierre: número de WhatsApp (+ código mientras la invitación sea obligatoria) → Mango le manda un mensaje para vincular el canal; si no, "Seguir sin WhatsApp"

**Onboarding WhatsApp** (por invitación)
- [ ] 🤖 Por chat: código → nombre → país → día de ciclo → gasto de prueba → link a la web
- [ ] 🤖 Link con código de un solo uso que abre sesión y vincula el teléfono a la cuenta
- [ ] 🤖 En la web: las cuatro pantallas de Stitch tal como están (pantalla 1 con el gasto ya cargado), saltando lo que el chat ya preguntó

**Comunes**
- [ ] 🤖 `onboarding_completo` y redirección al paso pendiente si alguien lo abandona a mitad
- [ ] 🤖 Sección "WhatsApp" en ajustes: estado del canal, explicación de que hoy es por invitación y por qué, y vinculación con código si la persona tiene uno
- [ ] 👤 Revisar en Stitch la nueva pantalla 1 y la de datos básicos

## 10 · WhatsApp: invitaciones y número propio

- [ ] 🤖 Tabla `invitaciones` + "Invitar a alguien" en el menú global; tres errores distintos (no existe / usado / vencido)
- [ ] 🤖 Una invitación sirve tanto para crear la cuenta por chat como para vincular WhatsApp a una cuenta web existente
- [ ] 🤖 Rate limiting (mensajes e intentos de código)
- [ ] 👤 Verificar RLS con dos usuarios reales
- [ ] 👤 Cargar los números en Meta (máx. 5 con el número de prueba; mientras se use ese número)
- [ ] 👤 Medir consumo del cupo de 1000 mensajes en WhatsApp Manager (número de prueba)
- [ ] 🤖 Aviso de suscripción por vencer (template de Meta, §14.1)
- [ ] 👤 Pedir en Meta la plantilla del mensaje de vinculación que se manda desde el onboarding web (lo inicia Mango: fuera de la ventana de 24 h)
- [ ] 👤 Decidir cuándo se compra el número propio y cuánto gasto se acepta (rompe el "coste cero")
- [ ] 👤 Número propio para la Cloud API (virtual o fijo, que no esté en WhatsApp) — adelantado desde el bloque 14
- [ ] 👤 Cambiar credenciales en Vercel y redeploy
- [ ] 🤖 Apagar la invitación obligatoria y probar una vinculación sin código

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
- [ ] Recurrencias de ingreso sin edición
- [ ] `ingresos_esperados` sin usar / "piso del mes"
- [ ] `presupuestos.periodo` si cambia `dia_inicio_ciclo`
- [ ] Renombrar namespace `hojaGasto`
- [ ] Tests unitarios de ritmo/presupuesto y Playwright sobre los sheets restantes

## 13 · Fase 3 — refinamiento

- [ ] Alertas al acercarse al techo de una categoría
- [ ] Presupuestos sugeridos a partir del historial
- [ ] Modo asesor con más contexto
- [ ] Recordatorio diario opcional (apagado por defecto)
- [ ] Reordenar gastos dentro de su categoría
- [ ] Bot y parser en inglés
- [ ] Movimiento lento del fondo de metal cepillado

## 14 · Fase 4 — pagos (a futuro)

> Solo si la señal de Fase 2 aparece: gente cargando gastos a los tres meses. El número propio se adelantó al bloque 10.

- [ ] 👤 Decidir el modelo: qué es gratis (¿web?) y qué se paga (¿bot?)
- [ ] 👤 Decidir qué pasa si alguien deja de pagar: se corta el bot, el acceso, o nada de los datos
- [ ] 🤖 Tabla de suscripciones colgando de `usuarios` (plan, estado, renovación), independiente de los canales
- [ ] 🤖 Integración con el proveedor de pagos y sus webhooks

---

## Fuera del proyecto

- [ ] 👤 Revisar el `~/.git` en la carpeta de usuario (remote a `caloria-backend`) antes de borrar nada
