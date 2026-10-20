-- 0043 — Endurecer la seguridad (harden-security, 2026-10-20).
--
-- La auditoría del 2026-10-19 encontró que con su JWT una cuenta podía reescribir cualquier columna
-- de su fila de usuarios (tomar el e-mail de otra persona, sondear teléfonos y códigos de
-- vinculación), que un token OAuth de un asistente tenía el mismo poder que una sesión del navegador
-- y que anon conservaba todos los privilegios de las tablas. Esta migración:
--
--   D1  UPDATE de usuarios solo en las columnas que edita la web.
--   D2  pedir_codigo_vinculacion(): el código lo emite la base, la web ya no escribe la columna.
--   D3  Dos políticas restrictivas: un token con client_id no actualiza usuarios ni borra en duro
--       transacciones. Las sesiones del navegador no llevan client_id y no cambian.
--   D4  limites_uso + consumir_cupo (service role) + consumir_cupo_mcp (authenticated, 120/min).
--   D8  anon sin tablas ni funciones, authenticated sin truncate/trigger/references, privilegios
--       por defecto y search_path en rango_ciclo, rango_ciclo_usuario y fecha_en_ciclo.
--
-- Idempotente (se corre dos veces sin error). El service role saltea RLS y los grants por columna,
-- así que el bot y los crons no cambian. El código viejo escribe codigo_vinculacion con el JWT: entre
-- esta migración y el deploy, "Vincular WhatsApp" falla para quien no tenga un código vivo.
--
-- Vuelta atrás: grant update on usuarios to authenticated; y borrar las dos políticas
-- usuarios_update_sin_asistente y transacciones_delete_sin_asistente. Las funciones nuevas quedan.

-- D1 ------------------------------------------------------------------------------------------------

revoke update on public.usuarios from authenticated, anon;
grant update (
  nombre, pais, moneda_default, timezone, dia_inicio_ciclo, formato_montos, idioma,
  meta_ahorro_mensual, onboarding_paso, onboarding_completo, orden_widgets, medio_pago_default
) on public.usuarios to authenticated;

-- D2 ------------------------------------------------------------------------------------------------

-- El código vivo de la cuenta de la sesión (pedido hace menos de 7 días) o uno nuevo con la hora del
-- pedido. Mismo alfabeto que 0031 (32 símbolos, sin 0/O/1/I): byte % 32 no tiene sesgo. Un choque
-- con el código de otra cuenta es un unique_violation: tres sorteos de 2^30. Un token de asistente
-- no pide códigos, porque el código vincula un teléfono a la cuenta (D3).
create or replace function public.pedir_codigo_vinculacion()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_usuario uuid := usuario_actual_id();
  v_codigo text;
  v_solicitado timestamptz;
  v_bytes bytea;
begin
  if v_usuario is null or (auth.jwt() ->> 'client_id') is not null then
    raise exception 'not-found' using errcode = '42501';
  end if;

  select codigo_vinculacion, whatsapp_solicitado_en into v_codigo, v_solicitado
    from usuarios where id = v_usuario for update;
  if v_codigo is not null and v_solicitado > now() - interval '7 days' then
    return v_codigo;
  end if;

  for intento in 1..3 loop
    v_bytes := extensions.gen_random_bytes(6);
    v_codigo := '';
    for i in 0..5 loop
      v_codigo := v_codigo || substr(v_alfabeto, get_byte(v_bytes, i) % 32 + 1, 1);
    end loop;
    begin
      update usuarios set codigo_vinculacion = v_codigo, whatsapp_solicitado_en = now() where id = v_usuario;
      return v_codigo;
    exception when unique_violation then
      if intento = 3 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

revoke execute on function public.pedir_codigo_vinculacion() from public, anon;
grant execute on function public.pedir_codigo_vinculacion() to authenticated;

-- D3 ------------------------------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'usuarios_update_sin_asistente') then
    create policy usuarios_update_sin_asistente on public.usuarios
      as restrictive for update to authenticated
      using ((auth.jwt() ->> 'client_id') is null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'transacciones_delete_sin_asistente') then
    create policy transacciones_delete_sin_asistente on public.transacciones
      as restrictive for delete to authenticated
      using ((auth.jwt() ->> 'client_id') is null);
  end if;
end;
$$;

-- D4 ------------------------------------------------------------------------------------------------

-- Ventana fija por clave. RLS sin políticas: solo las funciones la tocan.
create table if not exists public.limites_uso (
  clave text primary key,
  ventana timestamptz not null,
  usos integer not null
);
alter table public.limites_uso enable row level security;
revoke all on public.limites_uso from anon, authenticated;

-- Suma un uso a p_clave y dice si sigue dentro de p_max en la ventana de p_segundos; una ventana más
-- vieja que p_segundos vuelve a empezar. Un solo insert … on conflict, así dos llamadas a la vez no
-- pierden un uso.
create or replace function public.consumir_cupo(p_clave text, p_max integer, p_segundos integer)
returns boolean
language sql
security invoker
set search_path = public
as $$
  insert into limites_uso as l (clave, ventana, usos)
  values (p_clave, now(), 1)
  on conflict (clave) do update set
    ventana = case when l.ventana <= now() - make_interval(secs => p_segundos) then now() else l.ventana end,
    usos = case when l.ventana <= now() - make_interval(secs => p_segundos) then 1 else l.usos + 1 end
  returning usos <= p_max;
$$;

revoke execute on function public.consumir_cupo(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_cupo(text, integer, integer) to service_role;

-- 120 llamadas por minuto a las herramientas del MCP, por cuenta y entre todos sus asistentes. La
-- clave sale de auth.uid(), así un token solo gasta el cupo de su cuenta.
create or replace function public.consumir_cupo_mcp()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return consumir_cupo('mcp:' || auth.uid()::text, 120, 60);
end;
$$;

revoke execute on function public.consumir_cupo_mcp() from public, anon;
grant execute on function public.consumir_cupo_mcp() to authenticated;

-- D8 ------------------------------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- Las funciones que tenían EXECUTE para public ya lo tenían explícito para authenticated; el grant
-- de abajo lo deja escrito. Incluye las que no llama la web pero sí las funciones invoker que corren
-- como authenticated (congelar_ciclos, sumar_repeticion, ciclo_anterior, fin_de_ciclo,
-- fecha_en_ciclo) y usuario_actual_id, que leen las políticas.
revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.actualizar_categoria(uuid, uuid, text, text, numeric, date, text),
  public.actualizar_movimiento_recurrente(uuid, uuid, text, numeric, integer, boolean, integer),
  public.asignar_fijos_tarjeta(uuid, uuid, uuid[]),
  public.canal_vinculado(text),
  public.categoria_viva(uuid, uuid, date),
  public.ciclo_anterior(uuid, date),
  public.congelar_ciclos(uuid, public.movimientos_recurrentes, date, jsonb),
  public.copiar_presupuestos_ciclo(uuid, date),
  public.crear_categoria(uuid, text, text, numeric, date, boolean),
  public.crear_movimiento_recurrente(uuid, text, uuid, text, numeric, integer, boolean, integer, integer, text),
  public.desvincular_canal(text),
  public.editar_cargo_en_ciclo(uuid, uuid, date, numeric, text, date, uuid, text, jsonb, text),
  public.eliminar_cargo_en_ciclo(uuid, uuid, date, text, jsonb, jsonb),
  public.eliminar_categoria(uuid, uuid, uuid, date, text, jsonb),
  public.eliminar_movimiento_recurrente(uuid, uuid),
  public.fecha_en_ciclo(date, integer),
  public.fin_de_ciclo(uuid, date),
  public.insertar_cargos_pendientes(uuid, date, jsonb),
  public.periodo_presupuesto(uuid, date),
  public.rango_ciclo(integer, text, timestamptz),
  public.rango_ciclo_usuario(uuid, timestamptz),
  public.reordenar_categorias(uuid, uuid[]),
  public.restaurar_cargo_en_ciclo(uuid, uuid, date),
  public.sumar_repeticion(uuid, uuid, date),
  public.usuario_actual_id()
to authenticated;

-- Lo que creen las migraciones siguientes (dueño postgres) nace sin anon ni public.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

alter function public.rango_ciclo(integer, text, timestamptz) set search_path = public;
alter function public.rango_ciclo_usuario(uuid, timestamptz) set search_path = public;
alter function public.fecha_en_ciclo(date, integer) set search_path = public;
