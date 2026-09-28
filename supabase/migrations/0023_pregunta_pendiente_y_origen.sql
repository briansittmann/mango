-- 0023 — add-bot-parser-and-logging (design.md D5, D7).
--
-- 1. canales.pregunta_pendiente / pregunta_vence_en: la pregunta de categoría que el bot dejó
--    abierta en ese canal ("gasté 50" → ¿en qué categoría?). Una función de Vercel no guarda nada
--    entre dos llamadas al webhook, así que la pregunta vive en la fila del canal, una por canal,
--    30 minutos (PENDING_QUESTION_TTL_MS en lib/data/channels.ts). canales ya tiene RLS sin
--    políticas: solo el cliente admin la lee o escribe. Nullable, sin back-fill.
-- 2. completar_cargo_recurrente con p_canal y p_mensaje_id_externo: sin ellos, un cargo fijo
--    completado desde el chat no guarda la clave de idempotencia y un reintento de Meta chocaría
--    con already-confirmed y se respondería dos veces. Se escriben en la rama update y en la
--    rama insert. Se borra la firma de 0021: el cron no la llama (usa generar_ciclo).

-- 1. Pregunta pendiente ------------------------------------------------------------------

alter table canales add column if not exists pregunta_pendiente jsonb;
alter table canales add column if not exists pregunta_vence_en timestamptz;

comment on column canales.pregunta_pendiente is
  'Pregunta de categoría abierta en este canal: { tipo, monto, diasAtras }. La escribe el adaptador cuando el bot repregunta y la borra con cualquier otra respuesta; una nueva reemplaza a la anterior. Null = ninguna.';

comment on column canales.pregunta_vence_en is
  'Hasta cuándo vale pregunta_pendiente (30 minutos desde que se hizo). Vencida, el adaptador la lee como ausente.';

-- 2. completar_cargo_recurrente con origen -----------------------------------------------

drop function if exists completar_cargo_recurrente(uuid, uuid, date, numeric, date);

-- Para el bot (bloque 5): completa el cargo de una definición en un ciclo. Si hay fila
-- pendiente, la confirma con monto y fecha (local) dados; si no hay fila, inserta una
-- confirmada vinculada y la cuenta como generar_ciclo. Una fila confirmada o borrada en ese
-- lugar rechaza con already-confirmed; insertar en un plan sin repeticiones o inactivo, con
-- plan-completed. p_canal y p_mensaje_id_externo (juntos o ninguno, como el check de
-- transacciones) quedan en la fila en las dos ramas. Devuelve el id de la fila.
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

  update movimientos_recurrentes set
    repeticiones_insertadas = repeticiones_insertadas + 1,
    activo = (repeticiones_totales is null or repeticiones_insertadas + 1 < repeticiones_totales)
  where id = p_movimiento_id;

  return v_id;
end;
$$;

revoke execute on function completar_cargo_recurrente(uuid, uuid, date, numeric, date, text, text)
  from public, anon, authenticated;
