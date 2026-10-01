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

**Qué muestra:** el bot elige la categoría solo (café → Ocio). Las primeras 15 cargas se confirman con texto y un botón para deshacer; después, con una reacción ✅ en tu propio mensaje.

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

**Qué muestra:** con solo un monto, el bot pregunta la categoría y espera la respuesta 30 minutos. La respuesta a una pregunta siempre se confirma con texto y Deshacer, aunque ya hayas pasado las primeras 15 cargas.

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
