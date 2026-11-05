# Plan: {tipo}-{slug}

- **Spec:** [{tipo}-{slug}.spec.md]({tipo}-{slug}.spec.md)
- **Rama:** `{tipo}/{slug}`

## Plan de pruebas
| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R1 | {debería …} | unit | `tests/unit/{…}.test.ts` |
| R2 | {…} | e2e | `tests/e2e/{…}.spec.ts` |

## Tareas
- [ ] **T1** — {descripción} · Requisitos: R1 · Ficheros: `src/{…}`
- [ ] **T2** — {…}

## Definición de terminado
- [ ] Todas las tareas marcadas
- [ ] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [ ] Tests e2e de la spec en verde
- [ ] CHANGELOG actualizado
