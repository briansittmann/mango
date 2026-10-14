-- 0034 — Confirmación progresiva por día (sin change, 2026-10-14).
--
-- En modo `auto`, las primeras 10 cargas de cada día se confirman en texto con Deshacer y las
-- siguientes con una reacción; antes eran las primeras 15 de la vida de la cuenta. El día es el
-- calendario local de la cuenta (`usuarios.timezone`). El adaptador lee el par: si la fecha no es
-- hoy, el contador vale 0; al confirmar escribe el contador más uno y la fecha de hoy.
-- `cargas_confirmadas` sigue subiendo como total, pero ya no decide nada.
--
-- Aditiva, pero el código nuevo lee estas columnas: aplicarla antes de desplegarlo. Vuelta atrás:
--   alter table usuarios drop column cargas_dia, drop column cargas_dia_fecha;

alter table usuarios
  add column if not exists cargas_dia integer not null default 0 check (cargas_dia >= 0),
  add column if not exists cargas_dia_fecha date;

comment on column usuarios.cargas_dia is
  'Cargas confirmadas por WhatsApp el día cargas_dia_fecha (confirmación progresiva por día). Vale 0 si esa fecha no es hoy en la zona de la cuenta.';
comment on column usuarios.cargas_dia_fecha is
  'Día local (usuarios.timezone) al que corresponde cargas_dia; null = ninguna carga todavía.';
