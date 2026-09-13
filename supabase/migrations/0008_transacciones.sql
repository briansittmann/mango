-- transacciones — ARCHITECTURE.md §8, §4, §7, §9 y §11.
--
-- ciclo_mes: columna agregada, no está en §8. El prompt pide (punto 2) un constraint único
-- por gasto_fijo_id + mes para que el cron de fijos no duplique (§11). Pero "mes" acá no es
-- date_trunc('month', fecha) (§6): es el rango que devuelve rango_ciclo_usuario(), que
-- depende de dia_inicio_ciclo y timezone del usuario y no se puede expresar en un índice
-- sobre fecha sola sin una función inmutable que además mire otra tabla. La salida más simple
-- es que el cron, al insertar el fijo del mes, calcule el inicio del ciclo una vez con
-- rango_ciclo_usuario() y lo guarde acá; el índice único usa esa columna en vez de fecha.
-- Transacciones cargadas a mano (no generadas por el cron) la dejan en null.
--
-- ingreso_esperado_id: columna agregada, tampoco está en §8. Espejo de gasto_fijo_id pero
-- para el lado de los ingresos: vincula una transacción tipo 'ingreso' con la fuente de
-- ingresos_esperados de la que viene, para poder calcular max(monto_estimado, real_cargado)
-- por fuente en el ciclo (§9, "Ingresos esperados: el piso del mes"). Null significa un
-- ingreso puntual que no matchea contra ninguna fuente conocida — el equivalente de que un
-- gasto caiga en `otros` cuando no matchea ninguna categoría (§3).
--
-- monto: puede ser negativo únicamente para tipo = 'ahorro' (retiro de ahorro, §7).
-- Ingreso y gasto siempre positivos.
create table if not exists transacciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  monto numeric(12,2) not null,
  moneda text not null check (moneda ~ '^[A-Z]{3}$'),
  fecha timestamptz not null default now(),
  categoria_id uuid not null references categorias(id) on delete restrict,
  descripcion text,
  tipo text not null check (tipo in ('ingreso', 'gasto', 'ahorro')),
  es_fijo boolean not null default false,
  gasto_fijo_id uuid references gastos_fijos(id) on delete set null,
  ingreso_esperado_id uuid references ingresos_esperados(id) on delete set null,
  ciclo_mes date,
  wa_message_id text,
  borrado_en timestamptz,
  check (
    (tipo in ('ingreso', 'gasto') and monto > 0) or
    (tipo = 'ahorro' and monto <> 0)
  ),
  unique (usuario_id, wa_message_id),
  unique (gasto_fijo_id, ciclo_mes)
);

comment on column transacciones.ciclo_mes is
  'Inicio (local) del ciclo de facturación al que pertenece, solo para transacciones generadas por el cron de fijos. No documentada en ARCHITECTURE.md §8 — necesaria para el constraint único gasto_fijo_id + mes (§11). Se completa con rango_ciclo_usuario().';

comment on column transacciones.ingreso_esperado_id is
  'Fuente de ingresos_esperados de la que viene esta transacción (solo tipo = ingreso). No documentada en ARCHITECTURE.md §8 — necesaria para calcular max(monto_estimado, real) por fuente (§9). Null = ingreso puntual sin fuente conocida.';

comment on column transacciones.wa_message_id is
  'Idempotencia del webhook de WhatsApp (§3): único por usuario, no global, para que el mismo wamid de dos usuarios distintos (no debería pasar, pero por las dudas) no choque.';

comment on column transacciones.borrado_en is
  'Borrado suave (§4). Nunca DELETE. Todas las consultas de agregados deben filtrar borrado_en IS NULL.';

create index if not exists transacciones_usuario_fecha_idx on transacciones (usuario_id, fecha) where borrado_en is null;
create index if not exists transacciones_categoria_idx on transacciones (categoria_id);
create index if not exists transacciones_ingreso_esperado_idx on transacciones (ingreso_esperado_id) where ingreso_esperado_id is not null;
