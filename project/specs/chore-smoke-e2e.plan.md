# Plan: chore-smoke-e2e

- **Spec:** [chore-smoke-e2e.spec.md](chore-smoke-e2e.spec.md)
- **Rama:** `chore/smoke-e2e`
- **Estado:** Aprobado por delegación de la persona (decisiones C1–C10 y P1–P7 tal como las fija este plan). Quedan abiertas las preguntas marcadas como **abierta** en [Puntos a decidir](#puntos-a-decidir); ninguna bloquea la implementación.

## Revisión de la spec

La spec encaja con el PRD (F1, F2, F3, F9, F11, F13, F14) y con el ADD (§3 estructura: `tests/e2e/smoke/real-api.smoke.spec.ts`; §7 configuración y puertos; §9 fila "Smoke e2e (opcional)"; ADR-007, ADR-013; riesgo R8). No toca `src/` ni el fork. Se reutiliza lo que ya hay en `main`:

- `playwright.config.ts`: proyecto `smoke` (`testDir: './tests/e2e/smoke'`, Desktop Chrome, `baseURL` `http://localhost:5173`); `chromium` y `firefox` con `testIgnore: '**/smoke/**'`; `webServer` global en el 5174 (`vite --mode e2e`), que se arranca también con el smoke pero no se usa (caso límite de la spec).
- `package.json`: `test:e2e:smoke` = `playwright test --project=smoke --pass-with-no-tests`; `test:e2e` fija `chromium` y `firefox`; Vitest solo incluye `tests/unit/**/*.test.{ts,tsx}` (`vite.config.ts`).
- `tsconfig` de Node incluye `tests/e2e` (el smoke queda tipado) y ESLint cubre `**/*.{ts,tsx}`.
- Helpers e2e: `readStoredSession(page)` y `SESSION_STORAGE_KEY` (`tests/e2e/fixtures/session.ts`) para leer el token de R7; `bookingCard(page, mission)` (`tests/e2e/fixtures/locators.ts`). **No** se usa `api-mock.ts` (el smoke no intercepta nada).
- Localizadores ya probados en los e2e deterministas: `getByLabel('Nombre de usuario' | 'Email' | 'Contraseña' | 'Número de plazas')`, `getByRole('button', { name: 'Crear cuenta' })` (en la cabecera "Crear cuenta" es un enlace), `getByRole('banner').getByRole('button', { name: 'Cerrar sesión' })`, `getByRole('region', { name: 'Reserva confirmada' })`, `getByText(/^Importe total:/)`, enlace "Ver mis reservas" con `exact: true`.

No se añade ninguna dependencia.

### Entorno real (fork `activity-bookings-express`, `master` en `d429652`)

| Aspecto | Comportamiento | Evidencia |
|---|---|---|
| Arranque | `npm run dev` = `tsx src/index.ts`, puerto `PORT` o 3000; `cors()` activo. | `package.json`; `src/index.ts` |
| Salud | `GET /health` → 200 `{ "status": "ok" }` (también `GET /` → 200). Sin autenticación ni acceso a datos: sirve para R5. | `src/index.ts:23-25` |
| Semilla | `db/seed/activities.json` (9 lanzamientos) se fusiona al arrancar con `db/activities.json` (`[]`). `activity-2`: Starship · Órbita Marciana, 1 249 999 €, `confirmed`, 12 plazas, 2027-06-01. `activity-4`: Soyuz · Estación Orbital, `sold-out`. | `db/seed/activities.json`; `src/repositories/json.repository.ts` |
| Datos persistidos | `db/users.json` (versionado, con `user-1`), `db/bookings.json` y `db/payments.json` (`[]`). `git status --short db/` vacío hoy. El smoke los modifica; `git restore db/` los devuelve a su estado. | `git status` del fork |
| Registro | Solo exige `username` no vacío, email válido, contraseña ≥ 6 y `terms`. Token JWT de 24 h. | `src/services/user.service.ts:102-104`; `src/utils/jwt.ts:11` |
| Pago | Rechaza importes múltiplo de 1000 (402); 1 249 999 no lo es. Sin esperas artificiales. | `src/services/mock-payment-gateway.ts:11` |
| No reservable | `POST /bookings` en `activity-4` → 400 `Activity is not bookable: sold-out`, `errors: []`, sin crear reserva ni pago. | Rama `fix/bookable-launch` integrada (`fa00e71`) |

### Impacto en lo existente

| Fichero | Cambio |
|---|---|
| `tests/e2e/smoke/real-api.smoke.spec.ts` (nuevo) | Comprobación previa (R5) y recorrido R1–R4 + R7. |
| `tests/e2e/smoke/.gitkeep` | Se borra (la carpeta ya tiene contenido). |
| `README.md` | Sección "Smoke e2e contra la API real" (R8). |
| `CHANGELOG.md` | Entrada en `[Unreleased]`. |

`playwright.config.ts`, `package.json`, `src/` y el fork **no** cambian (ver C1 y P2).

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| C1 | **Cómo llega a la app:** se usa el proyecto `smoke` tal como está: `baseURL` `http://localhost:5173`, el `npm run dev` que arranca la persona (modo `development` → `.env.development` → `VITE_API_URL=http://localhost:3000`). Playwright **no** arranca ni el fork ni ese servidor; el `webServer` global (5174, modo `e2e`) sigue arrancándose y se ignora. No se toca `playwright.config.ts`. | Spec (alcance excluido: arrancar servidores; caso límite del `webServer`); ADD §7 (puertos). Ver P2. |
| C2 | **Constantes en el propio fichero:** `API_URL = 'http://localhost:3000'` (local, no es secreto; coincide con `.env.development`) y `APP_URL = 'http://localhost:5173'`. La URL de la app solo se usa en la comprobación previa; la navegación usa rutas relativas (`page.goto('/registro')`) sobre el `baseURL` del proyecto. | Pista de la spec; AGENTS §7 (no hay entorno real). Ver P3. |
| C3 | **Comprobación previa (R5)** en `test.beforeAll` del fichero: función local `findUnreachable(url, howToStart)` con el `fetch` de Node y `AbortSignal.timeout(3_000)`; considera caído un rechazo de `fetch` (conexión rechazada o tiempo agotado) o una respuesta no `ok`. Comprueba **las dos** URLs (`${API_URL}/health` y `APP_URL`) y, si alguna falla, lanza **un único** `Error` que lista cada servicio caído con su URL y cómo arrancarlo (fork: "en `activity-bookings-express`, `npm run dev`"; app: "en este repositorio, `npm run dev`"). Al fallar el `beforeAll`, Playwright marca el test como fallido sin ejecutar el cuerpo (sin pasos de registro). | R5; casos límite (solo comprueba que responden). Ver P1. |
| C4 | **Un solo test serial** `R1–R4, R7: registers, signs in again, books a launch and is rejected on a sold-out launch` con `test.step` por requisito (`R1 …`, `R2 …`, …) para que el informe diga qué paso falla. `test.use({ locale: 'es-ES' })` (como el resto de e2e; el formato de moneda ya fija `es-ES`). Reloj real (sin `page.clock`). `test.setTimeout(60_000)`: la primera carga del `npm run dev` compila módulos bajo demanda. | Notas de la spec (título con los requisitos, sin esperas fijas). Ver P4. |
| C5 | **Datos únicos (R1):** `const stamp = Date.now()`; email `smoke-${stamp}@example.com`, nombre de usuario `smoke-${stamp}`, contraseña fija `smoke-pass` (≥ 6). | R1; casos límite (ejecuciones repetidas). |
| C6 | **R1:** `goto('/registro')`, rellena "Nombre de usuario", "Email", "Contraseña", marca "Acepto los términos y condiciones", pulsa el **botón** "Crear cuenta"; espera en `banner` el texto del nombre de usuario y el botón "Cerrar sesión". **R2:** pulsa "Cerrar sesión", espera el enlace "Iniciar sesión" en la cabecera y lo pulsa (→ `/acceso`), rellena "Email" y "Contraseña", pulsa el botón "Iniciar sesión" de `main`; espera de nuevo nombre y "Cerrar sesión", y que no aparezca "Email o contraseña incorrectos.". | R1, R2; criterios de aceptación. |
| C7 | **R3:** `goto('/lanzamientos/activity-2')`, comprueba "Número de plazas" = `1` (sin tocarlo), pulsa "Reservar"; `toHaveURL(/\/reservas\/booking-\d+$/)`; en la región "Reserva confirmada": "Órbita Marciana", "1 plaza", `getByText(/^Importe total:/)` con `toHaveText('Importe total: 1.249.999,00 €')` (Playwright normaliza el espacio duro) y "Pagada". **R4:** pulsa "Ver mis reservas" (`exact: true`) → `toHaveURL(/\/reservas$/)`, `main` con **1** `article` y `bookingCard(page, 'Órbita Marciana')` visible. | R3, R4. |
| C8 | **R7** después de R4 (así el criterio "Mis reservas sigue mostrando una sola reserva" se comprueba tras el rechazo): `readStoredSession(page)` → se extrae `accessToken` con una guarda de tipo (sin `as`); con el fixture `request`, `POST ${API_URL}/bookings` con `Authorization: Bearer <token>` y `data: { activityId: 'activity-4', participants: 1 }`. `expect(response.status(), body).toBe(400)` (el cuerpo recibido va en el mensaje, caso límite "fork sin `fix-api-bookable-launch`") y `expect(await response.json()).toEqual({ message: 'Activity is not bookable: sold-out', errors: [] })`. Después `page.reload()` en `/reservas` → sigue habiendo 1 `article`. | R7; caso límite del fork desactualizado; pista de la spec. Ver P5. |
| C9 | **Exclusión (R6)** ya resuelta por la configuración (`testIgnore` y `include` de Vitest); se **verifica**, no se cambia: `npx playwright test --project=chromium --project=firefox --list` sin `real-api.smoke.spec.ts`, `npx playwright test --list` con el smoke solo bajo `[smoke]`, `npm test` sin el smoke. | R6. |
| C10 | **Sin Firefox para el smoke:** el proyecto `smoke` es solo Desktop Chrome (alcance excluido de la spec). La persona solo ejecuta en Firefox la suite e2e normal (`--project=firefox`), como siempre. | Spec (excluido: Firefox, CI, `test:e2e`). |

## Plan de pruebas

Se escribe antes que el resto: el propio smoke es la prueba. Primero se ve fallar R5 con los servidores apagados (rojo esperado), después pasa con el entorno listo.

### Smoke (Playwright, proyecto `smoke`, Chromium, API real)

Fichero `tests/e2e/smoke/real-api.smoke.spec.ts`.

| Requisito | Test / paso | Cómo se verifica |
|---|---|---|
| R5 | `beforeAll` "API y app en marcha" | Con el fork parado: `npm run test:e2e:smoke` falla en pocos segundos con "La API no responde en http://localhost:3000/health…" y cómo arrancarla, sin pasos `R1` en la salida. Igual con el `npm run dev` del cliente parado ("La app no responde en http://localhost:5173…"). |
| R1 | `test.step('R1: registers with a unique email')` | Cabecera con `smoke-<stamp>` y "Cerrar sesión"; después de la ejecución, `db/users.json` del fork contiene `smoke-<stamp>@example.com` (comprobación manual del agente). |
| R2 | `test.step('R2: signs out and signs in again')` | Cabecera con nombre y "Cerrar sesión"; sin "Email o contraseña incorrectos.". |
| R3 | `test.step('R3: books 1 seat on activity-2')` | URL `/reservas/booking-\d+`; región "Reserva confirmada" con "Órbita Marciana", "1 plaza", "Importe total: 1.249.999,00 €", "Pagada". |
| R4 | `test.step('R4: shows the booking in Mis reservas')` | URL `/reservas`; 1 `article` "Órbita Marciana". |
| R7 | `test.step('R7: the API rejects a sold-out launch')` | 400 `{ message: 'Activity is not bookable: sold-out', errors: [] }`; tras recargar `/reservas`, 1 `article`. |

### Exclusión y regresión

| Requisito | Comprobación |
|---|---|
| R6 | `npx.cmd playwright test --project=chromium --project=firefox --list` no lista `real-api.smoke.spec.ts`; `npx.cmd playwright test --list` lo lista solo como `[smoke]`; `npm test` no lo ejecuta; `npx.cmd playwright test --project=chromium` en verde con el fork **apagado**. |
| R8 | Revisión del `README.md` contra el criterio de aceptación (dos servidores, comando, datos que escribe, `git restore db/`, caducidad 2027-06-01, límite de 12 ejecuciones). |

## Tareas

- [x] **T1** — Comprobación previa del smoke (C2, C3). · Requisitos: R5 · Ficheros: `tests/e2e/smoke/real-api.smoke.spec.ts` (nuevo, con `beforeAll` y el test aún vacío o con el primer paso), borrar `tests/e2e/smoke/.gitkeep`.
  - Verificación (con el fork y el `npm run dev` del cliente **apagados**): `npm run test:e2e:smoke` falla en pocos segundos con el mensaje de los dos servidores; con solo el fork arrancado, el mensaje nombra solo la app (y viceversa).
- [x] **T2** — Recorrido R1–R4 (C4–C7). · Requisitos: R1, R2, R3, R4 · Ficheros: `tests/e2e/smoke/real-api.smoke.spec.ts`.
  - Verificación (entorno listo, ver T5): `npm run test:e2e:smoke` en verde; `db/users.json` del fork con el usuario nuevo y `db/bookings.json` con la reserva de `activity-2`.
- [x] **T3** — Rechazo de la API (C8). · Requisitos: R7 · Ficheros: `tests/e2e/smoke/real-api.smoke.spec.ts`.
  - Verificación: smoke en verde; `db/bookings.json` sin ninguna reserva de `activity-4` ni pago asociado.
- [x] **T4** — Documentación. · Requisitos: R8 · Ficheros: `README.md` (sección "Smoke e2e contra la API real", después de "Cómo se trabaja"), `CHANGELOG.md` (`[Unreleased]` → `### Added`: smoke e2e opcional contra la API real con `npm run test:e2e:smoke`).
  - El README incluye: fork en `master` con la semilla y `fix-api-bookable-launch`, `npm run dev` en el fork (puerto 3000) y `npm run dev` en el cliente (5173); `npm run test:e2e:smoke`; que crea usuarios `smoke-…@example.com`, reservas y pagos en el fork; limpieza con `git restore db/` en el fork (con el fork parado, o reiniciándolo después, porque mantiene los datos en memoria); máximo 12 ejecuciones sin restaurar; deja de funcionar a partir del 2027-06-01; solo Chromium y no forma parte de `test:e2e`.
- [x] **T5** — Verificación final. · Requisitos: R1–R8 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Cliente: `npm run typecheck`, `npm run lint`, `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa, con el fork **apagado**: también prueba R6).
  - R6: `npx.cmd playwright test --project=chromium --project=firefox --list` y `npx.cmd playwright test --list` (C9).
  - R5: con ambos servidores apagados, `npm run test:e2e:smoke` falla con el mensaje claro.
  - Smoke real: comprobar `git status --short db/` vacío en el fork; arrancar en segundo plano el fork (`npm run dev` en `activity-bookings-express`, puerto 3000) y el cliente (`npm run dev`, 5173) si no están ya en marcha (no matar procesos de la persona); `npm run test:e2e:smoke` en verde (Chromium); comprobar `db/` del fork (usuario y reserva nuevos, ninguna de `activity-4`); **parar los servidores arrancados por el agente** y ejecutar `git restore db/` en el fork; `git status --short db/` vuelve a estar vacío.
  - Firefox: lo ejecuta **la persona** para la suite normal (`npx.cmd playwright test --project=firefox`); el smoke no corre en Firefox (C10).
  - Comprobar: sin `console.log`, código comentado, `any` ni `as`; sin `page.waitForTimeout`; sin dependencias nuevas; `src/`, `playwright.config.ts`, `package.json` y el fork sin cambios; `git status` sin ficheros no previstos.

## Desviaciones durante la implementación

Rellenado por `5-coder`.

| # | Desviación | Motivo |
|---|---|---|
| D1 | El paso R7 lee el cuerpo con `response.text()` y lo parsea con `JSON.parse` en lugar de `response.json()`. | Así el mismo cuerpo va en el mensaje del `expect` del código de estado (caso límite "fork sin `fix-api-bookable-launch`") y después se compara, sin leer la respuesta dos veces. |
| D2 | Tras la recarga de R7 se comprueba, además del único `article`, que la tarjeta es "Órbita Marciana". | Refuerza el criterio "sigue mostrando una sola reserva" sin ampliar el alcance. |
| D3 | El mensaje de R5 tiene una cabecera común ("El smoke e2e necesita la API y la app en marcha:") y una línea por servicio caído con su URL, "no responde" (o el código recibido) y cómo arrancarlo, en lugar del texto literal "La API no responde en …" del plan de pruebas. | Un único `Error` que lista cada servicio caído (C3); conserva lo que exige R5: qué falta, URL y cómo arrancarlo. |
| D4 | Verificación con `npx.cmd vitest run` y `npx.cmd playwright test …` directamente (equivalentes a `npm test` y a los scripts de e2e). | Indicación de quien orquesta; misma configuración. |
| D5 | Variante de R5 con solo el fork arrancado comprobada (el mensaje nombra solo la app); la inversa (solo la app arrancada) no se ejecutó. | La lógica es simétrica (`Promise.all` sobre las dos URLs); se priorizó no dejar procesos ni datos en el fork. |

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] `npm run build` en verde
- [x] `npx.cmd playwright test --project=chromium` en verde con el fork apagado (agente: 185 passed); Firefox de la suite normal en verde (persona: 185 passed)
- [x] `npm run test:e2e:smoke` en verde contra el fork real en `master` (`d429652` o posterior), en Chromium (agente)
- [x] R5 comprobado: con los servidores apagados el smoke falla enseguida con el mensaje claro
- [x] `npx.cmd playwright test --list`: `chromium` y `firefox` no incluyen `real-api.smoke.spec.ts` (R6)
- [x] Sección "Smoke e2e contra la API real" en `README.md` (R8)
- [x] `git restore db/` ejecutado en el fork tras el smoke y `git status --short db/` vacío
- [x] CHANGELOG (`[Unreleased]`) actualizado

## Puntos a decidir

La persona ha delegado las decisiones de esta spec: el plan aplica la recomendación. Ninguna cambia el producto de forma importante. Las marcadas **abierta** conviene que la persona las confirme, pero no bloquean.

| # | Tema | Ambigüedad | Decisión aplicada |
|---|---|---|---|
| P1 | Dónde va la comprobación de R5 | Opciones: `globalSetup` (se ejecutaría también con `chromium`/`firefox` y los rompería con la API apagada, contra R6), un proyecto de *setup* con `dependencies` (cambia la configuración) o un `beforeAll` en el fichero. | `beforeAll` en el propio fichero con `fetch` de Node y 3 s de límite (C3). No toca la configuración ni afecta a los otros proyectos. |
| P2 | `webServer` global en el 5174 durante el smoke (**abierta**, informativa) | Se arranca aunque el smoke no lo use (1–3 s más). Evitarlo exigiría condicionar `webServer` por proyecto o una variable de entorno. | Se deja como está (la spec lo acepta como caso límite). Si molesta, `craftsman` puede condicionarlo en una `chore` aparte. |
| P3 | URL de la API en el test | Constante o leída de `.env.development`. | Constante `http://localhost:3000` (C2): leer `.env.development` añadiría parseo para un valor local fijo, y R5/R8 ya documentan el puerto. |
| P4 | Un test o varios | Varios tests compartirían usuario entre sí (estado entre tests, orden obligatorio). | Un solo test con `test.step` por requisito (C4). |
| P5 | Orden de R7 | La spec dice "con sesión iniciada (R2)" y el criterio pide comprobar después que "Mis reservas" sigue con una reserva. | R7 tras R4 y recarga de `/reservas` (C8): cumple ambas cosas y no altera el recorrido feliz. |
| P6 | `--pass-with-no-tests` en `test:e2e:smoke` (**abierta**) | Con el fichero ya creado ya no hace falta; si alguien lo borrara o renombrara, el script pasaría en verde sin ejecutar nada. | No se toca `package.json` (fuera del alcance de la spec). Propuesta: quitar el flag en una `chore` de `craftsman` junto con P2. |
| P7 | Limpieza de `db/` con el fork en marcha | El fork guarda los datos en memoria y los vuelve a escribir en la siguiente petición que modifica datos; un `git restore db/` con el fork arrancado puede quedar sobrescrito. | El README indica parar el fork antes de `git restore db/` (o reiniciarlo después); el agente lo hace así en T5. |
