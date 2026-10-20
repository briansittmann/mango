-- 0044 — Tope diario de movimientos nuevos (2026-10-20, sin change).
--
-- Con asistentes conectados por MCP, un bucle o un pedido mal entendido puede cargar cientos de
-- movimientos. El tope cuenta las altas del MCP (add_movement) y del bot (cada carga) por cuenta y
-- por día local de la cuenta: 100 por día, y 500 durante los primeros 7 días de la cuenta, para que
-- quien empieza pueda pasar su planilla de una vez. La web no cuenta: ahí carga la persona a mano.
-- Usa consumir_cupo y limites_uso de la 0043; el cron borra las claves de más de un día.
--
-- Aditiva: el código en producción no la llama. Vuelta atrás:
-- drop function consumir_cupo_altas(); drop function consumir_cupo_altas_usuario(uuid);

-- Service role (el bot): una alta de p_usuario_id hoy; false pasado el tope del día.
create or replace function public.consumir_cupo_altas_usuario(p_usuario_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timezone text;
  v_creada timestamptz;
begin
  select u.timezone, a.created_at into v_timezone, v_creada
    from usuarios u join auth.users a on a.id = u.auth_user_id
    where u.id = p_usuario_id;
  if v_timezone is null then
    return false;
  end if;
  return consumir_cupo(
    'altas:' || p_usuario_id::text || ':' || (now() at time zone v_timezone)::date::text,
    case when v_creada > now() - interval '7 days' then 500 else 100 end,
    86400
  );
end;
$$;

revoke execute on function public.consumir_cupo_altas_usuario(uuid) from public, anon, authenticated;
grant execute on function public.consumir_cupo_altas_usuario(uuid) to service_role;

-- Authenticated (el MCP, con el token de la persona): la misma alta, solo para la cuenta de la sesión.
create or replace function public.consumir_cupo_altas()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := usuario_actual_id();
begin
  if v_usuario is null then
    return false;
  end if;
  return consumir_cupo_altas_usuario(v_usuario);
end;
$$;

revoke execute on function public.consumir_cupo_altas() from public, anon;
grant execute on function public.consumir_cupo_altas() to authenticated;
