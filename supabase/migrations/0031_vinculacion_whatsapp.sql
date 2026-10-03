-- 0031 — Vinculación de WhatsApp (add-whatsapp-linking, design.md D1–D4).
--
-- Decisión del 2026-10-03 (ARCHITECTURE.md §4): la persona escribe primero. La web le muestra un
-- link `wa.me/<Mango>?text=vincular ABC123` con un código corto por cuenta; cuando ese mensaje
-- llega desde un número que no está en `canales`, el adaptador crea el canal con el `wa_id` tal
-- como lo manda Meta, pisa `usuarios.telefono` con ese número y consume el código. Sin plantilla,
-- sin depender del número tipeado, igual con el número de prueba y con el propio.
--
-- 1. usuarios.codigo_vinculacion: seis símbolos de un alfabeto sin 0/O/1/I, único. Lo genera la
--    web como el usuario (update de la propia fila, RLS usuarios_update_propio) y vive 7 días
--    desde whatsapp_solicitado_en, que pasa a ser el momento del pedido del código.
-- 2. vincular_canal: la vinculación en una sola transacción, solo service role (como
--    generar_ciclo): busca el usuario por código vivo, rechaza una cuenta ya vinculada o un número
--    que es canal de otra, limpia el teléfono tipeado de cualquier otra cuenta, inserta el canal y
--    pisa teléfono + consume el código. Mensajes estables de raise: codigo-invalido,
--    cuenta-ya-vinculada, numero-en-otra-cuenta.
-- 3. canal_vinculado: lo único que la web lee de `canales`, su propio identificador. security
--    definer para que la tabla siga con RLS y sin políticas (pregunta_pendiente y ultima_carga_id
--    no se exponen con la clave pública).
-- 4. contactos_desconocidos + registrar_contacto_desconocido: la memoria de los números sin canal
--    que escribieron. La función devuelve true solo en la llamada que marca respondido_en, así dos
--    reintentos simultáneos no responden los dos. El cron borra las filas de más de 90 días. Es la
--    semilla del rate limiting del bloque 10, no su implementación.
--
-- Todo aditivo: el código en producción ignora la columna, las funciones y la tabla. Vuelta atrás:
--   drop function vincular_canal(text, text, text), canal_vinculado(text),
--     registrar_contacto_desconocido(text, text);
--   drop table contactos_desconocidos;
--   alter table usuarios drop column codigo_vinculacion;

-- 1. Código de vinculación -------------------------------------------------------------------

alter table usuarios
  add column if not exists codigo_vinculacion text unique
    check (codigo_vinculacion ~ '^[A-HJ-NP-Z2-9]{6}$');

comment on column usuarios.codigo_vinculacion is
  'Código corto que viaja en el mensaje "vincular ABC123" con el que la persona vincula su WhatsApp. Seis símbolos de A-H J-N P-Z 2-9 (sin 0/O/1/I). Lo escribe la web al llegar al cierre del onboarding o al tocar "Vincular WhatsApp" en Cuenta; vive 7 días desde whatsapp_solicitado_en (uno vivo se reusa, uno vencido se reemplaza); vincular_canal lo pone en null al crear el canal. Null = sin código.';

comment on column usuarios.whatsapp_solicitado_en is
  'Cuándo se generó el codigo_vinculacion vigente: el código vale 7 días desde acá. Lo escribe la web junto con el código y no cambia mientras el código siga vivo. Null = nunca pidió vincular.';

-- 2. vincular_canal --------------------------------------------------------------------------

create or replace function vincular_canal(p_tipo text, p_codigo text, p_identificador text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_usuario uuid;
begin
  -- (1) El usuario dueño del código, vivo, bloqueado hasta el commit: un reintento del webhook
  -- espera y después no encuentra código (ya consumido) → codigo-invalido.
  select id into v_usuario
  from usuarios
  where codigo_vinculacion = upper(p_codigo)
    and whatsapp_solicitado_en >= now() - interval '7 days'
  for update;

  if v_usuario is null then
    raise exception 'codigo-invalido';
  end if;

  -- (2) Como máximo un canal de cada tipo por cuenta.
  if exists (select 1 from canales where usuario_id = v_usuario and tipo = p_tipo) then
    raise exception 'cuenta-ya-vinculada';
  end if;

  -- (3) Un identificador vinculado a otra cuenta no se mueve desde el chat.
  if exists (select 1 from canales where tipo = p_tipo and identificador_externo = p_identificador) then
    raise exception 'numero-en-otra-cuenta';
  end if;

  -- (4) El teléfono tipeado por otra cuenta deja de estorbar: el unique de usuarios.telefono
  -- rechazaría el paso (5). Solo WhatsApp usa el teléfono como identificador.
  if p_tipo = 'whatsapp' then
    update usuarios set telefono = null where telefono = p_identificador and id <> v_usuario;
  end if;

  -- (5) El canal, y la cuenta con el número que mandó Meta y sin código.
  insert into canales (usuario_id, tipo, identificador_externo) values (v_usuario, p_tipo, p_identificador);

  if p_tipo = 'whatsapp' then
    update usuarios set telefono = p_identificador, codigo_vinculacion = null where id = v_usuario;
  else
    update usuarios set codigo_vinculacion = null where id = v_usuario;
  end if;

  return v_usuario;
end;
$$;

comment on function vincular_canal(text, text, text) is
  'Bot (service role): vincula el canal p_tipo con identificador p_identificador a la cuenta cuyo codigo_vinculacion es p_codigo y sigue vivo (7 días). En una transacción: valida, limpia el teléfono tipeado de otra cuenta, inserta en canales, pisa usuarios.telefono (solo whatsapp) y consume el código. Devuelve el id del usuario. Mensajes: codigo-invalido, cuenta-ya-vinculada, numero-en-otra-cuenta.';

revoke execute on function vincular_canal(text, text, text) from public, anon, authenticated;

-- 3. canal_vinculado -------------------------------------------------------------------------

create or replace function canal_vinculado(p_tipo text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select identificador_externo
  from canales
  where usuario_id = usuario_actual_id() and tipo = p_tipo;
$$;

comment on function canal_vinculado(text) is
  'Web: el identificador del canal p_tipo de la cuenta de la sesión, o null si no tiene uno. security definer porque canales tiene RLS sin políticas: es lo único que la web lee de la tabla (nunca pregunta_pendiente ni ultima_carga_id).';

-- Solo con sesión: para anon devolvería null igual (usuario_actual_id es null), pero el advisor
-- marca cualquier security definer ejecutable por anon.
revoke execute on function canal_vinculado(text) from public, anon;
grant execute on function canal_vinculado(text) to authenticated;

-- 4. Números desconocidos --------------------------------------------------------------------

create table if not exists contactos_desconocidos (
  tipo text not null check (tipo in ('whatsapp', 'telegram')),
  identificador_externo text not null,
  primer_mensaje_en timestamptz not null default now(),
  ultimo_mensaje_en timestamptz not null default now(),
  mensajes integer not null default 1,
  respondido_en timestamptz,
  primary key (tipo, identificador_externo)
);

alter table contactos_desconocidos enable row level security;

comment on table contactos_desconocidos is
  'Números sin canal que le escribieron al bot (ARCHITECTURE.md §4): cuándo fue la primera y la última vez, cuántos mensajes y cuándo se les respondió la única respuesta. RLS sin políticas: solo el cliente admin. El cron diario borra las filas con ultimo_mensaje_en de más de 90 días, y el número vuelve a recibir una respuesta.';

create or replace function registrar_contacto_desconocido(p_tipo text, p_identificador text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_respondido boolean;
begin
  insert into contactos_desconocidos (tipo, identificador_externo, respondido_en)
  values (p_tipo, p_identificador, now())
  on conflict (tipo, identificador_externo) do update
    set mensajes = contactos_desconocidos.mensajes + 1,
        ultimo_mensaje_en = now(),
        respondido_en = coalesce(contactos_desconocidos.respondido_en, now())
  returning respondido_en = now() into v_respondido;

  -- true en la fila nueva y en la que esta llamada acaba de marcar (respondido_en es el now() de
  -- esta transacción); false si ya tenía una respuesta anterior. El upsert bloquea la fila, así
  -- dos llamadas simultáneas se serializan y solo una ve el null.
  return v_respondido;
end;
$$;

comment on function registrar_contacto_desconocido(text, text) is
  'Bot (service role): anota un mensaje de un número sin canal (upsert: mensajes + 1, ultimo_mensaje_en) y devuelve true solo en la llamada que marca respondido_en, así el adaptador responde una vez por número.';

revoke execute on function registrar_contacto_desconocido(text, text) from public, anon, authenticated;
