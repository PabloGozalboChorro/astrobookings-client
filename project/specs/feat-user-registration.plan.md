# Plan: feat-user-registration

- **Spec:** [feat-user-registration.spec.md](feat-user-registration.spec.md)
- **Rama:** `feat/user-registration`
- **Estado:** Aprobado por delegación de la persona (decisiones G1–G13 y P1–P10 tal como las fija este plan).

## Revisión de la spec

La spec encaja con el PRD (F1, D6; partes de F17 y F18) y con el ADD (§3 estructura: `api/auth.ts` con `register()`, `features/session/RegisterPage.tsx`; §4.1 endpoint 1 `POST /users`; §4.2 `RegisterRequest` con `terms: true` y `authResponseDtoSchema`; §5.1 ruta `/registro`; ADR de errores por campo de `domain/api-errors.ts`; riesgo R13 ya resuelto en el fork). Se reutiliza lo que ya hay en `main` tras `feat-user-session`:

- `http()` sin `auth` (nunca dispara el flujo de sesión rechazada) y `authResponseDtoSchema` (misma respuesta que `/login`).
- `SessionProvider.signIn(response, receivedAt)` → `createSession` + `saveSession` (R4 idéntico a `feat-user-session` R4).
- `resolveReturnPath`, `loginPath`, `LOGIN_PATH`, `DEFAULT_RETURN_PATH` de `src/domain/session.ts`.
- `FormField` (etiqueta asociada, `aria-invalid`, `aria-describedby`; también sirve para la casilla con `type="checkbox"`), `ErrorMessage` (`role="alert"`).
- `fieldErrorMessages`/`fieldErrorMessage`/`toUserMessage` de `src/domain/api-errors.ts`, que **ya** traducen `username`, `email`, `password`, `terms`, `Email is already registered` → "Ya existe una cuenta con este email." y el campo desconocido → "Dato no válido (…)".
- Patrón de envío de `LoginPage` (`inFlight` con `useRef`, estado `idle | submitting | error`, `noValidate`, redirección con `<Navigate>` cuando hay sesión).
- Helpers de test: `tests/unit/support/{http,deferred,session}.ts(x)`, `session-probes.tsx`; e2e `tests/e2e/fixtures/{api-mock,data,session,locators}.ts` (`mockLogin`, `CORS_HEADERS`, `fakeJwt`, `ANA_TOKEN`, `readStoredSession`).

No se añade ninguna dependencia.

Huecos y ambigüedades: ver [Puntos a decidir](#puntos-a-decidir). Ninguno cambia el producto de forma importante; el plan aplica la recomendación (delegado por la persona).

### Contrato real de la API (fork `activity-bookings-express`, `master` en `7f69493`, con `fix-api-user-session` ya integrado)

| Aspecto | Comportamiento | Evidencia |
|---|---|---|
| Ruta | `POST /users` (router montado en `/users`), sin autenticación, CORS abierto. | `src/index.ts:16`, `src/index.ts:27`, `src/routes/users.ts:18` |
| Petición | `{ username, email, password, terms }` (`CreateUserRequest`). | `src/types/user.ts:17-22` |
| Validación (400) | Se devuelven **todos** los errores a la vez: `username` falta / no cadena / `trim() === ''` → `Username is required and must be a non-empty string`; `email` falta / vacío → `Email is required and must be a non-empty string`, si no cumple `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (sin recortar) → `Email must be a valid email address`; `password` falta / no cadena / `length < 6` (sin recortar) → `Password is required and must be at least 6 characters long`; `terms !== true` → `Terms acceptance is required`; cuerpo no objeto → `field: 'body'`. Respuesta `{ message: 'Validation failed', errors: [...] }`. | `src/routes/users.ts:19-26`, `src/services/user.service.ts:93-128` |
| Email ya existente | Comparación **sin distinguir mayúsculas** (sin recortar). Responde **400** (no 409) `{ message: 'Email is already registered', errors: [{ field: 'email', message: 'Email is already registered' }] }`. | `src/services/user.service.ts:28-31`, `:60-63`; `src/routes/users.ts:40-51` |
| Otro fallo al crear | **400** `{ message: 'Failed to register user', errors: [] }`. | `src/routes/users.ts:43-48` |
| 201 | `{ user: { id: number, username, email, terms }, accessToken }`; `id` = número de `user-N`; `email` guardado y devuelto **en minúsculas**; `username` tal cual (sin recortar). | `src/routes/users.ts:28-39`, `src/services/user.service.ts:33-41` |
| JWT | Igual que `/login`: `jwt.sign({ userId, email }, secret, { expiresIn: '24h' })` → `exp` en segundos. | `src/utils/jwt.ts:9-12` |
| Efecto | Escribe en `db/users.json` del fork (persistente). | `src/services/user.service.ts:43` |

Conclusiones: el cuerpo (R3), la respuesta 201 (R4) y los dos 400 (R5, R6) de la spec coinciden con el fork; el email duplicado es **400** como dice la spec (no 409). Única diferencia: los textos de ejemplo de R6 (`Username is required`, `Password must be at least 6 characters`) no son los literales del fork; no afecta porque la traducción es por `field` (ver P1). `classifyApiError` clasifica ambos 400 como `validation` (traen `errors`), y `Failed to register user` como `server` con estado 400 → "No se ha podido completar la operación (Failed to register user)". Los tests no dependen de la API arrancada.

### Impacto en lo existente

| Fichero | Cambio |
|---|---|
| `src/api/auth.ts` | Añade `RegisterRequest` y `register()`. |
| `src/domain/session.ts` | Añade `REGISTER_PATH`, `registerPath()`, `authPagePath()`; `resolveReturnPath` rechaza también rutas que empiezan por `/registro` (G3). |
| `src/features/session/login-form.ts` | Extrae y exporta `validateEmail(email)` (y la constante del patrón) para que la reutilice el registro (G5); `validateLoginForm` la usa sin cambiar su comportamiento. |
| `src/features/session/LoginPage.tsx` | Enlace "¿No tienes cuenta? Crea una" (R8). |
| `src/components/Layout.tsx` | Enlace "Crear cuenta" sin sesión (R7); en `/acceso` y `/registro` los enlaces de cabecera conservan `volver` (G9). |
| `src/App.tsx` | Ruta `registro` → `RegisterPage`. |
| `tests/unit/support/session.tsx` | `renderApp` añade la ruta `registro`. |
| `tests/e2e/fixtures/api-mock.ts` | Extrae `mockJsonPost(page, path, handler)`; `mockLogin` pasa a usarlo y se añade `mockRegister` (G12). |
| `tests/e2e/fixtures/data.ts` | Respuesta 201 de "ana" (`id: 3`) y errores del registro. |

Los tests existentes de `LoginPage`, `Layout`, `App` y `user-session.spec.ts` deben seguir en verde sin cambios (los nombres nuevos no chocan: "Crear cuenta" es enlace en cabecera y botón en el formulario; "¿Ya tienes cuenta? Inicia sesión" no contiene "Iniciar sesión").

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| G1 | **Recurso** `src/api/auth.ts`: `export type RegisterRequest = { username: string; email: string; password: string; terms: true }` y `register(request: RegisterRequest): Promise<AuthResponseDto>` = `http('/users', authResponseDtoSchema, { method: 'POST', body: request })` (sin `auth`). | ADD §4.1 endpoint 1, §4.2; R3, R4. Un 400/500 del registro nunca notifica sesión rechazada. |
| G2 | **Rutas** en `src/domain/session.ts`: `REGISTER_PATH = '/registro'`; `registerPath(returnTo)` → `` `/registro?volver=${encodeURIComponent(returnTo)}` ``; `authPagePath(base: string, volver: string \| null)` → `base` si `volver === null`, si no `` `${base}?volver=${encodeURIComponent(volver)}` ``. | R7 (`%2Flanzamientos%2Factivity-1`), R8 (`/acceso?volver=/reservas` → `/registro?volver=%2Freservas`). `volver` se transporta sin sanear: se sanea al usarse con `resolveReturnPath`. |
| G3 | `resolveReturnPath` rechaza además las rutas que empiezan por `REGISTER_PATH` (→ `/lanzamientos`), igual que ya hace con `/acceso`. | Evita volver a `/registro` tras registrarse o iniciar sesión (bucle con la redirección de G7). Ver P3. |
| G4 | **Validación** pura `validateRegisterForm({ username, email, password, termsAccepted })` en `src/features/session/register-form.ts`: `username.trim() === ''` → "Introduce un nombre de usuario."; email con `validateEmail` (vacío recortado → "Introduce tu email."; formato → "Introduce un email válido."); `password.length < 6` (sin recortar, igual que la API) → "La contraseña debe tener al menos 6 caracteres."; `!termsAccepted` → "Debes aceptar los términos y condiciones.". Tipo `RegisterFormErrors = Partial<Record<'username' \| 'email' \| 'password' \| 'terms', string>>` (claves = `field` de la API). | R2; el patrón de email es el mismo que el del fork. |
| G5 | `validateEmail(email): string \| undefined` se extrae de `validateLoginForm` (en `login-form.ts`) y se exporta; los textos y el patrón no cambian. | AGENTS §7 (no duplicar). `login-form.test.ts` sigue en verde. |
| G6 | **Traducción de errores de la API** pura `registerErrorFeedback(error): { fieldErrors: RegisterFormErrors; alert: string }` en `register-form.ts`: `fieldErrors` = entradas de `fieldErrorMessages(error)` cuyo campo es `username`, `email`, `password` o `terms`. `alert`: si hay al menos un error de campo del formulario → "Revisa los datos marcados."; los errores de campos **desconocidos** (`body`, `foo`…) se añaden al `alert` con su texto de `fieldErrorMessage` ("Dato no válido (…)"); sin errores de campo → `toUserMessage(error)` (red, 500, contrato, `Failed to register user`). | R5, R6, casos límite; evita repetir "Ya existe una cuenta con este email." en el aviso y en el campo. Ver P2. |
| G7 | **`RegisterPage`** (`/registro`): `<h1>Crear cuenta</h1>`; formulario `noValidate` con `FormField` "Nombre de usuario" (`autoComplete="username"`), "Email" (`type="email"`, `autoComplete="email"`), "Contraseña" (`type="password"`, `autoComplete="new-password"`) y `FormField` `type="checkbox"` "Acepto los términos y condiciones" (`checked`, error `terms`); botón `type="submit"` "Crear cuenta". Si hay sesión (también justo después de `signIn`) → `<Navigate to={resolveReturnPath(searchParams.get('volver'))} replace />`, mismo mecanismo que `LoginPage`. Enlace "¿Ya tienes cuenta? Inicia sesión" a `authPagePath(LOGIN_PATH, volver)`. Aviso de sesión caducada: lo sigue mostrando `Layout` (no se toca). | R1, R4, R8; patrón S9 de `feat-user-session`. |
| G8 | **Envío**: `inFlight` (`useRef`) + estado `idle \| submitting \| error`; botón `disabled` con "Creando cuenta…". Se envía `{ username: username.trim(), email: email.trim(), password, terms: true }`; en éxito `signIn(response, Date.now())` (no se llama a `login()`). En error: `registerErrorFeedback` → errores junto a los campos + `ErrorMessage` con `alert`. Los valores (incluida la casilla) se conservan siempre. | R3, R4, R5, R6 y casos límite (red/500). Ver P4. |
| G9 | **Cabecera** (`Layout`) sin sesión: "Iniciar sesión" y "Crear cuenta". Fuera de las páginas de acceso: `loginPath(rutaActual)` y `registerPath(rutaActual)`. En `/acceso` o `/registro`: `authPagePath(LOGIN_PATH \| REGISTER_PATH, searchParams.get('volver'))` (no se anida `volver`; en `/acceso` el resultado es el mismo que hoy). Con sesión, ninguno de los dos enlaces. | R7; coherente con R8. Ver P5. |
| G10 | **`LoginPage`**: enlace "¿No tienes cuenta? Crea una" a `authPagePath(REGISTER_PATH, volver)` debajo del formulario. | R8. |
| G11 | Tests unitarios en carpetas que reflejan `src/`: `tests/unit/domain/session.test.ts`, `tests/unit/api/auth.test.ts`, `tests/unit/features/session/{register-form.test.ts,RegisterPage.test.tsx,LoginPage.test.tsx}`, `tests/unit/components/Layout.test.tsx`, `tests/unit/App.test.tsx`. `renderApp` añade `registro`; `fetch` con `vi.spyOn`; doble clic con promesa de `deferred()`. | Skill `testing-unit-vitest`; ADD §9. |
| G12 | E2E: en `api-mock.ts` se extrae `mockJsonPost(page, path, handler)` (OPTIONS → 204 con `CORS_HEADERS`, registro de cuerpos, `'abort'`) del cuerpo actual de `mockLogin`; `mockLogin` y el nuevo `mockRegister` lo usan (`LoginHandler`/`LoginMock` se mantienen como alias). `data.ts`: `anaRegisterResponse(token)` (`id: 3`, `email: 'ana@ejemplo.com'`, `terms: true`) y `errorResponses.emailAlreadyRegistered`, `registerValidationFailed` (cuerpo de R6 de la spec) y `failedToRegisterUser`. Reloj fijo `2026-11-06T10:00:00Z` y `ANA_TOKEN` (`exp` 1794045600). | ADR-007; ADD §9; no duplicar el mock de `/login`. |
| G13 | Sin proyecto *smoke* en esta spec (el recorrido completo del ADD §9 incluye reservar y llegará con `feat-booking-creation`/`feat-my-bookings`). | La spec no lo pide; ver P9. |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación. Nombres de test en inglés con el `Rn` delante.

### Unitarios y de componentes (Vitest, jsdom, `TZ=UTC`)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R7 | `R7: builds the register path with the encoded return path` — `/lanzamientos/activity-1` → `/registro?volver=%2Flanzamientos%2Factivity-1` | unit | `tests/unit/domain/session.test.ts` |
| R8 | `it.each` `R8: authPagePath(%s, %j)` — (`/registro`, `/reservas`) → `/registro?volver=%2Freservas`; (`/acceso`, `/reservas`) → `/acceso?volver=%2Freservas`; (`/registro`, `null`) → `/registro` | unit | `tests/unit/domain/session.test.ts` |
| R4 (G3) | `resolves "/registro" and "/registro?volver=/x" to /lanzamientos` (añadido al `it.each` de R5 existente) | unit | `tests/unit/domain/session.test.ts` |
| R3 | `R3: posts the registration to /users without Authorization` — getter con token registrado; `fetch` recibe `POST http://localhost:3999/users`, cuerpo `{"username":"ana","email":"ana@ejemplo.com","password":"secreto1","terms":true}`, sin `Authorization` | unit | `tests/unit/api/auth.test.ts` |
| R4 | `R4: returns the parsed auth response of a 201` (respuesta de R4) y `ContractError` si falta `accessToken` | unit | `tests/unit/api/auth.test.ts` |
| R5, R6 | `R5: rejects with a validation ApiError for an existing email` (`fieldErrors.email` = `Email is already registered`) y `R6: rejects with the field errors of Validation failed`; ninguno notifica sesión rechazada | unit | `tests/unit/api/auth.test.ts` |
| R2 | `it.each` `R2: validateRegisterForm` — todo vacío → `username`, `email`, `password`, `terms`; `"   "` en nombre → "Introduce un nombre de usuario."; `ana@` → "Introduce un email válido."; `12345` → error de contraseña; `123456` → sin error de contraseña; casilla sin marcar → error de términos; todo válido → `{}` | unit | `tests/unit/features/session/register-form.test.ts` |
| R2 (G5) | `validateEmail` — vacío/espacios → "Introduce tu email."; `ana@ejemplo` → "Introduce un email válido."; ` ana@ejemplo.com ` → `undefined` | unit | `tests/unit/features/session/register-form.test.ts` |
| R5 | `R5: maps an existing email to the email field` — `fieldErrors.email` = "Ya existe una cuenta con este email.", `alert` = "Revisa los datos marcados." | unit | `tests/unit/features/session/register-form.test.ts` |
| R6 | `R6: maps the API field errors` (cuerpo de la spec y literales del fork) → "Introduce un nombre de usuario válido.", "La contraseña debe tener al menos 6 caracteres."; `R6: lists unknown fields in the alert` (`foo`/`bad value` → "Dato no válido (bad value)") | unit | `tests/unit/features/session/register-form.test.ts` |
| Límites | `registerErrorFeedback` con `NetworkError`, 500, `ContractError` y 400 `Failed to register user` → `fieldErrors` vacío y `alert` = `toUserMessage` | unit | `tests/unit/features/session/register-form.test.ts` |
| R1 | `R1: shows the registration fields, the terms checkbox and the submit button` — etiquetas asociadas, tipos `email`/`password`, casilla sin marcar, botón "Crear cuenta" | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| R2 | `R2: shows the field errors and does not call the API` (criterio: "ana"/"ana@ejemplo.com"/"12345"/sin casilla) y `R2: shows the empty field errors` (todo vacío) — textos dentro del `aria-describedby` de cada control, `aria-invalid="true"`; `fetch` no llamado | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| R3 | `R3: sends one request on double click and shows "Creando cuenta…" disabled` — `fetch` con promesa diferida, `user.dblClick`; 1 llamada con el cuerpo exacto; botón `disabled` hasta resolver | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| R3 (G8) | `sends the trimmed username and email and the password as typed` | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| R4 | `R4: starts the session and goes to the return path` — `/registro?volver=/lanzamientos/activity-1`, 201 con token `exp` 1794045600 → `localStorage` exacto (`expiresAt` `1794045600000`, sin `id`/`terms`), ruta `/lanzamientos/activity-1`, cabecera "ana" y "Cerrar sesión", **una sola** llamada a `fetch` (`/users`, nunca `/login`); `R4: goes to /lanzamientos without volver`; `R4: ignores an external volver` (`https://malicioso.example`) | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| R4 (G7) | `redirects to the return path when there is already a session` | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| R5 | `R5: marks the email field and keeps the typed data` — 400 email existente: "Ya existe una cuenta con este email." en el `aria-describedby` de "Email" con `aria-invalid="true"`; campos con "ana" y "ana@ejemplo.com"; sigue en `/registro`; sin sesión | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| R6 | `R6: shows the Spanish text of each API field error` (cuerpo de la spec) y `R6: shows an unknown field in the alert` | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| Límites | `keeps the data and shows the network error` (`fetch` rechaza → texto de red en `role="alert"`, valores y casilla conservados) y `shows the server error on a 500` | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| R8 | `R8: links to /acceso keeping volver` — en `/registro?volver=/reservas`, "¿Ya tienes cuenta? Inicia sesión" tiene `href` `/acceso?volver=%2Freservas`; sin `volver` → `/acceso` | componente | `tests/unit/features/session/RegisterPage.test.tsx` |
| R8 | `R8: links to /registro keeping volver` — en `/acceso?volver=/reservas`, "¿No tienes cuenta? Crea una" → `/registro?volver=%2Freservas`; al pulsarlo la ruta actual es esa | componente | `tests/unit/features/session/LoginPage.test.tsx` |
| R7 | `R7: links to /registro with the current route without a session` (`/lanzamientos/activity-1` → `href` `/registro?volver=%2Flanzamientos%2Factivity-1`); `R7: hides the register link with a session`; en `/registro?volver=%2Fx` y `/acceso?volver=%2Fx` los enlaces "Crear cuenta" e "Iniciar sesión" llevan `?volver=%2Fx` sin anidar | componente | `tests/unit/components/Layout.test.tsx` |
| R1 | `R1: renders the registration page at /registro` (App completa) | componente | `tests/unit/App.test.tsx` |

### End-to-end (Playwright, Chromium y Firefox, API interceptada)

Fichero `tests/e2e/user-registration.spec.ts`; `mockActivities` + `mockRegister` (+ `mockLogin` en R4 para comprobar que no se usa); reloj fijo `2026-11-06T10:00:00Z`; `timezoneId: 'UTC'`, `locale: 'es-ES'`. Ninguna petición sale a la API real (puerto 3999 sin servidor).

| Requisito | Test |
|---|---|
| R1 | `R1: shows the registration form at /registro` (etiquetas, tipos, casilla sin marcar, botón) |
| R2 | `R2: shows the field errors without sending a request` (criterio: contraseña "12345" y casilla sin marcar; todo vacío; `ana@`; `123456` sin error de contraseña; `mockRegister` sin cuerpos registrados) |
| R3 | `R3: sends a single request while waiting and shows "Creando cuenta…"` (respuesta retenida; `dblclick`; cuerpo exacto `{ "username": "ana", "email": "ana@ejemplo.com", "password": "secreto1", "terms": true }`) |
| R4 | `R4: starts the session and returns to volver` (`/registro?volver=/lanzamientos/activity-1` → URL `/lanzamientos/activity-1`, cabecera "ana" y "Cerrar sesión", `localStorage` exacto con `expiresAt` `1794045600000`, `mockLogin.requestBodies` vacío); `R4: ignores an external volver` (`https://malicioso.example` → `/lanzamientos`) |
| R5 | `R5: shows the existing email error and keeps the data` (`aria-invalid="true"` en "Email", valores conservados) |
| R6 | `R6: shows the API field errors in Spanish` (cuerpo de la spec) |
| R7 | `R7: links to /registro from the header without a session` (en `/lanzamientos/activity-1`, `href` exacto) y `R7: hides the register link with a session` (`seedSession`) |
| R8 | `R8: goes from /acceso to /registro and back keeping volver` (`/acceso?volver=/reservas` → `/registro?volver=%2Freservas` → `/acceso?volver=%2Freservas`) |
| Límites | `shows the network error and keeps the data` (`route.abort()`) y `shows the server error on a 500` |

## Tareas

- [x] **T1** — Rutas de las páginas de acceso (G2, G3). · Requisitos: R4, R7, R8 · Ficheros: `tests/unit/domain/session.test.ts`, `src/domain/session.ts`.
  - Primero los tests en rojo; después `REGISTER_PATH`, `registerPath`, `authPagePath` y el rechazo de `/registro` en `resolveReturnPath`.
  - Verificación: `npm test -- tests/unit/domain/session.test.ts`; `npm run typecheck`.
- [x] **T2** — Recurso `register()` (G1). · Requisitos: R3, R4, R5, R6 · Ficheros: `tests/unit/api/auth.test.ts`, `src/api/auth.ts`.
  - Verificación: `npm test -- tests/unit/api`.
- [x] **T3** — Validación y traducción de errores del registro (G4, G5, G6). · Requisitos: R2, R5, R6 · Ficheros: `tests/unit/features/session/register-form.test.ts`, `src/features/session/register-form.ts`, `src/features/session/login-form.ts` (extraer `validateEmail`).
  - `login-form.test.ts` debe seguir en verde sin cambios.
  - Verificación: `npm test -- tests/unit/features/session`.
- [x] **T4** — `RegisterPage` y ruta (G7, G8). · Requisitos: R1, R2, R3, R4, R5, R6, R8 (enlace a `/acceso`) · Ficheros: `tests/unit/support/session.tsx` (ruta `registro` en `renderApp`), `tests/unit/features/session/RegisterPage.test.tsx`, `src/features/session/RegisterPage.tsx`, `tests/unit/App.test.tsx`, `src/App.tsx`, `src/styles/global.css` (solo si la casilla necesita un estilo mínimo; se reutilizan las clases del formulario de acceso).
  - Verificación: `npm test -- tests/unit/features/session tests/unit/App.test.tsx`; `npm run lint`.
- [x] **T5** — Enlaces cruzados y cabecera (G9, G10). · Requisitos: R7, R8 · Ficheros: `tests/unit/features/session/LoginPage.test.tsx`, `src/features/session/LoginPage.tsx`, `tests/unit/components/Layout.test.tsx`, `src/components/Layout.tsx`.
  - Los tests de R7/R9 existentes de `Layout` deben seguir en verde.
  - Verificación: `npm test`; `npm run lint`.
- [x] **T6** — E2E (G12). · Requisitos: R1–R8 · Ficheros: `tests/e2e/fixtures/api-mock.ts` (`mockJsonPost`, `mockRegister`), `tests/e2e/fixtures/data.ts`, `tests/e2e/user-registration.spec.ts`.
  - Tras extraer `mockJsonPost`, `tests/e2e/user-session.spec.ts` debe seguir en verde.
  - Verificación: `npx.cmd playwright test tests/e2e/user-registration.spec.ts tests/e2e/user-session.spec.ts --project=chromium`.
- [x] **T7** — Verificación final. · Requisitos: R1–R8 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Ejecutar en orden: `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa: regresión + `user-registration`).
  - **No** usar `npm run test:e2e -- --project=chromium` (el script ya fija los dos proyectos). Firefox lo ejecuta **la persona**: `npx.cmd playwright test --project=firefox`.
  - Comprobar: sin `console.log`, código comentado, `any` ni `as T` sobre datos de red; ningún componente llama a `fetch`; ninguna credencial real en tests (solo `ana`/`ana@ejemplo.com`/`secreto1` de la spec); `git status` sin ficheros no previstos.
  - Prueba manual opcional (persona) contra el fork: registrar un email nuevo (queda escrito en `db/users.json`), comprobar la cabecera, cerrar sesión y entrar con ese usuario; repetir el registro con el mismo email → error en "Email".

## Desviaciones durante la implementación

- **G6 (precisión):** cuando hay a la vez errores de campos del formulario y de campos desconocidos, el aviso concatena los textos con un espacio: "Revisa los datos marcados. Dato no válido (…)". Si solo hay campos desconocidos, el aviso es únicamente "Dato no válido (…)" (varios, separados por espacio).
- **G2:** `loginPath` pasa a delegar en `authPagePath(LOGIN_PATH, …)`; el resultado es idéntico (los tests existentes siguen en verde).
- **G9:** en `/acceso` la cabecera ya no copia la ruta actual completa, sino `authPagePath(LOGIN_PATH, volver)`: si `/acceso` llevara otros parámetros además de `volver`, ahora se descartan. Con `volver` solo (el único caso real) el `href` es el mismo que antes.
- **G7:** `FormField` pinta la etiqueta antes del control también en la casilla; se añade en `global.css` la regla `.login-form input[type='checkbox'] { width: auto; }` para que la casilla no ocupe todo el ancho.
- **Tests extra (no previstos en la tabla):** contraseña de 6 espacios válida (la longitud se mide sin recortar), traducción del error de `terms`, aviso con campo conocido + desconocido (`body`), enlaces cruzados y de cabecera sin `volver` (`/acceso`, `/registro`).
- **Orden test-first:** en T1, T3 y T5 los tests se ejecutaron en rojo antes de implementar; en T2 y T4 test e implementación se escribieron en el mismo paso y solo se comprobó el verde.
- **Firefox:** no ejecutado por el agente (no arranca en el entorno); pendiente de la persona (`npx.cmd playwright test --project=firefox`). CHANGELOG sin actualizar (lo hace `8-dev-ops`).

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] `npm run build` en verde
- [x] Tests e2e de la spec en verde (Chromium agente, Firefox persona) — Chromium 97/97 y Firefox 97/97
- [x] CHANGELOG actualizado

## Puntos a decidir

La persona ha delegado las decisiones de esta spec: el plan aplica la recomendación. Ninguna cambia el producto de forma importante.

| # | Tema | Ambigüedad | Decisión aplicada |
|---|---|---|---|
| P1 | Textos de ejemplo de R6 | El cuerpo de R6 usa `Username is required` y `Password must be at least 6 characters`; el fork devuelve `Username is required and must be a non-empty string` y `Password is required and must be at least 6 characters long`. | La traducción es por `field`, así que ambos dan el mismo texto. Los tests usan el cuerpo de la spec (criterio) y, en unitarios, también los literales del fork (riesgo R8 del ADD). La spec no se modifica. |
| P2 | Aviso general junto a los errores por campo | La spec solo pide el texto junto a cada campo (R5, R6) y "Dato no válido (…)" para un campo desconocido, sin decir dónde mostrarlo. `toUserMessage` daría "Ya existe una cuenta con este email." también en el aviso (duplicado). | `role="alert"` con "Revisa los datos marcados." cuando hay errores de campos del formulario; los campos desconocidos se añaden al aviso con "Dato no válido (…)"; sin errores de campo, `toUserMessage` (G6). |
| P3 | `volver=/registro` | La spec no lo trata; tras registrarse o entrar, volver a `/registro` redirigiría otra vez (con sesión) y no tiene sentido. | `resolveReturnPath` también rechaza `/registro…` (G3), como ya hacía con `/acceso`. |
| P4 | Recorte de datos | La spec exige el cuerpo exacto pero no dice si se recortan espacios. La API no recorta email ni nombre (el patrón de email falla con espacios; el nombre se guardaría con espacios). | Se envían `username` y `email` recortados y la contraseña tal cual; la longitud mínima se mide sin recortar (igual que la API) (G4, G8). |
| P5 | Cabecera en `/acceso` y `/registro` | R7 da el enlace a `/registro?volver=<ruta actual>`; en las propias páginas de acceso eso anidaría `volver` (`/registro?volver=%2Facceso%3Fvolver…`). | En `/acceso` y `/registro` los dos enlaces de cabecera conservan el `volver` actual (G9), igual que hoy hace "Iniciar sesión" en `/acceso`. |
| P6 | `/registro` con sesión ya iniciada | La spec no lo trata. | Redirige al `volver` válido o a `/lanzamientos` (G7); es además el mecanismo de redirección tras el registro (R4), igual que `LoginPage`. |
| P7 | Email en mayúsculas | La API guarda y devuelve el email en minúsculas; la sesión guarda el `user` de la respuesta. | Se guarda lo que devuelve la API (sin tocar `createSession`); la cabecera muestra el `username`, no el email. |
| P8 | Errores al corregir | La spec no dice si los errores desaparecen al escribir. | Igual que `LoginPage`: se recalculan en cada envío y se conservan los valores. |
| P9 | *Smoke* contra la API real | El ADD §9 describe un recorrido *smoke* que empieza con el registro, pero también reserva (aún no existe). | Sin *smoke* en esta spec; prueba manual opcional (T7). Se puede añadir cuando exista la reserva. |
| P10 | `username` en la sesión con espacios | Con el recorte de P4 no ocurre; la API no impone formato al nombre (la spec ya lo deja a la API). | Sin reglas extra en el cliente. |
