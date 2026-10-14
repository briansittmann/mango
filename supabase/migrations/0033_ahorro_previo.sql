-- 0033 — "Ya lo tenía ahorrado" (add-savings-sheet, 2026-10-14).
--
-- Quien empieza a usar Mango quiere cargar lo que ya tenía ahorrado sin que el mes quede en rojo:
-- un depósito marcado suma al acumulado desde su fecha, pero no al ahorro del ciclo ni al margen
-- libre (ni al piso de ahorro de una proyección). Solo un depósito (ahorro positivo) puede llevar
-- la marca. Aditiva: default false, así toda fila existente y todo insert que no la nombre (el
-- bot, el cron, los seeds) sigue siendo un movimiento normal. La escribe el usuario con su propio
-- cliente; la política transacciones_crud_propio (0011) ya cubre el insert y el update.

alter table transacciones add column if not exists ahorro_previo boolean not null default false;

alter table transacciones drop constraint if exists transacciones_ahorro_previo_check;
alter table transacciones add constraint transacciones_ahorro_previo_check
  check (not ahorro_previo or (tipo = 'ahorro' and monto > 0));

comment on column transacciones.ahorro_previo is
  'true = depósito de ahorro que la persona ya tenía antes de cargarlo: suma al acumulado, no al ahorro del ciclo ni al margen libre. Solo tipo = ''ahorro'' con monto > 0.';
