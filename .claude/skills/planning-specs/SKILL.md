---
name: planning-specs
description: Crea el plan de implementación de una spec (tareas pequeñas, orden, plan de pruebas) en project/specs/<slug>.plan.md. Úsala antes de programar una funcionalidad.
---

# Planificar una spec

1. Lee la spec, `project/ADD.md` y el código existente relacionado.
2. Si la spec tiene huecos, **no planifiques**: enumera las dudas.
3. Rellena la plantilla [PLAN.md](PLAN.md) y guarda el resultado en `project/specs/<tipo>-<slug>.plan.md`.
4. Cada tarea:
   - Se puede completar y verificar por sí sola (de 15 a 60 minutos de trabajo humano como referencia).
   - Indica los ficheros afectados y los requisitos `Rn` que cubre.
5. El **plan de pruebas** se escribe antes de programar: cada `Rn` tiene un test asociado.
6. Todos los `Rn` de la spec deben aparecer en alguna tarea.
