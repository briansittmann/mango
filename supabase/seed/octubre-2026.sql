-- Respaldo de octubre 2026 — add-cycle-projection-and-recurring-cron (design.md D10).
--
-- Script suelto, NO es una migración: solo se corre si el cron no está en producción el
-- 1 de octubre de 2026 (punto de decisión: la noche del 30 de septiembre, tasks 2.6). Inserta
-- los cargos de octubre de cada definición activa con repeticiones pendientes, pendientes si
-- ya existe transacciones.estado, los cuenta con la regla del 0013 y mueve
-- usuarios.ciclo_generado_hasta si ya existe. Así el cron, cuando llegue, encuentra octubre
-- generado y no inserta ni cuenta de nuevo (y si la 0021 se aplica después, su back-fill toma
-- la marca de max(ciclo_mes)).
--
-- Cómo correrlo: reemplazar el e-mail, correrlo después de la medianoche local del 1 de
-- octubre. Se niega a correr si octubre ya tiene algún cargo vinculado o si la marca ya es
-- 2026-10-01, y antes del 1 de octubre local. v_ensayo := true lo corre igual antes de fecha
-- y termina en raise con el resumen: no queda nada escrito.
--
-- La fecha de cada cargo sigue la regla de proyectarCiclo (D1): un día >= el día de inicio del
-- ciclo cae en el mes del inicio, uno menor en el mes siguiente, y un día que el mes no tiene
-- cae en su último día.

do $$
declare
  v_email text := 'brian@example.com'; -- ← reemplazar por el e-mail de la cuenta
  v_ensayo boolean := false;           -- ← true: corre, informa y deshace todo
  v_periodo date := '2026-10-01';
  v_usuario usuarios%rowtype;
  v_hoy date;
  v_tiene_estado boolean;
  v_tiene_marca boolean;
  v_marca date;
  v_ids uuid[];
  v_resumen text;
begin
  select * into v_usuario from usuarios where email = v_email;
  if v_usuario.id is null then
    raise exception 'No existe un usuario con el e-mail %.', v_email;
  end if;

  v_hoy := (now() at time zone v_usuario.timezone)::date;
  if v_hoy < v_periodo and not v_ensayo then
    raise exception 'Hoy es % en %: el script corre desde el %.', v_hoy, v_usuario.timezone, v_periodo;
  end if;

  if exists (
    select 1 from transacciones
    where usuario_id = v_usuario.id and movimiento_recurrente_id is not null and ciclo_mes = v_periodo
  ) then
    raise exception 'Octubre ya tiene cargos vinculados: no se corre.';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transacciones' and column_name = 'estado'
  ) into v_tiene_estado;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usuarios' and column_name = 'ciclo_generado_hasta'
  ) into v_tiene_marca;

  if v_tiene_marca then
    execute 'select ciclo_generado_hasta from usuarios where id = $1' into v_marca using v_usuario.id;
    if v_marca >= v_periodo then
      raise exception 'La marca ya es %: octubre está generado.', v_marca;
    end if;
  end if;

  with cargos as (
    select m.*, case
      when m.dia_del_mes >= v_usuario.dia_inicio_ciclo then date_trunc('month', v_periodo)::date
      else (date_trunc('month', v_periodo) + interval '1 month')::date
    end as mes
    from movimientos_recurrentes m
    where m.usuario_id = v_usuario.id
      and m.activo
      and m.tipo in ('gasto', 'ingreso')
      and (m.repeticiones_totales is null or m.repeticiones_insertadas < m.repeticiones_totales)
  ),
  insertados as (
    insert into transacciones (
      usuario_id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo,
      movimiento_recurrente_id, ciclo_mes
    )
    select
      v_usuario.id, c.monto_actual, v_usuario.moneda_default,
      ((c.mes + (least(coalesce(c.dia_del_mes, 1), extract(day from (c.mes + interval '1 month' - interval '1 day'))::integer) - 1))
        + time '12:00') at time zone 'UTC',
      c.categoria_id, c.nombre, c.tipo, c.tipo = 'gasto', c.id, v_periodo
    from cargos c
    on conflict (movimiento_recurrente_id, ciclo_mes) do nothing
    returning movimiento_recurrente_id
  )
  select array_agg(movimiento_recurrente_id) into v_ids from insertados;

  update movimientos_recurrentes set
    repeticiones_insertadas = repeticiones_insertadas + 1,
    activo = (repeticiones_totales is null or repeticiones_insertadas + 1 < repeticiones_totales)
  where id = any(v_ids);

  if v_tiene_estado then
    execute 'update transacciones set estado = ''pendiente'' where movimiento_recurrente_id = any($1) and ciclo_mes = $2'
      using v_ids, v_periodo;
  end if;

  if v_tiene_marca then
    execute 'update usuarios set ciclo_generado_hasta = $2 where id = $1' using v_usuario.id, v_periodo;
  end if;

  select
    count(*) || ' cargos, ' || min((t.fecha at time zone v_usuario.timezone)::date) || '..'
      || max((t.fecha at time zone v_usuario.timezone)::date) || ' | '
      || coalesce((
        select string_agg(m.nombre || ' ' || m.repeticiones_insertadas || '/' || m.repeticiones_totales
          || case when m.activo then '' else ' inactivo' end, ', ' order by m.nombre)
        from movimientos_recurrentes m
        where m.usuario_id = v_usuario.id and m.repeticiones_totales is not null
      ), '-')
  into v_resumen
  from transacciones t
  where t.usuario_id = v_usuario.id and t.ciclo_mes = v_periodo;

  if v_ensayo then
    raise exception 'ENSAYO (nada escrito): %', v_resumen;
  end if;

  raise notice 'Octubre generado: %', v_resumen;
end;
$$;
