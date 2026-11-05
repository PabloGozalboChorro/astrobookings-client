# Versionado semántico (MAJOR.MINOR.PATCH)

| Si desde el último tag hay… | Sube | Ejemplo |
|---|---|---|
| Algún `BREAKING CHANGE` o `tipo!:` | MAJOR | 1.4.2 → 2.0.0 |
| Algún `feat` | MINOR | 1.4.2 → 1.5.0 |
| Solo `fix` | PATCH | 1.4.2 → 1.4.3 |
| Solo `docs`, `test`, `refactor` o `chore` | No se publica versión | — |

- Mientras la versión sea `0.x.y`, los cambios incompatibles suben MINOR.
- Primera versión funcional del cliente: `0.1.0`.
