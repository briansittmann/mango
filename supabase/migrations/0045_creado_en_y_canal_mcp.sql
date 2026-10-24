-- 0045 — Cuándo se cargó cada movimiento y canal 'mcp' (2026-10-24, sin change).
--
-- `fecha` es el día en que pasó el movimiento, no el día en que se cargó: para saber si la gente
-- usa Mango hace falta el segundo. `creado_en` lo pone la base en cada alta (web, bot, MCP, cron);
-- las filas anteriores quedan en null, porque un default en el add column les daría a todas la
-- hora de esta migración. Las altas del MCP pasan a llevar `canal = 'mcp'` sin mensaje_id_externo,
-- así se separan de la web (que sigue en null).
--
-- Aditiva: el código en producción no lee creado_en ni escribe 'mcp'. Va antes del deploy del
-- cambio en lib/mcp. Vuelta atrás: alter table transacciones drop column creado_en; y los dos
-- checks como en la 0020 (después de pasar a null las filas con canal 'mcp').

alter table transacciones
  add column if not exists creado_en timestamptz;

alter table transacciones
  alter column creado_en set default now();

comment on column transacciones.creado_en is
  'Cuándo se insertó la fila (default now()). Null en las filas anteriores a la 0045. No confundir con fecha, el día del movimiento.';

alter table transacciones
  drop constraint if exists transacciones_canal_check;

alter table transacciones
  add constraint transacciones_canal_check
    check (canal in ('whatsapp', 'telegram', 'mcp'));

-- Un canal de chat lleva siempre el id del mensaje (idempotencia); el MCP y la web nunca.
alter table transacciones
  drop constraint if exists transacciones_canal_mensaje_id_externo_check;

alter table transacciones
  add constraint transacciones_canal_mensaje_id_externo_check
    check (coalesce(canal in ('whatsapp', 'telegram'), false) = (mensaje_id_externo is not null));

create index if not exists transacciones_creado_en_idx
  on transacciones (creado_en)
  where creado_en is not null;
