# fix: La API rechaza reservas en lanzamientos no reservables

- **Estado:** Aprobada
- **PRD:** F9, F11, F17 (+ D3, D4, D8; ADD §4.1 endpoint 5, §6 `getBookability`, §11 riesgo R1, ADR-008, ADR-013)
- **Ramas:** dos ramas, una por repositorio:
  - Fork de `activity-bookings-express`: `fix/bookable-launch`, desde `master` (R1–R9).
  - Este repositorio (cliente): `fix/bookable-launch-messages`, desde `main` (R10). Se integra después de la rama del fork.
- **Depende de:** `chore-seed-space-launches` y `fix-api-user-session` (ya integradas en el fork: semilla con un lanzamiento por estado e ids correctos tras reiniciar). **Dependen de esta spec:** `chore-smoke-e2e` (su R7).
- **Prioridad:** Should

## Contexto
Hoy `POST /bookings` crea la reserva (y cobra) en cualquier lanzamiento que exista, sea cual sea su estado o su fecha. En el fork (`master`, 7f69493):

- `src/services/booking.service.ts`, `create()`: valida el cuerpo, busca la actividad (`Activity not found`), comprueba las plazas (`Capacity exceeded. Available: X, Requested: Y`) y cobra (`Payment could not be processed`). No mira `activity.status` ni `activity.date`.
- `src/routes/bookings.ts`, `router.post('/')`: `authenticateToken` → `validateCreate` (400 `Validation failed` + `errors[]`) → `bookingService.create`. En el `catch` traduce los errores por su texto: `Activity not found` → 404, `Capacity exceeded…` → 400 con el mismo texto, `Payment could not be processed` → 402 y **cualquier otro** → 400 `Failed to create booking`. Siempre con el formato `ErrorResponse` `{ message, errors: [] }` (`src/types/error.ts`).
- `src/types/activity.ts`: `ActivityStatus` = `published | confirmed | sold-out | done | cancelled | draft`. "Agotado" es **solo un estado** (`sold-out`): la API nunca cambia el estado al llenarse un lanzamiento; las plazas libres se calculan aparte (`calculateAvailableCapacity` = `maxParticipants` − suma de `participants`).
- `activity.date` es una cadena ISO (en la semilla, con hora en UTC).

Consecuencia: con la semilla actual se puede reservar y pagar en `activity-4` (`sold-out`, 3 plazas libres en realidad), `activity-5` (`cancelled`), `activity-6` (`done`), `activity-7` (`draft`) y `activity-9` (`published` con fecha pasada). El cliente lo evita ocultando el formulario (`getBookability`, `src/domain/launch.ts`; `feat-launch-detail` R7), pero queda el riesgo R1 del ADD: llamadas directas a la API o una página de detalle abierta antes de que el lanzamiento cambie de estado.

Regla del cliente que la API debe reproducir (`getBookability(launch, now)`, ADD §6): reservable si `status ∈ { published, confirmed }` **y** `date > now`. Si no, motivo por prioridad `draft` > `cancelled` > `done` > `sold-out` > `past-date`.

Hoy, si la API devolviese un 400 con un mensaje nuevo, el cliente lo clasificaría como `kind: 'server'` (400 sin `errors[]` y sin prefijo `Capacity exceeded`, `src/api/errors.ts`) y `toUserMessage` (`src/domain/api-errors.ts`) mostraría el texto genérico seguido del original en inglés: "No se ha podido completar la operación (Activity is not bookable: cancelled)". Se entiende, pero mezcla inglés y español (D8, ADR-008). Por eso R10 añade la traducción en el cliente.

## Alcance
- **Incluido (fork, rama `fix/bookable-launch`, R1–R9):**
  - Comprobar en `POST /bookings` que el lanzamiento es reservable, con la misma regla y prioridad de motivos que el cliente, y responder 400 con un mensaje distinto por motivo y el formato de error existente.
  - Orden de las comprobaciones: autenticación → validación del cuerpo → lanzamiento inexistente → lanzamiento no reservable → plazas → pago.
  - Comprobación manual con `curl` y `npm run typecheck` en el fork.
- **Incluido (cliente, rama `fix/bookable-launch-messages`, R10):**
  - Traducción al español de los cinco mensajes nuevos en `domain/api-errors.ts` y su presentación en el formulario de reserva como cualquier otro error de la API (alerta).
- **Excluido:**
  - Cambiar el estado de un lanzamiento automáticamente (por ejemplo, pasar a `sold-out` al llenarse o a `done` al pasar la fecha).
  - Cambios en `GET /activities`, `GET /activities/:id`, `GET /bookings` o `GET /bookings/:id` (las reservas existentes en lanzamientos que dejan de ser reservables se siguen mostrando).
  - Cambios en la regla de plazas, en el pago simulado (múltiplos de 1000 → 402) o en la validación de `participants` (sigue aceptando decimales, ADD riesgo R11).
  - Cambios en `db/` y nuevas dependencias o framework de tests en el fork.
  - En el cliente: nuevo `kind` de error, cambios en `getBookability`, en `BookabilityNotice` o en cuándo se muestra el formulario.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Si se envía `POST /bookings` (con sesión y cuerpo válido) para un lanzamiento con `status` `draft`, entonces la API deberá responder 400 con `{ "message": "Activity is not bookable: draft", "errors": [] }`. |
| R2 | Si se envía `POST /bookings` para un lanzamiento con `status` `cancelled`, entonces la API deberá responder 400 con `{ "message": "Activity is not bookable: cancelled", "errors": [] }`. |
| R3 | Si se envía `POST /bookings` para un lanzamiento con `status` `done`, entonces la API deberá responder 400 con `{ "message": "Activity is not bookable: done", "errors": [] }`, aunque su fecha también haya pasado. |
| R4 | Si se envía `POST /bookings` para un lanzamiento con `status` `sold-out`, entonces la API deberá responder 400 con `{ "message": "Activity is not bookable: sold-out", "errors": [] }`, aunque según las reservas existentes queden plazas libres y aunque se pidan más plazas de las libres. |
| R5 | Si se envía `POST /bookings` para un lanzamiento con `status` `published` o `confirmed` cuya `date` es anterior o igual al instante de la petición, o no se puede interpretar como fecha (`new Date(date)` inválida), entonces la API deberá responder 400 con `{ "message": "Activity is not bookable: past-date", "errors": [] }`. |
| R6 | Cuando la API rechace una reserva por R1–R5, no deberá intentar el cobro ni crear reserva ni pago (`db/bookings.json` y `db/payments.json` no cambian). |
| R7 | Mientras el lanzamiento sea reservable (`published` o `confirmed` con `date` posterior al instante de la petición), la API deberá mantener el comportamiento actual: 400 `Capacity exceeded. Available: X, Requested: Y` si no hay plazas suficientes, 402 `Payment could not be processed` si el importe es múltiplo de 1000 y 201 con la reserva en otro caso. |
| R8 | La API deberá aplicar las comprobaciones de `POST /bookings` en este orden y responder con la primera que falle: 401 (sin token o token no válido), 400 `Validation failed` (cuerpo no válido), 404 `Activity not found`, 400 `Activity is not bookable: <motivo>` (R1–R5, con prioridad `draft` > `cancelled` > `done` > `sold-out` > `past-date`), 400 `Capacity exceeded…`, 402 `Payment could not be processed`. |
| R9 | El fork deberá superar `npm run typecheck` sin errores. |
| R10 | (Cliente) Si `POST /bookings` responde 400 con uno de los mensajes de R1–R5, entonces el cliente deberá mostrar en el formulario de reserva, como alerta, el texto en español del motivo: `draft` "Este lanzamiento no está disponible para reservar.", `cancelled` "Este lanzamiento se ha cancelado y no se puede reservar.", `done` "Este lanzamiento ya se ha realizado y no se puede reservar.", `sold-out` "Este lanzamiento está agotado: no quedan plazas.", `past-date` "La fecha de este lanzamiento ya ha pasado y no se puede reservar."; sin el mensaje original en inglés y con "Reservar" de nuevo habilitado. |

## Criterios de aceptación

Salvo que se indique otra cosa, R1–R9 se comprueban en el fork con `npm run dev`, `db/` igual que en `master` (semilla de `chore-seed-space-launches`, sin reservas ni pagos) y el `accessToken` obtenido con `POST /login` de `user-1`. "Reservar" es `POST /bookings` con `Authorization: Bearer <token>` y el cuerpo indicado. Las fechas de la semilla se interpretan con el reloj real (hoy, noviembre de 2026).

### R1
- **Dado** `activity-7` ("Vega · Prueba de Sistemas", `draft`, fecha 2027-11-01)
- **Cuando** se reserva `{ "activityId": "activity-7", "participants": 1 }`
- **Entonces** la respuesta es 400 con `{ "message": "Activity is not bookable: draft", "errors": [] }`

### R2
- **Dado** `activity-5` ("Ariane 6 · Mirador Orbital", `cancelled`, fecha 2027-09-12)
- **Cuando** se reserva `{ "activityId": "activity-5", "participants": 1 }`
- **Entonces** la respuesta es 400 con `{ "message": "Activity is not bookable: cancelled", "errors": [] }`

### R3
- **Dado** `activity-6` ("Electron · Amanecer Orbital", `done`, fecha pasada 2026-09-30)
- **Cuando** se reserva `{ "activityId": "activity-6", "participants": 1 }`
- **Entonces** la respuesta es 400 con `message` `Activity is not bookable: done` (no `past-date`)

### R4
- **Dado** `activity-4` ("Soyuz · Estación Orbital", `sold-out`, 3 plazas, sin reservas)
- **Cuando** se reserva `{ "activityId": "activity-4", "participants": 1 }` y después `{ "activityId": "activity-4", "participants": 99 }`
- **Entonces** ambas respuestas son 400 con `message` `Activity is not bookable: sold-out` (la segunda no es `Capacity exceeded`)

### R5
- **Dado** `activity-9` ("Falcon Heavy · Ventana Perdida", `published`, fecha pasada 2026-10-01)
- **Cuando** se reserva `{ "activityId": "activity-9", "participants": 1 }`
- **Entonces** la respuesta es 400 con `{ "message": "Activity is not bookable: past-date", "errors": [] }`
- **Y** si se cambia a mano en `db/activities.json` la fecha de `activity-1` (`published`) a `"no-es-una-fecha"` y se reinicia la API, reservar `{ "activityId": "activity-1", "participants": 1 }` responde 400 `Activity is not bookable: past-date`; se restaura `db/` al terminar

### R6
- **Dado** `db/bookings.json` y `db/payments.json` con `[]`
- **Cuando** se hacen las cinco reservas rechazadas de R1–R5 (también con un número de plazas cuyo importe sería múltiplo de 1000, por ejemplo 1000 plazas en `activity-5`)
- **Entonces** todas responden 400 con su motivo (ninguna 402), `git status --short db/` no muestra cambios y la consola del fork no registra ningún intento de cobro (`MockPaymentGateway`)
- **Y** la siguiente reserva válida recibe `booking-1` y `payment-1`

### R7
- **Dado** la API recién arrancada
- **Cuando** se reserva `{ "activityId": "activity-1", "participants": 1 }`, después `{ "activityId": "activity-1", "participants": 7 }`, después `{ "activityId": "activity-3", "participants": 2 }` y por último `{ "activityId": "activity-2", "participants": 1 }`
- **Entonces** las respuestas son, respectivamente, 201 (`booking-1`, `paymentStatus` `paid`), 400 `Capacity exceeded. Available: 5, Requested: 7`, 402 `Payment could not be processed` (12 500 € × 2 = 25 000 €) y 201 (`activity-2` está `confirmed`)

### R8
- **Dado** la API recién arrancada
- **Cuando** se envían estas peticiones a `POST /bookings`:
  1. `{ "activityId": "activity-5", "participants": 1 }` sin cabecera `Authorization`
  2. `{ "activityId": "activity-5", "participants": 0 }` con token
  3. `{ "activityId": "activity-99", "participants": 1 }` con token
  4. `{ "activityId": "activity-4", "participants": 99 }` con token
- **Entonces** las respuestas son, respectivamente, 401 `Authentication required. Please provide a valid token.`, 400 `Validation failed` con `errors` del campo `participants`, 404 `Activity not found` y 400 `Activity is not bookable: sold-out`
- **Y** si se cambia a mano en `db/activities.json` la fecha de `activity-5` (`cancelled`) y la de `activity-7` (`draft`) a `2026-01-01T00:00:00.000Z` y se reinicia la API, los motivos siguen siendo `cancelled` y `draft` (no `past-date`); se restaura `db/` al terminar

### R9
- **Dado** el fork con el cambio aplicado
- **Cuando** se ejecuta `npm run typecheck`
- **Entonces** termina sin errores

### R10
- **Dado** (e2e determinista del cliente con `page.route`, reloj en `2026-11-05T10:00:00Z`) una sesión válida, el detalle de `activity-1` con el formulario de reserva y la API simulada que responde a `POST /bookings` 400 `{ "message": "Activity is not bookable: cancelled", "errors": [] }`
- **Cuando** la persona reserva 1 plaza
- **Entonces** ve en el formulario `role="alert"` con "Este lanzamiento se ha cancelado y no se puede reservar.", el texto no contiene "Activity is not bookable" y "Reservar" está habilitado
- **Y** (test unitario de `toUserMessage`) cada uno de los cinco mensajes de R1–R5 se traduce a su texto en español, y un mensaje parecido pero desconocido (por ejemplo, `Activity is not bookable: archived`) sigue mostrando el texto genérico con el original entre paréntesis (ADR-008)

## Casos límite
- Lanzamiento `done` con fecha pasada: el motivo es `done`, no `past-date` (R3, prioridad del cliente).
- Lanzamiento `sold-out` con plazas libres según las reservas: se rechaza por estado (R4). Lanzamiento `published` sin plazas libres: sigue siendo `Capacity exceeded. Available: 0, Requested: N` (R7); la API no cambia el estado.
- Fecha igual al instante de la petición: no reservable (`date > now` estricto, como `getBookability`).
- Fecha sin hora (`"2027-03-15"`, admitida por la API): se interpreta con `new Date(date)` (medianoche UTC), igual que hace el cliente al parsearla.
- Fecha no interpretable (`new Date(date)` inválida): no reservable con motivo `past-date` (R5, criterio conservador aprobado; con la semilla no ocurre y el cliente rechazaría esa respuesta por contrato).
- Petición sin sesión a un lanzamiento no reservable: 401 primero (R8, el middleware se ejecuta antes que la ruta).
- Cuerpo no válido a un lanzamiento no reservable: 400 `Validation failed` primero (R8).
- Importe múltiplo de 1000 en un lanzamiento no reservable: 400 por motivo, nunca 402 (R6).
- Página de detalle abierta antes de que el lanzamiento se cancele o se agote: el formulario se ve, la reserva se rechaza y la persona ve el motivo en español (R10). Al recargar, el detalle ya muestra `BookabilityNotice` sin formulario.
- Reloj del navegador desajustado respecto al del servidor (ADD riesgo R10): el cliente puede mostrar el formulario para un lanzamiento que la API ya considera pasado; la API decide y R10 lo explica.

## Fuera de la spec / notas
- **Formato de error:** se mantiene `ErrorResponse` `{ message, errors: [] }`. Los mensajes llevan el prefijo común `Activity is not bookable: ` y el motivo con los mismos códigos que `BookabilityReason` del cliente (`draft`, `cancelled`, `done`, `sold-out`, `past-date`), para que sean claros y fáciles de traducir.
- **Pista para el plan (no es una decisión de la spec):** el `catch` de `router.post('/')` convierte cualquier error desconocido en 400 `Failed to create booking`, así que no basta con lanzar el error en el servicio: la ruta debe reenviar el mensaje `Activity is not bookable: …` con 400. La comprobación puede vivir en `BookingService.create` (después de `Activity not found` y antes de `calculateAvailableCapacity`), con el instante actual inyectable si `4-engineer` lo considera útil.
- **Cliente (R10):** el 400 sin `errors[]` ni prefijo `Capacity exceeded` ya llega como `kind: 'server'` con su `message` y `bookingErrorFeedback` lo muestra como alerta; basta con añadir las cinco traducciones a `KNOWN_API_MESSAGES` en `src/domain/api-errors.ts` (o una función equivalente) y sus tests. No hace falta un `kind` nuevo. Sin R10, el cliente mostraría "No se ha podido completar la operación (Activity is not bookable: cancelled)".
- **Documentación:** el ADD ya recoge el error nuevo en §4.1 (endpoint 5), §5.4, ADR-008, ADR-013 y la mitigación del riesgo R1 de §11 (actualizado al aprobar esta spec).
- **PRD D2:** "No se modifica el código de la API" se refiere a no exponer las plazas disponibles (igual que en `fix-api-user-session`). Esta spec sí **amplía el contrato** de `POST /bookings` con un error nuevo; por eso la persona debe aprobarlo expresamente.
- **Datos tras las pruebas:** las pruebas de R6–R8 escriben en `db/`. Al terminar, `git restore db/` en el fork y `git status --short db/` sin cambios. El commit del fix no incluye ficheros de `db/`.
- **Remoto:** el fork tiene `origin` (fork personal) y `upstream` (repositorio del curso). El cambio se integra en `master` del fork; proponerlo a `upstream` queda fuera de esta spec.

## Decisiones tomadas
Aprobadas por la persona el 2026-11-07:
1. **Contrato:** el fork añade el error 400 `Activity is not bookable: <motivo>` (amplía el contrato de ADD §4.1; ADR-013).
2. **Textos exactos:** los cinco mensajes en inglés (R1–R5) y los cinco en español (R10), tal como están escritos en esta spec.
3. **Dónde va R10:** en esta spec, implementado en la rama del cliente `fix/bookable-launch-messages`.
4. **Fecha no interpretable:** se trata como `past-date` (R5 y casos límite).
