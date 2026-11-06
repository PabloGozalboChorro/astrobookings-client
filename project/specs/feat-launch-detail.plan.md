# Plan: feat-launch-detail

- **Spec:** [feat-launch-detail.spec.md](feat-launch-detail.spec.md)
- **Rama:** `feat/launch-detail`

## Revisión de la spec

La spec encaja con el PRD (F8, F11, D3, D4, D8, V5; partes de F17 y F18) y con el ADD (§3 estructura: `LaunchDetailPage`, `BookabilityNotice`, `use-launch`; §4.1 endpoint 4 `GET /activities/:id` → 200 `Activity` / 404 `Activity not found`; §5.1 ruta `/lanzamientos/:id`; §6 `getBookability(launch, now)` y `bookabilityReasonText`; §8 semilla; §9 pruebas; riesgos R1 y R10). Se reutiliza lo que ya hay en `main`: `http()`, `ApiError`/`NetworkError`/`ContractError` (`src/api/errors.ts`, el 404 ya se clasifica como `kind: 'not-found'`), `toUserMessage`, `useAsyncData`, `LoadingIndicator`, `ErrorMessage`, `activityDtoSchema`, `toLaunch`, `isVisible`, `launchStatusLabel`, `formatPrice`/`formatDateTime`/`formatDuration`, los helpers `tests/unit/support/{activities,http,deferred}.ts` y los fixtures e2e `tests/e2e/fixtures/{data,api-mock}.ts`.

Comprobaciones hechas:
- Contrato real en el fork (`activity-bookings-express/src/routes/activities.ts`, `GET /:id`): sin autenticación; 200 con la actividad (incluye `draft`); 404 `{ "message": "Activity not found", "errors": [] }`; 500 `{ "message": "Failed to retrieve activity", "errors": [] }` (en singular, distinto del listado; `toUserMessage` ya lo traduce al texto de servidor porque todo `status >= 500` da ese texto).
- Semilla (`db/seed/activities.json`): `activity-1` published 2027-03-15T14:30Z (min 2, max 6), `activity-2` confirmed 2027-06-01, `activity-3` published 2027-02-10, `activity-4` sold-out 2027-04-20, `activity-5` cancelled 2027-09-12, `activity-6` done 2026-09-30, `activity-7` draft, `activity-8` published 2027-12-24 sin cohete, `activity-9` published 2026-10-01. Con `now = 2026-11-05T10:00:00Z` los resultados de R6/R7/R8 coinciden con la spec.
- `toUserMessage` ya contiene "Activity not found" → "Este lanzamiento no existe o ya no está disponible." (texto de R3).
- `mockActivities` registra `http://localhost:3999/activities**`, que **también** captura `/activities/<id>`; hoy su manejador por defecto devuelve la lista completa a cualquier URL, lo que para el detalle sería un `ContractError`. Hay que extenderlo (E12).
- `tests/setup.ts` ya fija `TZ=UTC`; Playwright 1.64 dispone de `page.clock`.
- **Regresión detectada:** `tests/e2e/app-shell-edge.spec.ts` (scaffolding R10) abre `/lanzamientos/no-existe` y espera "Página no encontrada". Con esta spec esa URL pasa a ser un detalle → 404 de la API → pantalla de R3. Ver P1.

No se añade ninguna dependencia.

Huecos y contradicciones: ver [Puntos a decidir](#puntos-a-decidir). El plan aplica la opción **recomendada**; si la persona elige otra, se ajusta antes de la tarea afectada.

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| E1 | `src/api/activities.ts` añade `getActivity(id: string, signal?: AbortSignal): Promise<ActivityDto>` → `http(`/activities/${encodeURIComponent(id)}`, activityDtoSchema, { signal })`. Sin `auth` (la API no la pide; "con o sin sesión"). `getActivities` no se toca. | ADD §4.1 endpoint 4; id con caracteres especiales no rompe la ruta. |
| E2 | `src/domain/launch.ts` añade, exactamente como ADD §6: `type BookabilityReason = 'sold-out' \| 'done' \| 'cancelled' \| 'draft' \| 'past-date'`, `type Bookability = { bookable: true } \| { bookable: false; reason: BookabilityReason }`, `getBookability(launch, now): Bookability` y `bookabilityReasonText(reason): string` (`Record<BookabilityReason, string>` con los textos de la spec, sin `default`). | R6, R7, R8; funciones puras con `now` inyectado. |
| E3 | `getBookability`: primero el estado por prioridad (`draft` > `cancelled` > `done` > `sold-out`), comprobando el estado **antes** que la fecha; si el estado es `published`/`confirmed`, reservable solo si `launch.date.getTime() > now.getTime()` (estrictamente posterior), si no `past-date`. Así `activity-6` (`done` + fecha pasada) da `done` y una fecha igual a `now` da `past-date`. | R6 y casos límite. |
| E4 | Momento actual en la UI: nuevo hook `src/hooks/use-now.ts` → `useNow(): Date` = `useState(() => new Date())[0]`. Se captura una vez al montar la página (no se recalcula, como acepta la spec) y evita llamar a `new Date()` durante el render, que la regla `purity` de `eslint-plugin-react-hooks` 7 marca. Si aun así el lint lo marcara, la alternativa es calcular `now` dentro del loader. | Spec ("se calcula al mostrar la página"); lint `--max-warnings 0`. |
| E5 | `src/features/launches/use-launch.ts`: `useLaunch(id: string): AsyncData<Launch>` = `useAsyncData` con loader memoizado por `useCallback(…, [id])` que llama a `getActivity(id, signal)` y devuelve `toLaunch(dto)` (sin filtrar: el borrador lo decide la página). Al cambiar `id` el loader cambia y `useAsyncData` vuelve a "cargando". | ADD §3; restricción de loader estable. |
| E6 | `src/api/errors.ts` añade `isNotFoundError(error: unknown): error is ApiError` (`ApiError` con `kind === 'not-found'`). Cualquier 404 se trata como no encontrado, con o sin cuerpo. `src/domain/api-errors.ts` exporta la constante `LAUNCH_NOT_FOUND_TEXT` ("Este lanzamiento no existe o ya no está disponible.") y la reutiliza en `KNOWN_API_MESSAGES`, para no duplicar el texto. | R3; evitar duplicación (AGENTS §7); útil después para el 404 de reservas. |
| E7 | `LaunchDetailPage.tsx` (ruta `lanzamientos/:id`, `useParams`): `loading` → `<LoadingIndicator label="Cargando lanzamiento…" />`; `error` no encontrado **o** `ready` con `!isVisible(launch)` → `<LaunchNotFound />`; otro `error` → `<ErrorMessage message={toUserMessage(error)} onRetry={reload} />`; `ready` visible → detalle. Si `id` fuese `undefined` (no ocurre con la ruta, pero el tipo lo permite) → `<LaunchNotFound />` sin petición. | R1, R3, R4, R5. |
| E8 | Detalle (`ready`): `<h1>{mission}</h1>`; `Cohete: {rocket}` solo si no es `null`; `Identificador: {slug}`; lugar; `<time dateTime=…>{formatDateTime(date)}</time>`; `formatDuration`; `"{formatPrice} por plaza"`; `formatTotalSeats(totalSeats)`; `Mínimo de viajeros para confirmar el lanzamiento: {minParticipants}`; `launchStatusLabel(status)`; enlace "Volver a los lanzamientos" a `/lanzamientos`. Después, `getBookability(launch, now)`: si no es reservable, `<BookabilityNotice reason=… />`; si lo es, **no se pinta nada** (hueco para `feat-booking-creation`, ver E13). | R2, R7. |
| E9 | `LaunchNotFound.tsx`: `<h1>Lanzamiento no encontrado</h1>`, `<p>{LAUNCH_NOT_FOUND_TEXT}</p>` y enlace "Ver todos los lanzamientos" a `/lanzamientos`; sin `role="alert"` ni "Reintentar". Ver P2 para el encabezado. | R3, R4; mismo patrón que `NotFoundPage`. |
| E10 | `BookabilityNotice.tsx`: `<p className="bookability-notice">{bookabilityReasonText(reason)}</p>`, presentacional. **Sin** `role="status"`/`alert` para no chocar con el indicador de carga (`getByRole('status')`) ni anunciarse como error. Se usa en el detalle y en `LaunchCard`. | R7, R8; ADD §3. |
| E11 | Listado: `LaunchListPage` obtiene `now = useNow()` y pasa a cada tarjeta `bookability={getBookability(launch, now)}`; `LaunchCard` recibe la nueva prop **obligatoria** `bookability: Bookability` y, si no es reservable, pinta `<BookabilityNotice>` tras el texto del estado. El texto de plazas totales de la tarjeta (`seatsText`) se mueve a `src/domain/format.ts` como `formatTotalSeats(n)` ("1 plaza en total" / "N plazas en total") para usarlo también en el detalle. | R8; R2; sin duplicar lógica. |
| E12 | Fixtures e2e: `data.ts` añade `errorResponses.activityNotFound` (`Activity not found`) y `errorResponses.failedToRetrieveActivity` (`Failed to retrieve activity`), y exporta `findLaunchDto`. `api-mock.ts`: exporta `activityIdOf(request): string \| null` (id si la ruta es `/activities/<id>`, `null` para el listado) y cambia el manejador **por defecto** para que el listado siga devolviendo `launchDtos` y el detalle devuelva el DTO de la semilla o 404 `activityNotFound`. La firma `mockActivities(page, handler?)` y `requestedUrls` no cambian; los tests existentes que pasan su propio manejador solo piden el listado. | ADR-007; un único mock de `/activities**` (dos `page.route` superpuestas serían frágiles). |
| E13 | Preparado para `feat-booking-creation` sin implementarlo: (a) la rama "reservable" de `LaunchDetailPage` queda vacía y es donde esa spec pondrá `BookingForm` (con sesión) o los enlaces "Iniciar sesión"/"Crear cuenta" (sin sesión); (b) `useLaunch` ya devuelve `reload`; (c) `getBookability` es la única fuente de la regla. **No** se crea `BookingForm`, ni campo "Número de plazas", ni botón "Reservar", ni texto provisional. | Alcance (excluido el formulario); R7 "ninguna opción para reservar". |
| E14 | `src/App.tsx`: `<Route path="lanzamientos/:id" element={<LaunchDetailPage />} />`. `/lanzamientos/a/b` sigue cayendo en `*` → `NotFoundPage`. | ADD §5.1. |
| E15 | Unit/componentes: como en `feat-launch-list`, se simula `fetch` con `mockFetch`/`vi.spyOn(globalThis, 'fetch')` y `deferred` (no se mockea `src/api/*`) y se renderiza con `MemoryRouter` + `<Routes><Route path="/lanzamientos/:id" …/></Routes>`. El reloj se fija **solo para `Date`** con `vi.useFakeTimers({ now: new Date('2026-11-05T10:00:00.000Z'), toFake: ['Date'] })` y `vi.useRealTimers()` en `afterEach`, para no bloquear `findBy*`/`waitFor` ni `user-event`. DTO de prueba con `activityDto(overrides)` (ya existente). | ADD §9; reutiliza helpers. |
| E16 | E2E: fichero nuevo `tests/e2e/launch-detail.spec.ts` (detalle y R8 del listado) con `test.use({ timezoneId: 'UTC', locale: 'es-ES' })` y, en `beforeEach`, `page.clock.setFixedTime(new Date('2026-11-05T10:00:00Z'))` (fija `Date` pero deja correr los temporizadores, a diferencia de `clock.install`). Con `StrictMode` en dev, la primera petición se cancela: se cuentan las peticiones **completadas** a `/activities/activity-1` (`requestfinished`) = 1. Para "Reintentar" se usa el patrón `apiDown` del listado (falla mientras el indicador está activo). Sin esperas fijas. | R1–R8; misma estrategia que `launches.spec.ts`. |
| E17 | Estilos mínimos en `src/styles/global.css`: `.launch-detail` (columna, `overflow-wrap: anywhere`) y `.bookability-notice` (borde/fondo de aviso, contraste AA). Nada de ancho fijo. | Coherencia visual; no es requisito verificable. |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación. Nombres de test en inglés con el `Rn` delante. Los textos con `€` se normalizan (U+00A0) en unit; en e2e `toHaveText`/`toContainText` ya normalizan.

### Unitarios y de componentes (Vitest, `TZ=UTC`)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R1 | `R1: getActivity requests GET /activities/:id without Authorization and parses the launch` — URL `http://localhost:3999/activities/activity-1`, método `GET`, sin `Authorization` | unit | `tests/unit/api/activities.test.ts` |
| R1 | `R1: getActivity encodes the id in the path` — `"xyz/1"` → `/activities/xyz%2F1` | unit | `tests/unit/api/activities.test.ts` |
| R1 | `R1: getActivity forwards the abort signal` | unit | `tests/unit/api/activities.test.ts` |
| R3 | `R3: getActivity throws a not-found ApiError on 404 Activity not found` + `isNotFoundError` true; `R3: isNotFoundError is false for %s` (`NetworkError`, `ContractError`, `ApiError` 500, `Error`) | unit | `tests/unit/api/activities.test.ts`, `tests/unit/api/errors.test.ts` |
| R5 | `R5: getActivity throws ContractError for { "id": 1 }` | unit | `tests/unit/api/activities.test.ts` |
| R6 | `it.each` `R6: %s is bookable` — `activity-1` (published 2027-03-15), `activity-2` (confirmed 2027-06-01) con `now = 2026-11-05T10:00:00.000Z` | unit | `tests/unit/domain/launch.test.ts` |
| R6 | `it.each` `R6: %s is not bookable because of %s` — `activity-9` → `past-date`, `activity-4` → `sold-out`, `activity-5` → `cancelled`, `activity-6` → `done`, `activity-7` → `draft` | unit | `tests/unit/domain/launch.test.ts` |
| R6 | `R6: a published launch dated exactly now is not bookable (past-date)` y `R6: a launch 1 ms after now is bookable` (también `confirmed`) | unit | `tests/unit/domain/launch.test.ts` |
| R6 | `it.each` `R6: reason priority %s` — `draft` con fecha pasada → `draft`; `cancelled` pasada → `cancelled`; `done` pasada → `done`; `sold-out` pasada → `sold-out` | unit | `tests/unit/domain/launch.test.ts` |
| R7 | `it.each` `R7: bookabilityReasonText(%s) is "%s"` — tabla de la spec (5 motivos) | unit | `tests/unit/domain/launch.test.ts` |
| R2 | `it.each` `R2: formatTotalSeats(%i) is "%s"` — 1 → "1 plaza en total", 6 → "6 plazas en total" (movido desde la tarjeta) | unit | `tests/unit/domain/format.test.ts` |
| R7 | `it.each` `R7: BookabilityNotice shows "%s" for %s` y `R7: BookabilityNotice has no status or alert role` | componente | `tests/unit/features/launches/BookabilityNotice.test.tsx` |
| R1 | `R1: requests the launch once and shows the loading status until it arrives` — `deferred` → `status` "Cargando lanzamiento…", `fetch` 1 vez con `/activities/activity-1`; al resolver, sin `status` y con `h1` "Misión Luna" | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R2 | `R2: shows every launch field` — los 10 textos del criterio y el enlace "Volver a los lanzamientos" con `href="/lanzamientos"` | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R2 | `R2: hides the rocket line for a name without separator` — `activity-8` → `h1` "Paseo Lunar Express", sin "Cohete:" | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R3 | `R3: shows the not found screen on 404 without retry` — texto, enlace "Ver todos los lanzamientos" → `/lanzamientos`, 0 botones "Reintentar", 0 `alert`; también con 404 sin cuerpo | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R4 | `R4: treats a draft launch as not found` — 200 con `draftActivityDto` → texto de no encontrado; la página no contiene "Prueba de Sistemas" ni "Vega" | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R5 | `R5: shows the network error and reloads on retry` (1.ª `fetch` rechaza `TypeError`, 2.ª 200) y `it.each` `R5: shows "%s" for %s` (500 `Failed to retrieve activity` → texto de servidor; 200 `{ "id": 1 }` → respuesta inesperada), todos con "Reintentar" | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R7 | `it.each` `R7: shows "%s" and no booking option for %s` — `activity-4/5/6/9` con fecha fijada: texto del motivo, sin `getByLabelText('Número de plazas')` ni botón "Reservar"; `R7: shows no notice for a bookable launch` (`activity-1`) | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R1 | `R1: loads a new launch when the id changes` — navegar de `activity-1` a `activity-2` (enlace en el árbol de prueba) → 2.ª petición y `h1` "Órbita Marciana" | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R8 | `R8: shows the reason on a non bookable card` (`bookability: { bookable: false, reason: 'sold-out' }` → "Agotado: no quedan plazas") y `R8: shows no reason on a bookable card` | componente | `tests/unit/features/launches/LaunchCard.test.tsx` |
| R8 | `R8: shows the bookability reason on the cards using the current date` — fecha fijada, 9 DTO de la semilla → "Ventana Perdida" con "La fecha de este lanzamiento ya ha pasado", "Estación Orbital" con "Agotado: no quedan plazas", "Misión Luna"/"Órbita Marciana"/"Vuelo Suborbital"/"Paseo Lunar Express" sin `.bookability-notice` | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R1 | `R1: renders the launch detail at /lanzamientos/:id` — `mockFetch` con `activity-1` en ese test → `h1` "Misión Luna"; los tests R10 existentes (`/no-existe`, `/lanzamientos/no-existe/otra`) siguen en verde | componente | `tests/unit/App.test.tsx` |

Los tests existentes de `LaunchCard.test.tsx` se adaptan solo para pasar la nueva prop `bookability` (`{ bookable: true }`).

### End-to-end (Playwright, Chromium y Firefox, API interceptada)

Fichero `tests/e2e/launch-detail.spec.ts` (E16).

| Requisito | Test | Criterio |
|---|---|---|
| R1 | `R1: shows the loading status while the API is slow and then the detail` | Manejador del detalle que espera a que el test libere una promesa → `status` "Cargando lanzamiento…"; al liberar, `h1` "Misión Luna" y sin `status`; 1 petición completada a `/activities/activity-1`, ninguna con cabecera `Authorization`; sin sesión en `localStorage` |
| R1 | `R1: opens the detail from the launch list` | `/lanzamientos` → clic en el enlace "Misión Luna" → URL `/lanzamientos/activity-1` y `h1` "Misión Luna" |
| R2 | `R2: shows the details of activity-1` | Los 10 textos del criterio y enlace "Volver a los lanzamientos" (clic → `/lanzamientos`) |
| R2 | `R2: hides the rocket line for activity-8` | `h1` "Paseo Lunar Express", sin "Cohete:" |
| R3 | `R3: shows the not found screen for an unknown launch` | `/lanzamientos/activity-99` (404 `Activity not found`) y `/lanzamientos/xyz` → texto, enlace "Ver todos los lanzamientos" a `/lanzamientos`, 0 "Reintentar" |
| R4 | `R4: treats a draft opened by URL as not found` | `/lanzamientos/activity-7` (200 draft) → texto de no encontrado; `page.getByText('Prueba de Sistemas')` 0 |
| R5 | `R5: shows the network error and recovers on retry` | Patrón `apiDown` con `route.abort()` → texto de red y "Reintentar"; tras apagar `apiDown` y pulsar, `h1` "Misión Luna" |
| R5 | `R5: shows the server error` | 500 `Failed to retrieve activity` → "Se ha producido un error en el servidor. Inténtalo de nuevo más tarde." con "Reintentar" |
| R7 | `R7: explains why %s cannot be booked` (bucle sobre `activity-4/5/6/9`) | Texto del motivo; `getByLabel('Número de plazas')` y `getByRole('button', { name: 'Reservar' })` con 0 elementos |
| R7 | `R7: shows no notice for a bookable launch` | `activity-1` sin `.bookability-notice` ni ninguno de los 5 textos |
| R8 | `R8: shows the bookability reason on the list cards` | `/lanzamientos` con la semilla → 8 tarjetas; motivos de "Ventana Perdida" y "Estación Orbital"; "Misión Luna", "Órbita Marciana", "Vuelo Suborbital" y "Paseo Lunar Express" sin `.bookability-notice` |

Regresión: `tests/e2e/launches.spec.ts` y `app-shell.spec.ts` sin cambios (sus aserciones usan `toContainText` y `.launch-card__status`, que no cambian). `app-shell-edge.spec.ts` se ajusta según P1.

### Smoke contra la API real

La spec no lo pide. No se añade (ver P5).

## Tareas

- [x] **T1** — Recurso `getActivity` e `isNotFoundError` (E1, E6). · Requisitos: R1, R3, R5 · Ficheros: `tests/unit/api/activities.test.ts`, `tests/unit/api/errors.test.ts`, `src/api/activities.ts`, `src/api/errors.ts`, `src/domain/api-errors.ts` (constante `LAUNCH_NOT_FOUND_TEXT`).
  - Primero los tests en rojo; después la función, el guardián y la constante.
  - Verificación: `npm test -- tests/unit/api`; `npm run typecheck`.

- [x] **T2** — Regla de reservabilidad y textos (E2, E3). · Requisitos: R6, R7 · Ficheros: `tests/unit/domain/launch.test.ts`, `src/domain/launch.ts`.
  - Primero las tablas `it.each` con los datos de la semilla (vía `launchFromDto`) y los límites `now` / `now + 1 ms`; después las funciones.
  - Verificación: `npm test -- tests/unit/domain/launch.test.ts`.

- [x] **T3** — `formatTotalSeats` en `format.ts` y `BookabilityNotice` (E10, E11 parte). · Requisitos: R2, R7 · Ficheros: `tests/unit/domain/format.test.ts`, `src/domain/format.ts`, `tests/unit/features/launches/BookabilityNotice.test.tsx`, `src/features/launches/BookabilityNotice.tsx`, `src/features/launches/LaunchCard.tsx` (usa `formatTotalSeats`; sin cambio visible).
  - Verificación: `npm test -- tests/unit/domain/format.test.ts tests/unit/features/launches`.

- [x] **T4** — Motivo en las tarjetas del listado (E4, E11). · Requisitos: R8 · Ficheros: `src/hooks/use-now.ts`, `tests/unit/features/launches/LaunchCard.test.tsx`, `tests/unit/features/launches/LaunchListPage.test.tsx`, `src/features/launches/LaunchCard.tsx`, `src/features/launches/LaunchListPage.tsx`.
  - Primero los tests R8 (tarjeta y página con `Date` fijado); adaptar los tests existentes de la tarjeta a la nueva prop.
  - Verificación: `npm test -- tests/unit/features/launches`; `npm run lint` (regla `purity` de `react-hooks`).

- [x] **T5** — Hook `useLaunch`, `LaunchNotFound`, `LaunchDetailPage` y ruta (E5, E7, E8, E9, E13, E14). · Requisitos: R1, R2, R3, R4, R5, R7 · Ficheros: `tests/unit/features/launches/LaunchDetailPage.test.tsx`, `tests/unit/App.test.tsx`, `src/features/launches/use-launch.ts`, `src/features/launches/LaunchNotFound.tsx`, `src/features/launches/LaunchDetailPage.tsx`, `src/App.tsx`.
  - Primero los tests de página (fetch simulado, `deferred`, `Date` fijado) en rojo; después el hook, los componentes y la ruta. Comprobar que `App.test.tsx` R10 sigue en verde.
  - Verificación: `npm test -- tests/unit/features tests/unit/App.test.tsx`; `npm run lint`.

- [x] **T6** — Estilos del detalle y del aviso (E17). · Requisitos: R2, R7, R8 (presentación) · Ficheros: `src/styles/global.css` (y `className` en los componentes).
  - Verificación visual opcional con `npm run dev`; la e2e de listado R10 (375 px) debe seguir en verde.

- [x] **T7** — Fixtures y mock del detalle para e2e (E12). · Requisitos: R1–R8 (soporte) · Ficheros: `tests/e2e/fixtures/data.ts`, `tests/e2e/fixtures/api-mock.ts`.
  - Verificación: `npm run typecheck`, `npm run lint`; `npx.cmd playwright test --project=chromium tests/e2e/launches.spec.ts tests/e2e/app-shell.spec.ts` sigue en verde con el nuevo manejador por defecto.

- [x] **T8** — Tests e2e del detalle y de R8 (E16) y ajuste de la regresión (P1). · Requisitos: R1, R2, R3, R4, R5, R7, R8 · Ficheros: `tests/e2e/launch-detail.spec.ts`, `tests/e2e/app-shell-edge.spec.ts`.
  - Verificación: `npx.cmd playwright test --project=chromium tests/e2e/launch-detail.spec.ts tests/e2e/app-shell-edge.spec.ts`.

- [x] **T9** — Verificación final. · Requisitos: R1–R8 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Ejecutar en orden: `npm run typecheck`, `npm run lint`, `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa: `launch-detail`, `launches`, `app-shell`, `app-shell-edge`).
  - **No** usar `npm run test:e2e -- --project=chromium` (el script ya fija los dos proyectos).
  - Firefox lo ejecuta **la persona** desde la carpeta del cliente con `npx.cmd playwright test --project=firefox`.
  - Comprobar: sin `console.log`, código comentado, `any` ni `as` sobre datos de red; ningún componente llama a `fetch`; no hay "Número de plazas" ni "Reservar" en `src/`; `git status` sin ficheros no previstos.

## Desviaciones durante la implementación (5-coder)

- **`useNow` sin alternativa:** el lint (`react-hooks` 7, regla `purity`) acepta `useState(() => new Date())`; no hizo falta calcular `now` en el loader (E4).
- **Semilla en los helpers unitarios:** `tests/unit/support/activities.ts` exporta `seedActivityDtos` (copia de la semilla, mismo orden) y `seedActivityDto(id)`, usados por `launch.test.ts`, `LaunchListPage.test.tsx` y `LaunchDetailPage.test.tsx` para no repetir los datos en cada fichero. No estaba en la lista de ficheros de T2/T4/T5.
- **`LaunchDetailPage`:** se divide en `LaunchDetailPage` (lee `useParams`; si `id` es `undefined` pinta `LaunchNotFound` sin petición), `LaunchDetailContent` (llama a `useLaunch` y `useNow`) y `LaunchDetail` (presentación), para no llamar a hooks de forma condicional. El detalle va dentro de `<article className="launch-detail">`.
- **Tests:** el R3 unitario es un `it.each` (404 con cuerpo `Activity not found` y 404 sin cuerpo); el R3 e2e se genera en bucle para `activity-99` y `xyz` (2 tests). El test unitario de `isNotFoundError` "true" también cubre el 404 sin mensaje.
- **Orden test primero:** en T1–T5 se comprobó el rojo antes del código. Los e2e de T8 se escriben, según el orden del plan, después de la implementación (T5), así que no pasaron por rojo.
- **CSS:** en el detalle, `.launch-detail p { margin: 0 }` tiene más especificidad que `.bookability-notice` y anula su margen vertical (el `gap` del contenedor da la separación). Sin efecto funcional.
- **Recuento:** unit 215 → 272; e2e Chromium 17 → 32 (15 nuevos en `launch-detail.spec.ts`). Firefox queda pendiente de la persona.

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] `npm run build` en verde
- [x] Tests e2e de la spec en verde en Chromium (agente) y Firefox (persona), con la regresión completa: 32/32 en ambos
- [x] CHANGELOG actualizado

## Puntos a decidir

> **Aprobado:** la persona ha validado el plan con las recomendaciones P1–P7 tal como las aplica el plan.

| # | Tema | Ambigüedad | Recomendación |
|---|---|---|---|
| P1 | Regresión de `app-shell-edge.spec.ts` (scaffolding R10) | El e2e abre `/lanzamientos/no-existe` y espera "Página no encontrada". Con la nueva ruta `lanzamientos/:id`, esa URL pide `GET /activities/no-existe` → 404 → pantalla "Este lanzamiento no existe o ya no está disponible." (R3). El test fallaría. | Cambiar la URL del e2e a `/lanzamientos/no-existe/otra` (sigue siendo una ruta desconocida anidada y coincide con el test unitario de `App.test.tsx`). El caso `/lanzamientos/no-existe` queda cubierto por R3 de esta spec. |
| P2 | Encabezado de la pantalla de no encontrado (y de carga/error) | La spec fija el texto y el enlace de R3, pero no dice si hay `h1`. Sin `h1` la página queda sin encabezado principal. | `LaunchNotFound` con `<h1>Lanzamiento no encontrado</h1>` (mismo patrón que `NotFoundPage`, "Página no encontrada"). En carga y en error (R5) no se añade `h1` (el contenido aún no existe; el `Layout` ya da la navegación). Alternativa: sin `h1` en ningún caso, solo el texto de la spec. |
| P3 | Enlace "Volver a los lanzamientos" en carga/error | R2 lo pide en el detalle; en R5 solo se exige el mensaje con "Reintentar". | Mostrarlo solo en el detalle (R2), como dice la spec; en error la navegación del `Layout` ya lleva al listado. |
| P4 | Motivo y estado en la misma tarjeta | En `sold-out`, `done` y `cancelled` la tarjeta mostrará el estado ("Agotado") y el motivo ("Agotado: no quedan plazas"), algo redundante. La spec pide ambos (R2 de `feat-launch-list` y R8). | Mantener ambos, en elementos distintos (`.launch-card__status` y `.bookability-notice`), para no romper los tests del listado. Pulir la presentación con `7-cleaner` o una spec posterior si se quiere. |
| P5 | Smoke contra la API real | La spec no lo pide; el ADD §9 define un único smoke de recorrido completo que depende de specs aún no hechas. | No añadirlo. Si la persona lo quiere: `tests/e2e/smoke/launch-detail.smoke.spec.ts` que abra `/lanzamientos/activity-1` y `/lanzamientos/activity-7` con el fork arrancado. |
| P6 | Fecha fijada en los e2e existentes del listado | `launches.spec.ts` no fija el reloj; con esta spec las tarjetas mostrarán motivos según la fecha real (p. ej. cuando pase marzo de 2027, "Misión Luna" mostrará "La fecha…"). Sus aserciones actuales no dependen de ello. | No tocar `launches.spec.ts`; los e2e nuevos fijan el reloj (E16). Si en el futuro algún test del listado comprueba ausencia de motivo, que fije `page.clock`. |
| P7 | `published`/`confirmed` con `minParticipants` > plazas u otras incoherencias de datos | La API no valida coherencia; la spec no lo trata. | No tratarlo: solo cuentan estado y fecha (R6, ADD §6). |
