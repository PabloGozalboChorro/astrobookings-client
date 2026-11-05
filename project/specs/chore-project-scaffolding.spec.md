# chore: Estructura inicial del proyecto (scaffolding)

- **Estado:** Aprobada
- **PRD:** ninguno directo (base para F1–F19; PRD §6 "Configuración"; ADD §2, §3, §7, §9)
- **Rama:** `chore/project-scaffolding`
- **Depende de:** ninguna
- **Prioridad:** Must

## Contexto
El repositorio solo contiene documentación. Antes de implementar cualquier funcionalidad hace falta un proyecto React + TypeScript + Vite que compile, se pueda probar (unitario y e2e) y lea la dirección de la API de la configuración, con la estructura de carpetas y los scripts que fija el ADD. Esta spec deja ese esqueleto funcionando con una página mínima que demuestra que todas las piezas encajan.

## Alcance
- **Incluido:**
  - Proyecto Vite (plantilla `react-ts`) en la raíz del repositorio, con Node.js 24 LTS y npm; versiones estables vigentes fijadas en `package-lock.json` (ADD §2).
  - TypeScript con `strict` y `noUncheckedIndexedAccess`.
  - Dependencias de ejecución: `react`, `react-dom`, `react-router`, `zod`. De desarrollo: TypeScript, Vite y su plugin de React, ESLint + `typescript-eslint` (configuración de la plantilla), Vitest, jsdom, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`.
  - Scripts de npm del ADD §7: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:e2e`, `test:e2e:smoke`.
  - Ficheros de entorno `.env.example`, `.env.development` y `.env.e2e` (ADD §7).
  - `vite.config.ts` con el bloque `test` de Vitest (jsdom, `tests/setup.ts`) y `playwright.config.ts` con los proyectos `chromium`, `firefox` (mock) y `smoke`.
  - Carpetas del ADD §3 (`src/api`, `src/domain`, `src/hooks`, `src/components`, `src/features/session`, `src/features/launches`, `src/features/bookings`, `src/styles`, `tests/unit`, `tests/e2e/fixtures`, `tests/e2e/smoke`); las vacías se conservan con `.gitkeep`.
  - `src/config.ts`, `src/main.tsx`, `src/App.tsx`, `src/components/Layout.tsx`, `src/components/NotFoundPage.tsx`, `src/styles/global.css`.
  - Página mínima: cabecera con "AstroBookings" y enlace "Lanzamientos"; `/` redirige a `/lanzamientos`, que muestra provisionalmente el título "Lanzamientos"; cualquier otra ruta muestra la página de no encontrado.
  - Un test unitario y un test e2e de ejemplo que prueban la página mínima.
- **Excluido:**
  - Cliente de la API, dominio, sesión y cualquier pantalla funcional (specs posteriores).
  - Despliegue y CI.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Cuando se ejecute `npm run typecheck` sobre el proyecto recién instalado, el sistema deberá terminar con código 0 usando una configuración de TypeScript con `strict: true` y `noUncheckedIndexedAccess: true`. |
| R2 | Cuando se ejecute `npm run lint`, el sistema deberá terminar con código 0 sin errores ni avisos. |
| R3 | Cuando se ejecute `npm run build`, el sistema deberá ejecutar `tsc -b && vite build` y generar `dist/index.html` terminando con código 0. |
| R4 | Cuando se ejecute `npm test`, el sistema deberá ejecutar Vitest una sola vez (`vitest run`) en entorno jsdom, con `@testing-library/jest-dom` cargado y la zona horaria `UTC`, y terminar con todos los tests en verde. |
| R5 | Cuando se ejecute `npm run test:e2e`, el sistema deberá arrancar la app con `vite --mode e2e --port 5174 --strictPort` y ejecutar los tests de `tests/e2e/` (sin `tests/e2e/smoke/`) en Chromium y Firefox, terminando en verde. |
| R6 | El fichero `package.json` deberá declarar como dependencias de ejecución únicamente `react`, `react-dom`, `react-router` y `zod`. |
| R7 | El sistema deberá leer la URL de la API de `VITE_API_URL` en un único módulo de configuración (`src/config.ts`) y exponerla sin `/` final. |
| R8 | Si `VITE_API_URL` no está definida o está vacía, entonces el sistema deberá mostrar en lugar de la aplicación un mensaje con `role="alert"` y el texto "Error de configuración: falta la variable VITE_API_URL." |
| R9 | Cuando la persona abra la ruta `/`, el sistema deberá redirigirla a `/lanzamientos`, que muestra un encabezado de nivel 1 "Lanzamientos" dentro de un layout con cabecera ("AstroBookings" y enlace "Lanzamientos") y región `main`. |
| R10 | Cuando la persona abra una ruta que no existe, el sistema deberá mostrar el encabezado "Página no encontrada" y un enlace "Ir a los lanzamientos" que lleva a `/lanzamientos`. |
| R11 | El documento HTML de la app deberá declarar `lang="es"`, el título "AstroBookings" y la etiqueta `viewport` para móvil. |

## Criterios de aceptación
### R1
- **Dado** el repositorio tras `npm ci`
- **Cuando** se ejecuta `npm run typecheck`
- **Entonces** termina con código 0, y `tsconfig.app.json` (o el fichero equivalente de la plantilla) contiene `"strict": true` y `"noUncheckedIndexedAccess": true`

### R2
- **Dado** el repositorio tras `npm ci`
- **Cuando** se ejecuta `npm run lint`
- **Entonces** termina con código 0 y no informa de errores ni avisos

### R3
- **Dado** el repositorio tras `npm ci`
- **Cuando** se ejecuta `npm run build`
- **Entonces** termina con código 0 y existe `dist/index.html`

### R4
- **Dado** un test unitario de ejemplo en `tests/unit/` que renderiza la app en `/lanzamientos` con `MemoryRouter` y comprueba con `toBeInTheDocument()` el encabezado "Lanzamientos", y otro que comprueba que `new Date('2027-03-15T14:30:00.000Z').getHours()` es 14
- **Cuando** se ejecuta `npm test`
- **Entonces** ambos pasan y el proceso termina sin quedarse en modo *watch*

### R5
- **Dado** un test e2e de ejemplo en `tests/e2e/` que navega a `/` y comprueba la URL `/lanzamientos` y el encabezado "Lanzamientos"
- **Cuando** se ejecuta `npm run test:e2e`
- **Entonces** el test pasa en los proyectos `chromium` y `firefox`, y el proyecto `smoke` no se ejecuta
- **Y** `npm run test:e2e:smoke` ejecuta solo `tests/e2e/smoke/` (sin tests todavía: termina sin fallos o indicando que no hay tests)

### R6
- **Dado** el `package.json` del proyecto
- **Cuando** se leen sus `dependencies`
- **Entonces** contiene exactamente `react`, `react-dom`, `react-router` y `zod`; el resto de paquetes está en `devDependencies`

### R7
- **Dado** `VITE_API_URL=http://localhost:3000/`
- **Cuando** un test unitario lee la URL de la API desde `src/config.ts`
- **Entonces** obtiene `http://localhost:3000`
- **Y** `.env.development` contiene `VITE_API_URL=http://localhost:3000`, `.env.e2e` contiene `VITE_API_URL=http://localhost:3999` y `.env.example` documenta la variable

### R8
- **Dado** que `VITE_API_URL` está vacía en el entorno de un test unitario
- **Cuando** se renderiza el punto de entrada de la aplicación
- **Entonces** se muestra un elemento `role="alert"` con "Error de configuración: falta la variable VITE_API_URL." y no se renderiza la cabecera

### R9
- **Dado** la app arrancada con `npm run dev`
- **Cuando** la persona abre `http://localhost:5173/`
- **Entonces** la URL pasa a `/lanzamientos`, se ve el encabezado de nivel 1 "Lanzamientos", la cabecera muestra "AstroBookings" y el enlace "Lanzamientos", y el contenido está dentro de `main`

### R10
- **Dado** la app arrancada
- **Cuando** la persona abre `/no-existe`
- **Entonces** ve el encabezado "Página no encontrada" y, al pulsar "Ir a los lanzamientos", llega a `/lanzamientos`

### R11
- **Dado** la app construida
- **Cuando** se inspecciona `index.html`
- **Entonces** `<html lang="es">`, `<title>AstroBookings</title>` y `<meta name="viewport" content="width=device-width, initial-scale=1.0">` están presentes

## Casos límite
- `VITE_API_URL` con barra final (`http://localhost:3000/`): se normaliza (R7).
- `VITE_API_URL` ausente o vacía: error de configuración visible, nunca peticiones a `undefined/...` (R8).
- `npm run dev` abierto en 5173 mientras se ejecuta `test:e2e`: no hay conflicto porque e2e usa 5174 con `--strictPort` (R5).
- Una versión mayor nueva de un paquete que rompa las plantillas de las skills: se queda en la mayor objetivo del ADD §2 y se anota en la PR.

## Fuera de la spec / notas
- El título provisional "Lanzamientos" lo sustituye la spec `feat-launch-list`.
- La cabecera solo tiene el enlace "Lanzamientos"; los enlaces de sesión los añaden `feat-user-session`, `feat-user-registration` y `feat-my-bookings`.
- `.env.development` y `.env.e2e` se versionan (no son secretos); `.env` y `.env.local` ya están en `.gitignore`.
- Se elimina `src/.gitkeep` y `tests/.gitkeep` cuando haya ficheros reales en esas carpetas.
