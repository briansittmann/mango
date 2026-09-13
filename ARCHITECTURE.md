# ARCHITECTURE.md — Mango

**Mango** — app de finanzas personales con dos interfaces: un bot de **WhatsApp** para cargar y consultar rápido, y una web para ver gráficos y editar en profundidad.

---

## 1. Objetivo

Registrar gastos e ingresos con la menor fricción posible (un mensaje de texto) y poder ver dónde se va la plata sin abrir una planilla.

Dos modos de uso:

- **WhatsApp** → carga rápida, consultas cortas, alta de usuario.
- **Mensajería** → WhatsApp Business API (Cloud API de Meta). Se arranca con el **número de prueba** de Meta: gratis, hasta 5 destinatarios y 1000 mensajes/mes, sin verificación de negocio. Alcanza para los 3 usuarios previstos.

> **Decisión (sept 2026):** se cambió de Telegram a WhatsApp. Motivo: Brian y sus dos amigos usan WhatsApp y ninguno usa Telegram. Telegram era técnicamente más cómodo (API más simple, botones sin límite, sin ventana de 24 h), pero la fricción de instalar otra app mataba la adopción.

- **Web** → dashboard, gráficos, edición, gestión de fijos y categorías.

Restricción transversal: **coste cero**. Todo se elige dentro de capas gratuitas.

---

## 2. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Base de datos | Postgres en Supabase | Capa gratuita, Postgres real, auth incluida |
| Backend | Next.js route handlers (TypeScript) | Mismo repo que el front, serverless en Vercel |
| Deploy | Vercel | Gratis, cold starts de ~100–300 ms |
| Mensajería | WhatsApp Business Cloud API | Es la app que ya usan los usuarios |
| Parsing de mensajes | Gemini (API online) | Capa gratuita |
| Validación | Zod | Garantiza la forma del JSON que devuelve el modelo |
| Front | React / Next.js + Tailwind | Preferencia propia |
| Gráficos | Recharts | Se integra directo con React |
| Componentes UI | shadcn/ui | Look profesional de entrada, theming incluido |
| Auth | Supabase Auth (magic link) | Sin contraseñas que mantener |
| Idiomas | next-intl (o equivalente) | Estructura desde el día uno, ver más abajo |

**Un repo, un deploy, coste cero.**

### Variables de entorno

Los **nombres** viven acá; los **valores** nunca — van a `.env.local` (ignorado por git) y al panel de Vercel. El código las lee siempre por `process.env`, nunca hardcodeadas.

| Variable | Para qué | Alcance |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase | Cliente y servidor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública; toda consulta pasa por RLS | Cliente y servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | **Saltea RLS.** Solo para el cron de fijos y escrituras del webhook | **Solo servidor** |
| `GEMINI_API_KEY` | Parser de mensajes | **Solo servidor** |
| `WHATSAPP_TOKEN` | Token permanente (System User `mango-bot`, sin expiración) para llamar a la Cloud API | **Solo servidor** |
| `WHATSAPP_PHONE_NUMBER_ID` | Identificador del número emisor; va en la URL de envío | **Solo servidor** |
| `WHATSAPP_VERIFY_TOKEN` | String arbitrario; se compara contra `hub.verify_token` en el GET de alta del webhook | **Solo servidor** |
| `WHATSAPP_APP_SECRET` | App Secret de Meta; valida el HMAC SHA-256 de `X-Hub-Signature-256` en cada POST | **Solo servidor** |

**El prefijo `NEXT_PUBLIC_` no es cosmético:** sin él la variable no llega al navegador, y con él **se embebe en el bundle público**. Por eso la `anon key` lo lleva (es pública por diseño, la protege RLS) y la `service_role` no puede llevarlo bajo ninguna circunstancia: expuesta al cliente, cualquiera lee y escribe los gastos de todos.

Las cuatro de WhatsApp se cargan en **Production, Preview y Development**. Después de tocar cualquiera hace falta **redeploy**: el deploy que ya corre conserva los valores con los que se construyó.

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

Nota sobre Java: se evaluó hacer el backend en Spring Boot (por el objetivo laboral de backend Java) y se descartó para este proyecto. Spring Boot no corre en Vercel y en capa gratuita (Render / Railway) el servidor se duerme, con cold starts de ~30 s: inviable para un bot. Java queda para un proyecto siguiente, más chico y enfocado.

---

## 3. Arquitectura

```
WhatsApp ──webhook──> /api/whatsapp ──> adaptador ──> lógica del bot
                                                          │
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

Punto clave: **una sola capa de datos, dos presentaciones**. Una función tipo `resumenMensual(userId, mes)` consulta la base y la consumen los dos frentes: el bot la renderiza como texto, la web como gráficos. No se duplica lógica.

### Flujo de carga

1. El usuario manda `30 euros disco`.
2. El webhook valida la **firma del payload** (header `X-Hub-Signature-256`, HMAC con el App Secret de Meta) y el **número de teléfono** contra los usuarios dados de alta (sección 4).
3. Gemini parsea → `{ monto: 30, moneda: "EUR", descripcion: "disco", categoria: "ocio", tipo: "gasto" }`.
4. Zod valida la forma.
5. Si la categoría no matchea ninguna existente, **se guarda en `otros`** — sin repreguntar.
6. Se guarda con el **`wa_message_id`** para evitar duplicados.

#### Sin repregunta de categoría

**Todo lo que no mapea contra una categoría existente va a `otros`.** No se pregunta y no se inventan categorías nuevas.

El motivo es el volumen: con 200+ cargas al mes, una repregunta cada tanto es fricción que se acumula y termina desalentando la carga. Y la carga es lo único que la app necesita que pase todos los días.

El control es **a posteriori**: si `otros` empieza a pesar en la torta, eso mismo es la señal de que falta una categoría. Se crea desde el dashboard y se reasignan las transacciones. Mejor una revisión mensual de 2 minutos que 200 interrupciones.

> **Nota sobre botones:** WhatsApp permite **máximo 3 reply buttons** por mensaje. Al eliminar la repregunta, el único botón que se usa en la confirmación es **Deshacer** (sección 4), así que no hay conflicto.

### Confirmación progresiva: texto primero, reacción después

El cupo del número de prueba es de **1000 mensajes/mes** y cada gasto cuesta dos: el del usuario y la confirmación del bot. Con 200+ cargas mensuales de Brian solo, la confirmación en texto es la mitad del consumo.

**Decisión:** las primeras **15 cargas de cada usuario** se confirman con mensaje de texto y botón *Deshacer*. A partir de la 16, el bot confirma **reaccionando con un emoji** al mensaje del usuario.

**Por qué reaccionar sale gratis:** una reacción no abre conversación, así que no descuenta del cupo. El consumo por gasto pasa de dos mensajes a uno.

**Por qué las primeras 15 no:** al principio el usuario no sabe si el bot entendió bien, y un emoji no dice *cuánto* ni *en qué categoría* anotó. El texto es lo que enseña el formato y genera confianza. Una vez que la persona ya vio quince veces que el parseo acierta, deja de leer la confirmación y el mensaje pasa a ser puro coste.

**Excepción, independiente del contador:** si al parser le falta un dato (*"gasté 50"*), la confirmación va **siempre en texto**. La reacción es para el camino feliz.

**Deshacer pasa a ser por texto.** La reacción es solo un emoji: no admite botones. A partir de la carga 16, corregir se hace escribiendo *"borrá eso"* o *"no, era 40"*, que ya está previsto en la sección 4 y sigue apuntando siempre a la última transacción. Cuesta un mensaje, pero solo cuando hubo un error — que es lo poco frecuente.

**Dónde vive:** en la capa que decide *cómo* responde el bot, no en la lógica. El adaptador de WhatsApp recibe el resultado de la carga y elige formato; la lógica del bot sigue sin saber nada de WhatsApp.

**Esquema:** en `usuarios`, `cargas_confirmadas` (int, default `0`) y `modo_confirmacion` (`auto` | `texto` | `reaccion`, default `auto`). `auto` aplica la regla del umbral; los otros dos la fuerzan desde ajustes.

El umbral (15) es una constante del código, no un campo: si hay que moverlo, se mueve para todos.

---

## 4. Onboarding y cuentas

### Alta por código de invitación

**Reemplaza la whitelist de teléfonos de la sección 10.** La whitelist obliga a cargar cada número a mano en la base; con cinco o diez usuarios deja de escalar, y dejar el bot abierto a cualquier número significa comerse mensajes del cupo con gente random.

**Flujo:** Brian genera un código desde el dashboard y se lo pasa a la persona. Esa persona le escribe al bot, el bot le pide el código, y si valida arranca el onboarding normal. Brian no toca nada, pero nadie entra sin invitación.

**Un solo uso.** Al validarse, el código se quema. No sirve para dos personas ni para el mismo número dos veces.

**Vence a los 7 días.** Cubre el otro caso: un código generado y nunca usado, que si no queda vivo indefinidamente.

**Un número desconocido no se ignora en silencio** — se le pide el código. Y los tres errores se distinguen en el mensaje: **no existe**, **ya fue usado**, **venció**. Si el bot contesta lo mismo en los tres casos, la persona no sabe si el problema es el código o su número, y termina escribiéndole a Brian.

**Trazabilidad:** `creada_por` guarda quién invitó a quién. Con cinco usuarios no cambia nada; si esto llega a crecer, saber por qué rama entró cada uno es la única señal real de cómo se propaga.

**Rate limiting sobre los intentos de código**, por número: sin eso, un desconocido puede probar códigos por fuerza bruta. Va junto al rate limiting de la sección 10.

**Lo que la invitación no saltea:** el número de prueba de Meta admite **5 destinatarios**, y ese límite es de Meta, no de la app. El sexto número no se puede dar de alta aunque tenga un código válido. El código empieza a rendir de verdad con número propio, donde el tope desaparece y pasa a pagarse por mensaje.

> No confundir con el **código de acceso a la web** (más abajo): ese es para entrar al dashboard de una cuenta que ya existe. Este es para crear la cuenta.

### El bot es la puerta de entrada

La cuenta se crea **desde WhatsApp**, no desde la web. Al primer mensaje, el bot da de alta al usuario **solo con el número de teléfono**: sin mail, sin contraseña, sin formulario.

Esto es deliberado. Es el momento que vende el producto: mandás un mensaje y ya quedó registrado el gasto.

### Setup partido: lo mínimo en el chat, la carga pesada en la web

Sin moneda ni categorías cargadas, Gemini no tiene contra qué mapear. Pero **el setup completo no se hace por chat**: cargar una lista de categorías y de gastos fijos a ciegas, sin ver lo que ya escribiste, es incómodo. En pantalla es una tabla y se resuelve en dos minutos.

El reparto:

| Paso | Dónde | Por qué |
|---|---|---|
| Código de invitación | **Chat** | Un mensaje, una sola vez |
| Nombre | **Chat** | Abre la conversación y el bot ya puede tratarte por el nombre |
| País → timezone + moneda | **Chat** | Una pregunta, una respuesta |
| Día de inicio de ciclo | **Chat** | Una pregunta con default (el 1) |
| Gasto de prueba | **Chat** | Es el momento que vende el producto |
| Categorías | **Web** | Lista larga, se edita mejor viéndola entera |
| Gastos fijos | **Web** | Nombre + monto + día por fila: es un formulario |

El país y la moneda quedan **editables**: hay gente que vive en un país y gasta en otra moneda.

**Por qué no todo en la web:** el usuario tiene que ver que el bot funciona *antes* de que lo mandemos a llenar un formulario. Si el primer contacto es un link, el producto todavía no demostró nada.

### Primera interacción — guion de referencia

> **Usuario:** hola
> **Mango:** Hola, soy Mango. Para empezar necesito tu código de invitación.
> **Usuario:** MNG-7K2QX4
> **Mango:** Listo. ¿Cómo te llamás?
> **Usuario:** Brian
> **Mango:** Un gusto, Brian. ¿En qué país vivís?
> **Usuario:** Irlanda
> **Mango:** Anotado: euros y hora de Dublín. ¿Qué día del mes cobrás? Si no aplica, poné 1.
> **Usuario:** 25
> **Mango:** Perfecto, tu mes va del 26 al 25. Ahora probá cargar un gasto: escribime algo como *café 3,50*.
> **Usuario:** café 3,50
> **Mango:** Anotado, 3,50 en café. Así de fácil va a ser siempre.
> **Mango:** Para terminar de configurar tus categorías y gastos fijos, entrá acá 👉 *(link con código de un solo uso)*

Siete mensajes del bot, cinco del usuario. Sin bombardeo: una pregunta por mensaje, y la siguiente no sale hasta que la anterior está respondida.

**El nombre se pregunta primero por dos motivos:** es la forma natural de abrir una conversación, y el avatar de la web usa la **inicial del nombre** como respaldo mientras no haya foto (sección 9). Sin ese dato queda un hueco gris desde el día uno.

El wizard **no se repite**. La web expone después una pantalla de ajustes para tocar lo mismo más adelante.

### Acceso a la web

El mail aparece recién cuando la persona quiere entrar al dashboard. El flujo:

1. El usuario le pide el acceso al bot.
2. El bot le manda el link a la web con un **código de un solo uso**.
3. Entra, deja su mail, y de ahí en adelante usa **magic link** de Supabase Auth.

El teléfono queda vinculado a la cuenta web. Un solo usuario, dos puertas.

### Cómo presentarlo a alguien nuevo

Siempre por el chat. Se le muestra la web **después**, cuando ya tiene 3–4 gastos cargados y los gráficos dicen algo. Un dashboard vacío no convence a nadie.

---

### Corregir y borrar transacciones

Cargar rápido implica equivocarse. La corrección tiene que ser tan barata como la carga, o el usuario deja de confiar en los totales.

#### Por chat: deshacer la última

Cada carga se confirma con un mensaje que incluye un botón **Deshacer**:

> *"Anotado: 30 en ocio — disco."*  ·  `[Deshacer]`

Como se refiere siempre a **la última transacción del usuario**, no hay ambigüedad sobre cuál se borra: no hay que identificar nada ni listar opciones. También funciona escribiendo *"borrá eso"* o *"no, era 40"* — en el segundo caso se corrige el monto en vez de borrar.

**Alcance deliberadamente corto:** por chat solo se toca la última carga. Borrar algo de hace tres días requiere ver la lista y elegir, y eso en un chat es un desastre.

#### Por web: cualquier transacción

El listado del mes permite editar y borrar cualquier fila. Es el mismo criterio de la sección 7 con los gastos fijos: **lo rápido va al chat, lo que requiere mirar va a la web.**

#### Borrado suave

No se hace `DELETE`. Se agrega a `transacciones`:

- `borrado_en` (timestamp, nullable)

Todas las consultas filtran `borrado_en IS NULL`. Motivos:

- Un bug en el bot no destruye datos de forma irreversible.
- Se puede revertir un borrado accidental.
- El `wa_message_id` sigue en la tabla, así que **un reintento del webhook no resucita** una transacción borrada como si fuera nueva.

Las filas borradas no aparecen en ningún total, gráfico ni cálculo de ritmo. Se pueden purgar de verdad con un job periódico si algún día molestan, pero con este volumen no hace falta.

---

## 5. Modo asesor

El bot detecta si el mensaje es una **carga** o una **consulta**. Si es consulta, responde de forma breve (2–3 frases) actuando como asesor financiero.

Ejemplos: *"¿qué presupuesto semanal tengo?"*, *"¿cómo vengo este mes?"*

**Regla de coste:** a Gemini se le pasa un **resumen ya agregado por SQL**, nunca las transacciones crudas. Los totales se calculan en la base. Esto mantiene los tokens bajísimos y es lo que permite sostener el coste cero.

### Consultas de gastos del mes

El bot responde el **total del mes + desglose por categoría (top 5)**. Nada más: la lista completa en chat es ilegible. Para el detalle transacción por transacción, devuelve un link a la web.

> El chat es para lo rápido. La web es para lo profundo.

---

## 6. Manejo de meses y zona horaria

**No existe un cierre de mes.** No hay proceso batch, ni estado que resetear, ni nada que "cambie" el día 1. Cada transacción tiene su fecha y el mes es simplemente un filtro en la consulta (`date_trunc('month', fecha)`).

Lo único que hay que definir bien es la **zona horaria**. Si se guarda todo en UTC y el usuario está en Dublín, un gasto de las 23:00 puede caer al día siguiente y contarse en el mes equivocado. Solución: guardar la zona horaria del usuario (derivada del país en el onboarding) y agrupar con ella, no con UTC.

En el dashboard esto se traduce en un **selector de mes** arriba de todo, para navegar a cualquier mes pasado.

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

Los fijos se **insertan automáticamente al inicio del mes**, no se cargan a mano. El bot los inserta y avisa por chat para confirmar si algo cambió. **Ojo:** ese aviso es proactivo, así que cae fuera de la ventana de 24 h de WhatsApp y requiere una *template* aprobada por Meta. Alternativa simple para fase 1: insertarlos en silencio y mostrarlos en el dashboard.

La **edición se hace en el dashboard**, no por chat: una pantalla de gastos fijos donde se cambia el monto del alquiler una vez, y el mes siguiente ya se inserta con el valor nuevo. Editar por chat es tedioso.

---

## 8. Base de datos

**`usuarios`**
- `id`
- `telefono` (E.164, ej. `+353...`) — identificador principal
- `nombre` (se pregunta en el primer mensaje del onboarding, ver sección 4)
- `email` (nullable — se completa solo si accede a la web)
- `pais`
- `timezone`
- `moneda_default`
- `onboarding_completo` (bool)
- `recordatorio_diario` (bool, default `false` — ver sección 14.2)
- `dia_inicio_ciclo` (int, default `1` — ver sección 6)
- `idioma` (`es` | `en`, derivado del país, editable — ver sección 2)
- `foto_url` (nullable — avatar; si está vacío se muestra la inicial del nombre, ver sección 9)
- `cargas_confirmadas` (int, default `0` — contador para la confirmación progresiva, ver sección 3)
- `modo_confirmacion` (`auto` | `texto` | `reaccion`, default `auto` — ver sección 3)

**`invitaciones`**
- `id`
- `codigo` (único, aleatorio, 8+ caracteres)
- `creada_por` (usuario_id)
- `usada_por` (usuario_id, nullable)
- `usada_en` (timestamp, nullable)
- `vence_en` (timestamp — creación + 7 días)

Un código está disponible si `usada_en IS NULL AND vence_en > now()`. No hace falta un booleano `activa`: sería estado duplicado que se puede desincronizar de los otros dos campos.

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
- `wa_message_id` (idempotencia — único por usuario)
- `borrado_en` (timestamp nullable — borrado suave, ver sección 4)

**`gastos_fijos`**
- `id`
- `usuario_id`
- `nombre`
- `monto_actual`
- `categoria_id`
- `dia_del_mes`
- `activo` (bool)
- `orden` (int — posición manual, ver sección 9)
- `recordatorio_activo` (bool) y `dias_antes` (int, default 1) — ver sección 14.1

**`presupuestos`** *(fase 1)*
- `id`
- `usuario_id`
- `categoria_id`
- `monto`
- `periodo`

**`ingresos_esperados`** *(fase 1)*
- `id`
- `usuario_id`
- `nombre` (`sueldo`, `propinas`, `monitor`…)
- `monto_estimado`
- `es_variable` (bool — `false` para el sueldo, `true` para propinas)
- `dia_del_mes` (nullable — solo tiene sentido en los no variables)
- `activo` (bool)
- `orden` (int)

### Categorías: dos criterios que no se mezclan

**"Gasto fijo" no es una categoría.** Es el booleano `es_fijo` de la transacción. Netflix es un gasto fijo *y* su categoría es `suscripciones`; el alquiler es un gasto fijo *y* su categoría es `vivienda`. Las dos cosas conviven en la misma fila y el gasto se cuenta **una sola vez**: el booleano no crea un movimiento aparte, solo marca esa transacción como recurrente.

Si se mezclaran —poniendo la recurrencia dentro de la categoría `suscripciones`— el primer fijo que no sea una suscripción se queda sin dónde guardar la fecha.

**Vivienda, no alquiler.** La categoría se llama `vivienda` y absorbe alquiler, luz, gas e internet. Con `alquiler` suelto quedan cuatro categorías de una fila cada una y la torta se llena de porciones ilegibles.

### Sobre subcategorías

Se arranca **plano**: el usuario crea las categorías que quiera y listo. Las jerarquías complican todas las consultas y los gráficos por poco beneficio real. Si más adelante hacen falta, se agrega una columna `categoria_padre_id` en la misma tabla y quedan dos niveles sin rehacer nada.

### Columnas agregadas al escribir las migraciones, no documentadas arriba

- **`usuarios.auth_user_id`** (uuid, nullable, referencia `auth.users`) — RLS necesita mapear `auth.uid()` a una fila de `usuarios`, y esa fila la crea el bot por teléfono antes de que exista ninguna sesión de Supabase Auth. Se completa cuando el usuario reclama acceso a la web (sección 4), desde un endpoint de servidor con `service_role`.
- **`transacciones.ciclo_mes`** (date, nullable) — soporta el constraint único `gasto_fijo_id` + mes (sección 11). El mes no es `date_trunc('month', fecha)` (sección 6), así que el dedup no se puede expresar como índice sobre `fecha` sola; el cron completa esta columna con el inicio del ciclo al insertar cada fijo del mes.
- **`transacciones.ingreso_esperado_id`** (uuid, nullable, referencia `ingresos_esperados`) — espejo de `gasto_fijo_id` para el lado de los ingresos: vincula la transacción con la fuente de la que vino, necesario para calcular `max(monto_estimado, real)` por fuente (ver *Ingresos esperados: el piso del mes*). Null en un ingreso puntual que no matchea ninguna fuente conocida, igual que un gasto sin categoría cae en `otros`.

---

## 9. Dashboard

Estructura de la vista mensual, de arriba hacia abajo:

1. **Selector de mes**
2. **Margen libre** — `ingresos − fijos − presupuestos`. El número más grande de la pantalla: es la pregunta principal que la app tiene que contestar.
3. **Ingresos** del mes
4. **Gastos fijos** — total y detalle
5. **Gastos variables** — total y detalle, **con avance contra el presupuesto de cada categoría** (*"comida: 310 de 400"*)
6. **Ahorro** — cuánto se apartó este mes y acumulado

Deliberadamente **dos grupos de gastos, no tres**. Separar "variables" de "día a día" no funciona: el supermercado y el café son ambos variables. La granularidad fina la da la categoría, no un tercer grupo — si no, el sistema se llena de reglas.

**Fijos antes que variables**, siempre. Los fijos son un bloque cerrado: ya están decididos, casi no se miran, y sirven como referencia de cuánto del mes está comprometido. Una vez que pasás ese bloque, todo lo que sigue es plata sobre la que todavía se puede decidir — y ahí es donde está la atención.

### El móvil es la vista principal

No es la versión reducida del escritorio: si los gastos se cargan por WhatsApp desde el teléfono, el link del dashboard abre ahí. El escritorio es el caso secundario.

**Orden en móvil (una columna):**

1. **Selector de mes** — arriba, pero chico: un título con flechas, no una barra.
2. **Margen libre** — una tarjeta grande, sola. Es el número que la persona fue a buscar.
3. **Ingresos · Gastos · Ahorro** — tres tarjetas chicas en fila.
4. **Gastos fijos** — total y detalle.
5. **Gastos variables** — con las barras de comida y ocio.
6. **Gráficos** — torta primero, barras mes contra mes después.

**Regla de orden: lo que decide algo va arriba, lo que explica va abajo.** Los gráficos explican el pasado; el margen libre decide el presente.

**Por qué el selector de mes va arriba** aunque sea la zona más incómoda para el pulgar: sin él, ningún número de abajo significa nada — *"margen libre: 640"* sin saber de qué mes no es información. Y se toca poco: lo normal es entrar a ver el mes actual y no tocarlo nunca. El compromiso es dejarlo arriba pero mínimo.

En **escritorio** es el mismo contenido en dos columnas: números y barras a la izquierda, gráficos a la derecha.

### Filas de gastos fijos

Cabecera del bloque con el **total al lado del título** (*"Gastos fijos · 820"*): con eso solo ya está el dato, el detalle se despliega si hace falta.

Cada fila: **nombre a la izquierda, monto alineado al borde derecho**. Los montos quedan en columna y se comparan de un vistazo.

Lo que **no** va en la fila: día del mes, recurrencia, medio de pago. Eso es configuración, no algo que se mire todos los días — vive en el detalle que se abre al tocar la fila.

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

**Menú de fila individual:** editar monto · cambiar de categoría · *(divisor)* · eliminar.

**Menú global** — se abre tocando el **avatar**, arriba a la derecha:
- Bloque de cuenta: avatar grande, nombre y teléfono. Insignia de cámara en la esquina del avatar para cambiar la foto — no hace falta pantalla de perfil aparte.
- APLICACIÓN: tema (claro/oscuro/automático), idioma, moneda
- BOT DE WHATSAPP: recordatorios (toggle), gastos fijos, **modo de confirmación** (automático / siempre texto / siempre reacción, ver sección 3)
- **Invitar a alguien** — genera un código de un solo uso y lo deja listo para compartir (ver sección 4)
- *(divisor)* Cerrar sesión

No lleva nada de la vista del mes.

**Idea a probar más adelante:** tocar directamente el **punto de color** de la cabecera como atajo al selector de color, sin pasar por la hoja. Queda anotado para cuando se vea si la hoja resulta cómoda o no.

**Riesgo asumido:** la pulsación larga no se descubre sola. Si en el uso real el menú de categoría no aparece nunca, la salida es un **botón de tres puntos verticales** en la cabecera, entre el total y el chevron, con área táctil de 48px y separación real del chevron. Queda como plan B sobre la mesa.

### Modo reordenar

Un **modo**, no un estado permanente. Se entra desde la hoja de categoría y la pantalla cambia de aspecto: aparecen las asas de arrastre, desaparecen los montos, y arriba aparece un botón "Listo".

Dentro del modo, la pulsación larga ya no abre nada: se agarra y se mueve. No hay flechas de subir y bajar — se arrastra y las demás filas se corren solas.

**El modo cubre los dos niveles:** una tarjeta entera cambia de lugar entre las otras, y un gasto se mueve dentro de su tarjeta. Lo que **no** se permite es que un gasto salte de una tarjeta a otra: eso es cambiar de categoría y ya vive en el menú de la fila.

Asas siempre visibles, descartado: empujan el nombre hacia adentro y comen ancho en todas las filas, todo el tiempo, para algo que se hace una vez cada tanto. Además duplicarían el acceso a la misma función.

### Tarjeta "Añadir categoría"

Al final de la lista, después de la última categoría. Se lee como **hueco a llenar, no como categoría**: sin punto de color, sin total, sin chevron, sin superficie sólida (el fondo se ve a través), borde punteado tenue en gris apagado, más baja que las tarjetas reales, con un `+` y el texto centrados.

Al tocarla sube la hoja inferior con nombre y color. En escritorio se enciende al pasar por encima; en móvil no hay hover, así que tiene que ser legible desde el principio aunque sea tenue.

Por qué al final y no en el menú global: crear categorías se hace al principio y después casi nunca, pero escondido no lo encuentra nadie.

### Tarjetas de resumen expandibles

Las tres tarjetas chicas (Ingresos, Gastos, Ahorro) se expanden al tocarlas, **las tres con el mismo comportamiento**. La tentación era que Gastos desplazara a la lista en vez de expandirse; se descartó: tres tarjetas idénticas con dos comportamientos distintos es el mismo botón haciendo cosas diferentes.

- **Ingresos** → lista de fuentes (sueldo, extras y propinas), cada una editable, con fila "Añadir ingreso" al final.
- **Ahorro** → total del mes, saldo acumulado, progreso hacia la meta, movimientos individuales con depósitos y retiros distinguidos, y "Añadir movimiento".
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
| **Ingresos** | **Estable** — se conoce desde el día 1 vía ingresos esperados; el real lo puede superar | `max(estimado, real)` por fuente (ver *Ingresos esperados*) |
| **Ahorro** | **Fijo** — se aparta a principio de mes | Suma de `tipo = ahorro` |
| **Gastos totales** | **Sube** con cada carga | Suma de `tipo = gasto` (fijos + variables) |
| **Margen libre** | **Baja** con cada carga | `ingresos − ahorro − fijos − presupuestos_restantes` |

Los dos últimos son **el mismo movimiento visto de dos lados**: cada gasto que suma arriba, resta abajo. No es información duplicada — uno responde *"cuánto llevo gastado"* (pasado) y el otro *"cuánto me queda"* (futuro), y la segunda es la pregunta que motiva la app.

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

**El margen libre no tiene ritmo y es a propósito.** No es un presupuesto: es el sobrante después de ingresos, ahorro, fijos y presupuestos. No hay techo que romper — hay más o hay menos. Ponerle una barra de progreso sería inventarle un límite que no existe.

Son **tres preguntas distintas** que se le hacen al bot por separado: *cómo voy de comida*, *cómo voy de ocio*, *cuánto me queda libre*. Las dos primeras responden con ritmo y disponible semanal; la tercera, con un número a secas.

Las demás categorías (supermercado, transporte, salud) se registran y se ven en la torta, pero **sin techo ni seguimiento**. Se puede agregar presupuesto a cualquiera más adelante: la tabla lo soporta, es solo una fila.

#### Detalles de implementación

- **El día del mes se calcula en el timezone del usuario**, no en UTC (ver sección 6). Un desfase de un día distorsiona el ritmo, sobre todo a principio de mes.
- **Los primeros 2–3 días del mes el ritmo es inestable**: con `avance_mes` cercano a cero, cualquier gasto lo dispara a valores absurdos. Solución: no mostrar el ritmo antes del día 4, solo el consumo.
- **Los gastos fijos quedan fuera de este cálculo.** Ya están comprometidos y no tienen ritmo — se pagan una vez y listo. El seguimiento de ritmo aplica solo a **categorías con presupuesto**.
- **Categorías sin presupuesto asignado** muestran solo el total gastado, sin barra ni ritmo.
- Todo esto vive en la **capa de datos compartida** (sección 3): la misma función alimenta la barra de progreso de la web y la frase que el **bot de WhatsApp** devuelve cuando se le pregunta *"¿cómo vengo?"*. Se calcula una vez, se presenta de dos formas.

### Gráficos

1. **Torta por categoría** del mes actual.
2. **Barras mes contra mes** para ver la evolución.

Con esas dos alcanza para el 90% de las preguntas.

### Tema claro y oscuro

**Requisito, no extra.** El toggle claro/oscuro se implementa desde el principio: shadcn/ui ya lo trae resuelto por variables CSS, así que agregarlo después cuesta más que hacerlo bien de entrada.

Consecuencia de diseño: **ningún asset puede depender de fondo blanco**. El logo se genera sin blanco estructural y con fondo transparente, y la paleta (naranja vibrante + verde profundo) se define en tokens que funcionan sobre ambos fondos.

### Diseño de la interfaz

El dashboard se prototipa en **v0.dev**, que devuelve React + Tailwind + shadcn — el mismo stack — así que el código se pega casi sin traducir. Solo se cambian los datos de prueba por los de Supabase.

Descartados: **Lovable** (genera su propia estructura de app y acá la arquitectura ya está definida) y **Figma** (tiempo de diseño que no se recupera en un proyecto de una sola persona).

### Ingresos esperados: el piso del mes

**El espejo del presupuesto.** El presupuesto es un *techo* para una categoría de gasto; el ingreso esperado es un **piso** para una fuente de ingreso. Misma idea, signo opuesto.

El problema que resuelve: **las propinas varían, pero no arrancan de cero.** Brian sabe que como mínimo entran ~700 al mes, aunque el número exacto no se conozca hasta fin de ciclo. Si el margen libre espera a que las propinas estén cargadas, el día 3 dice que hay 700 menos de los que realmente va a haber, y no sirve para decidir nada.

**Regla de cálculo, por fuente:**

```
ingreso_computado = max(monto_estimado, real_cargado_en_el_ciclo)
```

- **Mientras el real no llega**, manda la estimación: el margen no se desploma a principio de mes.
- **Cuando el real la supera**, manda el real: el excedente aparece como margen extra, que es exactamente lo que es.
- **Nunca se suman las dos.** El estimado no es una transacción: no existe en `transacciones`, no aparece en la torta y no ensucia ningún total.

**Conservador a propósito.** Se estima el **mínimo razonable**, no el promedio ni el mejor mes. Estimar de más es gastar plata que todavía no llegó, y ese es justo el error que la app tiene que evitar.

**El cierre del ciclo es lo que lo hace útil.** Al terminar el mes queda `estimado` contra `real` por fuente: *"pusiste 700 de propinas, entraron 840"*. Con dos o tres ciclos, el número se ajusta con datos en vez de con memoria — mismo criterio que con los presupuestos.

**El sueldo también vive acá**, con `es_variable = false`. Es la misma tabla y simplifica el cálculo: no hay dos caminos según el tipo de ingreso, hay uno solo donde el sueldo es el caso fácil (estimado y real coinciden siempre).

**Dónde se ve:** la tarjeta de **Ingresos** muestra el real, y debajo, en texto apagado, la referencia al esperado (*"700 de 700 estimados"*). Se edita desde la misma tarjeta expandida, junto a la lista de fuentes (§9).

### Presupuestado vs real *(fase 1)*


Son **dos números distintos** y el dashboard tiene que mostrarlos lado a lado, con la diferencia:

- **Presupuestado** → sale de la tabla `presupuestos`.
- **Real** → sale de las transacciones.

La comparación categoría por categoría es lo que dice si hubo exceso o sobró. Y el **margen real** del mes es: `ingresos − fijos − presupuestos`.

**Por qué va en fase 1 (revisado):** originalmente estaba en fase 3, con el argumento de que presupuestar sin historial lleva a inventar números. Ese argumento **no aplica acá**: Brian ya lleva un Excel y conoce sus montos reales. El presupuesto no es una estimación aspiracional, es un dato que ya tiene.

Y es el uso principal que le quiere dar a la app: **saber a principio de mes cuánta plata libre le queda**, antes de gastarla. Sin presupuestos, esa pregunta no se puede responder — solo se ve el pasado.

Por eso la vista del mes arranca con el **margen libre** bien arriba:

```
Ingresos            2.400
− Gastos fijos        980   (alquiler, gym, barbería, servicios)
− Presupuestos        520   (comida 400, ocio 120)
─────────────────────────
= Margen libre        900
```

Ese número es la respuesta a "cuánto puedo gastar este mes sin romper nada".

**Comida es un caso particular:** funciona como fijo en la cabeza (todos los meses se gasta) pero el monto varía. Va como **categoría con presupuesto**, no como gasto fijo — así el seguimiento es contra el techo (*"llevás 310 de 400"*), que es justamente la pregunta que importa.

Lo que **sí** se gana con 2–3 meses de historial es **ajustar** los presupuestos con datos en vez de con memoria. Pero eso es refinamiento, no requisito de arranque.

---

## 10. Multiusuario y control de abuso

Son **3 usuarios en total**: Brian y dos amigos. Cada usuario se identifica por `user_id` + `telefono`.

Medidas:

- **Alta por código de invitación** (sección 4) — un número desconocido no puede darse de alta solo. Reemplaza a la whitelist de teléfonos, que obligaba a cargar cada número a mano. Además, el número de prueba de Meta ya limita a 5 destinatarios.
- **Rate limiting** — en base o con Upstash Redis. Incluye los **intentos de código de invitación** por número, para cortar la fuerza bruta.
- **Validación de firma del webhook** — HMAC SHA-256 con el App Secret; sin eso, cualquiera puede pegarle al endpoint.
- **Verify token** — solo para el handshake inicial de suscripción del webhook (Meta manda un GET con `hub.challenge`).

### Volumen esperado

Brian carga **más de 200 gastos al mes** él solo. Con los tres usuarios, el límite de 1000 mensajes/mes del número de prueba queda justo — y cada gasto puede implicar 2 mensajes (carga + confirmación). La **confirmación progresiva** (sección 3) es la mitigación principal: pasadas las primeras 15 cargas, la confirmación deja de consumir cupo. Si aun así se ajusta, queda pasar a número propio.

**El techo real es el cupo, no la cantidad de usuarios.** Con cinco personas y confirmación por reacción, los 1000 mensajes alcanzan; con cinco personas y confirmación en texto, no.

---

## 11. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Gemini devuelve JSON mal formado | Validación con Zod + reintento |
| Gemini inventa categorías | Mapeo estricto contra la lista existente; lo que no matchea cae en `otros` |
| `otros` se infla y esconde información | Revisión mensual en el dashboard: si pesa, falta una categoría — se crea y se reasigna |
| Mensajes ambiguos (*"gasté 50"*) | El bot repregunta antes de guardar (esto sí se pregunta: falta el dato, no la categoría) |
| Meta reintenta el webhook y duplica el gasto | Guardar `wa_message_id` con constraint único y chequear antes de insertar |
| Se agota el cupo de 1000 mensajes/mes | Confirmación progresiva (sección 3); medir consumo desde el mes 1 |
| El usuario no ve la reacción y cree que el gasto no se cargó | El umbral de 15 existe para que ya conozca el patrón. Si igual pasa, se fuerza `modo_confirmacion = texto` desde ajustes |
| Un código de invitación se filtra | Un solo uso + vencimiento a 7 días + rate limiting de intentos por número |
| Ventana de 24 h de WhatsApp | No afecta: el bot siempre **responde** a un mensaje del usuario. Solo aplicaría a los avisos proactivos de gastos fijos, que necesitarían una *template* aprobada |
| Usuario sin onboarding manda un gasto | Interceptar y disparar el wizard antes de parsear |
| Gasto de fin de mes a las 23:00 cae en el mes equivocado | Agrupar por timezone del usuario, no por UTC |
| Fijos duplicados si el job corre dos veces | Constraint único por `gasto_fijo_id` + mes |
| Cold starts | Aceptables en Vercel (~100–300 ms) |

---

## 12. Demo pública

Una ruta **`/demo`** abierta, sin login, que monta el dashboard completo con **datos de ejemplo en memoria**. Se puede tocar todo: abrir tarjetas, editar montos, ver moverse el margen libre. No escribe en Supabase y no manda ni recibe un solo mensaje de WhatsApp.

**Para qué sirve, en ese orden:**

1. **Portfolio.** Es el motivo principal (sección 15). Un reclutador no va a pedir un código de invitación ni le va a escribir a un bot: entra treinta segundos desde el link del CV y se va. Sin demo, el proyecto es un repo que nadie abre.
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

**Fase 1 — Uso personal**
Onboarding partido (nombre, país, ciclo y gasto de prueba por WhatsApp; categorías y fijos en la web), carga de gastos, **confirmación progresiva** (sección 3), gastos fijos automáticos, tipo ahorro, **presupuestos por categoría, ingresos esperados y margen libre**, dashboard con selector de mes y los dos gráficos.

**Fase 2 — Amigos y demo**
Abrir hasta 5 usuarios (el tope del número de prueba). **Alta por código de invitación**, rate limiting, RLS verificado, feedback real. Y la **ruta `/demo`** (sección 12), que a esta altura ya es publicable y es lo que se manda en las postulaciones.

> **La señal que se busca en fase 2:** si a los tres meses los cinco siguen cargando gastos, recién ahí tiene sentido gastar en número propio o en una estructura legal. Antes de eso, cualquier inversión es adelantarse a un dato que todavía no se tiene.

**Fase 3 — Refinamiento**
Alertas al acercarse al techo de una categoría, ajuste de presupuestos sugerido a partir del historial, modo asesor con más contexto, recordatorios opcionales (ver sección 14), **reordenar categorías y gastos arrastrando** (ver sección 9) y **traducción al inglés** (la estructura ya viene de fase 1, ver sección 2).

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
