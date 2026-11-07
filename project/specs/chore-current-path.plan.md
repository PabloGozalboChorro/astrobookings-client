# Plan: chore-current-path

- **Spec:** [chore-current-path.spec.md](chore-current-path.spec.md)
- **Rama:** `chore/current-path`
- **Estado:** Aprobado por delegación de la persona (decisiones C1–C6 y P1–P4 tal como las fija este plan). Quedan abiertas las preguntas marcadas como **abierta** en [Puntos a decidir](#puntos-a-decidir); ninguna bloquea la implementación.

## Revisión de la spec

La spec encaja con el PRD (F2, F4, F9: retorno con `volver`) y con el ADD (§3 ya lista `src/hooks/use-current-path.ts` en `src/hooks/`). Es una refactorización sin cambio de comportamiento observable. No tiene huecos que obliguen a devolverla a `product-owner`.

Lo que ya hay en `main` (`ee1d76a`):

- `src/hooks/` existe con `use-async-data.ts` y `use-now.ts`: un fichero por hook en `kebab-case`, **export con nombre** (`export function useNow(): Date`), tipo de retorno explícito, sin `default export`. Se importan con ruta relativa (`../../hooks/use-now`).
- `tests/unit/hooks/` existe (`use-async-data.test.tsx`, `use-async-data-edge-cases.test.tsx`): tests con `renderHook` / `render` de Testing Library, imports relativos `../../../src/hooks/...`. El test nuevo va en `tests/unit/hooks/use-current-path.test.tsx`, como pide la spec.
- `loginPath`, `registerPath`, `authPagePath` (`src/domain/session.ts`) no cambian.

No se añade ninguna dependencia.

### Ocurrencias encontradas en `src/` (búsqueda de `pathname`, `location.search` y `useLocation`)

| Fichero:línea | Código actual | Qué pasa con `useLocation()` |
|---|---|---|
| `src/components/Layout.tsx:19` | `const currentPath = \`${location.pathname}${location.search}\`;` (usado en `:24` y `:27`) | **Se mantiene** (`:16`): sigue haciendo falta para `location.pathname === LOGIN_PATH` / `REGISTER_PATH` (`:20`, `:21`). |
| `src/features/session/RequireAuth.tsx:15` | `<Navigate to={loginPath(\`${location.pathname}${location.search}\`)} replace />` | **Se mantiene** (`:8`): sigue haciendo falta para `location.key` (`:12`). |
| `src/features/session/SessionExpiredNotice.tsx:16` | `<Link to={loginPath(\`${location.pathname}${location.search}\`)}>` | **Se quita** (`:10` y el import de `:1`): solo se usaba para esto. |
| `src/features/bookings/use-create-booking.ts:22` | `const currentPath = \`${location.pathname}${location.search}\`;` (usado en `:41` y en las dependencias de `useCallback`, `:49`) | **Se quita** (`:21` y el import de `:2`). |
| `src/features/launches/BookingAccess.tsx:6` | `const currentPath = \`${location.pathname}${location.search}\`;` (usado en `:12` y `:13`) | **Se quita** (`:5` y el import de `:1`). |

Coinciden exactamente con la tabla de la spec. No hay formas equivalentes (desestructuración `const { pathname, search } = useLocation()`, `location.pathname + location.search`, `createPath`, `window.location`) en `src/`. Otros usos que **no** construyen la ruta actual y quedan fuera: `src/features/bookings/BookingDetailPage.tsx:128` (`useLocation()` para el estado de navegación) y `src/domain/session.ts:74` (`resolved.pathname` de una `URL`).

### Impacto en lo existente

| Fichero | Cambio |
|---|---|
| `src/hooks/use-current-path.ts` (nuevo) | Hook `useCurrentPath(): string` (C1). |
| `tests/unit/hooks/use-current-path.test.tsx` (nuevo) | Test de R1/R4 (C5). |
| Los cinco ficheros de la tabla | Sustituir la expresión por `useCurrentPath()` (C2–C4). |

Ningún test existente se toca (R3). No hay cambios de CSS, textos ni rutas.

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| C1 | `src/hooks/use-current-path.ts`: `import { useLocation } from 'react-router'; export function useCurrentPath(): string { const { pathname, search } = useLocation(); return \`${pathname}${search}\`; }`. Sin `hash`, sin `useMemo` (devuelve un `string`, comparable por valor). | R1; convenciones de `use-now.ts` (export con nombre, retorno explícito). |
| C2 | **Layout** y **RequireAuth** conservan `useLocation()` para `pathname`/`key` y añaden `const currentPath = useCurrentPath();`. En `RequireAuth` el hook se llama al principio del componente, antes de cualquier `return` (reglas de los hooks), y el `Navigate` usa `loginPath(currentPath)`. | R2; Excluido de la spec ("otros usos de `useLocation()` se mantienen"). |
| C3 | **SessionExpiredNotice**, **use-create-booking** y **BookingAccess** sustituyen `useLocation()` por `useCurrentPath()` y quitan `useLocation` del import de `react-router` (si el import queda vacío, se quita entero). En `SessionExpiredNotice` el hook se llama al principio, también con `showLoginLink={false}`. | R2; casos límite de la spec; `lint` sin imports sin usar. |
| C4 | En `use-create-booking` se mantiene el nombre `currentPath` y su lugar en las dependencias de `useCallback` (`[navigate, currentPath]`): la identidad de `submit` cambia solo cuando cambia la ruta, igual que ahora. | Caso límite de la spec; `react-hooks/exhaustive-deps`. |
| C5 | **Test del hook** con `renderHook(() => useCurrentPath(), { wrapper })`, donde `wrapper` es un `MemoryRouter` con `initialEntries={[entry]}`; `it.each` sobre las tres entradas de R4. Nombres en inglés con el `Rn` delante. | R4; patrón de `tests/unit/hooks/use-async-data.test.tsx`. |
| C6 | **Sin e2e nuevo**: el comportamiento lo cubren los e2e existentes (`app-shell.spec.ts`, `booking-creation.spec.ts` R2 y R12, `user-session.spec.ts`), que deben seguir en verde sin cambios (R3). | R3 ("sin modificar ningún test existente"); la spec solo pide el test unitario nuevo. |

## Plan de pruebas

Se escribe antes del código: primero el test del hook (en rojo, porque el módulo no existe), luego el hook, y después la sustitución con la suite existente como red de seguridad.

### Unitarios (Vitest, jsdom)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R1, R4 | `it.each` `R1/R4: returns %s for %s` — `/reservas` → `/reservas`; `/reservas?lanzamiento=activity-1` → `/reservas?lanzamiento=activity-1`; `/lanzamientos/activity-1?x=1#detalle` → `/lanzamientos/activity-1?x=1` | hook | `tests/unit/hooks/use-current-path.test.tsx` |
| R3 | Suite existente sin cambios, en particular `tests/unit/components/Layout.test.tsx`, `tests/unit/features/session/*` (`RequireAuth`, aviso de sesión caducada), `tests/unit/features/launches/*` (`BookingAccess`) y `tests/unit/features/bookings/*` (`use-create-booking`, 401) | componente | existentes |

### End-to-end (Playwright, Chromium y Firefox, API interceptada)

Sin tests nuevos (C6). Regresión de R3 con la suite completa; en particular `app-shell.spec.ts` (enlaces de cabecera con `volver`), `booking-creation.spec.ts` R2 (enlaces de acceso para reservar) y R12 (401 al reservar) y `user-session.spec.ts` (rutas protegidas y sesión caducada).

### Verificaciones estáticas (R2, R3)

- `git grep -n 'location.pathname}${location.search}' -- src` → solo `src/hooks/use-current-path.ts` (o ninguna, si C1 usa desestructuración: ver P1).
- `git grep -n "useCurrentPath" -- src` → el hook y los cinco ficheros.
- `git diff main --stat -- tests/` → solo `tests/unit/hooks/use-current-path.test.tsx`.

## Tareas

- [x] **T1** — Test del hook (en rojo) y hook `useCurrentPath` (C1, C5). · Requisitos: R1, R4 · Ficheros: `tests/unit/hooks/use-current-path.test.tsx`, `src/hooks/use-current-path.ts`.
  - Verificación: `npm test -- tests/unit/hooks/use-current-path.test.tsx` (rojo antes del hook, verde después); `npm run typecheck`.
- [x] **T2** — Sustituir en los ficheros que dejan de usar `useLocation()` (C3, C4). · Requisitos: R2, R3 · Ficheros: `src/features/session/SessionExpiredNotice.tsx`, `src/features/bookings/use-create-booking.ts`, `src/features/launches/BookingAccess.tsx`.
  - Verificación: `npm test -- tests/unit/features`; `npm run lint`.
- [x] **T3** — Sustituir en los ficheros que conservan `useLocation()` (C2). · Requisitos: R2, R3 · Ficheros: `src/components/Layout.tsx`, `src/features/session/RequireAuth.tsx`.
  - Verificación: `npm test -- tests/unit/components tests/unit/features/session tests/unit/App.test.tsx`; `npm run lint`.
- [x] **T4** — Verificación final. · Requisitos: R1–R4 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Anotar antes el recuento de tests de `main` (`npm test` en `main` o el último informe) para comprobar "mismo número + los de R4".
  - Ejecutar en orden: `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa de regresión).
  - **No** usar `npm run test:e2e -- --project=chromium` (el script ya fija los dos proyectos). Firefox lo ejecuta **la persona**: `npx.cmd playwright test --project=firefox`.
  - Verificaciones estáticas del plan de pruebas (`git grep` y `git diff main --stat -- tests/`).
  - Comprobar: sin `console.log`, código comentado ni `any`; sin dependencias nuevas en `package.json`; `git status` sin ficheros no previstos.

## Desviaciones durante la implementación

Rellenado por `5-coder`.

| # | Desviación | Motivo |
|---|---|---|
| D1 | P1 aplicado tal cual: el hook desestructura `useLocation()`, así que la búsqueda literal de R2 (`location.pathname}${location.search}`) devuelve **cero** resultados en `src/`. La evidencia de R2 se toma con `git grep --untracked -n 'pathname}${' -- src` (solo `src/hooks/use-current-path.ts:5`) y `git grep --untracked -nE 'location.(pathname|search)' -- src` (solo las comparaciones con `LOGIN_PATH`/`REGISTER_PATH` de `Layout`, excluidas por la spec). | Decisión ya tomada en P1/C1. |
| D2 | En `Layout.tsx` el import del hook va después de los de `../features/...` (orden alfabético de rutas, como el resto del fichero). En los demás ficheros va tras el de `../../domain/session`. | Coherencia con el orden de imports existente; sin regla de lint que lo fije. |
| D3 | `git diff main --stat -- tests/` no lista el test nuevo mientras esté sin seguimiento (no se hace `git add` sin que lo pida la persona): sale vacío, lo que prueba que ningún test existente cambia; `git status --short -- tests/` muestra solo `?? tests/unit/hooks/use-current-path.test.tsx`. | No hacer commit ni preparar cambios (instrucción de la tarea). |
| D4 | Recuentos: Vitest 804 → 807 (+3 de R4, 46 ficheros); Playwright Chromium 185/185 sin cambios. Firefox queda para la persona. | Evidencia de R3. |

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde (mismo recuento que `main` + los tests de R4)
- [x] `npm run build` en verde
- [x] Tests e2e de la spec en verde (Chromium agente, Firefox persona) — suite completa de regresión, sin tests nuevos: Chromium 185/185 y Firefox 185/185
- [x] `git diff main --stat -- tests/` solo muestra `tests/unit/hooks/use-current-path.test.tsx`
- [x] CHANGELOG: **sin entrada**. Keep a Changelog documenta cambios relevantes para quien usa el proyecto (Added, Changed, Deprecated, Removed, Fixed, Security); una refactorización interna sin cambio de comportamiento no encaja en ninguna sección y la propia spec lo indica. Queda trazada por el commit `refactor(...)` / `chore(...)` y esta spec. Si `8-dev-ops` opina distinto, como mucho una línea en `Changed` (ver P3).

## Puntos a decidir

La persona ha delegado las decisiones de esta spec: el plan aplica la recomendación. Ninguna cambia el producto. Las marcadas **abierta** conviene que la persona las confirme, pero no bloquean.

| # | Tema | Ambigüedad | Decisión aplicada |
|---|---|---|---|
| P1 | Forma literal dentro del hook | El criterio de R2 busca `location.pathname}${location.search}` y espera encontrarlo "solo" en el hook. Si el hook desestructura (`const { pathname, search } = useLocation()`) la búsqueda devuelve **cero** resultados. | Se usa desestructuración (C1): el espíritu de R2 (no hay duplicado fuera del hook) se cumple igual y la verificación se hace con "ninguna ocurrencia fuera de `src/hooks/use-current-path.ts`". Si la persona prefiere que el `grep` literal encuentre el hook, basta con escribir `const location = useLocation(); return \`${location.pathname}${location.search}\`;`. |
| P2 | Nombre en `RequireAuth` y `SessionExpiredNotice` | Hoy no hay variable intermedia. | Se introduce `const currentPath = useCurrentPath();` al principio del componente, por coherencia con los otros tres sitios y para respetar las reglas de los hooks antes de los `return`. |
| P3 | CHANGELOG (**abierta**) | La spec lo deja a `8-dev-ops`. | Sin entrada (ver Definición de terminado). |
| P4 | Tipo de commit (**abierta**, informativa) | La rama es `chore/`, pero el cambio es de código sin cambio de comportamiento. | Recomendación para `8-dev-ops`: `refactor(session): centralize current path in useCurrentPath hook` + `test(hooks): ...`, o un único `refactor`. No incrementa la versión por sí solo (SemVer: sin `feat` ni `fix`). |
