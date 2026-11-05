# feat: Detalle de lanzamiento y reservabilidad

- **Estado:** Aprobada
- **PRD:** F8, F11 (+ D3, D4, V5; partes de F17 y F18)
- **Rama:** `feat/launch-detail`
- **Depende de:** `feat-launch-list`
- **Prioridad:** Must

## Contexto
Antes de reservar, la persona necesita ver todos los datos de un lanzamiento, incluido el mínimo de viajeros para que se confirme (F8), y saber si se puede reservar y, si no, por qué (F11). La API no impide reservar en lanzamientos agotados, cancelados, realizados, en borrador o con fecha pasada (riesgo R1 del ADD), así que la regla la aplica el cliente: solo son reservables los `published` y `confirmed` con fecha futura (D3, D4). Un borrador abierto por URL directa se trata como no encontrado (V5).

## Alcance
- **Incluido:**
  - Página `/lanzamientos/:id` (`LaunchDetailPage`) con `getActivity(id)` y `use-launch`.
  - Regla `getBookability(launch, now)` y textos `bookabilityReasonText` (ADD §6).
  - Aviso `BookabilityNotice` en el detalle y el motivo de no reservable en las tarjetas del listado (`LaunchCard`).
- **Excluido:**
  - El formulario de reserva y los enlaces de acceso para reservar (`feat-booking-creation`).

## Textos de no reservable (ADD §6)

Prioridad del motivo cuando hay varios: `draft` > `cancelled` > `done` > `sold-out` > `past-date`.

| Motivo | Texto |
|---|---|
| `sold-out` | Agotado: no quedan plazas |
| `done` | Este lanzamiento ya se ha realizado |
| `cancelled` | Este lanzamiento se ha cancelado |
| `past-date` | La fecha de este lanzamiento ya ha pasado |
| `draft` | No disponible |

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Cuando la persona abra `/lanzamientos/<id>`, con o sin sesión, el sistema deberá pedir `GET /activities/<id>` y mostrar el indicador `role="status"` con "Cargando lanzamiento…" hasta recibir la respuesta. |
| R2 | El sistema deberá mostrar en el detalle la misión como encabezado de nivel 1, el cohete (si lo hay), el identificador legible, el lugar de despegue, la fecha y hora, la duración, el precio por plaza, las plazas totales, el mínimo de viajeros para confirmar el lanzamiento, el texto del estado y un enlace "Volver a los lanzamientos". |
| R3 | Si la API responde 404 al pedir el lanzamiento, entonces el sistema deberá mostrar "Este lanzamiento no existe o ya no está disponible." y un enlace "Ver todos los lanzamientos", sin botón "Reintentar". |
| R4 | Si el lanzamiento recibido está en estado `draft`, entonces el sistema deberá mostrar la misma pantalla de no encontrado que en R3, sin ninguno de sus datos. |
| R5 | Si la carga del detalle falla por red, servidor o respuesta inesperada, entonces el sistema deberá mostrar el mensaje correspondiente con el botón "Reintentar". |
| R6 | El sistema deberá considerar reservable un lanzamiento solo si su estado es `published` o `confirmed` y su fecha es estrictamente posterior al momento actual. |
| R7 | Donde el lanzamiento no sea reservable, el sistema deberá mostrar en el detalle el texto del motivo de mayor prioridad y no ofrecer ninguna opción para reservar. |
| R8 | Donde un lanzamiento del listado no sea reservable, el sistema deberá mostrar en su tarjeta el texto del motivo de mayor prioridad. |

## Criterios de aceptación
### R1
- **Dado** la API simulada tarda en responder a `GET /activities/activity-1`
- **Cuando** una persona sin sesión abre `/lanzamientos/activity-1`
- **Entonces** ve `role="status"` con "Cargando lanzamiento…" y después el detalle

### R2
- **Dado** la API devuelve `activity-1` y `TZ=UTC`
- **Cuando** se muestra el detalle
- **Entonces** se ve el encabezado de nivel 1 "Misión Luna", "Cohete: Falcon 9", "Identificador: falcon-9-mision-luna", "Cabo Cañaveral, Florida (EE. UU.)", "lunes, 15 de marzo de 2027, 14:30", "3 días", "249.999,00 € por plaza", "6 plazas en total", "Mínimo de viajeros para confirmar el lanzamiento: 2", "Abierto a reservas" y el enlace "Volver a los lanzamientos" a `/lanzamientos`
- **Y** con `activity-8` ("Paseo Lunar Express") no aparece "Cohete:"

### R3
- **Dado** la API responde 404 `{ "message": "Activity not found", "errors": [] }` a `GET /activities/activity-99`
- **Cuando** la persona abre `/lanzamientos/activity-99`
- **Entonces** ve "Este lanzamiento no existe o ya no está disponible.", el enlace "Ver todos los lanzamientos" a `/lanzamientos` y ningún botón "Reintentar"

### R4
- **Dado** la API devuelve 200 con `activity-7` ("Vega · Prueba de Sistemas", `draft`)
- **Cuando** la persona abre `/lanzamientos/activity-7`
- **Entonces** ve "Este lanzamiento no existe o ya no está disponible." y la página no contiene "Prueba de Sistemas"

### R5
- **Dado** la petición `GET /activities/activity-1` se aborta
- **Cuando** la persona abre `/lanzamientos/activity-1`
- **Entonces** ve el mensaje de red caída con "Reintentar"; si la API responde 500, ve "Se ha producido un error en el servidor. Inténtalo de nuevo más tarde."

### R6
- **Dado** `now = 2026-11-05T10:00:00.000Z`
- **Cuando** se evalúa la reservabilidad en test unitario
- **Entonces** `activity-1` (`published`, 2027-03-15) y `activity-2` (`confirmed`, 2027-06-01) son reservables; `activity-9` (`published`, 2026-10-01) no lo es con motivo `past-date`; un `published` con fecha exactamente igual a `now` no lo es (`past-date`) y uno con fecha 1 ms posterior sí
- **Y** `activity-4` da `sold-out`, `activity-5` `cancelled`, `activity-6` (`done`, fecha pasada) `done` y `activity-7` `draft`

### R7
- **Dado** el reloj del navegador fijado en `2026-11-05T10:00:00Z`
- **Cuando** la persona abre `/lanzamientos/activity-4` ("Soyuz · Estación Orbital"), `/lanzamientos/activity-5`, `/lanzamientos/activity-6` y `/lanzamientos/activity-9`
- **Entonces** ve, respectivamente, "Agotado: no quedan plazas", "Este lanzamiento se ha cancelado", "Este lanzamiento ya se ha realizado" y "La fecha de este lanzamiento ya ha pasado", y en ninguno hay campo "Número de plazas" ni botón "Reservar"
- **Y** en `/lanzamientos/activity-1` no aparece ningún aviso de no reservable

### R8
- **Dado** el reloj del navegador fijado en `2026-11-05T10:00:00Z` y el listado con los 8 lanzamientos visibles
- **Cuando** se muestra `/lanzamientos`
- **Entonces** la tarjeta "Ventana Perdida" (`activity-9`) muestra "La fecha de este lanzamiento ya ha pasado", la de "Estación Orbital" muestra "Agotado: no quedan plazas", y las de "Misión Luna", "Órbita Marciana", "Vuelo Suborbital" y "Paseo Lunar Express" no muestran motivo

## Casos límite
- Identificador inexistente (`activity-99`) o con forma inesperada (`/lanzamientos/xyz`): 404 de la API → no encontrado (R3).
- Borrador por URL directa (R4, V5).
- Fecha igual al momento actual: no reservable (R6).
- `published` con fecha pasada (`activity-9`) y `done` con fecha pasada (`activity-6`): gana el motivo de mayor prioridad (`done`) (R6).
- Estados no reservables con fecha futura: `sold-out`, `cancelled` (R7).
- Red caída, 500 (R5).

## Fuera de la spec / notas
- `now` se inyecta en `getBookability` para poder probarlo; los e2e fijan el reloj con `page.clock` para que la semilla de 2027 no deje de ser futura con el paso del tiempo.
- La reservabilidad se calcula al mostrar la página; no se recalcula si la persona la deja abierta y pasa la fecha (se acepta).
