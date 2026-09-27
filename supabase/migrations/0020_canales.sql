-- canales — separate-identity-from-channel (design.md D1–D3, ARCHITECTURE.md §8).
--
-- Separa la identidad de la cuenta del canal de mensajería: el bot deja de resolver al
-- remitente por usuarios.telefono y pasa a resolverlo por un canal vinculado, para que una
-- cuenta pueda existir sin teléfono (registro web abierto) y para que un segundo canal
-- (Telegram, bloque 11) tenga su propio identificador sin tocar el primero.
--
-- unique (tipo, identificador_externo): un mismo número no puede quedar vinculado a dos
-- cuentas. unique (usuario_id, tipo): como máximo un canal de cada tipo por cuenta, pero
-- WhatsApp y Telegram pueden convivir en la misma. El check de WhatsApp reusa la regex de
-- usuarios_telefono_check (0002) para que un teléfono válido en usuarios sea válido como canal.
-- RLS encendido y sin políticas, igual que mensajes (§8): solo lo toca el bot con el cliente
-- admin, que salta RLS; la web no lo lee todavía (bloque 9/10 agrega la política cuando exista
-- la pantalla de ajustes).
create table if not exists canales (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('whatsapp', 'telegram')),
  identificador_externo text not null,
  unique (tipo, identificador_externo),
  unique (usuario_id, tipo),
  check (tipo <> 'whatsapp' or identificador_externo ~ '^\+[1-9]\d{6,14}$')
);

comment on table canales is
  'Vincula una cuenta con una identidad de mensajería (ARCHITECTURE.md §8). El adaptador de cada canal resuelve al remitente acá, nunca por usuarios.telefono. RLS sin políticas: solo el cliente admin la toca hasta que exista la pantalla de ajustes (bloque 9/10).';

alter table canales enable row level security;

-- El teléfono pasa a ser un canal más: la cuenta puede existir sin él (registro web abierto,
-- ARCHITECTURE.md §4). unique y el check E.164 se mantienen: ambos aceptan null.
alter table usuarios alter column telefono drop not null;

comment on column usuarios.telefono is
  'Teléfono de contacto que muestra el menú de cuenta. Nullable: una cuenta creada por la web no tiene uno. Ya no es lo que el bot usa para identificar al remitente — eso vive en canales; los dos pueden diferir (design.md D2).';

-- Paso de datos: toda cuenta con teléfono hoy es, de hecho, un canal de WhatsApp. En la base
-- real esto vincula la cuenta de Brian, que ya recibe mensajes en producción, así que el
-- webhook sigue reconociéndolo después de la migración.
insert into canales (usuario_id, tipo, identificador_externo)
select id, 'whatsapp', telefono from usuarios where telefono is not null
on conflict (tipo, identificador_externo) do nothing;

-- Idempotencia por canal: generaliza wa_message_id (único por usuario, solo WhatsApp) a
-- mensaje_id_externo + canal (único por usuario y canal, cualquier canal). Ningún row de la
-- base real tiene wa_message_id (design.md Context), así que renombrar no pierde nada.
alter table transacciones rename column wa_message_id to mensaje_id_externo;

alter table transacciones
  add column if not exists canal text check (canal in ('whatsapp', 'telegram'));

alter table transacciones
  drop constraint if exists transacciones_canal_mensaje_id_externo_check;

alter table transacciones
  add constraint transacciones_canal_mensaje_id_externo_check
    check ((canal is null) = (mensaje_id_externo is null));

alter table transacciones
  drop constraint if exists transacciones_usuario_id_wa_message_id_key;

alter table transacciones
  drop constraint if exists transacciones_usuario_id_canal_mensaje_id_externo_key;

alter table transacciones
  add constraint transacciones_usuario_id_canal_mensaje_id_externo_key
    unique (usuario_id, canal, mensaje_id_externo);

comment on column transacciones.mensaje_id_externo is
  'Idempotencia por canal (antes wa_message_id, solo WhatsApp): único por usuario y canal, no global, para que el mismo id de dos usuarios o de dos canales distintos no choque. Ambos, canal y mensaje_id_externo, van juntos o ninguno (transacciones_canal_mensaje_id_externo_check).';

comment on column transacciones.canal is
  'Canal de mensajería del que vino la transacción (whatsapp | telegram), null para una carga sin origen de chat. Va junto con mensaje_id_externo, nunca uno sin el otro.';
