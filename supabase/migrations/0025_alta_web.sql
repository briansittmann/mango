-- 0025 — open-web-signup (design.md D1–D3).
--
-- 1. usuarios.pais pasa a nullable: ningún código lo lee y el onboarding del bloque 9 lo
--    pregunta. Inventar un país para las cuentas nuevas parecería un dato.
-- 2. crear_usuario_desde_auth y dos triggers sobre auth.users: la fila de usuarios nace cuando
--    el e-mail de un auth user queda confirmado, no cuando se crea el auth user. Con
--    shouldCreateUser: true, Supabase inserta el auth user al pedir el código, sin confirmar;
--    un trigger "after insert" le daría una fila a cualquier dirección que alguien escriba. Así,
--    solo quien leyó el código de ese buzón tiene fila. Dos caminos: el auth user que se crea ya
--    confirmado (admin, OAuth del bloque 13) y el que pasa de null a confirmado con su primer
--    código. El insert corre en la misma transacción que confirma el e-mail, así que cuando
--    /auth/verify-code responde ok la fila ya existe.
--    La función nunca lanza: on conflict do nothing (sin target, cubre auth_user_id y email)
--    deja sin fila a un auth user que ya la tiene o cuya dirección ya usa otra fila, y cualquier
--    otro error queda como warning en el log de Postgres. Un error acá haría fallar la
--    confirmación con el "Database error saving new user" de GoTrue, que no tiene arreglo desde
--    la web; sin fila, la persona entra y ve "cuenta sin vincular", que se arregla con un insert.
--    Las cuentas ya confirmadas (Brian) no disparan ninguno de los dos triggers.

-- 1. pais nullable ----------------------------------------------------------------------

alter table public.usuarios alter column pais drop not null;

-- 2. Alta desde auth.users --------------------------------------------------------------

-- idioma y timezone vienen de raw_user_meta_data (options.data de signInWithOtp), que escribe
-- el propio usuario: se validan acá y nunca se castean a ciegas. nombre es la parte antes del
-- @ hasta que el onboarding pregunte el real; moneda EUR hasta que el onboarding pregunte el
-- país. dia_inicio_ciclo (1) y onboarding_completo (false) salen de los defaults de la columna.
create or replace function public.crear_usuario_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_idioma text;
  v_timezone text;
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

    insert into public.usuarios (auth_user_id, email, nombre, timezone, moneda_default, idioma)
    values (
      new.id,
      new.email,
      pg_catalog.split_part(new.email, '@', 1),
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
  'Trigger sobre auth.users: crea la fila de usuarios cuando el e-mail queda confirmado. Nunca lanza (open-web-signup D3).';

revoke execute on function public.crear_usuario_desde_auth() from public, anon, authenticated;

drop trigger if exists crear_usuario_al_crear_confirmado on auth.users;
create trigger crear_usuario_al_crear_confirmado
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.crear_usuario_desde_auth();

drop trigger if exists crear_usuario_al_confirmar on auth.users;
create trigger crear_usuario_al_confirmar
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.crear_usuario_desde_auth();
