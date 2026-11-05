---
name: generating-add
description: Genera o actualiza project/ADD.md (documento de diseño de arquitectura) a partir del PRD - stack, capas, contrato con la API y decisiones. Úsala cuando haya que decidir cómo se construye.
---

# Generar el ADD

1. Lee `project/PRD.md` (aprobado) y `AGENTS.md`.
2. Rellena la plantilla [ADD.md](ADD.md) y guarda el resultado en `project/ADD.md`.
3. Cada decisión relevante se registra como un ADR breve (contexto → decisión → consecuencias).
4. Documenta el contrato con la API: endpoints, modelos y códigos de error. Si la API no existe todavía, decide y justifica cómo se simula.
5. Si el stack cambia, propone la actualización de la sección **Stack** de `AGENTS.md`.

## Criterios de calidad
- La solución más simple que cumple el PRD.
- Cada requisito `F<n>` del PRD debe poder ubicarse en algún componente.
- Los riesgos van acompañados de su mitigación.
