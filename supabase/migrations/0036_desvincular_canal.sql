-- 0036 — Desvincular un canal desde la web (2026-10-14, sin change).
--
-- Con número propio de WhatsApp cualquiera vincula su teléfono, así que quien cambia de número
-- necesita soltar el viejo: hasta ahora la única salida era borrar la cuenta (deuda de
-- add-whatsapp-linking). desvincular_canal borra el canal p_tipo de la cuenta de la sesión y, si es
-- WhatsApp, su teléfono (que vincular_canal había pisado con el del canal). Después, la cuenta
-- vuelve a "sin vincular" y vincula el número nuevo con un código nuevo, como la primera vez.
--
-- security definer por lo mismo que canal_vinculado (0031): canales tiene RLS sin políticas. Solo
-- toca filas de usuario_actual_id(); sin sesión no hace nada. Nada referencia a canales, así que el
-- borrado no arrastra otra cosa: las transacciones guardan el canal como texto y los mensajes
-- cuelgan del usuario.
--
-- Aditiva: el código en producción no la llama. Vuelta atrás: drop function desvincular_canal(text);

create or replace function desvincular_canal(p_tipo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := usuario_actual_id();
begin
  if v_usuario is null then
    return;
  end if;

  delete from canales where usuario_id = v_usuario and tipo = p_tipo;

  if p_tipo = 'whatsapp' then
    update usuarios set telefono = null where id = v_usuario;
  end if;
end;
$$;

comment on function desvincular_canal(text) is
  'Web: borra el canal p_tipo de la cuenta de la sesión y, si es whatsapp, su usuarios.telefono. security definer porque canales tiene RLS sin políticas; solo toca la cuenta de usuario_actual_id(). Después se vincula otro número con un código nuevo.';

revoke execute on function desvincular_canal(text) from public, anon;
grant execute on function desvincular_canal(text) to authenticated;
