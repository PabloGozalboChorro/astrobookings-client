# Conventional Commits

```text
<type>(<scope>): <summary in English, imperative, lowercase, no final period>

<optional body: what and why, wrapped at 72 chars>

Refs: project/specs/<spec-file>.spec.md
```

| Tipo | Uso | Efecto en la versión |
|---|---|---|
| `feat` | Nueva funcionalidad | MINOR |
| `fix` | Corrección de un bug | PATCH |
| `docs` | Solo documentación | — |
| `test` | Añadir o corregir tests | — |
| `refactor` | Cambio interno sin efecto funcional | — |
| `chore` | Herramientas, configuración, dependencias | — |
| `style` | Formato | — |

- Cambio incompatible: añade `!` tras el tipo (`feat!:`) y un pie `BREAKING CHANGE: …` → MAJOR.
- Ámbitos sugeridos: `launches`, `bookings`, `api`, `ui`, `agents`.

## Ejemplos
```text
feat(launches): list available launches with rocket, price and seats
fix(bookings): prevent booking more seats than available
chore(agents): add cleaner role and sync script
```
