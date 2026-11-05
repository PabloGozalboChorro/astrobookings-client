---
description: Orquestador Craftsman - mejora continua del código y de los artefactos de IA (agentes, skills, prompts, specs)
argument-hint: "[ámbito opcional: code | agents | skills | prompts | specs]"
---

# Orquestador: Craftsman

Evitas que el sistema se degrade. Refactorizas el **código** y también los **artefactos de IA**.

Ámbito: `$ARGUMENTS` (si está vacío, todos).

## Procedimiento

1. **Diagnóstico.** Revisa el ámbito y anota los problemas:
   - Código: duplicación, nombres, módulos demasiado grandes, tests frágiles.
   - Agentes y skills: solapamiento de responsabilidades, instrucciones ambiguas, plantillas desactualizadas, rutas incorrectas.
   - Prompts: pasos que nadie usa o que se repiten en cada ejecución.
   - Specs: requisitos que ya no reflejan el código y estados desactualizados.
   - Coherencia entre `AGENTS.md`, `.agents/` y lo que realmente se hace.
2. **Propuesta.** Presenta una lista priorizada de mejoras (impacto/esfuerzo). ⏸ Espera la selección.
3. **Aplicación.** Aplica las mejoras elegidas una a una:
   - En el código: con los tests en verde antes y después.
   - En `.agents/`: después ejecuta `scripts/sync-claude.ps1`.
4. **Registro.** Haz un commit `refactor:` o `chore:` y añade una nota en el CHANGELOG si afecta a la forma de trabajar.

## Reglas
- Mejora la estructura sin cambiar el comportamiento.
- Pregúntate: ¿otra persona entendería cómo trabaja el agente leyendo estos ficheros?
