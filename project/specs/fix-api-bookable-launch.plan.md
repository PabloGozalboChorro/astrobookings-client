# Plan: fix-api-bookable-launch

- **Spec:** [fix-api-bookable-launch.spec.md](fix-api-bookable-launch.spec.md)
- **Rama (fork, R1–R9):** `fix/bookable-launch` creada desde `master` (`7f69493`) en `C:\Users\pablo\Desktop\Astrobookings Client\activity-bookings-express`
- **Rama (cliente, R10 y este plan):** `fix/bookable-launch-messages` creada desde `main` (`5abca74`)
- **Estado:** Aprobado por delegación de la persona (decisiones E1–E9 y C1–C4 tal como las fija este plan). Quedan abiertas las preguntas marcadas como **abierta** en [Puntos a decidir](#puntos-a-decidir); ninguna bloquea la implementación ni cambia el producto de forma importante.

> R1–R9 cambian el **fork**; R10, el cliente. Orden de integración: primero la rama del fork en `master`, después la del cliente en `main`. Los AGENTS.md, PRD, ADD, specs, `.cursor/` y `.github/` propios del fork (del curso) **no** se siguen ni se modifican: manda la spec de este repositorio. Del fork solo se respetan sus convenciones de código (TypeScript `strict`, capas Routes → Services → Repositories, errores como `Error` con mensaje que la ruta traduce a `ErrorResponse`, código y comentarios en inglés, JSDoc breve en los métodos públicos).

## Revisión de la spec

La spec es completa y verificable: mensajes exactos (R1–R5, R10), orden de las comprobaciones (R8), efectos laterales (R6), regresión (R7) y criterios con datos de la semilla. Encaja con el ADD (§4.1 endpoint 5, §6 `getBookability`, ADR-008, ADR-013, riesgo R1). No hay huecos que obliguen a devolverla a `product-owner`; las pequeñas ambigüedades están en [Puntos a decidir](#puntos-a-decidir).

## Estado del fork comprobado (2026-11-07, `master` en `7f69493`)

| Hecho | Consecuencia para el plan |
|---|---|
| `package.json` solo tiene `dev`, `build`, `prestart`, `start` y `typecheck`. No hay `test`, ni framework de tests en las dependencias, ni carpeta `tests/`. | La spec excluye añadir dependencias o framework. Verificación: `npm run typecheck`, `npm run build` y comprobaciones manuales con `curl` (C0–C8). |
| `src/routes/bookings.ts`, `router.post('/')`: `authenticateToken` (401 del middleware) → `bookingService.validateCreate` (400 `Validation failed` + `errors[]`) → `bookingService.create`. El `catch` traduce por texto: `Activity not found` → 404; `includes('Capacity exceeded')` → 400 con el mismo texto; `Payment could not be processed` → 402; **cualquier otro → 400 `Failed to create booking`**. | Lanzar el error en el servicio no basta: hay que añadir una rama en el `catch` que reenvíe el mensaje `Activity is not bookable: …` con 400 (E3). El orden 401 → 400 validación ya lo da la ruta (R8). |
| `src/services/booking.service.ts`, `create()`: `validateCreate` → `activityService.getById` (`Activity not found`) → `calculateAvailableCapacity` (`Capacity exceeded. Available: X, Requested: Y`) → `repository.getNextId()` (consume el id de reserva) → `paymentService.createForBooking` (cobra con `MockPaymentGateway`; si falla, `Payment could not be processed`) → `repository.create`. No mira `status` ni `date`. | La comprobación va justo después de `Activity not found` y **antes** de `calculateAvailableCapacity` y de `getNextId()` (E2): así un rechazo no cobra, no escribe y no consume ids (R6: la siguiente reserva válida es `booking-1` / `payment-1`). |
| `MockPaymentGateway.charge` registra en consola `[MockPaymentGateway] Simulated payment success/failure` y falla si `amount % 1000 === 0`. `PaymentService.createForBooking` pide `payment-N` solo tras un cobro correcto. | R6 se comprueba buscando `MockPaymentGateway` en el log de la API (C4). Un 402 consume `booking-N` pero no `payment-N` (ya ocurría; fuera de alcance). |
| `src/types/activity.ts`: `ActivityStatus` = `published \| confirmed \| sold-out \| done \| cancelled \| draft`; `date: string` (ISO). La validación de `ActivityService` usa `new Date(req.date)` + `isNaN(date.getTime())` y `date <= new Date()`. | Misma forma de interpretar la fecha (E1). |
| `src/types/error.ts`: `ErrorResponse { message, errors: ValidationError[] }`. | Los rechazos usan `{ message, errors: [] }` (R1–R5). |
| Datos: `db/activities.json` = `[]`; los 9 lanzamientos están en `db/seed/activities.json` (`data-loader.ts`: semilla + persistidos, **los persistidos ganan por id**). `db/bookings.json` y `db/payments.json` = `[]`. `db/users.json`: `user-1` (`m@f.c` / `1234aB`). | Para los criterios que piden "cambiar a mano la fecha en `db/activities.json`" (R5 y R8) se escribe en `db/activities.json` una copia de la actividad de la semilla con la fecha cambiada (E8); la semilla no se toca. Al final, `git restore db/`. |
| Semilla relevante: `activity-1` published 2027-03-15, 249 999 €, 6 plazas; `activity-2` confirmed 2027-06-01; `activity-3` published 2027-02-10, 12 500 €; `activity-4` sold-out 2027-04-20, 3 plazas; `activity-5` cancelled 2027-09-12, 179 999 €; `activity-6` done 2026-09-30; `activity-7` draft 2027-11-01; `activity-8` published 2027-12-24; `activity-9` published 2026-10-01. | Coincide con los criterios de aceptación. Todos los importes de `participants: 1000` son múltiplo de 1000 (útil para R6). |
| `JsonRepository.getNextId()` incrementa en cada llamada (`fix-api-user-session`). | Confirma E2. |

## Solución técnica (fork)

**E1 — Regla en el servicio, igual que `getBookability` del cliente** (`src/domain/launch.ts`): método público nuevo en `BookingService`:

```ts
getUnbookableReason(activity: Activity, now: Date): UnbookableReason | null
```

- `draft`, `cancelled`, `done`, `sold-out` → devuelve el propio estado (sin mirar la fecha: así `done` con fecha pasada es `done`, y un `cancelled`/`draft` con fecha pasada sigue siendo su estado, R3 y R8).
- `published`, `confirmed` (y cualquier otro valor, ver P3) → `const time = new Date(activity.date).getTime()`; si `Number.isNaN(time) || time <= now.getTime()` → `'past-date'`; si no, `null` (reservable).
- Tipo `UnbookableReason = 'draft' | 'cancelled' | 'done' | 'sold-out' | 'past-date'` (mismos códigos que `BookabilityReason` del cliente) en `src/types/booking.ts`.

**E2 — Orden en `create()`:** `validateCreate` → `Activity not found` → **`getUnbookableReason(activity, new Date())`**; si hay motivo, `throw new Error(\`${ACTIVITY_NOT_BOOKABLE_PREFIX}${reason}\`)` → `calculateAvailableCapacity` → `getNextId()` → cobro → guardar. El instante se toma una vez por petición en `create()`. Con ello R4 (sold-out con 99 plazas da el motivo, no `Capacity exceeded`), R6 (sin cobro, sin escritura, sin consumir ids) y R8 (404 antes que el motivo; el motivo antes que plazas y pago).

**E3 — Ruta:** constante exportada `ACTIVITY_NOT_BOOKABLE_PREFIX = 'Activity is not bookable: '` en `booking.service.ts`; en el `catch` de `router.post('/')`, rama nueva `else if (error.message.startsWith(ACTIVITY_NOT_BOOKABLE_PREFIX)) { message = error.message; statusCode = 400; }`, antes de la de capacidad. Se actualiza el JSDoc de la ruta ("400 on validation error, activity not bookable or capacity exceeded"). Nada más cambia en la ruta: el resto de errores desconocidos siguen siendo 400 `Failed to create booking`.

| Alternativa | Por qué no |
|---|---|
| Comprobar en la ruta (antes de llamar al servicio). | Duplica la búsqueda de la actividad y la lógica de negocio sale de la capa de servicio (convención del fork: Routes → Services). |
| Clase de error propia (`ActivityNotBookableError`) con `instanceof` en la ruta. | Más robusta, pero rompe el patrón del fork (todos los errores de `create` se traducen por texto). Cambio mayor sin beneficio observable. |
| Inyectar el reloj en el constructor de `BookingService`. | Sin runner de tests en el fork no aporta nada; `getUnbookableReason` ya recibe `now` como parámetro y es probable sin reloj. |

Ficheros del fork que cambian: **solo** `src/services/booking.service.ts`, `src/routes/bookings.ts` y `src/types/booking.ts`. Sin cambios en `db/`, `package.json`, `src/index.ts`, repositorios ni otras rutas (`GET /activities`, `GET /bookings` quedan igual).

## Solución técnica (cliente, R10)

| # | Decisión | Motivo |
|---|---|---|
| C1 | En `src/domain/api-errors.ts` se añaden a `KNOWN_API_MESSAGES` cinco entradas con **coincidencia exacta**: `'Activity is not bookable: draft'` → "Este lanzamiento no está disponible para reservar.", `…: cancelled` → "Este lanzamiento se ha cancelado y no se puede reservar.", `…: done` → "Este lanzamiento ya se ha realizado y no se puede reservar.", `…: sold-out` → "Este lanzamiento está agotado: no quedan plazas.", `…: past-date` → "La fecha de este lanzamiento ya ha pasado y no se puede reservar." | R10. La coincidencia exacta deja `Activity is not bookable: archived` en el texto genérico con el original entre paréntesis (ADR-008). Sin `kind` nuevo ni cambios en `src/api/errors.ts`: el 400 sin `errors[]` ni prefijo `Capacity exceeded` ya es `kind: 'server'` y `bookingErrorFeedback` lo devuelve como `alert`. |
| C2 | No se tocan `getBookability`, `BookabilityNotice`, `BookingForm.tsx` ni `booking-form.ts`. "Reservar" vuelve a habilitarse por el flujo existente de error (igual que 402/404). | Exclusiones de la spec. |
| C3 | Tests unitarios en los ficheros existentes: `tests/unit/domain/api-errors.test.ts` (`it.each` de los cinco + caso `archived`), `tests/unit/features/bookings/booking-form.test.ts` (`bookingErrorFeedback` → `{ alert }` sin `availableSeats`) y `tests/unit/features/bookings/BookingForm.test.tsx` (alerta en el formulario y "Reservar" habilitado). Nombres con prefijo `R10 (bookable launch):` para no confundirlos con el R10 de `feat-booking-creation`. | Trazabilidad (AGENTS §5.5). |
| C4 | E2E en `tests/e2e/booking-creation.spec.ts`, en un `test.describe('bookable launch rejected by the API')` nuevo que reutiliza `mockBookingApi`, `openSignedIn`, `reserveButton`, `formAlert` (reloj `2026-11-05T10:00:00Z` del `beforeEach`). Cuerpo nuevo `errorResponses.activityNotBookableCancelled` en `tests/e2e/fixtures/data.ts`, junto a los demás literales de `POST /bookings`. | Los helpers son locales a ese fichero; duplicarlos en un fichero nuevo violaría AGENTS §7. |

## Decisiones de implementación (fork)

| # | Decisión | Motivo |
|---|---|---|
| E1 | `getUnbookableReason(activity, now)` público en `BookingService` (ver "Solución técnica"). | Misma regla y prioridad que el cliente; `now` explícito. |
| E2 | Comprobación entre `Activity not found` y `calculateAvailableCapacity`, antes de `getNextId()`. | R4, R6, R8. |
| E3 | Prefijo exportado + rama en el `catch` de la ruta. | Pista de la spec; patrón del fork. |
| E4 | `UnbookableReason` en `src/types/booking.ts`. | Los tipos del fork viven en `src/types/`. |
| E5 | Fecha: `new Date(activity.date)`; inválida o `<= now` → `past-date` (`>` estricto, como `getBookability`). Fecha sin hora (`"2027-03-15"`) → medianoche UTC, igual que el cliente. | R5 y casos límite. |
| E6 | Sin comentarios nuevos salvo JSDoc breve de `getUnbookableReason` y el JSDoc actualizado de la ruta; código en inglés. | Convenciones del fork. |
| E7 | Pruebas manuales en **Git Bash** con `curl`; la API se para siempre por el puerto (`stop_api`), nunca solo la tarea en segundo plano. | Igual que en `fix-api-user-session`: evita `node` huérfanos con datos viejos. |
| E8 | Para cambiar fechas "en `db/activities.json`" se escribe en ese fichero (hoy `[]`) una copia de la actividad de la semilla con la fecha nueva (los persistidos ganan por id). No se edita `db/seed/`. | Cumple el criterio literalmente sin tocar la semilla; `git restore db/` lo deshace. |
| E9 | Ficheros temporales (log de la API) en el scratchpad de la sesión, fuera de los repos. | No se añaden ficheros al fork. |

## Plan de pruebas

Se escribe antes del código. En el fork no hay runner: las "pruebas" son comprobaciones manuales con `curl` y salida esperada exacta; C0 se ejecuta **antes** del cambio y debe fallar. En el cliente, primero los tests (en rojo) y luego el código.

### Fork (manual con `curl`, Git Bash, desde la raíz del fork)

| Requisito | Comprobación | Paso |
|---|---|---|
| (todos) | **antes del cambio**, reservar `activity-5` (cancelled) da 201 `booking-1` (prueba que falla primero) | C0 |
| R9 | `npm run typecheck` y `npm run build` sin errores | C1 |
| R1–R5 | `activity-7` → `draft`; `activity-5` → `cancelled`; `activity-6` → `done`; `activity-4` con 1 y con 99 plazas → `sold-out`; `activity-9` → `past-date`; todos 400 `{ message, errors: [] }` exactos | C3 |
| R6 | 1000 plazas en `activity-5`, `activity-9` y `activity-4` → 400 con su motivo (nunca 402); `git status --short db/` vacío; ninguna línea `MockPaymentGateway` en el log | C3, C4 |
| R8 | sin token → 401; `participants: 0` → 400 `Validation failed` con `errors` de `participants`; `activity-99` → 404; `activity-4` × 99 → 400 `sold-out` | C5 |
| R7, R6 | `activity-1` × 1 → 201 `booking-1`/`payment-1`/`paid`; `activity-1` × 7 → 400 `Capacity exceeded. Available: 5, Requested: 7`; `activity-3` × 2 → 402; `activity-2` × 1 → 201 | C6 |
| R5, R8 (fechas cambiadas) | con `db/activities.json` modificado (E8): `activity-1` con `"no-es-una-fecha"` → `past-date`; `activity-5` y `activity-7` con `2026-01-01T00:00:00.000Z` → `cancelled` y `draft` | C7 |
| Límite | (opcional) `activity-8` con fecha sin hora `"2027-12-24"` → 201 | C7 |
| Exclusiones | al final solo cambian los tres ficheros de `src/`; `db/` igual que en `master` | C8 |

#### Utilidades (una vez por terminal de Git Bash)

```bash
cd "/c/Users/pablo/Desktop/Astrobookings Client/activity-bookings-express"
S=/c/Users/pablo/AppData/Local/Temp/claude/ba248153ea8ddf2d/6ce9f79e-d6fe-4f65-b830-bad457df6b23/scratchpad   # o cualquier carpeta fuera de los repos
BASE=http://localhost:3000
J='Content-Type: application/json'
jget() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v[k];process.stdout.write(typeof v==="object"?JSON.stringify(v):String(v))})' "$1"; }
stop_api() { powershell.exe -NoProfile -Command 'Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Get-Process -Id $_.OwningProcess | Select-Object Id,ProcessName; Stop-Process -Id $_.OwningProcess -Force }'; sleep 1; netstat -ano | grep ":3000 " | grep LISTENING || echo "puerto 3000 libre"; }
wait_api() { for i in $(seq 1 30); do curl -s "$BASE/health" && echo && return 0; sleep 1; done; echo "la API no arranca: mira $S/api.log"; return 1; }
login() { curl -s -X POST "$BASE/login" -H "$J" -d '{"email":"m@f.c","password":"1234aB"}' | jget accessToken; }
book() { curl -s -w "\n%{http_code}\n" -X POST "$BASE/bookings" -H "Authorization: Bearer $TOKEN" -H "$J" -d "{\"activityId\":\"$1\",\"participants\":$2}"; }
```

**Arrancar la API:** en segundo plano, `npm run dev > "$S/api.log" 2>&1`, y después `wait_api`. **Reiniciar** = `stop_api`, arrancar, `wait_api`. Antes de la primera arrancada `stop_api` debe decir "puerto 3000 libre" sin parar nada; si para un proceso que no es un `node` del fork, se pregunta a la persona.

#### C0 — Prueba que falla primero (código de `master`, antes de T1)

```bash
git status --short          # vacío
TOKEN=$(login); book activity-5 1
stop_api; git restore db/; git status --short db/
```

Esperado **con el bug**: `201` con `"id":"booking-1"` y `"paymentStatus":"paid"`. Después, puerto libre y `db/` sin cambios.

#### C1 — R9

```bash
npm run typecheck && npm run build && echo "R9 OK"
git status --short          # dist/ está en .gitignore
```

#### Sesión 1 (API recién arrancada, `db/` igual que en `master`): C2–C6

**C2 — Token:** `TOKEN=$(login); echo "$TOKEN" | cut -c1-20`

**C3 — R1–R5 y R6 (rechazos)**

```bash
book activity-7 1      # R1
book activity-5 1      # R2
book activity-6 1      # R3
book activity-4 1      # R4
book activity-4 99     # R4
book activity-9 1      # R5
book activity-5 1000   # R6 (importe múltiplo de 1000)
book activity-9 1000   # R6
book activity-4 1000   # R6
```

Esperado, en orden: `{"message":"Activity is not bookable: draft","errors":[]}` 400; `…: cancelled` 400; `…: done` 400; `…: sold-out` 400 (dos veces); `…: past-date` 400; `…: cancelled`, `…: past-date`, `…: sold-out`, todos 400 (ninguno 402).

**C4 — R6 (sin efectos)**

```bash
git status --short db/                                    # vacío
grep -c "MockPaymentGateway" "$S/api.log" || true         # 0
```

**C5 — R8 (orden)**

```bash
curl -s -w "\n%{http_code}\n" -X POST "$BASE/bookings" -H "$J" -d '{"activityId":"activity-5","participants":1}'
book activity-5 0
book activity-99 1
book activity-4 99
```

Esperado: `{"message":"Authentication required. Please provide a valid token.","errors":[]}` 401; `"message":"Validation failed"` con un error de `field` `participants`, 400; `{"message":"Activity not found","errors":[]}` 404; `…: sold-out` 400.

**C6 — R7 y R6 (siguiente reserva válida)**

```bash
book activity-1 1      # 201 booking-1, paymentId payment-1, paid
book activity-1 7      # 400 Capacity exceeded. Available: 5, Requested: 7
book activity-3 2      # 402 Payment could not be processed
book activity-2 1      # 201 (booking-3: el 402 consumió booking-2; payment-2)
```

Después: `stop_api; git restore db/; git status --short db/` (vacío).

#### Sesión 2 (fechas cambiadas en `db/activities.json`, E8): C7

```bash
node -e 'const fs=require("fs");const seed=JSON.parse(fs.readFileSync("db/seed/activities.json","utf8"));const by=id=>seed.find(a=>a.id===id);const out=[{...by("activity-1"),date:"no-es-una-fecha"},{...by("activity-5"),date:"2026-01-01T00:00:00.000Z"},{...by("activity-7"),date:"2026-01-01T00:00:00.000Z"},{...by("activity-8"),date:"2027-12-24"}];fs.writeFileSync("db/activities.json",JSON.stringify(out,null,2));console.log(out.map(a=>a.id+" "+a.status+" "+a.date).join("\n"))'
# arrancar la API y wait_api
TOKEN=$(login)
book activity-1 1      # R5: 400 past-date (fecha no interpretable)
book activity-5 1      # R8: 400 cancelled (no past-date)
book activity-7 1      # R8: 400 draft (no past-date)
book activity-8 1      # límite opcional: 201 (fecha sin hora, futura)
```

#### C8 — Limpieza y estado final

```bash
stop_api
git restore db/
ls db/*.tmp 2>/dev/null || echo "sin .tmp"
git status --short
```

Esperado: "puerto 3000 libre"; `git status --short` muestra **solo** ` M src/routes/bookings.ts`, ` M src/services/booking.service.ts`, ` M src/types/booking.ts`.

### Cliente (Vitest, jsdom, `TZ=UTC`)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R10 | `it.each` `R10 (bookable launch): translates "%s"` — los cinco mensajes de R1–R5 (400, `errors: []`) → su texto en español exacto | unit | `tests/unit/domain/api-errors.test.ts` |
| R10 | `R10 (bookable launch): keeps the generic text for an unknown reason` — `Activity is not bookable: archived` → "No se ha podido completar la operación (Activity is not bookable: archived)" | unit | `tests/unit/domain/api-errors.test.ts` |
| R10 | `R10 (bookable launch): shows the reason as an alert` — `bookingErrorFeedback` de un 400 `…: sold-out` → `{ alert: 'Este lanzamiento está agotado: no quedan plazas.' }` (sin `availableSeats` ni `fieldError`) | unit | `tests/unit/features/bookings/booking-form.test.ts` |
| R10 | `R10 (bookable launch): shows the reason in the form and enables "Reservar" again` — `POST /bookings` 400 `…: cancelled` → `role="alert"` con el texto en español, sin "Activity is not bookable", "Reservar" habilitado, sigue en `/lanzamientos/activity-1` | componente | `tests/unit/features/bookings/BookingForm.test.tsx` |

### Cliente (Playwright, API interceptada, reloj `2026-11-05T10:00:00Z`)

| Requisito | Test | Fichero |
|---|---|---|
| R10 | `R10 (bookable launch): shows why the launch cannot be booked` — sesión válida, detalle de `activity-1`, `POST /bookings` → 400 `errorResponses.activityNotBookableCancelled`; reservar 1 plaza → `formAlert` con "Este lanzamiento se ha cancelado y no se puede reservar.", `not.toContainText('Activity is not bookable')`, "Reservar" habilitado, URL `/lanzamientos/activity-1` | `tests/e2e/booking-creation.spec.ts` (+ `tests/e2e/fixtures/data.ts`) |

Los tests existentes (en particular el R7 genérico `Launch window closed` y los R12 de `BookingForm` y `booking-creation`) deben seguir en verde sin cambiar sus aserciones.

## Tareas

Fork (rama `fix/bookable-launch`):

- [x] **T0** — Comprobaciones previas y C0: rama correcta, árbol limpio, puerto 3000 libre, `db/` igual que en `master`; C0 debe **fallar** como se describe; `stop_api` y `git restore db/`. · Requisitos: R1–R6 (reproducción) · Ficheros: ninguno
- [x] **T1** — Tipo `UnbookableReason` y `getUnbookableReason(activity, now)` en `BookingService` (E1, E4, E5). `npm run typecheck` en verde. · Requisitos: R1–R5, R9 · Ficheros: `src/types/booking.ts`, `src/services/booking.service.ts`
- [x] **T2** — Comprobación en `create()` con `ACTIVITY_NOT_BOOKABLE_PREFIX` en el orden de E2, y rama nueva en el `catch` de `router.post('/')` + JSDoc (E3). `npm run typecheck` en verde. · Requisitos: R1–R8 · Ficheros: `src/services/booking.service.ts`, `src/routes/bookings.ts`
- [x] **T3** — C1 (typecheck + build). · Requisitos: R9 · Ficheros: ninguno
- [x] **T4** — Verificación manual: sesión 1 (C2–C6), `git restore db/`, sesión 2 (C7). Anotar las respuestas reales (cuerpo y código) para el informe del tester. · Requisitos: R1–R8 · Ficheros: ninguno (la API escribe en `db/`; se restaura)
- [x] **T5** — Limpieza C8: parar la API por el puerto, `git restore db/`, `git status` solo con los tres ficheros de `src/`. · Requisitos: exclusiones · Ficheros: `db/` vuelve a `master`

Cliente (rama `fix/bookable-launch-messages`):

- [x] **T6** — Tests unitarios de R10 en rojo (`api-errors.test.ts`, `booking-form.test.ts`, `BookingForm.test.tsx`) y después las cinco entradas en `KNOWN_API_MESSAGES` (C1). · Requisitos: R10 · Ficheros: `src/domain/api-errors.ts`, `tests/unit/domain/api-errors.test.ts`, `tests/unit/features/bookings/booking-form.test.ts`, `tests/unit/features/bookings/BookingForm.test.tsx`
  - Verificación: `npm test -- tests/unit/domain/api-errors.test.ts tests/unit/features/bookings`.
- [x] **T7** — E2E de R10 (C4). · Requisitos: R10 · Ficheros: `tests/e2e/fixtures/data.ts`, `tests/e2e/booking-creation.spec.ts`
  - Verificación: `npx.cmd playwright test tests/e2e/booking-creation.spec.ts --project=chromium`.
- [x] **T8** — Verificación final del cliente. · Requisitos: R10 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - En orden: `npm run typecheck`, `npm run lint`, `npm test` (recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa). No usar `npm run test:e2e -- --project=chromium`. Firefox lo ejecuta **la persona**: `npx.cmd playwright test --project=firefox`.
  - Comprobar: sin `console.log`, código comentado ni `any`; sin dependencias nuevas; `git status` sin ficheros no previstos.
  - Prueba manual opcional (persona) con el fork ya corregido en `:3000`: abrir el detalle de `activity-1`, cambiar su estado a `cancelled` en el fork (E8) y reiniciar la API sin recargar la página, reservar → alerta en español.
- [x] **T9** — CHANGELOG del cliente: en `[Unreleased]`, sección *Fixed*, una entrada para la API (rechazo de reservas en lanzamientos no reservables, fork `fix/bookable-launch`) y el mensaje en español en el formulario. · Requisitos: — · Ficheros: `CHANGELOG.md`

## Desviaciones durante la implementación

Rellenado por `5-coder`.

| # | Desviación | Motivo |
|---|---|---|
| D1 | T1 y T2 se editaron seguidos y `npm run typecheck` se ejecutó una vez tras ambos (junto con C1), no entre T1 y T2. | Los cambios de T1 solo se usan en T2; el resultado final es el mismo (typecheck y build en verde). |
| D2 | Las comprobaciones `curl` se agrupan en un script por fases (`c0`, `s1`, `s2`, `clean`) guardado en el scratchpad (`bookable-curl.sh`), con un log de la API por sesión (`bookable-api-c0.log`, `bookable-api-s1.log`, `bookable-api-s2.log`) en lugar de un único `api.log`. C4 busca `MockPaymentGateway` en el log de la sesión 1. C8 añade `git clean -n db/` para confirmar que no quedan ficheros sin seguimiento en `db/`. | Reproducibilidad y salida completa para el informe del tester; mismo contenido que C0–C8. |
| D3 | `getUnbookableReason` comprueba el estado con una lista constante `UNBOOKABLE_STATUSES` (`draft`, `cancelled`, `done`, `sold-out`) en lugar de un `switch`. | Un lanzamiento tiene un único estado, así que la prioridad entre estados no cambia; la fecha solo se mira si el estado no es uno de esos (E1). |

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] Fork: C0 falló antes del cambio; `npm run typecheck` (y `npm run build`) en verde (R9); el fork no tiene `lint` ni `test` y no se añaden
- [x] Fork: comprobaciones manuales con `curl` de R1–R8 (C2–C7) con la salida esperada, y después `git restore db/`
- [x] Fork: puerto 3000 libre al terminar; `git status` solo con `src/routes/bookings.ts`, `src/services/booking.service.ts` y `src/types/booking.ts`; el commit no incluye `db/`
- [x] Cliente: `npm run typecheck`, `npm run lint`, `npm test` (804 tras la limpieza) y `npm run build` en verde
- [x] Cliente: suite e2e completa en Chromium en verde (185)
- [x] Tests e2e de la spec en verde (Chromium agente, Firefox persona) — Chromium 185/185 y Firefox 185/185
- [x] CHANGELOG del cliente actualizado (el del fork no se toca, como en `fix-api-user-session`)
- [x] Commits propuestos (los hace `8-dev-ops` cuando la persona lo pida): fork `fix(bookings): reject bookings on non-bookable activities`; cliente `fix(bookings): translate not bookable booking errors`, ambos enlazando la spec

## Riesgos
1. **Reloj del servidor frente al del navegador** (ADD riesgo R10): un lanzamiento cerca de su fecha puede verse reservable en el cliente y rechazarse en la API; R10 lo explica en español. Con la semilla no ocurre.
2. **Ids "quemados" por 402:** un 402 sigue consumiendo `booking-N` (fuera de alcance). En C6 la última reserva es `booking-3`, no `booking-2`. Los rechazos por motivo **no** consumen ids (E2).
3. **Datos de pruebas en `db/`:** parar la API **antes** de `git restore db/` (C6, C8).
4. **Dependencia por texto:** el cliente traduce por coincidencia exacta del mensaje; si el fork cambiase el texto, se vería el genérico con el original (ADR-008), sin romper nada.
5. **`chore-smoke-e2e` R7** depende de esta spec: no se integra hasta que el fork esté en `master`.

## Puntos a decidir

La persona ha delegado las decisiones de esta spec: el plan aplica la recomendación. **Ninguna cambia el producto de forma importante.** Las marcadas **abierta** conviene que la persona las confirme, pero no bloquean.

| # | Tema | Ambigüedad | Decisión aplicada |
|---|---|---|---|
| P1 | Dónde y cómo se detecta el error en la ruta | La spec da una pista, no una decisión. | Comprobación en `BookingService.create`, error con prefijo exportado y `startsWith` en el `catch` (E2, E3). |
| P2 | Reloj inyectable | La spec lo deja a criterio del plan. | `getUnbookableReason` recibe `now`; `create()` usa `new Date()`. Sin inyección en el constructor (no hay tests automáticos en el fork). |
| P3 | Estado desconocido en `db/` (**abierta**, informativa) | Si alguien escribe a mano un `status` que no está en `ActivityStatus`, la spec no fija el motivo. | Se trata como `published`/`confirmed` (solo decide la fecha): igual que hoy y sin inventar un mensaje nuevo. Solo ocurre editando `db/` a mano; el cliente ya rechaza esa respuesta por contrato. |
| P4 | Cómo "cambiar a mano la fecha en `db/activities.json`" | `db/activities.json` está vacío; los lanzamientos vienen de `db/seed/activities.json`. | Escribir copias con la fecha cambiada en `db/activities.json` (los persistidos ganan por id); la semilla no se toca (E8). |
| P5 | Ubicación del e2e de R10 | Fichero nuevo o existente. | `booking-creation.spec.ts`, para reutilizar sus helpers locales (C4). |
| P6 | CHANGELOG del fork (**abierta**) | El fork tiene su propio CHANGELOG (del curso). | No se toca, como en `fix-api-user-session`; se anota solo en el del cliente. |
| P7 | Push / merge | — | Merge del fork en `master` antes que el del cliente en `main`; push solo cuando la persona lo pida. Proponerlo a `upstream` queda fuera. |
