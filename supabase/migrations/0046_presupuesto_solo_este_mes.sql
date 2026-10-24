-- 0046 — "Solo este mes" para el presupuesto del ciclo en curso (2026-10-24, sin change).
--
-- Hasta ahora la hoja de categoría preguntaba el alcance de un presupuesto solo en una proyección;
-- en el ciclo en curso el cambio lo heredaban todos los ciclos siguientes sin filas propias. Ahora
-- la hoja pregunta también en el ciclo en curso ("Solo este mes" preseleccionado), y 'solo' hace
-- lo mismo que en una proyección: si el ciclo siguiente no tiene filas, le escribe las que
-- heredaba antes del cambio. 'desde' y la llamada sin alcance siguen como en la 0024.
--
-- Solo reemplaza actualizar_categoria (misma firma, mismos permisos). Va antes del deploy: el
-- código viejo nunca manda alcance en el ciclo en curso, así que no le cambia nada. Vuelta atrás:
-- la definición de la 0024.

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
  end if;

  -- Desde un ciclo pasado v_periodo es el ciclo en curso, pero el alcance solo se pregunta en el
  -- ciclo en curso o en una proyección.
  if p_alcance = 'solo' and (p_periodo is null or p_periodo >= v_actual) then
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
