-- 0038 — Tarjetas (add-card-wallet, 2026-10-16).
--
-- Una tarjeta es un nombre y un color de la paleta de categorías (0014 y 0039): ningún número, dígito,
-- vencimiento, banco ni red. Un gasto fijo nombra la tarjeta con la que se paga, o ninguna; la
-- tarjeta es de la definición, no de cada cargo, así que vale en todos los ciclos (design D2).
-- Un ingreso fijo no lleva tarjeta (check, como categoria_si_gasto en 0015).
--
-- Borrar una tarjeta nunca se bloquea: la FK compuesta (patrón de 0019) deja en null solo
-- tarjeta_id de sus fijos, sin tocar usuario_id ni nada más.
--
-- Aditiva: el código que corre ignora la tabla y la columna. Va antes del deploy, porque
-- resumenMensual selecciona tarjetas y tarjeta_id.

create table if not exists tarjetas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 30),
  color text not null check (color in (
    'naranja_calido',
    'verde_profundo',
    'azul_apagado',
    'gris_calido',
    'violeta_metalico',
    'gris_oscuro',
    'blanco',
    'granate',
    'rojo',
    'coral',
    'rosa',
    'azul_electrico',
    'celeste',
    'turquesa',
    'verde_menta',
    'fucsia',
    'amarillo',
    'marron',
    'lila',
    'arcoiris'
  )),
  creada_en timestamptz not null default now(),
  constraint tarjetas_id_usuario_id_key unique (id, usuario_id)
);

-- Dos tarjetas del mismo usuario no comparten nombre, sin importar mayúsculas ni espacios.
-- La capa de TypeScript traduce el 23505 de este índice a duplicate-card-name.
create unique index if not exists tarjetas_nombre_unico on tarjetas (usuario_id, lower(btrim(nombre)));

alter table tarjetas enable row level security;

drop policy if exists "tarjetas_crud_propio" on tarjetas;
create policy "tarjetas_crud_propio" on tarjetas
  for all using (usuario_id = usuario_actual_id())
  with check (usuario_id = usuario_actual_id());

alter table movimientos_recurrentes
  add column if not exists tarjeta_id uuid;

alter table movimientos_recurrentes
  drop constraint if exists movimientos_recurrentes_tarjeta_id_fkey,
  add constraint movimientos_recurrentes_tarjeta_id_fkey
    foreign key (tarjeta_id, usuario_id) references tarjetas (id, usuario_id)
    on delete set null (tarjeta_id),
  drop constraint if exists movimientos_recurrentes_tarjeta_si_gasto,
  add constraint movimientos_recurrentes_tarjeta_si_gasto
    check (tarjeta_id is null or tipo = 'gasto');

comment on column movimientos_recurrentes.tarjeta_id is
  'Tarjeta con la que se paga este gasto fijo (null = sin tarjeta). De la definición, sin alcance: vale en todos los ciclos. Solo tipo = ''gasto''.';

-- Lista de la hoja de tarjeta, en un paso: después, exactamente p_definiciones llevan
-- p_tarjeta_id. Cada id listado pasa a esta tarjeta desde la que tuviera; cada fijo que la
-- llevaba y no está listado queda sin tarjeta. Si algún id no es un gasto fijo activo del
-- usuario, o la tarjeta no es suya, no se aplica nada (security invoker, patrón de 0017).
create or replace function asignar_fijos_tarjeta(
  p_usuario_id uuid,
  p_tarjeta_id uuid,
  p_definiciones uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from tarjetas where id = p_tarjeta_id and usuario_id = p_usuario_id
  ) then
    raise exception 'not-found';
  end if;

  if exists (
    select unnest(coalesce(p_definiciones, '{}'))
    except
    select id from movimientos_recurrentes
    where usuario_id = p_usuario_id and tipo = 'gasto' and activo
  ) then
    raise exception 'not-found';
  end if;

  update movimientos_recurrentes set tarjeta_id = null
  where usuario_id = p_usuario_id
    and tarjeta_id = p_tarjeta_id
    and not (id = any (coalesce(p_definiciones, '{}')));

  update movimientos_recurrentes set tarjeta_id = p_tarjeta_id
  where usuario_id = p_usuario_id
    and tipo = 'gasto'
    and id = any (coalesce(p_definiciones, '{}'));
end;
$$;
