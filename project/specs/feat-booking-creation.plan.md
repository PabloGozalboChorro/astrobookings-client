# Plan: feat-booking-creation

- **Spec:** [feat-booking-creation.spec.md](feat-booking-creation.spec.md)
- **Rama:** `feat/booking-creation`
- **Estado:** Aprobado por delegación de la persona (decisiones C1–C16 y P1–P14 tal como las fija este plan). Quedan abiertas las preguntas marcadas como **abierta** en [Puntos a decidir](#puntos-a-decidir); ninguna bloquea la implementación.

## Revisión de la spec

La spec encaja con el PRD (F9, F10, F12, F13, F18; D2, D9, V4; e2e de F3; partes de F17) y con el ADD (§3 estructura: `api/bookings.ts` `createBooking()`, `features/bookings/{BookingForm,use-create-booking}`, `LaunchDetailPage` como contenedor; §4.1 endpoint 5; §5.1 ruta `/lanzamientos/:id` pública con reserva protegida y `/reservas/:id` con `state.justCreated`; §5.3 401 global; §5.4 flujo de reserva; ADR-011; riesgos R2 y R3). Se reutiliza lo que ya hay en `main` tras `feat-launch-detail`, `feat-user-session`, `feat-user-registration` y `feat-my-bookings`:

- `http(path, schema, { method: 'POST', body, auth: true })`: serializa el cuerpo, añade `Authorization: Bearer <token>`; sin token válido (también si la sesión guardada ha caducado: `readStoredAccessToken` comprueba `expiresAt`) **no llama a `fetch`**, notifica `onSessionRejected` y lanza `ApiError` `unauthorized`; con 401 notifica igual. `SessionProvider.expireSession` borra la sesión y activa el aviso.
- `ApiError` con `kind` (`classifyApiError`: 400 con `errors[]` → `validation`; 400 que empieza por `Capacity exceeded` → `capacity`; 401; 402 → `payment`; 404 → `not-found`), `fieldErrors` y `availableSeats` (ya calculado con `parseAvailableSeats` en `toApiError`).
- `toUserMessage`: `capacity` → "Solo quedan X plazas libres." / "Solo queda 1 plaza libre." / "No quedan plazas libres en este lanzamiento." / "No hay plazas suficientes para tu solicitud."; `Payment could not be processed` → texto de pago de R11; `Activity not found` → `LAUNCH_NOT_FOUND_TEXT`; 5xx → texto de servidor; `NetworkError`, `ContractError`. `fieldErrorMessage('participants', …)` ya devuelve "Introduce un número entero de plazas mayor o igual que 1." y `activityId` → "El lanzamiento indicado no es válido.".
- `bookingDtoSchema` (ya definido en `feat-my-bookings` para este uso), `getBooking`, `toBooking`, `totalAmount`, `formatPrice`, `formatSeatCount`, `PaymentStatusBadge`, `BookingDetailPage` + `use-booking`.
- `getBookability`, `useNow`, `BookabilityNotice` en `LaunchDetailPage` (no reservable → sin formulario, `feat-launch-detail` R7).
- `useSession`, `loginPath`, `registerPath` (`domain/session.ts`), `SessionExpiredNotice` (Layout y `LoginPage` ya lo pintan con `expiredNotice`).
- `FormField` (label, `aria-invalid`, `aria-describedby` con el error junto al campo), `ErrorMessage` (`role="alert"`), patrón `inFlight` de `LoginPage`/`RegisterPage` y de `register-form.ts` (`registerErrorFeedback`).
- Helpers de test: `tests/unit/support/{http,deferred,session,bookings,activities}`; e2e `tests/e2e/fixtures/{api-mock,data,session,locators}.ts` (`mockActivities`, `mockBookings`, `holdResponses`, `bookingIdOf`, `mockLogin`, `seedSession`, `sessionValue`, `ANA_TOKEN`, `readStoredSession`, `findLaunchDto`, `bookingWithActivity`).

No se añade ninguna dependencia.

Huecos y ambigüedades: ver [Puntos a decidir](#puntos-a-decidir). Ninguno cambia el producto de forma importante; el plan aplica la recomendación (delegado por la persona).

### Contrato real de la API (fork `activity-bookings-express`, `master` en `7f69493`)

| Aspecto | Comportamiento | Evidencia |
|---|---|---|
| Ruta | `POST /bookings` con `authenticateToken`; `express.json()` y CORS abiertos. | `src/index.ts:16-17`, `:30`; `src/routes/bookings.ts:98` |
| Orden de comprobaciones | 1) token (401) → 2) validación del cuerpo (400) → 3) lanzamiento existe (404) → 4) capacidad (400) → 5) cobro simulado (402) → 6) guarda pago y reserva (201). | `src/routes/bookings.ts:98-118`; `src/services/booking.service.ts:40-87` |
| Autenticación (401) | Sin token → `{ message: 'Authentication required. Please provide a valid token.', errors: [] }`; token inválido/caducado → `{ message: 'Invalid or expired token. Please login again.', errors: [] }`. | `src/middleware/auth.middleware.ts:11-39` |
| Validación (400) | `{ message: 'Validation failed', errors: [...] }`. `activityId` vacío/no string → `{ field: 'activityId', message: 'Activity ID is required and must be a non-empty string' }`; `participants` no número o `< 1` → `{ field: 'participants', message: 'Participants is required and must be a positive number (at least 1)' }`. Cuerpo no objeto → `field: 'body'`. **Acepta decimales** (1,5 pasa). | `src/services/booking.service.ts:187-210` |
| 404 | `{ message: 'Activity not found', errors: [] }`. | `src/routes/bookings.ts:126-128` |
| Capacidad (400) | Disponibles = `maxParticipants` − suma de `participants` de **todas** las reservas del lanzamiento (`max(0, …)`). Si `participants > disponibles` → `{ message: 'Capacity exceeded. Available: X, Requested: Y', errors: [] }` (siempre con número; X puede ser 0). | `src/services/booking.service.ts:51-54`, `:101-112`; `src/routes/bookings.ts:129-131` |
| Pago (402) | `amount = price × participants`; la pasarela simulada **falla si `amount % 1000 === 0`** → 402 `{ message: 'Payment could not be processed', errors: [] }`; no se crea pago ni reserva (se consume un número de id, sin efecto visible). Con la semilla solo afecta a `activity-3` (12 500 €) con N **par** (2, 4, 6); N impar (1, 3, 5) se cobra. | `src/services/mock-payment-gateway.ts:288-296`; `src/services/payment.service.ts:237-251` |
| Otros fallos | Cualquier otra excepción → **400** (no 500) `{ message: 'Failed to create booking', errors: [] }`. | `src/routes/bookings.ts:122-142` |
| 201 | `Booking` **sin** `activity`: `{ id: 'booking-N', activityId, userId: 'user-N', participants, createdAt: ISO, paymentId: 'payment-N', paymentStatus: 'paid' }` (siempre `paid` al crear). Encaja con `bookingDtoSchema`. | `src/services/booking.service.ts:66-86` |
| Estado del lanzamiento | La API **no** comprueba estado ni fecha: reserva `draft`, `sold-out`, `cancelled`, `done` o pasados por llamada directa. La única barrera es el cliente (`getBookability`, `feat-launch-detail` R7). | `src/services/booking.service.ts:40-87` |
| Plazas disponibles | **Ningún endpoint las expone**: `GET /activities/:id` devuelve la actividad tal cual (`maxParticipants`), sin campo calculado. Solo se conocen por el mensaje de capacidad (D2). | `src/routes/activities.ts:146-156`; `src/services/activity.service.ts` |

Conclusiones: el endpoint, el 201 sin actividad (ADR-011), el 402, el 404, los 401 y el mensaje de capacidad coinciden con la spec y el ADD. Diferencias, ninguna cambia el producto:

- (a) El mensaje real del error de validación de `participants` es `Participants is required and must be a positive number (at least 1)`, no `Participants must be at least 1` como en el criterio de R12. No importa: el cliente traduce por **campo**. Los fixtures usan el literal real.
- (b) El fork nunca devuelve 500 en `POST /bookings`: los fallos internos son **400 `Failed to create booking`**, que hoy se mostraría como "No se ha podido completar la operación (Failed to create booking)". Se añade a `KNOWN_API_MESSAGES` como texto de servidor (C12, P6). El 500 de la spec se sigue cubriendo (proxy, caída del proceso) con el tratamiento genérico de 5xx.
- (c) El mensaje de capacidad siempre trae número; el caso "sin número" de R10 es solo robustez frente a cambios (riesgo R2 del ADD).
- (d) La API no impide reservar lanzamientos no reservables; sin cambio: el cliente no muestra el formulario (ya cubierto por `feat-launch-detail`).

### Impacto en lo existente

| Fichero | Cambio |
|---|---|
| `src/api/bookings.ts` | Añade `createBooking(request)` (C1). |
| `src/domain/api-errors.ts` | Añade `'Failed to create booking'` → texto de servidor en `KNOWN_API_MESSAGES` (C12). Sin otros cambios: el resto de textos ya existen. |
| `src/features/bookings/booking-form.ts` (nuevo) | Validación y traducción de errores del formulario (C3, C4, C11). |
| `src/features/bookings/use-create-booking.ts` (nuevo) | Envío con `inFlight` y navegación tras 201 o 401 (C5, C6). |
| `src/features/bookings/BookingForm.tsx` (nuevo) | Formulario de reserva (C7–C10). |
| `src/features/launches/BookingAccess.tsx` (nuevo) | Mensaje y enlaces sin sesión (C2). |
| `src/features/launches/LaunchDetailPage.tsx` | Con lanzamiento reservable: `BookingForm` con sesión o `BookingAccess` sin ella (C2). |
| `src/features/bookings/BookingDetailPage.tsx` | Bloque "Reserva confirmada" con `state.justCreated` y mensaje de R9 si falla la carga (C13, C14). |
| `src/styles/global.css` | Estilos mínimos de `.booking-form`, `.booking-access` y `.booking-confirmation`. |
| `tests/unit/features/launches/LaunchDetailPage.test.tsx` | `renderAt` envuelve en `SessionProvider` (la página pasa a usar `useSession`); los tests existentes deben seguir en verde sin cambiar sus aserciones. |
| `tests/unit/support/session.tsx` | `renderApp` admite la opción `launchDetail: true` para montar el `LaunchDetailPage` real en `lanzamientos/:id` (por defecto sigue el `LocationProbe`, del que dependen los tests de `LoginPage`/`RegisterPage`). |
| `tests/unit/support/bookings.ts` | `createdBookingDto(overrides)` (forma del 201). |
| `tests/e2e/fixtures/api-mock.ts` | `mockBookings` registra también `method` y `body` (C15). |
| `tests/e2e/fixtures/data.ts` | `createdBookingDto(...)` y errores `capacityExceeded(available, requested)`, `capacityExceededWithoutSeats`, `paymentFailed`, `bookingValidationFailed`, `failedToCreateBooking`. |

Los tests existentes de `LaunchDetailPage`, `BookingDetailPage`, `MyBookingsPage`, `Layout`, `LoginPage`, `RegisterPage` y todos los e2e deben seguir en verde. Ojo con nombres que se solapan: sin sesión, la cabecera ya tiene los enlaces "Iniciar sesión" y "Crear cuenta" **con el mismo `href`** que los de R2; los tests los buscan dentro de la región de reserva (`getByRole('region', { name: 'Reservar plazas' })`) o de `main`. "Ver mis reservas" (R8/R9) frente a "Volver a mis reservas" y "Mis reservas" (cabecera): en e2e, `exact: true`.

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| C1 | **Recurso** en `src/api/bookings.ts`: `type CreateBookingRequest = { activityId: string; participants: number }`; `createBooking(request)` = `http('/bookings', bookingDtoSchema, { method: 'POST', body: request, auth: true })`. Sin `signal`: una reserva enviada no se aborta al desmontar (podría quedar creada sin que la persona lo sepa). | R6; ADD §4.1 endpoint 5, §4.2. |
| C2 | **`LaunchDetailPage`**: si `bookability.bookable`, pinta `<section className="booking-section" aria-labelledby>` con `<h2>Reservar plazas</h2>` y dentro: con sesión `<BookingForm launch={launch} />`; sin sesión **`BookingAccess`** (`features/launches/BookingAccess.tsx`): `<p>Inicia sesión o crea una cuenta para reservar.</p>` y enlaces `<Link to={loginPath(currentPath)}>Iniciar sesión</Link>` y `<Link to={registerPath(currentPath)}>Crear cuenta</Link>` (`currentPath` = `pathname + search` con `useLocation`, igual que la cabecera). No reservable → solo `BookabilityNotice`, como ahora. | R1, R2; ADD §5.1, §5.4.1. `LoginPage`/`RegisterPage` ya devuelven a `volver` (R2, segunda parte). |
| C3 | **Validación** en `src/features/bookings/booking-form.ts` (patrón de `login-form.ts`): `parseParticipants(raw: string): number \| null` → `null` si `raw.trim() === ''` o `Number(raw)` no es entero seguro ≥ 1; `validateParticipants(raw, maxSeats)` → `{ ok: true; participants } \| { ok: false; error }` con `INVALID_PARTICIPANTS_TEXT` = "Introduce un número entero de plazas mayor o igual que 1." (se reutiliza la constante exportada desde `domain/api-errors.ts`, que ya contiene ese texto para el campo `participants`) o `maxSeatsText(max)` = "Puedes reservar como máximo N plazas." ("… 1 plaza." si N = 1). | R4, R5; AGENTS §7 (no duplicar el texto). Ver P2. |
| C4 | **Importe en vivo**: `participants = parseParticipants(value)`; `participants === null` → "Importe total: —"; si no, `Importe total: ${formatPrice(totalAmount(launch.pricePerSeat, participants))}` (también cuando supera el máximo). Se pinta en `<p aria-live="polite">`. | R3; ADD §5.4.2. Ver P1. |
| C5 | **Hook** `useCreateBooking()` (`features/bookings/use-create-booking.ts`): `inFlight = useRef(false)` y `const [submitting, setSubmitting] = useState(false)`; `submit(request): Promise<CreateBookingOutcome>` con `CreateBookingOutcome = { status: 'ignored' } \| { status: 'created' } \| { status: 'failed'; error: unknown }`. Si `inFlight.current` → `ignored` sin petición. Tras 201 → `navigate(\`/reservas/${encodeURIComponent(dto.id)}\`, { state: { justCreated: true } })`. | R7, R8; ADD §5.4.3, ADR-011. |
| C6 | **401** (respuesta 401 o sesión caducada antes de enviar: `http()` no llama a `fetch`): el error es `ApiError` `unauthorized` y `http()` ya ha llamado a `expireSession`. Como `/lanzamientos/:id` es pública (no hay `RequireAuth` que redirija), el hook navega a `loginPath(currentPath)` con `replace: false` y devuelve `failed`. `LoginPage` muestra el aviso (`expiredNotice`) y tras entrar vuelve al detalle. | R12 (segunda parte); ADD §5.3. Ver P5. |
| C7 | **`BookingForm`** (`features/bookings/BookingForm.tsx`, props `launch: Launch`): estado `value` (string, inicial `'1'`), `knownAvailableSeats: number \| null` (inicial `null`), `fieldError?: string`, `alert?: string`. `maxSeats = knownAvailableSeats ?? launch.totalSeats`. `<form noValidate>` (si no, el navegador bloquea el envío de 7 con `max=6` y no se ve el mensaje de R5) con `FormField` `label="Número de plazas"`, `type="number"`, `name="participants"`, `inputMode="numeric"`, `min={1}`, `step={1}`, `max={maxSeats}`; importe (C4); `ErrorMessage` sin "Reintentar" si hay `alert`; `<button type="submit" disabled={submitting \|\| knownAvailableSeats === 0}>{submitting ? 'Reservando…' : 'Reservar'}</button>`. | R1, R3, R7, R10; ADD §5.4.2. |
| C8 | **Envío**: `handleSubmit` hace `preventDefault`; si `submitting`/`inFlight` → nada; limpia `fieldError` y `alert`; `validateParticipants(value, maxSeats)` (si falla, `fieldError` y no llama a la API); si `knownAvailableSeats === 0` no envía (Intro con el botón deshabilitado no envía por sí mismo; esto es defensa extra). Si es válido → `submit({ activityId: launch.id, participants })`. | R4, R5, R6, R7. |
| C9 | **Resultado `failed`** → `bookingErrorFeedback(error)` (en `booking-form.ts`, patrón `registerErrorFeedback`): `validation` → `fieldError` = texto de `participants` y, si hay errores de otros campos (`activityId`, `body`), `alert` con sus textos; `capacity` → `alert` = `toUserMessage(error)` y `availableSeats` (si no es `null`, el formulario lo guarda en `knownAvailableSeats`); `unauthorized` → nada (ya se navega, C6); resto → `alert` = `toUserMessage(error)` (402, 404, servidor, red, contrato). El valor del campo **no** se toca en ningún error. | R10, R11, R12; F17. |
| C10 | **Plazas conocidas**: `knownAvailableSeats` solo cambia con un 400 de capacidad con número; un 400 sin número deja el máximo como estaba (6 en el criterio). Con X = 0 el campo queda con `max="0"` y "Reservar" deshabilitado. Dura lo que dura el componente (al recargar o volver a entrar, se pierde). | R10; D2. Ver P3. |
| C11 | Los mensajes (`alert`, `fieldError`) se mantienen hasta el siguiente envío; editar el campo no los borra. | R10, R11 (la persona cambia el número y vuelve a intentarlo). Ver P4. |
| C12 | **`Failed to create booking`** (400 del fork para fallos internos) → `SERVER_TEXT` en `KNOWN_API_MESSAGES`. | Diferencia (b) del contrato; F17 (error de servidor). Ver P6. |
| C13 | **Confirmación** en `BookingDetailPage`: `justCreated = isJustCreatedState(useLocation().state)` (guarda de tipo sin `as`: objeto no nulo con `justCreated === true`). Con `justCreated` y datos cargados, la sección de la reserva se pinta **justo después del `<h1>`** con `<h2>Reserva confirmada</h2>` (en lugar de "Tu reserva"), `<p>{launch.fullName}</p>` ("Falcon 9 · Misión Luna"), plazas, "Importe total: …", fecha de reserva, `PaymentStatusBadge` y `<Link to="/reservas">Ver mis reservas</Link>`. Sin `justCreated`, la página queda exactamente como hoy. | R8; ADR-011; V4. Ver P7. |
| C14 | **R9**: con `justCreated` y `state.status === 'error'` (cualquier error que no sea 401, incluido 404) → `ErrorMessage` con "Tu reserva se ha creado correctamente (referencia {id}), pero no hemos podido cargar sus datos." y "Reintentar" (`reload`), más `<p><Link to="/reservas">Ver mis reservas</Link></p>`. Sin `justCreated`, el comportamiento de error/404 actual no cambia. | R9. Ver P8. |
| C15 | **E2E**: `mockBookings` registra `{ method, url, authorization, body }` (`body` = `request.postDataJSON()` en `POST`, `null` en otro caso); los tests existentes solo leen `url` y `authorization`. Manejadores por test: `POST /bookings` según el caso y `GET /bookings/<id>` con la reserva enriquecida (`bookingWithActivity`). `data.ts`: `createdBookingDto(id, activityId, participants)` (forma del 201 del fork) y los errores con los literales del fork. `mockActivities` para el detalle; `mockLogin` en R2. | ADR-007; ADD §9; criterios R1–R12. |
| C16 | Tests unitarios en carpetas que reflejan `src/`: `tests/unit/api/bookings.test.ts`, `tests/unit/domain/api-errors.test.ts`, `tests/unit/features/bookings/{booking-form.test.ts,BookingForm.test.tsx,BookingDetailPage.test.tsx}`, `tests/unit/features/launches/LaunchDetailPage.test.tsx`. Los componentes se prueban con `fetch` mockeado (`mockFetchByUrl`) y sesión real en `localStorage` (`storeSession`), igual que en `feat-my-bookings`, para cubrir token, 401 y navegación sin mockear el módulo de API. `TZ=UTC`; reloj con `vi.useFakeTimers({ now, toFake: ['Date'] })`. | Skill `testing-unit-vitest`; ADD §9; desviación ya aceptada en planes anteriores. |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación. Nombres de test en inglés con el `Rn` delante.

### Unitarios y de componentes (Vitest, jsdom, `TZ=UTC`)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R6 | `R6: sends POST /bookings with the token and the JSON body` — URL `http://localhost:3999/bookings`, `method: 'POST'`, `Authorization: Bearer <token>`, cuerpo `{"activityId":"activity-1","participants":2}`; devuelve el DTO del 201 validado | unit | `tests/unit/api/bookings.test.ts` |
| R10 | `R10: rejects with a capacity ApiError with the available seats` (`Available: 2` → `availableSeats` 2; `Available: 0` → 0; sin número → `null`) | unit | `tests/unit/api/bookings.test.ts` |
| R11 | `R11: rejects with a payment ApiError on 402` | unit | `tests/unit/api/bookings.test.ts` |
| R12 | 404 `not-found`; 400 `validation` con `fieldErrors.participants`; 401 notifica la sesión rechazada; sin token no llama a `fetch`; 201 sin `id` → `ContractError` | unit | `tests/unit/api/bookings.test.ts` |
| R12 | `maps "Failed to create booking" to the server text` | unit | `tests/unit/domain/api-errors.test.ts` |
| R3, R4 | `it.each` `parseParticipants(%s)` — `'1'` → 1, `'2'` → 2, `''`, `' '`, `'0'`, `'-1'`, `'1.5'`, `'abc'` → `null` | unit | `tests/unit/features/bookings/booking-form.test.ts` |
| R4, R5 | `validateParticipants` — inválido → texto de R4; `'7'` con máximo 6 → "Puedes reservar como máximo 6 plazas."; máximo 1 → "… 1 plaza."; `'6'` con máximo 6 → válido | unit | `tests/unit/features/bookings/booking-form.test.ts` |
| R10–R12 | `bookingErrorFeedback` — capacidad (texto + `availableSeats`), validación (`participants` junto al campo; `activityId` en alerta), 402, 404, 5xx, red, 401 sin texto | unit | `tests/unit/features/bookings/booking-form.test.ts` |
| R1 | `R1: shows the booking form for a bookable launch with a session` — en `/lanzamientos/activity-1` (reloj `2026-11-05T10:00:00Z`): campo "Número de plazas" con valor 1, `min="1"`, `step="1"`, `max="6"`, botón "Reservar"; `R1: shows no form for activity-4 (sold-out)` | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R2 | `R2: shows the sign-in and sign-up links without a session` — texto, `href` `/acceso?volver=%2Flanzamientos%2Factivity-1` y `/registro?volver=%2Flanzamientos%2Factivity-1` dentro de la región "Reservar plazas", sin campo; `R2: shows no links for a non-bookable launch` | componente | `tests/unit/features/launches/LaunchDetailPage.test.tsx` |
| R3 | `R3: shows the live total amount` — 2 → "Importe total: 499.998,00 €"; 1 → "249.999,00 €"; vacío → "Importe total: —" | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |
| R4 | `it.each` `R4: rejects %s without calling the API` (vacío, 0, -1, 1.5) — texto junto al campo (`aria-describedby`, `aria-invalid`) y `fetch` sin `POST` | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |
| R5 | `R5: rejects 7 seats with max 6 without calling the API` | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |
| R6 | `R6: sends the booking with the session token` | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |
| R7 | `R7: sends a single request on double click and shows "Reservando…"` (respuesta diferida; botón deshabilitado; un solo `POST`) y `R7: sends a single request on double Enter` | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |
| R8 | `R8: goes to /reservas/booking-7 and shows the confirmation` — `renderApp(…, { launchDetail: true })`; "Reserva confirmada", "Falcon 9 · Misión Luna", "2 plazas", "Importe total: 499.998,00 €", "Pagada", enlace "Ver mis reservas" a `/reservas` | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |
| R8 | `R8: hides the confirmation without justCreated` (abrir `/reservas/booking-7` directamente → "Tu reserva", sin "Reserva confirmada") | componente | `tests/unit/features/bookings/BookingDetailPage.test.tsx` |
| R9 | `R9: shows the created reference when the detail fails` (500 tras `justCreated`) — texto exacto, "Ver mis reservas", "Reintentar" recarga | componente | `tests/unit/features/bookings/BookingDetailPage.test.tsx` |
| R10 | `R10: shows the free seats and lowers the max` (`Available: 2` → "Solo quedan 2 plazas libres.", `max="2"`; 3 → "Puedes reservar como máximo 2 plazas." sin nuevo `POST`); `R10: disables "Reservar" with no seats left` (`Available: 0`); `R10: keeps max 6 with an unexpected capacity text`; `R10: keeps the known max after a later error` (capacidad 2, luego 402 → `max="2"`) | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |
| R11 | `R11: shows the payment error and keeps the form` — `role="alert"` con el texto, campo en 2, "Reservar" habilitado; después 1 plaza → 201 → confirmación | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |
| R12 | `it.each` `R12: shows %s and enables "Reservar" again` (404, 400 validación junto al campo, 500, 400 `Failed to create booking`, red caída) | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |
| R12 | `R12: goes to /acceso with the notice on 401` (ruta `/acceso?volver=%2Flanzamientos%2Factivity-1`, aviso, `localStorage` sin sesión) y `R12: does not send the booking with an expired session` (reloj avanzado tras pintar el formulario; `fetch` sin `POST`; misma ruta) | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |

### End-to-end (Playwright, Chromium y Firefox, API interceptada)

Fichero `tests/e2e/booking-creation.spec.ts`; `mockActivities` + `mockBookings` (+ `mockLogin` en R2); `page.clock.setFixedTime('2026-11-05T10:00:00Z')`; `timezoneId: 'UTC'`, `locale: 'es-ES'`; sesión con `seedSession(page, sessionValue())` salvo en R2. Ninguna petición sale a la API real (puerto 3999 sin servidor). En `StrictMode` el detalle de reserva puede pedirse dos veces: se comprueban los `POST` (que no dependen de efectos) con recuento exacto y los `GET` como "alguna petición". Para escribir "1,5" se usa `pressSequentially` (Playwright no deja `fill` con texto no numérico en `type=number`); el resultado esperado es el mismo con independencia de cómo interprete el navegador la coma (valor vacío o 1.5).

| Requisito | Test |
|---|---|
| R1 | `R1: shows the booking form on a bookable launch` (valor 1, `min`, `step`, `max="6"`, "Reservar") y `R1: shows no form on activity-4` |
| R2 (F3) | `R2: asks to sign in and returns to the launch after signing in` (texto y `href` de los dos enlaces dentro de la región "Reservar plazas"; clic en "Iniciar sesión" → login correcto → `/lanzamientos/activity-1` con el formulario) y `F3: after signing out, the launch shows the links instead of the form` |
| R3 | `R3: updates the total amount` (2, 1, vacío, "1,5") |
| R4 | `R4: rejects invalid numbers without calling the API` (vacío, 0, -1, "1,5"; ningún `POST`) |
| R5 | `R5: rejects more seats than the max` |
| R6 | `R6: sends the booking with the token` (`method` `POST`, `authorization` `Bearer ${ANA_TOKEN}`, `body` `{ activityId: 'activity-1', participants: 2 }`) |
| R7 | `R7: sends a single booking on double click` (respuesta retenida con `holdResponses`; "Reservando…" deshabilitado; 1 `POST`) |
| R8 | `R8: shows the confirmation after booking` (URL `/reservas/booking-7`, textos del criterio, enlace "Ver mis reservas" `exact: true` a `/reservas`) y `R8: does not show the confirmation from my bookings` |
| R9 | `R9: shows the reference when the confirmation cannot load` |
| R10 | `R10: shows the free seats and limits the field` (`Available: 2`), `R10: disables booking with no seats left`, `R10: shows the generic capacity text` |
| R11 | `R11: shows the payment error on activity-3 and books 1 seat afterwards` (402 con 2 plazas; 201 con 1) |
| R12 | `R12: shows not found, validation, server and network errors` (uno por caso o `for` de casos) y `R12 (F4): goes to /acceso when the API rejects the token` (401 → `/acceso?volver=%2Flanzamientos%2Factivity-1`, aviso, `readStoredSession` = `null`) y `R12: does not send the booking with an expired session` (sesión con `expiresAt` = NOW + 1 min; tras pintar el formulario, `page.clock.setFixedTime(NOW + 2 min)`; ningún `POST`) |

## Tareas

- [x] **T1** — Recurso `createBooking` y texto de `Failed to create booking` (C1, C12). · Requisitos: R6, R10, R11, R12 · Ficheros: `tests/unit/api/bookings.test.ts`, `src/api/bookings.ts`, `tests/unit/domain/api-errors.test.ts`, `src/domain/api-errors.ts`, `tests/unit/support/bookings.ts` (`createdBookingDto`).
  - Verificación: `npm test -- tests/unit/api tests/unit/domain`; `npm run typecheck`.
- [x] **T2** — Lógica del formulario (C3, C4, C9). · Requisitos: R3, R4, R5, R10, R11, R12 · Ficheros: `tests/unit/features/bookings/booking-form.test.ts`, `src/features/bookings/booking-form.ts`, `src/domain/api-errors.ts` (exportar `INVALID_PARTICIPANTS_TEXT`).
  - Verificación: `npm test -- tests/unit/features/bookings/booking-form.test.ts`.
- [x] **T3** — Acceso sin sesión en el detalle (C2). · Requisitos: R1 (no reservable), R2 · Ficheros: `tests/unit/features/launches/LaunchDetailPage.test.tsx` (envolver en `SessionProvider`, tests nuevos), `src/features/launches/BookingAccess.tsx`, `src/features/launches/LaunchDetailPage.tsx`.
  - Para que compile, `BookingForm` se crea aquí como esqueleto (solo la sección vacía) y se completa en T4.
  - Los tests existentes de `LaunchDetailPage` deben seguir en verde.
  - Verificación: `npm test -- tests/unit/features/launches`.
- [x] **T4** — `use-create-booking` y `BookingForm` (C5–C11). · Requisitos: R1, R3, R4, R5, R6, R7, R10, R11, R12 · Ficheros: `tests/unit/features/bookings/BookingForm.test.tsx`, `src/features/bookings/{use-create-booking.ts,BookingForm.tsx}`, `tests/unit/support/session.tsx` (opción `launchDetail`), `src/styles/global.css`.
  - Verificación: `npm test -- tests/unit/features`; `npm run lint`.
- [x] **T5** — Confirmación en el detalle de la reserva (C13, C14). · Requisitos: R8, R9 · Ficheros: `tests/unit/features/bookings/{BookingDetailPage,BookingForm}.test.tsx`, `src/features/bookings/BookingDetailPage.tsx`, `src/styles/global.css`.
  - Los tests existentes de `BookingDetailPage` y `MyBookingsPage` deben seguir en verde.
  - Verificación: `npm test`; `npm run lint`.
- [x] **T6** — E2E (C15). · Requisitos: R1–R12 (+ F3, F4) · Ficheros: `tests/e2e/fixtures/api-mock.ts` (`method`, `body`), `tests/e2e/fixtures/data.ts` (`createdBookingDto`, errores), `tests/e2e/booking-creation.spec.ts`.
  - Verificación: `npx.cmd playwright test tests/e2e/booking-creation.spec.ts --project=chromium`.
- [x] **T7** — Verificación final. · Requisitos: R1–R12 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Ejecutar en orden: `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa: regresión + `booking-creation`).
  - **No** usar `npm run test:e2e -- --project=chromium` (el script ya fija los dos proyectos). Firefox lo ejecuta **la persona**: `npx.cmd playwright test --project=firefox`.
  - Comprobar: sin `console.log`, código comentado, `any` ni `as T` sobre datos de red o `location.state`; ningún componente llama a `fetch`; ninguna credencial real en tests; `git status` sin ficheros no previstos.
  - Prueba manual opcional (persona) contra el fork (`npm run dev` + fork en `:3000`): iniciar sesión, reservar 2 plazas en `activity-1` (confirmación, "Pagada"); reservar 2 en `activity-3` (402) y luego 1 (201); pedir más plazas de las que quedan en `activity-1` (p. ej. 5 tras haber reservado 2 → "Solo quedan 4 plazas libres."). Escribe en `db/bookings.json` y `db/payments.json` del fork.

## Desviaciones durante la implementación

Se rellena al implementar (`5-coder`/`6-tester`). Ninguna prevista.

| # | Desviación | Motivo |
|---|---|---|
| D1 | En `BookingForm.handleSubmit` la comprobación `knownAvailableSeats === 0` se hace **antes** de validar (C8 la ponía después) y sale sin tocar los mensajes. | Validar con máximo 0 mostraría "Puedes reservar como máximo 0 plazas." y borraría la alerta "No quedan plazas libres…". El botón ya está deshabilitado, así que no cambia el comportamiento visible. |
| D2 | El tipo `JustCreatedState` y la guarda `isJustCreatedState` (C13) viven en `src/features/bookings/use-create-booking.ts`, junto a quien crea el estado; `BookingDetailPage` los importa de ahí. | El plan no fijaba el módulo; así el emisor y el receptor del `state` comparten una sola definición. |
| D3 | La sección "Reservar plazas" se pinta en un componente interno `BookingSection` de `LaunchDetailPage.tsx` (dentro del `<article>`, tras el estado del lanzamiento). | Aísla `useSession`/`useId` del resto del detalle; sin cambio de comportamiento respecto a C2. |
| D4 | Los tests unitarios de R9 (y el de posición de "Reserva confirmada") recorren el flujo completo con `renderApp(…, { launchDetail: true })` en lugar de montar `/reservas/booking-7` con `state`. | `renderApp` recibe una ruta de texto; así se prueba además la navegación real tras el 201. |
| D5 | Tests añadidos sobre el plan de pruebas: unit `R9` con 404 tras `justCreated`, `R8` "Reserva confirmada" justo tras el `<h1>`, `R12` validación de la API como test propio (fuera del `it.each`); e2e `R12: shows the validation error next to the field` como test propio. El e2e `R8: does not show the confirmation from my bookings` entra por la tarjeta de `/reservas`. | Cubren C13/C14 y el criterio de R8 ("desde Mis reservas") de forma literal. |
| D6 | `global.css` añade también `.booking-section` (el plan citaba `.booking-form`, `.booking-access` y `.booking-confirmation`). | Margen y ancho de la sección contenedora. |

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] `npm run build` en verde
- [x] Tests e2e de la spec en verde (Chromium agente, Firefox persona) — Chromium 168/168 y Firefox 168/168
- [x] CHANGELOG actualizado

## Puntos a decidir

La persona ha delegado las decisiones de esta spec: el plan aplica la recomendación. Ninguna cambia el producto de forma importante. Las marcadas **abierta** conviene que la persona las confirme, pero no bloquean.

| # | Tema | Ambigüedad | Decisión aplicada |
|---|---|---|---|
| P1 | Importe con N mayor que el máximo | R3 dice "entero válido"; R5 rechaza N > máximo al enviar. | Se muestra el importe para cualquier entero ≥ 1 (también 7 con máximo 6); 0, negativos, decimales y vacío → "—" (C4). |
| P2 | Singular en R5 | "Puedes reservar como máximo 1 plazas." sería incorrecto. | "Puedes reservar como máximo 1 plaza." (C3); igual que `capacityMessage` ya usa "Solo queda 1 plaza libre.". |
| P3 | Campo con X = 0 | R10 pide `max` = X y deshabilitar "Reservar"; no dice nada del campo. | `max="0"` literal y botón deshabilitado; el campo sigue editable (C10). Mensaje "No quedan plazas libres en este lanzamiento." visible. |
| P4 | Cuándo desaparecen los mensajes | No se especifica. | Se mantienen hasta el siguiente envío (C11). |
| P5 | Sesión que caduca mientras se mira el detalle | El temporizador de `SessionProvider` cierra la sesión al llegar a `expiresAt`: el formulario se sustituye por los enlaces de R2 y la cabecera muestra el aviso, **sin** ir a `/acceso`. La spec solo exige la redirección al pulsar "Reservar". | Se acepta: la redirección solo ocurre al reservar (401 o caducada al enviar, C6). |
| P6 | `Failed to create booking` | El fork responde 400 (no 500) a los fallos internos de `POST /bookings`. | Se traduce como error de servidor (C12). |
| P7 | Dónde va "Reserva confirmada" | R8 pide el encabezado y el nombre completo "Falcon 9 · Misión Luna"; el detalle ya muestra misión y cohete por separado. | La sección de la reserva cambia su `<h2>` a "Reserva confirmada", sube tras el `<h1>` y añade el nombre completo y "Ver mis reservas" (C13); sin duplicar plazas ni importe. |
| P8 | Reintentar en R9 | R9 fija el texto y el enlace. | Se añade "Reintentar" (recarga `GET /bookings/:id`) además del enlace (C14). |
| P9 | `state.justCreated` tras recargar | En el navegador, `history.state` sobrevive a la recarga: recargar la confirmación vuelve a mostrar "Reserva confirmada". Desde "Mis reservas" no aparece (R8). | Se acepta (no se limpia el estado). |
| P10 | 201 con forma inesperada | La reserva se habría creado, pero se mostraría "El servidor ha devuelto una respuesta inesperada." y la persona podría repetirla. | Se acepta (riesgo bajo: Zod sobre `bookingDtoSchema`, cuya forma coincide con el fork). |
| P11 | Texto del error de validación | El criterio de R12 usa `Participants must be at least 1`; el fork dice `Participants is required and must be a positive number (at least 1)`. | Se traduce por campo; los fixtures usan el literal real. |
| P12 | Navegación tras 201 | `push` o `replace`. | `push`: "Atrás" vuelve al detalle del lanzamiento (C5). |
| P13 | *Smoke* contra la API real (**abierta**) | ADD §9 describe un recorrido (registro → listado → reservar 1 plaza en `activity-1` → Mis reservas) y el plan de `feat-my-bookings` lo aplazó a esta spec, pero la spec no lo pide. | No se incluye (sin spec no hay código). Propuesta: una `chore` aparte con el proyecto `smoke`. La persona decide si la quiere. |
| P14 | Estado del lanzamiento en la API (**abierta**, informativa) | El fork deja reservar lanzamientos `sold-out`, `cancelled`, `done`, `draft` o pasados. | Sin cambio: el cliente no muestra el formulario (`feat-launch-detail` R7) y "No se modifica el código de la API" (D2). Se anota como riesgo conocido. |
