-- 0030 — Sin invitaciones (remove-whatsapp-invitations, 2026-10-03).
--
-- Decisión del 2026-10-03 (ARCHITECTURE.md §4, ROADMAP.md bloque 10): la invitación deja de
-- existir como concepto. La cuenta se crea solo en la web y WhatsApp es un canal que la persona
-- vincula desde su cuenta. Se tiran la tabla `invitaciones` (0003, políticas de 0011; nunca la
-- leyó ningún TypeScript, está vacía) y la columna `usuarios.codigo_invitacion` (0029; una sola
-- fila, en null). `usuarios.whatsapp_solicitado_en` se queda: es la marca de la solicitud y la
-- vinculación del bloque 10 la lee.
--
-- Todo con `if exists`: una segunda corrida no hace nada. Vuelta atrás: recrear la tabla desde
-- 0003, sus dos políticas desde 0011 y el bloque de `codigo_invitacion` de 0029; no hay datos que
-- restaurar.

drop policy if exists "invitaciones_select_propias" on invitaciones;
drop policy if exists "invitaciones_insert_propias" on invitaciones;
drop table if exists invitaciones;

alter table usuarios drop column if exists codigo_invitacion;

comment on column usuarios.whatsapp_solicitado_en is
  'Cuándo pidió vincular WhatsApp desde el onboarding (número en telefono). Nada se manda hasta el bloque 10 (lib/whatsapp/link-request.ts). Null = no lo pidió.';
