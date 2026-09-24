-- Funciones del dashboard — add-supabase-data-layer-and-login (design.md D12).
-- Las operaciones que tocan más de una fila y tienen que rechazar sin dejar nada a medias:
-- supabase-js no tiene transacciones del lado del cliente, así que cada una es una función.
--
-- security invoker: corren con los permisos de quien llama, así que en la web aplica RLS
-- (with check incluido) y con service_role (el bot, más adelante) no. Por eso todas reciben
-- p_usuario_id explícito y filtran por él, sin llamar a auth.uid().
--
-- Los raise usan mensajes estables que la capa de TypeScript traduce al error del contrato:
-- duplicate-category-name, not-found, category-not-empty, invalid-order, category-required.
--
-- presupuestos: solo se escribe el ciclo actual, calculado acá adentro con
-- rango_ciclo_usuario(now()); ninguna función recibe un periodo (0018).

-- Copia los presupuestos del ciclo anterior más reciente al ciclo actual, marcas (monto null)
-- incluidas, solo si el ciclo actual no tiene ninguna fila. Un ciclo con alguna fila no se
-- vuelve a copiar nunca. Dos llamadas concurrentes pasan el not exists las dos; el unique
-- convierte la segunda en no-ops.
create or replace function copiar_presupuestos_ciclo(p_usuario_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_periodo date;
begin
  select (c.inicio at time zone u.timezone)::date into v_periodo
  from usuarios u
  cross join lateral rango_ciclo_usuario(u.id, now()) c
  where u.id = p_usuario_id;

  if v_periodo is null then
    raise exception 'not-found';
  end if;

  insert into presupuestos (usuario_id, categoria_id, monto, periodo)
  select usuario_id, categoria_id, monto, v_periodo from presupuestos
  where usuario_id = p_usuario_id
    and periodo = (
      select max(periodo) from presupuestos
      where usuario_id = p_usuario_id and periodo < v_periodo
    )
    and not exists (
      select 1 from presupuestos where usuario_id = p_usuario_id and periodo = v_periodo
    )
  on conflict (usuario_id, categoria_id, periodo) do nothing;
end;
$$;

-- Crea la categoría al final del orden. Con presupuesto, primero corre la copia: sin ella,
-- una fila nueva sola haría parecer copiado un ciclo vacío y las demás categorías perderían
-- su presupuesto.
create or replace function crear_categoria(
  p_usuario_id uuid,
  p_nombre text,
  p_color text,
  p_presupuesto numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if exists (
    select 1 from categorias
    where usuario_id = p_usuario_id and lower(trim(nombre)) = lower(trim(p_nombre))
  ) then
    raise exception 'duplicate-category-name';
  end if;

  insert into categorias (usuario_id, nombre, color, orden)
  select p_usuario_id, p_nombre, p_color, coalesce(max(orden), -1) + 1
  from categorias where usuario_id = p_usuario_id
  returning id into v_id;

  if p_presupuesto is not null then
    perform copiar_presupuestos_ciclo(p_usuario_id);

    insert into presupuestos (usuario_id, categoria_id, monto, periodo)
    select p_usuario_id, v_id, p_presupuesto, (c.inicio at time zone u.timezone)::date
    from usuarios u
    cross join lateral rango_ciclo_usuario(u.id, now()) c
    where u.id = p_usuario_id;
  end if;

  return v_id;
end;
$$;

-- Nombre, color y presupuesto del ciclo actual. Con monto, upsert de la fila del ciclo;
-- con null, la fila pasa a ser marca (si existe) y si no existe no se escribe nada. Los
-- ciclos anteriores no se tocan.
create or replace function actualizar_categoria(
  p_usuario_id uuid,
  p_id uuid,
  p_nombre text,
  p_color text,
  p_presupuesto numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_periodo date;
begin
  if exists (
    select 1 from categorias
    where usuario_id = p_usuario_id
      and id <> p_id
      and lower(trim(nombre)) = lower(trim(p_nombre))
  ) then
    raise exception 'duplicate-category-name';
  end if;

  update categorias set nombre = p_nombre, color = p_color
  where id = p_id and usuario_id = p_usuario_id;

  if not found then
    raise exception 'not-found';
  end if;

  perform copiar_presupuestos_ciclo(p_usuario_id);

  select (c.inicio at time zone u.timezone)::date into v_periodo
  from usuarios u
  cross join lateral rango_ciclo_usuario(u.id, now()) c
  where u.id = p_usuario_id;

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

-- Borra la categoría. Sin receptora, rechaza si algo la referencia (transacciones borradas
-- incluidas: el FK es restrict). Con receptora, mueve transacciones y definiciones y borra;
-- sus presupuestos de todos los ciclos caen por cascade (0006).
create or replace function eliminar_categoria(
  p_usuario_id uuid,
  p_id uuid,
  p_reasignar_a uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (select 1 from categorias where id = p_id and usuario_id = p_usuario_id) then
    raise exception 'not-found';
  end if;

  if p_reasignar_a is null then
    if exists (
      select 1 from transacciones where usuario_id = p_usuario_id and categoria_id = p_id
    ) or exists (
      select 1 from movimientos_recurrentes where usuario_id = p_usuario_id and categoria_id = p_id
    ) then
      raise exception 'category-not-empty';
    end if;
  else
    if p_reasignar_a = p_id or not exists (
      select 1 from categorias where id = p_reasignar_a and usuario_id = p_usuario_id
    ) then
      raise exception 'not-found';
    end if;

    update transacciones set categoria_id = p_reasignar_a
    where usuario_id = p_usuario_id and categoria_id = p_id;

    update movimientos_recurrentes set categoria_id = p_reasignar_a
    where usuario_id = p_usuario_id and categoria_id = p_id;
  end if;

  delete from categorias where id = p_id and usuario_id = p_usuario_id;
end;
$$;

-- Escribe el orden completo. p_ids tiene que ser, sin repetidos, exactamente el conjunto de
-- categorías del usuario; si no, no se aplica nada.
create or replace function reordenar_categorias(p_usuario_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(cardinality(p_ids), 0) <> (select count(distinct x) from unnest(p_ids) x)
    or exists (
      select id from categorias where usuario_id = p_usuario_id
      except
      select unnest(p_ids)
    )
    or exists (
      select unnest(p_ids)
      except
      select id from categorias where usuario_id = p_usuario_id
    )
  then
    raise exception 'invalid-order';
  end if;

  update categorias set orden = array_position(p_ids, id) - 1
  where usuario_id = p_usuario_id;
end;
$$;

-- Crea la definición y reclama como cargo de este ciclo la fila que creó el mismo guardado
-- en la hoja: la última transacción sin vínculo del mismo tipo, categoría, monto, nombre y
-- día local. Si reclama una, cuenta como la primera repetición (proposal, gap 5) y, como en
-- el cron (0013), un plan que llega a su total queda inactivo en la misma sentencia.
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
    where t.id = v_transaccion_id;

    update movimientos_recurrentes set
      repeticiones_insertadas = 1,
      activo = (repeticiones_totales is null or repeticiones_totales > 1)
    where id = v_id;
  end if;

  return v_id;
end;
$$;

-- Actualiza la definición y reescribe el monto del cargo vinculado del ciclo en curso solo
-- mientras está pendiente: su fecha local es posterior al hoy local (regla provisional D11,
-- la misma que isCharged en dashboard.ts, hasta que exista transacciones.estado).
-- repeticiones_totales no es parámetro: la hoja no lo edita.
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
    and t.fecha >= c.inicio
    and t.fecha < c.fin
    and (t.fecha at time zone v_tz)::date > (now() at time zone v_tz)::date;
end;
$$;

-- Borra suave todos los cargos de la definición y después la definición (el FK deja en null
-- el vínculo de las filas borradas).
create or replace function eliminar_movimiento_recurrente(p_usuario_id uuid, p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from movimientos_recurrentes where id = p_id and usuario_id = p_usuario_id
  ) then
    raise exception 'not-found';
  end if;

  update transacciones set borrado_en = now()
  where usuario_id = p_usuario_id and movimiento_recurrente_id = p_id and borrado_en is null;

  delete from movimientos_recurrentes where id = p_id and usuario_id = p_usuario_id;
end;
$$;
