-- 0047 — El bot revive el cargo de un fijo borrado "solo este mes" (2026-10-26, sin change).
--
-- Hasta ahora completar_cargo_recurrente rechazaba con 'already-confirmed' tanto un cargo
-- confirmado como uno borrado en blando, y el bot contestaba "ya está anotado" aunque el cargo
-- del ciclo estuviera borrado (Lightroom de Brian, 26/10). Ahora un cargo borrado se revive: deja
-- de estar borrado y queda confirmado con el monto, la fecha, el canal y el mensaje de la carga,
-- igual que un pendiente. El lugar ya contaba su repetición al borrarse (sumar_repeticion), así
-- que no se vuelve a sumar. Solo un cargo confirmado sigue rechazando con 'already-confirmed'.
--
-- Solo reemplaza completar_cargo_recurrente (misma firma, mismos permisos de la 0041). El código
-- no cambia por esto. Vuelta atrás: la definición de la 0041.

create or replace function completar_cargo_recurrente(
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
    if v_fila.estado = 'confirmada' and v_fila.borrado_en is null then
      raise exception 'already-confirmed';
    end if;

    update transacciones set
      monto = p_monto,
      fecha = (p_fecha + time '12:00') at time zone 'UTC',
      estado = 'confirmada',
      borrado_en = null,
      no_cobrado = false,
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
