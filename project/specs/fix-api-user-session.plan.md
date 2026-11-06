# Plan: fix-api-user-session

- **Spec:** [fix-api-user-session.spec.md](fix-api-user-session.spec.md)
- **Rama (fork, donde se hace el cambio):** `fix/user-session` creada desde `master` (`3a4a15a`) en `C:\Users\pablo\Desktop\Astrobookings Client\activity-bookings-express`
- **Rama (cliente, solo para este plan):** `fix/user-session` creada desde `main`

> Todo el código cambia en el **fork**. En el repositorio cliente solo cambia este plan. Los AGENTS.md, PRD, ADD y specs propios del fork (del curso) **no** se siguen ni se modifican: manda la spec de este repositorio. Del AGENTS.md del fork solo se respetan sus convenciones de código (TypeScript `strict`, capas Routes → Services → Repositories, código y comentarios en inglés).

## Estado del fork comprobado (2026-11-06, `master` en `3a4a15a`)

| Hecho | Consecuencia para el plan |
|---|---|
| `package.json` solo tiene `dev`, `build`, `prestart`, `start` y `typecheck`. No hay `test` ni carpeta `tests/` con framework instalado (el AGENTS.md del fork cita Playwright, pero no está en las dependencias). | La spec excluye añadir un framework. Verificación: `npm run typecheck`, `npm run build` y `curl` (C0–C9). |
| `tsconfig.json`: `"module": "commonjs"`. Los `require` de los `import` de `src/index.ts` se ejecutan antes de `loadAllData()` (línea 11). | Mover `loadAllData()` en `index.ts` no sirve (confirma la nota de la spec). |
| `JsonRepository` (`src/repositories/json.repository.ts`) ya calcula su propio `nextId` en `load()` (`calculateNextId`, líneas 141–153) y lo expone con `getNextId()` (líneas 158–160). **Ningún servicio lo usa**: `UserService`, `BookingService`, `PaymentService` y `ActivityService` copian ese cálculo en su constructor, sobre el repositorio aún vacío. | La solución elegida (E1) usa `getNextId()` del repositorio compartido. |
| `getById`, `getAll` y las consultas de reservas (`booking.service.ts`: por actividad y por usuario) ya leen el repositorio **en cada llamada**: funcionan bien. Solo fallan los valores calculados en el constructor (`emailIndex` y los cuatro `nextId`). | El cambio se limita a esos valores. |
| `db/users.json` en `master`: un único usuario `user-1` ("Mark Musk", email `m@f.c`, contraseña `1234aB` en claro). `db/bookings.json` y `db/payments.json` = `[]`. `core.autocrlf=true`. | Datos de los `curl`. Al final, `git restore db/`. |
| **Bug reproducido antes del cambio** (API en `master`, recién arrancada): `POST /login` de `m@f.c` → `401 Invalid email or password`; `POST /users` de `ana@example.com` → `201` con `"id":1` y **sobrescribe a Mark Musk en `db/users.json`**; `POST /login` de `ana@example.com` justo después → `401`. Se paró la API (node PID 14096 en el puerto 3000) y se hizo `git restore db/`. | C0 es la prueba que falla primero; se repite tal cual en T0. |
| Al parar el `npm run dev` lanzado en segundo plano, la tarea termina con código 127: es el efecto de matar el proceso, no un error. | Inofensivo. |

## Solución técnica

**Elegida (E1): que los servicios lean el estado del repositorio compartido en el momento de cada operación, en lugar de copiarlo en el constructor.**

- `UserService`: se eliminan `emailIndex`, `rebuildEmailIndex()` y el `nextId` propio. `getByEmail(email)` busca en `this.repository.getAll()` comparando `email.toLowerCase()`; `create()` comprueba el duplicado con `getByEmail()` y obtiene el id con `user-${this.repository.getNextId()}` **después** de validar y de comprobar el duplicado (un registro rechazado no consume id).
- `BookingService` y `PaymentService`: se elimina el `nextId` propio y el bucle del constructor; los ids salen de `this.repository.getNextId()`.
- No cambian `src/index.ts`, `src/utils/data-loader.ts`, `src/repositories/`, `src/routes/` ni ningún tipo: el contrato de la API queda igual (rutas, formas de respuesta, códigos y mensajes, incluido `Email already registered` → `Email is already registered` en `routes/users.ts`).

**Por qué funciona:** `loadAllData()` se ejecuta antes de `app.listen()`, así que cuando llega la primera petición los cuatro repositorios ya están cargados y su `nextId` es `mayor + 1`. Hay una única instancia de cada repositorio (exportada por `data-loader.ts`), por lo que las dos instancias de `UserService` (`auth.ts` y `users.ts`) comparten usuarios y contador: R2 se cumple sin tocar las rutas.

| Alternativa (notas de la spec) | Por qué no |
|---|---|
| Cargar los datos en `data-loader.ts` al crear los repositorios (o llamar a `loadAllData()` al final del módulo). | Arregla el arranque (R1, R5, R7 y de paso actividades), pero **no R2**: el registro sigue actualizando el `emailIndex` de la instancia de `users.ts` y el login consulta el de `auth.ts`. Habría que combinarla con otra de las dos opciones. Además deja la corrección dependiendo del orden de evaluación de los módulos y convierte un `import` en una lectura de disco con efectos. |
| Compartir una única instancia de cada servicio (por ejemplo, un módulo que exporte `userService`). | Por sí sola tampoco arregla nada: la instancia compartida se seguiría creando antes de `loadAllData()`. Necesita además la carga anticipada; toca más ficheros (nuevo módulo + 3 rutas + `data-loader`/`index`). |
| Cálculo perezoso del índice y del `nextId` dentro de cada servicio (calcular en la primera llamada). | Cumple R1 y R7, pero con dos instancias de `UserService` sigue habiendo dos índices y dos contadores: falla R2 salvo que además se comparta la instancia. |
| **E1: leer del repositorio en cada operación (`getAll()` / `getNextId()`).** | Cumple R1–R7 con **una sola fuente de verdad** (el repositorio), no depende del orden de carga ni del número de instancias, reutiliza la API que el repositorio ya ofrece para esto ("for services that need to generate IDs") y elimina código duplicado en lugar de añadirlo. Coste: `getByEmail` pasa de O(1) a O(n) sobre los usuarios en memoria, irrelevante en este proyecto de formación. |

**Actividades:** E1 **no** las corrige de paso; `ActivityService` sigue calculando su `nextId` en el constructor. Arreglarlo es el mismo cambio de dos líneas en `activity.service.ts` (tarea opcional T5, ver "Puntos a decidir"). La spec lo deja fuera de alcance.

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| E1 | Ids y búsqueda por email desde el repositorio compartido (ver "Solución técnica"). | Mínima, robusta frente al orden de carga y a varias instancias. |
| E2 | En `UserService.create()`, el orden es: validar → comprobar duplicado → `getNextId()` → construir el usuario (email en minúsculas, como ahora) → `repository.create()`. | R6 y el caso límite "registro no válido no consume id". |
| E3 | En `BookingService.create()` se mantiene el orden actual: el id de reserva se pide antes del cobro. Si el pago falla (402) ese número queda consumido. | La spec lo deja fuera ("no es observable para el cliente"); cambiarlo alteraría más código. |
| E4 | Las ramas `else` de los constructores (sin repositorio, "backward compatibility") se conservan, quitando solo el cálculo de `nextId`/índice, porque ya llaman a `this.repository.load()`. | Cambio mínimo; ninguna ruta usa esa rama. |
| E5 | Sin comentarios nuevos salvo un JSDoc breve si se reescribe `getByEmail`; código en inglés. | Convenciones del fork y del AGENTS.md del cliente. |
| E6 | Las pruebas manuales se hacen en **Git Bash** con `curl` real; parar la API siempre por el puerto (`Get-NetTCPConnection` + `Stop-Process`), nunca solo la tarea en segundo plano (puede dejar un `node` huérfano escuchando). | Igual que en `chore-seed-space-launches`; evita APIs con datos viejos en memoria. |
| E7 | Los ficheros temporales (log de la API, copias de `db/` para comparar) van al scratchpad de la sesión, fuera de los dos repos. | No se añaden ficheros al fork. |

## Plan de pruebas

Todas las comprobaciones desde la raíz del fork en Git Bash. `S` es una carpeta temporal fuera de los repos (por ejemplo, el scratchpad de la sesión).

| Requisito | Test | Nivel | Paso |
|---|---|---|---|
| (todos) | **antes del cambio** el login de `user-1` debería dar 401 y el registro de Ana `id 1` sobrescribiendo `user-1` (prueba que falla primero) | manual (`curl`) | C0 |
| R8 | `npm run typecheck` debería terminar sin errores (y `npm run build` también) | compilación | C1 |
| R4 | login con contraseña incorrecta de `m@f.c` y con `nadie@example.com` debería dar 401 `{"message":"Invalid email or password","errors":[]}` | manual | C3 |
| R1 | login de `m@f.c` / `1234aB` debería dar 200, `user.id` 1, `"Mark Musk"`, `accessToken`; `GET /bookings` con ese token debería dar 200 | manual | C4 |
| R3 | login de `M@F.C` debería dar 200 `id` 1; tras registrar a Ana, `ANA@Example.COM` debería dar 200 `id` 2 | manual | C4, C6 |
| R6 | registro de `M@F.C` y después de `Ana@Example.com` debería dar 400 `Email is already registered` con `errors[{field:"email"…}]` y no cambiar `db/users.json` | manual + `node` | C5, C6 |
| R5 | registro no válido no consume id; Ana recibe `id` 2; `user-1` igual que en `master`; tras reiniciar, Bea recibe 3 y Carla (sin reiniciar) 4 | manual + `node` | C5, C6, C8 |
| R2 | registro de Ana 201 `id` 2 y login inmediato 200 `id` 2; tras reiniciar, login 200 `id` 2 | manual | C6, C8 |
| R7 | reserva 1 → `booking-1`/`payment-1`; tras reiniciar, otra persona reserva → `booking-2`/`payment-2`; 2 elementos en cada fichero; `booking-1` intacta; `GET /bookings` de Ana incluye `booking-1` | manual + `node` | C7, C9 |
| (exclusiones) | al final `git status --short` solo muestra `src/services/*.service.ts`; `db/` sin cambios | git | C10 |

### Utilidades (definir una vez por terminal de Git Bash)

```bash
cd "/c/Users/pablo/Desktop/Astrobookings Client/activity-bookings-express"
S=/c/Users/pablo/AppData/Local/Temp/claude/ba248153ea8ddf2d/6ce9f79e-d6fe-4f65-b830-bad457df6b23/scratchpad   # o cualquier carpeta temporal fuera de los repos
BASE=http://localhost:3000
J='Content-Type: application/json'
# Extrae un campo de un JSON por stdin: echo '{"a":{"b":1}}' | jget a.b
jget() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v[k];process.stdout.write(typeof v==="object"?JSON.stringify(v):String(v))})' "$1"; }
# Para la API escuchando en el puerto 3000 (y solo esa)
stop_api() { powershell.exe -NoProfile -Command 'Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Get-Process -Id $_.OwningProcess | Select-Object Id,ProcessName; Stop-Process -Id $_.OwningProcess -Force }'; sleep 1; netstat -ano | grep ":3000 " | grep LISTENING || echo "puerto 3000 libre"; }
# Espera a que la API responda
wait_api() { for i in $(seq 1 30); do curl -s "$BASE/health" && echo && return 0; sleep 1; done; echo "la API no arranca: mira $S/api.log"; return 1; }
```

**Arrancar la API:** con la herramienta Bash en segundo plano (`run_in_background`) o en otra terminal: `cd "/c/Users/pablo/Desktop/Astrobookings Client/activity-bookings-express" && npm run dev > "$S/api.log" 2>&1`, y después `wait_api`. **Reiniciar** = `stop_api`, arrancar de nuevo, `wait_api`. Antes de la primera arrancada, `stop_api` debe decir "puerto 3000 libre" sin haber parado nada; si para un proceso que no es un `node` del fork, se pregunta a la persona.

En PowerShell 5.1 (alternativa a `stop_api`), con PATH refrescado (`$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`):

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### C0 — Prueba que falla primero (código de `master`, antes de T1)

Con `db/` como en `master` (`git status --short db/` vacío), arrancar la API y:

```bash
curl -s -w "\n%{http_code}\n" -X POST "$BASE/login" -H "$J" -d '{"email":"m@f.c","password":"1234aB"}'
curl -s -w "\n%{http_code}\n" -X POST "$BASE/users" -H "$J" -d '{"username":"Ana","email":"ana@example.com","password":"secret1","terms":true}'
curl -s -w "\n%{http_code}\n" -X POST "$BASE/login" -H "$J" -d '{"email":"ana@example.com","password":"secret1"}'
node -e 'const u=require("./db/users.json");console.log(u.length, u[0].id, u[0].username)'
stop_api; git restore db/; git status --short db/
```

Esperado **con el bug** (resultado real al planificar): `401 Invalid email or password`; `201` con `"id":1`; `401`; `1 user-1 Ana` (Mark Musk sobrescrito). Después, puerto libre y `git status --short db/` vacío.

### C1 — R8

```bash
npm run typecheck && npm run build && echo "R8 OK"
git status --short   # dist/ está en .gitignore: no debe aparecer
```

### Sesión 1 (API recién arrancada con `db/` igual que en `master`): C2–C7

#### C2 — Copia de referencia

```bash
git status --short db/                        # vacío
git show master:db/users.json > "$S/users.master.json"
```

#### C3 — R4

```bash
curl -s -w "\n%{http_code}\n" -X POST "$BASE/login" -H "$J" -d '{"email":"m@f.c","password":"wrong-pass"}'
curl -s -w "\n%{http_code}\n" -X POST "$BASE/login" -H "$J" -d '{"email":"nadie@example.com","password":"secret1"}'
```

Esperado: dos veces `{"message":"Invalid email or password","errors":[]}` y `401`.

#### C4 — R1 y R3 (usuario del fichero)

```bash
R=$(curl -s -X POST "$BASE/login" -H "$J" -d '{"email":"m@f.c","password":"1234aB"}'); echo "$R"
echo "$R" | jget user.id; echo; echo "$R" | jget user.username; echo
TOKEN_MARK=$(echo "$R" | jget accessToken)
curl -s -w "\n%{http_code}\n" "$BASE/bookings" -H "Authorization: Bearer $TOKEN_MARK"
curl -s -w "\n%{http_code}\n" -X POST "$BASE/login" -H "$J" -d '{"email":"M@F.C","password":"1234aB"}'
```

Esperado: `200` con `"user":{"id":1,"username":"Mark Musk","email":"m@f.c","terms":true}` y `accessToken`; `1` y `Mark Musk`; `GET /bookings` → `[]` y `200`; login en mayúsculas → `200` con `"id":1`.

#### C5 — R6 (duplicado del fichero) y "registro no válido no consume id"

```bash
curl -s -w "\n%{http_code}\n" -X POST "$BASE/users" -H "$J" -d '{"username":"Otro Mark","email":"M@F.C","password":"secret1","terms":true}'
git diff --quiet -- db/users.json && echo "R6 users.json sin cambios OK"
curl -s -w "\n%{http_code}\n" -X POST "$BASE/users" -H "$J" -d '{"username":"Sin Terms","email":"sin-terms@example.com","password":"secret1","terms":false}'
```

Esperado: `{"message":"Email is already registered","errors":[{"field":"email","message":"Email is already registered"}]}` y `400`; `R6 users.json sin cambios OK`; después `400` con `"message":"Validation failed"` y un error en `terms`.

#### C6 — R2, R3, R5 y R6 (usuaria creada en el proceso)

```bash
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/users" -H "$J" -d '{"username":"Ana","email":"ana@example.com","password":"secret1","terms":true}'); echo "$R"
R=$(curl -s -X POST "$BASE/login" -H "$J" -d '{"email":"ana@example.com","password":"secret1"}'); echo "$R"
TOKEN_ANA=$(echo "$R" | jget accessToken)
curl -s -w "\n%{http_code}\n" -X POST "$BASE/login" -H "$J" -d '{"email":"ANA@Example.COM","password":"secret1"}'
S="$S" node -e 'const fs=require("fs"),assert=require("assert");const u=JSON.parse(fs.readFileSync("db/users.json","utf8"));const m=JSON.parse(fs.readFileSync(process.env.S+"/users.master.json","utf8"));assert.strictEqual(u.length,2,"R5: debería haber 2 usuarios");assert.deepStrictEqual(u.find(x=>x.id==="user-1"),m[0],"R5: user-1 cambió");assert.strictEqual(u.find(x=>x.id==="user-2").email,"ana@example.com");console.log("R5 users.json OK")'
cp db/users.json "$S/users.after-ana.json"
curl -s -w "\n%{http_code}\n" -X POST "$BASE/users" -H "$J" -d '{"username":"Ana Bis","email":"Ana@Example.com","password":"secret1","terms":true}'
cmp -s db/users.json "$S/users.after-ana.json" && echo "R6 users.json sin cambios OK"
```

Esperado: registro `201` con `"id":2` (el registro no válido de C5 no consumió id); login `200` con `"id":2` y `"email":"ana@example.com"`; login en mayúsculas `200` con `"id":2`; `R5 users.json OK`; registro duplicado `400 Email is already registered` (mismo cuerpo que en C5); `R6 users.json sin cambios OK`.

#### C7 — R7 (primera reserva)

```bash
curl -s -w "\n%{http_code}\n" -X POST "$BASE/bookings" -H "Authorization: Bearer $TOKEN_ANA" -H "$J" -d '{"activityId":"activity-1","participants":1}'
cp db/bookings.json "$S/bookings.after-1.json"
```

Esperado: `201` con `"id":"booking-1"`, `"userId":"user-2"`, `"paymentId":"payment-1"`, `"paymentStatus":"paid"`.

### Reinicio

```bash
stop_api
# arrancar de nuevo npm run dev (en segundo plano) y:
wait_api
```

### Sesión 2 (API reiniciada, con Ana, una reserva y un pago guardados): C8–C9

#### C8 — R2 (tras reiniciar) y R5 (siguiente id tras reiniciar y sin reiniciar)

```bash
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/login" -H "$J" -d '{"email":"ana@example.com","password":"secret1"}'); echo "$R"
TOKEN_ANA=$(echo "$R" | head -n1 | jget accessToken)
curl -s -w "\n%{http_code}\n" -X POST "$BASE/users" -H "$J" -d '{"username":"Bea","email":"bea@example.com","password":"secret1","terms":true}'
curl -s -w "\n%{http_code}\n" -X POST "$BASE/users" -H "$J" -d '{"username":"Carla","email":"carla@example.com","password":"secret1","terms":true}'
node -e 'const u=require("./db/users.json");console.log(u.map(x=>x.id).join(","))'
```

Esperado: login `200` con `"id":2`; Bea `201` con `"id":3`; Carla `201` con `"id":4`; `user-1,user-2,user-3,user-4`.

#### C9 — R7 (reserva tras reiniciar, por otra persona)

```bash
TOKEN_MARK=$(curl -s -X POST "$BASE/login" -H "$J" -d '{"email":"m@f.c","password":"1234aB"}' | jget accessToken)
curl -s -w "\n%{http_code}\n" -X POST "$BASE/bookings" -H "Authorization: Bearer $TOKEN_MARK" -H "$J" -d '{"activityId":"activity-1","participants":1}'
S="$S" node -e 'const fs=require("fs"),assert=require("assert");const b=JSON.parse(fs.readFileSync("db/bookings.json","utf8")),p=JSON.parse(fs.readFileSync("db/payments.json","utf8"));const b1=JSON.parse(fs.readFileSync(process.env.S+"/bookings.after-1.json","utf8"))[0];assert.strictEqual(b.length,2,"R7 bookings");assert.strictEqual(p.length,2,"R7 payments");const now=b.find(x=>x.id==="booking-1");for(const k of ["userId","createdAt","paymentId"])assert.strictEqual(now[k],b1[k],"R7 booking-1."+k);assert.deepStrictEqual(p.map(x=>x.id).sort(),["payment-1","payment-2"]);console.log("R7 ficheros OK")'
curl -s "$BASE/bookings" -H "Authorization: Bearer $TOKEN_ANA" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);if(!a.some(x=>x.id==="booking-1"))throw new Error("R7: falta booking-1");console.log("R7 GET /bookings OK")})'
```

Esperado: `201` con `"id":"booking-2"`, `"userId":"user-1"` y `"paymentId":"payment-2"`; `R7 ficheros OK`; `R7 GET /bookings OK`.

### C10 — Limpieza y estado final

```bash
stop_api
git restore db/
ls db/*.tmp 2>/dev/null || echo "sin .tmp"
git status --short
git diff --stat
```

Esperado: "puerto 3000 libre"; `git status --short` muestra **solo** ` M src/services/user.service.ts`, ` M src/services/booking.service.ts`, ` M src/services/payment.service.ts` (y ` M src/services/activity.service.ts` si se aprueba T5); nada en `db/`, `src/routes/`, `src/index.ts`, `src/utils/` ni `src/repositories/`.

## Tareas

Todas en el fork, rama `fix/user-session`.

- [x] **T0** — Comprobaciones previas: rama `fix/user-session`, árbol limpio, puerto 3000 libre (`stop_api` sin parar nada), `db/` igual que en `master`; ejecutar **C0** y ver que **falla** como se describe; `stop_api` y `git restore db/`. · Requisitos: R1, R2, R5 (reproducción) · Ficheros: ninguno (la API escribe `db/users.json`; se restaura)
- [x] **T1** — `UserService`: quitar `emailIndex`, `rebuildEmailIndex()` y el `nextId` propio (y su cálculo en las dos ramas del constructor); `getByEmail()` busca en `this.repository.getAll()` sin distinguir mayúsculas; `create()` usa `getByEmail()` para el duplicado y `this.repository.getNextId()` para el id, en el orden de E2. `npm run typecheck` en verde. · Requisitos: R1, R2, R3, R4, R5, R6 · Ficheros: `src/services/user.service.ts`
- [x] **T2** — `BookingService` y `PaymentService`: quitar el `nextId` propio y su cálculo en el constructor; ids con `this.repository.getNextId()`. `npm run typecheck` en verde. · Requisitos: R7 · Ficheros: `src/services/booking.service.ts`, `src/services/payment.service.ts`
- [x] **T3** — Compilación: C1. · Requisitos: R8 · Ficheros: ninguno
- [x] **T4** — Verificación manual: arrancar la API con `db/` de `master` y ejecutar C2–C7, reiniciar y ejecutar C8–C9. Anotar respuestas reales (cuerpo y código) para el informe del tester. · Requisitos: R1–R7 · Ficheros: ninguno (la API escribe `db/users.json`, `db/bookings.json`, `db/payments.json`; se restauran en T6)
- [ ] **T5** *(opcional; no aprobada: fuera de alcance)* — `ActivityService`: mismo cambio que T2 (`activity-${this.repository.getNextId()}`). Verificación: con la API recién arrancada, `POST /activities` autenticado con un cuerpo válido → `201` con `"id":"activity-10"` y `GET /activities` sigue teniendo los 9 de la semilla; después `git restore db/`. · Requisitos: ninguno (fuera de alcance de la spec) · Ficheros: `src/services/activity.service.ts`
- [x] **T6** — Limpieza: C10 (parar la API por el puerto, `git restore db/`, sin `.tmp`, `git status` solo con los servicios). · Requisitos: exclusiones de la spec · Ficheros: `db/` vuelve a `master`

Repositorio cliente: ningún cambio salvo este plan.

## Definición de terminado
- [x] Todas las tareas marcadas (T5 no aprobada: fuera de alcance)
- [x] C0 falló antes del cambio; C1–C9 en verde después (tester: R1–R8 en verde, con dos reinicios y casos límite)
- [x] `npm run typecheck` y `npm run build` en verde en el fork (no hay `lint` ni `test` en el fork, ni se añaden)
- [x] Puerto 3000 libre y ningún `node` del fork corriendo al terminar
- [x] En el fork, `git status` solo muestra los ficheros de `src/services/` de las tareas; `db/` igual que en `master`; el commit no incluye `db/`
- [x] Sin cambios en el repositorio cliente salvo este plan y el CHANGELOG
- [x] Commit en el fork: `e80ba70 fix(services): read users, bookings and payments state from repository`, enlazando la spec del cliente
- [x] CHANGELOG: anotado solo en el del cliente (sección *Fixed*)

## Riesgos
1. **Ids "quemados":** con E3, una reserva rechazada por pago (402) consume un número de reserva (ya ocurría en `master`). Fuera de la spec; puede hacer que el smoke e2e vea `booking-2` donde esperaba `booking-1` si hay un 402 previo.
2. **`getByEmail` lineal:** O(n) por login y registro. Irrelevante con decenas de usuarios.
3. **Datos de pruebas en `db/`:** si la API sigue arrancada tras `git restore db/`, una petición posterior puede volver a escribir. Por eso C10 para la API **antes** de restaurar.
4. **Node huérfano:** parar solo la tarea en segundo plano puede dejar `node` escuchando en el 3000 con datos viejos en memoria; usar siempre `stop_api`.
5. **Actividades sin corregir (si no se aprueba T5):** `POST /activities` seguiría creando `activity-1` y sobrescribiendo el primer lanzamiento de la semilla en `db/activities.json`. El cliente no crea actividades.

## Puntos a decidir por la persona
1. **Solución E1** (servicios leen del repositorio) frente a "carga anticipada + instancia compartida": confirmar E1.
2. **T5 (actividades):** incluir el mismo arreglo en `ActivityService` (dos líneas, mismo patrón, evita sobrescribir la semilla) o dejarlo fuera como dice la spec. Propuesta: dejarlo fuera para respetar el alcance aprobado, salvo que la persona amplíe la spec.
3. **Push / PR del fork:** hacer push y merge a `master` solo cuando la persona lo pida.
