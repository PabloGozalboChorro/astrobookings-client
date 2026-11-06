# Changelog

Todos los cambios relevantes de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added

- Estructura inicial del proyecto para Spec-Driven Development: `AGENTS.md`, agentes, instrucciones, prompts y skills en `.agents/`.
- Esqueleto de la aplicación con React, TypeScript (`strict`) y Vite: rutas base (`/` → `/lanzamientos`), página de "no encontrado" y configuración de la URL de la API con `VITE_API_URL`.
- Herramientas de calidad: ESLint, Vitest con Testing Library y Playwright (Chromium y Firefox), con los scripts `typecheck`, `lint`, `test`, `test:e2e` y `test:e2e:smoke`.
- Datos de prueba en el fork de la API (`activity-bookings-express`): 9 lanzamientos espaciales que cubren todos los estados, fechas pasadas, un nombre sin cohete y el caso de pago rechazado.
- Base de comunicación con la API: cliente `http()` único con validación de respuestas, errores clasificados y mensajes en español (con el original entre paréntesis), plazas libres a partir del error de capacidad y aviso de sesión rechazada.
- Componentes comunes de estado (carga, error con "Reintentar", vacío y campo de formulario accesible) y hook `useAsyncData` que descarta cargas antiguas.

### Fixed

- API (fork `activity-bookings-express`): el login funciona con usuarios existentes y recién registrados, el registro ya no sobrescribe usuarios y, tras reiniciar, las reservas y los pagos nuevos no reutilizan ids.
