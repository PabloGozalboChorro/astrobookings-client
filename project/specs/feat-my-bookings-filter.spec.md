# feat: Filtro de "Mis reservas" por lanzamiento

- **Estado:** Aprobada
- **PRD:** F19
- **Rama:** `feat/my-bookings-filter`
- **Depende de:** `feat-my-bookings`
- **Prioridad:** Could

## Contexto
Una persona con varias reservas puede querer ver solo las de un lanzamiento. La API admite `?activityId=`, pero para construir la lista de opciones hace falta conocer todas las reservas, así que se pide `GET /bookings` una vez y se filtra en el cliente (ADR-009). El filtro vive en la URL (`?lanzamiento=<activityId>`) para sobrevivir a recargas y al botón "Atrás".

## Alcance
- **Incluido:**
  - Componente `BookingFilter` en `/reservas` y parámetro de URL `lanzamiento`.
- **Excluido:**
  - Filtros por estado o por fecha; búsqueda por texto en reservas.
  - Uso del parámetro `activityId` de la API.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Donde la persona tenga al menos una reserva, el sistema deberá mostrar en `/reservas` un selector "Filtrar por lanzamiento" con la opción "Todos los lanzamientos" seguida de una opción por cada lanzamiento distinto de sus reservas, con el nombre completo del lanzamiento y en orden alfabético. |
| R2 | Cuando la persona elija un lanzamiento, el sistema deberá poner `?lanzamiento=<activityId>` en la URL y mostrar solo las reservas de ese lanzamiento sin hacer una nueva petición a la API. |
| R3 | Cuando la persona elija "Todos los lanzamientos", el sistema deberá quitar `lanzamiento` de la URL y mostrar todas sus reservas. |
| R4 | Cuando la persona abra o recargue `/reservas?lanzamiento=<activityId>` con un lanzamiento presente en sus reservas, el sistema deberá mostrar ese lanzamiento elegido en el selector y aplicar el filtro. |
| R5 | Si el valor de `lanzamiento` de la URL no corresponde a ninguna de sus reservas, entonces el sistema deberá mostrar "Todos los lanzamientos" en el selector y todas las reservas. |
| R6 | Si la persona no tiene ninguna reserva, entonces el sistema deberá ocultar el selector y mostrar solo el mensaje de vacío de `feat-my-bookings`. |

## Criterios de aceptación
### R1
- **Dado** la API devuelve tres reservas: dos de `activity-1` ("Falcon 9 · Misión Luna") y una de `activity-3` ("New Shepard · Vuelo Suborbital")
- **Cuando** la persona abre `/reservas`
- **Entonces** el selector `getByRole('combobox', { name: 'Filtrar por lanzamiento' })` tiene, en este orden, "Todos los lanzamientos", "Falcon 9 · Misión Luna" y "New Shepard · Vuelo Suborbital", con "Todos los lanzamientos" elegido

### R2
- **Dado** esas tres reservas en `/reservas`
- **Cuando** la persona elige "Falcon 9 · Misión Luna"
- **Entonces** la URL es `/reservas?lanzamiento=activity-1`, se ven las dos reservas de "Misión Luna" y ninguna de "Vuelo Suborbital", y solo se ha hecho una petición `GET /bookings` en total

### R3
- **Dado** la persona en `/reservas?lanzamiento=activity-1`
- **Cuando** elige "Todos los lanzamientos"
- **Entonces** la URL es `/reservas` y se ven las tres reservas

### R4
- **Dado** esas tres reservas
- **Cuando** la persona abre `/reservas?lanzamiento=activity-3` (o vuelve a ella con "Atrás")
- **Entonces** el selector muestra "New Shepard · Vuelo Suborbital" y solo se ve esa reserva

### R5
- **Dado** esas tres reservas
- **Cuando** la persona abre `/reservas?lanzamiento=activity-99`
- **Entonces** el selector muestra "Todos los lanzamientos" y se ven las tres reservas

### R6
- **Dado** la API devuelve `[]`
- **Cuando** la persona abre `/reservas`
- **Entonces** no hay selector "Filtrar por lanzamiento" y se ve "Todavía no tienes reservas."

## Casos límite
- Una sola reserva o un solo lanzamiento: el selector se muestra igualmente con dos opciones (R1).
- Lanzamiento sin `" · "`: la opción usa el nombre completo ("Paseo Lunar Express").
- Valor de filtro inexistente (R5).
- Sin reservas (R6).
- Error al cargar las reservas: no se muestra el selector; se muestra el error de `feat-my-bookings` R7.

## Fuera de la spec / notas
- El orden alfabético usa `localeCompare` con `es` (sin distinguir mayúsculas).
- Las reservas filtradas conservan el orden de `feat-my-bookings` R4.
