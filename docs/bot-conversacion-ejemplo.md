# Conversación de ejemplo con el bot de Mango

Charla real por WhatsApp del 1 de octubre de 2026 (ronda de prueba de `add-bot-conversation`), leída de la tabla `mensajes`. Los textos del bot están tal cual los mandó; los del usuario, tal cual se escribieron, con faltas y sin tildes. Sirve de base para un tutorial o una sección de ejemplos en la web.

> **Antes de publicarla:** los montos son los datos reales de Brian (gasto del mes, margen libre, presupuestos). Conviene cambiarlos por cifras de ejemplo.

## 1. Cargar un gasto y deshacerlo

> **Vos:** Café 3,5
>
> **Mango:** Anotado ✅ Café · 3,50 € en Ocio.  
> *[botón: Deshacer]*

> **Vos:** *(tocás Deshacer)*
>
> **Mango:** ↩️ Deshecho: 3,50 € en Ocio, hoy.

**Qué muestra:** el bot elige la categoría solo (café → Ocio). Las primeras 10 cargas de cada día se confirman con texto y un botón para deshacer; después, con una reacción ✅ en tu propio mensaje.

## 2. Un gasto con presupuesto

> **Vos:** Super 15€
>
> **Mango:** Anotado ✅ Super · 15 € en Comida. Llevás 91,02 € de 300 € este mes 🟢

**Qué muestra:** si la categoría tiene presupuesto, la confirmación dice cuánto llevás y un semáforo: 🟢 menos del 80 %, 🟡 desde el 80 %, 🔴 desde el 100 %. Son los mismos números que la barra del dashboard.

## 3. Preguntar cómo venís

> **Vos:** Como vengo ?
>
> **Mango:** 📊 Este mes llevás 2.913,02 € gastados.  
> • Vivienda: 1.000 €  
> • Deudas: 932 €  
> • Otros: 290 €  
> • Salud: 211 €  
> • Comida: 126,02 €  
> • 5 categorías más: 354 €
>
> El detalle: https://www.usemango.dev/dashboard

> **Vos:** Y el margen libre ?
>
> **Mango:** 💸 Tu margen libre este mes es de 441 €.
>
> El detalle: https://www.usemango.dev/dashboard

**Qué muestra:** dos preguntas rápidas, con los mismos números del dashboard y el link para ver el detalle. Las cinco categorías más grandes van con nombre y el resto en una línea, así todo suma el total.

## 4. Corregir y borrar lo último que cargaste

> **Vos:** Nafta 45
>
> **Mango:** Anotado ✅ Nafta · 45 € en Transporte. Llevás 65 € de 120 € este mes 🟢

> **Vos:** No, era 40
>
> **Mango:** ✏️ Corregido: 40 € en Transporte, hoy.

> **Vos:** Borra eso
>
> **Mango:** 🗑️ Borré 40 € en Transporte, hoy.

**Qué muestra:** "no, era 40" cambia el monto y "borrá eso" lo borra. Solo se toca la última carga hecha desde el chat; lo anterior se edita en la web.

## 5. Corregir la categoría con tus palabras

> **Vos:** Gaste 50 en comida
>
> **Mango:** Anotado ✅ Comida · 50 €. Llevás 141,02 € de 300 € este mes 🟢

> **Vos:** Ósea era ocio perdón
>
> **Mango:** ✏️ Corregido: 50 € en Ocio, hoy.

> **Vos:** Bórralo
>
> **Mango:** 🗑️ Borré 50 € en Ocio, hoy.

**Qué muestra:** no hace falta un formato fijo; "ósea era ocio" se entiende como una corrección de categoría.

## 6. Si no decís en qué fue, te pregunta

> **Vos:** Gaste 50
>
> **Mango:** 🤔 ¿En qué categoría va? Respondeme con una: Vivienda, Comida, Transporte, Ocio, Salud, Suplementos, Suscripciones, Deudas, Otros, Valencia.

> **Vos:** Comida
>
> **Mango:** Anotado ✅ Comida · 50 €. Llevás 126,02 € de 300 € este mes 🟢  
> *[botón: Deshacer]*

**Qué muestra:** con solo un monto, el bot pregunta la categoría y espera la respuesta 30 minutos. La respuesta a una pregunta siempre se confirma con texto y Deshacer, aunque ya hayas pasado las primeras 10 cargas del día.

## 7. Un gasto fijo que este mes vino distinto

> **Vos:** Prime 9€
>
> **Mango:** Anotado ✅ Prime · 9 € en Suscripciones.  
> 📌 Solo cambia este mes: Prime sigue en 7 €.

**Qué muestra:** el bot reconoce el gasto fijo (Prime, 7 € por mes) y completa el cobro de este mes con lo que pagaste de verdad. Los meses siguientes siguen en 7 €; para cambiar el monto fijo de ahí en adelante, se hace desde la web con "Desde este mes en adelante".

## 8. Crear una categoría

> **Vos:** Crea categoría mascota
>
> **Mango:** 🆕 Creé la categoría Mascota.

**Qué muestra:** se crea desde el mes en curso, con un color libre, y aparece en la web. Si ya existe una con el mismo nombre, el bot avisa y no crea nada. Si hay una parecida (por ejemplo "Mascotas" teniendo "Mascota"), pregunta "¿Creo Mascotas igual?" y espera un "sí".

## Lo que el bot todavía no hace

> **Vos:** Que me recomendas hacer con mi dinero ?
>
> **Mango:** 😅 No te entendí. Escribime el importe y en qué fue, por ejemplo: «súper 30» o «café 3,5 ayer».

> **Vos:** Si
>
> **Mango:** 😅 No te entendí. …

> **Vos:** Elimina categoría mascota
>
> **Mango:** 😅 No te entendí. …

Los consejos sobre la plata quedan para el modo asesor (bloque 13 de `ROADMAP.md`). Un "sí" suelto, sin una pregunta del bot pendiente, no se entiende. Las categorías se crean por chat, pero se borran desde la web.

## Notas de voz

Ronda del 11 de octubre de 2026 (`add-voice-messages`), leída de la tabla `mensajes`. Del lado del usuario figura lo que el bot transcribió de cada nota (🎤 sola cuando no hubo transcripción); los textos del bot van tal cual. Las respuestas a una foto o a un archivo de audio reenviado no se guardan en `mensajes`, por eso no están.

> **Vos:** 🎤 *café tres cincuenta*
>
> **Mango:** 🎤 Escuché: «café tres cincuenta»  
> Anotado ✅ Café · 3,50 € en Ocio.  
> *[botón: Deshacer]*

> **Vos:** 🎤 *farmacia doce con cuarenta*
>
> **Mango:** 🎤 Escuché: «farmacia doce con cuarenta»  
> Anotado ✅ Farmacia · 12,40 € en Salud.

> **Vos:** 🎤 *cobré dos mil cien*
>
> **Mango:** 🎤 Escuché: «cobré dos mil cien»  
> Anotado 💰 Ingreso · 2.100 €.

**Qué muestra:** los montos dichos con palabras se entienden ("doce con cuarenta" → 12,40). Toda respuesta a una nota empieza citando lo que se oyó, y la carga va siempre en texto con *Deshacer*, aunque ya hayan pasado las 10 primeras del día: si el bot oyó mal, se ve y se deshace en un toque.

> **Vos:** 🎤 *cómo vengo*
>
> **Mango:** 🎤 Escuché: «cómo vengo»  
> 📊 Este mes llevás 3.773,21 € gastados.  
> • Vivienda: 1.000 €  
> • Deudas: 932 €  
> • Valencia: 637,56 €  
> • Otros: 587 €  
> • Salud: 223,40 €  
> • 5 categorías más: 393,25 €  
>
> El detalle: https://www.usemango.dev/dashboard

> **Vos:** 🎤 *gasto ejemplo ponelo en categoría ocio 40 euros digo 35*
>
> **Mango:** 🎤 Escuché: «gasto ejemplo ponelo en categoría ocio 40 euros digo 35»  
> Anotado ✅ Gasto Ejemplo · 35 € en Ocio.

> **Vos:** 🎤 *no, perdón, eran 40*
>
> **Mango:** 🎤 Escuché: «no, perdón, eran 40»  
> ✏️ Corregido: 40 € en Ocio, hoy.

> **Vos:** 🎤 *borrá eso*
>
> **Mango:** 🎤 Escuché: «borrá eso»  
> 🗑️ Borré 40 € en Ocio, hoy.

**Qué muestra:** una nota puede autocorregirse a mitad ("40 euros, digo 35") y el bot se queda con lo último. Corregir y borrar por voz funcionan igual que por texto, sobre la última carga del chat.

> **Vos:** 🎤 *(nota de más de 30 segundos)*
>
> **Mango:** 🎤 Ese audio es muy largo. Mandame uno de hasta 30 segundos, o escribímelo.

> **Vos:** 🎤 *(solo ruido de fondo)*
>
> **Mango:** 🎤 No escuché nada en ese audio. Probá de nuevo o escribímelo.

**Qué muestra:** el límite es de 30 segundos y se controla antes de mandar el audio al modelo. Una nota sin palabras no se convierte en un gasto inventado.

> **Vos:** Gaste 50
>
> **Mango:** 🤔 ¿En qué categoría va? Respondeme con una: Vivienda, Comida, Transporte, Ocio, Salud, Suplementos, Suscripciones, Deudas, Otros, Valencia.

> **Vos:** 🎤 *ocio*
>
> **Mango:** 🎤 Escuché: «ocio»  
> Anotado ✅ Ocio · 50 €.

**Qué muestra:** a una pregunta del bot se le puede contestar con una nota de voz.
