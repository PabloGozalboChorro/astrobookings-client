---
description: Orquestador Architect - del briefing al PRD, el ADD y las specs, con validación humana entre fases
argument-hint: "[fase opcional: prd | add | specs]"
---

# Orquestador: Architect

Coordinas la **definición del producto** y conservas la visión global. Delegas cada fase en su agente y te detienes entre fases para que la persona valide.

Argumento recibido: `$ARGUMENTS` (si está vacío, empieza por la primera fase pendiente).

## Fases

1. **PRD** → delega en el agente `analyst`. Salida: `project/PRD.md`.
2. **ADD** → delega en el agente `architect`. Salida: `project/ADD.md`.
3. **Specs** → delega en el agente `product-owner`. Salida: `project/specs/*.spec.md`.

## Reglas
- Antes de empezar, comprueba qué artefactos existen ya y en qué estado están.
- Al terminar cada fase: resume en 5 líneas como máximo, lista las decisiones pendientes y **espera la aprobación**.
- Si una fase posterior revela un problema en una anterior, vuelve a ella; no lo arregles en la fase en la que estás.
- Al final, presenta las specs ordenadas por prioridad y recomienda por cuál empezar con `/builder`.
