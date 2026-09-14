## Why

`CLAUDE.md` es lo único que se carga en cada sesión, pero hoy solo tiene reglas de trabajo: cada conversación nueva arranca sin saber qué está construido, qué es stub y qué viene después, y tiene que re-derivarlo leyendo `ARCHITECTURE.md` (952 líneas), `openspec list` y el código. Eso cuesta tokens y lleva a asumir cosas que no son (por ejemplo, que el bot ya parsea mensajes o que `/` es el dashboard).

## What Changes

- Agregar a `CLAUDE.md` una sección **Estado actual** (snapshot fechado): qué está hecho, qué está a medias y qué no existe todavía, agrupado por área (web/dashboard, bot de WhatsApp, base de datos, i18n/tema, tests, deploy, OpenSpec).
- Agregar una sección **Proyección** con los próximos pasos concretos ordenados, y el mapa a las fases 1/2/3 de `ARCHITECTURE.md` §13, referenciando las secciones en lugar de copiarlas.
- Agregar una regla corta de mantenimiento: la sección se actualiza al archivar un change de OpenSpec o al cerrar un hito, y la fecha del snapshot se actualiza con ella.
- No se modifican las 13 reglas existentes ni ningún archivo de código.

## Capabilities

### New Capabilities
<!-- Ninguna: es documentación, no cambia comportamiento del sistema. -->

### Modified Capabilities
<!-- Ninguna. El change declara `skip_specs: true`. -->

## Impact

- **Archivos:** solo `CLAUDE.md` (secciones nuevas al final).
- **Contexto de cada sesión:** `CLAUDE.md` pasa de ~56 a ~110–130 líneas; se mantiene breve a propósito porque se carga siempre.
- **Riesgo:** que el snapshot quede desactualizado y confunda más de lo que ayuda. Se mitiga con la fecha visible y la regla de mantenimiento.
- **Sin dependencias, APIs ni código afectado.**
