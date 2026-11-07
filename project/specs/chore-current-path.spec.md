# chore: Un único origen para la ruta actual

- **Estado:** Aprobada
- **PRD:** F2, F4 (retorno con `volver` tras iniciar sesión o registrarse; F9 enlaces de acceso para reservar). Sin cambios de comportamiento.
- **Rama:** `chore/current-path`
- **Depende de:** ninguna (todo el código afectado ya está en `main`)
- **Prioridad:** Could

## Contexto
La ruta actual con su consulta (`${location.pathname}${location.search}`), que se usa como `volver` en los enlaces y redirecciones a `/acceso` y `/registro`, se construye a mano en cinco sitios de `src/`:

| Fichero | Uso |
|---|---|
| `src/components/Layout.tsx` (línea 19) | `currentPath` para los enlaces "Iniciar sesión" y "Crear cuenta" de la cabecera |
| `src/features/session/RequireAuth.tsx` (línea 15) | Redirección a `loginPath(...)` de las rutas protegidas |
| `src/features/session/SessionExpiredNotice.tsx` (línea 16) | Enlace "Iniciar sesión" del aviso de sesión caducada |
| `src/features/bookings/use-create-booking.ts` (línea 22) | Navegación a `loginPath(currentPath)` tras un 401 al reservar (dependencia de `useCallback`) |
| `src/features/launches/BookingAccess.tsx` (línea 6) | Enlaces "Iniciar sesión" y "Crear cuenta" en lugar del formulario de reserva |

Es lógica duplicada (AGENTS.md §7): si cambiase la regla (por ejemplo, incluir `location.hash`), habría que acordarse de los cinco sitios. Esta spec la centraliza sin cambiar ningún comportamiento observable.

## Alcance
- **Incluido:**
  - Un hook `useCurrentPath()` en `src/hooks/use-current-path.ts` que devuelve `` `${location.pathname}${location.search}` `` a partir de `useLocation()`.
  - Usarlo en los cinco sitios en lugar de la expresión duplicada.
  - Un test unitario nuevo del hook en `tests/unit/hooks/use-current-path.test.tsx`.
- **Excluido:**
  - Cambiar qué se guarda en `volver` (por ejemplo, añadir el `hash`), `loginPath`, `registerPath`, `authPagePath` o `resolveReturnPath` (`src/domain/session.ts`).
  - Otros usos de `useLocation()` que no construyen la ruta actual (por ejemplo, `location.pathname === LOGIN_PATH` en `Layout` o `location.key` en `RequireAuth`), que se mantienen.
  - Modificar, borrar o reescribir tests existentes, textos o estilos.
  - Cualquier otra refactorización.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | El sistema deberá ofrecer un hook `useCurrentPath(): string` en `src/hooks/use-current-path.ts` que devuelva la ruta actual concatenada con su consulta (`pathname` + `search`, sin `hash`). |
| R2 | `Layout`, `RequireAuth`, `SessionExpiredNotice`, `use-create-booking` y `BookingAccess` deberán obtener la ruta actual con `useCurrentPath()`, y la expresión `${location.pathname}${location.search}` no deberá aparecer en ningún fichero de `src/` fuera de `src/hooks/use-current-path.ts`. |
| R3 | Cuando se apliquen R1 y R2, el sistema deberá mantener exactamente el mismo comportamiento: `typecheck`, `lint`, `test` y `test:e2e` en verde sin modificar ningún test existente (ni sus aserciones ni sus datos). |
| R4 | El hook deberá tener un test unitario que compruebe, dentro de un router en memoria, la ruta devuelta para una ruta sin consulta, con consulta y con `hash`. |

## Criterios de aceptación
### R1
- **Dado** el hook usado dentro de un `MemoryRouter`
- **Cuando** la entrada inicial es `/lanzamientos/activity-1?x=1#detalle`
- **Entonces** devuelve `/lanzamientos/activity-1?x=1`

### R2
- **Dado** la rama con el cambio aplicado
- **Cuando** se busca `location.pathname}${location.search}` en `src/`
- **Entonces** solo aparece en `src/hooks/use-current-path.ts`
- **Y** los cinco ficheros de la tabla del contexto importan `useCurrentPath` desde `src/hooks/use-current-path.ts`

### R3
- **Dado** la rama con el cambio aplicado
- **Cuando** se ejecutan `npm run typecheck`, `npm run lint`, `npm run test` y `npm run test:e2e`
- **Entonces** todos terminan en verde con el mismo número de tests que en `main` más los de R4
- **Y** `git diff main --stat -- tests/` solo muestra el fichero nuevo `tests/unit/hooks/use-current-path.test.tsx`
- **Y** en particular siguen en verde, sin cambios: los enlaces de la cabecera con `volver` (`Layout.test.tsx`, `app-shell.spec.ts`), la redirección de rutas protegidas (`RequireAuth.test.tsx`), el aviso de sesión caducada, los enlaces de acceso para reservar (`booking-creation.spec.ts` R2) y el 401 al reservar (`booking-creation.spec.ts` R12)

### R4
- **Dado** `tests/unit/hooks/use-current-path.test.tsx`
- **Cuando** se ejecuta con entradas iniciales `/reservas`, `/reservas?lanzamiento=activity-1` y `/lanzamientos/activity-1?x=1#detalle`
- **Entonces** el hook devuelve `/reservas`, `/reservas?lanzamiento=activity-1` y `/lanzamientos/activity-1?x=1`
- **Y** los nombres de los tests referencian `R1`/`R4`

## Casos límite
- Ruta sin consulta: `location.search` es `''` y el resultado es solo `pathname` (igual que hoy).
- Ruta con `hash`: hoy se descarta y se sigue descartando (R1).
- `use-create-booking` usa la ruta en las dependencias de `useCallback`; al ser un `string`, la identidad de `submit` cambia solo cuando cambia la ruta, como ahora.
- `SessionExpiredNotice` con `showLoginLink={false}`: el hook se llama igualmente al principio del componente (reglas de los hooks); no cambia lo que se muestra.
- `Layout` en `/acceso` o `/registro`: sigue usando `volver` de la consulta en lugar de la ruta actual (`authPagePath`); solo cambia de dónde sale `currentPath`.

## Fuera de la spec / notas
- **Hook frente a función auxiliar:** se elige un hook porque los cinco sitios ya están en componentes o hooks que llaman a `useLocation()` solo para esto (salvo `Layout` y `RequireAuth`, que lo siguen necesitando para `pathname` y `key`). Una función pura `currentPathOf(location)` en `domain/session.ts` también serviría, pero dejaría `useLocation()` repetido.
- El ADD §3 ya incluye `src/hooks/use-current-path.ts` en el contenido de `src/hooks/` (actualizado al aprobar la spec).
- Es un `chore` sin cambio funcional: no requiere entrada de "Added/Changed" visible para la persona usuaria en el CHANGELOG más allá de la que decida `8-dev-ops`.
