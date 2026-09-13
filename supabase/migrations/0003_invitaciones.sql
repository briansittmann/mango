-- invitaciones — ARCHITECTURE.md §8 y §4.
-- Disponible si usada_en IS NULL AND vence_en > now() (§8): no hay booleano "activa"
-- redundante, es estado derivado de estas dos columnas.
create table if not exists invitaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (char_length(codigo) >= 8),
  creada_por uuid not null references usuarios(id) on delete cascade,
  usada_por uuid references usuarios(id) on delete set null,
  usada_en timestamptz,
  vence_en timestamptz not null,
  check ((usada_por is null) = (usada_en is null))
);

create index if not exists invitaciones_creada_por_idx on invitaciones (creada_por);
