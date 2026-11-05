---
name: merging-default
description: Integra una rama de funcionalidad terminada en main de forma segura (tests en verde, sin conflictos, merge sin fast-forward) y borra la rama local. Úsala al cerrar una spec.
---

# Integrar en main

1. En la rama de trabajo: árbol limpio y `npm run typecheck`, `npm run lint` y `npm test` en verde.
2. `git fetch` y, si existe remoto, actualiza `main` (`git switch main && git pull --ff-only`).
3. Vuelve a la rama e intégrale `main` (`git merge main`) para resolver los conflictos **en la rama**, no en `main`.
4. Vuelve a ejecutar los tests.
5. **Pide confirmación** y después:
   ```bash
   git switch main
   git merge --no-ff <rama> -m "merge: <rama>"
   git branch -d <rama>
   ```
6. No hagas push sin que te lo pidan. Si el repositorio usa PRs, abre un PR en lugar de hacer merge local.
