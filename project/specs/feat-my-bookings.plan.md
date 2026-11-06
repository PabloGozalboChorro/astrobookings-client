# Plan: feat-my-bookings

- **Spec:** [feat-my-bookings.spec.md](feat-my-bookings.spec.md)
- **Rama:** `feat/my-bookings`
- **Estado:** Aprobado por delegación de la persona (decisiones B1–B15 y P1–P12 tal como las fija este plan).

## Revisión de la spec

La spec encaja con el PRD (F14, F15, F16; e2e de F3 y F4; partes de F17 y F18) y con el ADD (§3 estructura: `api/bookings.ts`, `domain/booking.ts`, `features/bookings/{MyBookingsPage,BookingDetailPage,PaymentStatusBadge,use-my-bookings,use-booking}`; §4.1 endpoints 6 y 7; §4.2 `paymentStatusSchema`, `bookingDtoSchema`, `bookingWithActivityDtoSchema` y modelo `Booking`; §5.1 rutas `/reservas` y `/reservas/:id` protegidas; §6 `toBooking`, `totalAmount`, `paymentStatusLabel`, `formatDate`; ADR-009 sin `activityId`; ADR-011; riesgos R5 y R6). Se reutiliza lo que ya hay en `main` tras `feat-user-session` y `feat-user-registration`:

- `http(path, schema, { auth: true, signal })`: añade `Authorization: Bearer <token>`; sin token no llama a `fetch` y notifica sesión rechazada; con 401 notifica `onSessionRejected` → `SessionProvider.expireSession` → `RequireAuth` redirige a `/acceso?volver=<ruta>` con el aviso (R11 sin código nuevo).
- `RequireAuth` (ruta *layout*, `checkExpiry` al entrar) y `SessionProvider` (sesión caducada al arrancar → sin sesión + aviso, sin petición).
- `useAsyncData(loader)` (estados `loading | error | ready`, `reload`, aborta al desmontar) con el patrón de `use-launch.ts`/`use-launches.ts`.
- `LoadingIndicator` (`role="status"`, `label`), `ErrorMessage` (`role="alert"`, `onRetry` → "Reintentar"), `EmptyState`.
- `toUserMessage` (ya traduce `Failed to retrieve bookings` y cualquier 5xx → texto de servidor, `NetworkError`, `ContractError`, 401 → texto de sesión) e `isNotFoundError` de `api/errors.ts`; `KNOWN_API_MESSAGES` ya contiene `'Booking not found': 'No encontramos esta reserva.'`.
- `parseLaunchName`, `launchStatusLabel` ("Cancelado"…) y el parseo de fecha de `domain/launch.ts`; `formatDateTime`, `formatDuration`, `formatPrice` de `domain/format.ts`.
- Patrón de presentación de `LaunchCard`/`LaunchDetailPage`/`LaunchNotFound` (artículo con `aria-labelledby`, enlace en el título, `<time dateTime>`).
- Helpers de test: `tests/unit/support/{http,deferred,session}.ts(x)` (`mockFetchByUrl`, `jsonResponse`, `storeSession`, `renderApp`, `currentLocation`); e2e `tests/e2e/fixtures/{api-mock,data,session,locators}.ts` (`API_URL`, `CORS_HEADERS`, `mockActivities`, `mockLogin`, `seedSession`, `sessionValue`, `ANA_TOKEN`, `readStoredSession`, `findLaunchDto`).

No se añade ninguna dependencia.

Huecos y ambigüedades: ver [Puntos a decidir](#puntos-a-decidir). Ninguno cambia el producto de forma importante; el plan aplica la recomendación (delegado por la persona).

### Contrato real de la API (fork `activity-bookings-express`, `master` en `7f69493`)

| Aspecto | Comportamiento | Evidencia |
|---|---|---|
| Rutas | `GET /bookings` y `GET /bookings/:id` (router montado en `/bookings`), ambas con `authenticateToken`; CORS abierto. | `src/index.ts:16`, `:30`; `src/routes/bookings.ts:25`, `:63` |
| Autenticación (401) | Sin cabecera o sin token tras `Bearer ` → 401 `{ message: 'Authentication required. Please provide a valid token.', errors: [] }`; token inválido/caducado → 401 `{ message: 'Invalid or expired token. Please login again.', errors: [] }`. `req.user.id` = claim `userId` (`"user-N"`). | `src/middleware/auth.middleware.ts:11-38` |
| `GET /bookings` | Reservas cuyo `userId` es el del token, **en orden de inserción** (no ordena). `?activityId=` opcional filtra (no se usa, ADR-009). 200 `BookingResponse[]` (`[]` si no hay). | `src/routes/bookings.ts:25-55`; `src/services/booking.service.ts:118-120` |
| `GET /bookings/:id` | 200 `BookingResponse`. Si no existe **o es de otra persona** → **404** `{ message: 'Booking not found', errors: [] }` (no hay 403). | `src/routes/bookings.ts:63-90`; `src/services/booking.service.ts:134-143` |
| Forma de `BookingResponse` | `{ id: "booking-N", activityId, userId: "user-N", participants: number, createdAt: ISO, paymentId?: string, paymentStatus: 'pending' \| 'paid' \| 'refunded', activity: { name, slug, price, date, duration, location, status } }`. `paymentStatus` siempre presente (`?? 'pending'`). `activity` **no** trae `id`, `minParticipants` ni `maxParticipants` (el id es `activityId`). `activity.status` tipado como `string` en el fork, pero viene de la actividad (enum de `activityStatusSchema`). | `src/types/booking.ts:6-14`, `:29-51`; `src/services/booking.service.ts:149-181` |
| 500 | Lista: cualquier excepción (p. ej. reserva cuya actividad ya no existe → `enrichBookingWithActivity` lanza `Activity not found`) → 500 `{ message: 'Failed to retrieve bookings', errors: [] }` para **toda** la lista. Detalle: misma causa → 500 `{ message: 'Failed to retrieve booking', errors: [] }` (singular). | `src/routes/bookings.ts:47-54`, `:80-89`; `src/services/booking.service.ts:150-153` |
| Importe | El fork calcula `amount = price × participants` al reservar y lo guarda en el pago, pero **no** lo expone en la reserva. | `src/services/booking.service.ts:56`; `src/types/payment.ts` |
| Datos de partida | `db/bookings.json` y `db/payments.json` están **vacíos** (`[]`); `db/users.json` solo tiene `user-1` (semilla del curso); las actividades se cargan de `db/seed/activities.json` (= `launchDtos` de los fixtures). | `db/*.json`; `src/utils/data-loader.ts:10-14` |

Conclusiones: los dos endpoints, el 404 de reserva ajena/inexistente (R10), los cuerpos 401 (R11) y el 500 de la lista (R7) coinciden con la spec y con el ADD. Diferencias menores, sin impacto en el producto: (a) el 500 del detalle dice `Failed to retrieve booking` (singular), no está en `KNOWN_API_MESSAGES`, pero `toUserMessage` ya da el texto de servidor para cualquier `status >= 500`; (b) la API no ordena: el orden de R4 lo hace el cliente (B6); (c) `activity` no trae `id`: el enlace "Ver lanzamiento" usa `activityId` (B4). Para pruebas manuales contra la API real **no hay reservas sembradas**: hay que crearlas antes (ver T8). Los tests no dependen de la API arrancada.

### Impacto en lo existente

| Fichero | Cambio |
|---|---|
| `src/api/schemas.ts` | Añade `paymentStatusSchema`, `bookingDtoSchema`, `bookingWithActivityDtoSchema` y sus tipos (B1). |
| `src/api/bookings.ts` (nuevo) | `getMyBookings(signal)` y `getBooking(id, signal)` (B2). |
| `src/domain/launch.ts` | Exporta el parseo de fecha existente (`parseLaunchDate`) para reutilizarlo en `toBooking`; sin cambio de comportamiento (B4). |
| `src/domain/format.ts` | Añade `formatDate(date)` y `formatSeatCount(seats)` (B5). |
| `src/domain/booking.ts` (nuevo) | `Booking`, `BookedLaunch`, `PaymentStatus`, `toBooking`, `totalAmount`, `paymentStatusLabel`, `sortByMostRecent` (B3, B4, B6). |
| `src/domain/api-errors.ts` | Exporta `BOOKING_NOT_FOUND_TEXT` (el texto ya existe en `KNOWN_API_MESSAGES`; se reutiliza la constante, igual que `LAUNCH_NOT_FOUND_TEXT`). |
| `src/features/bookings/*` (nuevos) | `use-my-bookings.ts`, `use-booking.ts`, `PaymentStatusBadge.tsx`, `BookingCard.tsx`, `MyBookingsPage.tsx`, `BookingDetailPage.tsx`, `BookingNotFound.tsx`; se borra `.gitkeep`. |
| `src/App.tsx` | Rutas `reservas` y `reservas/:id` dentro de `<Route element={<RequireAuth />}>` (B10). |
| `src/components/Layout.tsx` | Enlace "Mis reservas" en la navegación principal solo con sesión (B11). |
| `src/styles/global.css` | Estilos mínimos de la lista y de la etiqueta de estado (reutilizando las clases de `launch-card`/`launch-list` cuando sea posible). |
| `tests/unit/support/session.tsx` | `renderApp` añade `reservas` y `reservas/:id` con las páginas reales dentro de `RequireAuth` (la ruta `/protegida` se mantiene). |
| `tests/unit/support/bookings.ts` (nuevo) | Constructor de DTOs de reserva `bookingDto(overrides)` a partir de las actividades de `tests/unit/support/activities.ts`. |
| `tests/e2e/fixtures/api-mock.ts` | Añade `mockBookings(page, handler)` (B14). |
| `tests/e2e/fixtures/data.ts` | `bookingDtos` (formas reales del fork) y errores `failedToRetrieveBookings`, `bookingNotFound`, `invalidToken`. |
| `tests/e2e/fixtures/locators.ts` | `bookingCard(page, mission)`. |

Los tests existentes de `Layout`, `App`, `RequireAuth`, `SessionProvider`, `LoginPage` y los e2e deben seguir en verde. Ojo con nombres que se solapan en `getByRole(..., { name })` (coincidencia parcial sin `exact`): "Mis reservas" (enlace de cabecera y `h1`) frente a "Volver a mis reservas"; "Ver lanzamiento" frente a "Ver lanzamientos". Los tests nuevos usan `exact: true`; los existentes no buscan esos nombres.

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| B1 | **Esquemas** en `src/api/schemas.ts` tal como ADD §4.2: `paymentStatusSchema = z.enum(['pending','paid','refunded'])`; `bookingDtoSchema` (`id`, `activityId`, `userId`, `participants: z.number()`, `createdAt: isoDateString`, `paymentId?`, `paymentStatus?`); `bookingWithActivityDtoSchema = bookingDtoSchema.extend({ paymentStatus: paymentStatusSchema, activity: z.object({ name, slug, price, date: isoDateString, duration, location, status: activityStatusSchema }) })`. `createdAt` usa `isoDateString` (el ADD pone `z.string()`), para que una fecha inválida sea `ContractError` y no "Invalid Date" en pantalla. `bookingDtoSchema` se define ya (lo usará `feat-booking-creation`). | ADD §4.2, §4.3; R7 (respuesta inesperada). Ver P7. |
| B2 | **Recurso** `src/api/bookings.ts`: `getMyBookings(signal?)` = `http('/bookings', z.array(bookingWithActivityDtoSchema), { auth: true, signal })` (sin `activityId`); `getBooking(id, signal?)` = `http(\`/bookings/${encodeURIComponent(id)}\`, bookingWithActivityDtoSchema, { auth: true, signal })`. | R3, R8, R10, R11; ADR-009; mismo patrón que `getActivity`. |
| B3 | **Dominio** `src/domain/booking.ts`: `type PaymentStatus`; `type BookedLaunch = Pick<Launch, 'id' \| 'slug' \| 'fullName' \| 'mission' \| 'rocket' \| 'location' \| 'date' \| 'durationMinutes' \| 'pricePerSeat' \| 'status'>` (con `id` = `activityId`); `type Booking = { id; launchId; participants; createdAt: Date; paymentStatus; launch: BookedLaunch; totalAmount: number }`. `launch` y `totalAmount` son **obligatorios**: solo se construyen desde `GET /bookings` y `/bookings/:id` (el 201 de `POST /bookings` no se mapea a `Booking`; `feat-booking-creation` solo necesita su `id` para navegar, ADR-011). | ADD §4.2 los marca opcionales; aquí siempre existen y así la UI no comprueba `undefined`. Ver P1. |
| B4 | `toBooking(dto)`: `launch` con `parseLaunchName(activity.name)`, `parseLaunchDate(activity.date)` (se exporta la función privada ya existente de `launch.ts`, que trata fechas sin hora como locales), `durationMinutes = duration`, `pricePerSeat = price`, `status`, `id = dto.activityId`; `createdAt = new Date(dto.createdAt)`; `totalAmount = totalAmount(price, participants)`. | R4, R9; AGENTS §7 (no duplicar el parseo de nombre y fecha). |
| B5 | **Formato** en `src/domain/format.ts`: `formatDate(date)` = `Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })` → "4 de noviembre de 2026"; `formatSeatCount(n)` → "1 plaza" / "N plazas". `totalAmount(price, participants)` = `Math.round(price * participants * 100) / 100` (99.99 × 3 → 299.97 → "299,97 €"). | R4, R9, caso límite de decimales; ADD §6. |
| B6 | **Orden**: `sortByMostRecent(bookings)` devuelve una copia ordenada por `createdAt` descendente; empates, en el orden en que llegan de la API (orden estable). Lo aplica `use-my-bookings`. | R4; la API no ordena. Ver P2. |
| B7 | `paymentStatusLabel(status)`: `pending` "Pendiente de pago", `paid` "Pagada", `refunded` "Reembolsada" (`Record<PaymentStatus, string>`). **`PaymentStatusBadge`** pinta `<span className="payment-status payment-status--<status>">` con el texto. | R5, F16; ADD §3. |
| B8 | **Hooks** con `useAsyncData` y `useCallback`: `useMyBookings()` → `sortByMostRecent((await getMyBookings(signal)).map(toBooking))`; `useBooking(id)` → `toBooking(await getBooking(id, signal))`. | ADD §5.2 (datos frescos, sin caché); patrón de `use-launch.ts`. |
| B9 | **`MyBookingsPage`** (`/reservas`): `<h1>Mis reservas</h1>`; `loading` → `LoadingIndicator` "Cargando tus reservas…"; `error` → `ErrorMessage` con `toUserMessage` y `onRetry={reload}`; `[]` → `EmptyState` "Todavía no tienes reservas." + `<p><Link to="/lanzamientos">Ver lanzamientos</Link></p>` (se compone en la página, `EmptyState` no cambia); si no, `<ul>` de **`BookingCard`**: `<article aria-labelledby>` con `<h2><Link to="/reservas/<id codificado>">{mission}</Link></h2>`, "Cohete: X" solo si hay cohete, `<time>` con `formatDateTime(launch.date)`, `formatSeatCount`, `formatPrice(totalAmount)`, "Reservada el {formatDate(createdAt)}" y `PaymentStatusBadge`. | R3–R8. Ver P3. |
| B10 | **`BookingDetailPage`** (`/reservas/:id`): `loading` → "Cargando reserva…"; error 404 (`isNotFoundError`) → **`BookingNotFound`** (`<h1>Reserva no encontrada</h1>`, `BOOKING_NOT_FOUND_TEXT`, enlace "Volver a mis reservas" a `/reservas`, sin "Reintentar"); otro error → `ErrorMessage` con "Reintentar". Datos: `<h1>{mission}</h1>`, "Cohete: X", lugar, `<time>` fecha y hora, `formatDuration`, "{precio} por plaza", estado del lanzamiento con `launchStatusLabel` (p. ej. "Estado del lanzamiento: Cancelado"), sección de la reserva con `formatSeatCount`, importe total, "Reservada el …" y `PaymentStatusBadge`; enlaces "Ver lanzamiento" a `/lanzamientos/<activityId codificado>` y "Volver a mis reservas" a `/reservas`. Sin `BookabilityNotice`. Sin `id` en la ruta → `BookingNotFound`. | R8–R10. El bloque `state.justCreated` es de `feat-booking-creation`. Ver P4, P5. |
| B11 | **Rutas** en `App.tsx`: `<Route element={<RequireAuth />}>` con `reservas` → `MyBookingsPage` y `reservas/:id` → `BookingDetailPage`, dentro de `Layout`. **Cabecera**: en `<nav aria-label="Principal">`, tras "Lanzamientos", `<Link to="/reservas">Mis reservas</Link>` solo si `session !== null`. | R1, R2, R11; ADD §5.1. Ver P6. |
| B12 | **R11 sin código nuevo**: el 401 de `http()` con `auth: true` ya dispara `expireSession` y `RequireAuth` redirige con el aviso; la sesión caducada al arrancar ya se descarta en `SessionProvider` sin petición. Solo se añaden tests sobre las rutas reales. Mientras dura la redirección la página puede pintar un instante el error de sesión (texto de 401); los tests comprueban el estado final. | R11 (`feat-user-session` R11, R12). |
| B13 | Tests unitarios en carpetas que reflejan `src/`: `tests/unit/api/bookings.test.ts`, `tests/unit/domain/{booking,format,launch}.test.ts`, `tests/unit/features/bookings/{PaymentStatusBadge,MyBookingsPage,BookingDetailPage}.test.tsx`, `tests/unit/components/Layout.test.tsx`, `tests/unit/App.test.tsx`. Las páginas se prueban con `renderApp` (sesión real en `localStorage`, `fetch` con `mockFetchByUrl`), así cubren token, `RequireAuth` y 401 sin mockear el módulo de API. `TZ=UTC`. | Skill `testing-unit-vitest`; ADD §9. |
| B14 | **E2E**: `mockBookings(page, handler)` en `api-mock.ts` intercepta `${API_URL}/bookings**` (OPTIONS → 204 con `CORS_HEADERS`; registra `{ url: URL, authorization: string \| null }` de cada GET, con `await request.headerValue('authorization')`; `'abort'`). Handler por defecto: lista = `bookingDtos`; `/bookings/<id>` → la reserva o 404 `bookingNotFound`. `data.ts`: `bookingDtos` construidos con `bookingWithActivity(id, activityId, participants, createdAt, paymentStatus)` a partir de `findLaunchDto` (solo los 7 campos de `activity` del fork): `booking-1` (`activity-1`, 2, `2026-11-03T09:00:00.000Z`, `paid`), `booking-2` (`activity-3`, 3, `2026-11-04T18:00:00.000Z`, `paid`), `booking-3` (`activity-2`, 1, `2026-11-05T12:00:00.000Z`, `pending`), `booking-4` (`activity-6`, 1, `2026-11-01T08:00:00.000Z`, `refunded`). La API simulada devuelve la lista en orden de inserción (no ordenado), como el fork. | ADR-007; ADD §9; criterios R2, R4, R5, R8, R9. |
| B15 | Sin proyecto *smoke* en esta spec: el recorrido del ADD §9 empieza por reservar, que llega con `feat-booking-creation`. | La spec no lo pide; ver P11. |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación. Nombres de test en inglés con el `Rn` delante.

### Unitarios y de componentes (Vitest, jsdom, `TZ=UTC`)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R3 | `R3: requests GET /bookings with the token and without activityId` — `fetch` recibe `http://localhost:3999/bookings` (sin `?`), `Authorization: Bearer <token>`; devuelve la lista validada | unit | `tests/unit/api/bookings.test.ts` |
| R8 | `R8: requests GET /bookings/<id> with the token` (`booking-1`; id con caracteres especiales se codifica) | unit | `tests/unit/api/bookings.test.ts` |
| R7 | `ContractError` si falta `activity`, si `paymentStatus` es desconocido o si `createdAt` no es fecha; `ApiError` 500 con `Failed to retrieve bookings` | unit | `tests/unit/api/bookings.test.ts` |
| R10 | `R10: rejects with a not-found ApiError on 404 Booking not found` (`isNotFoundError` true) | unit | `tests/unit/api/bookings.test.ts` |
| R11 | `R11: notifies the session rejection on 401` y `does not call fetch without a token` | unit | `tests/unit/api/bookings.test.ts` |
| R4 | `R4: totalAmount` — 249999 × 2 = 499998; 12500 × 3 = 37500; 99.99 × 3 = 299.97 | unit | `tests/unit/domain/booking.test.ts` |
| R4, R9 | `R4: maps a booking with its launch` — `toBooking` de `booking-1`: misión, cohete, fecha, `durationMinutes`, `pricePerSeat`, `status`, `launch.id = activityId`, `createdAt` Date, `totalAmount`; nombre sin `" · "` → `rocket: null`, `mission` = nombre completo; fecha sin hora → medianoche local | unit | `tests/unit/domain/booking.test.ts` |
| R4 | `R4: sorts from the most recent booking` — por `createdAt` descendente, empate conserva el orden de entrada, no muta la entrada | unit | `tests/unit/domain/booking.test.ts` |
| R5 | `it.each` `R5: paymentStatusLabel(%s)` → "Pendiente de pago", "Pagada", "Reembolsada" | unit | `tests/unit/domain/booking.test.ts` |
| R4 | `formatDate` → "4 de noviembre de 2026"; `formatSeatCount(1)` "1 plaza", `(3)` "3 plazas" | unit | `tests/unit/domain/format.test.ts` |
| R5 | `R5: shows the label of each payment status` | componente | `tests/unit/features/bookings/PaymentStatusBadge.test.tsx` |
| R3 | `R3: shows "Cargando tus reservas…" while waiting and sends the token` — `fetch` diferido; `role="status"`; URL sin `activityId`; cabecera `Authorization` | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R4 | `R4: shows each booking from the most recent` — datos del criterio (lista en orden API `booking-1`, `booking-2`): primer artículo "Vuelo Suborbital" con "Cohete: New Shepard", "miércoles, 10 de febrero de 2027, 16:00", "3 plazas", "37.500,00 €", "Reservada el 4 de noviembre de 2026", "Pagada"; segundo "Misión Luna", "2 plazas", "499.998,00 €", "Reservada el 3 de noviembre de 2026"; `R4: shows "1 plaza"`; `R4: shows the full name without rocket` | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R5 | `R5: shows pending, paid and refunded in the list` | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R6 | `R6: shows the empty state with the link to /lanzamientos` | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R7 | `R7: shows the server error and retries` (500 `Failed to retrieve bookings` → texto de servidor + "Reintentar"; al pulsar con 200, lista); `R7: shows the network error` (`fetch` rechaza); `shows the contract error` | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R8 | `R8: opens the booking detail from the list` — clic en "Misión Luna" → ruta `/reservas/booking-1`, "Cargando reserva…", petición `GET /bookings/booking-1` con token | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R11 | `R11: goes to /acceso with the notice on 401` (ruta `/acceso?volver=%2Freservas`, aviso, `localStorage` sin sesión) y `R11: does not request bookings with an expired session` (`expiresAt` pasado → misma ruta, `fetch` no llamado) | componente | `tests/unit/features/bookings/MyBookingsPage.test.tsx` |
| R9 | `R9: shows the booking and its launch` — `booking-1` con lanzamiento `cancelled`: "Misión Luna", "Cohete: Falcon 9", "Cabo Cañaveral, Florida (EE. UU.)", "lunes, 15 de marzo de 2027, 14:30", "3 días", "249.999,00 € por plaza", "2 plazas", "499.998,00 €", "Reservada el 3 de noviembre de 2026", "Pagada", "Cancelado"; enlaces "Ver lanzamiento" (`/lanzamientos/activity-1`) y "Volver a mis reservas" (`/reservas`) | componente | `tests/unit/features/bookings/BookingDetailPage.test.tsx` |
| R5 | `R5: shows the payment status in the detail` (`pending`, `refunded`) | componente | `tests/unit/features/bookings/BookingDetailPage.test.tsx` |
| R8 | `R8: shows "Cargando reserva…" while waiting` | componente | `tests/unit/features/bookings/BookingDetailPage.test.tsx` |
| R10 | `R10: shows "No encontramos esta reserva." without retry` (404) | componente | `tests/unit/features/bookings/BookingDetailPage.test.tsx` |
| R7 | `R7: shows the server error with retry in the detail` (500 `Failed to retrieve booking`) y red caída | componente | `tests/unit/features/bookings/BookingDetailPage.test.tsx` |
| R11 | `R11: goes to /acceso?volver=%2Freservas%2Fbooking-1 on 401` | componente | `tests/unit/features/bookings/BookingDetailPage.test.tsx` |
| R1 | `R1: shows "Mis reservas" to /reservas with a session` y `R1: hides it without a session` | componente | `tests/unit/components/Layout.test.tsx` |
| R2 | `R2: redirects /reservas/booking-3 to /acceso without requesting it` (ruta `/acceso?volver=%2Freservas%2Fbooking-3`, `fetch` no llamado) | componente | `tests/unit/App.test.tsx` |

### End-to-end (Playwright, Chromium y Firefox, API interceptada)

Fichero `tests/e2e/my-bookings.spec.ts`; `mockBookings` (+ `mockLogin` en R2, `mockActivities` cuando se navega a `/lanzamientos`); `page.clock.setFixedTime('2026-11-06T10:00:00Z')`; `timezoneId: 'UTC'`, `locale: 'es-ES'`; sesión con `seedSession(page, sessionValue())` salvo en R2. Ninguna petición sale a la API real (puerto 3999 sin servidor). Como la app corre en `StrictMode`, se comprueba "alguna petición" o "la última", no un recuento exacto.

| Requisito | Test |
|---|---|
| R1 | `R1: shows "Mis reservas" in the header with a session` (en `/lanzamientos`, `href="/reservas"`) y `R1: hides it without a session` |
| R2 | `R2: redirects to /acceso and returns to the booking after signing in` (`/reservas/booking-3` → `/acceso?volver=%2Freservas%2Fbooking-3`, sin `GET /bookings/booking-3`; login correcto → `/reservas/booking-3` con el detalle) |
| R2 (F3) | `F3: after signing out, /reservas goes to /acceso` (desde `/reservas` pulsar "Cerrar sesión" → `/lanzamientos`; abrir `/reservas` → `/acceso?volver=%2Freservas`) |
| R3 | `R3: shows "Cargando tus reservas…" and sends the token without activityId` (respuesta retenida; `authorization` = `Bearer ${ANA_TOKEN}`; `searchParams` sin `activityId`) |
| R4 | `R4: lists the bookings from the most recent` (criterio completo, orden de los artículos) |
| R5 | `R5: shows pending, paid and refunded in the list and in the details` |
| R6 | `R6: shows the empty state` (enlace "Ver lanzamientos", `exact: true`, a `/lanzamientos`) |
| R7 | `R7: retries after a server error` (1.º intento 500, 2.º 200) y `R7: shows the network error` (`'abort'`) |
| R8 | `R8: opens the detail from the list` (URL `/reservas/booking-1`, petición con token, "Cargando reserva…" con respuesta retenida) |
| R9 | `R9: shows the booking detail with the current launch status` (`booking-1` con `activity.status: 'cancelled'`) |
| R10 | `R10: shows the not found message for booking-99` (sin "Reintentar"; enlace "Volver a mis reservas") |
| R11 (F4) | `R11: goes to /acceso when the API rejects the token` (401 `Invalid or expired token. Please login again.` → `/acceso?volver=%2Freservas`, aviso, cabecera "Iniciar sesión", `readStoredSession` = `null`) y `R11: does not request bookings with an expired session` (`expiresAt` pasado; `mockBookings` sin peticiones) |

## Tareas

- [x] **T1** — Esquemas y recurso de reservas (B1, B2). · Requisitos: R3, R7, R8, R10, R11 · Ficheros: `tests/unit/api/bookings.test.ts`, `src/api/schemas.ts`, `src/api/bookings.ts`.
  - Verificación: `npm test -- tests/unit/api`; `npm run typecheck`.
- [x] **T2** — Dominio y formato (B3–B7). · Requisitos: R4, R5, R9 · Ficheros: `tests/unit/domain/{booking,format}.test.ts`, `src/domain/booking.ts`, `src/domain/format.ts`, `src/domain/launch.ts` (exportar `parseLaunchDate`), `src/domain/api-errors.ts` (exportar `BOOKING_NOT_FOUND_TEXT`), `tests/unit/support/bookings.ts`.
  - `launch.test.ts` y `api-errors.test.ts` deben seguir en verde sin cambios.
  - Verificación: `npm test -- tests/unit/domain`.
- [x] **T3** — Etiqueta de estado y hooks (B7, B8). · Requisitos: R5, R3, R8 · Ficheros: `tests/unit/features/bookings/PaymentStatusBadge.test.tsx`, `src/features/bookings/{PaymentStatusBadge.tsx,use-my-bookings.ts,use-booking.ts}`; borrar `src/features/bookings/.gitkeep`.
  - Verificación: `npm test -- tests/unit/features/bookings`; `npm run lint`.
- [x] **T4** — Rutas protegidas y cabecera (B11, B12). · Requisitos: R1, R2, R11 · Ficheros: `tests/unit/components/Layout.test.tsx`, `src/components/Layout.tsx`, `tests/unit/App.test.tsx`, `src/App.tsx`, `tests/unit/support/session.tsx` (rutas `reservas` y `reservas/:id` en `renderApp`).
  - Para que compile, `MyBookingsPage` y `BookingDetailPage` se crean aquí como esqueleto mínimo (solo `<h1>`) y se completan en T5 y T6.
  - Los tests existentes de `Layout`, `RequireAuth`, `SessionProvider` y `App` deben seguir en verde.
  - Verificación: `npm test -- tests/unit/components tests/unit/App.test.tsx tests/unit/features/session`.
- [x] **T5** — `MyBookingsPage` y `BookingCard` (B9). · Requisitos: R3, R4, R5, R6, R7, R8 (enlace), R11 · Ficheros: `tests/unit/features/bookings/MyBookingsPage.test.tsx`, `src/features/bookings/{MyBookingsPage,BookingCard}.tsx`, `src/styles/global.css`.
  - Verificación: `npm test -- tests/unit/features/bookings`; `npm run lint`.
- [x] **T6** — `BookingDetailPage` y `BookingNotFound` (B10). · Requisitos: R5, R7, R8, R9, R10, R11 · Ficheros: `tests/unit/features/bookings/BookingDetailPage.test.tsx`, `src/features/bookings/{BookingDetailPage,BookingNotFound}.tsx`, `src/styles/global.css`.
  - Verificación: `npm test`; `npm run lint`.
- [x] **T7** — E2E (B14). · Requisitos: R1–R11 (+ F3, F4) · Ficheros: `tests/e2e/fixtures/api-mock.ts` (`mockBookings`), `tests/e2e/fixtures/data.ts` (`bookingDtos`, errores), `tests/e2e/fixtures/locators.ts` (`bookingCard`), `tests/e2e/my-bookings.spec.ts`.
  - Verificación: `npx.cmd playwright test tests/e2e/my-bookings.spec.ts --project=chromium`.
- [x] **T8** — Verificación final. · Requisitos: R1–R11 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Ejecutar en orden: `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa: regresión + `my-bookings`).
  - **No** usar `npm run test:e2e -- --project=chromium` (el script ya fija los dos proyectos). Firefox lo ejecuta **la persona**: `npx.cmd playwright test --project=firefox`.
  - Comprobar: sin `console.log`, código comentado, `any` ni `as T` sobre datos de red; ningún componente llama a `fetch`; ninguna credencial real en tests; `git status` sin ficheros no previstos.
  - Prueba manual opcional (persona) contra el fork: **no hay reservas sembradas** (`db/bookings.json` = `[]`). Para ver datos reales: iniciar sesión en la app (usuario semilla `user-1` de `db/users.json` o uno registrado), copiar el token de `localStorage["astrobookings.session"]` y crear reservas con `POST http://localhost:3000/bookings` `{ "activityId": "activity-1", "participants": 2 }` y `{ "activityId": "activity-3", "participants": 1 }` (importes no múltiplos de 1000, sin 402). Después: `/reservas` (lista ordenada, "Pagada"), detalle, `/reservas/booking-99` (404) y una reserva de otro usuario (404). Escribe en `db/bookings.json` y `db/payments.json` del fork. Alternativa: esperar a `feat-booking-creation`.

## Desviaciones durante la implementación

Ninguna cambia el comportamiento pedido por la spec.

| # | Desviación | Motivo |
|---|---|---|
| D1 | `tests/unit/support/bookings.ts` (`bookingDto`, `suborbitalBookingDto`, `bookedActivity`, `bookingFromDto`) se crea en T1, no en T2. | Los tests de T1 ya necesitan los DTO de reserva. |
| D2 | Los tests unitarios no usan `exact: true` en `getByRole`. | Testing Library no tiene esa opción en `getByRole` (error de tipos); un `name` de tipo texto ya se compara de forma exacta. En los e2e (Playwright) sí se usa `exact: true`. |
| D3 | En el detalle, los datos de la reserva van en una `<section>` con `<h2>Tu reserva</h2>` y el importe se rotula "Importe total: …". `BookingCard` y el detalle envuelven la fecha de la reserva en `<time dateTime>`. | Presentación y accesibilidad; los textos de la spec se siguen encontrando por subcadena. |
| D4 | `BookingCard` y la lista reutilizan las clases `launch-card`, `launch-card__title` y `launch-list`; en `global.css` solo se añaden `.payment-status*`, `.booking-detail` y `.site-header nav` (flex con hueco, para separar "Lanzamientos" y "Mis reservas"). | El plan pedía reutilizar estilos; la cabecera necesitaba separar los dos enlaces. |
| D5 | E2E: `mockBookings` devuelve `{ requests: { url, authorization }[] }`; se exportan `defaultBookingsHandler` y `bookingIdOf` (para retener solo el detalle en R8). `data.ts` añade `findBookingDto` y el error `failedToRetrieveBooking` (500 del detalle, P10). | Reutilizar el manejador por defecto desde los tests. |
| D6 | Tests añadidos sobre el plan: unitarios de esquemas (`paymentId` opcional, estado de lanzamiento desconocido, `bookingDtoSchema` sin `activity`), `paymentStatus` ausente → `ContractError`, misión sin cohete en el detalle; e2e `R4: orders the four bookings of the API by booking date`, `R4: shows only the full name for a launch without rocket` y `R7: shows the server error with retry in the detail`. | Cubrir casos límite de la spec. |

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] `npm run build` en verde
- [x] Tests e2e de la spec en verde (Chromium agente, Firefox persona) — Chromium 125/125 y Firefox 125/125
- [x] CHANGELOG actualizado

## Puntos a decidir

La persona ha delegado las decisiones de esta spec: el plan aplica la recomendación. Ninguna cambia el producto de forma importante.

| # | Tema | Ambigüedad | Decisión aplicada |
|---|---|---|---|
| P1 | Forma de `Booking` | ADD §4.2 declara `launch?` y `totalAmount?` opcionales (para cubrir el 201 de `POST /bookings`). | Obligatorios (B3): `Booking` solo se construye desde las respuestas enriquecidas; `feat-booking-creation` usa el `id` del DTO del 201 para navegar (ADR-011). Si esa spec necesitara un `Booking` sin lanzamiento, se añadirá allí un tipo aparte. Se anota en el ADD al cerrar (lo hace `8-dev-ops`/`architect` si se acepta). |
| P2 | Empates en el orden | R4 ordena por fecha de reserva; no dice qué hacer con fechas iguales. La API devuelve orden de inserción. | Orden estable: se conserva el orden de la API (B6). |
| P3 | Qué es "pulsar una reserva" | R8 dice "pulsa una reserva de la lista"; el criterio pulsa "Misión Luna". | El título (misión) de cada tarjeta es el enlace, igual que en `LaunchCard` (B9). La tarjeta completa no es clicable. |
| P4 | Encabezado de "no encontrada" | R10 solo fija el texto y el enlace. | `<h1>Reserva no encontrada</h1>` + texto + enlace, igual que `LaunchNotFound` (B10). |
| P5 | Cómo se rotula el estado del lanzamiento en el detalle | R9 pide "su estado actual" ("Cancelado"); en la misma página aparece el estado del pago. | Etiquetas explícitas: "Estado del lanzamiento: Cancelado" y la etiqueta de pago "Pagada" dentro de la sección de la reserva. Los tests buscan los textos de la spec por subcadena. Sin `BookabilityNotice` (no se reserva desde aquí). |
| P6 | Posición del enlace "Mis reservas" | R1 dice "en la cabecera". | En `<nav aria-label="Principal">` tras "Lanzamientos" (ADD §5.1). |
| P7 | `createdAt` inválido | ADD usa `z.string()`; una fecha no parseable mostraría "Invalid Date". | `isoDateString` (B1): se trata como respuesta inesperada (R7). |
| P8 | Lanzamiento en `draft` dentro de una reserva | La API permite reservar `draft` por llamada directa (riesgo R1); el detalle de lanzamiento lo trata como "no encontrado". | La reserva se muestra igual con estado "Borrador"; "Ver lanzamiento" lleva a `LaunchNotFound`. Sin lógica extra. |
| P9 | Destello del error de sesión antes de redirigir (R11) | Tras el 401 la página pasa por `error` antes de que `RequireAuth` redirija. | Se acepta (B12); el resultado final es el de la spec. Si se viera feo en la prueba manual, se puede ocultar el error `unauthorized` en las páginas protegidas (cambio pequeño, a decidir por la persona). |
| P10 | 500 del detalle con texto distinto | El fork responde `Failed to retrieve booking` (singular) en el detalle. | No se añade a `KNOWN_API_MESSAGES`: cualquier 5xx ya da el texto de servidor. Test unitario con ese literal. |
| P11 | *Smoke* contra la API real | ADD §9 describe un recorrido que reserva. | Sin *smoke* aquí (B15); prueba manual opcional en T8 creando reservas por API. |
| P12 | Importe mostrado frente al cobrado | La API guarda `amount` en el pago pero no lo expone; el importe se calcula con el precio actual (riesgo R6 aceptado en la spec). | Se calcula en el cliente (`totalAmount`); sin aviso en pantalla. |
