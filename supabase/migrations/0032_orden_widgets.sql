-- 0032 — Orden de los widgets del dashboard (add-desktop-dashboard-shell, design.md D6).
--
-- En escritorio los cuatro widgets de graficos se reordenan arrastrando o con el teclado y el
-- orden es de la cuenta: se guarda entero en cada movimiento y se lee en cada carga. Sin check
-- sobre los ids: el lector (`normalizeWidgetOrder`) descarta los desconocidos y completa los que
-- falten en el orden por defecto, asi un widget nuevo o uno retirado no rompe filas viejas.
-- Null = orden por defecto (weekly, calendar, monthly, distribution). La escribe el propio usuario
-- (RLS usuarios_update_propio, sin lista de columnas: ver CLAUDE.md → Deuda tecnica).
--
-- Aditiva: el codigo en produccion ignora la columna. Vuelta atras:
--   alter table usuarios drop column orden_widgets;

alter table usuarios add column if not exists orden_widgets text[];

comment on column usuarios.orden_widgets is
  'Orden de los widgets del dashboard en escritorio (ids weekly, calendar, monthly, distribution); null = orden por defecto. Lo normaliza el lector.';
