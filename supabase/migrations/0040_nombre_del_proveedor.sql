-- 0040 — add-google-login (design.md D4): la cuenta nueva toma el nombre que da el proveedor.
--
-- Mismo cuerpo que la 0025 salvo el nombre: full_name (o name) de raw_user_meta_data, que Supabase
-- llena con el perfil de Google, recortado a 60; si no hay o está vacío, la parte antes del @, como
-- hasta ahora. Una cuenta por código no trae ninguno de los dos, así que no cambia. Los dos
-- triggers de la 0025 siguen apuntando a esta función y no se tocan. Va antes del deploy, pero el
-- código no depende de ella: sin aplicarla, una cuenta de Google se llama como su dirección.
create or replace function public.crear_usuario_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_idioma text;
  v_timezone text;
  v_nombre text;
begin
  begin
    v_idioma := new.raw_user_meta_data ->> 'idioma';
    if v_idioma is null or v_idioma not in ('es', 'en') then
      v_idioma := 'es';
    end if;

    v_timezone := new.raw_user_meta_data ->> 'timezone';
    if v_timezone is null
      or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
      v_timezone := 'UTC';
    end if;

    v_nombre := pg_catalog.left(
      coalesce(
        nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'name'), ''),
        pg_catalog.split_part(new.email, '@', 1)
      ),
      60
    );

    insert into public.usuarios (auth_user_id, email, nombre, timezone, moneda_default, idioma)
    values (
      new.id,
      new.email,
      v_nombre,
      v_timezone,
      'EUR',
      v_idioma
    )
    on conflict do nothing;
  exception when others then
    raise warning 'crear_usuario_desde_auth: auth user % sin fila en usuarios: % (%)',
      new.id, sqlerrm, sqlstate;
  end;

  return new;
end;
$$;

comment on function public.crear_usuario_desde_auth() is
  'Trigger sobre auth.users: crea la fila de usuarios cuando el e-mail queda confirmado, con el nombre del proveedor si lo hay. Nunca lanza (open-web-signup D3, add-google-login D4).';

revoke execute on function public.crear_usuario_desde_auth() from public, anon, authenticated;
