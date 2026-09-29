-- 0026 — categoría "solo este mes" al crearla (add-forward-scoped-edits, pedido de Brian 2026-09-29).
--
-- La hoja de categoría pregunta al crear "Solo este mes" / "Desde este mes en adelante". Con
-- "solo este mes" la categoría nace terminada en su primer ciclo: hasta_ciclo = desde_ciclo, igual
-- que queda una categoría borrada "desde" el mes siguiente. Se hace en la misma llamada para que
-- no quede una categoría abierta si la segunda escritura fallara. p_solo_este_ciclo tiene default
-- false: la llamada de cinco argumentos sigue creando una categoría sin fin.

drop function if exists crear_categoria(uuid, text, text, numeric, date);

-- Como en 0024, más p_solo_este_ciclo.
create function crear_categoria(
  p_usuario_id uuid,
  p_nombre text,
  p_color text,
  p_presupuesto numeric,
  p_periodo date default null,
  p_solo_este_ciclo boolean default false
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

  insert into categorias (usuario_id, nombre, color, orden, desde_ciclo, hasta_ciclo)
  select p_usuario_id, p_nombre, p_color, coalesce(max(orden), -1) + 1, v_periodo,
    case when p_solo_este_ciclo then v_periodo end
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
