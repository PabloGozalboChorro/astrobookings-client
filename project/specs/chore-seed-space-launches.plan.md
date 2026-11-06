# Plan: chore-seed-space-launches

- **Spec:** [chore-seed-space-launches.spec.md](chore-seed-space-launches.spec.md)
- **Rama (fork, donde se hace el cambio):** `chore/seed-space-launches` creada desde `master` en `C:\Users\pablo\Desktop\Astrobookings Client\activity-bookings-express`
- **Rama (cliente, solo para este plan):** `chore/seed-space-launches` creada desde `main`

> Todo el trabajo de datos se hace en el **fork**. En el repositorio cliente solo cambia este plan. Los AGENTS.md, PRD, ADD y specs propios del fork (del curso) **no** se siguen ni se modifican: manda la spec de este repositorio.

## Estado del fork comprobado (2026-11-06, `master` en `68704a5`)

| Hecho | Consecuencia para el plan |
|---|---|
| `db/users.json` contiene `user-1` ("Mark Musk"). | Se cumple la precondición de la spec: `userId: "user-1"` es válido. No se toca `db/users.json`. |
| `db/seed/activities.json` y `db/activities.json` traen actividades de ejemplo (yoga, surf, bici…). | Hay que reescribir la semilla y vaciar `db/activities.json` (riesgo R4 del ADD). |
| `db/bookings.json` y `db/payments.json` ya contienen exactamente `[]` (2 bytes, sin salto de línea). | R5 para estos dos ficheros ya se cumple en `master`; solo hay que **dejarlos igual** tras las pruebas manuales. |
| `src/index.ts` → `loadAllData()` solo **lee** (`JsonRepository.load`): el arranque **no escribe** ningún `db/*.json`. | Arrancar la API no ensucia el repo. |
| Escriben en disco (`JsonRepository.save` → `writeJsonFile`, escritura atómica con `.tmp` + `rename`): `POST /users` (→ `db/users.json`), `POST /bookings` con éxito (→ `db/payments.json` y `db/bookings.json`), y `POST/PUT/DELETE /activities`. Un `POST /bookings` con 400 o 402 **no** escribe nada. | Tras R6–R9 cambian `db/users.json` (registro de R7–R9) y `db/bookings.json` + `db/payments.json` (R8). Se restauran con `git checkout` (T5). |
| Los datos se cargan **en memoria al arrancar**. | Una API ya arrancada antes del cambio sigue sirviendo los datos antiguos: hay que pararla y volver a arrancarla. Al hacer la comprobación, el puerto 3000 estaba ocupado por un proceso (PID 13300), probablemente un `npm run dev` anterior. |
| Registro `POST /users`: exige `username` no vacío, `email` válido y único, `password` de 6 caracteres o más y `terms === true`; responde 201 `{ user, accessToken }`. Login `POST /login` `{ email, password }` → 200 `{ user, accessToken }`. `POST /bookings` exige `Authorization: Bearer <token>`. | Comandos `curl` exactos en T4. |
| Capacidad: `available = maxParticipants − Σ participants` de las reservas de esa actividad; mensaje `Capacity exceeded. Available: X, Requested: Y`. Pasarela simulada: falla si `price × N` es múltiplo de 1000 → 402 `Payment could not be processed`. | Coincide con R7–R9. |
| `core.autocrlf=true`; los JSON del índice están en LF (`i/lf w/crlf`). | Se escribe en LF y UTF-8 sin BOM; Git puede avisar "LF will be replaced by CRLF": es inofensivo. |

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| E1 | `db/seed/activities.json` se escribe con la herramienta **Write** (o con `node`), en **UTF-8 sin BOM**, con sangría de 2 espacios, campos en el orden de la spec (`id`, `name`, `slug`, `price`, `date`, `duration`, `location`, `minParticipants`, `maxParticipants`, `status`, `userId`, `createdAt`) y sin `updatedAt`. Nunca `Set-Content` / `Out-File` de PowerShell 5.1. | En PS 5.1 esos cmdlets escriben en ANSI o con BOM y estropearían `·` (U+00B7) y las tildes (R2). |
| E2 | `db/activities.json` se deja con exactamente `[]` (2 bytes, sin salto de línea), igual que `bookings.json` y `payments.json` en `master`: `node -e "require('fs').writeFileSync('db/activities.json','[]')"`. | Mismo formato que los otros dos ficheros vacíos; la comprobación de R5 compara literalmente. |
| E3 | Las pruebas manuales se hacen con **Git Bash** (herramienta Bash) y `curl` real. En PowerShell 5.1, `curl` es un alias de `Invoke-WebRequest` y las comillas de JSON a ejecutables nativos se pierden; si se usa PowerShell, hay que llamar a `curl.exe` con `--data-binary @fichero.json`. | Comandos reproducibles y sin problemas de comillas. |
| E4 | Para R7–R9 se registra una persona nueva (`POST /users` con `terms: true`). Esto modifica `db/users.json`, que la spec excluye, así que en T5 se restaura con `git checkout -- db/users.json`. Alternativa (ver "Puntos a decidir"): hacer login con `user-1` de `db/users.json`, que no escribe en `users.json`. | Las reservas de R8 se hacen con una persona propia; la restauración deja `users.json` idéntico a `master`. |
| E5 | Orden de las pruebas manuales: R6 → R9 → R7 → R8. | R9 necesita `activity-1` sin reservas; R7 necesita que la persona aún no tenga reservas (comprueba `GET /bookings` = `[]`); R8 es la única que escribe reservas/pagos y va al final. |
| E6 | Los scripts de comprobación de R1–R6 se guardan en el **scratchpad** de la sesión (fuera de los dos repos), no en el fork. | Es un cambio solo de datos; no se añaden ficheros al fork. |
| E7 | La comprobación de R1 lee la **tabla de datos de la propia spec** (`../astrobookings-client/project/specs/chore-seed-space-launches.spec.md`), construye los 9 objetos esperados y los compara con `assert.deepStrictEqual` (valores, tipos, orden de los elementos y ausencia de campos extra). | Evita copiar a mano los datos esperados en el test; si la semilla y la spec divergen, falla. El script se ha probado: falla con la semilla actual y pasa con los datos generados desde la tabla. |

## Plan de pruebas

Todas las comprobaciones se ejecutan desde la raíz del fork (`cd "/c/Users/pablo/Desktop/Astrobookings Client/activity-bookings-express"`), en Git Bash. `$S` es el scratchpad de la sesión (`/c/Users/pablo/AppData/Local/Temp/claude/ba248153ea8ddf2d/a493cf1b-e09e-4e93-8734-ff8dd1461aea/scratchpad`, o cualquier carpeta temporal fuera de los repos).

| Requisito | Test | Nivel | Fichero / comando |
|---|---|---|---|
| R1 | la semilla debería ser igual (`deepStrictEqual`) a los 9 objetos construidos desde la tabla de la spec con `userId` `user-1` y `createdAt` `2026-11-01T10:00:00.000Z` | fichero (`node`) | `$S/check-seed.js` (C1) |
| R2 | el fichero debería no tener BOM, parsear como JSON UTF-8 y `activity-2.name` debería ser `"Starship · Órbita Marciana"` con U+00B7 entre espacios | fichero (`node`) | `$S/check-seed.js` (C1) + C2 |
| R3 | cada lanzamiento debería cumplir `1 ≤ min ≤ max` y `3 ≤ max ≤ 12` | fichero (`node -e`) | C3 |
| R4 | cada precio salvo `activity-3` debería ser impar, no múltiplo de 5, y ningún `price × N` (1 ≤ N ≤ max) múltiplo de 1000; `activity-3.price` debería ser `12500` | fichero (`node -e`) | C4 |
| R5 | `db/activities.json`, `db/bookings.json` y `db/payments.json` deberían contener exactamente `[]` | fichero (`node -e`) | C5 |
| R6 | `GET /activities` debería devolver 200 con los 9 ids de la semilla (incluido `activity-7` `draft`) y ningún nombre de las actividades originales de `master` | manual (`curl` + `node`) | C6 |
| R9 | `POST /bookings` `{activity-1, 7}` debería responder 400 `Capacity exceeded. Available: 6, Requested: 7` | manual (`curl`) | C9 |
| R7 | `POST /bookings` `{activity-3, 2}` debería responder 402 `Payment could not be processed` y `GET /bookings` seguir en `[]` | manual (`curl`) | C7 |
| R8 | `POST /bookings` `{activity-3, 1}` debería responder 201 con `paymentStatus: "paid"` | manual (`curl`) | C8 |

### C1 — R1 y R2 (script de comprobación de la semilla)

```bash
S=/c/Users/pablo/AppData/Local/Temp/claude/ba248153ea8ddf2d/a493cf1b-e09e-4e93-8734-ff8dd1461aea/scratchpad
cat > "$S/check-seed.js" <<'EOF'
const fs = require('fs'), assert = require('assert');
const spec = fs.readFileSync('../astrobookings-client/project/specs/chore-seed-space-launches.spec.md', 'utf8');
const rows = spec.split(/\r?\n/).filter(l => /^\| activity-\d+ \|/.test(l));
const numeric = ['price', 'duration', 'minParticipants', 'maxParticipants'];
const keys = ['id', 'name', 'slug', 'price', 'date', 'duration', 'location', 'minParticipants', 'maxParticipants', 'status'];
const expected = rows.map(line => {
  const cells = line.split('|').slice(1, -1).map(c => c.trim());
  const item = {};
  keys.forEach((k, i) => { item[k] = numeric.includes(k) ? Number(cells[i]) : cells[i]; });
  return { ...item, userId: 'user-1', createdAt: '2026-11-01T10:00:00.000Z' };
});
const buf = fs.readFileSync('db/seed/activities.json');
assert.ok(!(buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF), 'R2: el fichero tiene BOM');
const actual = JSON.parse(buf.toString('utf8'));
assert.strictEqual(expected.length, 9, 'la tabla de la spec debería tener 9 filas');
assert.deepStrictEqual(actual, expected, 'R1: la semilla no coincide con la tabla de la spec');
console.log('R1 y R2 OK');
EOF
node "$S/check-seed.js"
```

Esperado: `R1 y R2 OK`. (Antes de T1 debe fallar con `R1: la semilla no coincide…`: comprobación negativa.)

### C2 — R2 (comando literal del criterio de aceptación + U+00B7)

```bash
node -e "JSON.parse(require('fs').readFileSync('db/seed/activities.json','utf8'))" && echo "JSON OK"
node -e 'const a=JSON.parse(require("fs").readFileSync("db/seed/activities.json","utf8"));const n=a.find(x=>x.id==="activity-2").name;if(n!=="Starship \u00b7 \u00d3rbita Marciana")throw new Error("R2: "+JSON.stringify(n));console.log("R2 OK", n.codePointAt(9).toString(16))'
```

Esperado: `JSON OK` y `R2 OK b7`.

### C3 — R3

```bash
node -e 'const a=require("./db/seed/activities.json");const bad=a.filter(x=>!(1<=x.minParticipants&&x.minParticipants<=x.maxParticipants&&x.maxParticipants>=3&&x.maxParticipants<=12));if(bad.length)throw new Error("R3: "+bad.map(x=>x.id));const s=a.find(x=>x.id==="activity-4");if(s.minParticipants!==2||s.maxParticipants!==3)throw new Error("R3: activity-4");console.log("R3 OK")'
```

### C4 — R4

```bash
node -e 'const a=require("./db/seed/activities.json");const bad=[];for(const x of a){if(x.id==="activity-3")continue;if(x.price%2===0||x.price%5===0)bad.push(x.id+" precio");for(let n=1;n<=x.maxParticipants;n++)if((x.price*n)%1000===0)bad.push(x.id+" N="+n)}if(a.find(x=>x.id==="activity-3").price!==12500)bad.push("activity-3 precio");if(bad.length)throw new Error("R4: "+bad);console.log("R4 OK")'
```

### C5 — R5

```bash
node -e 'const fs=require("fs");const bad=["db/activities.json","db/bookings.json","db/payments.json"].filter(f=>fs.readFileSync(f,"utf8")!=="[]");if(bad.length)throw new Error("R5: "+bad);console.log("R5 OK")'
```

### Arranque de la API (para C6–C9)

1. Parar cualquier API que esté escuchando en el puerto 3000 (tiene los datos antiguos en memoria):
   ```bash
   netstat -ano | grep ":3000 " | grep LISTENING   # anota el PID
   taskkill //PID <PID> //T //F                     # solo si es el npm run dev del fork
   ```
   Si el proceso no es la API del fork (o hay dudas), **se pregunta a la persona** antes de pararlo.
2. Arrancar la API desde el fork en segundo plano (herramienta Bash con `run_in_background`, o una terminal aparte): `npm run dev`.
3. Esperar a que responda: `curl -s http://localhost:3000/health` → `{"status":"ok"}`. El log debe decir `Loaded 9 entities from seed: db/seed/activities.json` y `Loaded 0 entities from: db/activities.json`.

### C6 — R6

```bash
S=/c/Users/pablo/AppData/Local/Temp/claude/ba248153ea8ddf2d/a493cf1b-e09e-4e93-8734-ff8dd1461aea/scratchpad
git show master:db/seed/activities.json > "$S/orig-seed.json"
git show master:db/activities.json > "$S/orig-persisted.json"
curl -s -o "$S/activities.json" -w "%{http_code}\n" http://localhost:3000/activities
S="$S" node -e 'const fs=require("fs"),S=process.env.S;const r=JSON.parse(fs.readFileSync(S+"/activities.json","utf8"));const orig=[...JSON.parse(fs.readFileSync(S+"/orig-seed.json","utf8")),...JSON.parse(fs.readFileSync(S+"/orig-persisted.json","utf8"))].map(x=>x.name);const ids=r.map(x=>x.id).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const exp=Array.from({length:9},(_,i)=>"activity-"+(i+1));if(JSON.stringify(ids)!==JSON.stringify(exp))throw new Error("R6 ids: "+ids);if(r.find(x=>x.id==="activity-7").status!=="draft")throw new Error("R6 draft");const old=r.filter(x=>orig.includes(x.name)||/yoga|surf/i.test(x.name));if(old.length)throw new Error("R6 antiguas: "+old.map(x=>x.name));console.log("R6 OK")'
```

Esperado: `200` y `R6 OK`.

### Registro de la persona de prueba (para C7–C9)

```bash
BASE=http://localhost:3000
curl -s -w "\n%{http_code}\n" -X POST "$BASE/users" -H "Content-Type: application/json" \
  -d '{"username":"Seed Check","email":"seed-check@example.test","password":"secret123","terms":true}'
TOKEN=$(curl -s -X POST "$BASE/login" -H "Content-Type: application/json" \
  -d '{"email":"seed-check@example.test","password":"secret123"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).accessToken))')
echo "${TOKEN:0:20}..."
```

Esperado: registro `201` con `{"user":{"id":2,…,"terms":true},"accessToken":"…"}`; el login devuelve un token no vacío. (El registro ya devuelve `accessToken`; el login se hace igualmente para probar el flujo.) Si el registro da `400 Email is already registered`, es que quedó de una ejecución anterior: parar la API, `git checkout -- db/users.json` y volver a arrancar.

### C9 — R9 (primero: `activity-1` sin reservas)

```bash
curl -s -w "\n%{http_code}\n" -X POST "$BASE/bookings" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"activityId":"activity-1","participants":7}'
```

Esperado: `{"message":"Capacity exceeded. Available: 6, Requested: 7","errors":[]}` y `400`.

### C7 — R7

```bash
curl -s -w "\n%{http_code}\n" -X POST "$BASE/bookings" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"activityId":"activity-3","participants":2}'
curl -s -w "\n%{http_code}\n" "$BASE/bookings" -H "Authorization: Bearer $TOKEN"
node -e 'const fs=require("fs");for(const f of ["db/bookings.json","db/payments.json"])if(fs.readFileSync(f,"utf8")!=="[]")throw new Error("R7: "+f+" modificado");console.log("R7 sin reserva ni pago OK")'
```

Esperado: `{"message":"Payment could not be processed","errors":[]}` y `402`; después `[]` y `200`; y `R7 sin reserva ni pago OK`.

### C8 — R8 (último: es la única prueba que escribe reservas y pagos)

```bash
curl -s -w "\n%{http_code}\n" -X POST "$BASE/bookings" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"activityId":"activity-3","participants":1}'
```

Esperado: `201` con `"activityId":"activity-3"`, `"participants":1`, `"paymentId":"payment-1"` y `"paymentStatus":"paid"`. Tras esta prueba, `db/bookings.json` y `db/payments.json` contienen una reserva y un pago de 12500 → se restauran en T5.

## Tareas

Todas en el fork, rama `chore/seed-space-launches`.

- [x] **T0** — Comprobaciones previas: rama actual `chore/seed-space-launches`, árbol limpio, `user-1` en `db/users.json` (`node -e 'if(!require("./db/users.json").some(u=>u.id==="user-1"))throw new Error("falta user-1");console.log("user-1 OK")'`); ejecutar C1 y ver que **falla** (comprobación negativa). · Requisitos: precondición de R1 · Ficheros: ninguno
- [x] **T1** — Reescribir `db/seed/activities.json` con los 9 lanzamientos de la tabla de la spec (E1). Verificación: C1, C2, C3 y C4 en verde. · Requisitos: R1, R2, R3, R4 · Ficheros: `db/seed/activities.json`
- [x] **T2** — Vaciar `db/activities.json` a `[]` (E2) y confirmar que `db/bookings.json` y `db/payments.json` siguen en `[]`. Verificación: C5 en verde. · Requisitos: R5 · Ficheros: `db/activities.json`
- [x] **T3** — Parar la API antigua del puerto 3000 (preguntando si el proceso no es claramente el `npm run dev` del fork), arrancar `npm run dev` y comprobar `/health` y el log de carga. Verificación: C6 en verde. · Requisitos: R6 · Ficheros: ninguno
- [x] **T4** — Registrar la persona de prueba y ejecutar, en este orden, C9, C7 y C8. Anotar las respuestas reales (cuerpo y código) para el informe del tester. · Requisitos: R9, R7, R8 · Ficheros: escribe la API en `db/users.json`, `db/bookings.json`, `db/payments.json` (se restauran en T5)
- [x] **T5** — Restaurar el estado antes del commit: parar la API (si sigue arrancada, una petición posterior podría volver a escribir); `git checkout -- db/users.json db/bookings.json db/payments.json`; borrar restos `db/*.tmp` si los hubiera; repetir C1–C5. Verificación: `git status --short` muestra **solo** ` M db/seed/activities.json` y ` M db/activities.json`; `git diff --stat master -- src db/users.json db/bookings.json db/payments.json` vacío. · Requisitos: R5 y exclusiones de la spec · Ficheros: `db/users.json`, `db/bookings.json`, `db/payments.json` (vuelven a `master`)

Repositorio cliente: ningún cambio salvo este plan.

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] C1–C5 en verde tras T5 (estado final de los ficheros)
- [x] C6–C9 ejecutadas con la API recién arrancada y respuestas iguales a las esperadas
- [x] En el fork, `git status` solo muestra `db/seed/activities.json` y `db/activities.json`; sin cambios en `src/`, `db/users.json` ni otros ficheros
- [x] Sin cambios en el repositorio cliente salvo este plan (no se añaden aquí los fixtures de e2e)
- [x] Commit en el fork con Conventional Commits: `c8047b1 chore(db): replace seed with space launches`, enlazando la spec del cliente
- [x] CHANGELOG: anotado en el del cliente; el del fork no se toca

## Desviaciones durante la implementación (5-coder, 2026-11-06)

1. **El login y el registro de la API no funcionan como asumía el plan (bug del fork, fuera de alcance).** En `src/routes/auth.ts` y `src/routes/users.ts` el `UserService` se crea al importar los módulos, **antes** de `loadAllData()` (`src/index.ts:11`). Por eso su índice de emails está vacío y `nextId` vale 1. Consecuencias observadas: `POST /users` crea siempre `user-1` y **sobrescribe a "Mark Musk" en `db/users.json`** (respuesta `201` con `"id":1`), y `POST /login` responde siempre `401 Invalid email or password` (también para `user-1`). La alternativa "login con `user-1`" de "Puntos a decidir" tampoco funcionaría.
   - **Solución aplicada:** usar el `accessToken` que devuelve el propio `POST /users` (el plan ya lo mencionaba) en lugar de hacer login. Se paró la API del primer intento, se restauró `db/users.json` con git, se volvió a arrancar y C6–C9 se repitieron desde cero. Las reservas de R8 quedaron a nombre de `user-1` (la persona registrada), y se restauraron en T5.
   - No se toca `src/` (la spec lo excluye). Conviene abrir una spec `fix` en el fork si el cliente necesita login real (F-autenticación).
2. **Id de la reserva de R8:** la API devolvió `"id":"booking-2"` (no `booking-1`): el intento fallido de R7 consume un id. `paymentId` sí fue `payment-1`. No afecta a ningún requisito.
3. **Fichero de semilla:** escrito con la herramienta Write en UTF-8 sin BOM, LF, sangría de 2 espacios y salto de línea final (igual que el original en el índice). Git avisa "LF will be replaced by CRLF" (inofensivo, `core.autocrlf=true`).

## Puntos a decidir por la persona

**Resueltos (2026-11-06):** 1 → registrar una persona nueva y restaurar `db/users.json`; 2 → el proceso era una API huérfana arrancada por el agente y se paró; 3 → CHANGELOG solo en el cliente; 4 → push y merge solo cuando lo pida la persona. Verificación independiente del tester: R1–R9 en verde; la limpieza se omite por ser un cambio solo de datos.

1. **Persona de prueba para R7–R9:** registrar una nueva (`POST /users`, modifica `db/users.json` y obliga a restaurarlo; es lo que asume este plan) **o** hacer login con `user-1` de `db/users.json` (no escribe en `users.json`; las reservas de R8 quedarían a nombre del proveedor, pero se restauran igual).
2. **Proceso en el puerto 3000:** hay una API ya arrancada (PID 13300 al planificar) con los datos antiguos en memoria. Hay que pararla para T3: confirmar que se puede.
3. **CHANGELOG:** la spec es "solo de datos" y excluye otros ficheros; el fork tiene su propio `CHANGELOG.md` del curso. Propuesta: no tocar el CHANGELOG del fork y, si se quiere dejar constancia, anotarlo en el CHANGELOG del cliente al cerrar la spec (lo decide `8-dev-ops`).
4. **Push / PR del fork:** la rama vive en el fork (`origin` = PabloGozalboChorro/activity-bookings-express); hacer push y merge a `master` solo cuando la persona lo pida.
