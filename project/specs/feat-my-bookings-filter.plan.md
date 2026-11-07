# Plan: feat-my-bookings-filter

- **Spec:** [feat-my-bookings-filter.spec.md](feat-my-bookings-filter.spec.md)
- **Rama:** `feat/my-bookings-filter`
- **Estado:** Aprobado por delegación de la persona (decisiones C1–C10 y P1–P8 tal como las fija este plan). Quedan abiertas las preguntas marcadas como **abierta** en [Puntos a decidir](#puntos-a-decidir); ninguna bloquea la implementación.

## Revisión de la spec

La spec encaja con el PRD (F19, Could) y con el ADD (§3 estructura: `features/bookings/BookingFilter.tsx`; §4.1 endpoint 6 `GET /bookings` sin `activityId`; §5.1 ruta `/reservas` con `?lanzamiento=<activityId>`; §5.2 "Búsqueda, orden, filtro de reservas" en parámetros de la URL con `useSearchParams`; ADR-009 filtro en el cliente; trazabilidad F19 → `BookingFilter`, `MyBookingsPage`). Se reutiliza lo que ya hay en `main` tras `feat-my-bookings`, `feat-launch-search-sort` y `feat-booking-creation`:

- `getMyBookings(signal)` (`src/api/bookings.ts`): `GET /bookings` con token, sin parámetros; `useMyBookings()` sobre `useAsyncData` con un `loader` memoizado con `useCallback(…, [])`: cambiar los parámetros de la URL **no** cambia el `loader` y por tanto no repite la petición (R2).
- `toBooking` y `sortByMostRecent` (`src/domain/booking.ts`): cada `Booking` ya trae `launchId` y `launch.fullName` (nombre completo de la API, con o sin `" · "`), que son el valor y el texto de las opciones (R1). El orden de `feat-my-bookings` R4 sale de `sortByMostRecent`; filtrar con `Array.prototype.filter` lo conserva.
- `MyBookingsPage` (`MyBookingsContent`): estados `loading` → `LoadingIndicator`, `error` → `ErrorMessage` con "Reintentar", vacío → `EmptyState` "Todavía no tienes reservas." + "Ver lanzamientos", lista `ul.launch-list` de `BookingCard`. El selector solo se añade en la rama "lista con datos" (R6 y caso límite de error sin cambios).
- Patrón de parámetros de URL de `feat-launch-search-sort`: módulo puro `launch-list-params.ts` (`parse…` / `with…` que devuelven un `URLSearchParams` nuevo), escritura con la forma funcional `setSearchParams((current) => with…(current, …), { replace: true })` dentro de `useCallback`, `<select>` controlado por la URL con etiqueta por `useId` (rol `combobox`) y guardas de tipo sin `as`. Clases CSS `.launch-filters` / `.launch-filters__field` ya existentes (incluido el ajuste a 375 px).
- Helpers de test: unit `tests/unit/support/{bookings,http,session,deferred}` (`bookingDto`, `suborbitalBookingDto`, `bookingFromDto`, `mockFetchByUrl`, `jsonResponse`, `renderApp`, `currentLocation`, `storeSession`); e2e `tests/e2e/fixtures/{api-mock,data,session,locators}.ts` (`mockBookings` con `requests`, `bookingWithActivity`, `bookingIdOf`, `seedSession`, `sessionValue`, `bookingCard`).

No se añade ninguna dependencia.

Huecos y ambigüedades: ver [Puntos a decidir](#puntos-a-decidir). Ninguno cambia el producto de forma importante; el plan aplica la recomendación (delegado por la persona).

### Contrato real de la API (fork `activity-bookings-express`, `master` en `7f69493`)

| Aspecto | Comportamiento | Evidencia |
|---|---|---|
| Ruta | `GET /bookings` con `authenticateToken`. Devuelve **solo las reservas de la persona** (`getAllByUserId(user.id)`), en orden de inserción, cada una enriquecida con `activity` (`name`, `slug`, `price`, `date`, `duration`, `location`, `status`) y `paymentStatus`. | `src/routes/bookings.ts:25-46`; `src/services/booking.service.ts:118-119`, `:149-173` |
| `?activityId=` | Se filtra **después** de quedarse con las reservas de la persona: id inexistente → **200 `[]`**; id de un lanzamiento que solo ha reservado otra persona → **200 `[]`** (no filtra información ajena); `?activityId=` vacío → se ignora (todas); parámetro repetido (`?activityId=a&activityId=b`) → llega como array y no coincide con nada → `[]`. | `src/routes/bookings.ts:37-43` |
| Errores | 401 del middleware (sin token / token inválido o caducado); **500 `Failed to retrieve bookings`** si alguna reserva apunta a una actividad que ya no existe (`enrichBookingWithActivity` lanza `Activity not found`): falla la lista entera. | `src/routes/bookings.ts:47-54`; `src/services/booking.service.ts:150-153` |
| Opciones del filtro | **No hace falta pedir `GET /activities`**: el nombre completo y el id del lanzamiento ya vienen en cada reserva (`activityId` + `activity.name`). Además `GET /activities` es público y lista todos los lanzamientos (también los no reservados y los `draft`), que no deben aparecer en el selector (R1: "lanzamientos distintos de sus reservas"). | `src/services/booking.service.ts:155-171`; `src/routes/activities.ts:112-136` |

Conclusiones: el contrato coincide con la spec y con ADR-009 (una sola petición `GET /bookings`, filtro en el cliente, sin `activityId`). Diferencias, ninguna cambia el producto:

- (a) El PRD (tabla de vistas, línea "Mis reservas (F14, F19) → `GET /bookings?activityId=`") sugiere usar `activityId`; el ADD (§4.1 endpoint 6, ADR-009) y la spec lo excluyen expresamente. Manda la spec. Se anota para que `craftsman` alinee el PRD (P8).
- (b) Si el fork tiene una reserva huérfana (actividad borrada), la lista entera devuelve 500 y no hay selector: es el caso límite "Error al cargar las reservas" de la spec (riesgo R5 del ADD), sin cambio.

### Impacto en lo existente

| Fichero | Cambio |
|---|---|
| `src/features/bookings/booking-filter.ts` (nuevo) | Lógica pura del filtro: opciones, lectura/escritura de `lanzamiento` y filtrado (C1–C4). |
| `src/features/bookings/BookingFilter.tsx` (nuevo) | Selector "Filtrar por lanzamiento" (C5). |
| `src/features/bookings/MyBookingsPage.tsx` | Con datos: pinta `BookingFilter` encima de la lista y filtra las reservas según la URL (C6, C7). Sin datos, cargando o con error: sin cambios. |
| `tests/unit/features/bookings/MyBookingsPage.test.tsx` | Tests nuevos de R1–R6; los existentes deben seguir en verde sin cambiar sus aserciones. |
| `tests/unit/support/bookings.ts` | Nada obligatorio; si hace falta, un `bookingDto` más (`booking-5`, `activity-1`) para el criterio de tres reservas (C9). |
| `tests/e2e/fixtures/data.ts` | `filterBookingDtos`: las tres reservas del criterio (C10). |
| `tests/e2e/fixtures/api-mock.ts` | `trackFinishedRequests(page, method, url)` genérico para contar peticiones completadas (C10). |

No hace falta CSS nuevo (se reutilizan `.launch-filters` y `.launch-filters__field`, ver C5). Los tests existentes de `MyBookingsPage`, `BookingCard`, `BookingDetailPage`, `bookings-edge-cases` y los e2e `my-bookings*.spec.ts` deben seguir en verde: ninguno busca un `combobox` en `/reservas` y el número de `article` no cambia sin filtro.

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| C1 | **Módulo puro** `src/features/bookings/booking-filter.ts` (patrón de `launch-list-params.ts`): `LAUNCH_FILTER_PARAM = 'lanzamiento'`; `type LaunchFilterOption = { launchId: string; label: string }`. | AGENTS §6 (lógica sin UI separada); ADD §5.2. |
| C2 | **Opciones** `launchFilterOptions(bookings: readonly Booking[]): LaunchFilterOption[]`: una por `launchId` distinto (la primera reserva de cada lanzamiento da el `label` = `launch.fullName`), ordenadas con `a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })` y, a igualdad, por `launchId` (orden estable y determinista). | R1; notas de la spec (`localeCompare` con `es`, sin distinguir mayúsculas); casos límite (un solo lanzamiento, nombre sin `" · "`). Ver P3. |
| C3 | **Lectura** `selectedLaunchId(searchParams, options): string \| null`: el valor de `lanzamiento` si coincide **exactamente** con el `launchId` de alguna opción; si falta, está vacío o no coincide → `null` ("Todos los lanzamientos"). Se calcula en cada render a partir de la URL (sin estado duplicado). | R4, R5; ADD §5.2 ("sin estado duplicado"). |
| C4 | **Escritura** `withLaunchFilter(searchParams, launchId: string \| null): URLSearchParams`: copia los parámetros actuales; con id → `set('lanzamiento', id)`; con `null` → `delete('lanzamiento')`. `/reservas` sin tocar nada no gana parámetros. **Filtrado** `filterBookingsByLaunch(bookings, launchId)`: `null` → la misma lista; si no, `bookings.filter((booking) => booking.launchId === launchId)` (conserva el orden de `sortByMostRecent`). | R2, R3; notas de la spec (orden de `feat-my-bookings` R4). |
| C5 | **`BookingFilter`** (`features/bookings/BookingFilter.tsx`), presentacional: props `options`, `selectedLaunchId: string \| null`, `onChange(launchId: string \| null)`. `<div className="launch-filters">` + `<div className="launch-filters__field">` con `<label htmlFor={id}>Filtrar por lanzamiento</label>` y `<select id={id} value={selectedLaunchId ?? ''}>`; primera opción `value=""` "Todos los lanzamientos", después una por opción con `value={launchId}` y texto `label`. `onChange`: `''` → `null`; otro valor → ese id. Sin `role="search"` (no es una búsqueda). Se reutilizan las clases CSS del listado de lanzamientos en vez de duplicarlas. | R1–R3; AGENTS §7 (no duplicar). Ver P4. |
| C6 | **`MyBookingsPage`**: `MyBookingsContent` lee `useSearchParams()`; en la rama con datos (`state.data.length > 0`) calcula `options`, `selected` y `visible = filterBookingsByLaunch(state.data, selected)`, pinta `<BookingFilter …/>` y después `ul.launch-list` con `visible`. `handleFilterChange = useCallback((launchId) => setSearchParams((current) => withLaunchFilter(current, launchId), { replace: true }), [setSearchParams])`. `loading`, `error` y vacío **no** pintan el selector. | R1, R2, R3, R6; caso límite de error; ADR-009. |
| C7 | **Sin nueva petición**: el filtro no toca `useMyBookings` ni su `loader`; cambiar `lanzamiento` solo re-renderiza. "Reintentar" tras un error conserva el filtro (está en la URL). | R2; ADR-009. |
| C8 | **Navegación con `replace: true`** (igual que búsqueda y orden, `feat-launch-search-sort` E4): elegir un lanzamiento reemplaza la entrada del historial; "Atrás" desde el detalle de una reserva vuelve a `/reservas?lanzamiento=…` con el filtro aplicado, y "Atrás" desde `/reservas` sale a la página anterior en lugar de recorrer cada filtro elegido. | R4 ("o vuelve a ella con Atrás"); contexto de la spec. Ver P1. |
| C9 | **Tests unitarios** en carpetas que reflejan `src/`: `tests/unit/features/bookings/{booking-filter.test.ts,BookingFilter.test.tsx,MyBookingsPage.test.tsx}`. La página se prueba con `renderApp('/reservas?…')` (ruta protegida real, sesión con `storeSession`, `fetch` simulado con `mockFetchByUrl`, URL con `currentLocation()`), igual que los tests existentes de `MyBookingsPage`, sin mockear `src/api/*`. Fixtures: `bookingDto()` (booking-1, `activity-1`), `bookingDto({ id: 'booking-5', participants: 1, createdAt: '2026-11-05T12:00:00.000Z' })` (segunda de `activity-1`) y `suborbitalBookingDto()` (booking-2, `activity-3`). | Skill `testing-unit-vitest`; ADD §9; desviación ya aceptada en planes anteriores. |
| C10 | **E2E** (`tests/e2e/my-bookings-filter.spec.ts`): `data.ts` añade `filterBookingDtos` = `booking-1` (`activity-1`, 2 plazas, 2026-11-03), `booking-5` (`activity-1`, 1 plaza, 2026-11-05) y `booking-2` (`activity-3`, 3 plazas, 2026-11-04), con `bookingWithActivity`. Manejador por test: lista → `filterBookingDtos`; `/bookings/<id>` → la reserva o 404 (como `defaultBookingsHandler`). Para "una sola petición en total" (R2) se cuentan las peticiones **completadas** con `trackFinishedRequests(page, 'GET', \`${API_URL}/bookings\`)` (nuevo en `api-mock.ts`, mismo criterio que el helper local de `launch-search-sort.spec.ts`: en desarrollo `StrictMode` aborta la primera), y además se comprueba que `bookings.requests.length` no cambia al elegir. Ninguna petición lleva `activityId`. | ADR-007; ADD §9; criterios R1–R6. Ver P6. |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación. Nombres de test en inglés con el `Rn` delante.

### Unitarios y de componentes (Vitest, jsdom, `TZ=UTC`)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R1 | `R1: builds one option per distinct launch, sorted alphabetically` — tres reservas (2 × `activity-1`, 1 × `activity-3`) → `[{ activity-1, 'Falcon 9 · Misión Luna' }, { activity-3, 'New Shepard · Vuelo Suborbital' }]`; orden independiente del de entrada | unit | `tests/unit/features/bookings/booking-filter.test.ts` |
| R1 | `R1: sorts ignoring case and uses the full name without separator` — "paseo Lunar Express" / "Ariane 6 · …" / "Paseo Lunar Express" (`activity-8`); a igualdad de texto, por `launchId`; una sola reserva → una opción | unit | `tests/unit/features/bookings/booking-filter.test.ts` |
| R2, R3 | `withLaunchFilter` — `('', 'activity-1')` → `lanzamiento=activity-1`; `('lanzamiento=activity-1', null)` → `''`; conserva otros parámetros | unit | `tests/unit/features/bookings/booking-filter.test.ts` |
| R2 | `filterBookingsByLaunch` — `activity-1` → solo sus reservas en el mismo orden; `null` → todas | unit | `tests/unit/features/bookings/booking-filter.test.ts` |
| R4, R5 | `it.each` `selectedLaunchId(%s)` — `lanzamiento=activity-3` → `activity-3`; sin parámetro, `lanzamiento=`, `lanzamiento=activity-99`, `lanzamiento=ACTIVITY-1` → `null` | unit | `tests/unit/features/bookings/booking-filter.test.ts` |
| R1 | `R1: renders the select with "Todos los lanzamientos" first` — `combobox` "Filtrar por lanzamiento", opciones en orden, valor mostrado según `selectedLaunchId` | componente | `tests/unit/features/bookings/BookingFilter.test.tsx` |
| R2, R3 | `R2: calls onChange with the launch id` / `R3: calls onChange with null for "Todos los lanzamientos"` (`userEvent.selectOptions`) | componente | `tests/unit/features/bookings/BookingFilter.test.tsx` |
| R1 | `R1: shows the filter with the launches of the bookings` — `/reservas`, tres reservas → opciones "Todos los lanzamientos", "Falcon 9 · Misión Luna", "New Shepard · Vuelo Suborbital"; elegido "Todos los lanzamientos"; tres `article` | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R1 | `R1: shows the filter with a single booking` — dos opciones | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R2 | `R2: filters by launch without a new request` — elegir "Falcon 9 · Misión Luna" → `currentLocation()` = `/reservas?lanzamiento=activity-1`; dos `article` de "Misión Luna" (booking-5 antes que booking-1), ninguno de "Vuelo Suborbital"; `fetch` llamado **1** vez | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R3 | `R3: shows all bookings again and removes the parameter` — desde `/reservas?lanzamiento=activity-1`, elegir "Todos los lanzamientos" → `/reservas`, tres `article`, `fetch` 1 vez | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R4 | `R4: applies the filter from the URL` — `/reservas?lanzamiento=activity-3` → selector con "New Shepard · Vuelo Suborbital"; un `article` "Vuelo Suborbital" | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R5 | `R5: ignores an unknown launch in the URL` — `/reservas?lanzamiento=activity-99` → "Todos los lanzamientos", tres `article` | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R6 | `R6: hides the filter without bookings` — `[]` → sin `combobox` "Filtrar por lanzamiento", "Todavía no tienes reservas." | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| Límite | `hides the filter while loading and on error, and keeps the URL filter after retry` — respuesta diferida: sin selector; 500 → sin selector y "Reintentar"; reintento con datos en `/reservas?lanzamiento=activity-1` → filtro aplicado | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| ADR-009 | `does not send activityId` — la única petición es `…/bookings` sin parámetros, también con `?lanzamiento=` en la URL | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |

### End-to-end (Playwright, Chromium y Firefox, API interceptada)

Fichero `tests/e2e/my-bookings-filter.spec.ts`; `mockBookings` con el manejador de C10; sesión con `seedSession(page, sessionValue())`; `page.clock.setFixedTime('2026-11-06T10:00:00Z')`; `timezoneId: 'UTC'`, `locale: 'es-ES'`. Ninguna petición sale a la API real (puerto 3999 sin servidor). Selector: `page.getByRole('combobox', { name: 'Filtrar por lanzamiento' })`; opciones con `getByRole('option')` + `toHaveText([...])`; elección con `selectOption({ label })`; tarjetas con `bookingCard(page, mission)` o `main.getByRole('article')`.

| Requisito | Test |
|---|---|
| R1 | `R1: lists the launches of my bookings in alphabetical order` (opciones exactas en orden y `toHaveValue('')`) |
| R2 | `R2: filters by launch with a single request` (URL `/reservas?lanzamiento=activity-1`; 2 tarjetas "Misión Luna", 0 "Vuelo Suborbital"; peticiones `GET /bookings` completadas = 1 y `bookings.requests.length` sin cambio tras elegir; ninguna con `activityId`) |
| R3 | `R3: shows all bookings again` (desde `/reservas?lanzamiento=activity-1` → "Todos los lanzamientos" → URL `/reservas`, 3 tarjetas) |
| R4 | `R4: restores the filter on open, reload and back` (`goto('/reservas?lanzamiento=activity-3')` → selector "New Shepard · Vuelo Suborbital", 1 tarjeta; `reload()` → igual; abrir la tarjeta → `/reservas/booking-2` → `goBack()` → igual) |
| R5 | `R5: ignores an unknown launch` (`/reservas?lanzamiento=activity-99` → "Todos los lanzamientos", 3 tarjetas) |
| R6 | `R6: hides the filter without bookings` (`[]` → sin selector, "Todavía no tienes reservas.") |
| Límite | `hides the filter when the bookings cannot load` (500 `Failed to retrieve bookings` → texto de servidor, "Reintentar", sin selector) y `uses the full name for a launch without separator` (reserva de `activity-8` → opción "Paseo Lunar Express") |

## Tareas

- [x] **T1** — Lógica pura del filtro (C1–C4). · Requisitos: R1, R2, R3, R4, R5 · Ficheros: `tests/unit/features/bookings/booking-filter.test.ts`, `src/features/bookings/booking-filter.ts`.
  - Verificación: `npm test -- tests/unit/features/bookings/booking-filter.test.ts`; `npm run typecheck`.
- [x] **T2** — Componente `BookingFilter` (C5). · Requisitos: R1, R2, R3 · Ficheros: `tests/unit/features/bookings/BookingFilter.test.tsx`, `src/features/bookings/BookingFilter.tsx`.
  - Verificación: `npm test -- tests/unit/features/bookings/BookingFilter.test.tsx`.
- [x] **T3** — Integración en `MyBookingsPage` con la URL (C6–C8). · Requisitos: R1–R6 · Ficheros: `tests/unit/features/bookings/MyBookingsPage.test.tsx`, `src/features/bookings/MyBookingsPage.tsx`, `tests/unit/support/bookings.ts` (solo si hace falta un helper para `booking-5`).
  - Los tests existentes de `MyBookingsPage`, `BookingDetailPage` y `bookings-edge-cases` deben seguir en verde sin cambiar sus aserciones.
  - Verificación: `npm test -- tests/unit/features/bookings`; `npm run lint`.
- [x] **T4** — E2E (C10). · Requisitos: R1–R6 · Ficheros: `tests/e2e/fixtures/data.ts` (`filterBookingDtos`), `tests/e2e/fixtures/api-mock.ts` (`trackFinishedRequests`), `tests/e2e/my-bookings-filter.spec.ts`.
  - Verificación: `npx.cmd playwright test tests/e2e/my-bookings-filter.spec.ts --project=chromium`.
- [x] **T5** — Verificación final. · Requisitos: R1–R6 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Ejecutar en orden: `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa: regresión + `my-bookings-filter`).
  - **No** usar `npm run test:e2e -- --project=chromium` (el script ya fija los dos proyectos). Firefox lo ejecuta **la persona**: `npx.cmd playwright test --project=firefox`.
  - Comprobar: sin `console.log`, código comentado, `any` ni `as T` sobre datos de red o parámetros de URL; ningún componente llama a `fetch`; ninguna petición con `activityId`; sin dependencias nuevas en `package.json`; `git status` sin ficheros no previstos.
  - Prueba manual opcional (persona) contra el fork (`npm run dev` + fork en `:3000`): con una cuenta que tenga reservas en al menos dos lanzamientos, elegir uno, recargar, abrir una reserva y volver con "Atrás"; comprobar en la pestaña Red que solo hay un `GET /bookings`.

## Desviaciones durante la implementación

Rellenado por `5-coder`.

| # | Desviación | Motivo |
|---|---|---|
| D1 | `trackFinishedRequests` se añade a `tests/e2e/fixtures/api-mock.ts` **y** el helper local `trackFinishedListRequests` de `launch-search-sort.spec.ts` pasa a delegar en él (una línea), en lugar de dejar la unificación para `7-cleaner` (P6). | Indicación del orquestador (`builder`) de reutilizar el helper existente en vez de duplicarlo. Sin cambio de comportamiento: los 20 tests de `launch-search-sort` siguen en verde. |
| D2 | `tests/unit/support/bookings.ts` no se toca: `booking-5` se construye con `bookingDto({ id: 'booking-5', … })` y `bookingFromDto(…)` en cada test. En el test de orden alfabético se usa `activity-5` (Ariane 6) y `activity-9` con el nombre sobrescrito a "paseo Lunar Express" para el caso de mayúsculas. | Los helpers existentes bastan (C9 lo dejaba opcional). |
| D3 | En T2 el test y el componente se escribieron en el mismo paso, sin ejecutar antes el test en rojo (T1 y T3 sí se vieron en rojo). | Componente presentacional trivial; el test cubre R1–R3 igualmente. |

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] `npm run build` en verde
- [x] Tests e2e de la spec en verde (Chromium agente, Firefox persona) — Chromium 184/184 y Firefox 184/184
- [x] CHANGELOG actualizado

## Puntos a decidir

La persona ha delegado las decisiones de esta spec: el plan aplica la recomendación. Ninguna cambia el producto de forma importante. Las marcadas **abierta** conviene que la persona las confirme, pero no bloquean.

| # | Tema | Ambigüedad | Decisión aplicada |
|---|---|---|---|
| P1 | `replace` o `push` al elegir (**abierta**) | El contexto dice que el filtro debe "sobrevivir al botón Atrás"; R4 lo concreta como volver a `/reservas?lanzamiento=…` con "Atrás". No dice si "Atrás" debe deshacer cada cambio de filtro. | `replace: true`, como búsqueda y orden (C8): "Atrás" desde el detalle de una reserva conserva el filtro; "Atrás" desde la lista no recorre los filtros elegidos. Si la persona quiere que "Atrás" deshaga el último filtro, basta con quitar `replace` (sin otros cambios). |
| P2 | URL con lanzamiento desconocido | R5 fija el selector y la lista, pero no la URL. | La URL **no** se toca (no hay redirección ni limpieza automática); al elegir otra opción se sobrescribe y con "Todos los lanzamientos" desaparece. Un `?lanzamiento=` vacío se trata igual (R5). |
| P3 | Desempate del orden alfabético | Dos lanzamientos distintos con el mismo nombre (sin distinguir mayúsculas) quedarían en orden indefinido. | Desempate por `launchId` (C2). Ambas opciones aparecen; no se fusionan porque son lanzamientos distintos. |
| P4 | Estilos | La spec no fija el aspecto. | Se reutilizan `.launch-filters` / `.launch-filters__field` (misma apariencia y ajuste móvil que en `/lanzamientos`) en lugar de crear clases nuevas (C5). |
| P5 | Cabecera "Mis reservas" con filtro activo | Pulsar "Mis reservas" en la cabecera estando en `/reservas?lanzamiento=…` navega a `/reservas`: el filtro se quita y, como la ruta no se vuelve a montar, **no** se repite la petición. | Se acepta (coherente con ADR-009; las reservas se refrescan al volver a entrar desde otra vista). |
| P6 | Recuento de peticiones en e2e | En desarrollo `StrictMode` lanza y aborta una primera petición; "solo una petición en total" (R2) podría dar 2 si se cuentan las interceptadas. | Se cuentan las **completadas** (`requestfinished`) y además se comprueba que elegir no añade peticiones (C10). El helper `trackFinishedRequests` se añade a `fixtures/api-mock.ts` para esta spec; unificarlo con el helper local de `launch-search-sort.spec.ts` queda para `7-cleaner`. |
| P7 | Filtro ante reservas cambiantes | Si al recargar desaparece la última reserva del lanzamiento filtrado, el valor de la URL deja de existir. | Se aplica R5: "Todos los lanzamientos" y todas las reservas. |
| P8 | PRD desalineado (**abierta**, informativa) | La tabla de vistas del PRD cita `GET /bookings?activityId=` para "Mis reservas (F14, F19)"; el ADD (ADR-009) y la spec no usan `activityId`. | Manda la spec. Propuesta: que `craftsman` corrija la fila del PRD en una `chore` de documentación. |
