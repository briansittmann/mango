
/
App De Finanzas
App De Finanzas
Estoy armando la app de finanzas con bot de Telegram. Ya tenemos la arquitectura definida; empecemos por el esquema de la base de datos en Supabase.




Escribe / para ver habilidades
¿Cómo puedo ayudarte hoy?




Recientes
Funcionalidades disponibles y no disponibles
hace 39 minutos
Gestión de la moneda
ayer
Meta API implementation assistance
anteayer
Integrar Mercado Pago con aplicación de gastos
hace 3 días
Escalabilidad y viabilidad comercial
hace 4 días
Gestión de ahorros y menús expandibles
hace 5 días
Recuperar arquitectura de proyecto de finanzas anterior
hace 5 días
Costo de suscripción en Telegram
9 sept
Instrucciones
Agrega instrucciones para personalizar las respuestas de Claude

Memoria
Solo tú
Ve y administra lo que Claude recuerda de tus chats.

Contexto
2% de la capacidad del proyecto utilizada

ARCHITECTURE.md
62.5kB

md




mango-stitch-onboarding.md
6.1kB

md




mango-secciones-nuevas.md
5.4kB

md




TAREAS-BRIAN.md
14.4kB

md



Carpeta
Solo tú
Agrega una carpeta en esta computadora para que Claude trabaje en ella.

Programado
Configura tareas recurrentes para este proyecto.

ARCHITECTURE.md


# ARCHITECTURE.md — Mango
 
**Mango** — app de finanzas personales con dos interfaces: una **web** donde uno se registra, carga, ve gráficos y edita en profundidad, y un bot de **WhatsApp** opcional, que se vincula desde la web, para cargar y consultar rápido.
 
---
 
## 1. Objetivo
 
Registrar gastos e ingresos con la menor fricción posible (un mensaje de texto) y poder ver dónde se va la plata sin abrir una planilla.
 
Dos modos de uso:
 
- **Web** → puerta de entrada y uso completo: registro, dashboard, gráficos, carga y edición a mano, gestión de fijos y categorías. Mango se puede usar entero sin el bot.
- **WhatsApp** → carga rápida y consultas cortas. Canal opcional: se vincula desde la web (sección 4).
> **Decisión (3/10/2026):** se saca la invitación. La cuenta nace solo por la web, y WhatsApp es un canal que la persona vincula desde su cuenta. No hay alta por chat, ni códigos de invitación, ni interruptor. Motivo: con el registro web abierto y el onboarding web hecho, la invitación solo servía para dejar entrar a gente por el chat, y ese camino cuesta mantener un segundo onboarding, una tabla y un interruptor para una puerta que nadie necesita. Lo que queda del número de prueba de Meta (5 destinatarios) se maneja a mano en el panel de Meta hasta el número propio.
> **Decisión (sept 2026):** la web deja de ser solo "ver y editar". Antes el bot era la única puerta de entrada (WhatsApp → carga rápida, consultas cortas, **alta de usuario**; web → dashboard, gráficos, edición, gestión de fijos y categorías) y la cuenta nacía con el teléfono. Ahora el dashboard ya permite cargar todo a mano, así que cualquiera puede registrarse por la web y usar Mango sin bot; WhatsApp queda como canal opcional, limitado por el cupo del número de prueba de Meta. Motivo: el techo de 5 destinatarios es de Meta, no de Mango; sin registro web, la app no puede crecer hasta que haya número propio. (Esta decisión todavía dejaba un onboarding por chat con invitación; el 3/10 se sacó, ver arriba.)

- **Mensajería** → WhatsApp Business API (Cloud API de Meta). Se arranca con el **número de prueba** de Meta: gratis, hasta 5 destinatarios y 1000 mensajes/mes, sin verificación de negocio. Alcanza para los 3 usuarios previstos.
> **Decisión (sept 2026):** el sistema se diseña **como si ya hubiera número propio**. El número de prueba (5 destinatarios, 1000 mensajes/mes) es una restricción temporal de hoy, no una premisa de diseño: nada en el código asume el tope de 5 ni el cupo de 1000, y el número emisor sale de `WHATSAPP_PHONE_NUMBER_ID` (sección 2). Lo único que hoy depende del número de prueba es la lista de 5 destinatarios, que se carga a mano en el panel de Meta y no vive en el código. Por qué: si el diseño se ata al número de prueba, el día que llegue el número propio hay que desarmarlo; así, pasar es cambiar credenciales.

> **Decisión (sept 2026):** se cambió de Telegram a WhatsApp. Motivo: Brian y sus dos amigos usan WhatsApp y ninguno usa Telegram. Telegram era técnicamente más cómodo (API más simple, botones sin límite, sin ventana de 24 h), pero la fricción de instalar otra app mataba la adopción.
 
Restricción transversal: **coste cero**. Todo se elige dentro de capas gratuitas.

> **Excepción (2026-09-28): Gemini se paga.** La capa gratuita de `gemini-3.8-flash` da 20 requests por día por proyecto (medido el 28/9), que no alcanza para tres usuarios ni para correr el eval del parser, y en esa capa Google usa el contenido para mejorar sus productos: son movimientos financieros. Con billing (Tier 1) y un presupuesto con alerta de 5 USD, el costo estimado es de 0,20 USD por mes con ~200 mensajes (0,40 USD desde 2027, cuando Google duplica el precio), más los tokens de razonamiento si el modelo los usa. El modelo va fijado por nombre en `GEMINI_MODEL` (`lib/bot/gemini.ts`), no por alias, para que un cambio de Google no altere el eval en silencio.
 
---
 
## 2. Stack
 
| Capa | Elección | Por qué |
|---|---|---|
| Base de datos | Postgres en Supabase | Capa gratuita, Postgres real, auth incluida |
| Backend | Next.js route handlers (TypeScript) | Mismo repo que el front, serverless en Vercel |
| Deploy | Vercel | Gratis, cold starts de ~100–300 ms |
| Mensajería | WhatsApp Business Cloud API | Es la app que ya usan los usuarios |
| Parsing de mensajes | Gemini (API online), `gemini-3.8-flash` | Pago por uso, centavos por mes (ver la excepción de §1) |
| Validación | Zod | Garantiza la forma del JSON que devuelve el modelo |
| Front | React / Next.js + Tailwind | Preferencia propia |
| Gráficos | Recharts | Se integra directo con React |
| Componentes UI | shadcn/ui | Look profesional de entrada, theming incluido |
| Auth | Supabase Auth: código por mail (Google, en el bloque 13) | Sin contraseñas que mantener. El código abre la sesión en la misma pestaña donde se pidió, y el mismo formulario sirve para entrar y para crearse la cuenta |
| Idiomas | next-intl (o equivalente) | Estructura desde el día uno, ver más abajo |
 
**Un repo, un deploy, coste cero.**

> **Decisión (sept 2026):** Auth pasa de solo magic link a **login con Google, con magic link como alternativa**. Con registro abierto (sección 4), el login es la primera pantalla que ve cualquiera, y el magic link solo tiene dos problemas: el mail sale sin marca (sin SMTP propio, Supabase no deja editar la plantilla) y el link `?code=` solo abre sesión en el mismo navegador donde se pidió. Google trae el mail ya verificado y no depende de ninguno de los dos. El magic link se queda para quien no usa Google.

> **Decisión (2026-09-28):** el **código por mail reemplaza al magic link** como alternativa a Google (`replace-magic-link-with-email-otp`). `/login` pide el mail, Supabase manda un código de 6 dígitos y la persona lo escribe en la misma página: la sesión queda en el navegador donde lo escribió. Por qué: el link abría otra pestaña, y con `?code=` solo abría sesión en el navegador que lo pidió, así que abrirlo desde la app de Mail del teléfono terminaba en "enlace inválido". El código no depende de dónde se abre el mail y no necesita el arreglo de `?token_hash=`. `/auth/confirm` se queda para el callback de Google y el link de un solo uso del bot.

> **Actualización (2026-09-28):** Auth ya manda sus mails por SMTP propio, **Resend**, y salen con remitente del dominio (`no-reply@usemango.dev`). Con eso la plantilla se puede editar. El tope pasa a 30 mails por hora y 60 s entre dos mails a la misma dirección.

> **Decisión (2026-09-28):** el **registro abre solo con el código por mail** (`open-web-signup`); Google pasa al bloque 13. `/login` crea la cuenta cuando la dirección no tiene una (`shouldCreateUser: true`), y el pedido lleva el idioma de la página y la zona horaria del navegador, que quedan en la metadata del auth user. El mail del código tiene la marca de Mango y sale en el idioma de esa metadata (español si no hay), con una sola plantilla (`supabase/templates/codigo.html`) pegada en *Confirm signup* y *Magic Link*. Por qué sin Google: el código ya funciona de punta a punta, y abrir el registro no tiene que esperar a configurar otro proveedor.
 
### Variables de entorno
 
Los **nombres** viven acá; los **valores** nunca — van a `.env.local` (ignorado por git) y al panel de Vercel. El código las lee siempre por `process.env`, nunca hardcodeadas.
 
| Variable | Para qué | Alcance |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase | Cliente y servidor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública; toda consulta pasa por RLS | Cliente y servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | **Saltea RLS.** Solo para el cron de fijos y escrituras del webhook | **Solo servidor** |
| `CRON_SECRET` | Secreto aleatorio (32+ caracteres) que Vercel manda como `Authorization: Bearer` al cron de fijos (sección 3); sin él la ruta responde 500 | **Solo servidor** (Production) |
| `GEMINI_API_KEY` | Parser de mensajes | **Solo servidor** |
| `WHATSAPP_TOKEN` | Token permanente (System User `mango-bot`, sin expiración) para llamar a la Cloud API | **Solo servidor** |
| `WHATSAPP_PHONE_NUMBER_ID` | Identificador del número emisor; va en la URL de envío | **Solo servidor** |
| `WHATSAPP_VERIFY_TOKEN` | String arbitrario; se compara contra `hub.verify_token` en el GET de alta del webhook | **Solo servidor** |
| `WHATSAPP_APP_SECRET` | App Secret de Meta; valida el HMAC SHA-256 de `X-Hub-Signature-256` en cada POST | **Solo servidor** |
 
**El prefijo `NEXT_PUBLIC_` no es cosmético:** sin él la variable no llega al navegador, y con él **se embebe en el bundle público**. Por eso la `anon key` lo lleva (es pública por diseño, la protege RLS) y la `service_role` no puede llevarlo bajo ninguna circunstancia: expuesta al cliente, cualquiera lee y escribe los gastos de todos.
 
Las cuatro de WhatsApp se cargan en **Production, Preview y Development**. Después de tocar cualquiera hace falta **redeploy**: el deploy que ya corre conserva los valores con los que se construyó.
 
**El webhook necesita dos suscripciones, no una.** Verificar la URL y suscribir el campo `messages` en el panel no alcanza: la app también tiene que estar suscrita a la cuenta de WhatsApp Business (`POST /{WABA_ID}/subscribed_apps` con un token de la app), y el panel no siempre lo hace. Sin esa suscripción, el botón *Test* del panel llega, pero los mensajes reales y los estados no. Pasó en el bloque 2 (sept 2026) y va a hacer falta de nuevo con el número propio, si cambia la WABA.

`TELEGRAM_BOT_TOKEN` y `TELEGRAM_WEBHOOK_SECRET` **quedan cargadas y sin uso**. No las lee ningún código; se dejan por si se retoma Telegram como segundo adaptador (ver §3).
 
### Multi-idioma: la estructura ahora, la traducción después
 
La app arranca en español y va a tener **inglés**. La decisión es separar las dos cosas, porque cuestan muy distinto:
 
- **Preparar (fase 1, desde el primer commit):** ningún texto visible vive dentro de un componente. Todas las etiquetas van en archivos de traducción (`es.json`), y los componentes leen de ahí. Cuesta casi nada mientras se escribe; hacerlo después significa abrir cincuenta archivos a mano, que es tedioso y es donde se cuelan los errores.
- **Traducir (fase 3):** agregar `en.json` es una tarde de trabajo y no se complica por esperar.
Tres piezas, no una:
 
1. **Interfaz web** — archivos de traducción, resuelto por la librería.
2. **Mensajes del bot** — mismo mecanismo, pero ahí cambia el **tono**, no solo las palabras. No se traduce literal.
3. **Parser de Gemini** — el único con complejidad real: el prompt lleva ejemplos en español (*"gasté 30 en el súper"*) y necesita los equivalentes en inglés. Se agrega al prompt junto con el idioma del usuario.
> Campo `idioma` en `usuarios`, derivado del país en el onboarding y editable.

### Gestión de la moneda

Cada cuenta tiene **una sola moneda** (`usuarios.moneda_default`, código ISO 4217). La elige el paso 2 del onboarding web a partir del país (`lib/data/countries.ts`, tabla fija: país → moneda, prefijo telefónico y zonas horarias) y queda editable, ahí y después desde la hoja "Cuenta" del dashboard, porque hay gente que vive en un país y gasta en otra moneda.

**Cómo se pinta.** Un solo formateador para la web y el bot, `lib/data/amount-format.ts` (función pura, tests en `npm run test:unit`), sobre `Intl` con el **símbolo corto** (`currencyDisplay: 'narrowSymbol'`: `€`, `$`, `£`, nunca `ARS` ni `US$`) y la disposición del locale: en español los euros van `350 €` y los pesos argentinos como en Argentina, `$ 350.000` (locale `es-AR`, que se usa solo para `ARS`; otra moneda latinoamericana en español sigue con el símbolo detrás, deuda en `CLAUDE.md`); en inglés `€350` y `$350,000`.

**Formato abreviado** (`usuarios.formato_montos`, `0029`): `completo` (`$ 350.000`) o `abreviado` (`$ 350k`, `$ 1,5M`), porque `350.000` en cada fila no entra en un teléfono. Solo rige con `pais = 'AR'` (`effectiveAmountFormat`): para cualquier otro país se lee completo aunque la columna diga otra cosa, así el control "no existe y no cambia nada" fuera de Argentina. Lo honran todos los montos que pinta la web (`Money`, `AnimatedAmount` y su contador, los sheets, las barras, los paneles, vía `AmountFormatProvider`) y las respuestas del bot (`formatBotAmount`); los campos de entrada siempre muestran y toman el número completo. Reglas: desde 1 000 se divide por mil con un decimal redondeado (`1.500 → 1,5k`, `12.345 → 12,3k`, `350.000 → 350k`), desde 999 950 por un millón (`1,5M`, `2.500M`), nunca centavos, y el signo y el símbolo quedan donde los pone la forma completa (`-$ 1,5M`). Las sumas **no convierten** entre monedas (deuda "Monedas mezcladas" en `CLAUDE.md`).
 
Nota sobre Java: se evaluó hacer el backend en Spring Boot (por el objetivo laboral de backend Java) y se descartó para este proyecto. Spring Boot no corre en Vercel y en capa gratuita (Render / Railway) el servidor se duerme, con cold starts de ~30 s: inviable para un bot. Java queda para un proyecto siguiente, más chico y enfocado.
 
---
 
## 3. Arquitectura
 
```
WhatsApp ──webhook──> /api/whatsapp ──> adaptador ──┐
Telegram ──webhook──> /api/telegram ──> adaptador ──┴──> lógica del bot
            (previsto)                                    │
                                            parser (Gemini + Zod)
                                                          │
Navegador ──────────> /api/... ─────────────────────> Supabase
                                    │
                          capa de datos compartida
                                    │
                    ┌───────────────┴───────────────┐
              bot (texto)                      web (gráficos)
```
 
**La lógica del bot va desacoplada de la capa de mensajería.** El route handler de WhatsApp es un adaptador fino: traduce el payload de Meta a un formato interno (`{ usuarioId, texto, mensajeId }`) y llama a la lógica, que no sabe nada de WhatsApp. Si mañana se agrega Telegram o Signal, se escribe otro adaptador y nada más.

**El adaptador identifica al usuario por canal, no por teléfono.** Busca el remitente en `canales` (`tipo` + `identificador_externo`, sección 8) y le pasa a la lógica el mismo `{ usuarioId, texto, mensajeId }` de siempre. Por qué: con registro web abierto, una cuenta puede no tener teléfono; el teléfono pasa a ser un canal más, y la lógica nunca supo de teléfonos, así que no cambia.

**El orden del adaptador** (`lib/whatsapp/handle-message.ts`, con los efectos inyectados desde `adapter.ts`; `add-whatsapp-linking`): (1) resuelve el remitente por `canales`; (2) si el texto es `vincular <código>`, lo resuelve ahí mismo y nunca llega al parser: desconocido → `vincular_canal` y la respuesta según el resultado (vinculado en el idioma de la cuenta; las negativas en español e inglés), conocido → "este chat ya está vinculado"; (3) cualquier otro mensaje de un desconocido se anota en `contactos_desconocidos` y se responde una sola vez (una pulsación de botón se descarta); (4) el flujo conocido: idempotencia, estado del canal, lógica, confirmación.

**Telegram queda previsto como segundo adaptador** (`/api/telegram`). Se activa cuando se llenen los 5 destinatarios del número de prueba de Meta (mientras se use ese número), o cuando alguien lo prefiera. Es exactamente el caso para el que existe el desacople: otro adaptador, la misma lógica.
 
Punto clave: **una sola capa de datos, dos presentaciones**. Una función tipo `resumenMensual(userId, mes)` consulta la base y la consumen los dos frentes: el bot la renderiza como texto, la web como gráficos. No se duplica lógica.

El **margen libre** que devuelve no se guarda en ningún lado: se deriva en cada lectura con una función pura de la capa de datos compartida (`getFreeMargin` en `lib/data/budget.ts`), la misma para la web, el bot y el demo:

```
margen libre = ingresos − ahorro − Σ max(presupuesto, gastado) por categoría con presupuesto − gastado en categorías sin presupuesto
```

No hay un término aparte para los fijos: "gastado" en una categoría es su total del ciclo, fijos incluidos, y cada gasto cuenta una sola vez. Un fijo que vence en el ciclo cuenta desde el día 1 a su monto esperado, aunque todavía no se haya cobrado, para que el margen no sea optimista los primeros días; cuando se cobra, el monto real reemplaza al esperado (sección 9, *Presupuestado vs real*).

**El cron de fijos y la proyección de meses futuros usan la misma función pura**, `proyectarCiclo`, en la capa de datos compartida. La proyección calcula qué va a pasar en un ciclo (sección 9, *Meses futuros: proyección*) y el cron lo escribe cuando llega el día (sección 7). Por qué una sola función: si fueran dos cálculos, tarde o temprano el mes proyectado y el que el cron inserta dirían cosas distintas. Así nunca se contradicen.

**Cómo corre el cron** *(implementado, `add-cycle-projection-and-recurring-cron`, sept 2026)*: `vercel.json` llama a `GET /api/cron/recurrentes` todos los días a las **05:00 UTC** (en Hobby, en algún minuto de esa hora). La ruta es TypeScript en Next, no pg_cron: exige `Authorization: Bearer ${CRON_SECRET}` y usa el cliente de service role. Sin alguna de las dos variables devuelve 500 y no escribe nada. Para cada usuario, en su propio `try`:
1. Calcula los ciclos pendientes, desde el siguiente a `usuarios.ciclo_generado_hasta` hasta el ciclo en curso (como mucho 24 por corrida).
2. Para cada uno llama a `proyectarCiclo` y le pasa los cargos a `generar_ciclo`, una función SQL atómica.
3. Al final llama a `cerrar_pendientes`.

La respuesta y el log solo dicen ciclos generados, filas insertadas y filas cerradas, sin montos ni nombres. Correrlo dos veces, tarde o después de días sin correr da el mismo resultado: la marca y el unique `(movimiento_recurrente_id, ciclo_mes)` hacen que la segunda corrida no inserte ni cuente nada (sección 7).
 
### Flujo de carga
 
1. El usuario manda `30 euros disco`.
2. El webhook valida la **firma del payload** (header `X-Hub-Signature-256`, HMAC con el App Secret de Meta) y el **número de teléfono** contra los canales dados de alta (`canales`, secciones 4 y 8).
3. Gemini parsea → `{ monto: 30, moneda: "EUR", descripcion: "disco", categoria: "ocio", tipo: "gasto" }`.
4. Zod valida la forma.
5. Si la categoría no matchea ninguna existente, **se guarda en `otros`** — sin repreguntar.
6. Se guarda con el **`mensaje_id_externo`** y el tipo de canal (antes `wa_message_id`, sección 8) para evitar duplicados.

*(Implementado, `add-bot-parser-and-logging`, sept 2026.)* El parser se evalúa contra Gemini real con `npm run test:parser` (los mensajes del bloque 3 más casos propios). Tres piezas que el flujo de arriba no cuenta:
- **Pregunta pendiente en el canal.** Si al mensaje le falta la descripción (*"gasté 50"*), el bot pregunta la categoría y el adaptador guarda la pregunta (`pregunta: 'categoria'`, `tipo`, `monto`, `diasAtras`) en `canales.pregunta_pendiente` con vencimiento a los **30 minutos** (`pregunta_vence_en`, migración `0023`). El mensaje siguiente del mismo canal se parsea con esa pregunta en el prompt (*"comida"* → 50 en Comida). Cualquier otra respuesta la borra. Desde `add-bot-conversation` (1/10/2026) hay un segundo tipo, la confirmación de crear una categoría con nombre parecido (`pregunta: 'crear_categoria'`, `nombre`, `presupuesto`, `parecida`); una pregunta nueva de cualquier tipo reemplaza a la anterior. Vive en `canales` porque una función de Vercel no guarda nada entre dos llamadas del webhook. No es el historial VIP de abajo.
- **Rama de recurrentes.** Si el parser reconoce el nombre de un gasto fijo activo (*"netflix 13"*), la lógica no inserta una fila nueva: completa el cargo pendiente de ese ciclo con `completar_cargo_recurrente`, que lo confirma con el monto real y le escribe `canal` y `mensaje_id_externo`. Si el monto difiere del esperado, el cargo de ese ciclo queda con el monto real y la definición no cambia: la confirmación agrega *"Solo cambia este mes: Luz sigue en 60 €"* y va siempre en texto. **Decisión (30/9/2026):** el bot no pregunta si el cambio es permanente; cambiar el monto fijo de ahí en adelante se hace desde la web con "Desde este mes en adelante". Si el plan terminó o la definición ya no existe, se carga como gasto común en su categoría.
- **Cargo ya confirmado.** Si ese cargo ya estaba confirmado (`already-confirmed`), no se escribe nada y el bot contesta que ya estaba cargado. Un segundo pago real del mismo fijo es raro y se carga desde la web; un duplicado silencioso de un fijo cuesta más.
#### Sin repregunta de categoría
 
**Todo lo que no mapea contra una categoría existente va a `otros`.** No se pregunta y no se inventan categorías nuevas.
 
El motivo es el volumen: con 200+ cargas al mes, una repregunta cada tanto es fricción que se acumula y termina desalentando la carga. Y la carga es lo único que la app necesita que pase todos los días.
 
El control es **a posteriori**: si `otros` empieza a pesar en la torta, eso mismo es la señal de que falta una categoría. Se crea desde el dashboard y se reasignan las transacciones. Mejor una revisión mensual de 2 minutos que 200 interrupciones.

**Decisión (sept 2026): crear categoría por chat, solo a pedido.** El bot crea una categoría únicamente cuando el usuario lo pide explícitamente (*"creá la categoría Mascotas"*, *"nueva categoría Viajes, presupuesto 200"*). El parser nunca crea una a partir de un gasto: la regla de arriba sigue igual. Si ya existe una con el mismo nombre (sin mirar mayúsculas ni tildes), avisa y no crea nada. Si hay una parecida (una contiene a la otra, o difieren en dos letras o menos), pregunta *"Ya tenés Mascotas. ¿Creo Mascota igual?"*, guarda la pregunta en el canal y un *"sí"* dentro de los 30 minutos la crea. Vive desde el ciclo en curso. El color es el siguiente libre de la paleta. Lo que ya cayó en `otros` no se mueve solo; se reasigna desde la web.
 
> **Nota sobre botones:** WhatsApp permite **máximo 3 reply buttons** por mensaje. Al eliminar la repregunta, el único botón que se usa en la confirmación es **Deshacer** (sección 4), así que no hay conflicto.
 
### Confirmación progresiva: texto primero, reacción después
 
El cupo del número de prueba es de **1000 mensajes/mes** y cada gasto cuesta dos: el del usuario y la confirmación del bot. Con 200+ cargas mensuales de Brian solo, la confirmación en texto es la mitad del consumo.
 
**Decisión:** las primeras **15 cargas de cada usuario** se confirman con mensaje de texto y botón *Deshacer*. A partir de la 16, el bot confirma **reaccionando con un emoji** al mensaje del usuario.
 
**Por qué reaccionar sale gratis:** una reacción no abre conversación, así que no descuenta del cupo. El consumo por gasto pasa de dos mensajes a uno.
 
**Por qué las primeras 15 no:** al principio el usuario no sabe si el bot entendió bien, y un emoji no dice *cuánto* ni *en qué categoría* anotó. El texto es lo que enseña el formato y genera confianza. Una vez que la persona ya vio quince veces que el parseo acierta, deja de leer la confirmación y el mensaje pasa a ser puro coste.
 
**Excepción, independiente del contador:** si al parser le falta un dato (*"gasté 50"*), la confirmación de la respuesta va **siempre en texto** con *Deshacer*. Lo mismo un fijo cargado con otro monto, para que se lea que solo cambió ese mes. La reacción es para el camino feliz.
 
**Deshacer pasa a ser por texto.** La reacción es solo un emoji: no admite botones. A partir de la carga 16, corregir se hace escribiendo *"borrá eso"* o *"no, era 40"*, que ya está previsto en la sección 4 y apunta siempre a la última carga de ese chat (`canales.ultima_carga_id`). Cuesta un mensaje, pero solo cuando hubo un error — que es lo poco frecuente.

*(Implementado, `add-bot-conversation`, 1/10/2026.)* El adaptador lee `cargas_confirmadas` y `modo_confirmacion`, elige texto con botón o reacción con el ícono de la confirmación (✅ 💰 🐷 🏦) y suma uno al contador en los dos casos. La confirmación en texto dice qué se anotó y, si la categoría tiene presupuesto en el ciclo en curso, cómo viene: *"Anotado ✅ Súper · 15 € en Comida. Llevás 48 € de 300 € este mes 🟢"* (🟢 menos del 80 %, 🟡 desde el 80 %, 🔴 desde el 100 %, los mismos números que la barra del dashboard).
 
**Dónde vive:** en la capa que decide *cómo* responde el bot, no en la lógica. El adaptador de WhatsApp recibe el resultado de la carga y elige formato; la lógica del bot sigue sin saber nada de WhatsApp.
 
**Esquema:** en `usuarios`, `cargas_confirmadas` (int, default `0`) y `modo_confirmacion` (`auto` | `texto` | `reaccion`, default `auto`). `auto` aplica la regla del umbral; los otros dos la fuerzan desde ajustes.
 
El umbral (15) es una constante del código, no un campo: si hay que moverlo, se mueve para todos.

**Solo aplica a WhatsApp.** La confirmación progresiva existe para cuidar el cupo de Meta. En Telegram no hay cupo que cuidar, así que la confirmación es **siempre en texto con Deshacer**. Como el formato lo elige el adaptador (arriba), la regla vive en el de WhatsApp y el de Telegram simplemente no la tiene.

**Con número propio se queda.** El cupo de 1000 desaparece, pero los otros motivos no: pasada la carga 15, la confirmación en texto es ruido que la persona ya no lee, y el consumo de mensajes pasa a medirse en plata, según las tarifas de Meta, en vez de en cupo. Un mensaje menos por gasto sigue valiendo.

### Historial de conversación: solo usuarios VIP

**Decisión (sept 2026):** para los usuarios marcados como VIP, el bot guarda la conversación (lo que escribe el usuario y lo que responde el bot) y el parser recibe los últimos mensajes como contexto. Así entiende *"lo mismo que ayer"* o la respuesta a una repregunta (*"gasté 50"* → *"¿en qué?"* → *"súper"*) sin volver a preguntar.

**Por qué solo VIP:** cada mensaje de contexto son tokens de Gemini en cada carga, y guardar el texto de los mensajes es guardar datos personales. Para el resto de los usuarios no se guarda ningún texto: el bot sigue como está descrito arriba, sin memoria entre mensajes.

**Cómo se marca:** `usuarios.vip`, a mano por SQL. No hay UI, ni para el usuario ni de administración.

**Qué recibe el parser:** los últimos 20 mensajes de las últimas 24 horas, en orden (`HISTORY_LIMIT` y `HISTORY_WINDOW_MS` en `lib/data/messages.ts`; 20 desde `add-bot-conversation`). Tiene dos topes porque un mensaje de hace tres días confunde más de lo que ayuda. Los dos son constantes del código, igual que el umbral de 15.

**Dónde vive:** la lógica del bot lee y escribe `mensajes` (sección 8) con el `usuarioId` que le pasa el adaptador. No sabe de qué canal vino, solo lo registra. Un mensaje duplicado, que corta la idempotencia, no se guarda dos veces.

> **Decisión (27/9/2026):** los mensajes se guardan **30 días**. El parser solo usa las últimas 24 horas; los 30 días alcanzan para revisar a mano por qué falló una carga, y pasado eso es texto personal que nadie lee. El cron diario (sección 7) borra los de más de 30 días; es una constante del código, igual que los dos topes de arriba.
 
---
 
## 4. Onboarding y cuentas
 
### Una puerta de entrada: la web

La cuenta nace **solo por la web**, con el registro abierto (código por mail; Google en el bloque 13). WhatsApp es un **canal** que la persona vincula desde su cuenta, no una forma de crearla. Un solo onboarding, el web, y un solo dashboard.

> **Decisión (3/10/2026):** reemplaza a *Alta por código de invitación* y a *Dos puertas de entrada, una cuenta*. Antes había dos entradas: el registro web y WhatsApp por invitación, con una tabla `invitaciones` (código de un solo uso, 7 días, `creada_por`), un onboarding por chat (código → nombre → país → ciclo → gasto de prueba → link con código de un solo uso que abría sesión), el *setup partido* (lo mínimo en el chat, categorías y fijos en la web), un botón "Invitar a alguien" en el menú y el interruptor `WHATSAPP_REQUIRE_INVITE` para apagar la invitación con el número propio. Se saca todo. Motivo: la invitación existía para dejar entrar gente por el chat sin abrir el bot a cualquier número; con el registro web abierto y el onboarding web hecho, ese camino duplica el onboarding, suma una tabla y un interruptor, y la gente igual se registra por la web. El tope de 5 destinatarios del número de prueba es de Meta y se maneja en su panel, no con códigos. Lo que queda en el código y en la base (`lib/whatsapp/invite.ts`, `usuarios.codigo_invitacion`, la tabla `invitaciones` de la `0003`, el campo de código del cierre del onboarding) se quita en el bloque 10 de `ROADMAP.md`.

**Vincular WhatsApp.** La persona escribe primero. En el cierre del onboarding o en la sección "WhatsApp" de ajustes, Mango le muestra un botón que abre WhatsApp contra el número de Mango con el mensaje ya escrito: `https://wa.me/<número de Mango>?text=vincular%20ABC123`, donde `ABC123` es un **código de vinculación** corto, por cuenta y con vencimiento (`usuarios.codigo_vinculacion`, `whatsapp_solicitado_en`, sección 8). Cuando ese mensaje llega desde un número que no está en `canales`, el adaptador busca el código, crea la fila en `canales` con el `wa_id` **tal como lo manda Meta** y responde ahí mismo ("✅ Listo, este chat ya está vinculado a tu cuenta"), dentro de la ventana de 24 h y sin plantilla. El código se consume al vincular. La web refleja el estado: "sin vincular" (botón), "pedido, escribile a Mango" (botón otra vez, el código sigue vivo) y "vinculado" (fila en `canales`).

> **Decisión (3/10/2026):** se vincula por código en el primer mensaje, no por plantilla ni por número. Motivos: (1) el número correcto lo pone WhatsApp, no la persona: Meta manda el `wa_id` canónico (en Argentina `549 11 …`, con el 9 de celular y sin el 0 ni el 15 que se marcan desde adentro; en otros países sin el cero troncal), y un número tipeado a mano rara vez coincide con eso; (2) no depende de una plantilla aprobada por Meta ni de la ventana de 24 h, porque el mensaje lo inicia la persona, así que la respuesta es gratis; (3) sirve igual con el número de prueba y con el propio: solo cambia el número del link. Cuesta un toque más que recibir un mensaje. Reemplaza al plan anterior (Mango manda una plantilla al número guardado y el adaptador vincula cuando la persona responde) y a la alternativa de casar el número desconocido con `usuarios.telefono`.

**El número tipeado es opcional.** El campo de teléfono queda en el cierre (plegado bajo "Dejar mi número") y en ajustes solo para que, mientras dure el número de prueba, Brian cargue ese número entre los 5 destinatarios del panel de Meta (sin eso, el bot no puede responderle). Se elige el país con bandera y prefijo (`components/molecules/phone-field.tsx`: `select` nativo con el emoji derivado del código ISO de `lib/data/countries.ts`, sin assets) y el número local al lado; `toE164` (`lib/data/phone.ts`, sobre `libphonenumber-js/min`) lo lleva a E.164 en el servidor y resuelve el 9 y el 15 argentinos y el cero troncal de Irlanda, Reino Unido, Alemania o Italia. Guardarlo no crea código ni canal ni toca la fecha del pedido. No se usa para vincular: cuando llega el primer mensaje, `usuarios.telefono` se pisa con el `wa_id` de Meta. Con el número propio el campo desaparece.

*Construido en `add-whatsapp-linking` (3/10/2026).* El código lo genera la web como el usuario (`ProfileMutations.requestWhatsAppLink`, seis símbolos de un alfabeto sin 0/O/1/I, `lib/whatsapp/link.ts`), al llegar al cierre del onboarding o al tocar "Vincular WhatsApp" en Cuenta; uno vivo se reusa, uno vencido se reemplaza. El número de Mango sale de `WHATSAPP_PHONE_NUMBER` (solo dígitos, distinto del `PHONE_NUMBER_ID`), leído por las páginas y pasado como dato; sin la variable la pantalla muestra el código con la línea "Envía *vincular ABC123* a Mango". La vinculación es una función SQL de service role (`vincular_canal`, sección 8) y la web lee su estado con `canal_vinculado`. Los tres estados en pantalla: *sin vincular* (botón), *esperando tu mensaje* (código a la vista, la pestaña se relee al volver al foco) y *vinculado* (con el número). Las negativas del chat: código inválido o vencido, número que ya es canal de otra cuenta, cuenta que ya tiene WhatsApp (sin desvincular desde la web todavía: deuda).

**Un número desconocido no se ignora en silencio.** Si no coincide con ningún canal, el bot responde una sola vez con una línea que manda a registrarse en la web y a vincular el número desde ajustes, con el link, en español e inglés (no sabe el idioma). Sin onboarding por chat y sin pedir ningún código. *Construido en `add-whatsapp-linking`:* la tabla `contactos_desconocidos` (sección 8) recuerda el número, cuántos mensajes mandó y cuándo se le respondió; `registrar_contacto_desconocido` devuelve `true` solo en la llamada que marca la respuesta, así el segundo mensaje no gasta nada; el cron borra las filas de más de 90 días. Una pulsación de botón desde un número desconocido se descarta. Sigue siendo un mensaje del cupo, y por eso el rate limiting de la sección 10 va delante.

> **Decisión (sept 2026):** reemplaza a "El bot es la puerta de entrada", que decía: la cuenta se crea **desde WhatsApp**, no desde la web; al primer mensaje, el bot da de alta al usuario **solo con el número de teléfono** — sin mail, sin contraseña, sin formulario —, porque es el momento que vende el producto: mandás un mensaje y ya quedó registrado el gasto. Motivo del cambio: el dashboard ya permite cargar todo a mano, y el techo de 5 destinatarios es de Meta, no de Mango. Con el bot como única entrada, la app no podía crecer hasta tener número propio. El "momento que vende" lo da ahora la `/demo` (sección 12) y el margen libre en vivo del onboarding web.

#### Onboarding web

*Construido en `add-web-onboarding` (octubre 2026): la ruta `/onboarding`, detrás de la sesión, con `components/templates/onboarding-template.tsx` y contratos inyectados como el dashboard — montada contra Supabase en `app/onboarding/` (server actions) y en memoria en `/demo/onboarding` (sin link, `noindex`), donde corren los specs de Playwright.*

1. **Registro** con código por mail (sección 2; Google llega en el bloque 13). La fila de `usuarios` la crea un trigger sobre `auth.users` cuando la persona escribe su primer código (sección 8), con EUR, la zona del navegador y ciclo desde el día 1 como valores provisorios que nadie ve: `/dashboard` redirige a `/onboarding` mientras `onboarding_completo` sea false, y `/onboarding` a `/dashboard` cuando es true. El paso pendiente queda en `usuarios.onboarding_paso` (cada avance o retroceso lo escribe), así cerrar la pestaña en el paso 4 vuelve al paso 4, con lo guardado hasta ahí. La URL no cambia entre pasos: el "Volver" de la pantalla es el control, no el del navegador. Una línea de progreso arriba, sin "paso 3 de 7".
2. **Bienvenida sin gasto cargado.** No felicita por algo que no pasó. Tampoco muestra el nombre (es la parte local del mail).
3. **Datos básicos:** nombre (prellenado solo si el guardado parece un nombre; un handle como `brian+alta1` queda de placeholder), país de una tabla fija (`lib/data/countries.ts`, nombres por `Intl.DisplayNames`, preseleccionado por la zona horaria del navegador) → moneda y timezone, los dos editables, con una línea que dice el resultado ("Peso argentino · hora de Buenos Aires"); para Argentina, el formato de montos (sección 2); y el día de inicio de ciclo, editable solo mientras la cuenta no tenga nada atado al ciclo (categoría, fijo, presupuesto o movimiento): después queda fijo, porque cambiarlo re-indexaría `presupuestos.periodo`. Sin eso no hay ciclo (sección 6) ni moneda contra la que sumar. El país y la moneda quedan **editables**: hay gente que vive en un país y gasta en otra moneda.
4. **Categorías:** chips sugeridos (Comida, Vivienda, …) más un compositor, sin hoja: cada toque crea la categoría con las operaciones del dashboard, viva desde el ciclo en curso y con el primer color libre de la paleta; renombrar en línea, color bajo la fila, deslizar para borrar con deshacer.
5. **Ingresos y fijos:** dos listas con un compositor cada una (nombre, monto, día; categoría en los gastos); una fila abre la hoja de definición del dashboard. Al continuar, `insertar_cargos_pendientes` (sección 8) le da a cada definición su cargo **pendiente** del ciclo en curso, la misma fila que el cron habría insertado, así el margen del paso siguiente es el del dashboard desde el primer día y no depende de la corrida de las 05:00.
6. **Presupuestos**, con el **margen libre en vivo**: es la pregunta que la app contesta (sección 9), y verla moverse mientras se cargan los sobres explica el modelo sin tutorial. Misma `getFreeMargin`, mismos datos (los fijos a su monto esperado); cada campo escribe al salir el presupuesto del ciclo en curso. Una barra reparte el ingreso en sobres y resto.
7. **Meta de ahorro.** La primera UI de `meta_ahorro_mensual`; el margen sigue en pantalla y una línea anticipa lo que queda con la meta.
8. **WhatsApp**, opcional. La persona toca **"Vincular WhatsApp"**, que abre el chat con Mango con el código de vinculación ya escrito (ver *Vincular WhatsApp*, arriba), o **"Seguir sin WhatsApp"** y termina el onboarding; en los dos casos puede vincular después desde ajustes. Mientras dure el número de prueba, la pantalla también pide el número con bandera y prefijo, para cargarlo en el panel de Meta. Va al final, después de que todo lo demás ya funciona, para que nadie sienta que la app queda a medias sin el bot. La pantalla muestra una vista previa del chat (la burbuja "vincular ABC123" con el código real y la respuesta de Mango), el código para tipearlo a mano y, al activar el link, el estado "Esperando tu mensaje", que pasa a "Vinculado" con el número cuando la pestaña recupera el foco después de mandar el mensaje; "Ir a mi mes" cierra el onboarding (`add-whatsapp-linking`).

**"Cuenta"**, en el menú del dashboard, es la misma pantalla de datos básicos (nombre, país, moneda, formato para Argentina) para cambiarlos después; el día de inicio se muestra y no se edita (deuda `presupuestos.periodo` en `CLAUDE.md`), y con movimientos cargados avisa que las sumas no convierten entre monedas.

El onboarding **no se repite**. La web expone después la pantalla "Cuenta" y la sección "WhatsApp" de ajustes para tocar lo mismo más adelante.

#### Comunes

- **`onboarding_completo`** y redirección al paso pendiente si alguien abandona a mitad. Sin eso, quien cierra la pestaña en el paso 4 vuelve a un dashboard a medio configurar y no sabe por qué los números no cierran.
- **Sección "WhatsApp" en ajustes:** estado del canal (sin vincular / número guardado, esperando el mensaje / vinculado), el campo del número para quien lo saltó en el onboarding, y una línea honesta mientras se use el número de prueba: que el bot llega de a pocos y por qué (el cupo de Meta). Existe para que un usuario web no descubra el límite recién cuando quiere usar el bot (sección 11).
- **`/login` no puede fallar en silencio** con un mail que no existe. Con registro abierto, el mismo formulario sirve para entrar y para crearse la cuenta: una dirección nueva recibe su código de verdad, y una línea bajo el campo avisa que la primera vez se crea la cuenta.
- **La fila de `usuarios` nace con el primer código confirmado**, sea cual sea el camino (el código hoy, Google en el bloque 13): la crea la base, no la web, así ninguna ruta necesita la service key ni una política de insert. Quien pidió un código y no lo escribió no tiene fila. "Cuenta sin vincular" queda solo para lo que el trigger saltea (una dirección que ya usa otra fila, un error).
- **La home explica qué es Mango** y promete el bot para todos, junto a "Demo" y "Entrar". No menciona invitaciones.

### Acceso a la web

Se entra con **código por mail** (sección 2; Google, en el bloque 13). El mail está desde el primer paso, porque es con lo que se registra. El teléfono, cuando se vincula, queda atado a esa cuenta: un solo usuario, una puerta, dos canales.

> **Decisión (sept 2026):** antes el mail aparecía recién cuando la persona quería entrar al dashboard: le pedía el acceso al bot, el bot le mandaba el link con código de un solo uso, entraba, dejaba su mail y de ahí en adelante usaba magic link. Con registro abierto la web ya no depende del bot para entrar. El 2026-09-28 el magic link pasó a código por mail (sección 2), y el 3/10 se sacó el link de un solo uso junto con el onboarding por chat.
 
### Cómo presentarlo a alguien nuevo

La `/demo` primero (sección 12), que ya tiene los gráficos poblados, y después el registro web. El onboarding web existe justamente para que el dashboard no arranque vacío: con categorías, fijos y presupuestos cargados, el margen libre dice algo desde el primer día. WhatsApp se ofrece al final del onboarding, cuando la app ya demostró algo.

> **Decisión (sept 2026, revisada el 3/10):** antes era "siempre por el chat", y después "por el chat si tiene invitación, por la demo si no". Con una sola puerta, es siempre la demo y el registro.
 
---
 
### Corregir y borrar transacciones
 
Cargar rápido implica equivocarse. La corrección tiene que ser tan barata como la carga, o el usuario deja de confiar en los totales.
 
#### Por chat: deshacer la última
 
Cada carga se confirma con un mensaje que incluye un botón **Deshacer**:
 
> *"Anotado ✅ Disco · 30 € en Ocio."*  ·  `[Deshacer]`
 
El botón borra **la carga de esa confirmación** (su id viaja en el botón), aunque después haya cargas más nuevas. Escribir *"borrá eso"* o *"no, era 40"* actúa sobre **la última carga de ese chat** (`canales.ultima_carga_id`), nunca sobre algo cargado desde la web: no hay ambigüedad sobre cuál se toca. *"No, era 40"* corrige el monto (un retiro de ahorro sigue siendo retiro) y *"eran comida"* la categoría (solo en gastos). Si la carga completó un gasto fijo, borrarla lo devuelve a pendiente en vez de sacarlo del mes, y corregirla toca solo el cargo de ese ciclo, nunca la definición. *(Implementado, `add-bot-conversation`, 1/10/2026.)*
 
**Alcance deliberadamente corto:** por chat solo se toca la última carga. Borrar algo de hace tres días requiere ver la lista y elegir, y eso en un chat es un desastre.
 
#### Por web: cualquier transacción
 
El listado del mes permite editar y borrar cualquier fila. Es el mismo criterio de la sección 7 con los gastos fijos: **lo rápido va al chat, lo que requiere mirar va a la web.**
 
#### Borrado suave
 
No se hace `DELETE`. Se agrega a `transacciones`:
 
- `borrado_en` (timestamp, nullable)
Todas las consultas filtran `borrado_en IS NULL`. Motivos:
 
- Un bug en el bot no destruye datos de forma irreversible.
- Se puede revertir un borrado accidental.
- El `mensaje_id_externo` (antes `wa_message_id`) sigue en la tabla, así que **un reintento del webhook no resucita** una transacción borrada como si fuera nueva.
Las filas borradas no aparecen en ningún total, gráfico ni cálculo de ritmo. Se pueden purgar de verdad con un job periódico si algún día molestan, pero con este volumen no hace falta.
 
---
 
## 5. Modo asesor
 
El bot detecta si el mensaje es una **carga** o una **consulta**. Si es consulta, responde de forma breve (2–3 frases) actuando como asesor financiero.
 
Ejemplos: *"¿qué presupuesto semanal tengo?"*, *"¿cómo vengo este mes?"*
 
**Regla de coste:** a Gemini se le pasa un **resumen ya agregado por SQL**, nunca las transacciones crudas. Los totales se calculan en la base. Esto mantiene los tokens bajísimos y es lo que permite sostener el coste cero.
 
### Consultas de gastos del mes
 
El bot responde el **total del mes + desglose por categoría (top 5)** y una línea con cuántas categorías quedaron afuera y cuánto suman, para que las líneas den el total. Nada más: la lista completa en chat es ilegible. Para el detalle transacción por transacción, devuelve un link a la web. *"Libre"* o *"¿cuánto me queda?"* responde el margen libre.

*(Implementado, `add-bot-conversation`, 1/10/2026.)* Las dos consultas salen de `resumenMensual`, la misma función del dashboard, sin llamar al modelo: los números coinciden con la pantalla. El modo asesor con Gemini (arriba) sigue pendiente, bloque 13 de `ROADMAP.md`.
 
> El chat es para lo rápido. La web es para lo profundo.
 
---
 
## 6. Manejo de meses y zona horaria
 
**No existe un cierre de mes.** No hay proceso batch, ni estado que resetear, ni nada que "cambie" el día 1. Cada transacción tiene su fecha y el mes es simplemente un filtro en la consulta (`date_trunc('month', fecha)`).
 
Lo único que hay que definir bien es la **zona horaria**. Si se guarda todo en UTC y el usuario está en Dublín, un gasto de las 23:00 puede caer al día siguiente y contarse en el mes equivocado. Solución: guardar la zona horaria del usuario (derivada del país en el onboarding) y agrupar con ella, no con UTC.
 
En el dashboard esto se traduce en un **selector de mes** arriba de todo, para navegar a cualquier mes pasado y hasta **6 ciclos adelante**, que se muestran como proyección (sección 9, *Meses futuros: proyección*).

> **Decisión (sept 2026):** el selector deja de terminar en el ciclo en curso (hoy `?mes=` se recorta ahí). Seis ciclos alcanzan para ver cuándo termina una cuota o arranca otra, que es lo que la proyección tiene para decir.
 
---
 
### Ciclo de facturación configurable
 
**El mes del usuario no es el mes del calendario.** Brian cobra el 25; el 26 de agosto ya está gastando el sueldo de septiembre. Si el dashboard corta el 31, ese gasto cae en agosto, contra un presupuesto que ya no existe.
 
**Decisión:** campo `dia_inicio_ciclo` en `usuarios` (int, default `1`; Brian = `26`). El mes deja de ser `date_trunc('month', fecha)` y pasa a ser una **función que calcula el rango del ciclo** a partir de ese día. De esa función cuelgan presupuestos, margen libre, carga de gastos fijos, selector de mes y gráficos: todo consulta el mismo rango.
 
**Nombre del ciclo:** el que va del 26/8 al 25/9 se muestra como **"Septiembre"** — es el sueldo de septiembre el que se está gastando.
 
**Ciclos de 28 a 31 días:** la fórmula del ritmo lo aguanta sin cambios porque divide por días del ciclo, no por 30 fijo.
 
**Configurable, no fijo:** los otros dos usuarios cobran otros días. Quien cobra el 1 deja el default y ni se entera de que la opción existe.
 
**Por qué ahora:** desde el principio es un campo y una función. Con seis meses de datos cargados obliga a recalcular todos los presupuestos y arreglar cierres viejos a mano.
 
**Onboarding:** se pregunta en el chat, justo después del país. Una sola pregunta, con "el 1" como respuesta por defecto.
 
---
 
## 7. Tipos de movimiento
 
El campo `tipo` tiene **tres valores**, no dos:
 
| Tipo | Qué es |
|---|---|
| `ingreso` | Entra plata |
| `gasto` | Sale plata y se consume |
| `ahorro` | Sale del disponible del mes pero **no se consume** |
 
**El ahorro no es un gasto.** Si se registra como gasto, los números de consumo quedan inflados y la torta de categorías miente. Por eso tiene tipo propio: sale del disponible, se acumula en su propio total, y no ensucia el análisis de gastos.
 
**Retiro de ahorros:** se registra como un movimiento de ahorro **en negativo**. El acumulado baja, y el gasto real que se hizo con esa plata se registra aparte, en su categoría. Esto evita el peor escenario: sacar 1.000 del ahorro para un viaje y que el mes parezca catastrófico cuando en realidad estaba planeado.
 
### Fijo vs variable
 
`es_fijo` es un **booleano en la transacción**, no una categoría. Un gasto de supermercado es variable, el alquiler es fijo, y ambos tienen además su categoría propia. Los dos ejes son independientes.
 
Importante: **"fijo" significa recurrente, no inmutable.** Si el alquiler sube de 880 a 920, sigue siendo fijo — cambia el monto. Por eso el monto vive en cada transacción y no en la definición del gasto fijo; cada mes registra lo que realmente se pagó, y el gráfico de barras muestra justamente esa subida.
 
### Carga automática de fijos
 
Los fijos se **insertan automáticamente al inicio del ciclo**, no se cargan a mano. La **edición del monto de este ciclo** se hace desde la fila, en su categoría; la **definición** (día del mes, monto esperado, alta y baja) vive en la hoja que abre "Próximos cobros" (sección 9), no en una pantalla aparte.
 
#### Alta desde el propio gasto
 
Al crear un gasto, un **interruptor "recurrente"**. Al activarlo pide el **día del mes** y crea además la definición en `gastos_fijos`. El fijo se da de alta desde donde ya estás, no desde una pantalla aparte.
 
Consecuencia: **suscripciones queda desglosada y fija a la vez.** Netflix tiene categoría `suscripciones` *y* `es_fijo = true`; aparece en la torta dentro de su categoría y se cuenta una sola vez (ver sección 8).
 
#### Filas pendientes: cómo no se duplica la luz
 
Un fijo de monto variable (luz, gas) se carga por chat como cualquier gasto — *"luz 120"* — y eso choca con la fila que el cron ya insertó. La reconciliación:
 
1. El cron inserta la fila del ciclo en estado **`pendiente`**, con el `monto_actual` de la definición como **valor esperado**.
2. Una carga manual busca si hay una fila `pendiente` de ese `gasto_fijo_id` en el ciclo. Si existe, la **completa con el monto cargado y la marca `confirmada`**. No inserta una segunda.
3. Si el ciclo termina y nadie la tocó, la pendiente se **cierra sola con el monto esperado**. Es el caso del alquiler, que no varía nunca y que por eso jamás se escribe a mano.
**Esquema:** campo `estado` (`pendiente` | `confirmada`) en `transacciones`, ver sección 8.

> **Implementado (`add-cycle-projection-and-recurring-cron`, sept 2026):**
> - **Quién genera un ciclo:** lo decide la marca `usuarios.ciclo_generado_hasta` (primer día del último ciclo generado), no el día del mes. Una corrida perdida se recupera en la siguiente, y un fijo creado a mitad de ciclo no hace que el ciclo parezca generado. `generar_ciclo` no escribe si la marca ya llegó a ese ciclo. Inserta con `on conflict do nothing` y cuenta `repeticiones_insertadas` solo por las filas que realmente insertó, en la misma sentencia que desactiva un plan que llega al total.
> - **Conciliación desde la web:** guardar una fila pendiente desde su hoja la confirma con el monto cargado. `update` de gastos e ingresos siempre escribe `estado = 'confirmada'`; no hay un botón aparte de "confirmar".
> - **Conciliación desde el bot:** `completar_cargo_recurrente` completa la pendiente del fijo en el ciclo. Si no hay ninguna, inserta una confirmada y la cuenta. Si el hueco ya lo ocupa una fila confirmada o borrada, falla con `already-confirmed`. La usa el bot (bloque 5); la web no.
> - **Cierre:** `cerrar_pendientes` confirma, a su monto esperado, las pendientes de los ciclos anteriores al que está en curso.
> - **Qué se muestra cobrado:** una fila confirmada, o una cuyo día local ya pasó (decisión Q4). `estado` sigue abierto hasta el cierre para conciliar. Así la pantalla se ve igual que antes de `estado`, y el alquiler del día 1 no queda como "próximo cobro" todo el mes. Editar una definición reescribe el cargo del ciclo solo si sigue pendiente y su día no pasó.
> - **Plan B de octubre 2026:** `supabase/seed/octubre-2026.sql` inserta a mano los cargos de un ciclo con las mismas reglas y mueve la marca. Existe por si el cron no estaba en producción el 1/10.
 
**Los fijos se descuentan del margen libre desde el día 1 del ciclo**, estén pendientes o confirmados. Esa es la pregunta que la app contesta: cuánto queda realmente, no cuánto hay en la cuenta antes de pagar lo que ya se debe. Si el alquiler apareciera recién el día que se cobra, el margen libre sería optimista justo los primeros días, que es cuando se decide.
 
**Beneficio lateral:** la tarjeta «Próximos cobros» (sección 9) existe justamente para esto — muestra **qué falta confirmar este ciclo**.

**El cron no decide por su cuenta qué insertar:** usa `proyectarCiclo` (sección 3), la misma función que calcula los meses futuros del dashboard. La proyección calcula qué va a pasar y el cron lo escribe cuando llega el día, así que un ciclo proyectado y el mismo ciclo ya insertado nunca se contradicen.
 
> El aviso proactivo de *"inserté tus fijos"* cae fuera de la ventana de 24 h de WhatsApp y requiere una *template* aprobada por Meta. Para fase 1 se insertan en silencio y se ven en el dashboard.
 
#### Recurrencias con un final
 
No todos los fijos son "para siempre" — una compra en cuotas también es un gasto que se repite, solo que un número fijo de veces. En vez de una entidad nueva ("deudas"), son dos columnas en `gastos_fijos`: `repeticiones_totales` (nullable — `null` es "sin final", el caso por defecto) y `repeticiones_insertadas` (cuántas veces el cron ya insertó una fila, no cuántas siguen vivas si se borra alguna). Cuando el insert que llega al total corre, la misma sentencia pone `activo = false`: nadie tiene que acordarse de cancelarlo. La hoja de la definición (sección 9) muestra el progreso (*"4 de 10"*) y lo que queda por pagar al monto actual.
 
Deliberadamente no modela principal, interés ni una tabla de amortización — eso, si hace falta, es una capacidad nueva que *referencia* una definición, no una reescritura de esta.
 
> **Implementado (add-recurring-expense-management, sept 2026):** la definición se edita desde una hoja propia que abre "Próximos cobros" (sección 9) — nunca se construyó una pantalla dedicada a los fijos. El alta sigue siendo el interruptor "recurrente" al crear un gasto (arriba). Ese interruptor solo aparece al crear, nunca al editar una fila ya existente — pasar un gasto suelto a recurrente se hace borrándolo y cargándolo de nuevo.

#### Gastos puntuales planificados

> **Pendiente de decidir:** si se suman gastos puntuales planificados en meses futuros (*"viaje en febrero, 600"*). Se apoyarían en `transacciones.estado` (sección 8), que ya existe desde la `0021`.
 
---
 
## 8. Base de datos
 
**`usuarios`**
- `id`
- `telefono` (E.164, ej. `+353...`, **nullable** — una cuenta creada por la web no tiene; el bot identifica por `canales`, abajo)
- `nombre` (se pregunta en el primer paso de cualquiera de los dos onboardings, ver sección 4)
- `email` (nullable — una cuenta web lo tiene desde el registro; una de WhatsApp, desde que entra a la web)
- `pais` (nullable desde la `0025`: una cuenta web nace sin país hasta el onboarding del bloque 9)
- `timezone`
- `moneda_default`
- `onboarding_completo` (bool)
- `recordatorio_diario` (bool, default `false` — ver sección 14.2)
- `dia_inicio_ciclo` (int, default `1` — ver sección 6)
- `idioma` (`es` | `en`, derivado del país, editable — ver sección 2)
- `foto_url` (nullable — avatar; si está vacío se muestra la inicial del nombre, ver sección 9)
- `cargas_confirmadas` (int, default `0` — contador para la confirmación progresiva, ver sección 3)
- `modo_confirmacion` (`auto` | `texto` | `reaccion`, default `auto` — ver sección 3)
- `meta_ahorro_mensual` (numeric, nullable — meta de ahorro por ciclo; `null` es "sin meta fijada", ver sección 9)
- `vip` (bool, default `false` — se marca a mano; activa el historial de conversación, ver sección 3)
- `ciclo_generado_hasta` (`date`, nullable — primer día del último ciclo cuyos fijos insertó el cron; `null` es "nunca generó". La `0021` la llenó con el `max(ciclo_mes)` de cada usuario. Ver secciones 3 y 7)
- `onboarding_paso` (int 1–7, default `1` — el paso pendiente del onboarding web; `/onboarding` abre ahí y cada avance o retroceso lo escribe. No se lee con `onboarding_completo = true`. `0029`, sección 4)
- `formato_montos` (`completo` | `abreviado`, default `completo` — cómo se leen los montos; rige solo con `pais = 'AR'`, sección 2. `0029`)
- `whatsapp_solicitado_en` (timestamptz, nullable — cuándo pidió vincular WhatsApp desde el onboarding o desde ajustes; `null` es "no lo pidió". `0029`, sección 4)
- `codigo_vinculacion` (text, nullable, único, `^[A-HJ-NP-Z2-9]{6}$` — el código corto que viaja en el mensaje `vincular ABC123` con el que la persona vincula su WhatsApp; lo escribe la web al llegar al cierre del onboarding o al tocar "Vincular WhatsApp", vence a los 7 días de `whatsapp_solicitado_en` (uno vivo se reusa) y `vincular_canal` lo pone en null al crear el canal. `0031`, sección 4)
- Historia: `codigo_invitacion` (`0029`) y la tabla `invitaciones` (`0003`, políticas de la `0011`) existieron para la invitación que se sacó el 3/10 (sección 4); la `0030_sin_invitaciones.sql` (`remove-whatsapp-invitations`) las borra, sin datos que restaurar.

> **Cargos desde el onboarding (`0029`):** `insertar_cargos_pendientes(p_usuario_id, p_periodo, p_cargos)` es el tercer escritor de cargos, junto a `generar_ciclo` (cron) y `completar_cargo_recurrente` (bot). `security invoker`, lo llama el usuario logueado para el ciclo en curso o uno posterior con los cargos que calculó `proyectarCiclo`; inserta filas **pendientes** con las mismas columnas y el mismo filtro que `generar_ciclo`, `on conflict (movimiento_recurrente_id, ciclo_mes) do nothing`, cuenta con `sumar_repeticion` (solo si el ciclo ya se generó; si no, lo cuenta `generar_ciclo` al generarlo) y nunca mueve `ciclo_generado_hasta`. Idempotente, y el cron después no inserta ni cuenta dos veces. Existe porque el ciclo en curso muestra solo filas reales: sin ella, quien termina el onboarding vería un margen distinto al del paso de presupuestos hasta las 05:00 UTC, o nunca en ese ciclo si el cron ya lo había generado.

> **Alta desde la web (2026-09-28, `0025`):** un trigger sobre `auth.users` (`crear_usuario_desde_auth`, `security definer`) inserta la fila cuando el e-mail de un auth user queda confirmado: al crearse ya confirmado, o al pasar `email_confirmed_at` de null a una fecha con su primer código. No al crearse: con `shouldCreateUser: true` el auth user nace al *pedir* el código, y así cualquier dirección tipeada tendría fila. Valores: `nombre` = lo que va antes de la `@`, `idioma` y `timezone` de la metadata (validados; si no, `es` y `UTC`), `moneda_default` `EUR`, `pais` null, los demás por default. `on conflict do nothing`, y cualquier error queda como warning sin cortar la confirmación: sin fila, la persona entra y ve "cuenta sin vincular", que se arregla con un insert.

> **Decisión (sept 2026):** `telefono` deja de ser el identificador principal y pasa a nullable. El usuario es una identidad sin teléfono; el teléfono es un canal más (`canales`, abajo). Por qué ahora, antes de escribir el bot: si el bot escribe pegado al teléfono, migrarlo después cuesta más que dejar el hueco hoy.

**`canales`**
- `id`
- `usuario_id`
- `tipo` (`whatsapp` | `telegram`)
- `identificador_externo` (en WhatsApp, el teléfono en E.164)
- `pregunta_pendiente` (jsonb, nullable) y `pregunta_vence_en` — la pregunta abierta del bot en ese chat, de categoría o de crear categoría, 30 minutos (sección 3, `0023`)
- `ultima_carga_id` (uuid, nullable — la última carga hecha por ese chat, la única que *"borrá eso"* y *"no, era 40"* tocan; FK compuesta `(ultima_carga_id, usuario_id) → transacciones (id, usuario_id)`, `on delete set null`, así nunca apunta a una fila de otra cuenta. `0028`)
Único por `tipo` + `identificador_externo`: un mismo número no puede quedar vinculado a dos cuentas. Es lo que lee el adaptador para saber quién escribe (sección 3). RLS encendido y sin políticas: solo lo toca el bot con el cliente admin; la web lee únicamente su propio identificador a través de `canal_vinculado` (abajo), nunca la pregunta pendiente ni la última carga.

> **Funciones de vinculación (`0031`, `add-whatsapp-linking`):** `vincular_canal(p_tipo, p_codigo, p_identificador)` — service role, una transacción: busca la cuenta por código vivo (`for update`), rechaza `cuenta-ya-vinculada` (ya tiene canal de ese tipo) y `numero-en-otra-cuenta` (el identificador ya es canal de otra), limpia `usuarios.telefono` de cualquier otra cuenta que solo lo tenía tipeado, inserta el canal y pisa `telefono` con el identificador y `codigo_vinculacion` con null; si no hay código vivo, `codigo-invalido`. Un reintento del webhook espera el bloqueo y no encuentra código. `canal_vinculado(p_tipo)` — `security definer`, `stable`, para `authenticated`: el identificador del canal de la sesión (`usuario_actual_id()`) o null. `registrar_contacto_desconocido(p_tipo, p_identificador)` — service role, upsert sobre `contactos_desconocidos`; devuelve `true` solo en la llamada que marca `respondido_en`.

**`contactos_desconocidos`** *(`0031`, sección 4)*
- `tipo` + `identificador_externo` (clave primaria)
- `primer_mensaje_en`, `ultimo_mensaje_en`, `mensajes` (int)
- `respondido_en` (nullable — cuándo se mandó la única respuesta)
RLS encendido y sin políticas: solo el cliente admin. El cron diario borra las filas con `ultimo_mensaje_en` de más de 90 días (`purgeUnknownContacts`), y el número vuelve a recibir una respuesta. Es la semilla del rate limiting de la sección 10, no su implementación.

> **Decisión (sept 2026):** una cuenta puede tener WhatsApp y Telegram a la vez, con un canal de cada tipo como máximo (`unique (usuario_id, tipo)`). Las cargas de los dos canales caen en la misma cuenta.

**`mensajes`** *(solo usuarios VIP, ver sección 3)*
- `id`
- `usuario_id`
- `canal` (`whatsapp` | `telegram`)
- `direccion` (`entrante` | `saliente`)
- `texto` (una presión de *Deshacer* se guarda como `↩︎ Deshacer`; si el bot confirmó con una reacción, el saliente guarda el texto de la confirmación)
- `mensaje_id_externo` (nullable — el id del mensaje en el canal, solo en los entrantes)
- `transaccion_id` (nullable — la carga que produjo el mensaje entrante; FK compuesta con `usuario_id`, igual que en `0019`)
- `creado_en`
Índice por `usuario_id` + `creado_en`, y único parcial `(usuario_id, canal, mensaje_id_externo)` sobre los entrantes: un reintento de Meta no se guarda dos veces. Creada en la `0028`. RLS encendido y sin políticas: solo lo toca el bot con el cliente admin; la web no lo lee.

**`categorias`**
- `id`
- `usuario_id`
- `nombre`
- `orden` (int — posición manual elegida por el usuario, ver sección 9)
- `color` (nombre del color de la paleta, no el valor literal — ver sección 9)
**`transacciones`**
- `id`
- `usuario_id`
- `monto`
- `moneda`
- `fecha`
- `categoria_id`
- `descripcion`
- `tipo` (`ingreso` | `gasto` | `ahorro`)
- `es_fijo` (bool)
- `gasto_fijo_id` (nullable — si vino de un fijo recurrente)
- `estado` (`pendiente` | `confirmada`, default `confirmada` — solo las filas que inserta el cron nacen `pendiente`, ver sección 7). Existe desde la `0021`, que llenó las filas viejas con la regla de fecha anterior; índice parcial `(usuario_id, ciclo_mes) where estado = 'pendiente'`
- `ciclo_mes` (`date`, nullable — primer día del ciclo de un cargo vinculado a un fijo; `unique (movimiento_recurrente_id, ciclo_mes)` es lo que hace idempotente al cron)
- `canal` (`whatsapp` | `telegram`, nullable) + `mensaje_id_externo` (idempotencia — único por `usuario_id` + `canal` + `mensaje_id_externo`; generaliza al `wa_message_id` original, único solo por usuario y pensado solo para WhatsApp. El `usuario_id` se mantiene en la clave porque el `message_id` de Telegram es único solo dentro de un chat, no global como el `wamid` de WhatsApp: sin `usuario_id`, dos cuentas distintas podrían coincidir en el mismo id)
- `borrado_en` (timestamp nullable — borrado suave, ver sección 4)
**`gastos_fijos`**
- `id`
- `usuario_id`
- `nombre`
- `monto_actual`
- `categoria_id`
- `dia_del_mes` (`NOT NULL` desde la `0021`; un día que el mes no tiene cae en el último día de ese mes, sección 9)
- `activo` (bool)
- `orden` (int — posición manual, ver sección 9)
- `recordatorio_activo` (bool) y `dias_antes` (int, default 1) — ver sección 14.1
- `repeticiones_totales` (int, nullable — `null` es "sin final") y `repeticiones_insertadas` (int, default 0) — ver sección 7, *Recurrencias con un final*
**`presupuestos`** *(fase 1)*
- `id`
- `usuario_id`
- `categoria_id`
- `monto` (nullable — `null` es la marca explícita de "sin presupuesto en este ciclo", ver abajo)
- `periodo` (`date` — el primer día del ciclo, calculado con `rango_ciclo_usuario` desde `dia_inicio_ciclo`; para día 26, el ciclo de septiembre es `2026-08-26`)
Una fila por categoría por ciclo (`unique (usuario_id, categoria_id, periodo)`). Cuando un ciclo pasa a ser el actual y no tiene filas, marcas incluidas, se copian todas las filas del ciclo anterior más reciente que tenga alguna. Leer un ciclo futuro no escribe nada: hereda las filas del último ciclo con alguna. Editar o crear un presupuesto desde el ciclo actual escribe solo la fila del ciclo actual, así los ciclos cerrados no cambian y los siguientes heredan el monto por la copia; borrarlo escribe una marca (`monto` null) en vez de borrar la fila, para que la copia no lo traiga de vuelta. Migración `0018_presupuestos_periodo_ciclo.sql`.

> **Decisión (sept 2026):** se levanta la regla "nunca se crea una fila para un ciclo futuro", porque la proyección (sección 9) permite editar presupuestos de un ciclo futuro. Tres reglas nuevas:
> - La hoja pregunta **"solo este mes"** o **"desde este mes en adelante"**.
> - "Solo este mes" **escribe también el ciclo siguiente con el valor anterior**, para que el cambio no se arrastre por la copia.
> - Editar un ciclo futuro **materializa todas las categorías de ese ciclo**, no solo la editada. Si no, la copia ve el ciclo "con filas" y las demás categorías quedan sin presupuesto.
>
> Para el ciclo actual y los cerrados, lo de arriba sigue igual.
>
> **Implementado (`0022_presupuestos_ciclo_futuro.sql`):**
> - `periodo_presupuesto` resuelve el ciclo de una escritura. Un periodo null, actual o pasado es el ciclo en curso. Uno posterior tiene que ser el primer día de uno de los seis ciclos siguientes; si no, falla con `invalid-period`.
> - `actualizar_categoria` suma `p_periodo` y `p_alcance` (`'solo'` | `'desde'`). En un ciclo futuro el alcance es obligatorio (`invalid-scope`).
> - `copiar_presupuestos_ciclo(p_usuario_id, p_periodo)` materializa cualquier ciclo, del actual en adelante.
> - Con "solo este mes", si la categoría no tenía nada que heredar, el ciclo siguiente recibe una marca para ella.
> - Renombrar o cambiar el color desde un ciclo futuro no toca ningún presupuesto: la web reescribe la fila del ciclo actual tal como está. El demo aplica las mismas reglas en memoria (`lib/demo/demo-budgets.ts`).
**`ingresos_esperados`**
- `id`
- `usuario_id`
- `nombre`
- `monto_estimado`
- `es_variable` (bool)
- `dia_del_mes` (nullable — solo tiene sentido para los no variables: el sueldo cae un día fijo, las propinas no)
- `activo` (bool)
- `orden` (int)
El espejo de `presupuestos`: un presupuesto es un techo para una categoría de gasto, un ingreso esperado es un piso para una fuente de ingreso. Existe desde la migración `0007_ingresos_esperados.sql`; el dashboard (sección 9) todavía no lo lee.
### Categorías: dos criterios que no se mezclan
 
**"Gasto fijo" no es una categoría.** Es el booleano `es_fijo` de la transacción. Netflix es un gasto fijo *y* su categoría es `suscripciones`; el alquiler es un gasto fijo *y* su categoría es `vivienda`. Las dos cosas conviven en la misma fila y el gasto se cuenta **una sola vez**: el booleano no crea un movimiento aparte, solo marca esa transacción como recurrente.
 
Si se mezclaran —poniendo la recurrencia dentro de la categoría `suscripciones`— el primer fijo que no sea una suscripción se queda sin dónde guardar la fecha.
 
**Vivienda, no alquiler.** La categoría se llama `vivienda` y absorbe alquiler, luz, gas e internet. Con `alquiler` suelto quedan cuatro categorías de una fila cada una y la torta se llena de porciones ilegibles.
 
### Sobre subcategorías
 
Se arranca **plano**: el usuario crea las categorías que quiera y listo. Las jerarquías complican todas las consultas y los gráficos por poco beneficio real. Si más adelante hacen falta, se agrega una columna `categoria_padre_id` en la misma tabla y quedan dos niveles sin rehacer nada.
 
---
 
## 9. Dashboard
 
Estructura de la vista mensual, de arriba hacia abajo:
 
1. **Selector de mes**
2. **Margen libre** — `ingresos − ahorro − Σ max(presupuesto, gastado) − gastado sin presupuesto`. El número más grande de la pantalla: es la pregunta principal que la app tiene que contestar. Cada presupuesto funciona como un sobre: reserva su monto entero, se haya gastado o no, y lo que se gasta dentro del sobre no mueve el margen (ver *Presupuestado vs real*, más abajo).
3. **Ingresos** del mes
4. **Próximos cobros** — calendario de cuándo, no de cuánto: qué cargo recurrente ya se cobró este ciclo y cuál falta, con su día del mes; cada fila abre la definición
5. **Gastos** — una tarjeta por categoría, **con avance contra el presupuesto de cada categoría** (*"comida: 310 de 400"*)
6. **Ahorro** — cuánto se apartó este mes y acumulado
Deliberadamente **una sola lista de categorías, no un grupo de fijos aparte**. El alquiler y Netflix viven en su categoría como cualquier otro gasto; separarlos en un bloque propio volvería a contar esa plata dos veces, que es justo lo que "Próximos cobros" existe para evitar. La granularidad la da la categoría, no un segundo grupo — si no, el sistema se llena de reglas.
 
**"Próximos cobros" antes que las categorías**, siempre. Es un calendario, no una decisión: dice qué ya se cobró y qué falta, sin pedir ninguna acción. Debajo de esa tira empieza la plata sobre la que todavía se puede decidir — y ahí es donde está la atención.
 
### El móvil es la vista principal
 
No es la versión reducida del escritorio: si los gastos se cargan por WhatsApp desde el teléfono, el link del dashboard abre ahí. El escritorio es el caso secundario.
 
**Orden en móvil (una columna):**
 
1. **Selector de mes** — arriba, pero chico: un título con flechas, no una barra.
2. **Margen libre** — una tarjeta grande, sola. Es el número que la persona fue a buscar. Debajo del número, una **línea de apoyo en texto apagado con los días que faltan para el cierre del ciclo** (*"quedan 12 días de ciclo"*).
   **No lleva desglose semanal.** El semanal es la presentación de un presupuesto — se reparte lo que queda contra un techo — y el margen libre no tiene techo. Además comida y ocio ya muestran su disponible semanal: un tercer número semanal en la misma pantalla compite con esos dos y no significa lo mismo.
   **Días, no fecha.** El dato accionable es cuánto queda, no qué día cae; la fecha ya está en el selector de mes. Se calcula contra `dia_inicio_ciclo` (sección 6) y en el timezone del usuario.
3. **Ingresos · Gastos · Ahorro** — tres tarjetas chicas en fila.
4. **Próximos cobros** — tira colapsada con el próximo cargo por cobrar; al abrirla, el calendario del ciclo.
5. **Categorías** — una tarjeta por categoría, con las barras de comida y ocio.
6. **Gráficos** — torta primero, barras mes contra mes después.
**Regla de orden: lo que decide algo va arriba, lo que explica va abajo.** Los gráficos explican el pasado; el margen libre decide el presente.
 
**Por qué el selector de mes va arriba** aunque sea la zona más incómoda para el pulgar: sin él, ningún número de abajo significa nada — *"margen libre: 640"* sin saber de qué mes no es información. Y se toca poco: lo normal es entrar a ver el mes actual y no tocarlo nunca. El compromiso es dejarlo arriba pero mínimo.
 
En **escritorio** es el mismo contenido en dos columnas: números y barras a la izquierda, gráficos a la derecha.
 
### La tarjeta «Próximos cobros»: cuándo, no cuánto
 
**Los fijos viven dentro de su categoría.** El alquiler está en `vivienda`, Netflix en `suscripciones`. "Próximos cobros" no los contiene: es un **calendario derivado de esas mismas filas**, que contesta una pregunta distinta de la que responde la categoría — no cuánto se gastó, sino **qué ya se cobró este ciclo y qué falta**.
 
Colapsada muestra el título y el **próximo cargo con su día** (*"Parking · día 15"*), nunca un monto ni un total. Al abrirla, lista cada cargo del ciclo en **dos grupos**: los **ya cobrados** — atenuados y con un check — primero, y los **pendientes** después, sin ningún separador entre ambos porque el cambio de apariencia ya marca el límite. Un pie con el total comprometido del ciclo cierra la tarjeta.
 
**Cada fila es un botón que abre la hoja de la definición** — nombre, monto esperado, día, categoría, recordatorio, y desde ahí "dejar de repetir" o eliminar (sección 7). Sigue **sin fila de añadir y sin deslizar**: tocar o deslizar una fila se hace en la fila de la categoría, que sigue editando solo el cargo de este ciclo. El calendario ahora se puede abrir y editar, pero sigue siendo cuándo, no cuánto: la fila en sí no cambia — ningún monto, ningún total.

> **Implementado (add-recurring-expense-management, sept 2026):** ver la nota en la sección 7.
 
### Cómo se entiende la recurrencia sin explicarla
 
En la fila del gasto, el **día del mes en texto apagado debajo del nombre**, solo en los recurrentes (*"día 3"*). El dato mismo enseña el modelo: las filas que lo tienen vuelven todos los meses, las que no, no.
 
Es la razón por la que no hace falta tutorial ni cartel: la diferencia entre fijo y variable se lee en la fila.
 
Lo que **no** va en la fila: medio de pago y el resto de la configuración. Eso vive en la hoja de la definición, que se abre al tocar la fila en "Próximos cobros" (sección 7), no en la fila misma.
 
> **Pendiente de decidir:** el *medio de pago* (con qué tarjeta se paga cada fijo) **no está en el esquema**. Es un campo nuevo en `gastos_fijos` si se quiere.
 
### Reordenar arrastrando *(fase 3)*
 
Mantener apretado y arrastrar para reordenar, en dos niveles: las **categorías entre sí**, y los **gastos dentro de cada categoría**. El orden es manual, por usuario, y persiste (campo `orden` en `categorias` y en `gastos_fijos`).
 
Va a fase 3 porque es refinamiento visual: no cambia ningún número ni desbloquea ninguna decisión.
 
### Color por categoría
 
Cada categoría tiene un color, pero **no en la superficie de la tarjeta**. Vive en dos lugares y en los dos es el mismo: un **punto de 6-8px a la izquierda del nombre** de la categoría, y la **porción correspondiente de la torta**.
 
Consecuencia buscada: **la leyenda del gráfico sobra.** Ves la porción naranja y ya sabés que es comida, porque arriba la tarjeta tiene el mismo punto.
 
**Ámbar y rojo quedan reservados** para el estado del presupuesto (verde por debajo del 80%, ámbar entre 80 y 100, rojo por encima). Ninguna categoría puede usarlos o la señal deja de leerse como señal.
 
**La lima es marca, no semántica libre:** número héroe, mes activo y barras de progreso. Ninguna cabecera de categoría lleva punto lima.
 
**Paleta cerrada de nueve colores**, no selector libre: naranja cálido, lima, verde profundo, azul apagado, gris cálido, violeta metálico, gris oscuro, blanco y granate. Con tres colores y ocho categorías quedan porciones repetidas; con selector libre el usuario elige dos verdes indistinguibles.
 
Asignaciones con intención: **naranja → comida/supermercado** (la categoría más grande y la más mirada, y el naranja es el color del mango), **grises apagados → gastos fijos** (que se hundan en el fondo, no son decisión de hoy), **violeta metálico → suplementos**.
 
**En la base se guarda el nombre del color, no el valor literal.** Cada tema resuelve el valor. Si se guarda el hex, la categoría "blanca" se vuelve invisible en tema claro.
 
Separador fino entre porciones de la torta, para que el gris oscuro no desaparezca contra el fondo.
 
### Tarjeta por categoría: la unidad de la pantalla
 
**"Gastos fijos" y "gastos variables" son categorías, no secciones.** Alquiler, electricidad y gimnasio son gastos individuales *dentro* de una categoría. Suplementos es una tarjeta hermana al mismo nivel.
 
Cada categoría es una tarjeta con dos estados:
 
**Cerrada** — punto de color, nombre, total alineado a la derecha, chevron hacia abajo. Nada más.
 
**Abierta** — debajo de la cabecera aparecen los gastos individuales, una fila cada uno: nombre a la izquierda, monto alineado al borde derecho formando columna, fecha corta en texto apagado debajo del nombre. Filas de 48px mínimo. La tarjeta empuja el contenido de abajo, no lo tapa.
 
Las tarjetas **arrancan colapsadas**: con ocho o diez categorías abiertas la pantalla se vuelve un scroll interminable.
 
**Última fila del contenido abierto:** un `+` con "Añadir gasto", en lima apagada, visiblemente más liviano que las filas de datos — se lee como acción, no como dato. Va acá y no en la cabecera: solo aparece cuando la tarjeta está abierta, que es justo cuando querés agregar algo, y deja la cabecera limpia para el total y el chevron. Que cada tarjeta tenga el suyo es una ventaja: el gasto ya sabe a qué categoría va.
 
### Edición en el lugar
 
Con la tarjeta abierta, **se toca el monto y se edita ahí mismo**. El 90% de las correcciones son eso: el monto quedó mal.
 
- El monto **tiene que verse editable en reposo** — superficie apenas más clara que la fila y contorno redondeado suave. Sin eso nadie lo intenta.
- Al tocarlo abre el **teclado numérico** directo, sin formulario intermedio.
- **Se guarda al salir del campo, sin botón de confirmar.** Un aviso breve tipo "guardado" que desaparece solo.
- **Sin diálogo de confirmación.** Confirmar cada corrección suma un toque a la acción más frecuente de la app y no evita ningún daño: si te equivocaste, lo volvés a tocar. La confirmación se reserva para lo irreversible, como eliminar una categoría con sus gastos.
- El nombre del gasto también es editable en la fila. La fecha queda para más adelante.
- En la base es un `UPDATE` de una fila existente, la operación más barata que hay.
### Eliminar un gasto: deslizar, no botón
 
Se **desliza la fila hacia la izquierda** y aparece un panel rojo con ícono de papelera y la palabra "Eliminar", ocupando alrededor de un cuarto del ancho. La fila se desliza como superficie sólida por encima del panel, con sombra — una capa sobre otra, no dos bloques lado a lado.
 
Un botón fijo por fila llenaría la tarjeta de íconos rojos para algo que se usa poco. El gesto ya es conocido de las listas del teléfono.
 
En el código: **deslizamiento largo elimina directo** sin soltar en el botón, con aviso de deshacer abajo en vez de cartel de confirmación (el borrado es suave, así que deshacer es gratis).
 
### Menús: dónde se abren y qué llevan
 
**Regla general de ubicación:** el botón puede estar arriba, donde el ojo lo encuentra; las opciones aparecen **abajo, donde llega el pulgar**. En móvil, siempre hoja inferior. En escritorio se invierte: el menú se ancla al botón que lo abrió, porque el cursor ya está ahí.
 
**Regla de orden dentro de todo menú:** acción principal arriba, configuración en el medio, destructivo abajo y separado por divisor.
 
**Menú de categoría** — se abre con **pulsación larga sobre la cabecera** de la tarjeta:
- Cambiar color — despliega las nueve muestras **en la misma hoja**, no en una segunda; la actual marcada con anillo y tilde
- Renombrar
- Reordenar — activa el modo de arrastre y cierra la hoja
- *(divisor)*
- Eliminar categoría — rojo apagado, último, con confirmación
"Añadir gasto" **no está acá** a propósito: vive como fila `+` al final del contenido abierto.

> **Implementado (add-category-sheet, sept 2026):** el menú de acciones no se construyó como lista — cambiar color, renombrar y presupuesto son un campo cada uno, así que se armó **una sola hoja de formulario** (nombre, color y presupuesto juntos, `Guardar` único) con "Eliminar categoría" como paso de confirmación dentro de la misma hoja. Reordenar sigue sin implementarse (fase 3, ver sección "Reordenar arrastrando").
 
**Menú de fila individual:** editar monto · cambiar de categoría · *(divisor)* · eliminar.
 
**Menú global** — se abre tocando el **avatar**, arriba a la derecha:
- Bloque de cuenta: avatar grande, nombre y teléfono. Insignia de cámara en la esquina del avatar para cambiar la foto — no hace falta pantalla de perfil aparte.
- APLICACIÓN: tema (claro/oscuro/automático), idioma, moneda
- BOT DE WHATSAPP: recordatorios (toggle), gastos fijos, **modo de confirmación** (automático / siempre texto / siempre reacción, ver sección 3). **Se adapta a quien no tiene el canal:** en vez de esas opciones, lleva a la sección "WhatsApp" de ajustes (sección 4), con el estado del canal y el campo del número. Con registro abierto, el teléfono del bloque de cuenta tampoco está siempre.
- *(divisor)* Cerrar sesión
No lleva nada de la vista del mes.
 
**Idea a probar más adelante:** tocar directamente el **punto de color** de la cabecera como atajo al selector de color, sin pasar por la hoja. Queda anotado para cuando se vea si la hoja resulta cómoda o no.
 
**Riesgo asumido:** la pulsación larga no se descubre sola. Si en el uso real el menú de categoría no aparece nunca, la salida es un **botón de tres puntos verticales** en la cabecera, entre el total y el chevron, con área táctil de 48px y separación real del chevron. Queda como plan B sobre la mesa.

> **Implementado (add-category-sheet, sept 2026):** se saltó directo al plan B. El botón de opciones en la cabecera (entre el total y el chevron, 44×44px) es la **única** vía al formulario de categoría — no se implementó ningún gesto de pulsación larga. Un gesto nunca es la única ruta a una función.
 
### Modo reordenar
 
Un **modo**, no un estado permanente. Se entra desde la hoja de categoría y la pantalla cambia de aspecto: aparecen las asas de arrastre, desaparecen los montos, y arriba aparece un botón "Listo".
 
Dentro del modo, la pulsación larga ya no abre nada: se agarra y se mueve. No hay flechas de subir y bajar — se arrastra y las demás filas se corren solas.
 
**El modo cubre los dos niveles:** una tarjeta entera cambia de lugar entre las otras, y un gasto se mueve dentro de su tarjeta. Lo que **no** se permite es que un gasto salte de una tarjeta a otra: eso es cambiar de categoría y ya vive en el menú de la fila.
 
Asas siempre visibles, descartado: empujan el nombre hacia adentro y comen ancho en todas las filas, todo el tiempo, para algo que se hace una vez cada tanto. Además duplicarían el acceso a la misma función.
 
> **Implementado (add-category-reorder-mode, sept 2026):** el modo cubre **solo categorías** — el segundo nivel (mover un gasto dentro de su tarjeta) no se construyó; el estado del modo es una bandera de pantalla y el asa es un control autónomo, así que ese segundo nivel queda como una suma futura, no un rediseño. Se entra desde una fila "Reordenar" en la hoja de categoría, no con pulsación larga (mismo criterio que el menú de opciones, arriba). Dentro del modo no hay pulsación larga previa: se agarra y arrastra directo, sin esperar. El asa vive **fuera** de la tarjeta, en un carril de 44px sobre su borde final — nunca superpuesta al contenido. Cada movimiento se guarda al soltar (o con cada flecha del teclado), no al tocar "Listo": el modo nunca retiene cambios sin guardar.
 
### Tarjeta "Añadir categoría"
 
Al final de la lista, después de la última categoría. Se lee como **hueco a llenar, no como categoría**: sin punto de color, sin total, sin chevron, sin superficie sólida (el fondo se ve a través), borde punteado tenue en gris apagado, más baja que las tarjetas reales, con un `+` y el texto centrados.
 
Al tocarla sube la hoja inferior con nombre y color. En escritorio se enciende al pasar por encima; en móvil no hay hover, así que tiene que ser legible desde el principio aunque sea tenue.
 
Por qué al final y no en el menú global: crear categorías se hace al principio y después casi nunca, pero escondido no lo encuentra nadie.
 
### Tarjetas de resumen expandibles
 
Las tres tarjetas chicas (Ingresos, Gastos, Ahorro) se expanden al tocarlas, **las tres con el mismo comportamiento**. La tentación era que Gastos desplazara a la lista en vez de expandirse; se descartó: tres tarjetas idénticas con dos comportamientos distintos es el mismo botón haciendo cosas diferentes.
 
- **Ingresos** → lista de fuentes (sueldo, extras y propinas), cada una editable, con fila "Añadir ingreso" al final.
- **Ahorro** → total del mes, saldo acumulado con sparkline de los últimos 6 ciclos, barra de progreso hacia `meta_ahorro_mensual` cuando el usuario la fijó (oculta si es `null`), movimientos individuales con depósitos y retiros distinguidos, y "Añadir movimiento".
- **Gastos** → desglose por categoría, una fila por categoría con su punto de color, ordenadas de mayor a menor, y una fila "Ver todos los gastos" que desplaza suavemente a las tarjetas de abajo.
### Avatar de cuenta
 
Reemplaza el **punto verde decorativo** de la esquina superior derecha. Un punto chico no invita a que lo toques, parece indicador de estado, y el verde compite con la lima de la marca.
 
Círculo de 36px con borde fino y sutil. Muestra la **foto del usuario**, con la **inicial del nombre como respaldo** mientras no haya ninguna, para que nunca quede un hueco gris. Ni lima ni verde en el avatar ni en su borde. Tiene que leerse tocable sin competir con el número héroe de abajo.
 
**Arriba a la derecha está bien**, aunque el pulgar no llegue cómodo: al menú de cuenta se entra una vez cada mucho, y es donde todo el mundo lo busca. La regla se mantiene igual — el botón arriba, las opciones abajo: la hoja global baja desde el borde inferior.
 
**Cambiar la foto** se hace desde el bloque de cuenta de la hoja global, tocando la propia foto. Implica guardar imágenes: Supabase tiene almacenamiento en capa gratuita, pero hay que **recortar y comprimir del lado del cliente antes de subir**.
 
### Barra superior fija
 
La barra de arriba queda **pegada al viewport** mientras la página scrollea debajo. Lleva el **mes con chevrons a la izquierda y el avatar a la derecha** (más el logo).
 
Dos estados: arriba de todo es **totalmente transparente** (sin superficie, sin borde, sin sombra); una vez scrolleada se vuelve **vidrio esmerilado** — desenfoque de fondo fuerte, tinte oscuro sutil para que el texto mantenga contraste, borde inferior fino que capta luz, sombra suave, y algo más compacta. Transición suave entre los dos.
 
Si el mes sube a la barra fija, **desaparece del cuerpo de la página** — no puede quedar duplicado.
 
### Hojas inferiores: vidrio flotante
 
Todas las hojas inferiores son **paneles flotantes**, no pegados al borde: margen de 12-16px a los lados y abajo, esquinas redondeadas en los cuatro lados, asa de arrastre centrada arriba.
 
Superficie **translúcida**: el contenido de atrás se ve a través, muy desenfocado — formas y colores que se filtran como luz, ningún texto legible — con un tinte oscuro encima para que las etiquetas propias mantengan contraste. Borde fino y claro en el canto, más marcado arriba, como si captara luz. Sombra suave debajo.
 
Jerarquía de tres capas: contenido nítido al fondo, atenuado suave en el medio, panel de vidrio brillante adelante. Las etiquetas e íconos de la hoja van a opacidad completa, nunca translúcidos.
 
**Advertencia:** el vidrio esmerilado y el fondo de metal cepillado son los dos brillo y compiten. Si sale sucio, bajar la transparencia de la hoja y dejar que el desenfoque haga casi todo el trabajo.
 
### Fondo de metal cepillado
 
En ambos temas: oscuro en gunmetal casi negro, claro en aluminio o plata cálido. Brillo direccional sutil y grano. **Las tarjetas son paneles sólidos encima**, para que el texto nunca compita contra el brillo.
 
Previsto agregarle **movimiento lento más adelante**, por eso el brillo tiene que leerse direccional y continuo. Muy lento: algo que se nota si mirás fijo, no si pasás. Un fondo que se mueve visiblemente detrás de números cansa en tres días.
 
El *glow* del número héroe se cae en tema claro, donde se lee como desenfoque sucio.
 
### Barra de navegación inferior: no, por ahora
 
La app tiene **una sola pantalla** en un scroll. Una barra inferior sirve para saltar entre tres o cuatro secciones; con los dos destinos candidatos (modo asesor e historial comparativo, que todavía no existe) no se arma. Queda para fase 3, cuando se sepa qué falta de verdad.
 
### Paleta confirmada
 
Tema oscuro: fondo `#0D100D`, superficie `#171A17`, borde `#262A26`, texto `#F2F5F2`, apagado `#8A918A`. Tema claro: fondo `#FAFBFA`, superficie `#FFFFFF`, borde `#E6E9E6`.
 
Acentos: **lima `#C3E86B`** (marca), **ámbar `#F0B429`** y **rojo `#E5484D`** (solo estado de presupuesto).
 
El logo del mango es naranja y verde, lo que valida la paleta. Se descartó el gradiente de las referencias: en una tarjeta de saldo suelta funciona, pero acá el número héroe compite con seis bloques debajo y pierde legibilidad.
 
### Herramienta de diseño
 
El prototipo se arma en **Stitch** (Google Labs, gratis) en modo **Thinking/Experimental**, que es el único que acepta imágenes de referencia. Exporta solo HTML/CSS, lo cual no importa: el plan es rehacerlo en React con v0.
 
Notas de uso: genera **una pantalla por vez**; conviene pedir cambios *in place* ("modify the existing screen, do not regenerate") y aun así revisar que no haya reinterpretado cosas de abajo. Cada generación queda en el historial de la pantalla, así que se puede volver atrás. Los comportamientos dinámicos (barra fija, transiciones) no se ven en una imagen quieta: hay que pedir explícitamente el estado ya scrolleado.
 
### Cabecera del mes — los cuatro números
 
Arriba de todo, antes de cualquier gráfico, van **cuatro tarjetas**:
 
| Tarjeta | Comportamiento durante el mes | De dónde sale |
|---|---|---|
| **Ingresos** | **Fijo** — se sabe desde el día 1 | Suma de transacciones `tipo = ingreso` |
| **Ahorro** | **Fijo** — se aparta a principio de mes | Suma de `tipo = ahorro` |
| **Gastos totales** | **Sube** con cada carga | Suma de `tipo = gasto` (fijos + variables) |
| **Margen libre** | **Baja** al reservar un presupuesto o con un gasto que ningún sobre cubre | `ingresos − ahorro − Σ max(presupuesto, gastado) − gastado sin presupuesto` |
 
Los dos últimos **ya no se mueven juntos**. Gastos totales sube con cada carga. El margen libre ya descontó desde el día 1 el monto entero de cada presupuesto y cada fijo del ciclo a su monto esperado, así que un gasto dentro de su sobre no lo toca; solo baja con un gasto en una categoría sin presupuesto, o con lo que un gasto pasa del presupuesto de su categoría. No es información duplicada — uno responde *"cuánto llevo gastado"* (pasado) y el otro *"cuánto me queda sin romper ningún sobre"* (futuro), y la segunda es la pregunta que motiva la app.
 
---
 
### Seguimiento contra presupuesto
 
Esta es **la funcionalidad central del dashboard**. Se calcula por categoría y tiene dos niveles: uno simple (*¿me pasé?*) y uno de ritmo (*¿voy a pasarme?*). El segundo es el que realmente sirve.
 
#### Nivel 1 — Consumo
 
Cuánto se lleva gastado del presupuesto de la categoría.
 
```
consumo = gastado / presupuestado
```
 
Ejemplo: comida, 310 gastados de 400 presupuestados → **consumo 77 %**.
 
Se muestra como barra de progreso con el texto `310 de 400`. Color por umbral:
 
| Consumo | Color |
|---|---|
| 0 – 80 % | Verde |
| 80 – 100 % | Ámbar |
| > 100 % | Rojo |
 
#### Nivel 2 — Ritmo (la fórmula que importa)
 
El consumo solo no dice nada sin saber **en qué punto del mes estás**. Gastar el 77 % del presupuesto de comida es perfecto el día 24 y es un problema el día 10.
 
Entonces se calcula qué proporción del mes transcurrió:
 
```
avance_mes = dia_actual / dias_del_mes
ritmo = consumo / avance_mes
```
 
**Ejemplo:** día 10 de un mes de 30 días, comida 310 de 400.
 
```
consumo    = 310 / 400 = 0,775   (77,5 %)
avance_mes = 10 / 30   = 0,333   (33,3 %)
ritmo      = 0,775 / 0,333 = 2,32
```
 
**Ritmo 2,32 → vas al 232 % del ritmo sostenible.** A esa velocidad, el presupuesto de comida se termina el día 13 y quedan 17 días de mes.
 
Interpretación del número:
 
| Ritmo | Significado | Señal |
|---|---|---|
| < 0,9 | Vas por debajo, sobra margen | Verde |
| 0,9 – 1,1 | En ritmo, llegás justo a fin de mes | Verde |
| 1,1 – 1,5 | Vas adelantado, ajustable | Ámbar |
| > 1,5 | A esta velocidad te pasás claramente | Rojo |
 
**Por qué el ritmo y no solo el consumo:** el consumo avisa cuando ya es tarde — cuando la barra está en rojo, la plata ya se gastó. El ritmo avisa el día 10, cuando todavía se puede corregir. Es la diferencia entre un registro y una herramienta.
 
**El ritmo no se muestra como número.** En pantalla van el consumo (*"310 de 400"*) y el disponible semanal (*"37 por semana"*), que es lo que cambia una decisión. El ritmo queda por debajo: decide el color de la barra y alimenta la respuesta del bot cuando se le pregunta *"¿cómo vengo?"*. Es el mismo cálculo visto de otro lado — si el disponible semanal es menor que lo que se viene gastando por semana, el ritmo es mayor a 1.
 
#### Proyección: el número accionable es **semanal**
 
Del ritmo sale directo lo más útil, pero **no en euros por día**: por día los números son tan chicos que no se pueden planificar (*"te quedan 5,29"* no cambia ninguna decisión). **Por semana sí** — con 40 se decide si se sale el sábado o se cocina en casa.
 
```
proyeccion         = gastado / avance_mes
disponible_semanal = ((presupuestado − gastado) / dias_restantes) × 7
```
 
Con el ejemplo (día 10, comida 310 de 400): proyección **930** contra un presupuesto de 400, y quedan **37 por semana** para los 17 días restantes.
 
> **El presupuesto sigue siendo mensual.** Lo semanal es solo la *presentación*: se reparte lo que queda entre los días que faltan y se expresa en tramos de 7 días. No hay presupuestos semanales en la base, ni semanas que "se cierren".
 
Si quedan menos de 7 días, se vuelve al total: *"te quedan 22 para los últimos 4 días"*.
 
#### Alcance: qué se sigue y qué no
 
En la práctica solo **dos categorías** llevan presupuesto — **comida** y **ocio** — más el margen libre, que funciona distinto:
 
| | Tiene techo | Se le calcula ritmo | Qué contesta el bot |
|---|---|---|---|
| **Comida** | Sí | Sí | *"Llevás 310 de 400. Te quedan 37 por semana."* |
| **Ocio** | Sí | Sí | *"Llevás 90 de 120. Vas adelantado, te quedan 12 por semana."* |
| **Margen libre** | **No** | **No** | *"Te quedan 640 libres este mes."* |
 
**El margen libre no tiene ritmo y es a propósito.** No es un presupuesto: es lo que queda de los ingresos después del ahorro, los sobres de cada presupuesto (o lo gastado, si lo pasó) y lo gastado en categorías sin presupuesto, fijos incluidos en ambos casos. No hay techo que romper — hay más o hay menos. Ponerle una barra de progreso sería inventarle un límite que no existe.
 
Son **tres preguntas distintas** que se le hacen al bot por separado: *cómo voy de comida*, *cómo voy de ocio*, *cuánto me queda libre*. Las dos primeras responden con ritmo y disponible semanal; la tercera, con un número a secas.
 
Las demás categorías (supermercado, transporte, salud) se registran y se ven en la torta, pero **sin techo ni seguimiento**. Se puede agregar presupuesto a cualquiera más adelante: la tabla lo soporta, es solo una fila.
 
#### Detalles de implementación
 
- **El día del mes se calcula en el timezone del usuario**, no en UTC (ver sección 6). Un desfase de un día distorsiona el ritmo, sobre todo a principio de mes.
- **Los primeros 2–3 días del mes el ritmo es inestable**: con `avance_mes` cercano a cero, cualquier gasto lo dispara a valores absurdos. Solución: no mostrar el ritmo antes del día 4, solo el consumo.
- **Los gastos fijos quedan fuera de este cálculo, no de la barra.** Ya están comprometidos y no tienen ritmo — se pagan una vez y listo. Un cobro recurrente en una categoría con presupuesto sí cuenta contra el presupuesto: la barra y *"gastado de presupuesto"* muestran el total, fijos incluidos (*"suplementos: 45 de 80"*), y el color de la barra sale de ese consumo. Entra al margen libre una sola vez, dentro del sobre de su categoría. El seguimiento de ritmo aplica solo a **categorías con presupuesto**.
- **Categorías sin presupuesto asignado** muestran solo el total gastado, sin barra ni ritmo.
- Todo esto vive en la **capa de datos compartida** (sección 3): la misma función alimenta la barra de progreso de la web y la frase que el **bot de WhatsApp** devuelve cuando se le pregunta *"¿cómo vengo?"*. Se calcula una vez, se presenta de dos formas.
### Gráficos
 
1. **Torta por categoría** del mes actual.
2. **Barras mes contra mes** para ver la evolución.
Con esas dos alcanza para el 90% de las preguntas.
 
### Tema claro y oscuro
 
**Requisito, no extra.** El toggle claro/oscuro se implementa desde el principio: shadcn/ui ya lo trae resuelto por variables CSS, así que agregarlo después cuesta más que hacerlo bien de entrada.
 
Consecuencia de diseño: **ningún asset puede depender de fondo blanco**. El logo se genera sin blanco estructural y con fondo transparente, y la paleta (naranja vibrante + verde profundo) se define en tokens que funcionan sobre ambos fondos.

**Elección.** El menú de cuenta ofrece claro / oscuro / automático y la elección vive en el navegador (`localStorage.theme`; `data-theme` en `<html>`, que un script inline del layout pone antes del primer pintado). Un navegador sin elección es **oscuro**, salvo en el onboarding (`add-web-onboarding`): ahí un control flotante de cristal arriba a la derecha (`components/molecules/theme-pill.tsx`) muestra las tres opciones en todas las pantallas, aparece "automático" seleccionado, la página sigue al sistema desde el primer frame (el script no pone atributo en `/onboarding` sin elección guardada) y esa elección se guarda, así el dashboard después sigue al sistema en ese navegador; una elección guardada se respeta. Es el primer lugar donde se ve y se elige el tema, porque landing y login son siempre oscuras (`ForceDarkTheme`). Una sola implementación para los dos controles (`components/theme/use-theme-choice.ts`, con el círculo de la View Transitions API al cambiar).
 
### Diseño de la interfaz
 
El dashboard se prototipa en **v0.dev**, que devuelve React + Tailwind + shadcn — el mismo stack — así que el código se pega casi sin traducir. Solo se cambian los datos de prueba por los de Supabase.
 
Descartados: **Lovable** (genera su propia estructura de app y acá la arquitectura ya está definida) y **Figma** (tiempo de diseño que no se recupera en un proyecto de una sola persona).
 
### Presupuestado vs real *(fase 1)*
 
Son **dos números distintos** y el dashboard tiene que mostrarlos lado a lado, con la diferencia:
 
- **Presupuestado** → sale de la tabla `presupuestos`.
- **Real** → sale de las transacciones.
La comparación categoría por categoría es lo que dice si hubo exceso o sobró. Y el **margen real** del mes es: `ingresos − ahorro − Σ max(presupuesto, gastado) − gastado sin presupuesto`. Cada presupuesto reserva su monto entero como un sobre: lo que sobra en un sobre queda reservado hasta que cierra el ciclo y no vuelve al margen, y el exceso de una categoría nunca se compensa con lo que sobra en otra (el `max` es por categoría).
 
**Por qué va en fase 1 (revisado):** originalmente estaba en fase 3, con el argumento de que presupuestar sin historial lleva a inventar números. Ese argumento **no aplica acá**: Brian ya lleva un Excel y conoce sus montos reales. El presupuesto no es una estimación aspiracional, es un dato que ya tiene.
 
Y es el uso principal que le quiere dar a la app: **saber a principio de mes cuánta plata libre le queda**, antes de gastarla. Sin presupuestos, esa pregunta no se puede responder — solo se ve el pasado.
 
Por eso la vista del mes arranca con el **margen libre** bien arriba:
 
```
Ingresos                 2.400
− Ahorro                    300
− Vivienda                  880   (sin presupuesto: el alquiler, un fijo, cuenta entero)
− Comida                    400   (presupuesto 400, gastado 310: se reserva el sobre entero)
− Ocio                      135   (presupuesto 120, gastado 135: cuenta lo gastado)
− Suplementos                80   (presupuesto 80, un fijo de 45 todavía sin cobrar: se reserva el sobre entero)
− Resto sin presupuesto     160   (transporte, salud y suscripciones: fijos 100 + variables 60)
──────────────────────────────
= Margen libre              445
```

El día 1, con comida y ocio todavía en cero, el margen ya descuenta 400 + 120, y el alquiler y el fijo de suplementos a su monto esperado: esa plata no está libre aunque no se haya gastado ni cobrado.
 
Ese número es la respuesta a "cuánto puedo gastar este mes sin romper nada".
 
**Comida es un caso particular:** funciona como fijo en la cabeza (todos los meses se gasta) pero el monto varía. Va como **categoría con presupuesto**, no como gasto fijo — así el seguimiento es contra el techo (*"llevás 310 de 400"*), que es justamente la pregunta que importa.
 
Lo que **sí** se gana con 2–3 meses de historial es **ajustar** los presupuestos con datos en vez de con memoria. Pero eso es refinamiento, no requisito de arranque.

### Meses futuros: proyección

**Un ciclo futuro se calcula, no se guarda.** El selector de mes llega hasta 6 ciclos adelante (sección 6), y cada uno se arma con `proyectarCiclo` (sección 3):

- **Ingresos recurrentes.**
- **Fijos activos a `monto_actual`**, respetando `repeticiones_totales`: una cuota que termina deja de aparecer en el ciclo siguiente al último pago (sección 7, *Recurrencias con un final*).
- **Presupuestos heredados** del último ciclo con filas, igual que la copia (sección 8).
- **Meta de ahorro.**
- **Filas reales del ciclo**: lo que el usuario ya cargó con fecha en ese ciclo (un viaje, un ingreso extra, un depósito planeado). `mezclarProyeccion` (`lib/data/projection.ts`) las junta con los cargos: una fila vinculada a una definición para ese ciclo (`ciclo_mes`) reemplaza su cargo proyectado; una fila suelta no reemplaza nada.
- **Margen libre proyectado**, con la misma `getFreeMargin` del mes en curso: cada categoría gasta sus filas reales más sus cargos proyectados.

**Ahorro como sobre:** el ahorro de un ciclo proyectado es `max(meta, Σ movimientos reales)`. La meta juega el papel que un presupuesto juega en una categoría: un depósito planeado por debajo de la meta no cambia el margen; uno por encima lo baja por el exceso. Un retiro planeado solo deja el margen en la meta (aceptado).

**Cómo se ve:** marca visible de **"Proyección"**. Una categoría con presupuesto muestra la barra vacía, sin ritmo ni "gastado", mientras no tenga una fila real en ese ciclo: en un ciclo que no empezó no se gastó nada. Con una fila real, la barra se llena como en el ciclo en curso, con los cargos proyectados contados y el ritmo semanal sobre el ciclo entero (hoy es su primer día). El salto de barra vacía a llena es a propósito: la barra y el margen nunca dicen cosas distintas.

**Por qué:** lo valioso sale solo. Se ve que el margen **sube cuando termina una cuota o baja cuando arranca otra**, sin que nadie tenga que hacer la cuenta. Y como el cron escribe con la misma función (sección 7), lo proyectado y lo que después se inserta nunca se contradicen.

**Fecha de cada cargo:** cae en el día del ciclo que coincide con `dia_del_mes`. Un día igual o posterior al de inicio del ciclo va en el mes de inicio, uno anterior en el mes siguiente. Si ese mes no tiene el día, el cargo va al último día de ese mes: el 31 cae el 30 de septiembre, y el 30, en el ciclo del 26/2 al 25/3/2027, cae el 28 de febrero. `fechaEnCiclo` en `lib/data/projection.ts`; el cron usa la misma regla.

**Qué permite:** los cargos proyectados se ven como pendientes y no se editan, deslizan ni borran. Las filas reales sí, igual que en el ciclo en curso, y hay filas de alta de gasto, ingreso y ahorro; la hoja arranca en el primer día del ciclo y no deja salir de su rango. No se ofrece el interruptor de recurrencia: `crear_movimiento_recurrente` vincula la fila del ciclo en curso, y una recurrencia que arranca en un ciclo futuro es otra funcionalidad. Cargar una fila en un ciclo proyectado escribe solo esa fila (confirmada, sin `ciclo_mes` ni definición): ni presupuesto ni marca del cron. No hay tarjeta "Añadir categoría" ni modo reordenar, y se ocultan el gráfico de gasto mensual y el acumulado de ahorro. "Próximos cobros" lista los cargos proyectados y sigue abriendo la hoja de cada definición. Las cuotas se cuentan desde la marca del cron (sección 7), así que una cuota sale de la proyección justo después de su último pago.

`/demo` también la muestra: su ciclo de ejemplo (septiembre 2026) hace de último ciclo generado, y proyecta seis más. Lo que el visitante carga queda en memoria en el mes de su fecha, y se junta con la proyección por la misma regla.

**El cron y las filas cargadas a mano:** `generar_ciclo` inserta por definición con `on conflict (movimiento_recurrente_id, ciclo_mes) do nothing` y cuenta solo lo insertado, así que una fila suelta cargada antes queda como está, y una definición cuyo lugar ya ocupa una fila no se inserta ni se cuenta de nuevo. Lo mismo vale para los cargos pendientes que deja el onboarding web (`insertar_cargos_pendientes`, sección 8).

Los presupuestos de un ciclo futuro se pueden editar; las reglas de escritura están en la sección 8 (*presupuestos*). La hoja de la categoría pregunta "solo este mes" o "desde este mes en adelante" solo cuando cambia el presupuesto, sin opción preseleccionada, y no deja guardar hasta que se elija una.
 
---
 
## 10. Multiusuario y control de abuso
 
Son **3 usuarios en total**: Brian y dos amigos. Cada usuario se identifica por `user_id` + `telefono`.

> **Decisión (sept 2026):** el **registro web es abierto**: cualquiera puede crearse una cuenta y usar Mango sin bot. El techo de 5 destinatarios del número de prueba **aplica solo al bot**. Cada usuario se identifica por `usuarios.id`; el teléfono pasa a ser un canal (sección 8), y la cantidad de usuarios web deja de estar atada al cupo de Meta. Hoy son **cinco personas por WhatsApp**, justo el tope, elegidas a mano en el panel de Meta; el resto usa solo la web. El tope es del número de prueba, no del diseño: con número propio cualquier cuenta vincula su número desde la web (sección 4).
 
Medidas:
 
- **Registro web abierto**, sin invitación (sección 4). Abre **sin rate limiting propio** (`open-web-signup`): cualquiera puede hacer que Mango le mande un código a cualquier dirección. Lo acotan los topes de Supabase (60 s por dirección, 30 mails por hora para todo el proyecto, compartidos por entradas y registros) y el tope diario del plan de Resend (100 mails por día en el plan gratis: el techo real, poco más de tres horas del tope por hora). Esos 30 por hora son también el riesgo: quien los gaste deja a todos sin código hasta que cambie la hora. El freno es apagar *Allow new users to sign up* en el panel: la app sigue igual para las cuentas existentes y una dirección nueva vuelve a la respuesta silenciosa. El rate limiting del registro y un CAPTCHA (Turnstile o hCaptcha sobre `signInWithOtp`) van con el bloque 10.
- **WhatsApp solo para cuentas que ya existen** (sección 4): un número desconocido no puede darse de alta por chat; recibe una sola respuesta que lo manda a la web, y nada más. Con el número de prueba, además, solo los 5 destinatarios cargados en el panel de Meta reciben mensajes.
- **Rate limiting** — en base o con Upstash Redis. Cubre dos cosas: **mensajes** al bot (incluida la respuesta a números desconocidos, que también gasta cupo) y **registro** web (para que el sign-up abierto no se llene de cuentas basura).
  - **Código de acceso por mail**: Supabase ya cubre parte. La verificación (`/auth/v1/verify`) tiene 360 intentos por hora por IP, no configurable; el envío, uno cada 60 s por dirección y 30 mails por hora con el SMTP propio; y el código vence a los 600 s. Lo que falta: un **contador de intentos fallidos por dirección** (Supabase no lo tiene: un intento errado no quema el código y no hay bloqueo) y **reenviar la IP real** a Supabase. Como el pedido sale desde Vercel, la IP que ve Supabase es la de la función, no la de la persona, y todos los usuarios comparten el mismo balde de 360 por hora. Reenviar la IP (`Sb-Forwarded-For`) pide una clave secreta que el cliente del servidor, con la anon key, no usa. Las dos cosas van con este mismo ítem.
- **Validación de firma del webhook** — HMAC SHA-256 con el App Secret; sin eso, cualquiera puede pegarle al endpoint.
- **Verify token** — solo para el handshake inicial de suscripción del webhook (Meta manda un GET con `hub.challenge`).
### Volumen esperado
 
Brian carga **más de 200 gastos al mes** él solo. Con los tres usuarios, el límite de 1000 mensajes/mes del número de prueba queda justo — y cada gasto puede implicar 2 mensajes (carga + confirmación). La **confirmación progresiva** (sección 3) es la mitigación principal: pasadas las primeras 15 cargas, la confirmación deja de consumir cupo. Si aun así se ajusta, queda pasar a número propio.
 
**El techo real es el cupo, no la cantidad de usuarios.** Con cinco personas y confirmación por reacción, los 1000 mensajes alcanzan; con cinco personas y confirmación en texto, no.

Todo este cálculo es del número de prueba. Con número propio el cupo desaparece y el techo pasa a ser el costo por mensaje; la confirmación progresiva sigue siendo la mitigación (sección 3).
 
---
 
## 11. Riesgos conocidos
 
| Riesgo | Mitigación |
|---|---|
| Gemini devuelve JSON mal formado | Validación con Zod + reintento |
| Gemini inventa categorías | Mapeo estricto contra la lista existente; lo que no matchea cae en `otros` |
| `otros` se infla y esconde información | Revisión mensual en el dashboard: si pesa, falta una categoría — se crea y se reasigna |
| Mensajes ambiguos (*"gasté 50"*) | El bot repregunta antes de guardar (esto sí se pregunta: falta el dato, no la categoría) |
| Meta reintenta el webhook y duplica el gasto | Guardar `mensaje_id_externo` (antes `wa_message_id`) con constraint único por canal y chequear antes de insertar |
| Se agota el cupo de 1000 mensajes/mes (número de prueba) | Confirmación progresiva (sección 3); medir consumo desde el mes 1 |
| Pasar a número propio obliga a reescribir el bot | Nada asume el número de prueba: sin tope de 5 ni cupo de 1000 en el código, número emisor por variable de entorno, la lista de destinatarios vive en el panel de Meta (secciones 1 y 4) |
| El usuario no ve la reacción y cree que el gasto no se cargó | El umbral de 15 existe para que ya conozca el patrón. Si igual pasa, se fuerza `modo_confirmacion = texto` desde ajustes |
| Ventana de 24 h de WhatsApp | No afecta: el bot siempre **responde** a un mensaje del usuario. Solo aplicaría a los avisos proactivos de gastos fijos, que necesitarían una *template* aprobada |
| Un número desconocido le escribe al bot | Una sola respuesta que manda a la web, sin onboarding por chat; rate limiting para que no gaste cupo (sección 10) |
| Gasto de fin de mes a las 23:00 cae en el mes equivocado | Agrupar por timezone del usuario, no por UTC |
| Fijos duplicados si el job corre dos veces | Constraint único por `movimiento_recurrente_id` + `ciclo_mes`, más la marca `ciclo_generado_hasta`: la segunda corrida no inserta ni cuenta nada |
| Cold starts | Aceptables en Vercel (~100–300 ms) |
| Un usuario web espera usar WhatsApp y no puede | La sección "WhatsApp" de ajustes lo explica desde el principio: que con el número de prueba el bot llega de a pocos y por qué (sección 4). El onboarding web lo presenta como opcional |
| Registros basura con el sign-up abierto | Rate limiting sobre el registro (sección 10) |
| Registro abierto sin rate limiting (bloqueo del cupo de mails) | Hoy: 60 s por dirección, 30 mails por hora y el tope diario de Resend acotan el daño, pero quien gaste los 30 de la hora deja a todos sin código; el mensaje de "demasiados pedidos" pide esperar, y apagar el sign-up en el panel es el freno. Mails a direcciones que no los pidieron dañan la reputación de `usemango.dev`: mirar rebotes y quejas en Resend. Después: rate limiting del registro y CAPTCHA (bloque 10) |
| Auth users sin confirmar | Quien pide un código y no lo escribe deja un auth user sin fila en `usuarios` ni datos. Se acumulan hasta que haya una limpieza periódica (deuda técnica) |
| Fuerza bruta sobre el código de acceso | Hay 10⁶ códigos. Con el balde compartido de 360 verificaciones por hora, un código que vive 600 s admite unos 60 intentos: 0,006 % de acertar por código (con los 3600 s por defecto serían 360 intentos, 0,036 %). Hoy: vencimiento corto (600 s). Después: contador de intentos por dirección (en base o con Upstash) y reenvío de la IP real con clave secreta (sección 10). **La otra cara:** quien gaste las 360 verificaciones de la hora deja a todos sin poder entrar hasta que se renueve el balde; el contador por dirección y la IP real también cortan eso |
 
---
 
## 12. Demo pública
 
Una ruta **`/demo`** abierta, sin login, que monta el dashboard completo con **datos de ejemplo en memoria**. Se puede tocar todo: abrir tarjetas, editar montos, ver moverse el margen libre. No escribe en Supabase y no manda ni recibe un solo mensaje de WhatsApp.
 
**Para qué sirve, en ese orden:**
 
1. **Portfolio.** Es el motivo principal (sección 15). Un reclutador no va a registrarse ni le va a escribir a un bot: entra treinta segundos desde el link del CV y se va. Sin demo, el proyecto es un repo que nadie abre.
2. **Vidriera.** Resuelve el problema del dashboard vacío: se le puede mostrar la app a alguien con los gráficos ya poblados, sin darlo de alta ni gastar mensajes del cupo.
**Consecuencia de arquitectura — y es la parte que importa:** la **capa de datos tiene que ser intercambiable**. Los componentes reciben los datos, nunca consultan Supabase por su cuenta. La ruta real inyecta el cliente de Supabase; `/demo` inyecta un objeto fijo y guarda las ediciones en estado de React.
 
Esto hay que escribirlo así **desde el primer componente**. Hacerlo después significa desenganchar las consultas de cada tarjeta a mano, que es exactamente el trabajo tedioso que se evita decidiéndolo ahora — mismo criterio que con los archivos de traducción (sección 2).
 
**Detalles:**
 
- Mismo repo, mismo deploy, misma URL. Es una ruta más de Next, no un proyecto aparte.
- Queda **fuera de autenticación**: es el único rincón público de la app.
- Cartel chico y permanente de **"datos de ejemplo"**, para que no se lea como un fallo de carga.
- Los datos de ejemplo son un mes completo y creíble: ingresos, fijos, comida y ocio con presupuesto a mitad de camino, y algo de ahorro. Un mes vacío o con tres gastos no muestra nada.
- El botón de recarga del navegador resetea todo, y está bien: no hay nada que persistir.
---
 
## 13. Fases
 
> **Decisión (sept 2026):** las fases se alinean con `ROADMAP.md`, que las baja a bloques de tareas. Antes eran: **Fase 1 — Uso personal**: onboarding partido (nombre, país, ciclo y gasto de prueba por WhatsApp; categorías y fijos en la web), carga de gastos, confirmación progresiva, gastos fijos automáticos, tipo ahorro, presupuestos por categoría y margen libre, dashboard con selector de mes y los dos gráficos. **Fase 2 — Amigos y demo**: abrir hasta 5 usuarios (el tope del número de prueba), alta por código de invitación, rate limiting, RLS verificado, feedback real, y la ruta `/demo`. Lo que cambió: la web, el dashboard con presupuestos y margen libre, y `/demo` ya están hechos; el registro abierto (sección 4) entra en fase 2; y se suma una fase 4.

**Fase 1 — Uso personal**
**Bot** funcional (carga, confirmación progresiva, correcciones y consultas cortas), con la identidad ya separada del canal (`canales`, sección 8) antes de escribirlo; **cron de gastos fijos**; y **proyección a 6 ciclos** (sección 9). Bloques 0–7 de `ROADMAP.md`.
 
**Fase 2 — Abrir a otras personas**
**Registro abierto con código por mail** (Google pasó al bloque 13, fase 3), **onboarding web** (sección 4), **vinculación de WhatsApp desde la web** con rate limiting y RLS verificado con usuarios reales, **número propio** para la Cloud API, y **Telegram** como segundo canal (sección 3). Bloques 8–11.
 
> **La señal que se busca en fase 2:** si a los tres meses los cinco siguen cargando gastos, recién ahí tiene sentido gastar en número propio o en una estructura legal. Antes de eso, cualquier inversión es adelantarse a un dato que todavía no se tiene.

> **Decisión (sept 2026):** el número propio se adelanta de fase 4 a fase 2, y el sistema se diseña desde ahora como si ya estuviera (sección 1). La señal de arriba queda para los pagos y la estructura legal (fase 4).

> **Pendiente de decidir:** cuándo se compra el número dentro de fase 2 y cómo convive con la restricción de **coste cero** (sección 1): el número y los mensajes de plantilla se pagan.

> **Plan para el número (sept 2026):** número virtual de EE. UU. en Twilio (unos 1,15 USD por mes, con *Voice* y *SMS*), verificado en Meta por llamada de voz. Meta a veces rechaza números VoIP; si pasa, el plan B es una SIM prepago. Ese número no puede estar a la vez en la app de WhatsApp. Registrarlo en Meta es gratis, y las respuestas dentro de la ventana de 24 h también; lo que se paga son las plantillas que inicia Mango (sección 14). El nombre visible y la foto se configuran recién con este número, porque en el de prueba el nombre no se puede cambiar.
 
**Fase 3 — Refinamiento**
Alertas al acercarse al techo de una categoría, ajuste de presupuestos sugerido a partir del historial, modo asesor con más contexto, recordatorios opcionales (ver sección 14), **reordenar categorías y gastos arrastrando** (ver sección 9) y **traducción al inglés** (la estructura ya viene de fase 1, ver sección 2).

**Fase 4 — Pagos** *(solo si aparece la señal de fase 2)*
El número propio ya no está acá: pasó a fase 2 (nota arriba). **Tabla de suscripciones** colgando de `usuarios` (plan, estado, renovación), **independiente de los canales**: se paga una cuenta, no un teléfono. Integración con el proveedor de pagos y sus webhooks. Bloque 14 de `ROADMAP.md`.

> **Pendiente de decidir:** qué es gratis y qué se paga (¿la web gratis y el bot pago?), y qué pasa si alguien deja de pagar: se corta el bot, el acceso, o nada de los datos.
 
---
 
## 14. Recordatorios y mensajes proactivos
 
Todo lo que el bot manda **sin que el usuario haya escrito primero** cae fuera de la ventana de 24 h de WhatsApp y exige una **plantilla (template) aprobada por Meta**. Esto no es un detalle de implementación: condiciona qué recordatorios valen la pena.
 
Las plantillas de categoría *utility* tienen costo por mensaje (fracciones de céntimo) y además consumen del cupo de **1000 mensajes/mes** del número de prueba. Con 200+ gastos mensuales solo de Brian, el cupo importa.
 
### 14.1 · Aviso de suscripción por vencer — **sí, fase 2**
 
Idea aportada por uno de los amigos. Al cargar un gasto fijo se puede activar un recordatorio y elegir el día:
 
> *"Mañana se te cobra Netflix: 12,99."*
 
**Por qué entra:** es puntual (5–6 mensajes al mes), llega en el momento exacto en que sirve, y evita el cobro sorpresa — que es justo lo que rompe un presupuesto ajustado. Alto valor por mensaje enviado.
 
Implementación: campo `recordatorio_activo` (bool) y `dias_antes` (int, default 1) en `gastos_fijos`. El cron diario (sección 5.3 de tareas) consulta los fijos que vencen mañana y dispara la plantilla.
 
### 14.2 · Recordatorio diario de carga — **opcional, apagado por defecto**
 
Un mensaje al día del tipo *"¿tenés algún gasto para cargar?"*.
 
**Por qué queda apagado:**
 
- **Coste:** 30 mensajes/mes por usuario, 90 entre los tres. Sumado a los gastos y sus confirmaciones, es lo que hace saltar el cupo de 1000.
- **Fatiga:** es el tipo de aviso que se ignora a la semana, y un aviso ignorado entrena a ignorar todos los demás — incluido el de suscripciones, que sí importa.
**Por qué igual se construye:** una vez resuelta la infraestructura de plantillas del punto 14.1, agregarlo es un flag por usuario y una entrada más en el cron. El costo marginal es casi nulo, y así se puede **probar un mes con datos reales** en vez de decidirlo a priori.
 
Campo: `recordatorio_diario` (bool, default `false`) en `usuarios`, con hora configurable.
 
> Mismo criterio que se aplicó a los presupuestos: no descartar por intuición ni activar por defecto — construirlo, probarlo y decidir con la experiencia.
 
### 14.3 · Regla general
 
Un mensaje proactivo tiene que **cambiar una decisión**. El de suscripción la cambia (podés mover plata o cancelar). El diario no: no informa nada que el usuario no sepa. Ese es el filtro para cualquier notificación futura.
 
---
 
## 15. Por qué existe este proyecto
 
Más allá de la utilidad, es un proyecto de portfolio real dentro del pivote a desarrollo de software: base de datos, webhook, integración con un LLM y con la WhatsApp Business API, auth y deploy. Eso pesa más en una entrevista que la app en sí. Tener usuarios reales (los amigos) es la diferencia entre un ejercicio y un producto.
 
**Y la demo es lo que hace que eso se vea.** Un proyecto de portfolio detrás de un login es un repo que nadie abre: la ruta `/demo` (sección 12) es la única forma de que alguien vea el producto funcionando sin darse de alta. El enlace va en el CV y en `briansittmann.dev`.
 
