## 1. Verificar el estado antes de escribir

- [x] 1.1 Re-chequear los hechos de design.md › Context contra el repo (pueden haber cambiado): `openspec list --json`, `ls supabase/migrations`, `grep -n "TODO" lib/bot/logic.ts`, `head -5 app/page.tsx`, `grep -E "zod|gemini|genai" package.json`. Verificar: cada ítem del snapshot tiene evidencia actual; anotar cualquier diferencia y usar el dato actual.

## 2. Escribir las secciones en CLAUDE.md

- [x] 2.1 Con Edit (no Write), agregar al final de `CLAUDE.md`, después de la regla 13, la sección `## Estado actual (al AAAA-MM-DD)` con la fecha del día, agrupada por área (web/dashboard, bot, base de datos, i18n/tema, tests, deploy/entorno, OpenSpec), una línea por ítem con marcador hecho / a medias / pendiente y la ruta del archivo o change. Incluir la línea de mantenimiento (design.md › Decisión 6). Verificar: `git diff CLAUDE.md` muestra solo líneas agregadas al final y las reglas 1–13 intactas.
- [x] 2.2 Agregar `## Proyección` con los próximos pasos ordenados (design.md › Decisión 5) y una línea por fase de ARCHITECTURE §13 indicando qué falta, referenciando §N sin copiar contenido. Verificar: cada paso nombra un archivo, change o sección de ARCHITECTURE.md, y cada §N citada existe (`grep -n "^## N\." ARCHITECTURE.md`).

## 3. Cierre

- [x] 3.1 Revisar tamaño y validez: `wc -l CLAUDE.md` muestra ≤ ~70 líneas más que antes (56), todas las rutas citadas existen (`ls` sobre cada una) y `openspec validate add-project-status-to-claude-md` pasa.
