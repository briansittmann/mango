-- categorias — ARCHITECTURE.md §8 y §9.
--
-- Paleta cerrada de nueve colores (§9), pero acá se restringe a ocho: "lima" queda afuera
-- porque §9 la reserva a marca/número héroe/barras de progreso y dice explícitamente que
-- ninguna cabecera de categoría lleva punto lima. Ámbar y rojo tampoco entran: son estado
-- de presupuesto, no forman parte de la paleta de nueve. Se guarda el nombre del color, no
-- el valor literal (§9) — cada tema resuelve el hex.
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nombre text not null,
  orden integer not null default 0,
  color text not null check (color in (
    'naranja_calido',
    'verde_profundo',
    'azul_apagado',
    'gris_calido',
    'violeta_metalico',
    'gris_oscuro',
    'blanco',
    'granate'
  )),
  unique (usuario_id, nombre)
);
