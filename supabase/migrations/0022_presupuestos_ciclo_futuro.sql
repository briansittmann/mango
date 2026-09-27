-- Presupuestos de un ciclo futuro — add-cycle-projection-and-recurring-cron (design.md D5, D7).
--
-- Hasta acá solo se escribía el ciclo en curso (0017, 0018). Ahora la proyección deja editar el
-- presupuesto de uno de los seis ciclos siguientes (category-editing → Budgets belong to one
-- cycle):
--   - antes de escribir un ciclo futuro sin filas, se materializa: se le copian las filas que
--     hereda, así la categoría editada no queda sola en él;
--   - 'desde': se escribe solo ese ciclo; los siguientes sin filas propias lo heredan;
--   - 'solo': además, si el ciclo siguiente no tiene filas, se materializa con lo que heredaba
--     antes de la edición, y la categoría editada recibe ahí una marca (monto null) si no tenía
--     fila, así la edición no pasa al mes siguiente aunque no hubiera nada que heredar.
-- Un periodo null o pasado escribe el ciclo en curso, como antes; el ciclo en curso y los
-- anteriores nunca se tocan desde un ciclo futuro.
--
-- actualizar_categoria y copiar_presupuestos_ciclo cambian de firma: se borran y se crean de
-- nuevo en esta migración, así PostgREST tiene un solo candidato y el código desplegado
-- (llamadas con los argumentos viejos, el resto por default) sigue andando.
-- Mensajes estables de raise nuevos: invalid-period, invalid-scope.

-- Periodo de una escritura de presupuestos. Null, el ciclo en curso o uno anterior → el ciclo
-- en curso. Un periodo posterior tiene que ser el primer día de uno de los seis ciclos
-- siguientes; si no, invalid-period.
create or replace function periodo_presupuesto(p_usuario_id uuid, p_periodo date)
returns date
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tz text;
  v_dia int;
  v_actual date;
  v_ref timestamptz;
  v_inicio timestamptz;
begin
  select u.timezone, u.dia_inicio_ciclo, (c.inicio at time zone u.timezone)::date, c.fin
  into v_tz, v_dia, v_actual, v_ref
  from usuarios u
  cross join lateral rango_ciclo(u.dia_inicio_ciclo, u.timezone, now()) c
  where u.id = p_usuario_id;

  if v_tz is null then
    raise exception 'not-found';
  end if;

  if p_periodo is null or p_periodo <= v_actual then
    return v_actual;
  end if;

  for i in 1..6 loop
    select c.inicio, c.fin into v_inicio, v_ref from rango_ciclo(v_dia, v_tz, v_ref) c;
    if (v_inicio at time zone v_tz)::date = p_periodo then
      return p_periodo;
    end if;
  end loop;

  raise exception 'invalid-period';
end;
$$;

drop function if exists copiar_presupuestos_ciclo(uuid);

-- Copia al ciclo de p_periodo (null = el ciclo en curso; ver periodo_presupuesto) las filas del
-- ciclo anterior más reciente que tenga alguna, marcas incluidas, solo si ese ciclo no tiene
-- ninguna fila. Para un ciclo futuro es la materialización previa a editarlo. Dos llamadas
-- concurrentes pasan el not exists las dos; el unique convierte la segunda en no-ops.
create function copiar_presupuestos_ciclo(p_usuario_id uuid, p_periodo date default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_periodo date := periodo_presupuesto(p_usuario_id, p_periodo);
begin
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

drop function if exists actualizar_categoria(uuid, uuid, text, text, numeric);

-- Nombre, color y presupuesto del ciclo de p_periodo (ver periodo_presupuesto). Con monto,
-- upsert de la fila del ciclo; con null, la fila pasa a ser marca (si existe) y si no existe
-- no se escribe nada. Un ciclo futuro exige p_alcance ('solo' | 'desde'); en el ciclo en curso
-- se ignora.
create function actualizar_categoria(
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

comment on column presupuestos.periodo is
  'Primer día (fecha local) del ciclo de facturación, calculado con rango_ciclo_usuario; una fila por categoría por ciclo. Cuando un ciclo pasa a ser el actual y no tiene filas (marcas incluidas), se copian todas las filas del ciclo anterior más reciente que tenga alguna, marcas incluidas; un ciclo futuro sin filas se lee con esas mismas filas sin escribirlas. Crear escribe solo el ciclo actual. Editar escribe el ciclo actual, o uno de los seis siguientes: antes se le copian las filas que hereda, y con alcance ''solo'' también al ciclo que le sigue si no tiene filas (0022). Borrar un presupuesto escribe una marca (monto null); borrar la categoría borra sus filas de todos los ciclos.';
