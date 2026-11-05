---
name: committing-changes
description: Hace commits siguiendo Conventional Commits, con cambios atómicos y enlace a la spec. Úsala siempre que haya que hacer commit.
---

# Hacer commit

1. Ejecuta `git status` y `git diff --staged` (o `git diff` si no hay nada en el área de preparación).
2. Agrupa los cambios por intención; un commit = un cambio lógico.
3. Redacta el mensaje según [conventional-commits.md](conventional-commits.md).
4. **Muestra el mensaje y espera la confirmación** antes de ejecutar `git commit`.
5. Nunca uses `--no-verify` ni reescribas commits ya publicados.
