-- 0029 — add-web-onboarding (design.md D9, D11, D12, D18).
--
-- 1. usuarios.onboarding_paso: el paso pendiente del onboarding web (1 bienvenida … 7 WhatsApp).
--    /onboarding abre en ese paso; cada avance o retroceso lo escribe. Las filas existentes
--    quedan en 1, que no se lee mientras onboarding_completo sea true (Brian).
-- 2. usuarios.formato_montos: cómo se leen los montos en la web y en el bot, 'completo'
--    ($ 350.000) o 'abreviado' ($ 350k). Solo rige cuando pais = 'AR' (effectiveAmountFormat en
--    lib/data/amount-format.ts); para cualquier otro país se lee completo aunque la columna diga
--    otra cosa.
-- 3. usuarios.codigo_invitacion y usuarios.whatsapp_solicitado_en: lo que deja la pantalla de
--    cierre cuando la persona pide vincular WhatsApp. El bloque 10 valida el código contra
--    invitaciones y manda la plantilla de Meta; hasta entonces solo se guarda. El número va en
--    usuarios.telefono (su unique hace que un número de otra cuenta rechace).
-- 4. insertar_cargos_pendientes: un tercer escritor de cargos, junto a generar_ciclo (cron) y
--    completar_cargo_recurrente (bot). Existe porque el onboarding crea definiciones en el ciclo en
--    curso y el dashboard de ese ciclo muestra solo filas reales: sin esta función, la persona
--    terminaría el onboarding y vería un margen distinto al del paso 5 hasta las 05:00 UTC, o
--    nunca en este ciclo si el cron ya lo generó (generar_ciclo devuelve 0 con la marca puesta).
--    editar_cargo_en_ciclo no sirve porque en el ciclo en curso inserta la fila confirmada.
--    Se mantiene consistente con generar_ciclo así:
--      - inserta exactamente las columnas que generar_ciclo escribe, pendientes, a monto esperado,
--        con el mismo filtro (activa, gasto|ingreso, cuotas no agotadas) y el mismo distinct on;
--      - on conflict (movimiento_recurrente_id, ciclo_mes) do nothing: un lugar ya ocupado (por el
--        cron, por la hoja, borrado) se deja en paz, así una segunda llamada no inserta nada;
--      - cuenta con sumar_repeticion, que solo suma si el ciclo ya se generó; en un ciclo por
--        generar lo cuenta generar_ciclo al generarlo, porque esa definición ya tiene lugar ahí
--        (regla D4 de add-forward-scoped-edits). Cada lugar cuenta una vez, nunca dos;
--      - nunca escribe la marca usuarios.ciclo_generado_hasta: el cron sigue siendo su dueño.
--    security invoker y sin revoke: la llama el usuario logueado y RLS acota cada fila a las suyas.
-- Mensajes estables de raise: not-found, invalid-period, invalid-date.

-- 1. Columnas ------------------------------------------------------------------------------

alter table usuarios
  add column if not exists onboarding_paso integer not null default 1
    check (onboarding_paso between 1 and 7);

alter table usuarios
  add column if not exists formato_montos text not null default 'completo'
    check (formato_montos in ('completo', 'abreviado'));

alter table usuarios
  add column if not exists codigo_invitacion text
    check (codigo_invitacion is null or char_length(codigo_invitacion) between 4 and 32);

alter table usuarios
  add column if not exists whatsapp_solicitado_en timestamptz;

comment on column usuarios.onboarding_paso is
  'Paso pendiente del onboarding web (1 = bienvenida, 2 = datos, 3 = categorías, 4 = fijos, 5 = presupuestos, 6 = ahorro, 7 = WhatsApp). /onboarding abre acá; cada avance o retroceso lo escribe. No se lee con onboarding_completo = true.';

comment on column usuarios.formato_montos is
  'completo ($ 350.000) | abreviado ($ 350k). Rige solo con pais = AR (effectiveAmountFormat); para otro país se lee completo aunque diga abreviado. Lo elige el paso 2 del onboarding y la hoja Cuenta.';

comment on column usuarios.codigo_invitacion is
  'Código de invitación escrito en la pantalla de cierre del onboarding, recortado y en mayúsculas. Se guarda sin validar hasta el bloque 10. Null = no pidió WhatsApp o no hacía falta código.';

comment on column usuarios.whatsapp_solicitado_en is
  'Cuándo pidió vincular WhatsApp desde el onboarding (número en telefono, código en codigo_invitacion). Nada se manda hasta el bloque 10 (lib/whatsapp/link-request.ts). Null = no lo pidió.';

-- 2. Cargos pendientes desde el onboarding ---------------------------------------------------

-- p_cargos: [{ "movimiento_recurrente_id": uuid, "monto": number, "fecha": "YYYY-MM-DD" }], lo
-- que calculó proyectarCiclo (lib/data/projection.ts) para el ciclo que empieza en p_periodo,
-- igual que recibe generar_ciclo. p_periodo tiene que ser el ciclo en curso o uno de los seis
-- siguientes (fin_de_ciclo valida que sea un inicio de ciclo). Devuelve las filas insertadas.
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
  loop
    perform sumar_repeticion(p_usuario_id, v_movimiento, p_periodo);
    v_insertadas := v_insertadas + 1;
  end loop;

  return v_insertadas;
end;
$$;

comment on function insertar_cargos_pendientes(uuid, date, jsonb) is
  'Onboarding web: inserta como pendientes los cargos del ciclo (ciclo en curso o posterior) de las definiciones activas del usuario que no tienen lugar en él, con las columnas de generar_ciclo, y suma la repetición solo si el ciclo ya se generó. No toca la marca del cron. Idempotente. Devuelve las filas insertadas.';
