---
name: generating-specs
description: Genera specs funcionales verificables en project/specs/ a partir del PRD y el ADD, con requisitos EARS y criterios de aceptación. Úsala para especificar una funcionalidad antes de implementarla.
---

# Generar specs

1. Lee `project/PRD.md` y `project/ADD.md` (aprobados).
2. Divide el trabajo en funcionalidades pequeñas que se puedan entregar por separado (una spec cada una).
3. Nombre del fichero: `project/specs/<tipo>-<slug>.spec.md`, con `tipo` = `feat` | `fix` | `chore`.
4. Rellena la plantilla [spec.md](spec.md).
5. Escribe los requisitos con la sintaxis de [EARS.md](EARS.md) y numéralos `R1`, `R2`…
6. Cada requisito debe tener al menos un criterio de aceptación en formato Dado / Cuando / Entonces.

## Comprobación final
- ¿Una persona podría implementarla sin pedir aclaraciones importantes?
- ¿Cada requisito es verificable con un test?
- ¿Se cubren los errores y los casos límite?
- ¿Está enlazada con los `F<n>` del PRD?
