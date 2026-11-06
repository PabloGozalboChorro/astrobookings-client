# Plan: feat-user-session

- **Spec:** [feat-user-session.spec.md](feat-user-session.spec.md)
- **Rama:** `feat/user-session`
- **Estado:** Aprobado por delegación de la persona (decisiones S1–S15 y P1–P13 tal como las fija este plan).

## Revisión de la spec

La spec encaja con el PRD (F2, F3, F4, D6; partes de F17 y F18) y con el ADD (§3 estructura: `api/auth.ts`, `domain/session.ts`, `features/session/{SessionProvider,use-session,session-storage,RequireAuth,LoginPage}`; §4.1 endpoint 2 `POST /login`; §4.2 `authResponseDtoSchema` y `Session`; §5.1 ruta `/acceso?volver=`; §5.3 almacenamiento, caducidad sin librería JWT, comprobación proactiva, 401 global, cierre de sesión; ADR-010; riesgos R9, R10, R13). Se reutiliza lo que ya hay en `main`: `http()` con `setAccessTokenGetter`/`onSessionRejected`, `ApiError`, `toUserMessage`/`fieldErrorMessages`, `FormField`, `ErrorMessage`, `useAsyncData`, `Layout`, los helpers unitarios `tests/unit/support/{http,deferred}.ts` y los fixtures e2e `tests/e2e/fixtures/{api-mock,data,locators}.ts`.

No se añade ninguna dependencia: el JWT se decodifica con `atob` (ADD §5.3) y todo lo demás usa React, React Router, Zod y las herramientas de test ya instaladas.

Huecos y contradicciones encontrados: ver [Puntos a decidir](#puntos-a-decidir). Ninguno cambia el producto; el plan aplica la recomendación (delegado por la persona).

### Contrato real de la API (fork `activity-bookings-express`, `master` en `7f69493`, con `fix-api-user-session`)

| Aspecto | Comportamiento | Evidencia |
|---|---|---|
| Ruta | `POST /login` (router montado en `/login`), CORS abierto (`cors()` sin opciones). | `src/index.ts:16`, `src/index.ts:28`, `src/routes/auth.ts:18` |
| Petición | `{ email, password }`. | `src/types/user.ts:27-30` |
| 400 | Si `email` o `password` faltan, no son cadena o `trim() === ''` → `{ message: 'Validation failed', errors: [{ field: 'email' \| 'password', message }] }`; cuerpo no objeto → `field: 'body'`. | `src/routes/auth.ts:19-25`, `src/services/user.service.ts:134-154` |
| Búsqueda del usuario | Email comparado **sin distinguir mayúsculas** y **sin recortar**; contraseña comparada en claro, exacta. | `src/services/user.service.ts:60-63`, `:75-83` |
| 200 | `{ user: { id: number, username, email, terms }, accessToken }`; `id` = número de `user-N` (o `0`). | `src/routes/auth.ts:29-39`, `src/types/auth.ts:14-22` |
| 401 | `{ message: 'Invalid email or password', errors: [] }` (no dice qué dato falla); cualquier otro fallo → `{ message: 'Authentication failed', errors: [] }` también con 401. | `src/routes/auth.ts:40-48` |
| JWT | `jwt.sign({ userId: 'user-N', email }, secret, { expiresIn: '24h' })` → claims `userId`, `email`, `iat`, `exp` (segundos). | `src/utils/jwt.ts:10-12`, `src/types/auth.ts:6-9` |
| Bearer | El middleware toma `authorization.split(' ')[1]`; sin token → 401 `Authentication required. Please provide a valid token.`; firma o caducidad inválida → 401 `Invalid or expired token. Please login again.`. | `src/middleware/auth.middleware.ts:13-38` |

Conclusiones: el cuerpo de la spec (R3) y la forma de `AuthResponse` coinciden con el fork; el `exp` del token es la fuente de `expiresAt` (R4); el 401 de `/login` puede traer dos mensajes y ambos deben mostrarse como "Email o contraseña incorrectos." (P2). Los tests no dependen de la API arrancada; no se copia ninguna credencial de `db/users.json` (no hay *smoke* en esta spec, P13).

### Impacto en lo existente

| Fichero | Cambio |
|---|---|
| `src/api/http.ts` | Con `auth: true` y sin token válido: **no** llama a `fetch`, notifica `onSessionRejected` y lanza `ApiError` 401 `unauthorized` con `message: ''` (S6). Cambia la decisión E2 de `feat-error-handling` (antes enviaba sin cabecera y la API respondía 401). |
| `tests/unit/api/http.test.ts` | El test `R1: does not send Authorization when auth is requested but there is no token` se sustituye por el nuevo comportamiento (S6). |
| `src/api/schemas.ts` | Añade `authResponseDtoSchema` (ADD §4.2, literal). |
| `src/App.tsx` | Envuelve `<Routes>` en `<SessionProvider>` y añade la ruta `acceso` → `LoginPage`. |
| `src/components/Layout.tsx` | Estado de sesión en la cabecera (R7, R9) y aviso de sesión caducada (R11). |
| `tests/setup.ts` | `localStorage.clear()` en `afterEach` para aislar tests. |
| `tests/unit/App.test.tsx` | Sigue en verde sin cambios (sin sesión); se añade el caso de `/acceso`. |

## Decisiones de implementación

| # | Decisión | Motivo |
|---|---|---|
| S1 | **Dominio** `src/domain/session.ts` (funciones puras, `now` inyectado): `type Session = { accessToken; user: { username; email }; expiresAt }`; `SESSION_FALLBACK_DURATION_MS = 86_400_000`; `getTokenExpiry(token): number \| null` (3 partes separadas por `.`, payload base64url → `-`→`+`, `_`→`/`, relleno `=`, `atob`, `JSON.parse` en `try`, `z.object({ exp: z.number().positive() }).safeParse` → `exp * 1000`; si algo falla → `null`); `isExpired(session, now)` = `now >= session.expiresAt`; `createSession(auth, receivedAt)` → `{ accessToken, user: { username, email }, expiresAt: getTokenExpiry(token) ?? receivedAt + 24 h }` (descarta `id` y `terms`). | ADD §5.3 y §6; R4. Sin librería JWT ni verificación de firma (el servidor es la fuente final, R10). |
| S2 | **Rutas de retorno** en `src/domain/session.ts`: `LOGIN_PATH = '/acceso'`; `DEFAULT_RETURN_PATH = '/lanzamientos'`; `resolveReturnPath(volver: string \| null): string` acepta solo valores que empiezan por `/`, no por `//`, sin `\` y que no empiezan por `/acceso`; si no → `/lanzamientos`. `loginPath(returnTo: string): string` → `` `/acceso?volver=${encodeURIComponent(returnTo)}` ``. | R5 (y P4: `/\malicioso.example` el navegador lo trata como `//`; `volver=/acceso` provocaría un bucle con S9). `encodeURIComponent` produce exactamente `%2Fprotegida%3Fx%3D1` y `%2Flanzamientos%2Factivity-1` de los criterios. |
| S3 | **Almacenamiento** `src/features/session/session-storage.ts`: `SESSION_STORAGE_KEY = 'astrobookings.session'`; `readStoredSession(now): { status: 'none' } \| { status: 'valid'; session } \| { status: 'expired' } \| { status: 'invalid' }` — **pura** (no borra): `getItem` en `try` (si lanza → `none`), `JSON.parse` en `try` (falla → `invalid`), `storedSessionSchema.safeParse` (`accessToken: z.string().min(1)`, `user: { username: z.string(), email: z.string() }`, `expiresAt: z.number()`; falla → `invalid`), `isExpired` → `expired`; `saveSession(session)`, `clearStoredSession()` (borrado en `try`); `readStoredAccessToken()` = token si `readStoredSession(Date.now())` es `valid`, si no `null`. | ADD §5.3 ("se valida con Zod al leer; si es inválido o ha caducado, se borra"); R8, R11. Lectura pura porque `StrictMode` invoca dos veces el inicializador de `useState` (S5). |
| S4 | **Contexto** separado en `session-context.ts` (`createContext<SessionContextValue \| null>(null)`) y hook `use-session.ts` (`useSession()` lanza si no hay proveedor). `SessionContextValue = { session: Session \| null; expiredNotice: boolean; signIn(auth: AuthResponseDto, receivedAt: number): void; signOut(): void; expireSession(): void; checkExpiry(): void }`. | ADD §3; la regla `react-refresh/only-export-components` impide exportar contexto y hook desde `SessionProvider.tsx`. |
| S5 | **`SessionProvider`**: estado `{ session, expiredNotice }` con inicializador perezoso `useState(() => initialState(readStoredSession(Date.now())))` (`valid` → sesión; `expired` → `null` + aviso; `invalid`/`none` → `null` sin aviso). Un `useEffect` de montaje borra la clave si la lectura inicial fue `expired` o `invalid` (efecto sin `setState`, idempotente en `StrictMode`). `signIn` guarda y pone `{ session, expiredNotice: false }`; `signOut` borra y pone `{ null, false }`; `expireSession` borra y pone `{ null, true }`; `checkExpiry` llama a `expireSession` si hay sesión e `isExpired(session, Date.now())`. Funciones con `useCallback` y valor con `useMemo`. | R8, R9, R11. `Date.now()` solo en inicializador, efectos y manejadores (regla `react-hooks/purity`); sin `setState` síncrono en efectos (`react-hooks/set-state-in-effect`). |
| S6 | **Token y comprobación antes de cada petición autenticada**: `SessionProvider.tsx` registra **a nivel de módulo** `setAccessTokenGetter(readStoredAccessToken)` (no en un efecto: los efectos de los hijos se ejecutan antes que los del padre y la primera carga protegida saldría sin token). `http()` con `auth: true` y getter → `null` (sin sesión o caducada) **no llama a `fetch`**: notifica `onSessionRejected` y lanza `new ApiError({ status: 401, kind: 'unauthorized', message: '', fieldErrors: {}, availableSeats: null })` (→ `toUserMessage` = texto de sesión). | R11 ("caducada justo antes de pedirla … no se llama a `fetch`"), ADD §5.3 ("sin llamar a la API"). `localStorage` es la fuente de verdad que leen el getter y el proveedor. Ver P1. |
| S7 | **401 global y caducidad en curso**: el proveedor se suscribe en un `useEffect` a `onSessionRejected(expireSession)` (con baja en la limpieza). Además programa un `setTimeout` hasta `expiresAt` (retraso acotado a `[0, 2 147 483 647]` ms; al dispararse llama a `checkExpiry`, que vuelve a comprobar el reloj). El proveedor **no navega**: la redirección la hace `RequireAuth` al quedarse sin sesión. | R11, R12; F4 "rechazada por la API". Ver P5 (pantallas no protegidas, como el futuro `BookingForm`, navegan ellas mismas). |
| S8 | **`RequireAuth`** (ruta *layout* con `<Outlet />`): sin sesión → `<Navigate to={loginPath(pathname + search)} replace />`; con sesión → `<Outlet />`. Un `useEffect` dependiente de `location.key` llama a `checkExpiry()` al entrar en cada ruta protegida. No se añade a `App` ninguna ruta protegida real (llegan con `feat-my-bookings`); se prueba con la ruta `/protegida` de los tests. | R10, R12, ADD §5.1. |
| S9 | **`LoginPage`** (`/acceso`): `<h1>Iniciar sesión</h1>`; formulario `noValidate` con `FormField` "Email" (`type="email"`, `autoComplete="email"`) y "Contraseña" (`type="password"`, `autoComplete="current-password"`) y botón `type="submit"`. Validación en el envío (`validateLoginForm` pura en `src/features/session/login-form.ts`): email recortado vacío → "Introduce tu email."; sin formato `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` → "Introduce un email válido."; contraseña con `trim() === ''` → "Introduce tu contraseña.". Con errores no se llama a la API. Si ya hay sesión (también justo después de `signIn`) renderiza `<Navigate to={resolveReturnPath(searchParams.get('volver'))} replace />`: un solo mecanismo de redirección (R4). | R1, R2, R4, R5. `noValidate` para que el navegador no bloquee el envío con sus propios mensajes. Ver P6 y P7. |
| S10 | **Envío**: estado `idle \| submitting \| error`; un `useRef` `inFlight` bloquea un segundo envío antes del re-render y el botón queda `disabled` con "Entrando…" (patrón de ADD §5.4). Se envía `{ email: email.trim(), password }` (contraseña sin tocar) con `login()`; en éxito `signIn(response, Date.now())`. Errores: `ApiError` 401 (cualquier mensaje) → `role="alert"` "Email o contraseña incorrectos." sin `aria-invalid`; 400 `validation` → `fieldErrorMessages` junto al campo + `toUserMessage` en el `alert`; red/500/contrato → `ErrorMessage` con `toUserMessage`. Los valores del formulario se conservan siempre. | R3, R6, casos límite; ADD §5.4 (F18). Ver P2 y P8. |
| S11 | **Recurso** `src/api/auth.ts`: `login(request: LoginRequest): Promise<AuthResponseDto>` = `http('/login', authResponseDtoSchema, { method: 'POST', body: request })` (sin `auth`, nunca dispara el flujo de sesión). Tipos `LoginRequest` y `AuthResponseDto` exportados. | ADD §3, §4.1; R3, R6 y nota "El 401 de `POST /login` nunca dispara el flujo". |
| S12 | **Cabecera** (`Layout`): con sesión, `<span>` con `user.username` y `<button type="button">Cerrar sesión</button>`; sin sesión, `<Link>` "Iniciar sesión" a `loginPath(pathname + search)` (en `/acceso` conserva su propia consulta para no anidar `volver`). "Cerrar sesión" → `navigate('/lanzamientos')` y `signOut()` en el mismo manejador. | R7, R9. Ver P9 (carrera con `RequireAuth`). |
| S13 | **Aviso de sesión caducada** `SessionExpiredNotice` (`role="alert"`): "Tu sesión ha caducado o no es válida. Inicia sesión de nuevo." + enlace "Iniciar sesión" a `loginPath(ruta actual)`. `Layout` lo muestra encima del `<Outlet />` cuando `expiredNotice` y la ruta no es `/acceso`; `LoginPage` muestra solo el texto (sin enlace, el formulario ya es la invitación). El aviso se borra al iniciar sesión. | R11, R12. Ver P10. |
| S14 | Tests en carpetas que reflejan `src/`: `tests/unit/domain/session.test.ts`, `tests/unit/api/auth.test.ts`, `tests/unit/features/session/*.test.tsx`, `tests/unit/components/Layout.test.tsx`. Helper `tests/unit/support/session.tsx`: `fakeJwt(claims)` (base64url con `btoa`, firma ficticia), `storeSession(overrides)` (escribe en `localStorage` de jsdom), `renderApp(path, { strict? })` (`MemoryRouter` + `SessionProvider` + `Layout` + rutas `/acceso`, `/lanzamientos` y `/protegida` dentro de `RequireAuth` con un componente sonda que pide `http('/bookings', z.array(z.unknown()), { auth: true })` con `useAsyncData` y muestra la ruta actual). `fetch` con `vi.spyOn`; reloj con `vi.useFakeTimers({ toFake: ['Date'] })` / `vi.setSystemTime` cuando se prueba caducidad (y `['Date', 'setTimeout', 'clearTimeout']` para el temporizador de S7). | Skill `testing-unit-vitest`; ADD §9. |
| S15 | E2E: `tests/e2e/fixtures/session.ts` con `fakeJwt` (Node `Buffer`), `sessionValue(overrides)`, `seedSession(page, value)` (`addInitScript` que escribe la clave **solo en la primera carga** de la pestaña, marcada en `sessionStorage`, para que recargar no la reponga tras cerrar sesión) y `readStoredSession(page)`. En `api-mock.ts`, `mockLogin(page, handler)` reutilizando `CORS_HEADERS` (responde el `OPTIONS` previo) y registrando los cuerpos enviados. Reloj fijo `2026-11-06T10:00:00Z` (`iat` del token de R4, cuyo `exp` 1794045600 es `2026-11-07T10:00:00Z`). | ADR-007; ADD §9 ("sesión inyectada con `page.addInitScript`"). |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación. Nombres de test en inglés con el `Rn` delante.

### Unitarios y de componentes (Vitest, jsdom, `TZ=UTC`)

| Requisito | Test | Nivel | Fichero |
|---|---|---|---|
| R4 | `R4: reads the exp claim of a JWT in milliseconds` — `fakeJwt({ userId: 'user-2', email, iat: 1793959200, exp: 1794045600 })` → `1794045600000`; payload con `-`/`_` (base64url) también | unit | `tests/unit/domain/session.test.ts` |
| R4 | `it.each` `R4: returns null for %s` — `'opaque-token'`, dos partes, payload no JSON, sin `exp`, `exp` texto | unit | `tests/unit/domain/session.test.ts` |
| R4 | `R4: creates the session from the auth response` (sin `id`/`terms`, `expiresAt` del `exp`) y `R4: falls back to 24 hours after reception` (`'opaque-token'`, `receivedAt + 86_400_000`) | unit | `tests/unit/domain/session.test.ts` |
| R8, R11 | `R8/R11: isExpired` — `now` 1 ms antes de `expiresAt` → `false`; igual o después → `true` | unit | `tests/unit/domain/session.test.ts` |
| R5 | `it.each` `R5: resolves "%s" to "%s"` — `/reservas?lanzamiento=activity-1` → igual; `https://malicioso.example`, `//malicioso.example`, `reservas`, `/\malicioso.example`, `/acceso`, `''`, `null` → `/lanzamientos` | unit | `tests/unit/domain/session.test.ts` |
| R7, R10 | `R10: builds the login path with the encoded return path` — `/protegida?x=1` → `/acceso?volver=%2Fprotegida%3Fx%3D1` | unit | `tests/unit/domain/session.test.ts` |
| R8, R11 | `readStoredSession`: `R8: returns a valid stored session`; `R11: reports an expired session`; `R11: reports invalid JSON` y `R11: reports an invalid shape` (sin `expiresAt`, token vacío); `does not remove the key while reading`; `R9: clearStoredSession removes the key`; `R4: saveSession writes the exact JSON` | unit | `tests/unit/features/session/session-storage.test.ts` |
| R2 | `it.each` `R2: validateLoginForm` — vacío → ambos textos; `ana@ejemplo` → "Introduce un email válido."; `'   '` en contraseña → "Introduce tu contraseña."; válido → sin errores | unit | `tests/unit/features/session/login-form.test.ts` |
| R3 | `R3: posts the credentials to /login without Authorization` — getter con token registrado, `fetch` recibe `POST http://localhost:3999/login`, cuerpo `{"email":"ana@ejemplo.com","password":"secreto1"}` y sin cabecera `Authorization` | unit | `tests/unit/api/auth.test.ts` |
| R4 | `R4: returns the parsed auth response` (respuesta del fork) y `ContractError` si falta `accessToken` | unit | `tests/unit/api/auth.test.ts` |
| R6 | `R6: rejects with an unauthorized ApiError and does not notify the session` — 401 `Invalid email or password` | unit | `tests/unit/api/auth.test.ts` |
| R11 | `R11: does not call fetch for an authenticated request without a valid token` — getter → `null`: `fetch` no llamado, suscriptor notificado 1 vez, `ApiError` 401 `unauthorized`, `toUserMessage` = texto de sesión (sustituye al test de E2) | unit | `tests/unit/api/http.test.ts` |
| R1 | `R1: shows the email and password fields and the submit button` (tipos `email`/`password`, etiquetas asociadas) | componente | `tests/unit/features/session/LoginPage.test.tsx` |
| R2 | `R2: shows field errors and does not call the API` (vacío) y `R2: rejects an email without a valid format` — textos dentro del `aria-describedby` de cada campo; `fetch` no llamado | componente | `tests/unit/features/session/LoginPage.test.tsx` |
| R3 | `R3: sends one request on double click and shows "Entrando…" disabled` — `fetch` con promesa diferida, `user.dblClick`; 1 llamada con el cuerpo exacto; botón `disabled` con "Entrando…" hasta resolver | componente | `tests/unit/features/session/LoginPage.test.tsx` |
| R4 | `R4: stores the session and goes to the return path` — `/acceso?volver=/lanzamientos/activity-1`, respuesta con `exp` 1794045600 → `localStorage` exacto (`expiresAt` `1794045600000`) y ruta `/lanzamientos/activity-1`; `R4: falls back to 24 h for an opaque token` (`vi.setSystemTime`); `R4: goes to /lanzamientos without volver` | componente | `tests/unit/features/session/LoginPage.test.tsx` |
| R5 | `it.each` `R5: ignores the unsafe return path %s` (los cuatro valores del criterio; solo el primero se respeta) | componente | `tests/unit/features/session/LoginPage.test.tsx` |
| R6 | `R6: shows the invalid credentials alert without marking fields` — 401 `Invalid email or password`: `alert` con el texto, ningún `aria-invalid="true"`, sigue en `/acceso`, sin el texto de sesión caducada, sin notificación; `R6: also for "Authentication failed"` | componente | `tests/unit/features/session/LoginPage.test.tsx` |
| R6 (límite) | `shows the field errors of a 400 Validation failed`; `keeps the email and shows the network error` (`fetch` rechaza) y el texto de servidor con 500 | componente | `tests/unit/features/session/LoginPage.test.tsx` |
| R4 (S9) | `redirects to the return path when there is already a session` | componente | `tests/unit/features/session/LoginPage.test.tsx` |
| R8 | `R8: restores a valid session from localStorage` — cabecera con "ana" y "Cerrar sesión"; la petición de `/protegida` lleva `Authorization: Bearer <token guardado>` en la **primera** carga (getter registrado antes de los efectos) | componente | `tests/unit/features/session/SessionProvider.test.tsx` |
| R11 | `R11: clears an expired session at start and shows the notice` (clave borrada, "Iniciar sesión" en la cabecera, aviso con enlace) — en modo normal **y con `StrictMode`** | componente | `tests/unit/features/session/SessionProvider.test.tsx` |
| R11 | `R11: clears invalid stored content without notice` (no JSON y forma inválida) | componente | `tests/unit/features/session/SessionProvider.test.tsx` |
| R11 | `R11: closes the session when an authenticated request gets 401` (en `/lanzamientos` con un componente que llama a `http(..., { auth: true })`) → clave borrada, aviso visible | componente | `tests/unit/features/session/SessionProvider.test.tsx` |
| R11 | `R11: closes the session without calling fetch when it expired just before the request` (`vi.setSystemTime` después de `expiresAt`, sin avanzar temporizadores) | componente | `tests/unit/features/session/SessionProvider.test.tsx` |
| R12 | `R12: expires the session when expiresAt is reached` (temporizadores falsos, `advanceTimersByTime`) | componente | `tests/unit/features/session/SessionProvider.test.tsx` |
| — | `useSession throws outside SessionProvider`; `unsubscribes from session rejections on unmount` | componente | `tests/unit/features/session/SessionProvider.test.tsx` |
| R10 | `R10: redirects to /acceso with the requested path and query` — sin sesión, `/protegida?x=1` → ruta `/acceso?volver=%2Fprotegida%3Fx%3D1`, `fetch` no llamado | componente | `tests/unit/features/session/RequireAuth.test.tsx` |
| R10 | `R10: renders the protected route with a valid session` | componente | `tests/unit/features/session/RequireAuth.test.tsx` |
| R12 | `R12: goes to /acceso with the notice when a request of the protected route gets 401` — 401 `Invalid or expired token. Please login again.` → `/acceso?volver=%2Fprotegida`, aviso visible, `localStorage` sin la clave | componente | `tests/unit/features/session/RequireAuth.test.tsx` |
| R12 | `R12: goes to /acceso with the notice when the session expires on a protected route` (temporizador) y `R11: entering a protected route with an expired session redirects with the notice and no request` | componente | `tests/unit/features/session/RequireAuth.test.tsx` |
| R12 | `R12: logging in from the notice returns to the protected route` (circuito completo en componente) | componente | `tests/unit/features/session/RequireAuth.test.tsx` |
| R7 | `R7: shows the username and the sign out button with a session` (sin enlace "Iniciar sesión") y `R7: links to /acceso with the current route without a session` (`/lanzamientos/activity-1` → `href` `/acceso?volver=%2Flanzamientos%2Factivity-1`); en `/acceso?volver=%2Fx` el enlace no anida `volver` | componente | `tests/unit/components/Layout.test.tsx` |
| R9 | `R9: signs out, clears localStorage and goes to /lanzamientos` (desde `/lanzamientos/activity-1`) y `R9: signing out from a protected route ends in /lanzamientos, not in /acceso` | componente | `tests/unit/components/Layout.test.tsx` |
| R1 | `R1: renders the login page at /acceso` (App completa) | componente | `tests/unit/App.test.tsx` |

### End-to-end (Playwright, Chromium y Firefox, API interceptada)

Fichero `tests/e2e/user-session.spec.ts`; `mockActivities` + `mockLogin`; reloj fijo `2026-11-06T10:00:00Z`; `timezoneId: 'UTC'`, `locale: 'es-ES'`. Ninguna petición sale a la API real (puerto 3999 sin servidor).

| Requisito | Test |
|---|---|
| R1 | `R1: shows the login form at /acceso` |
| R2 | `R2: shows the field errors without sending a request` (vacío y `ana@ejemplo`; `mockLogin` sin peticiones registradas) |
| R3 | `R3: sends a single request while waiting and shows "Entrando…"` (respuesta retenida con una promesa; `dblclick`; cuerpo exacto `{ "email": "ana@ejemplo.com", "password": "secreto1" }`) |
| R4 | `R4: stores the session and returns to volver` (`localStorage` exacto con `expiresAt` `1794045600000`, URL `/lanzamientos/activity-1`, cabecera "ana"); `R4: uses 24 h for an opaque token` (`NOW + 86 400 000`); `R4: goes to /lanzamientos without volver` |
| R5 | `R5: ignores unsafe return paths` (bucle por los cuatro valores del criterio; para `/reservas?lanzamiento=activity-1` solo se comprueba la URL, la ruta aún no existe y muestra la página no encontrada) |
| R6 | `R6: shows the invalid credentials message` (sin `aria-invalid`, sigue en `/acceso`, sin aviso de sesión) |
| R7 | `R7: shows the user in the header with a session` y `R7: links to /acceso with the current route without a session` |
| R8 | `R8: keeps the session after reloading` (`expiresAt = NOW + 2 h`) |
| R9 | `R9: signs out from the launch detail` (clave inexistente, URL `/lanzamientos`, cabecera con "Iniciar sesión") |
| R11 | `R11: clears an expired session at start and shows the notice` y `R11: clears corrupt stored content without notice` |
| Límites | `shows the network error and keeps the email` (`route.abort()`) y `shows the server error on a 500` |

R10 y R12 se prueban en componentes (no hay rutas protegidas reales en esta spec); sus e2e los hace `feat-my-bookings`.

## Tareas

- [x] **T1** — Dominio de sesión (S1, S2). · Requisitos: R4, R5, R8, R10, R11 · Ficheros: `tests/unit/domain/session.test.ts`, `tests/unit/support/session.tsx` (solo `fakeJwt` por ahora), `src/domain/session.ts`.
  - Primero los tests en rojo; después `getTokenExpiry`, `isExpired`, `createSession`, `resolveReturnPath`, `loginPath`.
  - Verificación: `npm test -- tests/unit/domain/session.test.ts`; `npm run typecheck`.
- [x] **T2** — Esquema y recurso `login()` (S11). · Requisitos: R3, R4, R6 · Ficheros: `tests/unit/api/auth.test.ts`, `src/api/schemas.ts`, `src/api/auth.ts`.
  - Verificación: `npm test -- tests/unit/api`.
- [x] **T3** — `http()` sin token válido no llama a la API (S6). · Requisitos: R11 · Ficheros: `tests/unit/api/http.test.ts`, `src/api/http.ts`.
  - Sustituir el test de E2 por el de R11 (rojo) y cambiar `http()`; el resto de `http.test.ts` y `http-edge-cases.test.ts` debe seguir en verde.
  - Verificación: `npm test -- tests/unit/api`.
- [x] **T4** — Almacenamiento de la sesión (S3). · Requisitos: R4, R8, R9, R11 · Ficheros: `tests/unit/features/session/session-storage.test.ts`, `src/features/session/session-storage.ts`, `tests/setup.ts` (`localStorage.clear()`).
  - Verificación: `npm test -- tests/unit/features/session`.
- [x] **T5** — Contexto, `SessionProvider`, `useSession` (S4–S7). · Requisitos: R8, R11, R12 (caducidad) · Ficheros: `tests/unit/support/session.tsx` (`storeSession`, `renderApp`), `tests/unit/features/session/SessionProvider.test.tsx`, `src/features/session/session-context.ts`, `src/features/session/use-session.ts`, `src/features/session/SessionProvider.tsx`, `src/features/session/SessionExpiredNotice.tsx`.
  - Incluye los casos con `StrictMode` y la petición autenticada en la primera carga.
  - Verificación: `npm test -- tests/unit/features/session`; `npm run lint` sin avisos de `react-hooks` ni `react-refresh`.
- [x] **T6** — `RequireAuth` (S8). · Requisitos: R10, R12 · Ficheros: `tests/unit/features/session/RequireAuth.test.tsx`, `src/features/session/RequireAuth.tsx`.
  - Verificación: `npm test -- tests/unit/features/session/RequireAuth.test.tsx`.
- [x] **T7** — `LoginPage` y validación (S9, S10, S13). · Requisitos: R1, R2, R3, R4, R5, R6, R12 (aviso en `/acceso`) · Ficheros: `tests/unit/features/session/login-form.test.ts`, `tests/unit/features/session/LoginPage.test.tsx`, `src/features/session/login-form.ts`, `src/features/session/LoginPage.tsx`.
  - Verificación: `npm test -- tests/unit/features/session`.
- [x] **T8** — Cabecera, aviso y rutas (S12, S13; `App`). · Requisitos: R7, R9, R11 · Ficheros: `tests/unit/components/Layout.test.tsx`, `tests/unit/App.test.tsx`, `src/components/Layout.tsx`, `src/App.tsx`, `src/styles/global.css` (estilos mínimos de cabecera, formulario y aviso, si hace falta).
  - Incluye el cierre de sesión desde `/protegida` (P9).
  - Verificación: `npm test`; `npm run lint`.
- [x] **T9** — E2E (S15). · Requisitos: R1–R9, R11 · Ficheros: `tests/e2e/fixtures/session.ts`, `tests/e2e/fixtures/api-mock.ts` (`mockLogin`), `tests/e2e/fixtures/data.ts` (`errorResponses.invalidCredentials`, respuesta de login de "ana"), `tests/e2e/user-session.spec.ts`.
  - Verificación: `npx.cmd playwright test tests/e2e/user-session.spec.ts --project=chromium`.
- [x] **T10** — Verificación final. · Requisitos: R1–R12 · Ficheros: —
  - En PowerShell, refrescar PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  - Ejecutar en orden: `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (informar del recuento real), `npm run build`, `npx.cmd playwright test --project=chromium` (suite completa: regresión + `user-session`).
  - **No** usar `npm run test:e2e -- --project=chromium` (el script ya fija los dos proyectos). Firefox lo ejecuta **la persona**: `npx.cmd playwright test --project=firefox`.
  - Comprobar: sin `console.log`, código comentado, `any` ni `as T` sobre datos de red; ningún componente llama a `fetch`; ninguna credencial real en tests (solo `ana@ejemplo.com`/`secreto1` de la spec); `git status` sin ficheros no previstos.
  - Prueba manual opcional (persona) contra el fork: entrar con un usuario de la semilla, recargar, cerrar sesión.

## Desviaciones durante la implementación

- **D1 (P9 confirmado)** — El test `R9: signing out from a protected route ends in /lanzamientos, not in /acceso` falló con `navigate('/lanzamientos')` + `signOut()` en el mismo manejador (la ruta acababa en `/acceso?volver=%2Fprotegida`: React Router aplica la navegación en una transición y `signOut` se renderizaba antes). Se aplicó la salida prevista: `signOut()` dentro de `startTransition` en `Layout`. El test pasa en modo normal y con `StrictMode`.
- **D2** — `createSession(source, receivedAt)` recibe un tipo estructural `SessionSource = { accessToken; user: { username; email } }` (en `src/domain/session.ts`) en lugar de importar `AuthResponseDto`: el dominio no depende de `api/` y `AuthResponseDto` encaja sin conversión. `AuthResponseDto` se define en `src/api/schemas.ts` (`z.infer`) y `src/api/auth.ts` lo reexporta.
- **D3** — Para no duplicar textos se exportan desde `src/domain/api-errors.ts` `SESSION_TEXT` (antes privado) e `INVALID_CREDENTIALS_TEXT` (nuevo, usado también en el mapa de mensajes conocidos). El mensaje de error del login sale de `loginErrorMessage(error)` en `src/features/session/login-form.ts` (401 → "Email o contraseña incorrectos."; resto → `toUserMessage`).
- **D4** — `tests/unit/api/http.test.ts`: además de sustituir el test de E2 (S6), el test `R12: does not notify on a %i of an authenticated request` registra ahora un token, porque sin token `http()` ya notifica la sesión rechazada sin llamar a la API. Nota añadida en `feat-error-handling.plan.md` (D6).
- **D5** — Los componentes sonda de los tests (`ProtectedProbe`, `LocationProbe`, `CurrentLocation`) están en `tests/unit/support/session-probes.tsx` y no en `session.tsx`: la regla `react-refresh/only-export-components` avisa si un `.tsx` exporta componentes y funciones a la vez. `renderApp` incluye un `<output aria-label="Ubicación actual">` con la ruta y un enlace "Ir a la ruta protegida" para navegar en los tests.
- **D6** — Orden de tareas: las aserciones del aviso en `RequireAuth.test.tsx` pasan desde T7 (el aviso lo muestra `LoginPage` en `/acceso`); en T6 solo se comprobaron ruta, almacenamiento y llamadas a `fetch`.
- **D7** — Tests extra no listados: `readStoredSession` con `localStorage` que lanza, campos extra y otras formas inválidas; `getTokenExpiry` con payload no base64 o no objeto; `login()` con `id` no numérico; `R2` borra los errores de campo al corregir; envío del email recortado y la contraseña tal cual (P7); `signIn`/`signOut` con `renderHook`; sin sesión no se toca `localStorage`; aviso único en `/acceso`; App muestra el enlace "Iniciar sesión". En e2e, R5 se genera como un test por valor de `volver` (4 tests) en lugar de un bucle dentro de un único test.
- **D8** — Firefox no se ejecuta en el entorno del agente; queda para la persona (`npx.cmd playwright test --project=firefox`). No se hizo la prueba manual contra el fork.

## Iteraciones

- **I1 (defecto R5 del tester)** — `resolveReturnPath` aceptaba `/\t/malicioso.example` (también `\n` y `\r`): el navegador elimina esos caracteres al interpretar la URL, el destino pasaba a `//malicioso.example` (otro origen) y React Router abortaba con "External navigation is not allowed" (página en blanco tras guardar la sesión). Corrección en `src/domain/session.ts`: se rechaza cualquier carácter de control (U+0000–U+001F y U+007F, comprobado por código de carácter para no chocar con la regla `no-control-regex`) y, como defensa adicional, el valor se resuelve con `new URL(valor, 'https://astrobookings.invalid')` (origen ficticio fijo, la función sigue siendo pura) y se exige el mismo origen y un `pathname` que no empiece por `//`. Se mantienen las reglas anteriores y la ruta se devuelve intacta (con `search`/`hash`). Tests del tester sin cambios: unit `R5: rejects %j…` (3 casos) y e2e `R5: stays in the app for a return path the browser reads as external` en verde.

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] `npm run build` en verde
- [x] Tests e2e de la spec en verde (Chromium agente, Firefox persona) — Chromium 74/74 y Firefox 74/74
- [x] CHANGELOG actualizado

## Puntos a decidir

La persona ha delegado las decisiones de esta spec: el plan aplica la recomendación. Ninguna cambia el producto de forma importante.

| # | Tema | Ambigüedad | Decisión aplicada |
|---|---|---|---|
| P1 | Petición autenticada sin token válido | R11 exige no llamar a `fetch` si la sesión caducó justo antes, pero `http()` (E2 de `feat-error-handling`) enviaba la petición sin cabecera. | `http()` no llama a la API, notifica la sesión rechazada y lanza `ApiError` 401 (S6). Para la persona el resultado es el mismo que antes (la API respondía 401), sin tráfico. Se actualiza el test de E2. |
| P2 | 401 `Authentication failed` en `/login` | P5 de `feat-error-handling` lo dejó para esta spec: con `toUserMessage` saldría el texto de sesión caducada. | `LoginPage` muestra "Email o contraseña incorrectos." para **cualquier** 401 de `/login` (S10), sin tocar `toUserMessage`. |
| P3 | Registro del getter del token | Si se registra en un efecto del proveedor, la primera petición autenticada de una ruta hija sale antes (efectos hijo → padre). | Registro a nivel de módulo en `SessionProvider.tsx`, leyendo `localStorage` (S6). Test específico de la primera carga (R8). |
| P4 | `volver` peligrosos no listados | R5 solo cubre `//`. `/\malicioso.example` lo normaliza el navegador a `//…`; `volver=/acceso` haría un bucle con la redirección de S9. | También se rechazan `\` y rutas que empiezan por `/acceso` (S2). |
| P5 | Redirección tras 401 en rutas no protegidas | R12 solo habla de rutas protegidas; `feat-booking-creation` R12 pide ir a `/acceso` desde el detalle (no protegido). | El proveedor no navega; `RequireAuth` redirige en rutas protegidas y en las demás se muestra el aviso con enlace (R11). `BookingForm` navegará él mismo en su spec. |
| P6 | `/acceso` con sesión ya iniciada | La spec no lo trata. | Redirige a `volver` válido o a `/lanzamientos` (S9); es además el mecanismo de redirección tras el login. |
| P7 | Formato de email | La spec da un ejemplo (`ana@ejemplo` inválido) pero no la regla. | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` sobre el valor recortado; se envía recortado (la API no recorta, `user.service.ts:60-63`). La contraseña se envía tal cual, pero `'   '` cuenta como vacía (la API la rechazaría con 400). |
| P8 | Contraseña tras un error | La spec solo dice que se conserva el email. | Se conservan ambos campos (cambio mínimo; la persona puede corregir y reintentar). |
| P9 | Cerrar sesión en una ruta protegida | Si `signOut` se aplica antes que la navegación, `RequireAuth` redirigiría a `/acceso`. | `navigate('/lanzamientos')` y `signOut()` en el mismo manejador; test que lo garantiza (T8). Si el test falla por el orden de actualización de React Router, se envuelve `signOut` en `startTransition` (se anota como desviación). |
| P10 | Duración y ubicación del aviso de caducidad | No se dice cuándo desaparece ni dónde se muestra fuera de `/acceso`. | En `Layout`, encima del contenido, hasta iniciar sesión (solo en memoria: al recargar ya no aparece); en `/acceso` sin enlace (S13). `role="alert"`. |
| P11 | Temporizador de caducidad | R12 "si la sesión caduca mientras está en una ruta protegida": sin temporizador solo se detectaría en la siguiente petición o navegación. | `setTimeout` hasta `expiresAt` además de la comprobación al entrar en rutas protegidas y antes de cada petición (S7, S8). |
| P12 | Reloj desajustado (riesgo R10) | Si el reloj local va por delante del servidor más de 24 h, la sesión caducaría nada más entrar. | Se aplica R4 literal (`exp` × 1000); el riesgo ya está aceptado en el ADD. |
| P13 | Prueba contra la API real | El proyecto `smoke` necesitaría la contraseña de `db/users.json`. | Sin *smoke* automatizado; prueba manual opcional de la persona (T10). |
