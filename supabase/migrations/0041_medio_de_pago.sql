-- 0041 — Medio de pago (add-payment-method, 2026-10-17).
--
-- Un gasto o un ingreso puede decir cómo se pagó: 'efectivo', 'tarjeta' o nada (null). Es un
-- atributo, como es_fijo: ninguna cifra del dashboard lo mira salvo los saldos de los bolsillos
-- (design D1, D4). Un ahorro no lleva. Una definición recurrente lleva el suyo y todo cargo que
-- produce lo copia; la cuenta tiene un medio por defecto que solo preselecciona la hoja y completa
-- las cargas del bot, nunca un cargo generado.
--
-- Una transferencia entre bolsillos es una fila con tipo = 'transferencia': medio_pago es el
-- bolsillo al que entra (el otro es el que sale), sin categoría, sin definición ni ciclo. Como
-- resumenMensual separa las filas por tipo, no entra en ninguna cifra.
--
-- Los checks de tipo y monto de 0008 no tenían nombre; Postgres los llamó transacciones_tipo_check
-- y transacciones_check (leídos de pg_constraint el 2026-10-17). El de monto se renombra.
--
-- Funciones: las versiones vigentes de 0024 y 0029, iguales salvo el medio de pago (D2). Las que
-- cambian de firma (crear_movimiento_recurrente, editar_cargo_en_ciclo, completar_cargo_recurrente)
-- se borran y se crean, así no queda una sobrecarga ambigua; el parámetro nuevo va al final con
-- default null, así el código que corre hoy sigue llamándolas igual. completar_cargo_recurrente
-- vuelve a quedar solo para service role.
--
-- Aditiva: toda fila existente queda en null y el código que corre nunca escribe 'transferencia'.
-- Va antes del deploy, porque resumenMensual selecciona medio_pago y medio_pago_default.

-- 1. Columnas ----------------------------------------------------------------------------------

alter table transacciones add column medio_pago text
  check (medio_pago in ('efectivo', 'tarjeta'));
alter table movimientos_recurrentes add column medio_pago text
  check (medio_pago in ('efectivo', 'tarjeta'));
alter table usuarios add column medio_pago_default text
  check (medio_pago_default in ('efectivo', 'tarjeta'));

comment on column transacciones.medio_pago is
  'Cómo se pagó un gasto o un ingreso (efectivo, tarjeta; null = sin decir). En una transferencia, el bolsillo al que entra. Un ahorro no lleva. Solo lo leen los saldos de los bolsillos.';
comment on column movimientos_recurrentes.medio_pago is
  'Medio de pago de la definición; todo cargo que produce lo copia (nunca el de la cuenta). Null = sin decir.';
comment on column usuarios.medio_pago_default is
  'Medio que preselecciona la hoja de carga y completa una carga del bot que no lo dice. Null = Ninguno. No cambia filas guardadas ni cargos generados.';

-- 2. Tipo transferencia y sus checks ------------------------------------------------------------

alter table transacciones drop constraint transacciones_tipo_check,
  add constraint transacciones_tipo_check
    check (tipo in ('ingreso', 'gasto', 'ahorro', 'transferencia'));

alter table transacciones drop constraint transacciones_check,
  add constraint transacciones_monto_check check (
    (tipo in ('ingreso', 'gasto', 'transferencia') and monto > 0)
    or (tipo = 'ahorro' and monto <> 0));

alter table transacciones add constraint transacciones_medio_pago_coherente check (
  case tipo
    when 'ahorro' then medio_pago is null
    when 'transferencia' then medio_pago is not null and categoria_id is null
      and movimiento_recurrente_id is null and ciclo_mes is null
    else true
  end);

alter table movimientos_recurrentes add constraint movimientos_recurrentes_medio_pago_coherente
  check (medio_pago is null or tipo in ('gasto', 'ingreso'));

-- Saldos de los bolsillos: todas las filas marcadas hasta el fin del ciclo mostrado (D4).
create index transacciones_medio_pago_idx on transacciones (usuario_id, fecha)
  where medio_pago is not null and borrado_en is null;

-- 3. Funciones que insertan cargos --------------------------------------------------------------

-- Como en 0024, y el lugar congelado lleva el medio de la definición de antes del cambio.

create or replace function congelar_ciclos(
  p_usuario_id uuid,
  p_def movimientos_recurrentes,
  p_hasta date,
  p_congelar jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actual date := periodo_presupuesto(p_usuario_id, null);
begin
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_congelar, '[]'::jsonb)) c
    where (c->>'ciclo')::date <= v_actual or (c->>'ciclo')::date >= p_hasta
  ) then
    raise exception 'invalid-period';
  end if;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_congelar, '[]'::jsonb)) c
    where (c->>'fecha')::date < (c->>'ciclo')::date or (c->>'fecha')::date >= fin_de_ciclo(p_usuario_id, (c->>'ciclo')::date)
  ) then
    raise exception 'invalid-date';
  end if;

  insert into transacciones (
    usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
    movimiento_recurrente_id, ciclo_mes, estado, medio_pago
  )
  select
    p_usuario_id, (c->>'monto')::numeric, u.moneda_default, ((c->>'fecha')::date + time '12:00') at time zone 'UTC',
    p_def.categoria_id, p_def.nombre, p_def.tipo, p_def.tipo = 'gasto', p_def.id, (c->>'ciclo')::date, 'pendiente', p_def.medio_pago
  from jsonb_array_elements(coalesce(p_congelar, '[]'::jsonb)) c
  cross join usuarios u
  where u.id = p_usuario_id
  on conflict (movimiento_recurrente_id, ciclo_mes) do nothing;
end;
$$;

-- Como en 0024, y p_medio_pago va al lugar; con 'desde', también a la definición y a los lugares
-- pendientes de los ciclos siguientes. Las filas de ciclos anteriores no cambian.
drop function editar_cargo_en_ciclo(uuid, uuid, date, numeric, text, date, uuid, text, jsonb);

create function editar_cargo_en_ciclo(
  p_usuario_id uuid,
  p_movimiento_id uuid,
  p_periodo date,
  p_monto numeric,
  p_descripcion text,
  p_fecha date,
  p_categoria_id uuid,
  p_alcance text,
  p_congelar jsonb default '[]'::jsonb,
  p_medio_pago text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_def movimientos_recurrentes%rowtype;
  v_fin date;
  v_actual date := periodo_presupuesto(p_usuario_id, null);
  v_categoria uuid;
  v_nombre text;
  v_dia integer := extract(day from p_fecha)::int;
  v_fila transacciones%rowtype;
begin
  select * into v_def from movimientos_recurrentes
  where id = p_movimiento_id and usuario_id = p_usuario_id
  for update;

  if not found or v_def.tipo not in ('gasto', 'ingreso') then
    raise exception 'not-found';
  end if;

  if p_alcance is null or p_alcance not in ('solo', 'desde') then
    raise exception 'invalid-scope';
  end if;

  v_fin := fin_de_ciclo(p_usuario_id, p_periodo);

  if p_fecha < p_periodo or p_fecha >= v_fin then
    raise exception 'invalid-date';
  end if;

  if v_def.tipo = 'gasto' then
    if p_categoria_id is null then
      raise exception 'category-required';
    end if;
    if not categoria_viva(p_usuario_id, p_categoria_id, p_periodo) then
      raise exception 'not-found';
    end if;
    v_categoria := p_categoria_id;
  end if;

  v_nombre := coalesce(nullif(trim(p_descripcion), ''), v_def.nombre);

  select * into v_fila from transacciones
  where movimiento_recurrente_id = p_movimiento_id and ciclo_mes = p_periodo
  for update;

  if found then
    if v_fila.borrado_en is not null then
      raise exception 'not-found';
    end if;

    update transacciones set
      monto = p_monto,
      descripcion = nullif(trim(p_descripcion), ''),
      fecha = (p_fecha + time '12:00') at time zone 'UTC',
      categoria_id = v_categoria,
      medio_pago = p_medio_pago,
      estado = case when p_periodo <= v_actual then 'confirmada' else estado end
    where id = v_fila.id;
  else
    insert into transacciones (
      usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
      movimiento_recurrente_id, ciclo_mes, estado, medio_pago
    )
    select
      p_usuario_id, p_monto, u.moneda_default, (p_fecha + time '12:00') at time zone 'UTC',
      v_categoria, nullif(trim(p_descripcion), ''), v_def.tipo, v_def.tipo = 'gasto', v_def.id, p_periodo,
      case when p_periodo <= v_actual then 'confirmada' else 'pendiente' end, p_medio_pago
    from usuarios u
    where u.id = p_usuario_id;

    perform sumar_repeticion(p_usuario_id, p_movimiento_id, p_periodo);
  end if;

  if p_alcance = 'desde' then
    perform congelar_ciclos(p_usuario_id, v_def, p_periodo, p_congelar);

    update movimientos_recurrentes set
      monto_actual = p_monto,
      dia_del_mes = v_dia,
      nombre = v_nombre,
      categoria_id = v_categoria,
      medio_pago = p_medio_pago
    where id = p_movimiento_id;

    update transacciones set
      monto = p_monto,
      descripcion = v_nombre,
      fecha = (fecha_en_ciclo(ciclo_mes, v_dia) + time '12:00') at time zone 'UTC',
      categoria_id = v_categoria,
      medio_pago = p_medio_pago
    where usuario_id = p_usuario_id
      and movimiento_recurrente_id = p_movimiento_id
      and ciclo_mes > p_periodo
      and estado = 'pendiente'
      and borrado_en is null;
  end if;
end;
$$;

-- Como en 0024, y la fila escrita ya borrada lleva el medio de la definición.
create or replace function eliminar_cargo_en_ciclo(
  p_usuario_id uuid,
  p_movimiento_id uuid,
  p_periodo date,
  p_alcance text,
  p_cargo jsonb default null,
  p_congelar jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_def movimientos_recurrentes%rowtype;
  v_fin date;
  v_fila transacciones%rowtype;
begin
  select * into v_def from movimientos_recurrentes
  where id = p_movimiento_id and usuario_id = p_usuario_id
  for update;

  if not found or v_def.tipo not in ('gasto', 'ingreso') then
    raise exception 'not-found';
  end if;

  if p_alcance is null or p_alcance not in ('solo', 'desde') then
    raise exception 'invalid-scope';
  end if;

  v_fin := fin_de_ciclo(p_usuario_id, p_periodo);

  select * into v_fila from transacciones
  where movimiento_recurrente_id = p_movimiento_id and ciclo_mes = p_periodo
  for update;

  if found then
    update transacciones set borrado_en = now()
    where id = v_fila.id and borrado_en is null;
  else
    if p_cargo is null then
      raise exception 'not-found';
    end if;
    if (p_cargo->>'fecha')::date < p_periodo or (p_cargo->>'fecha')::date >= v_fin then
      raise exception 'invalid-date';
    end if;

    insert into transacciones (
      usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
      movimiento_recurrente_id, ciclo_mes, estado, borrado_en, medio_pago
    )
    select
      p_usuario_id, (p_cargo->>'monto')::numeric, u.moneda_default, ((p_cargo->>'fecha')::date + time '12:00') at time zone 'UTC',
      v_def.categoria_id, v_def.nombre, v_def.tipo, v_def.tipo = 'gasto', v_def.id, p_periodo, 'pendiente', now(), v_def.medio_pago
    from usuarios u
    where u.id = p_usuario_id;

    perform sumar_repeticion(p_usuario_id, p_movimiento_id, p_periodo);
  end if;

  if p_alcance = 'desde' then
    perform congelar_ciclos(p_usuario_id, v_def, p_periodo, p_congelar);

    update transacciones set borrado_en = now()
    where usuario_id = p_usuario_id
      and movimiento_recurrente_id = p_movimiento_id
      and ciclo_mes > p_periodo
      and borrado_en is null;

    update movimientos_recurrentes set activo = false where id = p_movimiento_id;
  end if;
end;
$$;

-- Como en 0024, y cada cargo copia el medio de su definición (nunca el de la cuenta).
create or replace function generar_ciclo(p_usuario_id uuid, p_periodo date, p_cargos jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_marca date;
  v_moneda text;
  v_fin date;
  v_insertadas integer;
begin
  select ciclo_generado_hasta, moneda_default into v_marca, v_moneda
  from usuarios where id = p_usuario_id
  for update;

  if v_moneda is null then
    raise exception 'not-found';
  end if;

  v_fin := fin_ciclo_generable(p_usuario_id, p_periodo);

  if v_marca is not null and v_marca >= p_periodo then
    return 0;
  end if;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_cargos, '[]'::jsonb)) c
    where (c->>'fecha')::date < p_periodo or (c->>'fecha')::date >= v_fin
  ) then
    raise exception 'invalid-date';
  end if;

  with cargos as (
    select distinct on ((c->>'movimiento_recurrente_id')::uuid)
      (c->>'movimiento_recurrente_id')::uuid as movimiento_id,
      (c->>'monto')::numeric as monto,
      (c->>'fecha')::date as fecha
    from jsonb_array_elements(coalesce(p_cargos, '[]'::jsonb)) c
  ),
  insertados as (
    insert into transacciones (
      usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
      movimiento_recurrente_id, ciclo_mes, estado, medio_pago
    )
    select
      p_usuario_id, c.monto, v_moneda, (c.fecha + time '12:00') at time zone 'UTC',
      m.categoria_id, m.nombre, m.tipo, m.tipo = 'gasto', m.id, p_periodo, 'pendiente', m.medio_pago
    from cargos c
    join movimientos_recurrentes m on m.id = c.movimiento_id and m.usuario_id = p_usuario_id
    where m.activo
      and m.tipo in ('gasto', 'ingreso')
      and (m.repeticiones_totales is null or m.repeticiones_insertadas < m.repeticiones_totales)
    on conflict (movimiento_recurrente_id, ciclo_mes) do nothing
    returning 1
  )
  select count(*) into v_insertadas from insertados;

  update movimientos_recurrentes m set
    repeticiones_insertadas = m.repeticiones_insertadas + 1,
    activo = m.activo and (m.repeticiones_totales is null or m.repeticiones_insertadas + 1 < m.repeticiones_totales)
  where m.usuario_id = p_usuario_id
    and exists (
      select 1 from transacciones t
      where t.movimiento_recurrente_id = m.id and t.ciclo_mes = p_periodo
    );

  update usuarios set ciclo_generado_hasta = p_periodo where id = p_usuario_id;

  return v_insertadas;
end;
$$;

-- Como en 0024, y p_medio_pago va a la definición y a la fila que reclama.
drop function crear_movimiento_recurrente(uuid, text, uuid, text, numeric, integer, boolean, integer, integer);

create function crear_movimiento_recurrente(
  p_usuario_id uuid,
  p_tipo text,
  p_categoria_id uuid,
  p_nombre text,
  p_monto numeric,
  p_dia integer,
  p_recordatorio boolean,
  p_dias_antes integer,
  p_repeticiones integer,
  p_medio_pago text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_tz text;
  v_transaccion_id uuid;
  v_ciclo date;
begin
  if p_tipo = 'gasto' and p_categoria_id is null then
    raise exception 'category-required';
  end if;

  if p_categoria_id is not null and not exists (
    select 1 from categorias where id = p_categoria_id and usuario_id = p_usuario_id
  ) then
    raise exception 'not-found';
  end if;

  select timezone into v_tz from usuarios where id = p_usuario_id;
  if v_tz is null then
    raise exception 'not-found';
  end if;

  insert into movimientos_recurrentes (
    usuario_id, tipo, categoria_id, nombre, monto_actual, dia_del_mes,
    recordatorio_activo, dias_antes, repeticiones_totales, medio_pago
  )
  values (
    p_usuario_id, p_tipo, p_categoria_id, p_nombre, p_monto, p_dia,
    p_recordatorio, p_dias_antes, p_repeticiones, p_medio_pago
  )
  returning id into v_id;

  select id into v_transaccion_id from transacciones
  where usuario_id = p_usuario_id
    and tipo = p_tipo
    and categoria_id is not distinct from p_categoria_id
    and monto = p_monto
    and descripcion = p_nombre
    and movimiento_recurrente_id is null
    and borrado_en is null
    and extract(day from fecha at time zone v_tz) = p_dia
  order by fecha desc
  limit 1
  for update;

  if v_transaccion_id is not null then
    update transacciones t set
      movimiento_recurrente_id = v_id,
      es_fijo = (p_tipo = 'gasto'),
      medio_pago = p_medio_pago,
      ciclo_mes = (
        select (c.inicio at time zone v_tz)::date
        from rango_ciclo_usuario(p_usuario_id, t.fecha) c
      )
    where t.id = v_transaccion_id
    returning ciclo_mes into v_ciclo;

    perform sumar_repeticion(p_usuario_id, v_id, v_ciclo);
  end if;

  return v_id;
end;
$$;

-- Como en 0024, y el cargo lleva el medio dicho en el chat o, si no, el de la definición.
drop function completar_cargo_recurrente(uuid, uuid, date, numeric, date, text, text);

create function completar_cargo_recurrente(
  p_usuario_id uuid,
  p_movimiento_id uuid,
  p_periodo date,
  p_monto numeric,
  p_fecha date,
  p_canal text default null,
  p_mensaje_id_externo text default null,
  p_medio_pago text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_def movimientos_recurrentes%rowtype;
  v_fin date;
  v_fila transacciones%rowtype;
  v_id uuid;
begin
  select * into v_def from movimientos_recurrentes
  where id = p_movimiento_id and usuario_id = p_usuario_id
  for update;

  if not found then
    raise exception 'not-found';
  end if;

  v_fin := fin_ciclo_generable(p_usuario_id, p_periodo);

  if p_fecha < p_periodo or p_fecha >= v_fin then
    raise exception 'invalid-date';
  end if;

  select * into v_fila from transacciones
  where movimiento_recurrente_id = p_movimiento_id and ciclo_mes = p_periodo
  for update;

  if found then
    if v_fila.estado = 'confirmada' or v_fila.borrado_en is not null then
      raise exception 'already-confirmed';
    end if;

    update transacciones set
      monto = p_monto,
      fecha = (p_fecha + time '12:00') at time zone 'UTC',
      estado = 'confirmada',
      canal = p_canal,
      mensaje_id_externo = p_mensaje_id_externo,
      medio_pago = coalesce(p_medio_pago, v_def.medio_pago)
    where id = v_fila.id;

    return v_fila.id;
  end if;

  if not v_def.activo
    or (v_def.repeticiones_totales is not null and v_def.repeticiones_insertadas >= v_def.repeticiones_totales)
  then
    raise exception 'plan-completed';
  end if;

  insert into transacciones (
    usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
    movimiento_recurrente_id, ciclo_mes, estado, canal, mensaje_id_externo, medio_pago
  )
  select
    p_usuario_id, p_monto, u.moneda_default, (p_fecha + time '12:00') at time zone 'UTC',
    v_def.categoria_id, v_def.nombre, v_def.tipo, v_def.tipo = 'gasto', v_def.id, p_periodo, 'confirmada',
    p_canal, p_mensaje_id_externo, coalesce(p_medio_pago, v_def.medio_pago)
  from usuarios u
  where u.id = p_usuario_id
  returning id into v_id;

  perform sumar_repeticion(p_usuario_id, p_movimiento_id, p_periodo);

  return v_id;
end;
$$;

revoke execute on function completar_cargo_recurrente(uuid, uuid, date, numeric, date, text, text, text)
  from public, anon, authenticated;

-- Como en 0029, y cada cargo copia el medio de su definición.
create or replace function insertar_cargos_pendientes(p_usuario_id uuid, p_periodo date, p_cargos jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_moneda text;
  v_actual date;
  v_fin date;
  v_insertadas integer;
  v_movimiento uuid;
begin
  select moneda_default into v_moneda from usuarios where id = p_usuario_id;

  if v_moneda is null then
    raise exception 'not-found';
  end if;

  v_actual := periodo_presupuesto(p_usuario_id, null);

  if p_periodo < v_actual then
    raise exception 'invalid-period';
  end if;

  v_fin := fin_de_ciclo(p_usuario_id, p_periodo);

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_cargos, '[]'::jsonb)) c
    where (c->>'fecha')::date < p_periodo or (c->>'fecha')::date >= v_fin
  ) then
    raise exception 'invalid-date';
  end if;

  v_insertadas := 0;

  for v_movimiento in
    with cargos as (
      select distinct on ((c->>'movimiento_recurrente_id')::uuid)
        (c->>'movimiento_recurrente_id')::uuid as movimiento_id,
        (c->>'monto')::numeric as monto,
        (c->>'fecha')::date as fecha
      from jsonb_array_elements(coalesce(p_cargos, '[]'::jsonb)) c
    )
    insert into transacciones (
      usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
      movimiento_recurrente_id, ciclo_mes, estado, medio_pago
    )
    select
      p_usuario_id, c.monto, v_moneda, (c.fecha + time '12:00') at time zone 'UTC',
      m.categoria_id, m.nombre, m.tipo, m.tipo = 'gasto', m.id, p_periodo, 'pendiente', m.medio_pago
    from cargos c
    join movimientos_recurrentes m on m.id = c.movimiento_id and m.usuario_id = p_usuario_id
    where m.activo
      and m.tipo in ('gasto', 'ingreso')
      and (m.repeticiones_totales is null or m.repeticiones_insertadas < m.repeticiones_totales)
    on conflict (movimiento_recurrente_id, ciclo_mes) do nothing
    returning movimiento_recurrente_id
  loop
    perform sumar_repeticion(p_usuario_id, v_movimiento, p_periodo);
    v_insertadas := v_insertadas + 1;
  end loop;

  return v_insertadas;
end;
$$;

-- Como en 0024, y la reinserción a nombre de la receptora copia el medio de la definición.
create or replace function eliminar_categoria(
  p_usuario_id uuid,
  p_id uuid,
  p_reasignar_a uuid,
  p_periodo date default null,
  p_alcance text default null,
  p_cargos jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cat categorias%rowtype;
  v_tz text;
  v_fin date;
begin
  select * into v_cat from categorias
  where id = p_id and usuario_id = p_usuario_id
  for update;

  if not found then
    raise exception 'not-found';
  end if;

  if p_reasignar_a is not null and (p_reasignar_a = p_id or not exists (
    select 1 from categorias where id = p_reasignar_a and usuario_id = p_usuario_id
  )) then
    raise exception 'not-found';
  end if;

  if p_alcance is not null and p_alcance not in ('solo', 'desde') then
    raise exception 'invalid-scope';
  end if;

  if p_alcance is not null then
    v_fin := fin_de_ciclo(p_usuario_id, p_periodo);
    if p_reasignar_a is not null and not categoria_viva(p_usuario_id, p_reasignar_a, p_periodo) then
      raise exception 'not-found';
    end if;
  end if;

  if p_alcance is null or (p_alcance = 'desde' and v_cat.desde_ciclo is not null and v_cat.desde_ciclo >= p_periodo) then
    if p_reasignar_a is null then
      if exists (
        select 1 from transacciones where usuario_id = p_usuario_id and categoria_id = p_id
      ) or exists (
        select 1 from movimientos_recurrentes where usuario_id = p_usuario_id and categoria_id = p_id
      ) then
        raise exception 'category-not-empty';
      end if;
    else
      update transacciones set categoria_id = p_reasignar_a
      where usuario_id = p_usuario_id and categoria_id = p_id;

      update movimientos_recurrentes set categoria_id = p_reasignar_a
      where usuario_id = p_usuario_id and categoria_id = p_id;
    end if;

    delete from categorias where id = p_id and usuario_id = p_usuario_id;
    return;
  end if;

  select timezone into v_tz from usuarios where id = p_usuario_id;

  if p_alcance = 'solo' then
    if p_reasignar_a is null and (
      exists (
        select 1 from transacciones
        where usuario_id = p_usuario_id and categoria_id = p_id and borrado_en is null
          and (fecha at time zone v_tz)::date >= p_periodo and (fecha at time zone v_tz)::date < v_fin
      ) or jsonb_array_length(coalesce(p_cargos, '[]'::jsonb)) > 0
    ) then
      raise exception 'category-not-empty';
    end if;

    if p_reasignar_a is not null then
      update transacciones set categoria_id = p_reasignar_a
      where usuario_id = p_usuario_id and categoria_id = p_id
        and (fecha at time zone v_tz)::date >= p_periodo and (fecha at time zone v_tz)::date < v_fin;

      if exists (
        select 1 from jsonb_array_elements(coalesce(p_cargos, '[]'::jsonb)) c
        where (c->>'fecha')::date < p_periodo or (c->>'fecha')::date >= v_fin
      ) then
        raise exception 'invalid-date';
      end if;

      insert into transacciones (
        usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
        movimiento_recurrente_id, ciclo_mes, estado, medio_pago
      )
      select
        p_usuario_id, (c->>'monto')::numeric, u.moneda_default, ((c->>'fecha')::date + time '12:00') at time zone 'UTC',
        p_reasignar_a, m.nombre, m.tipo, true, m.id, p_periodo, 'pendiente', m.medio_pago
      from jsonb_array_elements(coalesce(p_cargos, '[]'::jsonb)) c
      join movimientos_recurrentes m
        on m.id = (c->>'movimiento_recurrente_id')::uuid and m.usuario_id = p_usuario_id
        and m.categoria_id = p_id and m.tipo = 'gasto'
      cross join usuarios u
      where u.id = p_usuario_id
      on conflict (movimiento_recurrente_id, ciclo_mes) do nothing;
    end if;

    insert into categorias_ocultas (usuario_id, categoria_id, periodo)
    values (p_usuario_id, p_id, p_periodo)
    on conflict do nothing;
    return;
  end if;

  -- 'desde', después del primer ciclo de la categoría.
  if p_reasignar_a is null and (
    exists (
      select 1 from transacciones
      where usuario_id = p_usuario_id and categoria_id = p_id and borrado_en is null
        and (fecha at time zone v_tz)::date >= p_periodo
    ) or exists (
      select 1 from movimientos_recurrentes where usuario_id = p_usuario_id and categoria_id = p_id
    )
  ) then
    raise exception 'category-not-empty';
  end if;

  if p_reasignar_a is not null then
    update transacciones set categoria_id = p_reasignar_a
    where usuario_id = p_usuario_id and categoria_id = p_id
      and (fecha at time zone v_tz)::date >= p_periodo;

    update movimientos_recurrentes set categoria_id = p_reasignar_a
    where usuario_id = p_usuario_id and categoria_id = p_id;
  end if;

  delete from presupuestos where usuario_id = p_usuario_id and categoria_id = p_id and periodo >= p_periodo;
  delete from categorias_ocultas where usuario_id = p_usuario_id and categoria_id = p_id and periodo >= p_periodo;

  update categorias set hasta_ciclo = ciclo_anterior(p_usuario_id, p_periodo)
  where id = p_id and usuario_id = p_usuario_id;
end;
$$;
