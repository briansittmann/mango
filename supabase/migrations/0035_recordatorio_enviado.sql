-- 0035 — Recordatorio de cobro de un gasto fijo (sin change, 2026-10-14; ARCHITECTURE.md §14.1).
--
-- El cron de recordatorios (`app/api/cron/recordatorios`) manda la plantilla de Meta
-- `recordatorio_cobro_<idioma>` cuando un cargo pendiente de un fijo con recordatorio cae entre hoy
-- y `dias_antes` días adelante. Esta columna es la fecha local del último cargo avisado: el cron la
-- toma con un update condicional antes de mandar (y la devuelve si el envío falla), así una corrida
-- repetida no avisa dos veces y cada cargo se avisa una sola vez. Null = nunca se avisó.
--
-- Aditiva: el cron de fijos y la web la ignoran; solo la lee la ruta nueva, que va después de esta
-- migración. Vuelta atrás:
--   alter table movimientos_recurrentes drop column recordatorio_enviado_para;

alter table movimientos_recurrentes add column if not exists recordatorio_enviado_para date;

comment on column movimientos_recurrentes.recordatorio_enviado_para is
  'Fecha local del último cargo cuyo recordatorio salió por WhatsApp; null = ninguno. La escribe solo el cron de recordatorios.';
