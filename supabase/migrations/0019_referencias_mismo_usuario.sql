-- Referencias entre tablas del mismo usuario — add-supabase-data-layer-and-login (8.3).
-- Las políticas de RLS del 0011 solo miran usuario_id de la fila que se escribe, y las FKs
-- simples aceptan cualquier categoria_id o movimiento_recurrente_id, así que un usuario podía
-- guardar una transacción apuntando a la categoría de otro (un insert directo lo hacía).
-- Las FKs pasan a ser compuestas con usuario_id: la base rechaza la referencia ajena venga de
-- la web, del bot o de un llamado directo a la API. Con match simple, un categoria_id o
-- movimiento_recurrente_id null no se chequea (ingresos y ahorro siguen igual).
-- Mismas reglas de borrado que antes: restrict, cascade y set null solo sobre la referencia.

alter table categorias
  add constraint categorias_id_usuario_id_key unique (id, usuario_id);

alter table movimientos_recurrentes
  add constraint movimientos_recurrentes_id_usuario_id_key unique (id, usuario_id);

alter table transacciones
  drop constraint transacciones_categoria_id_fkey,
  add constraint transacciones_categoria_id_fkey
    foreign key (categoria_id, usuario_id) references categorias (id, usuario_id) on delete restrict,
  drop constraint transacciones_gasto_fijo_id_fkey,
  add constraint transacciones_movimiento_recurrente_id_fkey
    foreign key (movimiento_recurrente_id, usuario_id) references movimientos_recurrentes (id, usuario_id)
    on delete set null (movimiento_recurrente_id);

alter table movimientos_recurrentes
  drop constraint gastos_fijos_categoria_id_fkey,
  add constraint movimientos_recurrentes_categoria_id_fkey
    foreign key (categoria_id, usuario_id) references categorias (id, usuario_id) on delete restrict;

alter table presupuestos
  drop constraint presupuestos_categoria_id_fkey,
  add constraint presupuestos_categoria_id_fkey
    foreign key (categoria_id, usuario_id) references categorias (id, usuario_id) on delete cascade;
