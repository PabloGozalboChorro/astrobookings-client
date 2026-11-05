# feat: Registro de cuenta

- **Estado:** Aprobada
- **PRD:** F1 (+ D6; partes de F17 y F18)
- **Rama:** `feat/user-registration`
- **Depende de:** `feat-user-session`
- **Prioridad:** Must

## Contexto
Para reservar hace falta una cuenta (PRD §7). La persona se registra con nombre de usuario, email, contraseña de al menos 6 caracteres y aceptando los términos. La API devuelve el token al registrar (`201`), así que la sesión queda iniciada directamente, sin pasar por el formulario de acceso (F1). Si el email ya existe o un dato no es válido, se indica qué campo falla.

## Alcance
- **Incluido:**
  - Página `/registro` (`RegisterPage`) y recurso `register()` (`POST /users`, sin sesión).
  - Validación en el cliente de campos obligatorios, formato de email, longitud de contraseña y aceptación de términos.
  - Inicio de sesión automático tras el registro (reutiliza la sesión de `feat-user-session`).
  - Enlace "Crear cuenta" en la cabecera sin sesión y enlaces cruzados entre `/acceso` y `/registro`.
- **Excluido:**
  - Texto legal de los términos (solo la casilla), confirmación por email, verificación de contraseña repetida.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | El sistema deberá mostrar en `/registro` los campos "Nombre de usuario", "Email" (tipo email), "Contraseña" (tipo contraseña) y la casilla "Acepto los términos y condiciones", con etiquetas asociadas, y el botón "Crear cuenta". |
| R2 | Si la persona envía el formulario con datos no válidos, entonces el sistema deberá mostrar junto a cada campo erróneo su mensaje ("Introduce un nombre de usuario.", "Introduce tu email.", "Introduce un email válido.", "La contraseña debe tener al menos 6 caracteres." o "Debes aceptar los términos y condiciones.") sin llamar a la API. |
| R3 | Cuando la persona envíe el formulario válido, el sistema deberá enviar `POST /users` con exactamente `{ username, email, password, terms: true }` y, mientras espera, mostrar el botón deshabilitado con el texto "Creando cuenta…" impidiendo un segundo envío. |
| R4 | Cuando la API responda 201, el sistema deberá iniciar la sesión con el token y el usuario recibidos (igual que `feat-user-session` R4) y llevar a la persona a la ruta de `?volver=` válida o a `/lanzamientos`. |
| R5 | Si la API responde 400 `Email is already registered`, entonces el sistema deberá mostrar "Ya existe una cuenta con este email." junto al campo "Email" y conservar los datos escritos. |
| R6 | Si la API responde 400 `Validation failed` con errores por campo, entonces el sistema deberá mostrar el texto en español de cada campo junto a su control (`feat-error-handling` R8). |
| R7 | Mientras no haya sesión, el sistema deberá mostrar en la cabecera el enlace "Crear cuenta" a `/registro?volver=<ruta actual>`. |
| R8 | El sistema deberá mostrar en `/acceso` el enlace "¿No tienes cuenta? Crea una" a `/registro` y en `/registro` el enlace "¿Ya tienes cuenta? Inicia sesión" a `/acceso`, conservando el parámetro `volver`. |

## Criterios de aceptación
### R1
- **Dado** una persona sin sesión
- **Cuando** abre `/registro`
- **Entonces** existen `getByLabelText('Nombre de usuario')`, `getByLabelText('Email')` de tipo `email`, `getByLabelText('Contraseña')` de tipo `password`, `getByRole('checkbox', { name: 'Acepto los términos y condiciones' })` sin marcar y `getByRole('button', { name: 'Crear cuenta' })`

### R2
- **Dado** el formulario con nombre "ana", email "ana@ejemplo.com", contraseña "12345" y la casilla sin marcar
- **Cuando** la persona pulsa "Crear cuenta"
- **Entonces** ve "La contraseña debe tener al menos 6 caracteres." junto a "Contraseña" y "Debes aceptar los términos y condiciones." junto a la casilla, y no se ha enviado ninguna petición
- **Y** con todo vacío ve "Introduce un nombre de usuario." y "Introduce tu email."; con email "ana@" ve "Introduce un email válido."; con contraseña "123456" no hay error de contraseña

### R3
- **Dado** la API simulada tarda en responder a `POST /users`
- **Cuando** la persona rellena "ana", "ana@ejemplo.com", "secreto1", marca la casilla y hace doble clic en "Crear cuenta"
- **Entonces** se envía una sola petición con el cuerpo `{ "username": "ana", "email": "ana@ejemplo.com", "password": "secreto1", "terms": true }` y el botón muestra "Creando cuenta…" deshabilitado

### R4
- **Dado** la API responde 201 con `{ "user": { "id": 3, "username": "ana", "email": "ana@ejemplo.com", "terms": true }, "accessToken": "<JWT>" }`
- **Cuando** la persona se registra desde `/registro?volver=/lanzamientos/activity-1`
- **Entonces** llega a `/lanzamientos/activity-1`, la cabecera muestra "ana" y "Cerrar sesión", `localStorage["astrobookings.session"]` contiene la sesión y no se ha llamado a `POST /login`

### R5
- **Dado** la API responde 400 `{ "message": "Email is already registered", "errors": [{ "field": "email", "message": "Email is already registered" }] }`
- **Cuando** la persona se registra con "ana@ejemplo.com"
- **Entonces** ve "Ya existe una cuenta con este email." asociado al campo "Email" (`aria-invalid="true"`), y los campos conservan "ana" y "ana@ejemplo.com"

### R6
- **Dado** la API responde 400 `{ "message": "Validation failed", "errors": [{ "field": "username", "message": "Username is required" }, { "field": "password", "message": "Password must be at least 6 characters" }] }`
- **Cuando** la persona envía el formulario
- **Entonces** ve "Introduce un nombre de usuario válido." junto a "Nombre de usuario" y "La contraseña debe tener al menos 6 caracteres." junto a "Contraseña"

### R7
- **Dado** una persona sin sesión en `/lanzamientos/activity-1`
- **Cuando** mira la cabecera
- **Entonces** ve el enlace "Crear cuenta" a `/registro?volver=%2Flanzamientos%2Factivity-1`; con sesión, el enlace no aparece

### R8
- **Dado** la persona en `/acceso?volver=/reservas`
- **Cuando** pulsa "¿No tienes cuenta? Crea una"
- **Entonces** llega a `/registro?volver=%2Freservas`, y desde ahí "¿Ya tienes cuenta? Inicia sesión" lleva a `/acceso?volver=%2Freservas`

## Casos límite
- Contraseña de 5 caracteres (error) y de 6 (válida) (R2).
- Términos sin aceptar (R2).
- Email ya registrado (R5).
- Errores por campo de la API, incluido un campo desconocido ("Dato no válido (…)") (R6).
- Doble clic en "Crear cuenta": una sola petición (R3).
- Red caída o 500: mensaje de `feat-error-handling` en `role="alert"`, conservando los datos escritos.
- `volver` externo: se ignora y se va a `/lanzamientos` (`feat-user-session` R5).

## Fuera de la spec / notas
- La API usa el campo `terms` (no `termsAccepted`); el cliente envía siempre `true` porque no deja enviar sin marcar la casilla.
- Las reglas de formato del nombre de usuario las decide la API; el cliente solo exige que no esté vacío y muestra los errores que devuelva la API.
- El `id` numérico del usuario que devuelve la API no se guarda en la sesión.
