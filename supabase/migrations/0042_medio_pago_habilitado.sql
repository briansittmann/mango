-- 0042 — Medio de pago solo donde se usa efectivo (add-payment-method D14, 2026-10-18).
--
-- La función de medio de pago (chips, bolsillos, transferencias, el default y lo que el bot hace
-- con ellos) se ofrece por país: Argentina, Uruguay, México y Colombia (PAYMENT_METHOD_COUNTRIES en
-- lib/data/payment-method.ts). Esta columna es el interruptor del admin, por cuenta:
--   null  → decide el país (el default)
--   true  → encendida, sea cual sea el país
--   false → apagada, sea cual sea el país
-- Se escribe a mano en el SQL editor o por el MCP; la app no tiene UI para esto. Apagarla no borra
-- nada: los medios, las transferencias y el default guardados vuelven al encenderla.
--
-- Aditiva: ninguna fila cambia.

alter table usuarios add column if not exists medio_pago_habilitado boolean;

comment on column usuarios.medio_pago_habilitado is
  'Interruptor del admin para el medio de pago: null = según el país (AR, UY, MX, CO), true = encendido, false = apagado.';
