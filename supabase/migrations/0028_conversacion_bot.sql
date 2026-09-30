-- 0028 — add-bot-conversation (design.md D1, D8, Migration Plan).
--
-- 1. usuarios.vip: marca a mano (SQL, sin pantalla) las cuentas cuyo bot guarda la conversación
--    y se la pasa al parser (ARCHITECTURE.md §3). Default false: ninguna cuenta guarda texto.
-- 2. canales.ultima_carga_id: la última carga hecha por ese chat, lo único que "borrá eso" y
--    "no, era 40" pueden tocar (§4). FK compuesta con usuario_id, como en 0019: la base rechaza
--    apuntar a una transacción de otra cuenta. on delete set null solo sobre la referencia.
--    Necesita unique (id, usuario_id) en transacciones, que 0019 solo creó en categorias y
--    movimientos_recurrentes.
-- 3. mensajes: el historial de las cuentas VIP (§8). RLS encendido y sin políticas: solo lo toca
--    el bot con el cliente admin. El unique parcial sobre los entrantes hace que un reintento de
--    Meta no se guarde dos veces. El cron diario borra los de más de 30 días
--    (RETENTION_DAYS en lib/data/messages.ts).

-- 1. VIP -----------------------------------------------------------------------------------

alter table usuarios add column if not exists vip boolean not null default false;

comment on column usuarios.vip is
  'true = el bot guarda los mensajes de esta cuenta en mensajes y el parser recibe la conversación reciente (ARCHITECTURE.md §3). Se marca a mano por SQL; no hay pantalla.';

-- 2. Última carga del canal ------------------------------------------------------------------

alter table transacciones
  add constraint transacciones_id_usuario_id_key unique (id, usuario_id);

alter table canales add column if not exists ultima_carga_id uuid;

alter table canales
  add constraint canales_ultima_carga_id_fkey
    foreign key (ultima_carga_id, usuario_id) references transacciones (id, usuario_id)
    on delete set null (ultima_carga_id);

comment on column canales.ultima_carga_id is
  'La última carga hecha por este chat: la fila que escribió o completó. La reemplaza cada carga nueva y la limpia un borrado o un deshacer de esa fila. Es lo único que borrar y corregir tocan desde el chat. Null = ninguna.';

comment on column canales.pregunta_pendiente is
  'Pregunta abierta en este canal, de dos tipos: { pregunta: ''categoria'', tipo, monto, diasAtras } o { pregunta: ''crear_categoria'', nombre, presupuesto, parecida }. Una fila sin pregunta (anterior a 0028) es de categoria. La escribe el adaptador cuando el bot pregunta y la borra con cualquier otra respuesta; una nueva reemplaza a la anterior. Null = ninguna.';

-- 3. mensajes ------------------------------------------------------------------------------

create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'telegram')),
  direccion text not null check (direccion in ('entrante', 'saliente')),
  texto text not null,
  mensaje_id_externo text,
  transaccion_id uuid,
  creado_en timestamptz not null default now(),
  foreign key (transaccion_id, usuario_id) references transacciones (id, usuario_id)
    on delete set null (transaccion_id)
);

create index if not exists mensajes_usuario_creado_idx on mensajes (usuario_id, creado_en);

create unique index if not exists mensajes_entrante_unico_idx
  on mensajes (usuario_id, canal, mensaje_id_externo)
  where direccion = 'entrante';

alter table mensajes enable row level security;

comment on table mensajes is
  'Conversación de las cuentas VIP (usuarios.vip, ARCHITECTURE.md §3 y §8): lo que escribe el usuario y lo que responde el bot. RLS sin políticas: solo el cliente admin. El cron diario borra los de más de 30 días.';

comment on column mensajes.mensaje_id_externo is
  'Id del mensaje en el canal (wamid en WhatsApp), solo en los entrantes. Único por usuario y canal entre los entrantes: un reintento no se guarda dos veces.';

comment on column mensajes.transaccion_id is
  'La carga que produjo este mensaje, si hubo una. FK compuesta con usuario_id, como en 0019.';
