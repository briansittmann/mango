-- 0048 — En qué terminó cada mensaje al bot (2026-10-26, sin change).
--
-- Etapa 2 del plan del bot: medir antes de construir el modo agente. Por cada mensaje que llega a
-- la lógica del bot se guarda una fila sin contenido: la cuenta, el canal, el resultado (lo que
-- hizo el parser o en qué pregunta o negativa terminó: 'cargado', 'no_entendido', 'no_disponible',
-- 'pregunta_categoria', 'pregunta_cargo_repetido', 'consultar', 'deshacer', …), si fue una nota de
-- voz y cuánto tardó. Nunca el texto: el texto solo se guarda en `mensajes`, en las cuentas VIP.
--
-- Solo service role (RLS sin políticas, sin privilegios para anon ni authenticated). El cron de
-- fijos borra las filas de más de 90 días. Se borra con la cuenta (on delete cascade). Aditiva: el
-- código que no la usa sigue igual, y el que la usa solo loguea si la escritura falla.
-- Vuelta atrás: drop table eventos_bot.

create table if not exists public.eventos_bot (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'telegram')),
  creado_en timestamptz not null default now(),
  resultado text not null check (resultado ~ '^[a-z_]{1,40}$'),
  voz boolean not null default false,
  ms integer not null check (ms >= 0)
);

comment on table public.eventos_bot is
  'Un registro por mensaje que llegó a la lógica del bot, sin contenido: en qué terminó (resultado), si fue nota de voz y cuánto tardó (ms). Para medir qué no resuelve el bot. Solo service role; el cron borra lo de más de 90 días.';

create index if not exists eventos_bot_creado_en_idx on public.eventos_bot (creado_en);
create index if not exists eventos_bot_usuario_idx on public.eventos_bot (usuario_id, creado_en);

alter table public.eventos_bot enable row level security;
revoke all on public.eventos_bot from anon, authenticated;
