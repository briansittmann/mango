-- Row Level Security — ARCHITECTURE.md §8 punto 3 del alcance del prompt.
-- Cada usuario ve y escribe solo sus propias filas. service_role saltea RLS por diseño de
-- Postgres/Supabase (el rol tiene BYPASSRLS), así que el cron de fijos y el webhook de
-- WhatsApp no necesitan políticas propias: ya corren con esa clave.
--
-- usuarios no tiene política de insert/update libre para "authenticated": el alta la hace el
-- bot (service_role) por teléfono, y el vínculo auth_user_id se completa en un endpoint de
-- servidor con service_role cuando la persona reclama acceso web (ARCHITECTURE.md §4) — no
-- puede hacerlo el propio usuario autenticado, porque hasta ese momento auth_user_id es null
-- y no hay fila que la política pueda matchear todavía.

alter table usuarios enable row level security;

drop policy if exists "usuarios_select_propio" on usuarios;
create policy "usuarios_select_propio" on usuarios
  for select using (auth_user_id = auth.uid());

drop policy if exists "usuarios_update_propio" on usuarios;
create policy "usuarios_update_propio" on usuarios
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

alter table invitaciones enable row level security;

drop policy if exists "invitaciones_select_propias" on invitaciones;
create policy "invitaciones_select_propias" on invitaciones
  for select using (creada_por = usuario_actual_id());

drop policy if exists "invitaciones_insert_propias" on invitaciones;
create policy "invitaciones_insert_propias" on invitaciones
  for insert with check (creada_por = usuario_actual_id());

alter table categorias enable row level security;

drop policy if exists "categorias_crud_propio" on categorias;
create policy "categorias_crud_propio" on categorias
  for all using (usuario_id = usuario_actual_id())
  with check (usuario_id = usuario_actual_id());

alter table gastos_fijos enable row level security;

drop policy if exists "gastos_fijos_crud_propio" on gastos_fijos;
create policy "gastos_fijos_crud_propio" on gastos_fijos
  for all using (usuario_id = usuario_actual_id())
  with check (usuario_id = usuario_actual_id());

alter table transacciones enable row level security;

drop policy if exists "transacciones_crud_propio" on transacciones;
create policy "transacciones_crud_propio" on transacciones
  for all using (usuario_id = usuario_actual_id())
  with check (usuario_id = usuario_actual_id());

alter table presupuestos enable row level security;

drop policy if exists "presupuestos_crud_propio" on presupuestos;
create policy "presupuestos_crud_propio" on presupuestos
  for all using (usuario_id = usuario_actual_id())
  with check (usuario_id = usuario_actual_id());

alter table ingresos_esperados enable row level security;

drop policy if exists "ingresos_esperados_crud_propio" on ingresos_esperados;
create policy "ingresos_esperados_crud_propio" on ingresos_esperados
  for all using (usuario_id = usuario_actual_id())
  with check (usuario_id = usuario_actual_id());
