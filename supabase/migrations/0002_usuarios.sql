-- usuarios — ARCHITECTURE.md §8.
--
-- auth_user_id: columna agregada, no está en la lista de §8. Es necesaria para el punto 3
-- del alcance del prompt (RLS por usuario): Supabase resuelve auth.uid() contra auth.users,
-- y el id de usuarios se crea desde el bot (por teléfono) antes de que exista ninguna sesión
-- de Supabase Auth. Sin esta columna no hay forma de que una política de RLS sepa qué fila
-- de usuarios le corresponde al usuario autenticado. Queda nullable: se completa cuando la
-- persona reclama acceso a la web (ARCHITECTURE.md §4, "Acceso a la web"), en un endpoint de
-- servidor con service_role (que ya salta RLS), no por el usuario autenticado directamente.
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  telefono text not null unique check (telefono ~ '^\+[1-9]\d{6,14}$'),
  nombre text not null,
  email text unique,
  pais text not null,
  timezone text not null,
  moneda_default text not null check (moneda_default ~ '^[A-Z]{3}$'),
  onboarding_completo boolean not null default false,
  recordatorio_diario boolean not null default false,
  dia_inicio_ciclo integer not null default 1 check (dia_inicio_ciclo between 1 and 28),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  foto_url text,
  cargas_confirmadas integer not null default 0 check (cargas_confirmadas >= 0),
  modo_confirmacion text not null default 'auto' check (modo_confirmacion in ('auto', 'texto', 'reaccion'))
);

comment on column usuarios.auth_user_id is
  'Vincula con auth.users cuando el usuario reclama acceso web (magic link). Null mientras solo existe por WhatsApp. No documentada en ARCHITECTURE.md §8 — agregada para que RLS sea implementable.';

comment on column usuarios.dia_inicio_ciclo is
  'Día del mes en que arranca el ciclo de facturación del usuario (ARCHITECTURE.md §6). Acotado a 1-28 para que el día exista en cualquier mes.';
