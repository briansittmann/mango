-- Amplía la paleta de categorías: a los ocho colores de 0004 se suman siete tonos vivos
-- (rojo, coral, rosa, azul eléctrico, celeste, turquesa, verde menta). Se sigue guardando
-- el nombre del color, no el hex — cada tema lo resuelve (ARCHITECTURE.md §9).
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
  'verde_menta'
));
