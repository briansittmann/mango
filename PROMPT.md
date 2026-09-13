# PROMPT.md — Migraciones y seed de Mango

> Archivo de instrucción para **Claude Code**. Pegá el bloque de abajo, o simplemente pedile que lea este archivo.

---

## Instrucción

Leé `ARCHITECTURE.md`, sobre todo la **sección 8 (Base de datos)**, y escribí las migraciones SQL para Supabase.

**Alcance:**

1. **Todas las tablas del esquema**, con tipos, claves primarias y foráneas, defaults y constraints:
   `usuarios`, `invitaciones`, `categorias`, `transacciones`, `gastos_fijos`, `presupuestos`, `ingresos_esperados`.
2. **Constraints que el documento pide explícitamente:**
   - `wa_message_id` único por usuario (idempotencia del webhook, §3).
   - único por `gasto_fijo_id` + mes, para que el cron no duplique fijos (§11).
   - `tipo` restringido a `ingreso` | `gasto` | `ahorro` (§7).
   - `modo_confirmacion` restringido a `auto` | `texto` | `reaccion` (§3).
   - `borrado_en` nullable: **el borrado es suave, nunca `DELETE`** (§4).
3. **Row Level Security activada en todas las tablas**, con políticas para que cada usuario acceda solo a sus propias filas. La `service_role` es la única que las saltea (cron de fijos y escrituras del webhook).
4. **Función del ciclo de facturación** (§6): el mes no es `date_trunc('month', fecha)` sino un rango calculado a partir de `dia_inicio_ciclo`, en el timezone del usuario.
5. **Seed** con los datos de más abajo.

**Formato:** archivos de migración numerados y ordenados, pensados para pegar en el *SQL Editor* de Supabase. Cada uno idempotente si es posible.

---

## Datos del seed — usuario Brian

```
pais              Irlanda
timezone          Europe/Dublin
moneda_default    EUR
idioma            es
dia_inicio_ciclo  26        ← cobra el 25; el ciclo va del 26 al 25
```

### Categorías

| Categoría | Color (nombre de la paleta, §9) |
|---|---|
| `comida` | naranja cálido |
| `vivienda` | gris oscuro |
| `transporte` | azul apagado |
| `ocio` | verde profundo |
| `salud` | violeta metálico |
| `suplementos` | violeta metálico |
| `cuidado personal` | gris cálido |
| `suscripciones` | gris cálido |
| `servicios` | gris oscuro |
| `deudas` | granate |
| `otros` | gris oscuro |

> `vivienda` absorbe alquiler, luz, gas e internet (§8). **Ámbar y rojo no se usan en categorías**: quedan reservados al estado del presupuesto. La lima tampoco: es color de marca.

### Gastos fijos

| Nombre | Monto | Categoría | Día |
|---|---|---|---|
| alquiler | 880 | `vivienda` | — |
| préstamo | 300 | `deudas` | 1 |
| obra social | 50 | `salud` | — |
| psicóloga | 44 | `salud` | — |
| gimnasio | 50 | `cuidado personal` | — |
| peluquería | 50 | `cuidado personal` | — |
| suplementos | 80 | `suplementos` | — |
| celular | 20 | `servicios` | — |
| Claude | 30 | `suscripciones` | — |
| Amazon Prime | 5 | `suscripciones` | 1 |
| iCloud | 9 | `suscripciones` | 1 |
| Spotify | 5 | `suscripciones` | 1 |
| Google + YouTube | 10 | `suscripciones` | 18 |

Los días que faltan quedan **nullable**: se cargan después desde el dashboard. No los inventes.

### Presupuestos

| Categoría | Monto |
|---|---|
| `comida` | 250 |
| `ocio` | 250 |

> **Comida no es un gasto fijo**, aunque en la planilla vieja figurara como tal: el monto varía y lo que importa es el seguimiento contra el techo (§9).

### Ingresos esperados

| Nombre | Estimado | Variable | Día |
|---|---|---|---|
| sueldo | 2400 | no | 25 |
| propinas | 700 | sí | — |

> Las propinas varían pero no arrancan de cero: 700 es el **piso conservador**. La regla de cálculo es `max(estimado, real)` por fuente, nunca la suma (ver *Ingresos esperados* en §9).

---

## Pendiente de confirmar — preguntar antes de seedear

- **`transporte` 100** — en la planilla estaba bajo "situacionales", no entre los fijos. Preguntar si es un gasto fijo mensual o variable. Si es variable, no va en `gastos_fijos`.
- **Deuda a Sosa, 400** — se paga **una sola vez en octubre**. Es una transacción puntual en `deudas`, **no** un gasto fijo. No seedear.
- **`monitor`** como fuente de ingreso: figura en la planilla sin monto. Preguntar si sigue activa.

---

## Entrada para el prompt del parser (más adelante, no en esta tarea)

Cuando se escriba el prompt de Gemini, estos datos son parte de la entrada:

- **La lista de categorías del usuario**, con sinónimos reales. Ejemplo de `ocio`: *date, cita, salida, birra, cerveza, cena afuera, boliche, disco*.
- **Los nombres de las fuentes de ingreso** (`sueldo`, `propinas`), porque un mensaje como `Propinas 470` tiene la misma forma que un gasto (`15 desayuno`) y sin esa lista se parsea como gasto.
- **Formatos de monto a soportar**: coma decimal (`9,45`), punto decimal (`3.20`), miles sin separador (`3000`) y sufijo `k` (`50k`, frecuente en pesos, casi nunca en euros).
- **Ruido a descartar**: medio de pago (`transf`), muletillas y palabras sueltas van a la descripción, no inventan categoría.
