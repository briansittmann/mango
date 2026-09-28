-- 0024 — add-forward-scoped-edits (design.md D1–D5, D7).
--
-- 1. Vida de una categoría: categorias.desde_ciclo / hasta_ciclo (primer y último ciclo, null =
--    desde siempre / sin fin) y categorias_ocultas (los ciclos en que un borrado "solo este mes"
--    la ocultó). Viva en un ciclo = dentro de su vida y no oculta ahí (categoria_viva). El nombre
--    queda único solo entre las que no terminaron: una categoría terminada libera el suyo.
-- 2. El lugar de una definición en un ciclo — (movimiento_recurrente_id, ciclo_mes), filas
--    borradas incluidas (0021) — se edita, se borra y se restaura por separado:
--    editar_cargo_en_ciclo, eliminar_cargo_en_ciclo, restaurar_cargo_en_ciclo. Con alcance
--    'desde' desde un ciclo futuro, los ciclos entre el en curso y ese se congelan con lo que
--    mostraban: el TypeScript los calcula con proyectarCiclo (congelarCiclos) y llegan en
--    p_congelar, igual que generar_ciclo recibe p_cargos.
-- 3. Cuotas: generar_ciclo suma una repetición por cada definición que tiene lugar en el ciclo
--    que genera (insertado ahora o escrito antes, borrado incluido), no solo por las filas que
--    inserta. Una fila escrita en un ciclo ya generado suma al escribirse (sumar_repeticion);
--    una escrita en un ciclo por generar, al generarse. Así cada lugar cuenta una vez y las
--    cuotas cargadas antes de la app (repeticiones_insertadas sin fila) no se pierden.
--    crear_movimiento_recurrente y completar_cargo_recurrente cuentan con la misma regla.
-- 4. crear_categoria y eliminar_categoria reciben ciclo y alcance; actualizar_categoria y
--    copiar_presupuestos_ciclo ignoran las categorías terminadas.
--
-- Mensajes estables de raise nuevos: invalid-scope (ya en 0022), invalid-period, invalid-date,
-- category-required, category-not-empty, not-found.

-- 1. Vida de una categoría ------------------------------------------------------------------

alter table categorias
  add column if not exists desde_ciclo date,
  add column if not exists hasta_ciclo date;

comment on column categorias.desde_ciclo is
  'Primer día (fecha local) del primer ciclo de la categoría; null = desde siempre. crear_categoria lo escribe con el ciclo desde el que se crea (el en curso si se crea desde uno pasado).';
comment on column categorias.hasta_ciclo is
  'Primer día (fecha local) del último ciclo de la categoría; null = no terminó. eliminar_categoria con alcance desde lo pone en el ciclo anterior al borrado: los ciclos anteriores la conservan con sus filas.';

create table if not exists categorias_ocultas (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  categoria_id uuid not null,
  periodo date not null,
  primary key (usuario_id, categoria_id, periodo),
  foreign key (categoria_id, usuario_id) references categorias (id, usuario_id) on delete cascade
);

comment on table categorias_ocultas is
  'Ciclos (primer día, fecha local) en que un borrado "solo este mes" ocultó una categoría: ese ciclo no la muestra ni cuenta su presupuesto, y el siguiente la vuelve a tener (add-forward-scoped-edits D7).';

alter table categorias_ocultas enable row level security;

drop policy if exists "categorias_ocultas_crud_propio" on categorias_ocultas;
create policy "categorias_ocultas_crud_propio" on categorias_ocultas
  for all using (usuario_id = usuario_actual_id())
  with check (usuario_id = usuario_actual_id());

alter table categorias drop constraint if exists categorias_usuario_id_nombre_key;
create unique index if not exists categorias_nombre_vivo_key on categorias (usuario_id, nombre) where hasta_ciclo is null;

-- 2. Ayudantes ------------------------------------------------------------------------------

-- Valida que p_periodo sea el primer día (local) de un ciclo del usuario, pasado, en curso o de
-- los seis siguientes, y devuelve el primer día del ciclo siguiente (fin exclusivo, local).
create or replace function fin_de_ciclo(p_usuario_id uuid, p_periodo date)
returns date
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tz text;
  v_inicio date;
  v_fin date;
begin
  select u.timezone, (c.inicio at time zone u.timezone)::date, (c.fin at time zone u.timezone)::date
  into v_tz, v_inicio, v_fin
  from usuarios u
  cross join lateral rango_ciclo(u.dia_inicio_ciclo, u.timezone, (p_periodo + time '12:00') at time zone u.timezone) c
  where u.id = p_usuario_id;

  if v_tz is null then
    raise exception 'not-found';
  end if;

  if v_inicio <> p_periodo then
    raise exception 'invalid-period';
  end if;

  -- Un ciclo posterior al séptimo rechaza con invalid-period.
  perform periodo_presupuesto(p_usuario_id, p_periodo);

  return v_fin;
end;
$$;

-- Primer día (local) del ciclo anterior al que empieza en p_periodo.
create or replace function ciclo_anterior(p_usuario_id uuid, p_periodo date)
returns date
language sql
stable
security invoker
set search_path = public
as $$
  select (c.inicio at time zone u.timezone)::date
  from usuarios u
  cross join lateral rango_ciclo(u.dia_inicio_ciclo, u.timezone, ((p_periodo - 1) + time '12:00') at time zone u.timezone) c
  where u.id = p_usuario_id;
$$;

-- La fecha en que cae el día p_dia dentro del ciclo que empieza en p_inicio: lo mismo que
-- fechaEnCiclo (lib/data/projection.ts). Un día desde el de inicio cae en el mes del inicio, uno
-- anterior en el mes siguiente, y un día que el mes no tiene pasa a ser su último día.
create or replace function fecha_en_ciclo(p_inicio date, p_dia integer)
returns date
language sql
immutable
as $$
  select (m.primero + (least(p_dia, extract(day from (m.primero + interval '1 month - 1 day'))::int) - 1))::date
  from (
    select (date_trunc('month', p_inicio)
      + case when p_dia >= extract(day from p_inicio) then interval '0' else interval '1 month' end)::date as primero
  ) m;
$$;

create or replace function categoria_viva(p_usuario_id uuid, p_categoria_id uuid, p_periodo date)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from categorias c
    where c.id = p_categoria_id
      and c.usuario_id = p_usuario_id
      and (c.desde_ciclo is null or c.desde_ciclo <= p_periodo)
      and (c.hasta_ciclo is null or p_periodo <= c.hasta_ciclo)
      and not exists (
        select 1 from categorias_ocultas o
        where o.usuario_id = p_usuario_id and o.categoria_id = c.id and o.periodo = p_periodo
      )
  );
$$;

-- Suma una repetición a la definición por un lugar escrito en p_periodo, solo si ese ciclo ya
-- se generó: el de un ciclo por generar lo cuenta generar_ciclo al generarlo. Un plan que llega a
-- su total queda inactivo; una definición ya inactiva no se reactiva.
create or replace function sumar_repeticion(p_usuario_id uuid, p_movimiento_id uuid, p_periodo date)
returns void
language sql
security invoker
set search_path = public
as $$
  update movimientos_recurrentes m set
    repeticiones_insertadas = m.repeticiones_insertadas + 1,
    activo = m.activo and (m.repeticiones_totales is null or m.repeticiones_insertadas + 1 < m.repeticiones_totales)
  from usuarios u
  where u.id = p_usuario_id
    and m.id = p_movimiento_id
    and m.usuario_id = p_usuario_id
    and u.ciclo_generado_hasta is not null
    and p_periodo <= u.ciclo_generado_hasta;
$$;

-- Escribe los lugares congelados de una edición o un borrado 'desde' (D2, D3): cada entrada es
-- { "ciclo", "monto", "fecha" } de un ciclo posterior al en curso y anterior a p_hasta, con lo que
-- la proyección mostraba. Solo donde no hay lugar todavía; pendientes, con los datos de la
-- definición antes del cambio. Un ciclo por generar: no suma repetición.
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
    movimiento_recurrente_id, ciclo_mes, estado
  )
  select
    p_usuario_id, (c->>'monto')::numeric, u.moneda_default, ((c->>'fecha')::date + time '12:00') at time zone 'UTC',
    p_def.categoria_id, p_def.nombre, p_def.tipo, p_def.tipo = 'gasto', p_def.id, (c->>'ciclo')::date, 'pendiente'
  from jsonb_array_elements(coalesce(p_congelar, '[]'::jsonb)) c
  cross join usuarios u
  where u.id = p_usuario_id
  on conflict (movimiento_recurrente_id, ciclo_mes) do nothing;
end;
$$;

-- 3. Lugares de una definición ---------------------------------------------------------------

-- Edita el lugar de la definición en p_periodo (D1, D2). 'solo': escribe ese lugar, la fila
-- vinculada o una nueva; en el ciclo en curso o uno pasado queda confirmada (la conciliación),
-- en uno futuro pendiente. 'desde': además congela los ciclos intermedios, actualiza la
-- definición (monto, día de p_fecha, nombre y categoría) y reescribe los lugares pendientes de
-- los ciclos siguientes. Un gasto exige una categoría viva en p_periodo; un ingreso no lleva.
create or replace function editar_cargo_en_ciclo(
  p_usuario_id uuid,
  p_movimiento_id uuid,
  p_periodo date,
  p_monto numeric,
  p_descripcion text,
  p_fecha date,
  p_categoria_id uuid,
  p_alcance text,
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
      estado = case when p_periodo <= v_actual then 'confirmada' else estado end
    where id = v_fila.id;
  else
    insert into transacciones (
      usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
      movimiento_recurrente_id, ciclo_mes, estado
    )
    select
      p_usuario_id, p_monto, u.moneda_default, (p_fecha + time '12:00') at time zone 'UTC',
      v_categoria, nullif(trim(p_descripcion), ''), v_def.tipo, v_def.tipo = 'gasto', v_def.id, p_periodo,
      case when p_periodo <= v_actual then 'confirmada' else 'pendiente' end
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
      categoria_id = v_categoria
    where id = p_movimiento_id;

    update transacciones set
      monto = p_monto,
      descripcion = v_nombre,
      fecha = (fecha_en_ciclo(ciclo_mes, v_dia) + time '12:00') at time zone 'UTC',
      categoria_id = v_categoria
    where usuario_id = p_usuario_id
      and movimiento_recurrente_id = p_movimiento_id
      and ciclo_mes > p_periodo
      and estado = 'pendiente'
      and borrado_en is null;
  end if;
end;
$$;

-- Borra el lugar de la definición en p_periodo (D1, D3). 'solo': borrado suave de la fila
-- vinculada; si no hay, la escribe ya borrada con p_cargo ({ "monto", "fecha" }, lo que la
-- proyección mostraba), así nada vuelve a insertarla. 'desde': además congela los ciclos
-- intermedios, borra los lugares de los ciclos siguientes y detiene la definición. Las filas de
-- ciclos anteriores no cambian.
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
      movimiento_recurrente_id, ciclo_mes, estado, borrado_en
    )
    select
      p_usuario_id, (p_cargo->>'monto')::numeric, u.moneda_default, ((p_cargo->>'fecha')::date + time '12:00') at time zone 'UTC',
      v_def.categoria_id, v_def.nombre, v_def.tipo, v_def.tipo = 'gasto', v_def.id, p_periodo, 'pendiente', now()
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

-- Deshace el borrado del lugar de la definición en p_periodo: el deshacer de un deslizamiento.
create or replace function restaurar_cargo_en_ciclo(p_usuario_id uuid, p_movimiento_id uuid, p_periodo date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update transacciones set borrado_en = null
  where usuario_id = p_usuario_id
    and movimiento_recurrente_id = p_movimiento_id
    and ciclo_mes = p_periodo
    and borrado_en is not null;

  if not found then
    raise exception 'not-found';
  end if;
end;
$$;

-- 4. Cuotas -------------------------------------------------------------------------------

-- Como en 0021, salvo el conteo (D4): cada definición con lugar en p_periodo — insertado acá o
-- escrito antes (congelado, "solo este mes", borrado) — suma una repetición, y un plan que llega a
-- su total queda inactivo; una definición ya inactiva no se reactiva. Devuelve las filas
-- insertadas.
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
      movimiento_recurrente_id, ciclo_mes, estado
    )
    select
      p_usuario_id, c.monto, v_moneda, (c.fecha + time '12:00') at time zone 'UTC',
      m.categoria_id, m.nombre, m.tipo, m.tipo = 'gasto', m.id, p_periodo, 'pendiente'
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

-- Como en 0017, salvo el conteo: la fila reclamada cuenta como primera repetición solo si su
-- ciclo ya se generó; si no, la cuenta generar_ciclo al generarlo (D4).
create or replace function crear_movimiento_recurrente(
  p_usuario_id uuid,
  p_tipo text,
  p_categoria_id uuid,
  p_nombre text,
  p_monto numeric,
  p_dia integer,
  p_recordatorio boolean,
  p_dias_antes integer,
  p_repeticiones integer
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
    recordatorio_activo, dias_antes, repeticiones_totales
  )
  values (
    p_usuario_id, p_tipo, p_categoria_id, p_nombre, p_monto, p_dia,
    p_recordatorio, p_dias_antes, p_repeticiones
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

-- Como en 0023, salvo el conteo de la rama insert (sumar_repeticion, D4).
create or replace function completar_cargo_recurrente(
  p_usuario_id uuid,
  p_movimiento_id uuid,
  p_periodo date,
  p_monto numeric,
  p_fecha date,
  p_canal text default null,
  p_mensaje_id_externo text default null
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
      mensaje_id_externo = p_mensaje_id_externo
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
    movimiento_recurrente_id, ciclo_mes, estado, canal, mensaje_id_externo
  )
  select
    p_usuario_id, p_monto, u.moneda_default, (p_fecha + time '12:00') at time zone 'UTC',
    v_def.categoria_id, v_def.nombre, v_def.tipo, v_def.tipo = 'gasto', v_def.id, p_periodo, 'confirmada',
    p_canal, p_mensaje_id_externo
  from usuarios u
  where u.id = p_usuario_id
  returning id into v_id;

  perform sumar_repeticion(p_usuario_id, p_movimiento_id, p_periodo);

  return v_id;
end;
$$;

revoke execute on function completar_cargo_recurrente(uuid, uuid, date, numeric, date, text, text)
  from public, anon, authenticated;

-- Como en 0021, y además los lugares pendientes de ciclos siguientes (escritos por adelantado)
-- toman el monto, el nombre y el día nuevos.
create or replace function actualizar_movimiento_recurrente(
  p_usuario_id uuid,
  p_id uuid,
  p_nombre text,
  p_monto numeric,
  p_dia integer,
  p_recordatorio boolean,
  p_dias_antes integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tz text;
  v_actual date := periodo_presupuesto(p_usuario_id, null);
begin
  update movimientos_recurrentes set
    nombre = p_nombre,
    monto_actual = p_monto,
    dia_del_mes = p_dia,
    recordatorio_activo = p_recordatorio,
    dias_antes = p_dias_antes
  where id = p_id and usuario_id = p_usuario_id;

  if not found then
    raise exception 'not-found';
  end if;

  select timezone into v_tz from usuarios where id = p_usuario_id;

  update transacciones t set monto = p_monto
  from rango_ciclo_usuario(p_usuario_id, now()) c
  where t.usuario_id = p_usuario_id
    and t.movimiento_recurrente_id = p_id
    and t.borrado_en is null
    and t.estado = 'pendiente'
    and t.fecha >= c.inicio
    and t.fecha < c.fin
    and (t.fecha at time zone v_tz)::date > (now() at time zone v_tz)::date;

  update transacciones set
    monto = p_monto,
    descripcion = p_nombre,
    fecha = (fecha_en_ciclo(ciclo_mes, p_dia) + time '12:00') at time zone 'UTC'
  where usuario_id = p_usuario_id
    and movimiento_recurrente_id = p_id
    and ciclo_mes > v_actual
    and estado = 'pendiente'
    and borrado_en is null;
end;
$$;

-- 5. Categorías ---------------------------------------------------------------------------

-- Como en 0022, salvo que no copia filas de categorías que ya terminaron antes del ciclo.
create or replace function copiar_presupuestos_ciclo(p_usuario_id uuid, p_periodo date default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_periodo date := periodo_presupuesto(p_usuario_id, p_periodo);
begin
  insert into presupuestos (usuario_id, categoria_id, monto, periodo)
  select p.usuario_id, p.categoria_id, p.monto, v_periodo from presupuestos p
  join categorias c on c.id = p.categoria_id
  where p.usuario_id = p_usuario_id
    and (c.hasta_ciclo is null or c.hasta_ciclo >= v_periodo)
    and p.periodo = (
      select max(periodo) from presupuestos
      where usuario_id = p_usuario_id and periodo < v_periodo
    )
    and not exists (
      select 1 from presupuestos where usuario_id = p_usuario_id and periodo = v_periodo
    )
  on conflict (usuario_id, categoria_id, periodo) do nothing;
end;
$$;

drop function if exists crear_categoria(uuid, text, text, numeric);

-- Crea la categoría al final del orden, viva desde el ciclo de p_periodo (null o pasado = el en
-- curso; ver periodo_presupuesto). Con presupuesto, lo escribe en ese ciclo como una edición
-- 'desde': primero la copia al ciclo en curso y, si es futuro, la materialización de ese ciclo.
-- El nombre choca solo con categorías que no terminaron antes del ciclo en curso.
create function crear_categoria(
  p_usuario_id uuid,
  p_nombre text,
  p_color text,
  p_presupuesto numeric,
  p_periodo date default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actual date := periodo_presupuesto(p_usuario_id, null);
  v_periodo date := periodo_presupuesto(p_usuario_id, p_periodo);
  v_id uuid;
begin
  if exists (
    select 1 from categorias
    where usuario_id = p_usuario_id
      and (hasta_ciclo is null or hasta_ciclo >= v_actual)
      and lower(trim(nombre)) = lower(trim(p_nombre))
  ) then
    raise exception 'duplicate-category-name';
  end if;

  insert into categorias (usuario_id, nombre, color, orden, desde_ciclo)
  select p_usuario_id, p_nombre, p_color, coalesce(max(orden), -1) + 1, v_periodo
  from categorias where usuario_id = p_usuario_id
  returning id into v_id;

  if p_presupuesto is not null then
    perform copiar_presupuestos_ciclo(p_usuario_id);
    if v_periodo > v_actual then
      perform copiar_presupuestos_ciclo(p_usuario_id, v_periodo);
    end if;

    insert into presupuestos (usuario_id, categoria_id, monto, periodo)
    values (p_usuario_id, v_id, p_presupuesto, v_periodo);
  end if;

  return v_id;
end;
$$;

-- Como en 0022, salvo que el nombre choca solo con categorías que no terminaron antes del ciclo
-- en curso.
create or replace function actualizar_categoria(
  p_usuario_id uuid,
  p_id uuid,
  p_nombre text,
  p_color text,
  p_presupuesto numeric,
  p_periodo date default null,
  p_alcance text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actual date := periodo_presupuesto(p_usuario_id, null);
  v_periodo date := periodo_presupuesto(p_usuario_id, p_periodo);
  v_siguiente date;
begin
  if v_periodo > v_actual and (p_alcance is null or p_alcance not in ('solo', 'desde')) then
    raise exception 'invalid-scope';
  end if;

  if exists (
    select 1 from categorias
    where usuario_id = p_usuario_id
      and id <> p_id
      and (hasta_ciclo is null or hasta_ciclo >= v_actual)
      and lower(trim(nombre)) = lower(trim(p_nombre))
  ) then
    raise exception 'duplicate-category-name';
  end if;

  update categorias set nombre = p_nombre, color = p_color
  where id = p_id and usuario_id = p_usuario_id;

  if not found then
    raise exception 'not-found';
  end if;

  -- El ciclo en curso primero: es de donde heredan los futuros sin filas.
  perform copiar_presupuestos_ciclo(p_usuario_id);

  if v_periodo > v_actual then
    perform copiar_presupuestos_ciclo(p_usuario_id, v_periodo);

    if p_alcance = 'solo' then
      select (c.fin at time zone u.timezone)::date into v_siguiente
      from usuarios u
      cross join lateral rango_ciclo(u.dia_inicio_ciclo, u.timezone, (v_periodo + time '12:00') at time zone u.timezone) c
      where u.id = p_usuario_id;

      -- Sin pasar por periodo_presupuesto: desde el sexto ciclo, el siguiente es el séptimo.
      if not exists (
        select 1 from presupuestos where usuario_id = p_usuario_id and periodo = v_siguiente
      ) then
        insert into presupuestos (usuario_id, categoria_id, monto, periodo)
        select usuario_id, categoria_id, monto, v_siguiente from presupuestos
        where usuario_id = p_usuario_id and periodo = v_periodo;

        insert into presupuestos (usuario_id, categoria_id, monto, periodo)
        values (p_usuario_id, p_id, null, v_siguiente)
        on conflict (usuario_id, categoria_id, periodo) do nothing;
      end if;
    end if;
  end if;

  if p_presupuesto is not null then
    insert into presupuestos (usuario_id, categoria_id, monto, periodo)
    values (p_usuario_id, p_id, p_presupuesto, v_periodo)
    on conflict (usuario_id, categoria_id, periodo) do update set monto = excluded.monto;
  else
    update presupuestos set monto = null
    where usuario_id = p_usuario_id and categoria_id = p_id and periodo = v_periodo;
  end if;
end;
$$;

drop function if exists eliminar_categoria(uuid, uuid, uuid);

-- Borra la categoría desde el ciclo de p_periodo (D7). Sin alcance (llamadas viejas) o 'desde'
-- en su primer ciclo: el borrado de 0017, con todo lo que tiene. 'solo': mueve a la receptora sus
-- filas de ese ciclo y escribe ahí, a nombre de la receptora, los cargos proyectados de sus
-- definiciones (p_cargos, [{ "movimiento_recurrente_id", "monto", "fecha" }], solo en un ciclo
-- futuro), y la oculta en ese ciclo; los presupuestos no cambian. 'desde': mueve a la receptora
-- sus filas de ese ciclo en adelante y todas sus definiciones, borra sus presupuestos y ocultas de
-- esos ciclos y la termina en el ciclo anterior. La receptora tiene que estar viva en el ciclo;
-- sin receptora, rechaza si el alcance alcanza alguna fila (o, con 'desde', una definición).
create function eliminar_categoria(
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
        movimiento_recurrente_id, ciclo_mes, estado
      )
      select
        p_usuario_id, (c->>'monto')::numeric, u.moneda_default, ((c->>'fecha')::date + time '12:00') at time zone 'UTC',
        p_reasignar_a, m.nombre, m.tipo, true, m.id, p_periodo, 'pendiente'
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
