# feat: Inicio y cierre de sesión, y sesión caducada

- **Estado:** Aprobada
- **PRD:** F2, F3, F4 (+ D6; partes de F17 y F18)
- **Rama:** `feat/user-session`
- **Depende de:** `feat-error-handling` (y `feat-launch-list`, destino por defecto tras entrar o salir); `fix-api-user-session` en el fork para funcionar contra la API real
- **Prioridad:** Must

## Contexto
La API exige un token de acceso (JWT válido 24 h) para reservar y para consultar reservas (PRD §7). La persona debe poder iniciar sesión con email y contraseña, mantenerla al recargar o reabrir la app hasta que caduque (D6), cerrarla (F3) y, si la sesión deja de ser válida (caducada o rechazada por la API), recibir un aviso e invitación a entrar de nuevo (F4).

Esta spec crea la sesión y la protección de rutas. Las rutas protegidas reales (`/reservas`, `/reservas/:id`) llegan con `feat-my-bookings`; aquí la protección se prueba con tests de componente sobre una ruta de prueba, y los e2e de F3/F4 con una ruta protegida real se completan en `feat-my-bookings`.

## Alcance
- **Incluido:**
  - Página `/acceso` (`LoginPage`) y recurso `login()` (`POST /login`, sin sesión) con `authResponseDtoSchema`.
  - `SessionProvider`, `use-session`, `session-storage` (clave `astrobookings.session`), `domain/session` (`getTokenExpiry`, `isExpired`) y `RequireAuth` (ADD §5.3).
  - Conexión del aviso de "sesión rechazada" de `http()` (`feat-error-handling` R12) con la sesión.
  - Cabecera: nombre de usuario y botón "Cerrar sesión" con sesión; enlace "Iniciar sesión" sin ella.
- **Excluido:**
  - Registro y enlace "Crear cuenta" (`feat-user-registration`).
  - Enlace "Mis reservas" y rutas protegidas reales (`feat-my-bookings`).
  - Sincronización entre pestañas, recordar email, recuperar contraseña.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | El sistema deberá mostrar en `/acceso` un formulario con los campos "Email" (tipo email) y "Contraseña" (tipo contraseña), con etiquetas asociadas, y el botón "Iniciar sesión". |
| R2 | Si la persona envía el formulario con un campo vacío o con un email sin formato válido, entonces el sistema deberá mostrar junto al campo "Introduce tu email.", "Introduce tu contraseña." o "Introduce un email válido." sin llamar a la API. |
| R3 | Cuando la persona envíe el formulario válido, el sistema deberá enviar `POST /login` con `{ email, password }` y, mientras espera la respuesta, mostrar el botón deshabilitado con el texto "Entrando…" impidiendo un segundo envío. |
| R4 | Cuando la API responda 200, el sistema deberá guardar la sesión en `localStorage["astrobookings.session"]` como `{ accessToken, user: { username, email }, expiresAt }`, con `expiresAt` igual al claim `exp` del token × 1000 (o el momento de recepción + 24 h si no se puede leer), y llevar a la persona a la ruta de `?volver=` o, si no es válida, a `/lanzamientos`. |
| R5 | El sistema deberá aceptar como `volver` solo rutas internas que empiecen por `/` y no por `//`. |
| R6 | Si la API responde 401 al iniciar sesión, entonces el sistema deberá mostrar "Email o contraseña incorrectos." en un `role="alert"` general del formulario, sin marcar ningún campo como erróneo y sin disparar el aviso de sesión caducada. |
| R7 | Mientras haya sesión válida, el sistema deberá mostrar en la cabecera el nombre de usuario y el botón "Cerrar sesión"; sin sesión, el enlace "Iniciar sesión" a `/acceso?volver=<ruta actual>`. |
| R8 | Mientras `expiresAt` no haya pasado, el sistema deberá conservar la sesión al recargar la página o reabrir el navegador. |
| R9 | Cuando la persona pulse "Cerrar sesión", el sistema deberá borrar `localStorage["astrobookings.session"]`, llevarla a `/lanzamientos` y mostrar la cabecera sin sesión. |
| R10 | Si una persona sin sesión válida abre una ruta protegida, entonces el sistema deberá llevarla a `/acceso?volver=<ruta y consulta solicitadas>` sin pedir datos protegidos a la API. |
| R11 | Si una petición autenticada recibe 401, o la sesión ha caducado al arrancar, al entrar en una ruta protegida o antes de una petición autenticada, entonces el sistema deberá cerrar la sesión y mostrar "Tu sesión ha caducado o no es válida. Inicia sesión de nuevo." con un enlace "Iniciar sesión". |
| R12 | Si la sesión caduca o es rechazada mientras la persona está en una ruta protegida, entonces el sistema deberá llevarla a `/acceso?volver=<ruta actual>` mostrando allí el aviso de R11. |

## Criterios de aceptación
### R1
- **Dado** una persona sin sesión
- **Cuando** abre `/acceso`
- **Entonces** existen `getByLabelText('Email')` de tipo `email`, `getByLabelText('Contraseña')` de tipo `password` y `getByRole('button', { name: 'Iniciar sesión' })`

### R2
- **Dado** el formulario de acceso vacío
- **Cuando** la persona pulsa "Iniciar sesión"
- **Entonces** ve "Introduce tu email." junto a "Email" e "Introduce tu contraseña." junto a "Contraseña", y no se ha enviado ninguna petición
- **Y** con el email "ana@ejemplo" ve "Introduce un email válido."

### R3
- **Dado** la API simulada tarda en responder a `POST /login`
- **Cuando** la persona escribe "ana@ejemplo.com" y "secreto1" y hace doble clic en "Iniciar sesión"
- **Entonces** se envía una sola petición con el cuerpo `{ "email": "ana@ejemplo.com", "password": "secreto1" }` y el botón muestra "Entrando…" deshabilitado hasta la respuesta

### R4
- **Dado** la API responde 200 con `{ "user": { "id": 2, "username": "ana", "email": "ana@ejemplo.com", "terms": true }, "accessToken": "<JWT con exp 1794045600>" }`
- **Cuando** la persona inicia sesión desde `/acceso?volver=/lanzamientos/activity-1`
- **Entonces** `localStorage["astrobookings.session"]` contiene el token, `user` `{ "username": "ana", "email": "ana@ejemplo.com" }` y `expiresAt` `1794045600000`, y la persona está en `/lanzamientos/activity-1`
- **Y** con un token que no es JWT (`"opaque-token"`), `expiresAt` es el momento de recepción + 86 400 000 ms
- **Y** desde `/acceso` sin `volver`, llega a `/lanzamientos`

### R5
- **Dado** los valores de `volver` `/reservas?lanzamiento=activity-1`, `https://malicioso.example`, `//malicioso.example` y `reservas`
- **Cuando** la persona inicia sesión con cada uno
- **Entonces** solo el primero se respeta; en los demás llega a `/lanzamientos`

### R6
- **Dado** la API responde 401 `{ "message": "Invalid email or password", "errors": [] }`
- **Cuando** la persona intenta entrar con "ana@ejemplo.com" y "incorrecta"
- **Entonces** ve `role="alert"` con "Email o contraseña incorrectos.", ningún campo tiene `aria-invalid="true"`, sigue en `/acceso` y no aparece "Tu sesión ha caducado o no es válida."

### R7
- **Dado** una sesión válida de "ana" en `localStorage`
- **Cuando** abre `/lanzamientos`
- **Entonces** la cabecera muestra "ana" y el botón "Cerrar sesión", y no muestra "Iniciar sesión"
- **Y** sin sesión, en `/lanzamientos/activity-1` la cabecera muestra el enlace "Iniciar sesión" a `/acceso?volver=%2Flanzamientos%2Factivity-1`

### R8
- **Dado** una sesión con `expiresAt` 2 horas en el futuro guardada en `localStorage`
- **Cuando** la persona recarga `/lanzamientos`
- **Entonces** la cabecera sigue mostrando "ana" y "Cerrar sesión"

### R9
- **Dado** una sesión válida de "ana" y la persona en `/lanzamientos/activity-1`
- **Cuando** pulsa "Cerrar sesión"
- **Entonces** `localStorage["astrobookings.session"]` no existe, la URL es `/lanzamientos` y la cabecera muestra "Iniciar sesión"

### R10
- **Dado** una ruta de prueba protegida `/protegida` en un test de componente con `MemoryRouter` y sin sesión
- **Cuando** se navega a `/protegida?x=1`
- **Entonces** se muestra la ruta `/acceso?volver=%2Fprotegida%3Fx%3D1` y no se ha llamado a ningún recurso protegido

### R11
- **Dado** `localStorage["astrobookings.session"]` con `expiresAt` en el pasado (o con un contenido que no es JSON válido)
- **Cuando** la persona abre `/lanzamientos`
- **Entonces** la clave se borra, la cabecera muestra "Iniciar sesión" y se ve "Tu sesión ha caducado o no es válida. Inicia sesión de nuevo." con el enlace "Iniciar sesión" (con contenido no JSON solo se borra la clave, sin aviso)
- **Y** en test de componente, si una petición autenticada recibe 401 o la sesión ha caducado justo antes de pedirla, la sesión se cierra, se muestra el aviso y, en el segundo caso, no se llama a `fetch`

### R12
- **Dado** una sesión válida en la ruta de prueba protegida `/protegida`
- **Cuando** una petición autenticada de esa ruta recibe 401 `Invalid or expired token. Please login again.`
- **Entonces** se muestra `/acceso?volver=%2Fprotegida` con el aviso "Tu sesión ha caducado o no es válida. Inicia sesión de nuevo." y `localStorage` no contiene la sesión

## Casos límite
- Doble clic en "Iniciar sesión": una sola petición (R3).
- Credenciales incorrectas: mensaje sin indicar qué dato falla (R6).
- 400 `Validation failed` del login (no debería ocurrir por R2): errores junto al campo según `feat-error-handling` R8.
- Red caída o 500 al iniciar sesión: mensaje de `feat-error-handling` en `role="alert"`; el formulario conserva el email.
- `volver` externo o con `//`: se ignora (R5).
- Sesión caducada al arrancar, guardada con forma inválida o JSON corrupto (R11).
- Token sin claim `exp` legible: caducidad a 24 h desde la recepción (R4).

## Fuera de la spec / notas
- El 401 de `POST /login` nunca dispara el flujo de sesión caducada (la petición no es autenticada).
- El token se guarda en `localStorage` (ADR-010): riesgo de XSS aceptado en un proyecto de formación.
- Los e2e de "tras cerrar sesión no puede ver reservas" y "401 en una ruta protegida real" están en `feat-my-bookings`; el de "no puede reservar sin sesión", en `feat-booking-creation`.
