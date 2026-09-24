-- Usuario de prueba — add-supabase-data-layer-and-login (design.md D15, spec test-user-seed).
--
-- Script suelto, NO es una migración: nunca corre solo. Vincula un usuario de auth.users con
-- una fila de usuarios (auth_user_id, que es lo que resuelven las políticas de RLS) y siembra
-- un ciclo actual creíble más cinco ciclos anteriores, espejo del sample de /demo.
--
-- Cómo correrlo, en orden:
--   1. Create the test auth user. Authentication → Users → *Add user* → *Create new user*:
--      the test e-mail, "Auto Confirm User" checked. The password is unused.
--   2. Run the seed. Open supabase/seed/test-user.sql, replace the placeholder e-mail at the
--      top, paste it into the SQL Editor and run it. It fails with a clear message if step 1
--      was skipped.
--
-- Correrlo dos veces deja la misma cantidad de filas: todo va con on conflict, y las
-- transacciones tienen ids fijos (a0000000-0000-4000-8000-0000000000NN), así que las filas
-- sembradas vuelven a los valores del script y las cargadas desde el dashboard no se tocan.
-- Correrlo en un ciclo posterior mueve las filas sembradas a ese ciclo.
-- Los ids fijos son globales: el script siembra un solo usuario de prueba por base.
--
-- telefono es not null y único en usuarios; un usuario que nace en la web no tiene, así que
-- se usa un placeholder con la forma válida (proposal, gap 4).

do $$
declare
  v_email text := 'test@example.com'; -- ← reemplazar por el e-mail del usuario de prueba
  v_telefono text := '+10000000001';
  v_tz text := 'Europe/Dublin';
  v_dia_inicio integer := 26;
  v_auth_id uuid;
  v_usuario_id uuid;
  v_dia0 date;
  v_mes2 date;
begin
  select id into v_auth_id from auth.users where email = v_email;
  if v_auth_id is null then
    raise exception 'No existe un usuario en auth.users con el e-mail %. Crealo primero (Authentication → Users → Add user).', v_email;
  end if;

  insert into usuarios (
    telefono, auth_user_id, email, nombre, pais, timezone, moneda_default, idioma,
    dia_inicio_ciclo, onboarding_completo, meta_ahorro_mensual
  )
  values (v_telefono, v_auth_id, v_email, 'Usuario de prueba', 'IE', v_tz, 'EUR', 'es', v_dia_inicio, true, 300)
  on conflict (telefono) do update set
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    nombre = excluded.nombre,
    pais = excluded.pais,
    timezone = excluded.timezone,
    moneda_default = excluded.moneda_default,
    idioma = excluded.idioma,
    dia_inicio_ciclo = excluded.dia_inicio_ciclo,
    onboarding_completo = excluded.onboarding_completo,
    meta_ahorro_mensual = excluded.meta_ahorro_mensual
  returning id into v_usuario_id;

  insert into categorias (usuario_id, nombre, color, orden)
  values
    (v_usuario_id, 'Vivienda', 'gris_oscuro', 0),
    (v_usuario_id, 'Salud', 'verde_profundo', 1),
    (v_usuario_id, 'Hogar', 'gris_calido', 2),
    (v_usuario_id, 'Comida', 'naranja_calido', 3),
    (v_usuario_id, 'Ocio', 'violeta_metalico', 4),
    (v_usuario_id, 'Transporte', 'azul_apagado', 5),
    (v_usuario_id, 'Compras', 'granate', 6)
  on conflict (usuario_id, nombre) do update set color = excluded.color, orden = excluded.orden;

  insert into movimientos_recurrentes (
    usuario_id, nombre, tipo, categoria_id, monto_actual, dia_del_mes, activo,
    recordatorio_activo, dias_antes, repeticiones_totales, repeticiones_insertadas
  )
  select v_usuario_id, v.nombre, v.tipo, c.id, v.monto, v.dia, true, false, 1, v.totales, v.insertadas
  from (values
    ('Alquiler', 'gasto', 'Vivienda', 820, 1, null::integer, 1),
    ('Internet', 'gasto', 'Vivienda', 45, 3, null, 1),
    ('Seguro', 'gasto', 'Vivienda', 35, 8, 10, 4),
    ('Parking', 'gasto', 'Transporte', 50, 15, null, 1),
    ('Limpieza', 'gasto', 'Hogar', 35, 20, null, 1),
    ('Gimnasio', 'gasto', 'Salud', 40, 22, null, 1),
    ('Salario', 'ingreso', null, 2400, 1, null, 1)
  ) v(nombre, tipo, categoria, monto, dia, totales, insertadas)
  left join categorias c on c.usuario_id = v_usuario_id and c.nombre = v.categoria
  on conflict (usuario_id, nombre) do update set
    tipo = excluded.tipo,
    categoria_id = excluded.categoria_id,
    monto_actual = excluded.monto_actual,
    dia_del_mes = excluded.dia_del_mes,
    activo = true,
    recordatorio_activo = excluded.recordatorio_activo,
    dias_antes = excluded.dias_antes,
    repeticiones_totales = excluded.repeticiones_totales,
    repeticiones_insertadas = excluded.repeticiones_insertadas;

  -- Ciclo actual: v_dia0 es su primer día local. Con inicio el 26, todos los días del sample
  -- (1 a 22) caen en el segundo mes calendario del ciclo, v_mes2.
  select (c.inicio at time zone v_tz)::date into v_dia0 from rango_ciclo_usuario(v_usuario_id, now()) c;
  v_mes2 := (date_trunc('month', v_dia0) + interval '1 month')::date;

  -- Presupuestos del ciclo actual y de los cinco anteriores, cada uno con su primer día.
  insert into presupuestos (usuario_id, categoria_id, monto, periodo)
  select v_usuario_id, c.id, v.monto, (v_dia0 - make_interval(months => k))::date
  from generate_series(0, 5) k
  cross join (values ('Comida', 400), ('Ocio', 150), ('Transporte', 100)) v(categoria, monto)
  join categorias c on c.usuario_id = v_usuario_id and c.nombre = v.categoria
  on conflict (usuario_id, categoria_id, periodo) do update set monto = excluded.monto;

  -- Ciclo actual: 20 filas (ids 1–20). Gastos 1 700 (1 025 de cargos recurrentes), ingresos
  -- 2 820, ahorro +176 −80 +50. Una fila con definición es el cargo de este ciclo.
  insert into transacciones (
    id, usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
    movimiento_recurrente_id, ciclo_mes, borrado_en
  )
  select
    format('a0000000-0000-4000-8000-%s', lpad(v.n::text, 12, '0'))::uuid,
    v_usuario_id, v.monto, 'EUR',
    ((v_mes2 + (v.dia - 1)) + time '12:00') at time zone 'UTC',
    c.id, v.descripcion, v.tipo,
    m.id is not null and v.tipo = 'gasto',
    m.id,
    case when m.id is not null then v_dia0 end,
    null
  from (values
    (1, 'gasto', 'Vivienda', 'Alquiler', 820, 1, 'Alquiler'),
    (2, 'gasto', 'Vivienda', 'Internet', 45, 3, 'Internet'),
    (3, 'gasto', 'Vivienda', 'Seguro', 35, 8, 'Seguro'),
    (4, 'gasto', 'Salud', 'Gimnasio', 40, 22, 'Gimnasio'),
    (5, 'gasto', 'Hogar', 'Limpieza', 35, 20, 'Limpieza'),
    (6, 'gasto', 'Hogar', null, 60, 9, 'Decoración'),
    (7, 'gasto', 'Comida', null, 180, 3, 'Supermercado'),
    (8, 'gasto', 'Comida', null, 67.6, 7, 'Restaurante'),
    (9, 'gasto', 'Comida', null, 62.4, 2, 'Café'),
    (10, 'gasto', 'Ocio', null, 45, 5, 'Cine'),
    (11, 'gasto', 'Ocio', null, 85, 8, 'Conciertos'),
    (12, 'gasto', 'Transporte', null, 80, 4, 'Gasolina'),
    (13, 'gasto', 'Transporte', 'Parking', 50, 15, 'Parking'),
    (14, 'gasto', 'Compras', null, 65, 6, 'Ropa'),
    (15, 'gasto', 'Compras', null, 30, 10, 'Electrónica'),
    (16, 'ingreso', null, 'Salario', 2400, 1, 'Salario'),
    (17, 'ingreso', null, null, 420, 5, 'Freelance'),
    (18, 'ahorro', null, null, 176, 3, 'Ahorro mensual'),
    (19, 'ahorro', null, null, -80, 8, 'Retiro emergencia'),
    (20, 'ahorro', null, null, 50, 9, 'Bono ahorro')
  ) v(n, tipo, categoria, definicion, monto, dia, descripcion)
  left join categorias c on c.usuario_id = v_usuario_id and c.nombre = v.categoria
  left join movimientos_recurrentes m on m.usuario_id = v_usuario_id and m.nombre = v.definicion
  on conflict (id) do update set
    monto = excluded.monto,
    fecha = excluded.fecha,
    categoria_id = excluded.categoria_id,
    descripcion = excluded.descripcion,
    tipo = excluded.tipo,
    es_fijo = excluded.es_fijo,
    movimiento_recurrente_id = excluded.movimiento_recurrente_id,
    ciclo_mes = excluded.ciclo_mes,
    borrado_en = null;

  -- Cinco ciclos anteriores (k = 1 el más reciente): 25 filas (ids 21–45), gastos sin
  -- definición que suman 1 750, 1 450, 1 600, 1 550 y 1 400, y un depósito de 500 cada uno.
  insert into transacciones (
    id, usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
    movimiento_recurrente_id, ciclo_mes, borrado_en
  )
  select
    format('a0000000-0000-4000-8000-%s', lpad((20 + (k - 1) * 5 + v.j)::text, 12, '0'))::uuid,
    v_usuario_id, v.montos[k], 'EUR',
    ((((v_dia0 - make_interval(months => k))::date) + v.offset_dias) + time '12:00') at time zone 'UTC',
    c.id, v.descripcion, v.tipo, false, null, null, null
  from generate_series(1, 5) k
  cross join (values
    (1, 'gasto', 'Vivienda', 'Gastos de casa', 9, array[900, 900, 900, 900, 900]::numeric[]),
    (2, 'gasto', 'Comida', 'Supermercado', 10, array[450, 330, 420, 380, 300]::numeric[]),
    (3, 'gasto', 'Ocio', 'Salidas', 12, array[250, 130, 180, 150, 120]::numeric[]),
    (4, 'gasto', 'Transporte', 'Gasolina', 11, array[150, 90, 100, 120, 80]::numeric[]),
    (5, 'ahorro', null, 'Ahorro mensual', 8, array[500, 500, 500, 500, 500]::numeric[])
  ) v(j, tipo, categoria, descripcion, offset_dias, montos)
  left join categorias c on c.usuario_id = v_usuario_id and c.nombre = v.categoria
  on conflict (id) do update set
    monto = excluded.monto,
    fecha = excluded.fecha,
    categoria_id = excluded.categoria_id,
    descripcion = excluded.descripcion,
    tipo = excluded.tipo,
    es_fijo = excluded.es_fijo,
    movimiento_recurrente_id = excluded.movimiento_recurrente_id,
    ciclo_mes = excluded.ciclo_mes,
    borrado_en = null;
end;
$$;
