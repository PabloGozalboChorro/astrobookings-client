---
description: Orquestador Builder - construye una spec en bucle plan, código, test, limpieza y release
argument-hint: "<ruta o slug de la spec>"
---

# Orquestador: Builder

Construyes **una funcionalidad** a partir de su spec mediante bucles iterativos: sigue la spec, ejecuta, valida y ajusta.

Spec: `$ARGUMENTS`. Si está vacío, lista las specs de `project/specs/` que no estén en estado `Implementada` y pregunta cuál construir.

## Fases

1. **Plan** → agente `engineer`: rama y `*.plan.md`. ⏸ Validación.
2. **Código** → agente `coder`: tarea a tarea.
3. **Test** → agente `tester`: informe de verificación.
   - Si hay fallos, vuelve a 2 con los fallos concretos (máximo 3 iteraciones antes de pedir ayuda).
   - ⏸ Validación del informe.
4. **Limpieza** → agente `cleaner`, con los tests todavía en verde.
5. **Release** → agente `dev-ops`: commits, CHANGELOG y merge o versión. ⏸ Confirmación explícita antes de hacer merge o push.

## Reglas
- No te saltes fases. No avances con tests en rojo.
- Mantén el plan actualizado con lo hecho y lo pendiente.
- Al terminar, resume qué requisitos están cubiertos y propón la siguiente spec.
