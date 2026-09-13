-- gastos_fijos — ARCHITECTURE.md §8 y §7.
-- "Fijo" es recurrente, no inmutable: el monto vive acá como monto_actual y puede cambiar
-- (§7); cada transacción generada guarda lo que realmente se pagó ese mes.
create table if not exists gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nombre text not null,
  monto_actual numeric(12,2) not null check (monto_actual > 0),
  categoria_id uuid not null references categorias(id) on delete restrict,
  dia_del_mes integer check (dia_del_mes between 1 and 31),
  activo boolean not null default true,
  orden integer not null default 0,
  recordatorio_activo boolean not null default false,
  dias_antes integer not null default 1 check (dias_antes >= 0),
  unique (usuario_id, nombre)
);
