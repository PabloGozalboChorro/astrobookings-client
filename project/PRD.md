# PRD — AstroBookings Client

- **Estado:** Aprobado (2026-11-05)
- **Última actualización:** 2026-11-05

## 1. Problema

AstroBookings (empresa ficticia de viajes espaciales) dispone de una API de reservas, pero sus clientes no tienen una forma cómoda de usarla. Necesitan una aplicación con la que **consultar los lanzamientos (viajes en cohete) que se ofrecen**, **reservar plazas** sin pasarse de las que quedan libres y **seguir el estado de sus reservas**.

Es un proyecto de formación: el objetivo es practicar el desarrollo guiado por especificaciones sobre un caso realista y acotado.

## 2. Objetivos

| # | Objetivo | Cómo se comprueba |
|---|---|---|
| O1 | Que una persona pueda crear su cuenta e iniciar sesión desde la aplicación | Con la API en marcha, una persona nueva se registra, inicia sesión y ve su sesión activa sin usar herramientas externas |
| O2 | Que el cliente vea los lanzamientos disponibles con la información necesaria para decidir | El listado muestra, por cada lanzamiento reservable, nombre, destino/lugar, fecha, precio y plazas; los datos coinciden con lo que devuelve la API |
| O3 | Que el cliente reserve plazas sin superar las disponibles | Una reserva válida aparece en "Mis reservas"; una reserva que supera las plazas libres se rechaza y la persona ve el motivo (ninguna reserva queda creada) |
| O4 | Que el cliente conozca el estado de sus reservas | "Mis reservas" lista solo las reservas de la persona con sesión iniciada, cada una con su estado, y se puede abrir el detalle de cualquiera |
| O5 | Que ningún error pase desapercibido | Cada error de la API (validación, sesión caducada, plazas insuficientes, pago rechazado, red caída) produce un mensaje comprensible en pantalla |

## 3. Usuarios

| Perfil | Necesidades |
|---|---|
| Cliente (viajero) | Registrarse, iniciar y cerrar sesión; explorar y buscar lanzamientos; ver el detalle de uno; reservar N plazas; consultar sus reservas y su estado |
| Visitante sin sesión | Explorar el catálogo de lanzamientos antes de decidir registrarse |

El perfil **Proveedor** (quien crea y gestiona lanzamientos) existe en la API pero queda fuera de este producto.

## 4. Alcance

### Incluido
- Registro de cuenta (nombre de usuario, email, contraseña y aceptación de términos).
- Inicio y cierre de sesión.
- Listado de lanzamientos, con búsqueda por texto y ordenación (por nombre, fecha o precio).
- Detalle de un lanzamiento.
- Reserva de N plazas en un lanzamiento, sin superar las disponibles.
- "Mis reservas": listado de las reservas propias con su estado.
- Detalle de una reserva.
- Mensajes de error comprensibles para cualquier fallo.

### Fuera de alcance
- Crear, editar o borrar lanzamientos, y cambiar su estado (rol Proveedor).
- Cancelar reservas y gestionar reembolsos (la API no lo permite).
- Pagos reales (la API usa una pasarela simulada; el cliente no pide datos de pago).
- Notificaciones (email, push…).
- Gestión del perfil de usuario (cambiar contraseña, datos, baja).
- Ver las reservas de otras personas.

## 5. Requisitos funcionales

| ID | Requisito | Prioridad (Must/Should/Could) |
|---|---|---|
| F1 | La persona puede registrarse indicando nombre de usuario, email, contraseña (mínimo 6 caracteres) y aceptando los términos. Si el email ya existe o algún dato no es válido, se le indica qué campo falla. Tras un registro correcto, la sesión queda iniciada directamente (la API devuelve el token al registrar). | Must |
| F2 | La persona puede iniciar sesión con email y contraseña. Si las credenciales no son correctas, se le informa sin revelar cuál de los dos datos falla. | Must |
| F3 | La persona con sesión iniciada puede cerrarla. Tras cerrarla no puede reservar ni ver reservas hasta volver a entrar. | Must |
| F4 | Cuando la sesión deja de ser válida (caducada o rechazada por la API), se informa a la persona y se le invita a iniciar sesión de nuevo. | Must |
| F5 | Cualquier persona, con o sin sesión, puede ver el listado de lanzamientos (todos salvo los `draft`, D3). Cada elemento muestra misión, cohete (D1), lugar/destino, fecha y hora, duración, precio por plaza en euros, plazas totales (D2) y estado. | Must |
| F6 | La persona puede buscar lanzamientos por texto (coincidencia en nombre, lugar o identificador legible). | Should |
| F7 | La persona puede ordenar el listado por nombre completo (cohete y misión, según D1), fecha o precio, en orden ascendente o descendente. | Should |
| F8 | La persona puede abrir el detalle de un lanzamiento con todos sus datos visibles (incluido el mínimo de participantes necesario). Si el lanzamiento no existe, se le informa. | Must |
| F9 | Desde el detalle de un lanzamiento reservable, la persona con sesión iniciada puede reservar N plazas (N entero ≥ 1; el cliente no admite decimales aunque la API sí los acepte). Antes de confirmar ve el importe total (precio por plaza × N). Si no tiene sesión, se le pide iniciarla o registrarse. | Must |
| F10 | No se crea ninguna reserva que supere las plazas disponibles. Como el cliente no conoce las plazas libres (D2), esta garantía la da el rechazo de la API: el cliente impide superar las plazas totales y, si la API rechaza la reserva por falta de plazas, la persona ve cuántas quedan libres según la respuesta de la API. | Must |
| F11 | Solo se puede reservar en lanzamientos en estado `published` o `confirmed` y con fecha futura (D3, D4); en el resto la opción de reservar no está disponible y se explica por qué. | Must |
| F12 | Si el pago simulado es rechazado, se informa a la persona de que la reserva no se ha realizado. | Must |
| F13 | Tras una reserva correcta, la persona ve una confirmación con el lanzamiento, número de plazas, importe y estado, y puede ir a "Mis reservas". | Must |
| F14 | La persona con sesión iniciada puede ver "Mis reservas": solo sus reservas, cada una con lanzamiento, fecha del lanzamiento, plazas, importe total, fecha de la reserva y estado. Si no tiene ninguna, se le indica. | Must |
| F15 | La persona puede abrir el detalle de una de sus reservas, con los datos del lanzamiento asociado (incluido su estado actual, por ejemplo si se ha cancelado). Si la reserva no existe o no es suya, se le informa de que no se encuentra. | Must |
| F16 | El estado de una reserva se muestra con un texto comprensible: pendiente de pago, pagada o reembolsada. | Must |
| F17 | Todo error devuelto por la API se muestra a la persona en español (D8): los mensajes conocidos se traducen y, si llega uno desconocido, se muestra un texto genérico con el original entre paréntesis. Los errores por campo aparecen junto al campo correspondiente. Los fallos de conexión y los errores del servidor (500) se muestran con un mensaje específico. | Must |
| F18 | Mientras se cargan datos o se envía una operación, la persona ve que la aplicación está trabajando y no puede enviar la misma reserva dos veces. | Should |
| F19 | En "Mis reservas", la persona puede filtrar sus reservas por lanzamiento. | Could |

## 6. Requisitos no funcionales

- **Usabilidad:** todas las tareas de F1–F16 se completan sin conocer la API ni sus identificadores técnicos. Los textos de la interfaz se escriben en el idioma acordado (D8).
- **Accesibilidad:** formularios con etiquetas asociadas, mensajes de error anunciados y navegación completa con teclado (objetivo WCAG 2.1 AA en lo razonable para un proyecto de formación).
- **Adaptabilidad:** la aplicación se usa correctamente en anchura de móvil y de escritorio.
- **Compatibilidad:** últimas versiones de Chrome, Firefox y Edge.
- **Rendimiento:** con la API en local, el listado y el detalle se muestran en menos de 2 s.
- **Fiabilidad de los datos:** las plazas, precios y estados mostrados proceden siempre de la API; la aplicación no inventa ni guarda por su cuenta datos de negocio.
- **Configuración:** la dirección de la API es configurable sin cambiar el producto (por defecto, la API local en `http://localhost:3000`).
- **Verificabilidad:** cada requisito F<n> debe poder comprobarse con criterios de aceptación en su spec.

## 7. Supuestos y restricciones

### Backend
- El backend es la API de ejemplo del curso **activity-bookings-express** (https://github.com/Programacion-Inteligente/activity-bookings-express), ejecutada en local por la persona a partir de un fork, en `http://localhost:3000`.
- La API **exige registro e inicio de sesión** (token de acceso con validez de 24 h) para reservar y para consultar reservas, aunque el briefing indique que no se requiere seguridad. Por eso el producto incluye registro, inicio y cierre de sesión. El catálogo de lanzamientos es público.
- La aplicación es web. La tecnología la decide el ADD.

### Mapeo entre la API y el dominio

| Dominio del cliente | API (`activity-bookings-express`) | Notas |
|---|---|---|
| Lanzamiento (viaje en cohete) | `activity` | Un lanzamiento es una actividad |
| Nombre de la misión | `name` | |
| Identificador legible | `slug` | Se genera a partir del nombre |
| Destino / lugar de despegue | `location` | Se muestra como lugar de despegue o destino |
| Fecha y hora del lanzamiento | `date` (ISO 8601) | |
| Duración | `duration` (minutos) | |
| Precio por plaza | `price` | En euros (D7) |
| Plazas totales | `maxParticipants` | |
| Mínimo de viajeros para que se confirme | `minParticipants` | |
| Plazas disponibles | No existe | La API las calcula internamente (máximo menos plazas reservadas) pero no las expone (D2) |
| Cohete | Prefijo de `name` antes de ` · ` | D1 |
| Estado del lanzamiento | `status`: `draft`, `published`, `confirmed`, `sold-out`, `done`, `cancelled` | D3 |
| Reserva | `booking` | `participants` = plazas reservadas |
| Estado de la reserva | `paymentStatus`: `pending`, `paid`, `refunded` | Es el estado del pago; no hay otro estado de reserva |
| Importe de la reserva | No viene en la reserva | Se obtiene como `price` × `participants` (el pago guarda `amount`, pero no se expone) |
| Cliente | `user` (`username`, `email`) | |

### Endpoints usados (solo referencia; el contrato detallado es del ADD)

| Uso | Método y ruta | Sesión |
|---|---|---|
| Registro (F1) | `POST /users` | No |
| Inicio de sesión (F2) | `POST /login` | No |
| Listado, búsqueda y orden (F5–F7) | `GET /activities?q=&_sort=&_order=` | No |
| Detalle de lanzamiento (F8) | `GET /activities/:id` | No |
| Crear reserva (F9–F13) | `POST /bookings` | Sí |
| Mis reservas (F14, F19) | `GET /bookings?activityId=` | Sí |
| Detalle de reserva (F15) | `GET /bookings/:id` | Sí |

### Comportamiento de la API que condiciona el producto
- **Errores:** todas las respuestas de error tienen la forma `{ message, errors[] }`, donde cada elemento de `errors` es `{ field, message }` (vacío si no es un error de validación). Códigos relevantes: 400 (validación o plazas insuficientes, con el texto "Capacity exceeded. Available: X, Requested: Y"), 401 (sin sesión, sesión caducada o credenciales incorrectas), 402 (pago rechazado), 404 (lanzamiento o reserva no encontrados), 500 (error interno; por ejemplo, `GET /bookings` falla si una reserva apunta a un lanzamiento que ya no existe).
- **Plazas decimales:** la API acepta `participants` con decimales; el cliente solo permite enteros (F9).
- **Pago simulado:** el cobro se hace automáticamente al reservar; la pasarela simulada rechaza cualquier importe múltiplo de 1000. El cliente no pide datos de pago.
- **Estado de la reserva en la práctica:** toda reserva creada con éxito queda como `paid`. `pending` solo aparece si una reserva no tiene estado guardado, y la API nunca asigna `refunded`. El producto debe saber mostrar los tres.
- **Reservas de otros:** la API solo devuelve las reservas de la persona con sesión iniciada; no es posible conocer las reservas de otras personas.
- **Validación en la API:** la API no impide reservar en lanzamientos en borrador, cancelados, finalizados, agotados o con fecha pasada; solo comprueba que exista y que haya plazas. La restricción de F11 la aplica el cliente.
- **Listado:** `GET /activities` devuelve todos los lanzamientos, incluidos los borradores; no se puede filtrar por estado ni por fecha.
- **Sin cancelación:** la API no permite cancelar reservas ni pedir reembolsos.

### Restricciones
- Proyecto de formación, no apto para producción.
- No se añaden funcionalidades que requieran cambiar la API, salvo que se decida explícitamente en una de las preguntas abiertas.

## 8. Decisiones (aprobadas el 2026-11-05)

| # | Tema | Decisión |
|---|---|---|
| D1 | Cohete | Convención en `name`: `"<Cohete> · <Misión>"` (por ejemplo, `Falcon 9 · Misión Luna`). El cliente separa ambas partes; si el nombre no contiene ` · `, no se muestra cohete y todo el nombre es la misión. |
| D2 | Plazas disponibles | Se muestran las plazas totales (`maxParticipants`). Las disponibles solo se comunican cuando la API rechaza una reserva ("Available: X"). No se modifica el código de la API. |
| D3 | Estados | Se muestran todos excepto `draft`. Solo se puede reservar en `published` y `confirmed`. |
| D4 | Fechas pasadas | Se muestran como no reservables. |
| D5 | Datos de ejemplo | La semilla del fork (`db/seed/activities.json`) se sustituye por lanzamientos espaciales con fechas futuras que siguen la convención D1, y se vacían (`[]`) `db/activities.json`, `db/bookings.json` y `db/payments.json`, porque los datos guardados sustituyen a la semilla al arrancar. Los precios por plaza deben ser impares y no múltiplos de 5 (así ningún importe precio × plazas es múltiplo de 1000), salvo el lanzamiento de demostración del pago rechazado (ADD, V6). Es un cambio solo de datos. |
| D6 | Sesión | Se mantiene al recargar o reabrir la aplicación hasta que caduque el token (24 h). |
| D7 | Moneda | Euros (€). |
| D8 | Idioma de la interfaz | Español. |
| D9 | Límite por reserva | Sin límite propio; solo el de plazas disponibles que aplica la API. |

## 9. Opciones consideradas (histórico)

- PENDIENTE 1 — **Cohete.** El briefing pide mostrar el cohete, pero la API no tiene ese dato. Opciones:
  - (a) No mostrar cohete; el `name` hace de nombre de la misión.
  - (b) Usar una convención en el nombre (por ejemplo, "Falcon 9 · Misión Luna") y mostrar la parte del cohete por separado.
  - (c) Añadir un campo de cohete a la API en el fork (sale del alcance del cliente y exige cambiar el backend).
  - (d) Reinterpretar `location` como cohete o plataforma (no recomendado: cambia el significado del dato).
- PENDIENTE 2 — **Plazas disponibles.** La API no las devuelve (su requisito FR7 "Availability" está sin empezar) y el cliente no puede calcularlas porque no ve las reservas de otros. Opciones:
  - (a) Mostrar las plazas totales (`maxParticipants`) y comunicar las disponibles solo cuando la API rechaza una reserva (dato del mensaje "Available: X").
  - (b) Implementar en el fork un dato o endpoint de plazas disponibles (cambio en el backend).
  - (c) Mostrar como disponibles las plazas totales menos las reservadas por la propia persona (no recomendado: el dato sería incorrecto).
  - Riesgo: con la opción (a), F10 solo se cumple porque la API rechaza el exceso; el cliente no puede evitarlo antes de enviar la reserva.
- PENDIENTE 3 — **Estados visibles y reservables.** Opciones:
  - (a) Mostrar solo `published` y `confirmed`, y permitir reservar en ambos.
  - (b) Mostrar `published`, `confirmed`, `sold-out`, `done` y `cancelled` (nunca `draft`) y permitir reservar solo en `published` y `confirmed`.
  - (c) Mostrar y permitir reservar solo `published`.
- PENDIENTE 4 — **Lanzamientos con fecha pasada.** Opciones: (a) ocultarlos; (b) mostrarlos como no reservables.
- PENDIENTE 5 — **Datos de ejemplo.** La semilla de la API contiene actividades que no son viajes espaciales (yoga, rutas en bici, cocina, fotografía) y con fechas de 2026 ya pasadas. Opciones: (a) sustituir la semilla del fork por lanzamientos espaciales con fechas futuras; (b) usar la semilla tal cual.
- PENDIENTE 6 — **Duración de la sesión.** Opciones: (a) mantener la sesión al recargar o reabrir la aplicación hasta que caduque (24 h); (b) perderla al cerrar la pestaña.
- PENDIENTE 7 — **Moneda del precio.** La API no indica moneda. Opciones: (a) euros; (b) dólares; (c) "créditos" ficticios.
- PENDIENTE 8 — **Idioma de la interfaz.** Opciones: (a) español; (b) inglés; (c) ambos con selector.
- PENDIENTE 9 — **Límite de plazas por reserva.** Opciones: (a) sin límite propio (solo el de plazas disponibles); (b) un máximo por reserva (por ejemplo, 10).
