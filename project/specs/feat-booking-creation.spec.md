# feat: Reserva de plazas y confirmación

- **Estado:** Aprobada
- **PRD:** F9, F10, F12, F13, F18 (+ D2, D9, V4; e2e de F3 "sin sesión no puede reservar"; partes de F17)
- **Rama:** `feat/booking-creation`
- **Depende de:** `feat-launch-detail`, `feat-user-session`, `feat-my-bookings` (página `/reservas/:id`, reutilizada para la confirmación); recomendable `feat-user-registration` (enlace "Crear cuenta")
- **Prioridad:** Must

## Contexto
Es el objetivo central del producto (O3): reservar N plazas en un lanzamiento reservable sin superar las disponibles. El cliente no conoce las plazas libres (D2): limita N a las plazas totales y, si la API rechaza la reserva por falta de plazas, muestra cuántas quedan según su mensaje ("Available: X") (F10). No hay límite propio por reserva (D9). La API acepta decimales, pero el cliente solo admite enteros ≥ 1 (F9). El pago es simulado y automático; si se rechaza (402), la reserva no se crea (F12). Tras el 201, la confirmación se muestra en `/reservas/:id` con los datos que devuelve la API (V4, ADR-011).

## Alcance
- **Incluido:**
  - `BookingForm` en `LaunchDetailPage` para lanzamientos reservables con sesión; enlaces de acceso sin sesión.
  - Recurso `createBooking()` (`POST /bookings`, autenticado) con `bookingDtoSchema` y hook `use-create-booking` (protección contra doble envío).
  - Bloque "Reserva confirmada" en `BookingDetailPage` cuando se llega desde una reserva recién creada.
  - Plazas disponibles conocidas tras un 400 de capacidad (estado local del formulario).
- **Excluido:**
  - Datos de pago (no se piden), cancelación, reintentos automáticos.
  - Aviso previo de importes múltiplos de 1000 (lógica de la pasarela simulada, riesgo R3 del ADD).

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Donde el lanzamiento sea reservable y haya sesión válida, el sistema deberá mostrar en el detalle un formulario con el campo numérico "Número de plazas" (valor inicial 1, mínimo 1, paso 1, máximo las plazas disponibles conocidas o, si no se conocen, las totales) y el botón "Reservar". |
| R2 | Donde el lanzamiento sea reservable y no haya sesión, el sistema deberá mostrar "Inicia sesión o crea una cuenta para reservar." con los enlaces "Iniciar sesión" y "Crear cuenta", ambos con `volver` a la ruta del detalle, en lugar del formulario. |
| R3 | Mientras el número de plazas sea un entero válido, el sistema deberá mostrar "Importe total: <precio por plaza × N en euros>", y "Importe total: —" en caso contrario. |
| R4 | Si la persona intenta reservar con el campo vacío, con un valor no entero o menor que 1, entonces el sistema deberá mostrar junto al campo "Introduce un número entero de plazas mayor o igual que 1." sin llamar a la API. |
| R5 | Si la persona intenta reservar más plazas que el máximo del campo, entonces el sistema deberá mostrar junto al campo "Puedes reservar como máximo <máximo> plazas." sin llamar a la API. |
| R6 | Cuando la persona pulse "Reservar" con un número válido, el sistema deberá enviar `POST /bookings` con `{ activityId, participants }` (`participants` entero) y el token de la sesión. |
| R7 | Mientras la reserva se esté enviando, el sistema deberá mostrar el botón deshabilitado con el texto "Reservando…" y descartar cualquier pulsación adicional, de modo que se envíe una sola petición. |
| R8 | Cuando la API responda 201, el sistema deberá llevar a la persona a `/reservas/<id>` y mostrar el bloque "Reserva confirmada" con el lanzamiento, las plazas, el importe total y el estado obtenidos de `GET /bookings/<id>`, y el enlace "Ver mis reservas". |
| R9 | Si tras el 201 la carga de `GET /bookings/<id>` falla, entonces el sistema deberá mostrar "Tu reserva se ha creado correctamente (referencia <id>), pero no hemos podido cargar sus datos." con el enlace "Ver mis reservas". |
| R10 | Si la API responde 400 por capacidad, entonces el sistema deberá mostrar el mensaje de plazas libres ("Solo quedan X plazas libres.", "No quedan plazas libres en este lanzamiento." o "No hay plazas suficientes para tu solicitud."), fijar el máximo del campo en X cuando X se conoce y deshabilitar "Reservar" cuando X es 0. |
| R11 | Si la API responde 402, entonces el sistema deberá mostrar "El pago no se ha podido procesar. La reserva no se ha realizado." y mantener el formulario con el número de plazas elegido para poder cambiarlo y volver a intentarlo. |
| R12 | Si la API responde 404, 400 de validación, 500 o no hay conexión, entonces el sistema deberá mostrar el mensaje correspondiente ("Este lanzamiento no existe o ya no está disponible.", error junto al campo, error del servidor o red caída) y volver a habilitar "Reservar"; si responde 401, deberá aplicar el flujo de sesión rechazada. |

## Criterios de aceptación
### R1
- **Dado** una sesión válida, el reloj fijado en `2026-11-05T10:00:00Z` y la API que devuelve `activity-1` ("Falcon 9 · Misión Luna", `maxParticipants` 6)
- **Cuando** la persona abre `/lanzamientos/activity-1`
- **Entonces** ve `getByLabelText('Número de plazas')` con valor 1, `min="1"`, `step="1"`, `max="6"` y el botón "Reservar"
- **Y** en `/lanzamientos/activity-4` (`sold-out`) no hay formulario (`feat-launch-detail` R7)

### R2
- **Dado** una persona sin sesión (o que acaba de cerrarla, F3)
- **Cuando** abre `/lanzamientos/activity-1`
- **Entonces** ve "Inicia sesión o crea una cuenta para reservar.", el enlace "Iniciar sesión" a `/acceso?volver=%2Flanzamientos%2Factivity-1`, el enlace "Crear cuenta" a `/registro?volver=%2Flanzamientos%2Factivity-1` y ningún campo "Número de plazas"
- **Y** tras iniciar sesión desde ese enlace vuelve a `/lanzamientos/activity-1` y ve el formulario

### R3
- **Dado** el formulario de `activity-1` (249 999 € por plaza)
- **Cuando** la persona escribe 2
- **Entonces** ve "Importe total: 499.998,00 €"; con 1 ve "Importe total: 249.999,00 €"; con el campo vacío o 1,5 ve "Importe total: —"

### R4
- **Dado** el formulario de `activity-1`
- **Cuando** la persona deja el campo vacío, o escribe 0, -1 o 1,5, y pulsa "Reservar"
- **Entonces** ve "Introduce un número entero de plazas mayor o igual que 1." asociado al campo y no se ha enviado `POST /bookings`

### R5
- **Dado** el formulario de `activity-1` con máximo 6
- **Cuando** la persona escribe 7 y pulsa "Reservar"
- **Entonces** ve "Puedes reservar como máximo 6 plazas." y no se ha enviado `POST /bookings`

### R6
- **Dado** una sesión con token `T` y el formulario de `activity-1`
- **Cuando** la persona escribe 2 y pulsa "Reservar"
- **Entonces** se envía `POST /bookings` con `Authorization: Bearer T` y el cuerpo `{ "activityId": "activity-1", "participants": 2 }`

### R7
- **Dado** la API simulada tarda en responder a `POST /bookings`
- **Cuando** la persona hace doble clic en "Reservar" (o pulsa Intro dos veces)
- **Entonces** se envía una sola petición y el botón muestra "Reservando…" deshabilitado hasta la respuesta

### R8
- **Dado** la API responde 201 `{ "id": "booking-7", "activityId": "activity-1", "userId": "user-2", "participants": 2, "createdAt": "2026-11-05T10:00:00.000Z", "paymentId": "payment-7", "paymentStatus": "paid" }` y después `GET /bookings/booking-7` devuelve la reserva con su lanzamiento
- **Cuando** la persona reserva 2 plazas en `activity-1`
- **Entonces** la URL es `/reservas/booking-7` y ve el encabezado "Reserva confirmada", "Falcon 9 · Misión Luna", "2 plazas", "Importe total: 499.998,00 €", "Pagada" y el enlace "Ver mis reservas" a `/reservas`
- **Y** si abre `/reservas/booking-7` desde "Mis reservas" (sin venir de crearla), no ve "Reserva confirmada"

### R9
- **Dado** `POST /bookings` responde 201 con `booking-7` y `GET /bookings/booking-7` responde 500
- **Cuando** la persona reserva
- **Entonces** ve "Tu reserva se ha creado correctamente (referencia booking-7), pero no hemos podido cargar sus datos." y el enlace "Ver mis reservas"

### R10
- **Dado** la API responde 400 `{ "message": "Capacity exceeded. Available: 2, Requested: 5", "errors": [] }`
- **Cuando** la persona pide 5 plazas en `activity-1`
- **Entonces** ve "Solo quedan 2 plazas libres.", el campo tiene `max="2"` y, si escribe 3 y pulsa "Reservar", ve "Puedes reservar como máximo 2 plazas." sin nueva petición
- **Y** con `Available: 0` ve "No quedan plazas libres en este lanzamiento." y "Reservar" está deshabilitado; con el mensaje `Capacity exceeded` sin número ve "No hay plazas suficientes para tu solicitud." y el máximo sigue en 6

### R11
- **Dado** la API responde 402 `{ "message": "Payment could not be processed", "errors": [] }` (caso de `activity-3`, "New Shepard · Vuelo Suborbital", 12 500 € con 2 plazas)
- **Cuando** la persona reserva 2 plazas en `activity-3`
- **Entonces** ve `role="alert"` con "El pago no se ha podido procesar. La reserva no se ha realizado.", sigue en `/lanzamientos/activity-3` con el campo en 2 y "Reservar" habilitado
- **Y** si cambia a 1 plaza y la API responde 201, llega a la confirmación

### R12
- **Dado** el formulario de `activity-1`
- **Cuando** la API responde 404 `Activity not found`, o 400 `Validation failed` con `errors: [{ "field": "participants", "message": "Participants must be at least 1" }]`, o 500, o la petición se aborta
- **Entonces** ve, respectivamente, "Este lanzamiento no existe o ya no está disponible.", "Introduce un número entero de plazas mayor o igual que 1." junto al campo, "Se ha producido un error en el servidor. Inténtalo de nuevo más tarde." y el mensaje de red caída, y "Reservar" vuelve a estar habilitado
- **Y** si la API responde 401, llega a `/acceso?volver=%2Flanzamientos%2Factivity-1` con el aviso de sesión caducada; si la sesión ya había caducado al pulsar "Reservar", ocurre lo mismo sin enviar `POST /bookings`

## Casos límite
- N no entero (1,5), 0, negativo o vacío (R4).
- N mayor que las plazas totales (R5) o que las disponibles conocidas tras un rechazo (R10).
- 400 de capacidad con "Available: 0" y con texto inesperado (R10).
- 402 por importe múltiplo de 1000 (R11).
- 404 porque el lanzamiento se ha borrado mientras la persona lo miraba (R12).
- Sesión caducada o rechazada al reservar (R12).
- Lanzamiento no reservable por estado o fecha: no hay formulario (R1, `feat-launch-detail` R7).
- Doble clic o doble Intro: una sola petición (R7).
- Reserva creada pero confirmación no cargada (R9).

## Fuera de la spec / notas
- Las plazas disponibles conocidas solo duran mientras la persona está en la página; al recargar se vuelve al máximo de plazas totales (D2).
- Sin límite propio de plazas por reserva (D9): el máximo del campo es el de la API.
- El enlace "Crear cuenta" de R2 apunta a `/registro`, que existe desde `feat-user-registration`.
- Los e2e fijan el reloj del navegador (`page.clock`) para que los lanzamientos de 2027 sean futuros.
