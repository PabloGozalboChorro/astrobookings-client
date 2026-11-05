---
name: coding-react
description: Convenciones y plantillas para implementar funcionalidades en React + TypeScript + Vite - componentes, hooks, cliente de la API y gestión de errores. Úsala al escribir código en src/.
---

# Programar en React

## Estructura (salvo que el ADD diga otra cosa)
```text
src/
  api/          Cliente HTTP y funciones por recurso (launches.ts, bookings.ts)
  types/        Tipos del dominio
  features/     Una carpeta por funcionalidad: componentes + hooks
    launches/
    bookings/
  components/   Componentes de UI genéricos y reutilizables
  App.tsx
  main.tsx
```

## Reglas
1. Los componentes solo muestran datos y emiten eventos; la lógica va en hooks (`useLaunches`) o en funciones puras.
2. Los componentes nunca llaman a `fetch`: siempre pasan por `src/api/`.
3. Cada vista que carga datos maneja tres estados: **cargando**, **error** y **vacío/datos**.
4. Las validaciones de negocio (por ejemplo, plazas disponibles) son funciones puras con test unitario.
5. Accesibilidad: elementos semánticos, `label` en los formularios y roles que Playwright pueda localizar (`getByRole`).
6. La URL de la API se lee de `import.meta.env.VITE_API_URL`.

## Scripts de npm esperados
`dev`, `build`, `typecheck` (`tsc --noEmit`), `lint`, `test` (Vitest) y `test:e2e` (Playwright). Si no existen, créalos en la tarea de scaffolding.

Plantillas: [templates.md](templates.md).
