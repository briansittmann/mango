-- 0039 — Cinco colores más en la paleta (add-card-wallet, 2026-10-16): amarillo, marrón, lila y
-- fucsia, y "arcoiris", el easter egg cuyo tono va girando (cada tema lo resuelve en globals.css).
-- Se guarda el nombre, no el valor (ARCHITECTURE.md §9). Aditiva: el check acepta todo lo que ya
-- aceptaba. Las tarjetas (0038) ya nacen con la paleta completa.
alter table categorias drop constraint if exists categorias_color_check;

alter table categorias add constraint categorias_color_check check (color in (
  'naranja_calido',
  'verde_profundo',
  'azul_apagado',
  'gris_calido',
  'violeta_metalico',
  'gris_oscuro',
  'blanco',
  'granate',
  'rojo',
  'coral',
  'rosa',
  'azul_electrico',
  'celeste',
  'turquesa',
  'verde_menta',
  'fucsia',
  'amarillo',
  'marron',
  'lila',
  'arcoiris'
));
