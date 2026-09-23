-- Seed — usuario Brian. Idempotente vía ON CONFLICT: correrlo de nuevo actualiza en vez de
-- duplicar.
--
-- TODO: '+353000000000' es un placeholder — reemplazar por el teléfono real de Brian en
-- formato E.164 antes de correr esto contra un proyecto real, o el bot nunca va a matchear
-- sus mensajes de WhatsApp contra este usuario.
--
-- Excluido a propósito (ver PROMPT.md, "Pendiente de confirmar"):
--   - Deuda a Sosa, 400: pago único en octubre, no es un gasto fijo. No se seedea.
-- Confirmado con Brian en esta conversación:
--   - transporte 100 es variable, no fijo: no va en gastos_fijos.
--   - monitor sigue activo como fuente de ingreso, monto todavía sin definir: se seedea con
--     monto_estimado 0 y es_variable = true; se ajusta desde el dashboard cuando se sepa.

insert into usuarios (
  telefono, nombre, pais, timezone, moneda_default, idioma, dia_inicio_ciclo, onboarding_completo
)
values (
  '+353000000000', 'Brian', 'Irlanda', 'Europe/Dublin', 'EUR', 'es', 26, true
)
on conflict (telefono) do update set
  nombre = excluded.nombre,
  pais = excluded.pais,
  timezone = excluded.timezone,
  moneda_default = excluded.moneda_default,
  idioma = excluded.idioma,
  dia_inicio_ciclo = excluded.dia_inicio_ciclo,
  onboarding_completo = excluded.onboarding_completo;

-- Categorías
insert into categorias (usuario_id, nombre, orden, color)
select (select id from usuarios where telefono = '+353000000000'), v.nombre, v.orden, v.color
from (values
  ('comida',            0,  'naranja_calido'),
  ('vivienda',          1,  'gris_oscuro'),
  ('transporte',        2,  'azul_apagado'),
  ('ocio',              3,  'verde_profundo'),
  ('salud',             4,  'violeta_metalico'),
  ('suplementos',       5,  'violeta_metalico'),
  ('cuidado personal',  6,  'gris_calido'),
  ('suscripciones',     7,  'gris_calido'),
  ('servicios',         8,  'gris_oscuro'),
  ('deudas',            9,  'granate'),
  ('otros',             10, 'gris_oscuro')
) as v(nombre, orden, color)
on conflict (usuario_id, nombre) do update set
  orden = excluded.orden,
  color = excluded.color;

-- Gastos fijos. transporte (100) queda afuera: confirmado como variable, no fijo.
-- Deuda a Sosa (400) queda afuera: pago único de octubre, no es recurrente.
insert into gastos_fijos (usuario_id, nombre, monto_actual, categoria_id, dia_del_mes, orden)
select
  (select id from usuarios where telefono = '+353000000000'),
  v.nombre,
  v.monto,
  (select id from categorias
    where usuario_id = (select id from usuarios where telefono = '+353000000000')
    and nombre = v.categoria),
  v.dia,
  v.orden
from (values
  ('alquiler',           880::numeric, 'vivienda',         null::integer, 0),
  ('préstamo',           300::numeric, 'deudas',           1,             1),
  ('obra social',        50::numeric,  'salud',            null,          2),
  ('psicóloga',          44::numeric,  'salud',            null,          3),
  ('gimnasio',           50::numeric,  'cuidado personal',  null,          4),
  ('peluquería',         50::numeric,  'cuidado personal',  null,          5),
  ('suplementos',        80::numeric,  'suplementos',      null,          6),
  ('celular',            20::numeric,  'servicios',        null,          7),
  ('Claude',             30::numeric,  'suscripciones',    null,          8),
  ('Amazon Prime',       5::numeric,   'suscripciones',    1,             9),
  ('iCloud',             9::numeric,   'suscripciones',    1,             10),
  ('Spotify',            5::numeric,   'suscripciones',    1,             11),
  ('Google + YouTube',   10::numeric,  'suscripciones',    18,            12)
) as v(nombre, monto, categoria, dia, orden)
on conflict (usuario_id, nombre) do update set
  monto_actual = excluded.monto_actual,
  categoria_id = excluded.categoria_id,
  dia_del_mes = excluded.dia_del_mes,
  orden = excluded.orden;

-- Presupuestos. Comida NO es gasto fijo (aunque en la planilla vieja figurara como tal):
-- el monto varía, lo que importa es el seguimiento contra el techo (§9).
-- periodo es el primer día del ciclo actual, como texto porque la columna todavía es text:
-- 0018 la castea a date.
insert into presupuestos (usuario_id, categoria_id, monto, periodo)
select
  (select id from usuarios where telefono = '+353000000000'),
  (select id from categorias
    where usuario_id = (select id from usuarios where telefono = '+353000000000')
    and nombre = v.categoria),
  v.monto,
  (select (c.inicio at time zone u.timezone)::date::text
    from usuarios u
    cross join lateral rango_ciclo_usuario(u.id) c
    where u.telefono = '+353000000000')
from (values
  ('comida', 250::numeric),
  ('ocio',   250::numeric)
) as v(categoria, monto)
on conflict (usuario_id, categoria_id, periodo) do update set
  monto = excluded.monto;

-- Ingresos esperados. El "real" de cada fuente sale de sumar transacciones.ingreso_esperado_id
-- dentro del ciclo (0008_transacciones.sql); acá solo se seedea el estimado.
insert into ingresos_esperados (usuario_id, nombre, monto_estimado, es_variable, dia_del_mes, orden)
select
  (select id from usuarios where telefono = '+353000000000'),
  v.nombre,
  v.monto,
  v.es_variable,
  v.dia,
  v.orden
from (values
  ('sueldo',   2400::numeric, false, 25::integer, 0),
  ('propinas', 700::numeric,  true,  null::integer, 1),
  ('monitor',  0::numeric,    true,  null::integer, 2)
) as v(nombre, monto, es_variable, dia, orden)
on conflict (usuario_id, nombre) do update set
  monto_estimado = excluded.monto_estimado,
  es_variable = excluded.es_variable,
  dia_del_mes = excluded.dia_del_mes,
  orden = excluded.orden;
