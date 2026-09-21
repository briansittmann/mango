-- movimientos_recurrentes — add-income-management, design D8.
-- gastos_fijos nace pensada solo para gastos; esta migración la generaliza para que también
-- describa ingresos (y, a futuro, ahorros) recurrentes: se renombra la tabla, se agrega tipo
-- y categoria_id deja de ser obligatoria (un ingreso no tiene categoría).
alter table gastos_fijos rename to movimientos_recurrentes;

alter table movimientos_recurrentes
  rename constraint gastos_fijos_repeticiones_coherentes
  to movimientos_recurrentes_repeticiones_coherentes;

alter table movimientos_recurrentes
  add column tipo text not null default 'gasto'
    check (tipo in ('gasto', 'ingreso', 'ahorro'));

alter table movimientos_recurrentes
  alter column categoria_id drop not null,
  add constraint movimientos_recurrentes_categoria_si_gasto
    check (tipo <> 'gasto' or categoria_id is not null);

-- transacciones: mismo relajamiento de categoria_id, y el vínculo a la definición recurrente
-- pasa a llamarse por lo que es ahora, no solo por el caso "gasto".
alter table transacciones
  alter column categoria_id drop not null,
  add constraint transacciones_categoria_si_gasto
    check (tipo <> 'gasto' or categoria_id is not null);

alter table transacciones rename column gasto_fijo_id to movimiento_recurrente_id;

alter table transacciones
  rename constraint transacciones_gasto_fijo_id_ciclo_mes_key
  to transacciones_movimiento_recurrente_id_ciclo_mes_key;

comment on column transacciones.ciclo_mes is
  'Inicio (local) del ciclo de facturación al que pertenece, solo para transacciones generadas por el cron de movimientos recurrentes. No documentada en ARCHITECTURE.md §8 — necesaria para el constraint único movimiento_recurrente_id + mes (§11). Se completa con rango_ciclo_usuario().';

comment on column transacciones.ingreso_esperado_id is
  'Fuente de ingresos_esperados de la que viene esta transacción (solo tipo = ingreso). No documentada en ARCHITECTURE.md §8 — necesaria para calcular max(monto_estimado, real) por fuente (§9). Null = ingreso puntual sin fuente conocida. Espejo de movimiento_recurrente_id pero para el lado de los ingresos esperados.';

alter table movimientos_recurrentes enable row level security;

drop policy if exists "gastos_fijos_crud_propio" on movimientos_recurrentes;
drop policy if exists "movimientos_recurrentes_crud_propio" on movimientos_recurrentes;
create policy "movimientos_recurrentes_crud_propio" on movimientos_recurrentes
  for all using (usuario_id = usuario_actual_id())
  with check (usuario_id = usuario_actual_id());
