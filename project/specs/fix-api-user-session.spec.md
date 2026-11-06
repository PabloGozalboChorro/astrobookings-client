# fix: Login, registro e ids tras reiniciar en el fork de la API

- **Estado:** Aprobada
- **PRD:** F1, F2 (+ D6; afecta también a F9, F13, F14 y F15 por los ids de reservas y pagos; ADD §4.1, endpoints 1, 2 y 5)
- **Rama:** `fix/user-session` (**en el repositorio del fork de `activity-bookings-express`, no en este**)
- **Depende de:** ninguna (los criterios usan la semilla de `chore-seed-space-launches`, ya integrada). **Dependen de esta spec:** `feat-user-session` y `feat-user-registration`.
- **Prioridad:** Must

## Contexto
Con el fork en `master`, el inicio de sesión no funciona nunca y el registro sobrescribe usuarios. La causa está en el orden de arranque:

- `src/index.ts:11` llama a `loadAllData()`, pero los `import` de las líneas 5–8 se evalúan antes. Cada router crea sus servicios a nivel de módulo: `src/routes/auth.ts:11` y `src/routes/users.ts:11` crean **dos** instancias distintas de `UserService` con el mismo `userRepository`.
- El constructor de `UserService` (`src/services/user.service.ts:10-26`) calcula `emailIndex` (`rebuildEmailIndex`, líneas 50–56) y `nextId` a partir del repositorio, que todavía está vacío porque `userRepository.load()` (`src/utils/data-loader.ts:30`) aún no se ha ejecutado.

Consecuencias observadas:

1. `POST /login` responde siempre 401 `Invalid email or password`, también para el usuario que ya existe en `db/users.json`, porque `getByEmail` (`user.service.ts:101-107`) busca en un índice vacío.
2. Tras `POST /users`, el login sigue fallando en el mismo proceso: el registro actualiza el índice de la instancia de `users.ts` (`user.service.ts:84`), pero el login consulta el de `auth.ts`.
3. `POST /users` asigna siempre `user-1` tras arrancar (`user.service.ts:73`) y `JsonRepository.create` (`src/repositories/json.repository.ts:105-109`) sustituye por id al usuario existente y lo guarda en `db/users.json`. Tampoco detecta emails ya registrados en el fichero.

El mismo patrón está en reservas y pagos: `src/routes/bookings.ts:14-16` crea `ActivityService`, `PaymentService` y `BookingService` antes de cargar los datos, y sus constructores calculan `nextId` sobre repositorios vacíos (`src/services/booking.service.ts:27-41`, `src/services/payment.service.ts:14-28`). Tras reiniciar la API con reservas guardadas, la siguiente reserva vuelve a ser `booking-1` con `payment-1` (`booking.service.ts:83`, `payment.service.ts:68`) y **sobrescribe** la reserva y el pago existentes, aunque sean de otra persona. Esto rompe "Mis reservas" (F14, F15) en cuanto se reinicia el fork después de reservar (por ejemplo, tras el smoke e2e).

**Importante:** este cambio se aplica en el repositorio del fork de la API (`activity-bookings-express`), en una rama propia. En este repositorio (cliente) no se modifica ningún fichero. Es un `fix` mínimo: no cambia el contrato de la API (rutas, formas de respuesta, códigos ni mensajes de ADD §4.1).

## Alcance
- **Incluido:**
  - Que `POST /login` y `POST /users` usen los usuarios cargados de `db/users.json` y compartan el mismo estado de usuarios (índice de emails y siguiente id), tanto al arrancar como después de cada registro.
  - Que los ids nuevos de usuarios, reservas y pagos continúen a partir del mayor id existente al arrancar.
  - Comprobación manual con `curl` y `npm run typecheck` en el fork.
- **Excluido:**
  - Cifrado de contraseñas (siguen en claro, como en `master`), cambios en JWT, caducidad o middleware.
  - Cambios en formas de respuesta, códigos o mensajes (por ejemplo, el `user.id` numérico de `AuthResponse`, `routes/auth.ts:32` y `routes/users.ts:32`).
  - El id de las actividades nuevas (`POST /activities`): tiene el mismo defecto (ver notas) pero el cliente no crea actividades.
  - Cambios en `db/` (los datos deben quedar como en `master`) y en este repositorio.
  - Añadir dependencias o un framework de tests al fork.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Cuando una persona usuaria que existe en `db/users.json` al arrancar la API envíe `POST /login` con su email y su contraseña, la API deberá responder 200 con un `AuthResponse` (`user` con `id`, `username`, `email`, `terms` y `accessToken`). |
| R2 | Cuando una persona se registre con `POST /users` y, sin reiniciar la API, envíe `POST /login` con el mismo email y contraseña, la API deberá responder 200 con el mismo `user.id` que devolvió el registro. |
| R3 | Cuando se envíe `POST /login` con un email registrado escrito con otra combinación de mayúsculas y minúsculas y la contraseña correcta, la API deberá responder 200 con el `AuthResponse` de esa persona. |
| R4 | Si en `POST /login` el email no está registrado o la contraseña no coincide, entonces la API deberá responder 401 con `message` `Invalid email or password` y `errors` `[]`, como en `master`. |
| R5 | Cuando una persona se registre con un email nuevo, la API deberá asignarle el id `user-<n+1>`, siendo `n` el mayor número de id de usuario existente (cargado del fichero o creado en el proceso), sin modificar a los usuarios existentes en `db/users.json`. |
| R6 | Si en `POST /users` el email ya está registrado (en `db/users.json` o creado en el proceso), sin distinguir mayúsculas y minúsculas, entonces la API deberá responder 400 con `message` `Email is already registered` y `errors` `[{ "field": "email", "message": "Email is already registered" }]`, sin crear ni modificar usuarios. |
| R7 | Cuando se cree una reserva con `POST /bookings` después de arrancar la API con reservas y pagos guardados, la API deberá asignar `booking-<n+1>` y `payment-<m+1>`, siendo `n` y `m` los mayores números de id existentes, sin sobrescribir reservas ni pagos anteriores. |
| R8 | El fork deberá superar `npm run typecheck` sin errores. |

## Criterios de aceptación

Salvo que se indique otra cosa, "arrancar la API" es `npm run dev` en el fork, con `db/` igual que en `master` (`db/users.json` con un único usuario, `user-1`; `db/bookings.json` y `db/payments.json` con `[]`).

### R1
- **Dado** la API recién arrancada
- **Cuando** se envía `POST /login` con el `email` y la `password` de `user-1` tal como figuran en `db/users.json` (la contraseña está guardada en claro)
- **Entonces** la respuesta es 200, `user.id` es `1`, `user.username` es `"Mark Musk"` y hay un `accessToken`
- **Y** con ese token, `GET /bookings` responde 200 (no 401)

### R2
- **Dado** la API recién arrancada
- **Cuando** se envía `POST /users` con `{ "username": "Ana", "email": "ana@example.com", "password": "secret1", "terms": true }` y a continuación, sin reiniciar, `POST /login` con `{ "email": "ana@example.com", "password": "secret1" }`
- **Entonces** el registro responde 201 con `user.id` `2` y el login responde 200 con `user.id` `2` y `user.email` `"ana@example.com"`
- **Y** tras reiniciar la API, el mismo `POST /login` vuelve a responder 200 con `user.id` `2`

### R3
- **Dado** la API arrancada y `ana@example.com` registrada como en R2
- **Cuando** se envía `POST /login` con `{ "email": "ANA@Example.COM", "password": "secret1" }`
- **Entonces** la respuesta es 200 con `user.id` `2`
- **Y** lo mismo ocurre con el email de `user-1` escrito en mayúsculas

### R4
- **Dado** la API recién arrancada
- **Cuando** se envía `POST /login` con el email de `user-1` y una contraseña distinta, y después con `{ "email": "nadie@example.com", "password": "secret1" }`
- **Entonces** ambas respuestas son 401 con `{ "message": "Invalid email or password", "errors": [] }`

### R5
- **Dado** la API recién arrancada
- **Cuando** se envía `POST /users` con un email nuevo (por ejemplo, `ana@example.com`)
- **Entonces** la respuesta es 201 con `user.id` `2`
- **Y** `db/users.json` contiene dos usuarios: `user-1` con exactamente los mismos campos que en `master` y `user-2` con el email `ana@example.com`
- **Y** un segundo registro con otro email nuevo, sin reiniciar o tras reiniciar, recibe `user.id` `3`

### R6
- **Dado** la API recién arrancada
- **Cuando** se envía `POST /users` con el email de `user-1` escrito en mayúsculas, un `username`, una `password` de 6 o más caracteres y `terms: true`
- **Entonces** la respuesta es 400 con `{ "message": "Email is already registered", "errors": [{ "field": "email", "message": "Email is already registered" }] }`
- **Y** `db/users.json` no cambia
- **Y** lo mismo ocurre al repetir el registro de `ana@example.com` (creada en el proceso) como `Ana@Example.com`

### R7
- **Dado** la API arrancada y una persona con `accessToken` que ha creado una reserva de 1 plaza en `activity-1` (respuesta 201 con `id` `booking-1` y `paymentId` `payment-1`)
- **Cuando** se reinicia la API y esa persona (u otra) crea otra reserva de 1 plaza en `activity-1`
- **Entonces** la respuesta es 201 con `id` `booking-2` y `paymentId` `payment-2`
- **Y** `db/bookings.json` y `db/payments.json` contienen dos elementos cada uno, y `booking-1` conserva su `userId`, `createdAt` y `paymentId` originales
- **Y** `GET /bookings` de la primera persona sigue incluyendo `booking-1`

### R8
- **Dado** el fork con el cambio aplicado
- **Cuando** se ejecuta `npm run typecheck`
- **Entonces** termina sin errores

## Casos límite
- Login inmediatamente después de registrarse, sin reiniciar (R2): es el caso que falla aunque se arreglase solo la carga inicial, porque `auth.ts` y `users.ts` tienen instancias de `UserService` distintas.
- Email con mayúsculas al registrarse: la API ya lo guarda en minúsculas (`user.service.ts:77`) y lo devuelve así en `user.email`; el cambio debe mantener ese comportamiento.
- Email duplicado que solo existe en el fichero (tras reiniciar) frente a email duplicado creado en el mismo proceso: ambos dan 400 (R6).
- Registro con datos no válidos: sigue respondiendo 400 `Validation failed` con `errors[]` por campo, como en `master`; no consume id.
- Ids no consecutivos en el fichero (por ejemplo, `user-1` y `user-5`): el siguiente es `user-6` (mayor + 1, R5). Lo mismo para reservas y pagos (R7).
- Reserva rechazada por pago (402) o por capacidad (400): no crea reserva ni pago (ver `chore-seed-space-launches`, R7 y R9); si consume o no un número de id no es observable para el cliente y queda fuera de la spec.
- Fichero `db/users.json` inexistente o vacío: el primer registro recibe `user-1`.

## Fuera de la spec / notas
- **Corrección del diagnóstico inicial:** `create` sí guarda el email en minúsculas en el índice. `user.service.ts:77` pasa el email a minúsculas al construir `user` y la línea 84 usa `user.email`; `rebuildEmailIndex` (línea 54) y `getByEmail` (línea 102) también usan minúsculas. La comparación sin distinguir mayúsculas falla hoy solo porque el índice está vacío o pertenece a otra instancia; R3 y R6 la fijan como requisito para que no se pierda con el arreglo.
- **Pista para el plan (no es una decisión de la spec):** el fork compila a CommonJS (`tsconfig.json`, `"module": "commonjs"`) y TypeScript coloca los `require` de los `import` antes de cualquier sentencia, así que mover la llamada `loadAllData()` dentro de `index.ts` por encima de los `import` no basta por sí solo. Opciones posibles: cargar los datos en `data-loader.ts` al crear los repositorios, calcular índice y siguiente id de forma perezosa o desde el repositorio (que ya calcula `nextId` en `json.repository.ts:141-160`), o compartir una única instancia de cada servicio. La elige `4-engineer`.
- **Actividades:** `ActivityService` tiene el mismo defecto (`src/routes/activities.ts:11`, `src/services/activity.service.ts:15-31`, id en la línea 61): tras arrancar, `POST /activities` crearía `activity-1` y sobrescribiría el lanzamiento de la semilla en `db/activities.json`. El cliente no crea actividades, por eso queda fuera; si el arreglo elegido lo corrige de paso (por ejemplo, al cargar los datos antes de crear servicios), mejor, pero no es criterio de aceptación. Además hay dos instancias de `ActivityService` (`activities.ts:11` y `bookings.ts:14`), pero solo se usan para leer del repositorio compartido, así que no afectan al cliente.
- **Dependencias:** `feat-user-session` (F2) y `feat-user-registration` (F1) necesitan esta spec para funcionar contra la API real; sus e2e con `page.route` no dependen de ella. El smoke e2e del cliente (`npm run test:e2e:smoke`: registro → reserva → Mis reservas) y las comprobaciones manuales de `feat-booking-creation` y `feat-my-bookings` contra el fork dependen de R2 y R7.
- **Verificación:** los criterios R1–R7 se comprueban a mano con `curl` (o la colección HTTP del fork) contra `http://localhost:3000`, y R8 con `npm run typecheck` en el fork. Para reiniciar se detiene y se vuelve a lanzar `npm run dev`.
- **Datos tras las pruebas:** las pruebas escriben en `db/users.json`, `db/bookings.json` y `db/payments.json`. Al terminar, `db/` debe quedar como en `master` (por ejemplo, `git restore db/` en el fork) y `git status --short db/` no debe mostrar cambios. El commit del fix no incluye ningún fichero de `db/`.
- **Contraseñas:** `db/users.json` guarda las contraseñas en claro (`user.service.ts:78` y `:125`), por eso R1 puede usar la de `user-1` directamente desde el fichero.
- **PRD D2:** su frase "No se modifica el código de la API" se refiere a no exponer las plazas disponibles; no prohíbe arreglar defectos. Esta spec corrige un defecto sin cambiar el contrato, así que no hay excepción que aprobar. El riesgo queda recogido en el ADD §11 (R13).
- **Decisiones de la persona (2026-11-06):** R7 (reservas y pagos) entra en este fix; actividades queda fuera.
