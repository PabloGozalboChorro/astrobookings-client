---
name: releasing-version
description: Publica una nueva versión - calcula el número con SemVer a partir de los commits, actualiza CHANGELOG y package.json y crea el tag. Úsala al cerrar un conjunto de funcionalidades en main.
---

# Publicar una versión

1. Comprueba que estás en `main`, con el árbol limpio y todos los tests en verde.
2. Lista los commits desde el último tag (`git log <último-tag>..HEAD --oneline`).
3. Calcula la siguiente versión con [sem-ver.md](sem-ver.md).
4. En `CHANGELOG.md`, mueve `[Unreleased]` a `[x.y.z] - AAAA-MM-DD` y deja un `[Unreleased]` vacío.
5. Actualiza `version` en `package.json` (`npm version x.y.z --no-git-tag-version`).
6. Commit `chore(release): vx.y.z`.
7. **Pide confirmación** y crea el tag anotado `git tag -a vx.y.z -m "vx.y.z"`. No hagas push sin que te lo pidan.
