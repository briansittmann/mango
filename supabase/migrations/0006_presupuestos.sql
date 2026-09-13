-- presupuestos — ARCHITECTURE.md §8, §9 (fase 1).
-- periodo queda como texto libre con default 'mensual' en vez de un check contra un único
-- valor posible: hoy todo es mensual, pero la columna existe para no tener que migrarla el
-- día que haga falta otra cosa. El único real hoy es "una fila por categoría por período".
create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete cascade,
  monto numeric(12,2) not null check (monto > 0),
  periodo text not null default 'mensual',
  unique (usuario_id, categoria_id, periodo)
);
