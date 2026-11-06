# Plan: feat-launch-search-sort

- **Spec:** [feat-launch-search-sort.spec.md](feat-launch-search-sort.spec.md)
- **Rama:** `feat/launch-search-sort`

## Revisión de la spec

La spec encaja con el PRD (F6, F7, D1, D3, V2; partes de F17 y F18) y con el ADD (§3 estructura: `LaunchFilters`, `LaunchListPage` con estado en la URL; §4.1 endpoint 3 `GET /activities?q=&_sort=&_order=` y tipo `ActivitiesQuery`; §5 `useSearchParams` como fuente de verdad de búsqueda y orden; ADR-006 y ADR-012: búsqueda y orden en la API, *debounce* 300 ms, cancelación, `draft` ocultados en el cliente; V2 "Nombre (cohete y misión)"). Se reutiliza lo que ya hay en `main`: `http()`, `useAsyncData(loader)` (aborta la carga anterior cuando cambia el `loader`), `toLaunch`, `isVisible`, `getBookability`/`useNow`, `LaunchCard`, `LoadingIndicator`, `ErrorMessage`, `EmptyState`, `toUserMessage`, los helpers unitarios `tests/unit/support/{activities,http,deferred}.ts` y los fixtures e2e `tests/e2e/fixtures/{data,api-mock,locators}.ts`.

### Comportamiento real de la API (fork `activity-bookings-express`, `master`)

| Aspecto | Comportamiento | Evidencia |
|---|---|---|
| Activación | Solo filtra/ordena si llega `q`, `slug` o `_sort`; si no, devuelve `getAll()` (orden de inserción del `Map`: semilla). `_order` solo se ignora. Como el cliente enviará siempre `_sort`, siempre se usa `query()`. | `src/routes/activities.ts:115-126` |
| `_order` | Por defecto `'asc'`; cualquier valor distinto de `'desc'` se trata como ascendente. | `src/routes/activities.ts:123`, `src/services/activity.service.ts:125` |
| `q` | Si `q.trim() !== ''`: `q.toLowerCase().trim()` y `includes` sobre `name`, `location` y `slug` en minúsculas. **No distingue mayúsculas, sí distingue tildes** ("orbita" no casa con el nombre "Órbita Marciana", pero sí con el *slug* `starship-orbita-marciana`; "Órbita" sí casa). Sin coincidencia parcial por palabras ni comodines. | `src/services/activity.service.ts:112-119` |
| `_sort` | Acepta cualquier campo. `date` (y `createdAt`/`updatedAt`) por `getTime()`; números por resta (`price`); cadenas con `localeCompare` (`name`); `null`/`undefined` al final; campo inexistente → todos iguales → orden original (el `sort` de JS es estable). | `src/services/activity.service.ts:123-157` |
| Parser de consulta | Express 4 con `qs` (`node_modules/express/package.json:56`): `+` se decodifica como espacio y `%C3%93` como "Ó", así que `URLSearchParams` es compatible. Un `q` repetido (`?q=a&q=b`) llegaría como array y daría 500; el cliente nunca lo envía. | `package.json:18` |
| Borradores | La respuesta incluye `draft` (también en búsquedas: `q=kourou` → `activity-5` y `activity-7`; `q=vega` → solo `activity-7`). | `src/services/activity.service.ts:104-119` |

Resultados reales con la semilla (visibles, sin `activity-7`): `q=falcon` → `activity-1`, `activity-9` ("Misión Luna", "Ventana Perdida", criterio R2); `_sort=date&_order=asc` → 6, 9, 3, 1, 4, 2, 5, 8; `_sort=name&_order=asc` → 5, 6, 1, 9, 3, 8, 4, 2 ("Ariane 6 · …" primero, "Paseo Lunar Express" entre "New Shepard" y "Soyuz", V2); `_sort=price&_order=desc` → 2, 8, 4, 9, 1, 5, 6, 3.

Las suposiciones de la spec coinciden con la API (búsqueda en nombre/lugar/identificador sin distinguir mayúsculas, `_sort` ∈ `name|date|price`, `_order` ∈ `asc|desc`, `draft` incluidos). Los criterios R2, R8 y R9 coinciden con lo que devolvería la API real para esos textos. La única matización (tildes) no contradice la spec: dice que el texto "se envía tal cual" y excluye la búsqueda en el cliente (ver P6).

### Impacto en lo existente

- `getActivities(signal?)` (`src/api/activities.ts:7`) pasa a `getActivities(query?: ActivitiesQuery, signal?)` como prevé ADD §3/§4.
- `useLaunches()` y `LaunchListPage` usan los parámetros de la URL.
- Tests que cambian (anticipado en `feat-launch-list.plan.md` P8): `tests/unit/features/launches/LaunchListPage.test.tsx` R1 (URL `…/activities` → `…/activities?_sort=date&_order=asc`), `tests/unit/api/activities.test.ts` R1 de la señal (la firma cambia) y `tests/e2e/launches.spec.ts` R1 (`url.search` y `finishedRequests`). Nada más del listado depende de los parámetros.
- El manejador por defecto de `mockActivities` devuelve la semilla **sin aplicar** los parámetros; así los e2e existentes que comprueban el "orden de la API" (`launches.spec.ts`, `launch-detail.spec.ts` R8) no cambian (ver E12).

No se añade ninguna dependencia (ni librería de *debounce*).

Huecos y contradicciones: ver [Puntos a decidir](#puntos-a-decidir). La persona ha delegado las decisiones de esta spec: el plan aplica la opción **recomendada** en todos los puntos.

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| E1 | `src/api/activities.ts`: `export type ActivitySort = 'name' \| 'date' \| 'price'`, `export type SortOrder = 'asc' \| 'desc'`, `export type ActivitiesQuery = { q?: string; sort?: ActivitySort; order?: SortOrder }` (ADD §4) y `getActivities(query: ActivitiesQuery = {}, signal?: AbortSignal)`. Construye la ruta con `URLSearchParams` en orden fijo `q`, `_sort`, `_order`, añadiendo solo los que tienen valor (`q` vacío no se envía); sin parámetros la ruta queda `/activities` (sin `?`). La función no recorta ni aplica valores por defecto: eso es de la página. | ADD §4 ("el cliente envía únicamente los parámetros con valor"); R2, R4; orden estable para las aserciones de URL. |
| E2 | `src/features/launches/launch-list-params.ts` (lógica pura, sin React): `LaunchSortParam = 'nombre' \| 'fecha' \| 'precio'`, `LaunchListParams = { query: string; sort: LaunchSortParam; order: SortOrder }`, `DEFAULT_LAUNCH_SORT = 'fecha'`, `DEFAULT_SORT_ORDER = 'asc'`, `parseLaunchListParams(searchParams): LaunchListParams` (`q` recortado o `''`; `orden`/`dir` no admitidos o ausentes → valor por defecto **por separado**), `toActivitiesQuery(params): ActivitiesQuery` (mapa `Record<LaunchSortParam, ActivitySort>`: `nombre→name`, `fecha→date`, `precio→price`; `q` solo si no está vacío; `_sort`/`_order` **siempre**) y los constructores de URL de E3. | R4, R5, R6, R7; probado sin DOM. |
| E3 | Escritura en la URL en orden canónico `q`, `orden`, `dir`: `withQuery(searchParams, text)` → `q` = texto recortado o se elimina si queda vacío; conserva `orden`/`dir` **solo si estaban y son válidos**. `withSort(searchParams, sort, order)` → conserva `q` y escribe **ambos** `orden` y `dir` con los valores efectivos. La serialización la hace `URLSearchParams` ("Órbita Marciana" → `q=%C3%93rbita+Marciana`). `/lanzamientos` sin tocar nada no gana parámetros (R5). | R2, R3, R4 ("contiene `q=falcon&orden=precio&dir=desc`"), R7 (un valor inválido desaparece en el primer cambio). |
| E4 | Navegación: todas las escrituras usan `setSearchParams(next, { replace: true })`. Cada búsqueda o cambio de orden **reemplaza** la entrada del historial; "Atrás" desde el detalle vuelve a `/lanzamientos?…` con el último estado, y "Atrás" desde el listado sale al sitio anterior en vez de recorrer cada término escrito. | R6 ("vuelve a ella con Atrás"); ver P1. |
| E5 | `useLaunches(query: ActivitiesQuery): AsyncData<Launch[]>`: loader memoizado con `useCallback(…, [q, sort, order])` (primitivos, no el objeto) que llama a `getActivities({ q, sort, order }, signal)` y aplica `toLaunch` + `filter(isVisible)` como hoy. Al cambiar cualquier parámetro cambia el loader → `useAsyncData` aborta la petición anterior y vuelve a "cargando"; `reload` repite la petición con los mismos parámetros. | R2, R4, R8, R10; `feat-error-handling` R11 (solo cuenta la última). |
| E6 | `LaunchListPage`: `const [searchParams, setSearchParams] = useSearchParams()`; `params = parseLaunchListParams(searchParams)`; `useLaunches(toActivitiesQuery(params))`. Pinta `<h1>`, **después** `<LaunchFilters …>` (siempre montado, también en carga y error, para no perder foco ni texto) y luego el contenido. La URL es la única fuente de verdad de la búsqueda aplicada y del orden (ADD §5, sin estado duplicado). | R1, R6, R10. |
| E7 | `LaunchFilters.tsx` (presentacional + *debounce*): props `query`, `sort`, `order`, `onQueryChange(text)`, `onSortChange(sort, order)`, `searchInputRef`. Contenedor `<div className="launch-filters" role="search">`; `<label>` + `<input type="search">` "Buscar lanzamientos" (rol `searchbox`); `<select>` "Ordenar por" con opciones `nombre` "Nombre (cohete y misión)", `fecha` "Fecha", `precio` "Precio"; `<select>` "Dirección" con `asc` "Ascendente", `desc` "Descendente" (rol `combobox`, etiquetas con `useId`). Los selectores son controlados por la URL y llaman a `onSortChange` inmediatamente (sin *debounce*). No es un `<form>` (Intro no envía nada). | R1, R4. |
| E8 | Texto del campo: estado local `inputText` (inicial = `query`) para escribir sin esperar a la URL. Sincronización URL → campo **durante el render** (patrón "ajustar estado al cambiar una prop", sin `setState` en efecto, que marca `react-hooks` 7): se guarda `syncedQuery`; si `query !== syncedQuery`, se actualiza `syncedQuery` y, si `query !== inputText.trim()`, `inputText = query`. Así "Atrás", "Borrar búsqueda" o una URL nueva actualizan el campo, pero un espacio final que la persona está escribiendo no se borra al aplicarse la búsqueda. | R3, R6, R9. |
| E9 | *Debounce*: constante exportada `SEARCH_DEBOUNCE_MS = 300`. `useEffect` en `LaunchFilters` con dependencias `[inputText, query]`: si `inputText.trim() !== query`, `setTimeout(() => onQueryChange(inputText), 300)` con `clearTimeout` en la limpieza; si son iguales, no programa nada. Cada pulsación reinicia el temporizador → una sola petición por pausa. Para que `onQueryChange` no reinicie el temporizador al cambiar de identidad, la página la memoiza con `useCallback` y usa la forma funcional `setSearchParams((current) => withQuery(current, text), { replace: true })`, que además no pisa un cambio de orden hecho mientras el temporizador estaba pendiente. | R2, R3; caso límite "escritura rápida". |
| E10 | Contenido según el estado: `loading` → `LoadingIndicator` "Cargando lanzamientos…" (sin cambios); `error` → `ErrorMessage` con `toUserMessage` y "Reintentar" = `reload` (filtros intactos porque están en la URL y fuera del contenido); `ready` vacío **con** `params.query !== ''` → `<p>No hay lanzamientos que coincidan con «{query}».</p>` + `<button type="button">Borrar búsqueda</button>` (componente `NoSearchResults.tsx` con props `query` y `onClear`); `ready` vacío **sin** búsqueda → `EmptyState` actual ("No hay lanzamientos disponibles en este momento."); `ready` con datos → lista en el orden recibido. El texto entre comillas es el `q` aplicado (recortado), no lo que haya en el campo en ese momento. | R8, R9, R10; mantiene `feat-launch-list` R8. |
| E11 | "Borrar búsqueda": `setSearchParams((current) => withQuery(current, ''), { replace: true })` (conserva el orden) y mueve el foco al campo de búsqueda (`searchInputRef.current?.focus()`), porque el botón desaparece. El campo se vacía por la sincronización de E8. | R9; ver P3. |
| E12 | Fixtures e2e: `tests/e2e/fixtures/activities-query.ts` (nuevo) con `queryLaunchDtos(dtos, url): ActivityDtoFixture[]`, copia **fiel** de `ActivityService.query` (activación `q \|\| slug \|\| _sort`; `q` con `toLowerCase().trim()` + `includes` en `name`/`location`/`slug`; orden `date` por `getTime`, números por resta, cadenas por `localeCompare`; `_order !== 'desc'` → asc), citando `activity.service.ts:98-160` y `activities.ts:115-126` en un comentario de cabecera. `api-mock.ts` exporta `apiLikeHandler` (listado → `queryLaunchDtos(launchDtos, url)`; detalle → igual que el manejador por defecto). El **manejador por defecto no cambia** (devuelve la semilla tal cual e ignora los parámetros). Los tests que comprueban un orden concreto pedido a la API (R8) usan respuestas fijas por petición. | ADR-007; e2e sin API arrancada; no rompe `launches.spec.ts` ni `launch-detail.spec.ts`. |
| E13 | Unit/componentes: `fetch` simulado (`mockFetch`, `vi.spyOn(globalThis, 'fetch')`, `deferred`), sin mockear `src/api/*`; render con `MemoryRouter initialEntries={['/lanzamientos?…']}` + `<Routes><Route path="/lanzamientos" …/></Routes>` y un componente auxiliar de prueba `LocationProbe` (muestra `location.search` en un `<output data-testid="location">`) para comprobar la URL. Páginas con temporizadores **reales** (300 ms < 1000 ms de `findBy*`). `LaunchFilters` aislado con `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`, `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, `act(() => vi.advanceTimersByTime(n))` y aserciones síncronas (`getBy*`, nunca `findBy*`/`waitFor` con temporizadores falsos); `vi.useRealTimers()` en `afterEach`. `TZ=UTC` ya lo fija `tests/setup.ts`. | ADD §9; tests deterministas. |
| E14 | E2E: fichero nuevo `tests/e2e/launch-search-sort.spec.ts` con `test.use({ timezoneId: 'UTC', locale: 'es-ES' })`. Con `StrictMode` en dev la primera carga se monta dos veces: las comprobaciones de "una sola petición" cuentan peticiones **completadas** (`page.on('requestfinished')`) al listado y, para el *debounce*, además que **ninguna** URL registrada en `mock.requestedUrls` lleva un `q` parcial (`f`, `fa`, …). Se escribe con `pressSequentially(text, { delay: 50 })` (pulsaciones < 300 ms) y se espera por la aparición de las tarjetas o de la URL (`expect(page).toHaveURL(…)`), sin esperas fijas. No se comprueban motivos de reservabilidad, así que no hace falta `page.clock`; si algún test los comprobase, `page.clock.setFixedTime(new Date('2026-11-05T10:00:00Z'))` como en `launch-detail.spec.ts`. | R1–R10; misma estrategia que `launches.spec.ts`. |
| E15 | Estilos mínimos en `src/styles/global.css`: `.launch-filters` (flex con `flex-wrap: wrap` y `gap`; cada control a ancho completo por debajo de ~480 px). Sin anchos fijos: la e2e de 375 px del listado (`feat-launch-list` R10, sin *scroll* horizontal) debe seguir en verde. | Coherencia visual; no es requisito verificable. |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación. Nombres de test en inglés con el `Rn` delante.

### Unitarios y de componentes (Vitest, `TZ=UTC`)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R2, R4 | `R2: getActivities sends q, _sort and _order in this order` — `{ q: 'falcon', sort: 'date', order: 'asc' }` → `http://localhost:3999/activities?q=falcon&_sort=date&_order=asc`, `GET`, sin `Authorization` | unit | `tests/unit/api/activities.test.ts` |
| R3 | `R3: getActivities omits empty q` — `{ q: '', sort: 'price', order: 'desc' }` → `…/activities?_sort=price&_order=desc`; el R1 existente (`getActivities()` → `…/activities`, sin `?`) se mantiene | unit | `tests/unit/api/activities.test.ts` |
| R2 | `R2: getActivities encodes the search text` — `'Órbita Marciana'` → `q=%C3%93rbita+Marciana`; `'a&b#c'` → `q=a%26b%23c` | unit | `tests/unit/api/activities.test.ts` |
| R10 | `R1: getActivities forwards the abort signal` (existente, adaptado a `getActivities({}, signal)`) | unit | `tests/unit/api/activities.test.ts` |
| R5, R7 | `it.each` `R5/R7: parseLaunchListParams(%s) is %o` — `''` → `{ query: '', sort: 'fecha', order: 'asc' }`; `orden=plazas&dir=arriba` → por defecto; `orden=precio&dir=arriba` → `precio`/`asc`; `orden=PRECIO` → `fecha` (sensible a mayúsculas); `orden=` → `fecha` | unit | `tests/unit/features/launches/launch-list-params.test.ts` |
| R6, R2, R3 | `R6: parseLaunchListParams reads q, orden and dir` (`q=kourou&orden=precio&dir=desc`); `R2: parseLaunchListParams trims q` (`q=%20falcon%20` → `falcon`); `R3: whitespace-only q is empty` | unit | `tests/unit/features/launches/launch-list-params.test.ts` |
| R4, R5 | `it.each` `R4: toActivitiesQuery maps %s to %s` — `nombre→name`, `fecha→date`, `precio→price`; `asc`/`desc` tal cual; `q` vacío → sin `q`; por defecto → `{ sort: 'date', order: 'asc' }` | unit | `tests/unit/features/launches/launch-list-params.test.ts` |
| R2, R3 | `R2: withQuery sets the trimmed text first and keeps a valid order` (`orden=precio&dir=desc` + `' falcon '` → `q=falcon&orden=precio&dir=desc`); `R3: withQuery removes q for an empty or blank text`; `R7: withQuery drops invalid orden/dir`; `R2: withQuery serialises Órbita Marciana as q=%C3%93rbita+Marciana` | unit | `tests/unit/features/launches/launch-list-params.test.ts` |
| R4 | `R4: withSort keeps q and writes orden and dir` (`q=falcon` + `precio`/`desc` → `q=falcon&orden=precio&dir=desc`); `R4: withSort writes both values even when one is the default` (`nombre`/`asc` → `orden=nombre&dir=asc`) | unit | `tests/unit/features/launches/launch-list-params.test.ts` |
| R1 | `R1: renders the search box and both selects with their options` — `searchbox` "Buscar lanzamientos"; `combobox` "Ordenar por" con opciones exactamente `["Nombre (cohete y misión)", "Fecha", "Precio"]`; `combobox` "Dirección" con `["Ascendente", "Descendente"]`; valores mostrados según props | componente | `tests/unit/features/launches/LaunchFilters.test.tsx` |
| R2 | `R2: calls onQueryChange once 300 ms after the last keystroke` — escribir "falcon" (temporizadores falsos) → a 299 ms desde la última tecla 0 llamadas; a 300 ms 1 llamada con `"falcon"` | componente | `tests/unit/features/launches/LaunchFilters.test.tsx` |
| R2 | `R2: restarts the delay on every keystroke` — "fal", +200 ms, "con", +200 ms → 0 llamadas; +100 ms → 1 llamada `"falcon"` | componente | `tests/unit/features/launches/LaunchFilters.test.tsx` |
| R2 | `R2: does not call onQueryChange when the trimmed text equals the applied query` — `query="falcon"`, escribir un espacio final → 0 llamadas tras 300 ms; el campo conserva `"falcon "` | componente | `tests/unit/features/launches/LaunchFilters.test.tsx` |
| R3 | `R3: reports an empty text when the field is cleared` — `query="falcon"`, `clear()` → `onQueryChange('')` tras 300 ms; con "   " → `onQueryChange('   ')` (la página recorta) | componente | `tests/unit/features/launches/LaunchFilters.test.tsx` |
| R4 | `R4: calls onSortChange immediately with the new sort and the current order` (y con la nueva dirección y el criterio actual), sin esperar 300 ms | componente | `tests/unit/features/launches/LaunchFilters.test.tsx` |
| R6, R9 | `R6: updates the field when the query prop changes` — *rerender* con `query="kourou"` → campo "kourou"; *rerender* con `query=""` → campo vacío | componente | `tests/unit/features/launches/LaunchFilters.test.tsx` |
| R5 | `R5: requests the default order when the URL has no parameters` — `/lanzamientos` → 1 `fetch` a `…/activities?_sort=date&_order=asc`; selectores "Fecha"/"Ascendente"; campo vacío; `location.search` `''` (sustituye a la aserción de URL del R1 existente) | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R6 | `R6: reads q, orden and dir from the URL` — `/lanzamientos?q=kourou&orden=precio&dir=desc` → campo "kourou", "Precio", "Descendente"; `fetch` a `…?q=kourou&_sort=price&_order=desc` (1 vez) | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R7 | `R7: falls back to the defaults for unsupported orden and dir` — `?orden=plazas&dir=arriba` → "Fecha"/"Ascendente" y `_sort=date&_order=asc` | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R2 | `R2: searches once after typing and puts the trimmed text in the URL` — escribir " falcon " → `location.search` `?q=falcon`; exactamente 2 `fetch` (inicial + `…?q=falcon&_sort=date&_order=asc`); tarjetas = respuesta simulada | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R2 | `R2: aborts the previous search and shows only the latest results` — 1.ª búsqueda con `deferred` pendiente, 2.ª búsqueda resuelta; la señal de la 1.ª está `aborted`; al resolver la 1.ª después, se siguen viendo los resultados de la 2.ª | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R3 | `R3: removes q and requests the list without it when the field is cleared` — desde `?q=falcon&orden=precio&dir=desc`, borrar → `location.search` `?orden=precio&dir=desc`, `fetch` a `…?_sort=price&_order=desc` | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R4 | `R4: changing sort and direction updates the URL and the request` — desde `?q=falcon`, elegir "Precio" y "Descendente" → `?q=falcon&orden=precio&dir=desc`, último `fetch` `…?q=falcon&_sort=price&_order=desc`; elegir "Nombre (cohete y misión)" → `_sort=name` | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R8 | `R8: shows the launches in the received order without drafts` — respuesta `[activity-3, activity-6, activity-1]` → títulos en ese orden; respuesta `[activity-5, activity-7]` → solo "Mirador Orbital" | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R9 | `it.each` `R9: shows the no matches message for %s` — `[]` y `[draft]` con `?q=zzz` → "No hay lanzamientos que coincidan con «zzz»." y botón "Borrar búsqueda"; no aparece el texto vacío genérico | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R9 | `R9: clearing the search empties the field, removes q and focuses the search box` — desde `?q=zzz&orden=precio&dir=desc` → pulsar → campo vacío y con foco, `location.search` `?orden=precio&dir=desc`, `fetch` sin `q`, se ven las tarjetas | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R9 | `R9: keeps the generic empty message when there is no search` (el R8 existente de `feat-launch-list` sigue en verde sin cambios) | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R10 | `R10: keeps the search and the order on error and retries the same request` — `?q=falcon&orden=precio`; 1.ª `fetch` rechaza `TypeError` → texto de red y "Reintentar", campo "falcon", "Precio"; 2.ª `fetch` 200 → misma URL `…?q=falcon&_sort=price&_order=asc` y tarjetas | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |
| R10 | `R10: keeps the filters mounted while loading` — con `deferred` pendiente, el `searchbox` y los `combobox` existen junto al `status` | componente | `tests/unit/features/launches/LaunchListPage.test.tsx` |

Los demás tests de `LaunchListPage.test.tsx` (R7–R10 y R8 de reservabilidad de specs anteriores) siguen en verde sin cambios; el `renderPage()` existente pasa a montar la ruta `/lanzamientos` con `initialEntries` opcional.

### End-to-end (Playwright, Chromium y Firefox, API interceptada)

Fichero `tests/e2e/launch-search-sort.spec.ts` (E14). Salvo indicación, `mockActivities(page, apiLikeHandler)` (E12).

| Requisito | Test | Criterio |
|---|---|---|
| R1 | `R1: shows the search box and the sort controls` | `searchbox` "Buscar lanzamientos"; `combobox` "Ordenar por" con `toHaveText`/opciones "Nombre (cohete y misión)", "Fecha", "Precio"; `combobox` "Dirección" con "Ascendente", "Descendente" |
| R5 | `R5: uses date ascending by default` | `/lanzamientos` → `toHaveValue('fecha')`/`('asc')`; peticiones completadas al listado = `[…/activities?_sort=date&_order=asc]`; tarjetas en el orden real por fecha (Amanecer Orbital, Ventana Perdida, Vuelo Suborbital, Misión Luna, Estación Orbital, Órbita Marciana, Mirador Orbital, Paseo Lunar Express) |
| R2 | `R2: searches once after the user stops typing` | `pressSequentially('falcon', { delay: 50 })` → URL con `q=falcon`; tarjetas "Misión Luna" y "Ventana Perdida" (2); ninguna URL registrada con `q` distinto de `falcon`; exactamente 1 petición completada con `q=falcon&_sort=date&_order=asc` |
| R2 | `R2: trims the search text` | `' falcon '` → `q=falcon` en la URL y en la petición |
| R3 | `R3: removes q when the search is cleared or blank` | `/lanzamientos?q=falcon` → `fill('')` → URL sin `q`, última petición `…?_sort=date&_order=asc`, 8 tarjetas; repetir con `fill('   ')` |
| R4 | `R4: sends the chosen sort and direction` | `/lanzamientos?q=falcon` → `selectOption` "Precio" y "Descendente" → URL contiene `q=falcon&orden=precio&dir=desc`; última petición `…?q=falcon&_sort=price&_order=desc`; después "Nombre (cohete y misión)" → `_sort=name` |
| R4 | `R4: sorting by name orders by rocket first` | `?orden=nombre` → primera tarjeta "Mirador Orbital" (Ariane 6), "Paseo Lunar Express" entre "Vuelo Suborbital" y "Estación Orbital" (V2; datos de `apiLikeHandler`) |
| R6 | `R6: restores the search and order from the URL, on reload and on back` | `goto('/lanzamientos?q=kourou&orden=precio&dir=desc')` → campo "kourou", "precio", "desc", petición `…?q=kourou&_sort=price&_order=desc`; `page.reload()` → igual; abrir "Mirador Orbital" → `goBack()` → igual |
| R7 | `R7: falls back to the defaults for unsupported values` | `?orden=plazas&dir=arriba` → "fecha"/"asc"; petición `_sort=date&_order=asc` |
| R8 | `R8: hides drafts in the search results` | Buscar "kourou" → solo la tarjeta "Mirador Orbital"; `getByText('Prueba de Sistemas')` 0 |
| R8 | `R8: keeps the order returned by the API` | Manejador fijo: si `_sort=price&_order=asc` → `[activity-3, activity-6, activity-1]` → títulos "Vuelo Suborbital", "Amanecer Orbital", "Misión Luna" |
| R9 | `R9: shows the no matches message and clears the search` | Buscar "zzz" → "No hay lanzamientos que coincidan con «zzz»."; pulsar "Borrar búsqueda" → campo vacío y enfocado, URL sin `q`, 8 tarjetas. Variante "vega" (solo borrador) → mismo mensaje con «vega» |
| R10 | `R10: keeps the search and order on network error and retries` | `/lanzamientos?orden=precio` → buscar "falcon" con manejador que hace `route.abort()` mientras `apiDown` → texto de red, "Reintentar", campo "falcon", "precio"; apagar `apiDown` y pulsar → petición `…?q=falcon&_sort=price&_order=asc` y tarjetas |
| R2 | `R2: encodes accented text in the URL` (caso límite) | Escribir "Órbita Marciana" → URL contiene `q=%C3%93rbita+Marciana`; tarjeta "Órbita Marciana" |

Regresión: `tests/e2e/launches.spec.ts` solo cambia la aserción de R1 (`url.search` → `?_sort=date&_order=asc` y `finishedRequests`); `launch-detail.spec.ts`, `app-shell.spec.ts` y `app-shell-edge.spec.ts` sin cambios. La e2e de 375 px del listado sigue sin *scroll* horizontal con los filtros.

### Smoke contra la API real

La spec no lo pide. No se añade (ver P7).

## Tareas

- [x] **T1** — Consulta en `getActivities` (E1). · Requisitos: R2, R3, R4, R10 · Ficheros: `tests/unit/api/activities.test.ts`, `src/api/activities.ts`.
  - Primero los tests en rojo (URL con parámetros, `q` vacío, codificación, señal con la nueva firma); después la función y los tipos.
  - Verificación: `npm test -- tests/unit/api/activities.test.ts`; `npm run typecheck` (fallará en `use-launches.ts` hasta T3; se puede adaptar ya la llamada a `getActivities({}, signal)`).

- [x] **T2** — Parámetros de URL del listado (E2, E3). · Requisitos: R2, R3, R4, R5, R6, R7 · Ficheros: `tests/unit/features/launches/launch-list-params.test.ts`, `src/features/launches/launch-list-params.ts`.
  - Primero las tablas `it.each` (parseo, mapeo, `withQuery`, `withSort`); después las funciones puras.
  - Verificación: `npm test -- tests/unit/features/launches/launch-list-params.test.ts`.

- [x] **T3** — Componente `LaunchFilters` con *debounce* (E7, E8, E9). · Requisitos: R1, R2, R3, R4, R6 · Ficheros: `tests/unit/features/launches/LaunchFilters.test.tsx`, `src/features/launches/LaunchFilters.tsx`.
  - Primero los tests con temporizadores falsos (E13); después el componente.
  - Verificación: `npm test -- tests/unit/features/launches/LaunchFilters.test.tsx`; `npm run lint` (reglas `react-hooks` 7: sin `setState` síncrono en efectos ni lectura de *refs* en render).

- [x] **T4** — Página conectada a la URL, `useLaunches(query)` y mensaje sin coincidencias (E4, E5, E6, E10, E11). · Requisitos: R2, R3, R4, R5, R6, R7, R8, R9, R10 · Ficheros: `tests/unit/features/launches/LaunchListPage.test.tsx`, `src/features/launches/use-launches.ts`, `src/features/launches/LaunchListPage.tsx`, `src/features/launches/NoSearchResults.tsx`.
  - Primero adaptar `renderPage` (ruta + `initialEntries` + `LocationProbe`) y cambiar la aserción de URL del R1 existente; escribir los tests R2–R10 en rojo; después el hook y la página.
  - Verificación: `npm test -- tests/unit/features tests/unit/App.test.tsx`; `npm run typecheck`; `npm run lint`.

- [x] **T5** — Estilos de los filtros (E15). · Requisitos: R1 (presentación) · Ficheros: `src/styles/global.css`.
  - Verificación visual opcional con `npm run dev`; la e2e de 375 px del listado debe seguir en verde.

- [x] **T6** — Mock de la API con búsqueda y orden fieles (E12). · Requisitos: R2–R9 (soporte) · Ficheros: `tests/e2e/fixtures/activities-query.ts`, `tests/e2e/fixtures/api-mock.ts`.
  - Verificación: `npm run typecheck`, `npm run lint`; `npx.cmd playwright test --project=chromium tests/e2e/launches.spec.ts tests/e2e/launch-detail.spec.ts` (el manejador por defecto no cambia).

- [x] **T7** — Tests e2e de la spec y regresión de `launches.spec.ts` R1 (E14). · Requisitos: R1–R10 · Ficheros: `tests/e2e/launch-search-sort.spec.ts`, `tests/e2e/launches.spec.ts`.
  - Verificación: `npx.cmd playwright test --project=chromium tests/e2e/launch-search-sort.spec.ts tests/e2e/launches.spec.ts`.

- [x] **T8** — Verificación final. · Requisitos: R1–R10 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Ejecutar en orden: `npm run typecheck`, `npm run lint`, `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa).
  - **No** usar `npm run test:e2e -- --project=chromium` (el script ya fija los dos proyectos).
  - Firefox lo ejecuta **la persona** desde la carpeta del cliente con `npx.cmd playwright test --project=firefox`.
  - Comprobar: sin `console.log`, código comentado, `any` ni `as` sobre datos de red; ningún componente llama a `fetch`; no hay búsqueda ni ordenación en el cliente (`sort(`/`filter(` sobre lanzamientos solo `isVisible`); sin dependencias nuevas en `package.json`; `git status` sin ficheros no previstos.

## Desviaciones durante la implementación

- **E13 / T3 (`LaunchFilters.test.tsx`):** con temporizadores falsos de Vitest, `userEvent` se queda colgado (el `asyncWrapper` de Testing Library drena con un `setTimeout` falso y solo avanza los temporizadores de Jest). Los tests del *debounce* usan `fireEvent.change` síncrono, un evento por pulsación, en lugar de `userEvent.setup({ advanceTimers })`. Se mantienen `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`, `act(() => vi.advanceTimersByTime(n))` y aserciones síncronas. Las pruebas de página siguen con `userEvent` y temporizadores reales.
- **E13 (`LocationProbe`):** muestra `location.search` en un `<span data-testid="location">` en vez de `<output>`, porque `<output>` tiene rol implícito `status` y chocaba con `getByRole('status')` de los tests de carga existentes.
- **E9:** el efecto del *debounce* depende de `[inputText, query, onQueryChange]` (la regla `exhaustive-deps` exige `onQueryChange`); la página la memoiza con `useCallback`, así que no reinicia el temporizador.
- **E2:** `isLaunchSortParam` e `isSortOrder` se exportan desde `launch-list-params.ts` para que `LaunchFilters` valide el valor de los `<select>` sin duplicar lógica.
- **Helpers de test:** `tests/unit/support/http.ts` gana `mockFetchByUrl` (respuesta nueva por petición según la URL) y `requestedUrls`; `mockFetch` reutiliza un único `Response` y no sirve para varias peticiones.
- **E2E R2/R4 (plan de pruebas):** con `apiLikeHandler` y orden por fecha ascendente, "falcon" devuelve "Ventana Perdida" antes que "Misión Luna" (`activity-9` es de 2026-10-01); los tests comprueban ese orden real. Con precio descendente y nombre descendente el orden es el mismo.
- **Tests adicionales** no listados en el plan: `withQuery` sin parámetros no añade nada (R5) y no modifica la entrada; `withSort` sustituye valores no admitidos (R7); el campo conserva un espacio final mientras se aplica la búsqueda (R2); `searchInputRef` apunta al campo (R9); el mensaje sin coincidencias cita el `q` aplicado y no lo que se está escribiendo (R9, P5); R3 con solo espacios en la página; R8 de borradores en la página.
- **Iteración 1 — defecto D1 del tester (R2):** `BrowserRouter` aplica el cambio de URL dentro de `startTransition`; si la persona tecleaba entre el disparo del *debounce* y el render de la nueva URL, llegaba `query="fal"` con el campo en `"falc"` y la sincronización durante el render sobrescribía el campo (se perdía la "c" y no se buscaba "falc"). Corrección en `LaunchFilters.tsx`: el temporizador guarda en estado (`pendingAppliedQuery`) el texto recortado que aplica; cuando cambia `query`, si coincide con ese valor el campo no se toca (solo se limpia el pendiente), y si no coincide se sincroniza como antes (recarga, Atrás/Adelante, "Borrar búsqueda"). Sin `ref.current` en el render (regla `refs`). Tests del tester: unitario `R2: keeps a keystroke typed before the applied search reaches the URL` y e2e `R2: keeps a keystroke typed while the applied search reaches the URL`, ambos en verde; `launch-search-sort.spec.ts` estable con `--repeat-each 10` (200/200).

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] `npm run build` en verde
- [x] Tests e2e de la spec en verde en Chromium (agente) y Firefox (persona), con la regresión completa: 52/52 en ambos
- [x] CHANGELOG actualizado

## Puntos a decidir

> **Decididos por delegación:** la persona ha delegado las decisiones de esta spec; el plan aplica la recomendación de cada punto. Ninguno cambia el producto de forma importante.
>
> **Aprobados:** P1–P9 quedan aprobados tal como los decide este plan, por delegación de la persona (fase 2 del orquestador `builder`).

| # | Tema | Ambigüedad | Decisión aplicada (recomendación) |
|---|---|---|---|
| P1 | Historial del navegador | La spec pide que el estado "sobreviva a Atrás", pero no dice si cada búsqueda o cambio de orden crea una entrada de historial. Con `push`, "Atrás" recorrería cada término escrito tras el *debounce*. | `replace: true` en todas las escrituras (E4). "Atrás" desde el detalle restaura el último estado (R6); "Atrás" desde el listado sale de él. Alternativa: `push` solo en los selectores y "Borrar búsqueda". |
| P2 | Presencia de `orden`/`dir` en la URL | R4 dice "actualizar `orden` y `dir`"; R5 dice que sin parámetros se usa el defecto. No está claro si una búsqueda sobre `/lanzamientos` debe escribir también `orden=fecha&dir=asc`. | Solo se escriben cuando la persona toca un selector, y entonces **ambos** (E3). Una búsqueda conserva lo que había (si es válido). Así `/lanzamientos` y `?q=falcon` quedan limpios y R4 se cumple literalmente. |
| P3 | Foco tras "Borrar búsqueda" | El botón desaparece al pulsarlo y el foco caería en `<body>`; la spec no lo menciona. | Mover el foco al campo de búsqueda (E11, WCAG 2.4.3). Coste mínimo y sin cambio visible. Alternativa: no gestionar el foco. |
| P4 | Mientras carga una búsqueda | La spec no dice si se mantienen las tarjetas anteriores. `useAsyncData` vuelve a "cargando" al cambiar el loader. | Mostrar "Cargando lanzamientos…" en lugar de la lista (comportamiento actual, sin estado extra), con los filtros siempre visibles (E6). |
| P5 | Texto del mensaje sin coincidencias | ¿Texto aplicado (URL) o lo que hay en el campo? Pueden diferir unos ms mientras se escribe. | El `q` aplicado y recortado (E10): es el que produjo el resultado vacío. |
| P6 | Tildes | El caso límite dice "la API no distingue mayúsculas"; es cierto, pero **sí distingue tildes** (`activity.service.ts:113-118`): "orbita" no casa con el nombre "Órbita…" (aunque sí con su *slug*). | No compensarlo en el cliente (la spec excluye la búsqueda en el cliente y ADR-012 la delega en la API). Se documenta aquí; si se quiere búsqueda insensible a tildes, es un cambio en la API (otra spec). |
| P7 | Smoke contra la API real | La spec no lo pide; el mock reproduce la API copiando su lógica (riesgo de desalineación si el fork cambia). | No añadirlo. El fichero `activities-query.ts` cita las líneas de la API que copia. Si la persona lo quiere: `tests/e2e/smoke/launch-search-sort.smoke.spec.ts` que busque "falcon" y ordene por precio con el fork arrancado. |
| P8 | Manejador por defecto del mock | Si el manejador por defecto aplicara búsqueda/orden, los e2e existentes que comprueban el "orden de la API" (seed) cambiarían, porque ahora se pide `_sort=date`. | Mantener el manejador por defecto (seed tal cual) y añadir `apiLikeHandler` para esta spec (E12). Sin cambios en `launches.spec.ts` salvo la URL de R1. |
| P9 | `ActivitiesQuery` y valores por defecto | ADD §4 define `ActivitiesQuery` con campos opcionales; R5 exige `_sort=date&_order=asc` por defecto. ¿Dónde vive el defecto? | En `launch-list-params.ts` (la página), no en `getActivities`, que solo serializa lo que recibe (E1, E2). Otras pantallas futuras no heredan un orden implícito. |
