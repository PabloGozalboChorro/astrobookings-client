---
description: Crea la rama de trabajo de una spec y deja preparado su plan
argument-hint: "<slug de la spec>"
---

# Iniciar una funcionalidad

Spec: `$ARGUMENTS`

1. Comprueba que existe `project/specs/$ARGUMENTS.spec.md` y que está en estado `Aprobada`.
2. Comprueba que el árbol de trabajo está limpio y que estás en `main` y al día.
3. Crea la rama según el tipo de la spec: `feat/<slug>`, `fix/<slug>` o `chore/<slug>`.
4. Usa la skill `planning-specs` para generar `project/specs/$ARGUMENTS.plan.md`.
5. Muestra el plan y espera la validación antes de implementar.
