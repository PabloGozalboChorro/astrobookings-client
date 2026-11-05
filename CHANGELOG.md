# Changelog

Todos los cambios relevantes de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added

- Estructura inicial del proyecto para Spec-Driven Development: `AGENTS.md`, agentes, instrucciones, prompts y skills en `.agents/`.
- Esqueleto de la aplicación con React, TypeScript (`strict`) y Vite: rutas base (`/` → `/lanzamientos`), página de "no encontrado" y configuración de la URL de la API con `VITE_API_URL`.
- Herramientas de calidad: ESLint, Vitest con Testing Library y Playwright (Chromium y Firefox), con los scripts `typecheck`, `lint`, `test`, `test:e2e` y `test:e2e:smoke`.
