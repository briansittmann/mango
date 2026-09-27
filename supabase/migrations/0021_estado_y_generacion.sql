-- Estado de los movimientos y generación de ciclos — add-cycle-projection-and-recurring-cron
-- (design.md D3, D4, D5, Q1).
--
-- transacciones.estado reemplaza la regla provisoria "cobrado cuando su fecha local no es
-- posterior a hoy" (isCharged en dashboard.ts y actualizar_movimiento_recurrente en 0017). Las
-- filas existentes se clasifican con esa misma regla, así la pantalla no cambia el día que
-- esto se aplica. Solo el cron crea filas pendientes; todo lo demás nace confirmado (default).
--
-- usuarios.ciclo_generado_hasta decide si un ciclo ya se generó (D3): el cron genera cada
-- ciclo posterior a la marca hasta el ciclo en curso, así una corrida perdida se recupera y un
-- ciclo nunca se genera dos veces.
--
-- generar_ciclo, cerrar_pendientes y completar_cargo_recurrente son security invoker y sin
-- execute para public, anon ni authenticated: solo el service role (cron, bot) las llama.
-- Mensajes estables de raise: not-found, invalid-period, future-cycle, invalid-date,
-- already-confirmed, plan-completed.

-- 1. transacciones.estado ---------------------------------------------------------------

alter table transacciones
  add column if not exists estado text not null default 'confirmada'
    check (estado in ('pendiente', 'confirmada'));

update transacciones t set estado = 'pendiente'
from usuarios u
where u.id = t.usuario_id
  and t.movimiento_recurrente_id is not null
  and t.borrado_en is null
  and (t.fecha at time zone u.timezone)::date > (now() at time zone u.timezone)::date;

create index if not exists transacciones_pendientes_idx
  on transacciones (usuario_id, ciclo_mes) where estado = 'pendiente';

comment on column transacciones.estado is
  'pendiente | confirmada. Solo el cron (generar_ciclo) inserta filas pendientes, a su monto esperado; todo lo demás nace confirmado. Una fila confirmada nunca vuelve a pendiente. Se confirma al guardarla desde su fila (la conciliación), con completar_cargo_recurrente, o al cerrar su ciclo (cerrar_pendientes). La pantalla la muestra cobrada si está confirmada o si su día local ya pasó (Q4).';

comment on column transacciones.ciclo_mes is
  'Inicio (fecha local) del ciclo de facturación al que pertenece un cargo vinculado a un movimiento recurrente: lo escriben el cron (generar_ciclo), crear_movimiento_recurrente al reclamar el cargo del ciclo, completar_cargo_recurrente y los seeds. Null en cargas sueltas. Respalda el unique (movimiento_recurrente_id, ciclo_mes): un cargo por definición por ciclo, filas borradas incluidas.';

-- 2. usuarios.ciclo_generado_hasta ------------------------------------------------------

alter table usuarios add column if not exists ciclo_generado_hasta date;

update usuarios u set ciclo_generado_hasta = t.max_ciclo
from (
  select usuario_id, max(ciclo_mes) as max_ciclo
  from transacciones
  where movimiento_recurrente_id is not null
  group by usuario_id
) t
where t.usuario_id = u.id and u.ciclo_generado_hasta is null;

comment on column usuarios.ciclo_generado_hasta is
  'Primer día (fecha local) del último ciclo cuyos cargos recurrentes ya se insertaron. El cron genera cada ciclo posterior hasta el ciclo en curso y la mueve en la misma operación (generar_ciclo); null = nunca generado, el cron arranca por el ciclo en curso. La proyección cuenta los ciclos futuros desde acá.';

-- 3. movimientos_recurrentes.dia_del_mes not null (Q1) ----------------------------------

do $$
begin
  if exists (select 1 from movimientos_recurrentes where dia_del_mes is null) then
    raise exception 'movimientos_recurrentes tiene filas con dia_del_mes null: completarlas antes de aplicar 0021';
  end if;
end;
$$;

alter table movimientos_recurrentes alter column dia_del_mes set not null;

-- 4. Funciones ---------------------------------------------------------------------------

-- Valida que p_periodo sea el primer día (local) de un ciclo del usuario que no sea posterior
-- al ciclo en curso, y devuelve el primer día del ciclo siguiente (fin exclusivo, local).
create or replace function fin_ciclo_generable(p_usuario_id uuid, p_periodo date)
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
  v_actual date;
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

  select (c.inicio at time zone v_tz)::date into v_actual from rango_ciclo_usuario(p_usuario_id, now()) c;

  if p_periodo > v_actual then
    raise exception 'future-cycle';
  end if;

  return v_fin;
end;
$$;

-- Genera un ciclo: inserta los cargos que calculó proyectarCiclo (lib/data/projection.ts) como
-- pendientes, cuenta solo los que se insertaron y mueve la marca, todo en una transacción.
-- p_cargos: [{ "movimiento_recurrente_id": uuid, "monto": number, "fecha": "YYYY-MM-DD" }],
-- fecha local dentro del ciclo. Descripción, tipo y categoría salen de la definición.
-- Un ciclo ya generado (marca >= p_periodo) devuelve 0 sin escribir: una corrida repetida o
-- concurrente es un no-op (el for update las serializa). El filtro por activo y repeticiones se
-- repite acá, así una entrada vieja nunca cuenta de más; on conflict deja en paz la fila que ya
-- ocupa el lugar (del seed, de la hoja o borrada) y esa definición no se cuenta de nuevo.
-- Contar y desactivar van en el mismo update (regla del 0013). Devuelve las filas insertadas.
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
    returning movimiento_recurrente_id
  )
  update movimientos_recurrentes m set
    repeticiones_insertadas = m.repeticiones_insertadas + 1,
    activo = (m.repeticiones_totales is null or m.repeticiones_insertadas + 1 < m.repeticiones_totales)
  from insertados i
  where m.id = i.movimiento_recurrente_id;

  get diagnostics v_insertadas = row_count;

  update usuarios set ciclo_generado_hasta = p_periodo where id = p_usuario_id;

  return v_insertadas;
end;
$$;

-- Confirma a su monto actual cada fila pendiente de un ciclo que ya terminó en el timezone del
-- usuario. Nada más de la fila cambia. Devuelve cuántas cerró.
create or replace function cerrar_pendientes(p_usuario_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tz text;
  v_actual date;
  v_cerradas integer;
begin
  select u.timezone, (c.inicio at time zone u.timezone)::date into v_tz, v_actual
  from usuarios u
  cross join lateral rango_ciclo_usuario(u.id, now()) c
  where u.id = p_usuario_id;

  if v_tz is null then
    raise exception 'not-found';
  end if;

  update transacciones set estado = 'confirmada'
  where usuario_id = p_usuario_id
    and estado = 'pendiente'
    and coalesce(ciclo_mes, (fecha at time zone v_tz)::date) < v_actual;

  get diagnostics v_cerradas = row_count;
  return v_cerradas;
end;
$$;

-- Para el bot (bloque 5): completa el cargo de una definición en un ciclo. Si hay fila
-- pendiente, la confirma con monto y fecha (local) dados; si no hay fila, inserta una
-- confirmada vinculada y la cuenta como generar_ciclo. Una fila confirmada o borrada en ese
-- lugar rechaza con already-confirmed; insertar en un plan sin repeticiones o inactivo, con
-- plan-completed. Devuelve el id de la fila.
create or replace function completar_cargo_recurrente(
  p_usuario_id uuid,
  p_movimiento_id uuid,
  p_periodo date,
  p_monto numeric,
  p_fecha date
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
      estado = 'confirmada'
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
    movimiento_recurrente_id, ciclo_mes, estado
  )
  select
    p_usuario_id, p_monto, u.moneda_default, (p_fecha + time '12:00') at time zone 'UTC',
    v_def.categoria_id, v_def.nombre, v_def.tipo, v_def.tipo = 'gasto', v_def.id, p_periodo, 'confirmada'
  from usuarios u
  where u.id = p_usuario_id
  returning id into v_id;

  update movimientos_recurrentes set
    repeticiones_insertadas = repeticiones_insertadas + 1,
    activo = (repeticiones_totales is null or repeticiones_insertadas + 1 < repeticiones_totales)
  where id = p_movimiento_id;

  return v_id;
end;
$$;

revoke execute on function fin_ciclo_generable(uuid, date) from public, anon, authenticated;
revoke execute on function generar_ciclo(uuid, date, jsonb) from public, anon, authenticated;
revoke execute on function cerrar_pendientes(uuid) from public, anon, authenticated;
revoke execute on function completar_cargo_recurrente(uuid, uuid, date, numeric, date) from public, anon, authenticated;

-- Actualiza la definición y reescribe el monto del cargo vinculado del ciclo en curso solo
-- mientras la pantalla lo muestra pendiente: estado pendiente y fecha local posterior a hoy
-- (D4). Un pendiente cuyo día ya pasó se muestra cobrado a ese monto y no se toca.
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
    and t.estado = 'pendiente'
    and t.fecha >= c.inicio
    and t.fecha < c.fin
    and (t.fecha at time zone v_tz)::date > (now() at time zone v_tz)::date;
end;
$$;
