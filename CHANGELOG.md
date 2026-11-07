# Changelog

Todos los cambios relevantes de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added

- Detalle de lanzamiento en `/lanzamientos/<id>` con todos sus datos y enlace para volver; un id inexistente o un borrador se muestran como "no encontrado", y los errores de red o servidor ofrecen "Reintentar".
- Motivo por el que un lanzamiento no se puede reservar (cancelado, realizado, agotado o fecha pasada), en el detalle y en las tarjetas del listado.
- Búsqueda y ordenación del listado de lanzamientos: búsqueda por texto con espera de 300 ms, orden por fecha, precio o nombre en ambas direcciones, todo guardado en la URL (recarga y "Atrás"), y mensaje con "Borrar búsqueda" cuando no hay coincidencias.
- Sesión de usuario: inicio de sesión en `/acceso` con validación de campos y vuelta segura a la página de origen, sesión guardada hasta que caduca el token, nombre y "Cerrar sesión" en la cabecera, rutas protegidas que redirigen al acceso y aviso de sesión caducada.
- Registro de cuenta en `/registro`: nombre de usuario, email, contraseña de al menos 6 caracteres y aceptación de términos, con errores por campo (incluido el email ya registrado), sesión iniciada directamente tras registrarse, enlace "Crear cuenta" en la cabecera y enlaces cruzados con `/acceso` que conservan la página de origen.
- "Mis reservas" en `/reservas` (solo con sesión): reservas de la más reciente a la más antigua con lanzamiento, fecha, plazas, importe total y estado del pago, estado vacío con "Ver lanzamientos", errores con "Reintentar" y detalle en `/reservas/<id>` con los datos del lanzamiento y su estado actual; una reserva inexistente o ajena se muestra como "no encontrada".
- Reserva de plazas desde el detalle de un lanzamiento reservable: número de plazas con importe total en vivo, validación sin superar las plazas, un solo envío por reserva y "Reserva confirmada" en `/reservas/<id>`; avisos de plazas libres (con el máximo ajustado), pago rechazado, sesión caducada y errores de red o servidor. Sin sesión se ofrecen "Iniciar sesión" y "Crear cuenta" con vuelta al lanzamiento.

## [0.1.0] - 2026-11-06

### Added

- Estructura inicial del proyecto para Spec-Driven Development: `AGENTS.md`, agentes, instrucciones, prompts y skills en `.agents/`.
- Esqueleto de la aplicación con React, TypeScript (`strict`) y Vite: rutas base (`/` → `/lanzamientos`), página de "no encontrado" y configuración de la URL de la API con `VITE_API_URL`.
- Herramientas de calidad: ESLint, Vitest con Testing Library y Playwright (Chromium y Firefox), con los scripts `typecheck`, `lint`, `test`, `test:e2e` y `test:e2e:smoke`.
- Datos de prueba en el fork de la API (`activity-bookings-express`): 9 lanzamientos espaciales que cubren todos los estados, fechas pasadas, un nombre sin cohete y el caso de pago rechazado.
- Base de comunicación con la API: cliente `http()` único con validación de respuestas, errores clasificados y mensajes en español (con el original entre paréntesis), plazas libres a partir del error de capacidad y aviso de sesión rechazada.
- Componentes comunes de estado (carga, error con "Reintentar", vacío y campo de formulario accesible) y hook `useAsyncData` que descarta cargas antiguas.
- Listado de lanzamientos en `/lanzamientos`: misión, cohete, lugar, fecha y hora, duración, precio en euros, plazas totales y estado; oculta los borradores, con estados de carga, vacío y error con "Reintentar", y adaptado a móvil.

### Fixed

- API (fork `activity-bookings-express`): el login funciona con usuarios existentes y recién registrados, el registro ya no sobrescribe usuarios y, tras reiniciar, las reservas y los pagos nuevos no reutilizan ids.

[Unreleased]: https://github.com/PabloGozalboChorro/astrobookings-client/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/PabloGozalboChorro/astrobookings-client/releases/tag/v0.1.0
