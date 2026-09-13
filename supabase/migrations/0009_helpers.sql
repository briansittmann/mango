-- Funciones de apoyo para RLS.
create or replace function usuario_actual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from usuarios where auth_user_id = auth.uid();
$$;

comment on function usuario_actual_id() is
  'Id de usuarios correspondiente a la sesión de Supabase Auth actual (via auth_user_id), o null si no hay sesión o el usuario todavía no reclamó acceso a la web. La usan las políticas de RLS de 0011_rls.sql.';
