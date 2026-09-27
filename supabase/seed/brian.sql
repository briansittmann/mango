-- Datos reales de Brian — ROADMAP.md, bloque 3.
--
-- Script suelto, NO es una migración: nunca corre solo. Reemplaza los datos de prueba de la
-- cuenta con login (la que abre /dashboard) por los reales: categorías, presupuestos del ciclo
-- actual, movimientos recurrentes y el cargo de este ciclo de cada uno. Además unifica la
-- cuenta: borra la fila vieja del 0012 (la del teléfono, sin login) y pasa el canal de
-- WhatsApp a esta, así la web y el bot escriben en el mismo lugar.
--
-- Cómo correrlo: reemplazar el e-mail y el teléfono de arriba, pegarlo en el SQL Editor y
-- correrlo. Borra TODAS las transacciones, categorías, presupuestos y recurrentes de la cuenta;
-- si ya tiene transacciones, se niega a correr salvo que v_reemplazar sea true. Pensado para la
-- carga inicial: después de empezar a usar la cuenta, no se vuelve a correr.
--
-- Decisiones (bloque 3, 2026-09-27):
--   - El ciclo empieza el 1 (mes calendario).
--   - "super" va a Comida: no hay categoría Supermercado. Otros existe para lo que no matchea.
--   - Cuotas: "2/3" es la que se paga en el próximo ciclo, así que 1 ya está pagada e insertada.
--     DB Bank y Cetelem arrancan en octubre: 0 insertadas y sin cargo en este ciclo.
--   - Huel cada 15 días: dos recurrentes mensuales de 45 (días 1 y 15).
--   - Sin medio de pago (sin tarjeta, por ahora).
--   - Sin meta de ahorro.

do $$
declare
  v_email text := 'brian@example.com'; -- ← reemplazar por el e-mail de la cuenta de la web
  v_telefono text := '+353000000000';  -- ← reemplazar por el teléfono de WhatsApp (E.164)
  v_reemplazar boolean := false;       -- ← true para borrar transacciones que ya existan
  v_tz text := 'Europe/Dublin';
  v_auth_id uuid;
  v_legado uuid;
  v_usuario_id uuid;
  v_dia0 date;
begin
  select id into v_auth_id from auth.users where email = v_email;
  if v_auth_id is null then
    raise exception 'No existe un usuario en auth.users con el e-mail %.', v_email;
  end if;

  -- La fila del 0012: tiene el teléfono (único) y no tiene login. Sus recurrentes y
  -- transacciones van primero, porque apuntan a categorías con on delete restrict.
  select id into v_legado from usuarios where telefono = v_telefono and auth_user_id is null;
  if v_legado is not null then
    delete from transacciones where usuario_id = v_legado;
    delete from movimientos_recurrentes where usuario_id = v_legado;
    delete from usuarios where id = v_legado;
  end if;

  insert into usuarios (
    auth_user_id, email, telefono, nombre, pais, timezone, moneda_default, idioma,
    dia_inicio_ciclo, onboarding_completo, meta_ahorro_mensual
  )
  values (v_auth_id, v_email, v_telefono, 'Brian', 'IE', v_tz, 'EUR', 'es', 1, true, null)
  on conflict (auth_user_id) do update set
    email = excluded.email,
    telefono = excluded.telefono,
    nombre = excluded.nombre,
    pais = excluded.pais,
    timezone = excluded.timezone,
    moneda_default = excluded.moneda_default,
    idioma = excluded.idioma,
    dia_inicio_ciclo = excluded.dia_inicio_ciclo,
    onboarding_completo = excluded.onboarding_completo,
    meta_ahorro_mensual = excluded.meta_ahorro_mensual
  returning id into v_usuario_id;

  if not v_reemplazar and exists (select 1 from transacciones where usuario_id = v_usuario_id) then
    raise exception 'La cuenta % ya tiene transacciones. Poné v_reemplazar := true para borrarlas.', v_email;
  end if;

  delete from transacciones where usuario_id = v_usuario_id;
  delete from presupuestos where usuario_id = v_usuario_id;
  delete from movimientos_recurrentes where usuario_id = v_usuario_id;
  delete from categorias where usuario_id = v_usuario_id;

  insert into canales (usuario_id, tipo, identificador_externo)
  values (v_usuario_id, 'whatsapp', v_telefono)
  on conflict (tipo, identificador_externo) do update set usuario_id = excluded.usuario_id;

  insert into categorias (usuario_id, nombre, color, orden)
  values
    (v_usuario_id, 'Vivienda', 'gris_oscuro', 0),
    (v_usuario_id, 'Comida', 'naranja_calido', 1),
    (v_usuario_id, 'Transporte', 'azul_apagado', 2),
    (v_usuario_id, 'Ocio', 'violeta_metalico', 3),
    (v_usuario_id, 'Salud', 'verde_profundo', 4),
    (v_usuario_id, 'Suplementos', 'verde_menta', 5),
    (v_usuario_id, 'Suscripciones', 'celeste', 6),
    (v_usuario_id, 'Deudas', 'granate', 7),
    (v_usuario_id, 'Otros', 'gris_calido', 8);

  insert into movimientos_recurrentes (
    usuario_id, nombre, tipo, categoria_id, monto_actual, dia_del_mes, activo,
    recordatorio_activo, dias_antes, repeticiones_totales, repeticiones_insertadas
  )
  select v_usuario_id, v.nombre, v.tipo, c.id, v.monto, v.dia, true, false, 1, v.totales, v.insertadas
  from (values
    ('Alquiler', 'gasto', 'Vivienda', 1000, 1, null::integer, 1),
    ('Hacienda', 'gasto', 'Deudas', 220, 7, 3, 1),
    ('Préstamo DB Bank', 'gasto', 'Deudas', 266, 6, 4, 0),
    ('Préstamo Cetelem', 'gasto', 'Deudas', 46, 1, 12, 0),
    ('Móvil', 'gasto', 'Suscripciones', 25, 1, null, 1),
    ('Prime', 'gasto', 'Suscripciones', 7, 2, null, 1),
    ('Google One', 'gasto', 'Suscripciones', 14, 10, null, 1),
    ('Lightroom', 'gasto', 'Suscripciones', 8, 12, null, 1),
    ('Netflix', 'gasto', 'Suscripciones', 15, 14, null, 1),
    ('Spotify', 'gasto', 'Suscripciones', 11, 15, null, 1),
    ('Claude', 'gasto', 'Suscripciones', 20, 16, null, 1),
    ('iCloud+ 2TB', 'gasto', 'Suscripciones', 10, 18, null, 1),
    ('Gamepass Papá', 'gasto', 'Suscripciones', 13, 14, null, 1),
    ('Gimnasio', 'gasto', 'Salud', 50, 1, null, 1),
    ('Obra social', 'gasto', 'Salud', 51, 1, null, 1),
    ('Psicóloga', 'gasto', 'Salud', 50, 1, null, 1),
    ('Barbería', 'gasto', 'Salud', 60, 4, null, 1),
    ('Huel 1/2', 'gasto', 'Suplementos', 45, 1, null, 1),
    ('Huel 2/2', 'gasto', 'Suplementos', 45, 15, null, 1),
    ('Sueldo', 'ingreso', null, 2600, 29, null, 1),
    ('Propina efectivo', 'ingreso', null, 100, 4, null, 1),
    ('Propina tarjeta 1/2', 'ingreso', null, 650, 5, null, 1),
    ('Propina tarjeta 2/2', 'ingreso', null, 650, 19, null, 1)
  ) v(nombre, tipo, categoria, monto, dia, totales, insertadas)
  left join categorias c on c.usuario_id = v_usuario_id and c.nombre = v.categoria;

  -- v_dia0 es el primer día local del ciclo actual (ya con dia_inicio_ciclo = 1).
  select (c.inicio at time zone v_tz)::date into v_dia0 from rango_ciclo_usuario(v_usuario_id, now()) c;

  insert into presupuestos (usuario_id, categoria_id, monto, periodo)
  select v_usuario_id, c.id, v.monto, v_dia0
  from (values ('Comida', 300), ('Suplementos', 100)) v(categoria, monto)
  join categorias c on c.usuario_id = v_usuario_id and c.nombre = v.categoria;

  -- El cargo de este ciclo de cada recurrente que ya cuenta una inserción, a su monto y su día,
  -- como haría el cron (que todavía no existe).
  insert into transacciones (
    usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
    movimiento_recurrente_id, ciclo_mes
  )
  select
    v_usuario_id, m.monto_actual, 'EUR',
    ((v_dia0 + (m.dia_del_mes - 1)) + time '12:00') at time zone 'UTC',
    m.categoria_id, m.nombre, m.tipo, m.tipo = 'gasto', m.id, v_dia0
  from movimientos_recurrentes m
  where m.usuario_id = v_usuario_id and m.repeticiones_insertadas > 0;
end;
$$;
