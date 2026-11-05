# feat: Listado de lanzamientos

- **Estado:** Aprobada
- **PRD:** F5 (+ D1, D2, D3, D7, D8; partes de F17 y F18)
- **Rama:** `feat/launch-list`
- **Depende de:** `chore-project-scaffolding`, `feat-error-handling` (datos de demostración: `chore-seed-space-launches`)
- **Prioridad:** Must

## Contexto
Cualquier persona, con o sin sesión, debe poder ver los lanzamientos que se ofrecen con la información necesaria para decidir (O2). La API no tiene campo de cohete (se obtiene del nombre, D1), no expone plazas disponibles (se muestran las totales, D2) y devuelve también los borradores, que no se deben mostrar (D3).

## Alcance
- **Incluido:**
  - Página `/lanzamientos` (`LaunchListPage`) con una tarjeta por lanzamiento (`LaunchCard`), que sustituye a la página provisional del scaffolding.
  - Esquema `activityDtoSchema`, recurso `getActivities()` sin parámetros, mapeo `toLaunch`, `parseLaunchName`, `isVisible` y formatos `formatPrice`, `formatDateTime`, `formatDuration` (ADD §6).
  - Texto del estado del lanzamiento.
  - Estados de carga, error y vacío de la página.
  - Fixtures de e2e (`tests/e2e/fixtures/data.ts`, `api-mock.ts`) con los 9 lanzamientos de `chore-seed-space-launches` en forma de DTO.
- **Excluido:**
  - Búsqueda y ordenación (`feat-launch-search-sort`).
  - Página de detalle y motivo de no reservable (`feat-launch-detail`).
  - Reserva (`feat-booking-creation`).

## Textos del estado del lanzamiento

| `status` | Texto |
|---|---|
| `published` | Abierto a reservas |
| `confirmed` | Confirmado |
| `sold-out` | Agotado |
| `done` | Realizado |
| `cancelled` | Cancelado |

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Cuando la persona abra `/lanzamientos`, con o sin sesión, el sistema deberá pedir `GET /activities` y mostrar una tarjeta por cada lanzamiento recibido que no esté en estado `draft`, en el orden en que los devuelve la API. |
| R2 | El sistema deberá mostrar en cada tarjeta la misión como título (enlace a `/lanzamientos/<id>`), el cohete, el lugar de despegue, la fecha y hora, la duración, el precio por plaza en euros, las plazas totales y el texto del estado. |
| R3 | El sistema deberá obtener cohete y misión dividiendo el nombre por la primera aparición de `" · "` (espacio, U+00B7, espacio), recortando espacios de ambas partes. |
| R4 | Si el nombre no contiene `" · "` o una de sus partes queda vacía, entonces el sistema deberá mostrar el nombre completo como misión y no mostrar la línea de cohete. |
| R5 | El sistema deberá mostrar el precio con formato `es-ES` en euros con dos decimales (`249999` → "249.999,00 €") y la fecha con día de la semana, fecha larga y hora en la zona horaria del navegador ("lunes, 15 de marzo de 2027, 14:30"). |
| R6 | El sistema deberá mostrar la duración como "N min" si es menor de 60 minutos, "H h M min" (omitiendo "0 min") si es menor de 1440, y "D día(s) H h" (omitiendo "0 h" y los minutos sobrantes) a partir de 1440. |
| R7 | Mientras se cargan los lanzamientos, el sistema deberá mostrar el indicador `role="status"` con el texto "Cargando lanzamientos…". |
| R8 | Si la API responde sin ningún lanzamiento visible (lista vacía o solo borradores), entonces el sistema deberá mostrar "No hay lanzamientos disponibles en este momento." |
| R9 | Si la carga del listado falla, entonces el sistema deberá mostrar el mensaje de error correspondiente (red caída, servidor o respuesta inesperada) con el botón "Reintentar", que vuelve a pedir el listado. |
| R10 | Mientras la ventana tenga 375 px de ancho, el sistema deberá mostrar el listado completo sin desplazamiento horizontal. |

## Criterios de aceptación
### R1
- **Dado** la API simulada devuelve los 9 lanzamientos de la semilla (incluido `activity-7`, "Vega · Prueba de Sistemas", en `draft`)
- **Cuando** una persona sin sesión abre `/lanzamientos`
- **Entonces** ve 8 tarjetas en el orden recibido, ninguna con "Prueba de Sistemas", y se ha hecho una sola petición `GET /activities` sin parámetros de consulta

### R2
- **Dado** la API devuelve `activity-1`
- **Cuando** se muestra el listado
- **Entonces** su tarjeta tiene el título enlazado "Misión Luna" (a `/lanzamientos/activity-1`), "Cohete: Falcon 9", "Cabo Cañaveral, Florida (EE. UU.)", "lunes, 15 de marzo de 2027, 14:30", "3 días", "249.999,00 € por plaza", "6 plazas en total" y "Abierto a reservas"

### R3
- **Dado** los nombres "Starship · Órbita Marciana" y "Falcon 9 · Misión · Luna"
- **Cuando** se dividen
- **Entonces** el primero da cohete "Starship" y misión "Órbita Marciana", y el segundo cohete "Falcon 9" y misión "Misión · Luna"

### R4
- **Dado** la API devuelve `activity-8` "Paseo Lunar Express" y un lanzamiento con nombre "Falcon 9 · " (misión vacía)
- **Cuando** se muestra el listado
- **Entonces** la tarjeta de `activity-8` tiene el título "Paseo Lunar Express" y no contiene "Cohete:", y la del segundo tiene como título el nombre completo "Falcon 9 ·" sin línea de cohete
- **Y** en test unitario, `parseLaunchName("Falcon 9 · ")` devuelve cohete `null` y misión igual al nombre recibido

### R5
- **Dado** `TZ=UTC` y los lanzamientos `activity-3` (12500) y `activity-2` (1249999, `2027-06-01T09:00:00.000Z`)
- **Cuando** se formatean
- **Entonces** los precios son "12.500,00 €" y "1.249.999,00 €" y la fecha de `activity-2` es "martes, 1 de junio de 2027, 9:00" (los tests normalizan el espacio no separable antes de "€")

### R6
- **Dado** las duraciones 11, 90, 180, 1440, 1501, 2880 y 259200 minutos
- **Cuando** se formatean
- **Entonces** se muestran "11 min", "1 h 30 min", "3 h", "1 día", "1 día 1 h", "2 días" y "180 días"

### R7
- **Dado** la API simulada tarda en responder
- **Cuando** la persona abre `/lanzamientos`
- **Entonces** ve `role="status"` con "Cargando lanzamientos…" y, al llegar la respuesta, el indicador desaparece y aparecen las tarjetas

### R8
- **Dado** la API devuelve `[]` (o solo `activity-7` en `draft`)
- **Cuando** la persona abre `/lanzamientos`
- **Entonces** ve "No hay lanzamientos disponibles en este momento." y ninguna tarjeta

### R9
- **Dado** la petición `GET /activities` se aborta (red caída)
- **Cuando** la persona abre `/lanzamientos`
- **Entonces** ve `role="alert"` con "No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo." y el botón "Reintentar"
- **Y** si la API responde después correctamente y la persona pulsa "Reintentar", ve las 8 tarjetas
- **Y** si la API responde 500 `Failed to retrieve activities`, ve "Se ha producido un error en el servidor. Inténtalo de nuevo más tarde."; si responde 200 con `[{ "id": 1 }]`, ve "El servidor ha devuelto una respuesta inesperada."

### R10
- **Dado** una ventana de 375 × 812 px y los 8 lanzamientos visibles
- **Cuando** se muestra el listado
- **Entonces** `document.documentElement.scrollWidth` no supera `clientWidth` y todas las tarjetas son visibles al desplazarse en vertical

## Casos límite
- 0 resultados o solo borradores: mensaje de vacío (R8).
- Nombre sin `" · "` (`activity-8`), con varias apariciones o con una parte vacía (R3, R4).
- Fecha sin hora (`"2027-10-26"`): se acepta y se muestra con la hora 0:00 de la zona del navegador.
- Precio de 4 cifras (`2500`): `es-ES` no agrupa y se muestra "2500,00 €" (comportamiento de `Intl`, no es error).
- Lanzamientos con fecha pasada o no reservables: se muestran con su texto de estado; el motivo de no reservable lo añade `feat-launch-detail`.
- Red caída, 500, respuesta con forma inesperada (R9).

## Fuera de la spec / notas
- Los e2e interceptan `http://localhost:3999/**` con los fixtures; cualquier petición no interceptada falla.
- Las plazas son las totales (`maxParticipants`); las disponibles no se conocen hasta un rechazo por capacidad (D2).
