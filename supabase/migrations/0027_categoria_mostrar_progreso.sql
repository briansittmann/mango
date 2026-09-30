-- 0027 — barra de progreso oculta, guardada (pedido de Brian 2026-09-30).
--
-- "Ocultar barra de progreso" en la hoja de categoría vivía solo en la memoria de la página: se
-- perdía al recargar y no pasaba de un dispositivo a otro. Es una preferencia de cómo se ve la
-- categoría, como el color, así que va en la fila de la categoría y vale para todos los ciclos.
-- Default true: todas las categorías existentes siguen mostrando la barra. La escribe el usuario
-- con su propio cliente; la política categorias_crud_propio (0011) ya cubre el update.

alter table categorias add column if not exists mostrar_progreso boolean not null default true;

comment on column categorias.mostrar_progreso is
  'false = la tarjeta oculta la barra de presupuesto en todos los ciclos (la hoja de categoría la muestra u oculta). No cambia el presupuesto ni el margen libre.';
