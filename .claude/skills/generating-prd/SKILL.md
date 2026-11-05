---
name: generating-prd
description: Genera o actualiza project/PRD.md (documento de requisitos de producto) a partir del briefing. Úsala cuando haya que definir qué se construye y para quién.
---

# Generar el PRD

1. Lee `project/briefing.md` y, si ya existe, el `project/PRD.md` actual.
2. Haz a la persona las preguntas necesarias para resolver las ambigüedades **antes** de escribir.
3. Rellena la plantilla [PRD.md](PRD.md) y guarda el resultado en `project/PRD.md`.
4. Cada requisito funcional lleva un identificador `F<n>` estable; no renumeres los existentes.
5. Lo que siga sin decidirse se marca como `PENDIENTE:` en la sección de preguntas abiertas.

## Criterios de calidad
- Habla del **qué** y del **para quién**, nunca del cómo técnico.
- Cada objetivo es medible o comprobable.
- El alcance indica explícitamente qué queda **fuera**.
