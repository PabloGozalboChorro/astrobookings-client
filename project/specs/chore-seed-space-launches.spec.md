# chore: Semilla de lanzamientos espaciales en el fork de la API

- **Estado:** Aprobada
- **PRD:** D5 (apoya F5, F8, F10, F11, F12; ADD §8, V6)
- **Rama:** `chore/seed-space-launches` (**en el repositorio del fork de `activity-bookings-express`, no en este**)
- **Depende de:** ninguna
- **Prioridad:** Must

## Contexto
La API de ejemplo trae actividades que no son viajes espaciales (yoga, surf, cocina…) y con fechas de 2026 ya pasadas. Para poder usar y demostrar el cliente hace falta un catálogo de lanzamientos que siga la convención de nombre `"<Cohete> · <Misión>"` (D1), que tenga fechas futuras y que incluya casos de cada estado, una fecha pasada, un nombre sin cohete y un precio que provoque el pago rechazado (V6).

La API carga `db/seed/activities.json` y después `db/activities.json`, y los datos guardados **sustituyen a la semilla por `id`**. Por eso, además de cambiar la semilla, hay que vaciar los datos guardados (ADD §8, riesgo R4). Una reserva que apunte a una actividad inexistente hace que `GET /bookings` devuelva 500 (riesgo R5), así que también se vacían reservas y pagos.

**Importante:** este cambio se aplica en el repositorio del fork de la API (`activity-bookings-express`), en una rama propia. En este repositorio (cliente) no se modifica ningún fichero por esta spec. Es un cambio **solo de datos**: no se toca código de la API.

## Alcance
- **Incluido:**
  - Sustituir el contenido de `db/seed/activities.json` por los 9 lanzamientos de la tabla de datos de esta spec.
  - Dejar `db/activities.json`, `db/bookings.json` y `db/payments.json` con el contenido `[]`.
- **Excluido:**
  - Cualquier cambio de código de la API (`src/`), de `db/users.json` o de otros ficheros de `db/`.
  - Cambios en este repositorio (los fixtures de e2e del cliente, `tests/e2e/fixtures/data.ts`, los crea la spec que los necesite copiando estos datos).

## Datos

Todos los lanzamientos tienen `"userId": "user-1"` y `"createdAt": "2026-11-01T10:00:00.000Z"`. El nombre usa el separador `" · "` (espacio, U+00B7 punto medio, espacio). No se incluye `updatedAt`.

| id | name | slug | price | date | duration | location | minParticipants | maxParticipants | status |
|---|---|---|---|---|---|---|---|---|---|
| activity-1 | Falcon 9 · Misión Luna | falcon-9-mision-luna | 249999 | 2027-03-15T14:30:00.000Z | 4320 | Cabo Cañaveral, Florida (EE. UU.) | 2 | 6 | published |
| activity-2 | Starship · Órbita Marciana | starship-orbita-marciana | 1249999 | 2027-06-01T09:00:00.000Z | 259200 | Starbase, Texas (EE. UU.) | 4 | 12 | confirmed |
| activity-3 | New Shepard · Vuelo Suborbital | new-shepard-vuelo-suborbital | 12500 | 2027-02-10T16:00:00.000Z | 11 | Launch Site One, Texas (EE. UU.) | 1 | 6 | published |
| activity-4 | Soyuz · Estación Orbital | soyuz-estacion-orbital | 389999 | 2027-04-20T08:15:00.000Z | 14400 | Cosmódromo de Baikonur (Kazajistán) | 2 | 3 | sold-out |
| activity-5 | Ariane 6 · Mirador Orbital | ariane-6-mirador-orbital | 179999 | 2027-09-12T21:45:00.000Z | 1440 | Puerto espacial de Kourou (Guayana Francesa) | 2 | 8 | cancelled |
| activity-6 | Electron · Amanecer Orbital | electron-amanecer-orbital | 89999 | 2026-09-30T06:00:00.000Z | 180 | Península de Mahia (Nueva Zelanda) | 1 | 4 | done |
| activity-7 | Vega · Prueba de Sistemas | vega-prueba-de-sistemas | 99999 | 2027-11-01T12:00:00.000Z | 90 | Puerto espacial de Kourou (Guayana Francesa) | 1 | 5 | draft |
| activity-8 | Paseo Lunar Express | paseo-lunar-express | 499999 | 2027-12-24T20:00:00.000Z | 8640 | Cabo Cañaveral, Florida (EE. UU.) | 2 | 10 | published |
| activity-9 | Falcon Heavy · Ventana Perdida | falcon-heavy-ventana-perdida | 299999 | 2026-10-01T18:30:00.000Z | 2880 | Centro Espacial Kennedy, Florida (EE. UU.) | 2 | 8 | published |

Propósito de cada caso (ADD §8): 1 reserva normal; 2 reservable en `confirmed`; 3 demostración del pago rechazado (402 con N par); 4 agotado; 5 cancelado; 6 realizado con fecha pasada; 7 borrador oculto; 8 nombre sin cohete; 9 `published` con fecha pasada.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | El fichero `db/seed/activities.json` del fork deberá contener exactamente los 9 lanzamientos de la tabla de datos, con los campos `id`, `name`, `slug`, `price`, `date`, `duration`, `location`, `minParticipants`, `maxParticipants`, `status`, `userId` y `createdAt` y los valores indicados. |
| R2 | El fichero `db/seed/activities.json` deberá ser JSON válido codificado en UTF-8, de modo que los nombres con tilde y el separador `·` (U+00B7) se conserven sin alterar. |
| R3 | Cada lanzamiento de la semilla deberá cumplir `1 ≤ minParticipants ≤ maxParticipants` y `3 ≤ maxParticipants ≤ 12`. |
| R4 | Cada precio de la semilla, salvo el de `activity-3`, deberá ser impar y no múltiplo de 5, de forma que ningún importe `price × N` con `1 ≤ N ≤ maxParticipants` sea múltiplo de 1000. |
| R5 | Los ficheros `db/activities.json`, `db/bookings.json` y `db/payments.json` del fork deberán contener exactamente `[]`. |
| R6 | Cuando se arranque la API con `npm run dev` tras aplicar el cambio, `GET /activities` deberá devolver los 9 lanzamientos de la semilla y ninguna de las actividades originales. |
| R7 | Cuando una persona autenticada cree una reserva de 2 plazas en `activity-3`, la API deberá responder 402 `Payment could not be processed` sin crear reserva ni pago. |
| R8 | Cuando una persona autenticada cree una reserva de 1 plaza en `activity-3`, la API deberá responder 201 con `paymentStatus: "paid"`. |
| R9 | Si una persona autenticada pide 7 plazas en `activity-1` sin reservas previas, entonces la API deberá responder 400 con el mensaje `Capacity exceeded. Available: 6, Requested: 7`. |

## Criterios de aceptación
### R1
- **Dado** el fork con el cambio aplicado
- **Cuando** se lee `db/seed/activities.json`
- **Entonces** es un array de 9 objetos cuyos `id` van de `activity-1` a `activity-9`, y por ejemplo `activity-1` tiene `name` `"Falcon 9 · Misión Luna"`, `price` `249999`, `maxParticipants` `6` y `status` `"published"`, y `activity-8` tiene `name` `"Paseo Lunar Express"` (sin `" · "`)

### R2
- **Dado** el fichero de semilla
- **Cuando** se ejecuta `node -e "JSON.parse(require('fs').readFileSync('db/seed/activities.json','utf8'))"`
- **Entonces** termina sin error y el `name` de `activity-2` es `"Starship · Órbita Marciana"`, con el carácter U+00B7 entre espacios

### R3
- **Dado** el fichero de semilla
- **Cuando** se comprueban los valores de plazas
- **Entonces** todos los lanzamientos cumplen la regla (por ejemplo, `activity-4` tiene `minParticipants` 2 y `maxParticipants` 3)

### R4
- **Dado** el fichero de semilla
- **Cuando** se comprueba `price % 2 !== 0 && price % 5 !== 0` en cada lanzamiento distinto de `activity-3`
- **Entonces** todos lo cumplen, y `activity-3` tiene `price` `12500`

### R5
- **Dado** el fork con el cambio aplicado
- **Cuando** se leen `db/activities.json`, `db/bookings.json` y `db/payments.json`
- **Entonces** cada uno contiene `[]`

### R6
- **Dado** la API arrancada con `npm run dev` en `http://localhost:3000`
- **Cuando** se pide `GET http://localhost:3000/activities`
- **Entonces** la respuesta es 200 con 9 elementos (incluido `activity-7` en `draft`) y ningún nombre contiene "Yoga", "Surf" ni otra actividad original

### R7
- **Dado** la API arrancada y una persona registrada con su `accessToken`
- **Cuando** envía `POST /bookings` con `{ "activityId": "activity-3", "participants": 2 }` (importe 25 000)
- **Entonces** la respuesta es 402 con `message` `"Payment could not be processed"` y `GET /bookings` de esa persona sigue devolviendo `[]`

### R8
- **Dado** la API arrancada y una persona registrada con su `accessToken`
- **Cuando** envía `POST /bookings` con `{ "activityId": "activity-3", "participants": 1 }` (importe 12 500)
- **Entonces** la respuesta es 201 y la reserva tiene `paymentStatus` `"paid"`

### R9
- **Dado** la API recién arrancada con los datos vacíos y una persona registrada
- **Cuando** envía `POST /bookings` con `{ "activityId": "activity-1", "participants": 7 }`
- **Entonces** la respuesta es 400 con `message` `"Capacity exceeded. Available: 6, Requested: 7"`

## Casos límite
- Nombre sin `" · "`: `activity-8` (el cliente no mostrará cohete).
- Estado no reservable con fecha futura: `activity-4` (`sold-out`), `activity-5` (`cancelled`).
- Fecha pasada: `activity-6` (`done`) y `activity-9` (`published`); ambas son anteriores a la fecha de redacción (2026-11-05).
- Borrador: `activity-7`; aparece en `GET /activities` pero el cliente no lo mostrará (D3).
- `activity-4` está `sold-out` sin reservas reales: la API aceptaría una reserva directa; es el cliente quien la impide (riesgo R1 del ADD).
- `activity-3` con N impar (1, 3, 5) se paga bien; con N par (2, 4, 6) da 402.

## Fuera de la spec / notas
- `userId` `"user-1"` debe existir en `db/users.json` del fork; si no existe, se informa antes de aplicar el cambio (no se modifica `db/users.json`).
- Los criterios R6–R9 se comprueban a mano (por ejemplo, con `curl` o la colección HTTP del fork) después de arrancar la API; deshacer el estado tras R8 consiste en volver a vaciar `db/bookings.json` y `db/payments.json`.
- El smoke e2e del cliente (`npm run test:e2e:smoke`) depende de esta semilla y escribe reservas en el fork.
