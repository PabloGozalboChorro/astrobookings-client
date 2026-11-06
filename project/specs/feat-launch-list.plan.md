# Plan: feat-launch-list

- **Spec:** [feat-launch-list.spec.md](feat-launch-list.spec.md)
- **Rama:** `feat/launch-list`

## Revisión de la spec

La spec encaja con el PRD (F5, D1, D2, D3, D7, D8) y con el ADD (§3 estructura, §4.1 endpoint 3, §4.2 `activityDtoSchema` y modelo `Launch`, §5.1 ruta `/lanzamientos`, §6 mapeo y formatos, §8 semilla, §9 estrategia de pruebas, ADR-007 y ADR-012). Se reutiliza lo que ya hay en `main`: `http()` (`src/api/http.ts`), `toUserMessage` (`src/domain/api-errors.ts`, ya traduce `Failed to retrieve activities`, red caída y `ContractError` con los textos de R9), `useAsyncData` (`src/hooks/use-async-data.ts`), `LoadingIndicator`, `ErrorMessage`, `EmptyState` y los helpers `tests/unit/support/{http,deferred}.ts`.

Comprobaciones hechas:
- Los textos esperados de R2, R5 y R6 se han verificado con el `Intl` del entorno (Node, `timeZone: 'UTC'`): `249999` → `249.999,00 €`, `2500` → `2500,00 €`, `2027-03-15T14:30:00.000Z` → `lunes, 15 de marzo de 2027, 14:30`, `2027-06-01T09:00:00.000Z` → `martes, 1 de junio de 2027, 9:00`. El separador antes de `€` es un espacio no separable (U+00A0).
- Los 9 lanzamientos de `activity-bookings-express/db/seed/activities.json` coinciden con ADD §8 (estados, fechas pasadas en `activity-6` y `activity-9`, `activity-8` sin cohete, `activity-7` en `draft`). `activity-1` dura 4320 min → "3 días".
- `tests/setup.ts` ya fija `process.env.TZ = 'UTC'`.

Huecos y contradicciones encontrados: ver [Puntos a decidir](#puntos-a-decidir). El plan aplica la opción **recomendada**; si la persona elige otra, se ajusta antes de la tarea afectada.

No se añade ninguna dependencia: React, React Router, Zod, `Intl` del navegador, Vitest/Testing Library y Playwright ya están instalados.

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| E1 | `src/api/schemas.ts` añade `activityStatusSchema` y `activityDtoSchema` **exactamente** como el ADD §4.2 (incluido `isoDateString` con `Date.parse`, `updatedAt` opcional, no `strict`) y el tipo `ActivityDto = z.infer<…>`. | ADD §4.2/§4.3. Campos extra de la API se ignoran. |
| E2 | `src/api/activities.ts` exporta `getActivities(signal?: AbortSignal): Promise<ActivityDto[]>` → `http('/activities', z.array(activityDtoSchema), { signal })`. Sin parámetros de consulta en esta spec (los añade `feat-launch-search-sort`). Sin `auth`. | Alcance de la spec ("`getActivities()` sin parámetros"); la `signal` es necesaria para la cancelación de `useAsyncData`. |
| E3 | `src/domain/launch.ts`: tipos `LaunchStatus` y `Launch` del ADD §4.2 (`id`, `slug`, `fullName`, `mission`, `rocket`, `location`, `date: Date`, `durationMinutes`, `pricePerSeat`, `totalSeats`, `minParticipants`, `status`); funciones puras `parseLaunchName(name): { rocket: string \| null; mission: string }`, `toLaunch(dto): Launch`, `isVisible(launch): boolean` y `launchStatusLabel(status): string`. `getBookability` **no** se implementa (es de `feat-launch-detail`). | ADD §3 y §6; un único módulo de mapeo. |
| E4 | `parseLaunchName`: `indexOf(' · ')` (U+00B7 entre espacios); si no aparece → `{ rocket: null, mission: name }`; si aparece, `rocket = izquierda.trim()`, `mission = derecha.trim()`; si alguna queda vacía → `{ rocket: null, mission: name }` (el nombre **recibido**, sin recortar, como pide R4: `parseLaunchName("Falcon 9 · ")` → misión `"Falcon 9 · "`). En la UI el título se muestra tal cual; el criterio e2e de R4 ("Falcon 9 ·") se comprueba con `toHaveText`, que normaliza espacios. | R3, R4; ADD §6. |
| E5 | `toLaunch`: `date` → `Date`. Si el texto es solo fecha (`/^\d{4}-\d{2}-\d{2}$/`, p. ej. `"2027-10-26"`), se construye con `new Date(año, mes - 1, día)` (medianoche **local**), porque `new Date("2027-10-26")` es medianoche UTC y en Madrid se vería "2:00". Ver P2. | Caso límite de la spec ("hora 0:00 de la zona del navegador"). |
| E6 | `launchStatusLabel`: `Record<LaunchStatus, string>` con los textos de la tabla de la spec y `draft` → "Borrador" (nunca se muestra porque se filtra). Ver P4. | Tabla "Textos del estado"; tipo exhaustivo sin `default`. |
| E7 | `src/domain/format.ts`: `formatPrice(amount)` con `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })` (dos decimales por defecto para EUR); `formatDateTime(date)` con `Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short' })` **sin** `timeZone` (zona del navegador); `formatDuration(minutes)` con la regla de R6. El formateador de fecha se crea en cada llamada (barato con 8 tarjetas) para respetar siempre la zona vigente; el de precio, una vez a nivel de módulo. `formatDate` (solo fecha) no se crea: no lo pide esta spec. | ADD §6, R5, R6. |
| E8 | `formatDuration(m)`: `m < 60` → `"${m} min"`; `m < 1440` → `"${h} h"` + (`" ${min} min"` si `min > 0`); `m ≥ 1440` → `"${d} día"`/`"${d} días"` + (`" ${h} h"` si `h > 0`), descartando los minutos sobrantes. Se asume `m` entero ≥ 0 (la API no valida; ver P5). | R6: 11 → "11 min", 90 → "1 h 30 min", 180 → "3 h", 1440 → "1 día", 1501 → "1 día 1 h", 2880 → "2 días", 259200 → "180 días". |
| E9 | `src/features/launches/use-launches.ts`: `useLaunches()` = `useAsyncData` con un loader memoizado (`useCallback` sin dependencias, o función de módulo estable) que llama a `getActivities(signal)` y devuelve `dtos.map(toLaunch).filter(isVisible)` conservando el orden de la API. Devuelve `{ state, reload }`. | ADD §3 (`use-launches.ts` "filtra draft"), ADR-012; restricción de `useAsyncData` (loader estable). |
| E10 | `LaunchListPage.tsx`: siempre muestra `<h1>Lanzamientos</h1>` (mantiene en verde `App.test.tsx` R4 y los e2e de `app-shell`); debajo, según el estado: `loading` → `<LoadingIndicator label="Cargando lanzamientos…" />`; `error` → `<ErrorMessage message={toUserMessage(error)} onRetry={reload} />`; `ready` con 0 elementos → `<EmptyState message="No hay lanzamientos disponibles en este momento." />`; si no, `<ul className="launch-list">` con un `<li>` por lanzamiento con `<LaunchCard launch={…} />`, `key={launch.id}`. | R1, R7, R8, R9; coding-react (tres estados + vacío explícitos). |
| E11 | `LaunchCard.tsx` (presentacional, sin llamadas a la API): `<article aria-labelledby={titleId}>` con `<h2 id={titleId}><Link to={`/lanzamientos/${encodeURIComponent(id)}`}>{mission}</Link></h2>`; si `rocket !== null`, `<p>Cohete: {rocket}</p>`; lugar; `<time dateTime={date.toISOString()}>{formatDateTime(date)}</time>`; duración; `"{formatPrice(pricePerSeat)} por plaza"`; `"{totalSeats} plazas en total"` (ver P3 para 1 plaza); texto del estado. `titleId` con `useId()`. | R2, R4; localizadores accesibles (`getByRole('article', { name: 'Misión Luna' })`). |
| E12 | `src/App.tsx`: la ruta `lanzamientos` pasa de `<h1>Lanzamientos</h1>` a `<LaunchListPage />`. La ruta `/lanzamientos/:id` **no** se crea (es de `feat-launch-detail`): hoy el enlace lleva a la página de no encontrado. Ver P6. | Alcance de la spec. |
| E13 | Estilos en `src/styles/global.css` (CSS plano, sin librería): `.launch-list` como rejilla `display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr)); gap; list-style: none; padding: 0`; `.launch-card` con borde y `overflow-wrap: anywhere` para nombres y lugares largos. Nada con ancho fijo > 343 px (375 − 2 × 16). | R10. |
| E14 | Fixtures e2e: `tests/e2e/fixtures/data.ts` exporta `launchDtos` (los 9 objetos copiados **literalmente** de `db/seed/activities.json`, mismo orden), `visibleLaunchDtos` (sin `activity-7`), `draftLaunchDto` y `errorResponses.failedToRetrieveActivities = { message: 'Failed to retrieve activities', errors: [] }` (cuerpo real del 500 del fork). `tests/e2e/fixtures/api-mock.ts` exporta `API_URL = 'http://localhost:3999'` y `mockActivities(page, handler?)`, que registra `page.route('http://localhost:3999/activities**', …)`, por defecto responde 200 con `launchDtos`, permite sobrescribir la respuesta (lista, estado + cuerpo, `abort`, retraso controlado) y registra las URL recibidas para poder comprobar la petición. | ADR-007, ADD §8, R8 de riesgos. |
| E15 | E2E con zona horaria fija: `tests/e2e/launches.spec.ts` usa `test.use({ timezoneId: 'UTC', locale: 'es-ES' })` para que `activity-1` muestre "lunes, 15 de marzo de 2027, 14:30" en Chromium y Firefox con independencia de la zona del equipo. | R2 (texto literal en UTC); la app usa la zona del navegador (R5). |
| E16 | Recuento de peticiones en e2e (R1): `main.tsx` usa `<StrictMode>` y el servidor de e2e es `vite` en modo desarrollo, así que el efecto se monta dos veces y la primera petición se cancela. El test cuenta las peticiones **completadas** a `/activities` (`page.on('requestfinished')`) y comprueba que **todas** las peticiones enviadas tienen `search === ''`. El test unitario de la página (sin `StrictMode`) sí comprueba `fetch` llamado exactamente 1 vez con `http://localhost:3999/activities`. Ver P1. | R1 sin quitar `StrictMode` ni falsear el criterio. |
| E17 | Tests unitarios de página: se simula `fetch` con `vi.spyOn(globalThis, 'fetch')` y los helpers existentes (`jsonResponse`, `deferred`) — no se mockea el módulo `src/api/*` — para cubrir de paso `getActivities` + `http()` + esquema. Render con `MemoryRouter`. DTO de prueba en `tests/unit/support/activities.ts` (`activityDto(overrides)`, basado en `activity-1`). | ADD §9; reutiliza helpers; un solo DTO base. |
| E18 | Se borran `src/features/launches/.gitkeep` y `tests/e2e/fixtures/.gitkeep` al crear ficheros reales en esas carpetas. | Limpieza del scaffolding (como en planes anteriores). |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación. Nombres de test en inglés con el `Rn` delante. Los textos con `€` se comparan normalizando U+00A0 a espacio (`text.replace(/ /g, ' ')`) o, en e2e, con `toHaveText`/`toContainText`, que ya normalizan espacios en blanco.

### Unitarios y de componentes (Vitest, `TZ=UTC`)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R1 | `R1: getActivities requests GET /activities without query and parses the list` — `mockFetch(jsonResponse(200, [activity-1, activity-7]))` → URL `http://localhost:3999/activities`, método `GET`, sin `Authorization`; devuelve 2 DTO | unit | `tests/unit/api/activities.test.ts` |
| R1 | `R1: getActivities forwards the abort signal` | unit | `tests/unit/api/activities.test.ts` |
| R9 | `R9: getActivities throws ContractError for [{ "id": 1 }]` | unit | `tests/unit/api/activities.test.ts` |
| R1 | `R1: activityDtoSchema accepts a date without time and rejects an invalid date` (`"2027-10-26"` ok, `"mañana"` falla) | unit | `tests/unit/api/activities.test.ts` |
| R3 | `it.each` `R3: splits "%s" into rocket and mission` — "Starship · Órbita Marciana" → Starship / Órbita Marciana; "Falcon 9 · Misión · Luna" → Falcon 9 / Misión · Luna; "  Soyuz  ·  Estación Orbital " (espacios extra) → recortados | unit | `tests/unit/domain/launch.test.ts` |
| R4 | `it.each` `R4: keeps the full name as mission when "%s" cannot be split` — "Paseo Lunar Express", "Falcon 9 · " (misión vacía), " · Misión Luna" (cohete vacío), "Falcon 9·Luna" (sin espacios) → `rocket: null`, `mission` igual al nombre recibido | unit | `tests/unit/domain/launch.test.ts` |
| R2 | `R2: toLaunch maps the DTO fields to the domain model` (activity-1 → `fullName`, `rocket`, `mission`, `pricePerSeat: 249999`, `totalSeats: 6`, `durationMinutes: 4320`, `date` = `Date` de la ISO) | unit | `tests/unit/domain/launch.test.ts` |
| R5 | `R5: toLaunch reads a date without time as local midnight` — con `process.env.TZ` cambiado temporalmente a `America/New_York` (restaurado a `UTC` en `finally`): `getHours() === 0`, `getDate() === 26` | unit | `tests/unit/domain/launch.test.ts` |
| R1 | `it.each` `R1: isVisible is %s for status %s` — `draft` false; los otros cinco true | unit | `tests/unit/domain/launch.test.ts` |
| R2 | `it.each` `R2: labels status %s as "%s"` — tabla de la spec | unit | `tests/unit/domain/launch.test.ts` |
| R5 | `it.each` `R5: formats price %d as "%s"` — 249999 → "249.999,00 €", 12500 → "12.500,00 €", 1249999 → "1.249.999,00 €", 2500 → "2500,00 €", 99.5 → "99,50 €" | unit | `tests/unit/domain/format.test.ts` |
| R5 | `it.each` `R5: formats %s as "%s"` — `2027-03-15T14:30:00.000Z` → "lunes, 15 de marzo de 2027, 14:30"; `2027-06-01T09:00:00.000Z` → "martes, 1 de junio de 2027, 9:00" | unit | `tests/unit/domain/format.test.ts` |
| R6 | `it.each` `R6: formats %i minutes as "%s"` — 11, 90, 180, 1440, 1501, 2880, 259200 (criterio) + 0 → "0 min", 59 → "59 min", 60 → "1 h", 1439 → "23 h 59 min", 4320 → "3 días" | unit | `tests/unit/domain/format.test.ts` |
| R2 | `R2: shows every launch field` — `LaunchCard` con activity-1: `getByRole('article', { name: 'Misión Luna' })`, enlace "Misión Luna" con `href="/lanzamientos/activity-1"`, "Cohete: Falcon 9", "Cabo Cañaveral, Florida (EE. UU.)", "lunes, 15 de marzo de 2027, 14:30", "3 días", "249.999,00 € por plaza", "6 plazas en total", "Abierto a reservas" | componente | `tests/unit/features/launches/LaunchCard.test.tsx` |
| R4 | `R4: hides the rocket line when the name has no separator` — activity-8 → título "Paseo Lunar Express", sin "Cohete:" | componente | `tests/unit/features/launches/LaunchCard.test.tsx` |
| R1 | `R1: requests the launches once and shows one card per visible launch in API order` — 9 DTO → `fetch` llamado 1 vez con `http://localhost:3999/activities`; 8 `article` en el orden recibido; ninguno "Prueba de Sistemas" | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R7 | `R7: shows the loading status until the launches arrive` — `fetch` con `deferred` → `getByRole('status')` "Cargando lanzamientos…"; al resolver, sin `status` y con tarjetas | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R8 | `it.each` `R8: shows the empty message when the API returns %s` — `[]` y `[activity-7]` → "No hay lanzamientos disponibles en este momento.", 0 `article` | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R9 | `R9: shows the network error and reloads on retry` — 1.ª llamada `fetch` rechaza `TypeError('Failed to fetch')`, 2.ª 200 con 9 DTO → `alert` con el texto de red y "Reintentar"; tras el clic, 8 tarjetas y `fetch` llamado 2 veces | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R9 | `it.each` `R9: shows "%s" for %s` — 500 `Failed to retrieve activities` → "Se ha producido un error en el servidor. Inténtalo de nuevo más tarde."; 200 `[{ "id": 1 }]` → "El servidor ha devuelto una respuesta inesperada." | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R1 | `App.test.tsx` R4 existente (`renders the launches heading at /lanzamientos`) sigue en verde: se le añade `mockFetch(jsonResponse(200, []))` para no salir a la red | componente | `tests/unit/App.test.tsx` |

### End-to-end (Playwright, Chromium y Firefox, API interceptada)

Fichero `tests/e2e/launches.spec.ts`, con `test.use({ timezoneId: 'UTC', locale: 'es-ES' })` y `mockActivities` de `tests/e2e/fixtures/api-mock.ts`.

| Requisito | Test | Criterio |
|---|---|---|
| R1 | `R1: lists the visible launches in API order without drafts` | 9 DTO de la semilla → 8 `article` cuyos títulos coinciden en orden con `visibleLaunchDtos`; ninguno contiene "Prueba de Sistemas"; todas las peticiones a `/activities` sin query y 1 completada (E16); sin sesión (no hay `localStorage`) |
| R2 | `R2: shows the details of activity-1` | Tarjeta "Misión Luna" con enlace a `/lanzamientos/activity-1` y los 8 textos del criterio |
| R4 | `R4: shows the full name and no rocket line when the name cannot be split` | Semilla + DTO extra `name: "Falcon 9 · "` (id `activity-10`) → tarjeta de `activity-8` "Paseo Lunar Express" sin "Cohete:"; la extra con título "Falcon 9 ·" sin "Cohete:" |
| R5 | `R5: formats prices and dates in es-ES` | Tarjetas de `activity-3` ("12.500,00 € por plaza") y `activity-2` ("1.249.999,00 € por plaza", "martes, 1 de junio de 2027, 9:00") |
| R6 | `R6: formats durations` | `activity-3` "11 min", `activity-6` "3 h", `activity-5` "1 día", `activity-9` "2 días", `activity-2` "180 días" |
| R7 | `R7: shows the loading status while the API is slow` | La ruta espera a que el test libere una promesa → `getByRole('status')` "Cargando lanzamientos…"; al liberar, el indicador desaparece y hay 8 tarjetas (sin esperas fijas) |
| R8 | `R8: shows the empty message for an empty list` y `R8: … when only drafts are returned` | `[]` y `[activity-7]` → texto de vacío, 0 `article` |
| R9 | `R9: shows the network error and recovers on retry` | 1.ª petición `route.abort()`, siguientes 200 con la semilla → `alert` con el texto de red y "Reintentar"; clic → 8 tarjetas. Para que `StrictMode` no consuma el "primer fallo" con la petición cancelada, el mock falla **mientras** un indicador `apiDown` esté activo y el test lo apaga antes del clic |
| R9 | `R9: shows the server error` / `R9: shows the unexpected response error` | 500 `Failed to retrieve activities` y 200 `[{ "id": 1 }]` → textos de la spec |
| R10 | `R10: fits a 375 px wide window` | `page.setViewportSize({ width: 375, height: 812 })`; `document.documentElement.scrollWidth <= clientWidth`; cada una de las 8 tarjetas `scrollIntoViewIfNeeded()` + `toBeInViewport()` |

### Smoke contra la API real

La spec **no** lo pide (solo nombra los e2e interceptados). No se añade; ver P7.

## Tareas

- [x] **T1** — Esquema y recurso de lanzamientos (E1, E2). · Requisitos: R1, R9 · Ficheros: `tests/unit/support/activities.ts`, `tests/unit/api/activities.test.ts`, `src/api/schemas.ts`, `src/api/activities.ts`.
  - Primero el helper `activityDto(overrides)` y los tests de `activities.test.ts` en rojo; después el esquema y `getActivities`.
  - Verificación: `npm test -- tests/unit/api/activities.test.ts`; `npm run typecheck`.

- [x] **T2** — Dominio `launch.ts`: `parseLaunchName`, `toLaunch`, `isVisible`, `launchStatusLabel` (E3–E6). · Requisitos: R1 (`isVisible`), R2, R3, R4, R5 (fecha sin hora) · Ficheros: `tests/unit/domain/launch.test.ts`, `src/domain/launch.ts`.
  - Primero los tests con los nombres del criterio y los casos límite; después las funciones.
  - Verificación: `npm test -- tests/unit/domain/launch.test.ts`.

- [x] **T3** — Formatos `formatPrice`, `formatDateTime`, `formatDuration` (E7, E8). · Requisitos: R5, R6 · Ficheros: `tests/unit/domain/format.test.ts`, `src/domain/format.ts`.
  - Primero las tablas `it.each` con los textos exactos (normalizando U+00A0); después las funciones.
  - Verificación: `npm test -- tests/unit/domain/format.test.ts`.

- [x] **T4** — Componente `LaunchCard` (E11). · Requisitos: R2, R4 · Ficheros: `tests/unit/features/launches/LaunchCard.test.tsx`, `src/features/launches/LaunchCard.tsx`; borrar `src/features/launches/.gitkeep`.
  - Render dentro de `MemoryRouter` (usa `Link`).
  - Verificación: `npm test -- tests/unit/features/launches/LaunchCard.test.tsx`.

- [x] **T5** — Hook `useLaunches` y `LaunchListPage` con carga, error, vacío y listado; ruta en `App.tsx` (E9, E10, E12). · Requisitos: R1, R7, R8, R9 · Ficheros: `tests/unit/features/launches/LaunchListPage.test.tsx`, `tests/unit/App.test.tsx`, `src/features/launches/use-launches.ts`, `src/features/launches/LaunchListPage.tsx`, `src/App.tsx`.
  - Primero los tests de página (fetch simulado, `deferred` para R7) en rojo; después el hook, la página y el cambio de ruta. Ajustar `App.test.tsx` (mock de `fetch`) para que no salga a la red.
  - Verificación: `npm test -- tests/unit/features tests/unit/App.test.tsx`; `npm run lint` (sin avisos de `react-hooks`).

- [x] **T6** — Estilos responsive del listado (E13). · Requisitos: R10 · Ficheros: `src/styles/global.css` (y `className` en `LaunchListPage`/`LaunchCard`).
  - Verificación manual rápida con `npm run dev` a 375 px (opcional); la verificación real es el e2e de T8.

- [x] **T7** — Fixtures y mock de la API para e2e (E14). · Requisitos: R1–R10 (soporte) · Ficheros: `tests/e2e/fixtures/data.ts`, `tests/e2e/fixtures/api-mock.ts`; borrar `tests/e2e/fixtures/.gitkeep`.
  - Copiar los 9 objetos de `activity-bookings-express/db/seed/activities.json` sin modificar (mismo orden y campos).
  - Validar en el propio fichero de fixtures que los datos cumplen `activityDtoSchema` no es posible sin importar `src/` en e2e; se deja como comprobación en el test R1 (las 8 tarjetas se pintan ⇒ el esquema los acepta).
  - Verificación: `npm run typecheck` y `npm run lint` (los ficheros de `tests/e2e` están en el `tsconfig` de Node).

- [x] **T8** — Tests e2e del listado (E15, E16). · Requisitos: R1, R2, R4, R5, R6, R7, R8, R9, R10 · Ficheros: `tests/e2e/launches.spec.ts`.
  - Comprobar que la regresión de `app-shell.spec.ts` y `app-shell-edge.spec.ts` sigue en verde (ahora `/lanzamientos` pide la API no interceptada → muestra el error de red, pero el `h1` "Lanzamientos" se mantiene). Si se prefiere sin ruido, añadir `mockActivities(page)` en esos tests (ver P6).
  - Verificación: `npx.cmd playwright test --project=chromium tests/e2e/launches.spec.ts`.

- [x] **T9** — Verificación final. · Requisitos: R1–R10 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Ejecutar en orden: `npm run typecheck`, `npm run lint`, `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa: `launches` + regresión `app-shell`).
  - **No** usar `npm run test:e2e -- --project=chromium`: el script ya fija los dos proyectos.
  - Firefox lo ejecuta **la persona** desde la carpeta del cliente con `npx.cmd playwright test --project=firefox` (en el entorno del agente Firefox no arranca).
  - Comprobar que no quedan `console.log`, código comentado, `any` ni `as` sobre datos de red; que ningún componente llama a `fetch`; `git status` sin ficheros no previstos.

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] `npm run build` en verde
- [x] Tests e2e de la spec en verde en Chromium (agente) y Firefox (persona), con la regresión de `app-shell`: 17/17 en ambos
- [x] CHANGELOG actualizado

## Desviaciones durante la implementación

- **T5 (`App.test.tsx`):** en lugar de mockear `fetch` solo en el test R4, se añade un `beforeEach` que simula `fetch` (200 `[]`) para **todos** los tests de `App`, porque R9 y R10 también cargan `/lanzamientos` y saldrían a la red.
- **T7 (tipos de fixtures):** `ActivityDtoFixture` se declara en `tests/unit/support/activities.ts` y en `tests/e2e/fixtures/data.ts`, porque los e2e (tsconfig de Node) no pueden importar de `tests/unit` ni de `src/`. `data.ts` se ha generado a partir de la semilla del fork para que sea copia literal.
- **T7 (`mockActivities`):** responde también al preflight CORS (`OPTIONS` → 204) y añade cabeceras CORS, ya que la app (5174) y la API simulada (3999) son orígenes distintos y la petición lleva `Content-Type: application/json`. La firma es `mockActivities(page, handler?)`, con `handler(request, attempt)` que devuelve `{ status?, body }` o `'abort'` (puede ser asíncrono para el retraso de R7); devuelve `{ requestedUrls }`.
- **T8 (tipos DOM):** `tests/e2e/launches.spec.ts` empieza con `/// <reference lib="dom" />` porque el tsconfig de Node no incluye DOM y los callbacks de `page.evaluate` usan `document`/`window`. No se cambia ninguna configuración.
- **T8 (P6):** se añade `test.beforeEach(() => mockActivities(page))` en `app-shell.spec.ts` y `app-shell-edge.spec.ts`, según la decisión de la persona.
- **P3:** aplicado ("1 plaza en total" para 1 plaza), con test unitario en `LaunchCard.test.tsx`.
- **Verificación:** Firefox no se ha ejecutado en el entorno del agente (lo ejecuta la persona). No se ha comprobado contra la API real.

## Puntos a decidir

| # | Tema | Ambigüedad | Recomendación |
|---|---|---|---|
| P1 | "Una sola petición `GET /activities`" (R1) con `StrictMode` | `src/main.tsx` monta la app en `<StrictMode>` y el servidor de e2e es Vite en modo desarrollo: el efecto de `useAsyncData` se ejecuta dos veces y el navegador envía una primera petición que se cancela al instante. Un contador ingenuo en `page.route` puede ver 2. | Mantener `StrictMode`. En e2e, contar las peticiones **completadas** (`requestfinished`) = 1 y exigir que todas las enviadas no tengan query (E16). El "exactamente 1 llamada" se comprueba en el test unitario de la página, que no usa `StrictMode`. Alternativa descartada: quitar `StrictMode` o servir el build de producción en e2e (cambia la configuración del scaffolding). |
| P2 | Fecha sin hora (`"2027-10-26"`) | La spec dice que se muestra "con la hora 0:00 de la zona del navegador", pero `new Date("2027-10-26")` es medianoche **UTC** (en Madrid, "2:00"; en América, el día anterior). El ADD no lo trata. | Interpretarla como medianoche local en `toLaunch` (E5), con test que cambia `TZ` temporalmente. Alternativa: aceptar el comportamiento de `Date` y corregir la spec. |
| P3 | Singular de plazas | "6 plazas en total" no contempla `maxParticipants: 1` ("1 plazas en total"). La semilla no tiene ninguno con 1. | "1 plaza en total" para 1 y "N plazas en total" para el resto, con un test unitario de `LaunchCard`. Si se prefiere no salir de la spec, dejar el texto literal. |
| P4 | Texto de `draft` | La tabla de estados no incluye `draft` (no se muestra), pero el tipo `LaunchStatus` lo contiene y `launchStatusLabel` debe ser exhaustivo. | `draft` → "Borrador" (nunca visible en el listado; útil si otra spec lo necesitara). |
| P5 | Duraciones no enteras o negativas | La API no valida `duration`. R6 solo define enteros ≥ 0. | No tratarlas (la semilla solo tiene enteros positivos); `formatDuration` asume enteros ≥ 0. Si se quiere robustez, redondear con `Math.round` y tratar negativos como 0 (fuera de la spec). |
| P6 | Enlace del título y regresión de `app-shell` | El título enlaza a `/lanzamientos/<id>`, que hasta `feat-launch-detail` muestra "Página no encontrada". Además, los e2e de `app-shell` cargarán `/lanzamientos` sin interceptar la API y verán el error de red bajo el `h1`. | Aceptar el 404 temporal (la spec solo pide el enlace). Mantener `app-shell` sin cambios, ya que sus aserciones siguen siendo válidas; opcionalmente añadir `mockActivities(page)` para evitar el error de red en esos tests. |
| P7 | Smoke contra la API real | La spec no lo pide; el ADD §9 define un único smoke de recorrido completo (registro → reserva), que depende de specs aún no implementadas. | No añadir smoke en esta spec. Como mucho, si la persona lo quiere, un `tests/e2e/smoke/launches.smoke.spec.ts` que abra `/lanzamientos` con el fork arrancado y compruebe 8 tarjetas y que no aparece "Prueba de Sistemas". |
| P8 | Cambio futuro de R1 | `feat-launch-search-sort` cambiará la petición por defecto a `?_sort=date&_order=asc` y actualizará este test. | Ninguna acción ahora; el test R1 de e2e y el de `activities.test.ts` se escriben de forma que solo esa aserción cambie. |

**Decisión de la persona:** P1–P8 aprobados con la opción recomendada. Concreción en P6: **sí** se añade `mockActivities(page)` a los e2e de `app-shell.spec.ts` y `app-shell-edge.spec.ts` para que no dependan de un error de red; el enlace del título a `/lanzamientos/<id>` se acepta aunque lleve a "Página no encontrada" hasta `feat-launch-detail`.
