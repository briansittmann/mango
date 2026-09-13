-- ingresos_esperados — ARCHITECTURE.md §8 y "Ingresos esperados: el piso del mes" (§9).
-- El espejo de presupuestos: un presupuesto es un techo para una categoría de gasto, un
-- ingreso esperado es un piso para una fuente de ingreso. dia_del_mes solo tiene sentido
-- para los no variables (el sueldo cae un día fijo; las propinas no).
create table if not exists ingresos_esperados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nombre text not null,
  monto_estimado numeric(12,2) not null check (monto_estimado >= 0),
  es_variable boolean not null default false,
  dia_del_mes integer check (dia_del_mes between 1 and 31),
  activo boolean not null default true,
  orden integer not null default 0,
  unique (usuario_id, nombre)
);
