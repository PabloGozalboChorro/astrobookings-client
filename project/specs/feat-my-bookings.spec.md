# feat: Mis reservas y detalle de reserva

- **Estado:** Aprobada
- **PRD:** F14, F15, F16 (+ e2e de F3 y F4; partes de F17 y F18)
- **Rama:** `feat/my-bookings`
- **Depende de:** `feat-user-session`, `feat-launch-list` (formato y nombre de lanzamiento)
- **Prioridad:** Must

## Contexto
La persona con sesión necesita consultar sus reservas y su estado (O4). La API devuelve solo las reservas de quien tiene sesión, cada una con los datos de su lanzamiento, pero no el importe: se calcula como precio por plaza × plazas (PRD §7). El estado de la reserva es el del pago (`pending`, `paid`, `refunded`) y debe mostrarse con un texto comprensible (F16). Una reserva que no existe o que no es de la persona da 404 y se trata como "no encontrada" (F15).

Esta spec crea las primeras rutas protegidas reales, por lo que incluye también los e2e de cierre de sesión (F3) y de sesión rechazada (F4) sobre ellas. La página de detalle de reserva es la que usará `feat-booking-creation` para la confirmación (ADR-011).

## Alcance
- **Incluido:**
  - Rutas protegidas `/reservas` (`MyBookingsPage`) y `/reservas/:id` (`BookingDetailPage`).
  - Recursos `getMyBookings()` (`GET /bookings`, sin `activityId`) y `getBooking(id)`, esquema `bookingWithActivityDtoSchema`, mapeo `toBooking`, `totalAmount`, `paymentStatusLabel`, `PaymentStatusBadge`, `formatDate`.
  - Enlace "Mis reservas" en la cabecera con sesión.
- **Excluido:**
  - Filtro por lanzamiento (`feat-my-bookings-filter`).
  - Crear reservas y bloque de confirmación (`feat-booking-creation`).
  - Cancelar reservas o pedir reembolsos (la API no lo permite).

## Textos del estado de la reserva (F16)

| `paymentStatus` | Texto |
|---|---|
| `pending` | Pendiente de pago |
| `paid` | Pagada |
| `refunded` | Reembolsada |

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Mientras haya sesión válida, el sistema deberá mostrar en la cabecera el enlace "Mis reservas" a `/reservas`. |
| R2 | Si una persona sin sesión válida abre `/reservas` o `/reservas/<id>`, entonces el sistema deberá llevarla a `/acceso?volver=<ruta>` y, tras iniciar sesión, devolverla a esa ruta. |
| R3 | Cuando la persona con sesión abra `/reservas`, el sistema deberá pedir `GET /bookings` con su token, mostrando "Cargando tus reservas…" con `role="status"` mientras espera. |
| R4 | El sistema deberá mostrar cada reserva con el nombre del lanzamiento (cohete y misión), la fecha y hora del lanzamiento, las plazas, el importe total (precio por plaza × plazas), la fecha de la reserva y el texto de su estado, ordenadas de la más reciente a la más antigua por fecha de reserva. |
| R5 | El sistema deberá mostrar el estado de cada reserva con el texto de la tabla de estados para `pending`, `paid` y `refunded`. |
| R6 | Si la persona no tiene reservas, entonces el sistema deberá mostrar "Todavía no tienes reservas." y un enlace "Ver lanzamientos" a `/lanzamientos`. |
| R7 | Si la carga de las reservas o del detalle falla por red, servidor o respuesta inesperada, entonces el sistema deberá mostrar el mensaje correspondiente con el botón "Reintentar". |
| R8 | Cuando la persona pulse una reserva de la lista, el sistema deberá abrir `/reservas/<id>` y pedir `GET /bookings/<id>`, mostrando "Cargando reserva…" mientras espera. |
| R9 | El sistema deberá mostrar en el detalle de una reserva su fecha, plazas, importe total y estado, y del lanzamiento asociado la misión, el cohete, el lugar, la fecha y hora, la duración, el precio por plaza, su estado actual y el enlace "Ver lanzamiento" a `/lanzamientos/<activityId>`, junto al enlace "Volver a mis reservas". |
| R10 | Si la API responde 404 al pedir una reserva, entonces el sistema deberá mostrar "No encontramos esta reserva." y el enlace "Volver a mis reservas", sin botón "Reintentar". |
| R11 | Si `GET /bookings` o `GET /bookings/<id>` responde 401, entonces el sistema deberá aplicar el flujo de sesión rechazada (`feat-user-session` R11 y R12). |

## Criterios de aceptación
### R1
- **Dado** una sesión válida de "ana"
- **Cuando** abre `/lanzamientos`
- **Entonces** la cabecera muestra el enlace "Mis reservas" a `/reservas`; sin sesión, no aparece

### R2
- **Dado** una persona sin sesión
- **Cuando** abre `/reservas/booking-3`
- **Entonces** está en `/acceso?volver=%2Freservas%2Fbooking-3`, no se ha pedido `GET /bookings/booking-3` y, tras iniciar sesión correctamente, llega a `/reservas/booking-3`
- **Y** (F3) si "ana" pulsa "Cerrar sesión" y después abre `/reservas`, llega a `/acceso?volver=%2Freservas`

### R3
- **Dado** una sesión válida con token `T` y la API simulada que tarda en responder
- **Cuando** la persona abre `/reservas`
- **Entonces** ve `role="status"` con "Cargando tus reservas…" y la petición `GET /bookings` lleva `Authorization: Bearer T` y no lleva `activityId`

### R4
- **Dado** `TZ=UTC` y la API devuelve dos reservas: `booking-1` (`activity-1` "Falcon 9 · Misión Luna", precio 249999, `participants` 2, `createdAt` `2026-11-03T09:00:00.000Z`, `paid`) y `booking-2` (`activity-3` "New Shepard · Vuelo Suborbital", precio 12500, `participants` 3, `createdAt` `2026-11-04T18:00:00.000Z`, `paid`)
- **Cuando** se muestra `/reservas`
- **Entonces** aparece primero "Vuelo Suborbital" con "Cohete: New Shepard", "miércoles, 10 de febrero de 2027, 16:00", "3 plazas", "37.500,00 €", "Reservada el 4 de noviembre de 2026" y "Pagada", y después "Misión Luna" con "2 plazas", "499.998,00 €" y "Reservada el 3 de noviembre de 2026"
- **Y** una reserva de 1 plaza muestra "1 plaza"; un lanzamiento sin `" · "` muestra solo su nombre completo

### R5
- **Dado** tres reservas con `paymentStatus` `pending`, `paid` y `refunded`
- **Cuando** se muestran en la lista y en sus detalles
- **Entonces** se leen "Pendiente de pago", "Pagada" y "Reembolsada"

### R6
- **Dado** la API devuelve `[]`
- **Cuando** la persona abre `/reservas`
- **Entonces** ve "Todavía no tienes reservas." y el enlace "Ver lanzamientos" a `/lanzamientos`

### R7
- **Dado** la API responde 500 `{ "message": "Failed to retrieve bookings", "errors": [] }` a `GET /bookings`
- **Cuando** la persona abre `/reservas`
- **Entonces** ve `role="alert"` con "Se ha producido un error en el servidor. Inténtalo de nuevo más tarde." y "Reintentar"; al pulsarlo con la API ya correcta, ve sus reservas
- **Y** con la petición abortada ve el mensaje de red caída

### R8
- **Dado** la lista con `booking-1`
- **Cuando** la persona pulsa en "Misión Luna"
- **Entonces** la URL es `/reservas/booking-1`, se pide `GET /bookings/booking-1` con el token y se ve "Cargando reserva…" mientras llega

### R9
- **Dado** la API devuelve `booking-1` cuyo lanzamiento `activity-1` tiene ahora estado `cancelled`
- **Cuando** se muestra `/reservas/booking-1`
- **Entonces** se ve "Misión Luna", "Cohete: Falcon 9", "Cabo Cañaveral, Florida (EE. UU.)", "lunes, 15 de marzo de 2027, 14:30", "3 días", "249.999,00 € por plaza", "2 plazas", "499.998,00 €", "Reservada el 3 de noviembre de 2026", "Pagada", el estado del lanzamiento "Cancelado", el enlace "Ver lanzamiento" a `/lanzamientos/activity-1` y el enlace "Volver a mis reservas" a `/reservas`

### R10
- **Dado** la API responde 404 `{ "message": "Booking not found", "errors": [] }` a `GET /bookings/booking-99` (no existe o es de otra persona)
- **Cuando** la persona abre `/reservas/booking-99`
- **Entonces** ve "No encontramos esta reserva.", el enlace "Volver a mis reservas" y ningún botón "Reintentar"

### R11
- **Dado** una sesión de "ana" en `localStorage` y la API que responde 401 `{ "message": "Invalid or expired token. Please login again.", "errors": [] }` a `GET /bookings`
- **Cuando** la persona abre `/reservas`
- **Entonces** llega a `/acceso?volver=%2Freservas`, ve "Tu sesión ha caducado o no es válida. Inicia sesión de nuevo.", la cabecera muestra "Iniciar sesión" y `localStorage` no contiene la sesión
- **Y** con una sesión cuyo `expiresAt` ya ha pasado, abrir `/reservas` lleva al mismo resultado sin que se haga ninguna petición `GET /bookings`

## Casos límite
- Sin reservas (R6).
- Reserva de otra persona o inexistente: 404 → "No encontramos esta reserva." (R10).
- Sesión caducada (localmente) o rechazada por la API (401) (R11).
- 500 porque una reserva apunta a un lanzamiento borrado (riesgo R5 del ADD): error con "Reintentar" (R7).
- Lanzamiento asociado cancelado o realizado: se muestra su estado actual (R9).
- Importe con decimales: `totalAmount` redondea a 2 decimales (por ejemplo, precio 99.99 × 3 = "299,97 €").
- Estado `pending` (reserva sin estado guardado) y `refunded` (nunca lo asigna la API, pero se sabe mostrar) (R5).

## Fuera de la spec / notas
- El importe se calcula con el precio **actual** del lanzamiento, no con el cobrado (la API guarda `amount` en el pago pero no lo expone). Si el proveedor cambia el precio, el importe mostrado puede no coincidir con el cobrado (riesgo R6 del ADD, aceptado).
- `formatDate` usa `es-ES` con fecha larga ("4 de noviembre de 2026").
- No se puede cancelar una reserva desde la app (fuera de alcance).
