---
name: creating-issues
description: Crea issues de GitHub a partir de las specs (una por spec) usando gh CLI o el MCP de GitHub, con etiquetas y enlace a la spec. Úsala para llevar el trabajo planificado a GitHub.
---

# Crear issues desde las specs

Requiere `gh` autenticado o un servidor MCP de GitHub conectado. Si no hay ninguno disponible, informa y detente.

1. Lee las specs indicadas de `project/specs/`.
2. Para cada una, prepara:
   - **Título:** `<tipo>: <título de la spec>`
   - **Cuerpo:** contexto, lista de requisitos `Rn` como checklist y enlace al fichero de la spec.
   - **Etiquetas:** `feat` | `fix` | `chore` y la prioridad (`must`, `should`, `could`).
3. **Muestra la lista completa y espera la confirmación** (crear issues es una acción visible para otras personas).
4. Crea las issues (`gh issue create --title … --body-file … --label …`) y anota el número en la cabecera de cada spec (`- **Issue:** #N`).
