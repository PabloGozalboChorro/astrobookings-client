# feat: Cliente de la API, errores en español y estados de carga

- **Estado:** Aprobada
- **PRD:** F17, F18 (parte común: carga de datos)
- **Rama:** `feat/error-handling`
- **Depende de:** `chore-project-scaffolding`
- **Prioridad:** Must

## Contexto
Todas las pantallas llaman a la API y todas deben mostrar los errores en español (D8, V1) sin ignorar ninguno (O5, F17), y enseñar que la aplicación está trabajando mientras carga (F18). Esta spec define una sola vez ese comportamiento común: el cliente HTTP centralizado, la clasificación de errores, la tabla de traducción y los componentes genéricos de carga, error y campo de formulario. Las specs de funcionalidad lo reutilizan y añaden sus criterios concretos.

No hay pantallas nuevas: todo se verifica con tests unitarios y de componentes.

## Alcance
- **Incluido:**
  - `src/api/http.ts`, `src/api/errors.ts`, `src/api/schemas.ts` (solo `errorResponseDtoSchema`; los demás esquemas los añade cada spec) (ADD §4.3, §4.4).
  - `src/domain/api-errors.ts`: `toUserMessage`, traducción de errores por campo y `parseAvailableSeats` (ADD §6, ADR-008).
  - `src/hooks/use-async-data.ts` (ADD §5.2).
  - Componentes `LoadingIndicator`, `ErrorMessage`, `EmptyState` y `FormField` (ADD §3).
  - Mecanismo de suscripción a "sesión rechazada" en `http()` (la sesión lo conecta en `feat-user-session`).
- **Excluido:**
  - Mensajes y comportamiento propios de cada pantalla (en cada spec).
  - La gestión de la sesión (`feat-user-session`).

## Textos de error (ADR-008)

Mensajes fijos por tipo:

| Situación | Texto en pantalla |
|---|---|
| Red caída (`fetch` rechazado: API apagada, CORS, DNS) | No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo. |
| 500 u otro código no previsto (≥ 500) | Se ha producido un error en el servidor. Inténtalo de nuevo más tarde. |
| Respuesta 2xx con forma inesperada | El servidor ha devuelto una respuesta inesperada. |
| 401 en petición con sesión | Tu sesión ha caducado o no es válida. Inicia sesión de nuevo. |
| 402 | El pago no se ha podido procesar. La reserva no se ha realizado. |

Traducción de mensajes conocidos de la API:

| `message` de la API | Texto en pantalla |
|---|---|
| `Validation failed` | Revisa los datos marcados. |
| `Email is already registered` | Ya existe una cuenta con este email. |
| `Invalid email or password` | Email o contraseña incorrectos. |
| `Authentication required. Please provide a valid token.` | Tu sesión ha caducado o no es válida. Inicia sesión de nuevo. |
| `Invalid or expired token. Please login again.` | Tu sesión ha caducado o no es válida. Inicia sesión de nuevo. |
| `Capacity exceeded. Available: X, Requested: Y` | Solo quedan X plazas libres. (X = 0: "No quedan plazas libres en este lanzamiento."; X no legible: "No hay plazas suficientes para tu solicitud.") |
| `Payment could not be processed` | El pago no se ha podido procesar. La reserva no se ha realizado. |
| `Activity not found` | Este lanzamiento no existe o ya no está disponible. |
| `Booking not found` | No encontramos esta reserva. |
| `Failed to retrieve activities` / `Failed to retrieve bookings` | Se ha producido un error en el servidor. Inténtalo de nuevo más tarde. |

Texto genérico por código para mensajes desconocidos (se añade el original entre paréntesis): 400 "No se ha podido completar la operación", 401 "Tu sesión ha caducado o no es válida. Inicia sesión de nuevo", 402 "El pago no se ha podido procesar", 404 "No se ha encontrado lo que buscas", resto "Se ha producido un error en el servidor".

Errores por campo (según `field`, ignorando el texto inglés de la API):

| `field` | Texto junto al campo |
|---|---|
| `username` | Introduce un nombre de usuario válido. |
| `email` | Introduce un email válido. (con `Email is already registered`: "Ya existe una cuenta con este email.") |
| `password` | La contraseña debe tener al menos 6 caracteres. |
| `terms` | Debes aceptar los términos y condiciones. |
| `participants` | Introduce un número entero de plazas mayor o igual que 1. |
| `activityId` | El lanzamiento indicado no es válido. |
| otro | Dato no válido (texto original de la API). |

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Cuando un módulo de recurso haga una petición, el sistema deberá enviarla a `VITE_API_URL` + ruta con `Content-Type: application/json` y, si la petición es autenticada y hay token, con la cabecera `Authorization: Bearer <token>`. |
| R2 | Cuando la API responda con un código distinto de 2xx, el sistema deberá clasificar el error como `validation` (400 con `errors` no vacío), `capacity` (400 cuyo mensaje empieza por "Capacity exceeded"), `unauthorized` (401), `payment` (402), `not-found` (404) o `server` (cualquier otro), conservando los errores por campo y, en `capacity`, las plazas disponibles leídas del mensaje. |
| R3 | Si la petición no llega a la API (el `fetch` se rechaza), entonces el sistema deberá mostrar el texto de red caída de la tabla. |
| R4 | Si la API responde 500 o con un cuerpo de error que no es JSON o no tiene la forma `{ message, errors }`, entonces el sistema deberá mostrar el texto de error del servidor correspondiente a su código. |
| R5 | Si una respuesta 2xx no cumple el esquema esperado, entonces el sistema deberá mostrar "El servidor ha devuelto una respuesta inesperada." sin usar los datos recibidos. |
| R6 | Cuando la API devuelva un mensaje de la tabla de mensajes conocidos, el sistema deberá mostrar su traducción al español. |
| R7 | Si la API devuelve un mensaje que no está en la tabla, entonces el sistema deberá mostrar el texto genérico de su código seguido del mensaje original entre paréntesis. |
| R8 | Cuando un error tenga errores por campo, el sistema deberá mostrar el texto en español de cada campo junto a su control, asociado con `aria-describedby` y marcando el control con `aria-invalid="true"`. |
| R9 | Cuando se muestre un error, el sistema deberá presentarlo en un elemento con `role="alert"` y, si la vista permite reintentar, con un botón "Reintentar" que repite la carga. |
| R10 | Mientras una vista esté cargando datos, el sistema deberá mostrar un indicador con `role="status"` y un texto de carga. |
| R11 | Cuando cambien los parámetros de una carga en curso, el sistema deberá cancelar la petición anterior y mostrar solo el resultado de la última. |
| R12 | Cuando una petición autenticada reciba un 401, el sistema deberá notificar a los suscriptores de "sesión rechazada"; una petición no autenticada que reciba 401 no deberá notificarlos. |

## Criterios de aceptación
### R1
- **Dado** `VITE_API_URL=http://localhost:3000` y `fetch` simulado
- **Cuando** se hace una petición autenticada a `/bookings` con el token `abc.def.ghi`
- **Entonces** `fetch` recibe `http://localhost:3000/bookings` con las cabeceras `Content-Type: application/json` y `Authorization: Bearer abc.def.ghi`
- **Y** una petición no autenticada a `/activities` no lleva cabecera `Authorization`

### R2
- **Dado** `fetch` simulado
- **Cuando** responde 400 `{ "message": "Capacity exceeded. Available: 2, Requested: 5", "errors": [] }`
- **Entonces** el error es de tipo `capacity` con 2 plazas disponibles
- **Y** con 400 `{ "message": "Validation failed", "errors": [{ "field": "email", "message": "Invalid email" }] }` es de tipo `validation` con un error para `email`; con 401, 402, 404 y 503 es `unauthorized`, `payment`, `not-found` y `server`

### R3
- **Dado** `fetch` que se rechaza con `TypeError: Failed to fetch`
- **Cuando** se convierte el error en mensaje para la persona
- **Entonces** el texto es "No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo."

### R4
- **Dado** `fetch` que responde 500 con el cuerpo `<html>Internal Server Error</html>`
- **Cuando** se convierte el error en mensaje
- **Entonces** el texto es "Se ha producido un error en el servidor. Inténtalo de nuevo más tarde."

### R5
- **Dado** una petición que espera un objeto con `id` de tipo texto
- **Cuando** `fetch` responde 200 con `{ "id": 7 }`
- **Entonces** se produce un error de contrato y el texto es "El servidor ha devuelto una respuesta inesperada."

### R6
- **Dado** cada mensaje de la tabla de mensajes conocidos
- **Cuando** se convierte en texto para la persona
- **Entonces** el resultado es su traducción (por ejemplo, `Email is already registered` → "Ya existe una cuenta con este email." y `Capacity exceeded. Available: 0, Requested: 1` → "No quedan plazas libres en este lanzamiento.")

### R7
- **Dado** una respuesta 400 con `{ "message": "Launch window closed", "errors": [] }`
- **Cuando** se convierte en texto para la persona
- **Entonces** el texto es "No se ha podido completar la operación (Launch window closed)"

### R8
- **Dado** un `FormField` con la etiqueta "Email" y el error del campo `email` de una respuesta `Validation failed`
- **Cuando** se renderiza
- **Entonces** `getByLabelText('Email')` tiene `aria-invalid="true"` y su `aria-describedby` apunta a un elemento con el texto "Introduce un email válido."
- **Y** un campo desconocido `foo` con mensaje `bad value` muestra "Dato no válido (bad value)"

### R9
- **Dado** un `ErrorMessage` con el texto de red caída y una función de reintento
- **Cuando** la persona pulsa "Reintentar"
- **Entonces** el texto está dentro de `role="alert"` y la función de reintento se llama una vez
- **Y** sin función de reintento no aparece el botón "Reintentar"

### R10
- **Dado** un componente que usa `useAsyncData` con una carga que no termina
- **Cuando** se renderiza
- **Entonces** se ve `role="status"` con el texto de carga (por ejemplo, "Cargando…") y, al resolverse la carga, el indicador desaparece

### R11
- **Dado** `useAsyncData` con una carga para `q=fal` que tarda 200 ms y otra para `q=falcon` que tarda 50 ms
- **Cuando** los parámetros cambian de `fal` a `falcon` antes de que termine la primera
- **Entonces** la primera petición recibe la señal de cancelación y el estado final contiene solo el resultado de `falcon`

### R12
- **Dado** un suscriptor registrado a "sesión rechazada"
- **Cuando** una petición autenticada a `/bookings` recibe 401 `Invalid or expired token. Please login again.`
- **Entonces** el suscriptor se llama una vez
- **Y** cuando una petición no autenticada a `/login` recibe 401 `Invalid email or password`, el suscriptor no se llama

## Casos límite
- Mensaje de capacidad con texto inesperado (`Capacity exceeded`, sin "Available"): plazas `null` y texto "No hay plazas suficientes para tu solicitud."
- `Available: 0`: texto "No quedan plazas libres en este lanzamiento."
- 400 con `errors: []` y mensaje desconocido: texto genérico + original (R7).
- Cuerpo de error vacío o no JSON: texto genérico del código, sin paréntesis (R4).
- Petición cancelada por cambio de parámetros: no se muestra como error (R11).
- Varios errores para el mismo campo: se muestra el primero.

## Fuera de la spec / notas
- Los mensajes de error nunca se ocultan ni se registran solo en consola (AGENTS.md §6).
- Los textos de carga concretos ("Cargando lanzamientos…", "Cargando tus reservas…") los fija cada spec.
- La protección contra doble envío de la reserva (F18) está en `feat-booking-creation`; el bloqueo de los formularios de acceso y registro, en sus specs.
