# Plan: feat-error-handling

- **Spec:** [feat-error-handling.spec.md](feat-error-handling.spec.md)
- **Rama:** `feat/error-handling`

## Revisión de la spec

La spec encaja con el ADD (§3, §4.3, §4.4, §5.2, §5.3, §6, ADR-008) y con lo que ya existe (`src/config.ts`, carpetas `src/api/`, `src/domain/`, `src/hooks/` con `.gitkeep`, Vitest con `include: tests/unit/**/*.test.{ts,tsx}`). Los mensajes de la tabla coinciden con los que emite el fork (`activity-bookings-express/src/routes/*.ts`, `middleware/auth.middleware.ts`, `services/booking.service.ts`: `Capacity exceeded. Available: ${n}, Requested: ${m}`). No hay pantallas nuevas, así que **no se añaden tests e2e**; la suite e2e existente se ejecuta solo como regresión. Las ambigüedades encontradas están en [Puntos a decidir](#puntos-a-decidir); el plan aplica la opción recomendada y se cambia si la persona decide otra.

No se añade ninguna dependencia: todo se hace con React, Zod y las herramientas de test ya instaladas.

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| E1 | `http<T>(path, schema, options?)` con `options: { method?, body?, auth?, signal? }`. `body` se serializa con `JSON.stringify`; `Content-Type: application/json` va en **todas** las peticiones (R1). La URL base se obtiene en cada llamada con `parseApiUrl(import.meta.env.VITE_API_URL)` de `src/config.ts` (sin duplicar la normalización). | Firma del ADD §3 (`http<T>(path, schema, init)`). Leer en cada llamada permite `vi.stubEnv` en los tests y reutiliza `config.ts`. |
| E2 | Token: `http.ts` expone `setAccessTokenGetter(getter: () => string \| null)`; por defecto devuelve `null`. Con `auth: true` y token → `Authorization: Bearer <token>`; con `auth: true` sin token → sin cabecera. Con `auth` falso nunca se envía. `feat-user-session` registrará el getter. | R1 ("si la petición es autenticada y hay token") sin depender todavía de `SessionProvider`. |
| E3 | Sesión rechazada: `onSessionRejected(listener): () => void` (devuelve la función para darse de baja). `http()` notifica a todos los suscriptores **solo** si `auth: true` y el estado es 401, y después lanza el `ApiError` igualmente. | R12, ADD §5.3. La función de baja deja los tests aislados. |
| E4 | `src/api/errors.ts`: `ApiError` (`status`, `kind`, `message`, `fieldErrors`, `availableSeats`), `NetworkError`, `ContractError`, todas con `name` propio. **Sin propiedades de parámetro en el constructor** (`constructor(public readonly status…)` de la plantilla de `coding-react`): `tsconfig.app.json` tiene `erasableSyntaxOnly: true` y no compila. Se declaran los campos y se asignan en el cuerpo. | ADD §4.4; compatibilidad con la configuración actual de TypeScript. |
| E5 | Clasificación (R2) en una función pura `classifyApiError(status, body)` en `src/api/errors.ts` (exportada para test), aplicada en este orden: 400 con `errors` no vacío → `validation`; 400 cuyo `message` empieza por `Capacity exceeded` → `capacity`; 401 → `unauthorized`; 402 → `payment`; 404 → `not-found`; resto (incluido 400 sin `errors` y mensaje desconocido) → `server`. El texto de un 400 genérico se elige por **código**, no por `kind` (ver E8). | R2 literal. Nota: con el fork, `Email is already registered` llega como 400 con `errors: [{ field: 'email' }]`, por tanto `validation`. |
| E6 | `fieldErrors: Record<string, string>` guarda el **mensaje original** de la API del **primer** error de cada campo; la traducción la hace `domain/api-errors.ts › fieldErrorMessages(error)` (devuelve `Record<field, texto en español>`). `availableSeats` lo calcula `http.ts` llamando a `parseAvailableSeats` (solo si `kind === 'capacity'`; si no, `null`). | (desviación menor del comentario del ADD §4.4, que dice "mensaje traducido") La traducción vive en un único sitio (ADR-008) y se evita la dependencia circular `api/errors` ↔ `domain/api-errors` (el dominio importa las clases de error para `instanceof`; `http.ts` importa el dominio). Caso límite "varios errores para el mismo campo: el primero". |
| E7 | Respuestas en `http()`: `fetch` rechazado → `NetworkError` (R3), **salvo** si es una cancelación (`signal.aborted` o `DOMException` `AbortError`), que se relanza tal cual. 2xx → `response.json()` + `schema.safeParse`; si el JSON no se puede leer o no cumple el esquema → `ContractError` sin datos (R5). No 2xx → se intenta `response.json()` + `errorResponseDtoSchema.safeParse`; si falla (vacío, HTML, forma distinta) → `ApiError` con `message: ''`, `fieldErrors: {}` y `kind` según el código (R4). Nunca `as T`. | ADD §4.3. Caso límite "petición cancelada no se muestra como error" (R11). |
| E8 | `toUserMessage(error: unknown): string`, en este orden: `NetworkError` → texto de red; `ContractError` → texto de contrato; `ConfigError` → su propio mensaje (ya en español); `ApiError` con `status ≥ 500` → texto fijo de servidor (siempre, también si trae un mensaje conocido o desconocido); `kind === 'capacity'` → texto de plazas según `availableSeats`; mensaje en la tabla de conocidos → su traducción; mensaje vacío (cuerpo ilegible) → texto fijo del código (401 y 402 de la tabla de textos fijos; 400 "No se ha podido completar la operación.", 404 "No se ha encontrado lo que buscas.", otros 4xx el de servidor); mensaje desconocido → `"<genérico del código> (<original>)"` sin punto final (R7); cualquier otro valor → texto de servidor. | R3–R7 y casos límite. Ver puntos a decidir P1 y P2. |
| E9 | Traducciones como tablas `const` (`Record<string, string>` / `Map`) en `src/domain/api-errors.ts`, más `parseAvailableSeats(message): number \| null` con la regex `/Available:\s*(\d+)/` del ADD §6. Textos exactos de la spec, copiados una sola vez en este módulo. | ADR-008; un solo sitio para los textos. |
| E10 | `fieldErrorMessage(field, apiMessage)`: tabla por `field`; `email` + `Email is already registered` → "Ya existe una cuenta con este email."; campo desconocido → `Dato no válido (<original>)`. | R8 y tabla de errores por campo. |
| E11 | `useAsyncData<T>(loader: (signal: AbortSignal) => Promise<T>)` → `{ state, reload }` con `state: { status: 'loading' } \| { status: 'error'; error: unknown } \| { status: 'ready'; data: T }`. Los parámetros se expresan en la **identidad del `loader`** (cada vista lo memoiza con `useCallback(…, [q])`); el efecto depende de `[loader, reloadCount]`, crea un `AbortController` por ejecución y lo aborta en la limpieza. Las cancelaciones no cambian el estado. | (desviación) El ADD §5.2 escribe `useAsyncData(loader, deps)`. Pasar `deps` a `useEffect` como variable genera el aviso `react-hooks/exhaustive-deps` y `lint` usa `--max-warnings 0`; con `useCallback` la regla sigue comprobando las dependencias en cada vista. Ver P3. |
| E12 | Para no llamar a `setState` de forma síncrona dentro del efecto (regla `react-hooks/set-state-in-effect` de `eslint-plugin-react-hooks@7`), el estado guardado lleva la "clave" de la carga (`loader` + `reloadCount`); si la clave no coincide con la actual, el hook devuelve `{ status: 'loading' }`. Solo se hace `setState` en las callbacks de la promesa y en `reload()`. | Lint en verde sin desactivar reglas; el indicador de carga aparece en el mismo render en que cambian los parámetros (R10, R11). |
| E13 | Componentes en `src/components/`, uno por fichero, sin lógica de dominio: `LoadingIndicator({ label = 'Cargando…' })` → `<p role="status">`; `ErrorMessage({ message, onRetry? })` → contenedor `role="alert"` con el texto y, si hay `onRetry`, `<button type="button">Reintentar</button>`; `EmptyState({ message })` → `<p>`; `FormField({ label, error?, ...inputProps })` → `<label>` + `<input>` con `useId()`; con `error`: `aria-invalid="true"` y `aria-describedby` al `id` del texto de error; sin `error`: sin ninguno de los dos atributos. | ADD §3; R8–R10. Los componentes reciben textos ya traducidos: la vista usa `toUserMessage` / `fieldErrorMessages`. |
| E14 | `src/api/schemas.ts` contiene solo `errorResponseDtoSchema = z.object({ message: z.string(), errors: z.array(z.object({ field: z.string(), message: z.string() })) })` y su tipo inferido. No `strict` (campos extra se ignoran). | Alcance de la spec; ADD §4.3. |
| E15 | Tests en subcarpetas que reflejan `src/` (ADD §3): `tests/unit/api/`, `tests/unit/domain/`, `tests/unit/hooks/`, `tests/unit/components/`. `fetch` se simula con `vi.spyOn(globalThis, 'fetch')` devolviendo `new Response(...)` con cuerpos copiados del fork; `vi.restoreAllMocks()` en `afterEach`. | Skill `testing-unit-vitest`; ADD §9. Ningún test depende de la API arrancada. |
| E16 | Se borran `src/api/.gitkeep`, `src/domain/.gitkeep` y `src/hooks/.gitkeep` al crear ficheros reales en esas carpetas. | Limpieza del scaffolding (como en su T10). |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación. Nombres de test en inglés con el `Rn` delante.

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R1 | `R1: sends an authenticated request to VITE_API_URL with JSON and Bearer headers` — `vi.stubEnv('VITE_API_URL', 'http://localhost:3000')`, getter → `'abc.def.ghi'`, `http('/bookings', schema, { auth: true })` → `fetch` recibe `http://localhost:3000/bookings`, `Content-Type: application/json`, `Authorization: Bearer abc.def.ghi` | unit | `tests/unit/api/http.test.ts` |
| R1 | `R1: does not send Authorization on a request without auth` (`/activities`, con getter que sí devuelve token) | unit | `tests/unit/api/http.test.ts` |
| R1 | `R1: does not send Authorization when auth is requested but there is no token` | unit | `tests/unit/api/http.test.ts` |
| R1 | `R1: serialises the body as JSON and uses the given method` (POST con `{ activityId, participants }`) | unit | `tests/unit/api/http.test.ts` |
| R2 | `R2: classifies a capacity error and reads the available seats` — 400 `Capacity exceeded. Available: 2, Requested: 5`, `errors: []` → `ApiError` `kind: 'capacity'`, `availableSeats: 2` | unit | `tests/unit/api/http.test.ts` |
| R2 | `R2: classifies a validation error and keeps the field errors` — 400 `Validation failed` + `[{ field: 'email', message: 'Invalid email' }]` → `kind: 'validation'`, `fieldErrors: { email: 'Invalid email' }` | unit | `tests/unit/api/http.test.ts` |
| R2 | `R2: keeps only the first error of a repeated field` | unit | `tests/unit/api/http.test.ts` |
| R2 | `it.each` `R2: classifies status %i as %s` — 401 `unauthorized`, 402 `payment`, 404 `not-found`, 503 `server`, 400 con `errors: []` y mensaje desconocido `server` (con `classifyApiError`) | unit | `tests/unit/api/errors.test.ts` |
| R2 | `R2: sets availableSeats to null when the error is not a capacity error` | unit | `tests/unit/api/http.test.ts` |
| R3 | `R3: throws NetworkError when fetch rejects` — `fetch` rechaza con `new TypeError('Failed to fetch')` → `NetworkError` | unit | `tests/unit/api/http.test.ts` |
| R3 | `R3: translates a network error` → "No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo." | unit | `tests/unit/domain/api-errors.test.ts` |
| R4 | `R4: builds a generic ApiError when the error body is not JSON` — 500 `<html>Internal Server Error</html>` → `ApiError` `status: 500`, `kind: 'server'`, `message: ''`; `toUserMessage` → "Se ha producido un error en el servidor. Inténtalo de nuevo más tarde." | unit | `tests/unit/api/http.test.ts` |
| R4 | `R4: builds a generic ApiError when the error body has an unexpected shape` (`{ error: 'x' }`) y con cuerpo vacío | unit | `tests/unit/api/http.test.ts` |
| R4 | `it.each` `R4: shows the fixed text of status %i when the body cannot be read` — 400 "No se ha podido completar la operación.", 401, 402, 404 "No se ha encontrado lo que buscas.", 500, 503 (sin paréntesis) | unit | `tests/unit/domain/api-errors.test.ts` |
| R4 | `R4: shows the server text for a 500 with a JSON message` (`Failed to retrieve booking`) | unit | `tests/unit/domain/api-errors.test.ts` |
| R5 | `R5: throws ContractError when a 2xx response does not match the schema` — esquema `z.object({ id: z.string() })`, 200 `{ "id": 7 }` → `ContractError`; `toUserMessage` → "El servidor ha devuelto una respuesta inesperada." | unit | `tests/unit/api/http.test.ts` |
| R5 | `R5: throws ContractError when a 2xx body is not JSON` | unit | `tests/unit/api/http.test.ts` |
| R5 | `R5: returns the parsed data when the response matches the schema` (camino feliz) | unit | `tests/unit/api/http.test.ts` |
| R6 | `it.each` `R6: translates "%s"` — cada fila de la tabla de mensajes conocidos (con su código real: 400, 400, 401, 401, 401, 402, 404, 404, 500, 500) → traducción exacta | unit | `tests/unit/domain/api-errors.test.ts` |
| R6 | `R6: translates capacity messages` — `Available: 2` → "Solo quedan 2 plazas libres."; `Available: 0` → "No quedan plazas libres en este lanzamiento."; `Capacity exceeded` (sin número) → "No hay plazas suficientes para tu solicitud." | unit | `tests/unit/domain/api-errors.test.ts` |
| R6 | `R6: parseAvailableSeats` — `"Capacity exceeded. Available: 2, Requested: 5"` → 2; `Available: 0` → 0; `"Capacity exceeded"` → `null` | unit | `tests/unit/domain/api-errors.test.ts` |
| R7 | `R7: shows the generic text and the original message for an unknown message` — 400 `Launch window closed`, `errors: []` → "No se ha podido completar la operación (Launch window closed)" | unit | `tests/unit/domain/api-errors.test.ts` |
| R7 | `it.each` `R7: uses the generic text of status %i` — 401 `Authentication failed`, 402, 404, 409 (resto) con mensaje desconocido | unit | `tests/unit/domain/api-errors.test.ts` |
| R8 | `it.each` `R8: translates the error of field %s` — `username`, `email`, `password`, `terms`, `participants`, `activityId`; `email` + `Email is already registered` → "Ya existe una cuenta con este email."; `foo` + `bad value` → "Dato no válido (bad value)" (`fieldErrorMessages` sobre un `ApiError`) | unit | `tests/unit/domain/api-errors.test.ts` |
| R8 | `R8: marks the field as invalid and links its error` — `FormField` "Email" con `error` = traducción de `email` → `getByLabelText('Email')` tiene `aria-invalid="true"` y su `aria-describedby` apunta a un elemento con "Introduce un email válido." | componente | `tests/unit/components/FormField.test.tsx` |
| R8 | `R8: shows the unknown field text` ("Dato no válido (bad value)") y `R8: has no aria-invalid nor aria-describedby without error` | componente | `tests/unit/components/FormField.test.tsx` |
| R9 | `R9: shows the message in an alert and retries once` — `ErrorMessage` con el texto de red y `onRetry = vi.fn()`; `userEvent.click` en "Reintentar" → texto dentro de `getByRole('alert')`, `onRetry` llamado 1 vez | componente | `tests/unit/components/ErrorMessage.test.tsx` |
| R9 | `R9: hides the retry button without a retry handler` | componente | `tests/unit/components/ErrorMessage.test.tsx` |
| R9 | `R9: reload repeats the load` — `useAsyncData` con un loader que falla y después resuelve; `reload()` → el loader se llama 2 veces y el estado pasa a `ready` | unit | `tests/unit/hooks/use-async-data.test.tsx` |
| R10 | `R10: shows a loading status while the load is pending and hides it when it resolves` — componente de prueba (en el propio test) con `useAsyncData` + `LoadingIndicator`; promesa controlada → `getByRole('status')` con "Cargando…"; al resolver, `queryByRole('status')` es `null` y se ven los datos | componente | `tests/unit/hooks/use-async-data.test.tsx` |
| R10 | `R10: LoadingIndicator shows the given label` ("Cargando lanzamientos…") | componente | `tests/unit/components/LoadingIndicator.test.tsx` |
| R11 | `R11: aborts the previous load and keeps only the latest result` — `renderHook` con `q='fal'` (promesa diferida, "tarda más") y `rerender` a `q='falcon'` (se resuelve antes); se resuelve después la de `fal` → la señal de `fal` está `aborted` y el estado final es `ready` con los datos de `falcon` | unit | `tests/unit/hooks/use-async-data.test.tsx` |
| R11 | `R11: does not show an aborted load as an error` — el loader anterior rechaza con `DOMException('…', 'AbortError')` → el estado nunca pasa a `error` | unit | `tests/unit/hooks/use-async-data.test.tsx` |
| R11 | `R11: rethrows an aborted fetch instead of a NetworkError` — `http()` con señal abortada | unit | `tests/unit/api/http.test.ts` |
| R12 | `R12: notifies session-rejected subscribers on a 401 of an authenticated request` — `/bookings`, `auth: true`, 401 `Invalid or expired token. Please login again.` → suscriptor llamado 1 vez y se lanza `ApiError` `unauthorized` | unit | `tests/unit/api/http.test.ts` |
| R12 | `R12: does not notify on a 401 of a request without auth` — `/login`, 401 `Invalid email or password` → suscriptor no llamado | unit | `tests/unit/api/http.test.ts` |
| R12 | `R12: stops notifying after unsubscribing` y `R12: does not notify on other errors of an authenticated request` (403/500) | unit | `tests/unit/api/http.test.ts` |
| — | `EmptyState` muestra su mensaje (`EmptyState renders its message`) | componente | `tests/unit/components/EmptyState.test.tsx` |

Los tests de cancelación usan promesas diferidas (sin esperas reales de 200/50 ms) para que sean deterministas; reproducen el orden del criterio: la primera carga termina después que la segunda.

E2E: la spec no lo exige (no hay pantallas nuevas). Se ejecuta la suite existente como regresión.

## Tareas

- [x] **T1** — Esquema de error y clases de error con su clasificación (E4, E5, E14). · Requisitos: R2 · Ficheros: `tests/unit/api/errors.test.ts`, `src/api/schemas.ts`, `src/api/errors.ts`; borrar `src/api/.gitkeep`.
  - Primero `errors.test.ts` (clasificación por código y mensaje) en rojo.
  - Verificación: `npm test -- tests/unit/api/errors.test.ts`; `npm run typecheck`.

- [x] **T2** — Traducciones de dominio (E8, E9, E10). · Requisitos: R3, R4, R6, R7, R8 (traducción por campo) · Ficheros: `tests/unit/domain/api-errors.test.ts`, `src/domain/api-errors.ts`; borrar `src/domain/.gitkeep`.
  - Primero los tests con los textos exactos de la spec (tablas `it.each`), construyendo los errores con las clases de T1.
  - Exporta `parseAvailableSeats`, `toUserMessage`, `fieldErrorMessage`, `fieldErrorMessages`.
  - Verificación: `npm test -- tests/unit/domain/api-errors.test.ts`.

- [x] **T3** — Cliente `http()`: URL, cabeceras, cuerpo, respuesta 2xx y contrato (E1, E2, E7). · Requisitos: R1, R5 · Ficheros: `tests/unit/api/http.test.ts`, `src/api/http.ts`.
  - Primero los tests de R1 y R5; después `http()` y `setAccessTokenGetter`.
  - Verificación: `npm test -- tests/unit/api/http.test.ts`.

- [x] **T4** — Cliente `http()`: errores no 2xx, red y cancelación (E5–E7). · Requisitos: R2, R3, R4, R11 (abort en `http`) · Ficheros: `tests/unit/api/http.test.ts`, `src/api/http.ts`.
  - Primero los tests de R2/R3/R4/R11 de `http.test.ts`; después la lectura del cuerpo de error con `errorResponseDtoSchema`, `fieldErrors` (primer error por campo), `availableSeats` con `parseAvailableSeats`, `NetworkError` y relanzado de `AbortError`.
  - Verificación: `npm test -- tests/unit/api/http.test.ts`.

- [x] **T5** — Suscripción a "sesión rechazada" (E3). · Requisitos: R12 · Ficheros: `tests/unit/api/http.test.ts`, `src/api/http.ts`.
  - Primero los tests de R12; después `onSessionRejected` y la notificación en 401 con `auth: true`.
  - Verificación: `npm test -- tests/unit/api/http.test.ts`.

- [x] **T6** — Componentes `LoadingIndicator`, `ErrorMessage` y `EmptyState` (E13). · Requisitos: R9, R10 · Ficheros: `tests/unit/components/LoadingIndicator.test.tsx`, `tests/unit/components/ErrorMessage.test.tsx`, `tests/unit/components/EmptyState.test.tsx`, `src/components/LoadingIndicator.tsx`, `src/components/ErrorMessage.tsx`, `src/components/EmptyState.tsx`.
  - Verificación: `npm test -- tests/unit/components`.

- [x] **T7** — Componente `FormField` (E13). · Requisitos: R8 · Ficheros: `tests/unit/components/FormField.test.tsx`, `src/components/FormField.tsx`.
  - El test usa `fieldErrorMessages` de T2 sobre un `ApiError` `Validation failed` para obtener el texto.
  - Verificación: `npm test -- tests/unit/components/FormField.test.tsx`.

- [x] **T8** — Hook `useAsyncData` (E11, E12). · Requisitos: R9 (reintento), R10, R11 · Ficheros: `tests/unit/hooks/use-async-data.test.tsx`, `src/hooks/use-async-data.ts`; borrar `src/hooks/.gitkeep`.
  - Primero los tests (carga pendiente con `LoadingIndicator`, `reload`, cancelación, `AbortError` ignorado); después el hook.
  - Verificación: `npm test -- tests/unit/hooks`; `npm run lint` sin avisos de `react-hooks`.

- [x] **T9** — Verificación final. · Requisitos: R1–R12 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Ejecutar en orden: `npm run typecheck`, `npm run lint`, `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (regresión: los 3 tests de `app-shell` en verde).
  - **No** usar `npm run test:e2e -- --project=chromium`: el script ya fija `--project=chromium --project=firefox` y añadir otro `--project` no quita Firefox.
  - Firefox lo ejecuta **la persona** en su terminal con `npx.cmd playwright test --project=firefox`: en el entorno del agente Firefox no arranca (error *side-by-side* de `mozglue`, ver D7 del plan de scaffolding).
  - Comprobar que no quedan `console.log`, código comentado, `any` ni `as T` sobre datos de red; que ningún componente llama a `fetch`; `git status` sin ficheros no previstos.
  - Anotar en la PR las desviaciones E6 y E11 y lo decidido en los puntos P1–P5.

## Desviaciones durante la implementación

- **D1** — `fieldErrorMessages(error: unknown)` acepta cualquier valor (devuelve `{}` si no es un `ApiError`) para que las vistas puedan pasarle directamente el error del estado de `useAsyncData` o de un `catch`.
- **D2** — `NetworkError` y `ContractError` aceptan un `{ cause }` opcional (error original de `fetch` o de Zod) para facilitar la depuración; no cambia ningún texto mostrado.
- **D3** — La regresión e2e en Chromium ejecuta **4** tests (3 de `app-shell.spec.ts` + 1 de `app-shell-edge.spec.ts`), no 3 como indicaba T9; los 4 en verde.
- **D4** — Se añadieron tests extra no listados en el plan de pruebas: 409 → `server` (R2, R4, R7), `ConfigError` y otros errores en `toUserMessage` (P6), `fieldErrorMessages` sobre un error que no es de la API, `FormField` pasa las props al `input`, y `useAsyncData` expone el error de una carga fallida.
- **D5** — Iteración tras el hallazgo del tester (fase de verificación, aprobada por la persona): si la `signal` se abortaba mientras se leía el cuerpo, `readJson` se tragaba el `AbortError` y `http()` lanzaba `ContractError` (2xx) o un `ApiError` con `message: ''` (no-2xx, notificando además el 401), contra R11 y la decisión E7. Corrección mínima en `src/api/http.ts`: `readJson` recibe la `signal` y relanza el error si `isAbortError` lo identifica como cancelación (`toApiError` y `http` le pasan la `signal`). Tests (R11) añadidos en `tests/unit/api/http-edge-cases.test.ts`: fallaban antes de la corrección y pasan después.
- **D6** — Nota posterior (`feat-user-session`, decisión P1/S6): la decisión **E2** cambia. Con `auth: true` y sin token válido, `http()` ya no envía la petición sin cabecera: no llama a `fetch`, notifica `onSessionRejected` y lanza `ApiError` 401 `unauthorized` con `message: ''` (texto de sesión caducada). El test `R1: does not send Authorization when auth is requested but there is no token` de `tests/unit/api/http.test.ts` se sustituyó por `R11: does not call fetch for an authenticated request without a valid token`, y el test `R12: does not notify on a %i of an authenticated request` registra ahora un token para seguir probando lo mismo.

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde (139 tests)
- [x] `npm run build` en verde
- [x] Regresión e2e en verde: Chromium 4/4 (agente) y Firefox 4/4 (persona)
- [x] CHANGELOG actualizado

## Puntos a decidir

El plan aplica la opción **recomendada**; si la persona elige otra, se ajusta antes de T2/T8.

> **Decisión:** la persona ha aprobado P1–P6 según la recomendación de esta tabla (validación del plan antes de la fase de código).

| # | Tema | Ambigüedad | Recomendación |
|---|---|---|---|
| P1 | 500 con mensaje JSON desconocido | R4 dice que un 500 muestra el texto de servidor; R7 dice que un mensaje desconocido muestra el genérico + original. Con el fork ocurre en `GET /bookings/:id` → 500 `Failed to retrieve booking`. | Para `status ≥ 500` siempre el texto fijo de servidor, sin paréntesis (E8); R7 aplica a los 4xx. Coincide con la tabla de textos fijos ("500 u otro código ≥ 500"). |
| P2 | Puntuación cuando no hay mensaje original | Los textos genéricos por código no llevan punto ("No se ha podido completar la operación") porque van seguidos de "(original)". Con cuerpo ilegible (caso límite "sin paréntesis") falta saber si se añade punto. | 401, 402 y ≥ 500 usan sus textos fijos de la tabla (con punto); 400 y 404 sin original terminan en punto: "No se ha podido completar la operación." y "No se ha encontrado lo que buscas.". Otros 4xx sin original → texto de servidor. |
| P3 | Firma de `useAsyncData` | El ADD §5.2 dice `useAsyncData(loader, deps)`; con `deps` como variable, `react-hooks/exhaustive-deps` avisa y `lint` falla (`--max-warnings 0`). | `useAsyncData(loader)` con el `loader` memoizado con `useCallback` en cada vista (E11). Alternativa: mantener `(loader, deps)` desactivando la regla en esa línea. |
| P4 | Concordancia "Solo quedan 1 plazas libres." | La plantilla "Solo quedan X plazas libres." es incorrecta en singular. La spec no lo trata. | Para X = 1: "Solo queda 1 plaza libre." (y "Solo quedan X plazas libres." para X ≥ 2). Si se prefiere no tocar la spec, se deja literal. |
| P5 | 401 con mensaje desconocido en petición **sin** sesión | Con el fork, `POST /login` puede responder 401 `Authentication failed` (error interno). Por R7 se mostraría "Tu sesión ha caducado o no es válida. Inicia sesión de nuevo (Authentication failed)", poco adecuado en el formulario de acceso. | Aceptar el comportamiento de R7 en esta spec (es un caso raro del fork) y, si hace falta, que `feat-user-session` lo afine en su pantalla. |
| P6 | Errores que no son de la API (p. ej. `ConfigError` o un fallo de programación) en `toUserMessage` | La spec no los cubre. | `ConfigError` → su mensaje (ya en español, de `config.ts`); cualquier otro → texto de servidor, para no mostrar nunca un error vacío (E8). |
