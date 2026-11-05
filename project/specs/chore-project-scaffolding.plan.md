# Plan: chore-project-scaffolding

- **Spec:** [chore-project-scaffolding.spec.md](chore-project-scaffolding.spec.md)
- **Rama:** `chore/project-scaffolding`

## Decisiones de implementación

Decisiones del Engineer que concretan la spec y el ADD sin cambiar su alcance. Las marcadas con (desviación) cambian un detalle literal del ADD §7 y se anotan en la PR.

| # | Decisión | Motivo |
|---|---|---|
| E1 | Se requiere **Node.js 24 LTS ≥ 24.15.0** antes de instalar (T0). Con el Node 22.12.0 actual no se pueden instalar las versiones vigentes. | `jsdom@31` exige `^22.22.2 \|\| ^24.15.0`, `react-router@8` exige `>=22.22`, `eslint@10` y `@eslint/js@10` exigen `^22.13 \|\| >=24`. Además la spec fija Node 24 LTS. |
| E2 | La plantilla se genera **fuera del repositorio** (carpeta temporal del sistema) con `create-vite` de forma no interactiva y se copian solo los ficheros necesarios (T1). | `create-vite` sobre un directorio no vacío pregunta si sobrescribe/vacía; el repo ya tiene `AGENTS.md`, `README.md`, `.agents/`… que no se deben tocar. |
| E3 | (desviación) `typecheck` = `tsc -b` en lugar de `tsc --noEmit`. | La plantilla usa un `tsconfig.json` raíz de "solución" (`files: []` + `references`): `tsc --noEmit` sobre él no comprueba ningún fichero y siempre devolvería 0 (falso positivo de R1). `tsc -b` comprueba `tsconfig.app.json` y `tsconfig.node.json`, que ya llevan `noEmit: true`. Se demuestra con la comprobación negativa de R1. |
| E4 | (desviación) `lint` = `eslint . --max-warnings 0`. | R2 exige "sin errores ni avisos"; sin la opción, ESLint devuelve 0 con avisos (p. ej. `react-refresh/only-export-components`). |
| E5 | (desviación) `test:e2e:smoke` = `playwright test --project=smoke --pass-with-no-tests`. | Sin la opción, Playwright termina con código 1 ("No tests found") mientras `tests/e2e/smoke/` esté vacía; la opción no afecta cuando haya tests. |
| E6 | `vite.config.ts` usa `defineConfig` de `vitest/config`, `include: ['tests/unit/**/*.test.{ts,tsx}']`, `env: { VITE_API_URL: 'http://localhost:3999' }` y `unstubEnvs: true`. | Sin `include`, Vitest recogería también `tests/e2e/*.spec.ts`. Vitest corre en modo `test` y no carga `.env.development`, así que sin `env` todos los tests de componentes verían el error de configuración (R8); cada test que necesite otro valor usa `vi.stubEnv` y se restaura solo. |
| E7 | La zona horaria se fija en `tests/setup.ts` con `process.env.TZ = 'UTC'` (ADD §3). Si en Windows no surte efecto (lo detecta el test de R4), se pasa a un `globalSetup` (`tests/global-setup.ts`) que la fija antes de crear los *workers*. | Node aplica los cambios de `TZ` en caliente, pero conviene tener la alternativa prevista. |
| E8 | `App.tsx` **no** incluye el router (lo pone `main.tsx` con `BrowserRouter`) y contiene la comprobación de configuración: si `loadConfig()` falla, devuelve solo `<p role="alert">Error de configuración: falta la variable VITE_API_URL.</p>` sin `Layout`. | R4 renderiza la app con `MemoryRouter`; R8 se prueba renderizando `App` con `VITE_API_URL` vacía. |
| E9 | `src/config.ts` expone una función pura `parseApiUrl(value: string \| undefined): string` (lanza `ConfigError` si falta o está vacía tras `trim`; quita todas las `/` finales) y `loadConfig()` que lee `import.meta.env.VITE_API_URL` y devuelve `{ ok: true, apiUrl } \| { ok: false, message }`. | Permite probar R7/R8 sin recargar módulos y deja el punto único de lectura que usará `api/http.ts`. |
| E10 | La página provisional de `/lanzamientos` es un elemento `<h1>Lanzamientos</h1>` en `App.tsx`; `NotFoundPage` va también dentro de `Layout` (ruta `*` hija). | La spec deja `src/features/launches/` vacía (`.gitkeep`) y no lista un componente para la página provisional. |
| E11 | Se añade `src/vite-env.d.ts` (o el equivalente de la plantilla) con `interface ImportMetaEnv { readonly VITE_API_URL?: string }`. | Tipado estricto de `import.meta.env` sin `any`. |
| E12 | `tsconfig.app.json` incluye `src`, `tests/setup.ts` y `tests/unit`; `tsconfig.node.json` incluye `vite.config.ts`, `playwright.config.ts` y `tests/e2e`. | Que `typecheck` y `lint` cubran también los tests. |
| E13 | Playwright: `testDir: './tests/e2e'`; proyectos `chromium` y `firefox` con `testIgnore: '**/smoke/**'`; proyecto `smoke` con `testDir: './tests/e2e/smoke'` y `baseURL: 'http://localhost:5173'` (requiere la API y `npm run dev` arrancados a mano, como dice el ADD §9). Un único `webServer`: `npx vite --mode e2e --port 5174 --strictPort`, `url: 'http://localhost:5174'`, `reuseExistingServer: !process.env.CI`. Reporter `list` + `html` con `open: 'never'`. | `webServer` es global en Playwright; el servidor del smoke se concretará en la spec que añada el primer test smoke. |
| E14 | Se declara `@testing-library/dom` en `devDependencies` aunque no esté en la lista de la spec. | Es *peer dependency* obligatoria de `@testing-library/react@16`; declararla evita depender de la instalación automática de *peers*. Lo mismo para los paquetes que trae la plantilla (`@types/react`, `@types/react-dom`, `@types/node`, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`). |
| E15 | Se elimina de la plantilla lo que la spec no pide: `README.md`, `public/vite.svg` (y el `<link rel="icon">`), `src/assets/`, `src/App.css`, `src/index.css`. El `.gitignore` de la plantilla no se copia: el del repo ya cubre lo necesario. | Cambios mínimos. |

### Versiones a fijar

Consultadas con `npm view <paquete> version` el 2026-11-05. En T1/T2 se vuelven a consultar y se usa la vigente si respeta la columna "Restricción". Las versiones exactas quedan en `package-lock.json`.

| Paquete | Vigente | Se usa | Restricción / alternativa si rompe |
|---|---|---|---|
| `create-vite` | 9.3.4 | 9.3.4 | — |
| `vite` | 8.3.6 | 8.x | Node `^20.19 \|\| >=22.12` |
| `@vitejs/plugin-react` | 6.2.1 | 6.x | Requiere `vite@^8` |
| `typescript` | 7.0.2 | **6.0.x** (6.0.3) | `typescript-eslint@8.72.1` admite `typescript >=4.8.4 <6.1.0`: TS 7 no es compatible. Si la plantilla fija otra, se respeta mientras sea `<6.1`. |
| `react`, `react-dom` | 19.3.1 | 19.x | — |
| `@types/react`, `@types/react-dom` | 19.3.0 | 19.x | — |
| `react-router` | 8.5.1 | **8.x** | Mayor nueva respecto al ADR-004 (7). Se usa por la regla del ADD §2; si el modo declarativo (`BrowserRouter`, `MemoryRouter`, `Routes`, `Route`, `Navigate`, `Link`, `Outlet`) no compila o cambia, se vuelve a **7.18.5** y se anota en la PR. Requiere Node `>=22.22`. |
| `zod` | 4.6.7 | 4.x | — |
| `vitest` | 5.1.0 | **5.x** | Mayor nueva respecto al ADD (4). Alternativa: **4.1.12**. Node `^22.12 \|\| ^24`. |
| `jsdom` | 31.0.0 | 31.x | Node `^22.22.2 \|\| ^24.15.0`. Alternativa sin Node 24: 28.x. |
| `@testing-library/react` | 16.3.3 | 16.x | Peer `@testing-library/dom@^10` |
| `@testing-library/dom` | 10.4.2 | 10.x | — |
| `@testing-library/user-event` | 14.6.8 | 14.x | — |
| `@testing-library/jest-dom` | 7.0.1 | 7.x | Node `>=22`; import `@testing-library/jest-dom/vitest` |
| `@playwright/test` | 1.64.1 | 1.x | — |
| `eslint` / `@eslint/js` | 10.14.0 / 10.0.1 | 10.x | Node `^22.13 \|\| >=24`. Si la plantilla fija la 9, se respeta. |
| `typescript-eslint` | 8.72.1 | 8.x | Ver `typescript` |
| `eslint-plugin-react-hooks` | 7.1.1 | 7.x | Peer `eslint ^9 \|\| ^10` (según plantilla) |
| `eslint-plugin-react-refresh` | 0.5.7 | 0.5.x | Según plantilla |
| `globals` | 17.14.0 | según plantilla | — |
| `@types/node` | 26.6.6 | **24.x** | Debe coincidir con la mayor de Node en uso (24). |

## Plan de pruebas

Se escribe antes del código: en cada tarea, primero el test (en rojo) y luego la implementación.

| Requisito | Test / comprobación | Nivel | Fichero / comando |
|---|---|---|---|
| R1 | `npm run typecheck` termina con 0; `tsconfig.app.json` contiene `"strict": true` y `"noUncheckedIndexedAccess": true`. **Comprobación negativa:** añadir temporalmente a `src/config.ts` `const sample: number[] = []; const first: number = sample[0];` → `npm run typecheck` debe **fallar** (TS2322); se revierte. | comando | `npm run typecheck`; `Select-String -Path tsconfig.app.json -Pattern '"strict": true','"noUncheckedIndexedAccess": true'` |
| R2 | `npm run lint` termina con 0 y sin salida de avisos. | comando | `npm run lint` |
| R3 | `npm run build` ejecuta `tsc -b && vite build`, termina con 0 y existe `dist/index.html`. | comando | `npm run build; Test-Path dist/index.html` |
| R4 | `it('R4: renders the launches heading at /lanzamientos', …)` con `MemoryRouter initialEntries={['/lanzamientos']}` y `toBeInTheDocument()` | unit | `tests/unit/App.test.tsx` |
| R4 | `it('R4: runs tests in the UTC time zone', …)`: `new Date('2027-03-15T14:30:00.000Z').getHours()` es `14` | unit | `tests/unit/test-environment.test.ts` |
| R4 | `npm test` termina sin quedarse en *watch* y con todos en verde (comprobar el recuento real) | comando | `npm test` |
| R5 | `test('R5: R9: redirects / to /lanzamientos and shows the layout', …)` pasa en `chromium` y `firefox`; la salida de `npm run test:e2e` lista solo esos dos proyectos | e2e | `tests/e2e/app-shell.spec.ts`; `npm run test:e2e` |
| R5 | `npm run test:e2e:smoke` ejecuta solo `tests/e2e/smoke/` y termina con 0 ("No tests found" aceptado) | comando | `npm run test:e2e:smoke` |
| R5 | El dev server en 5173 no interfiere: con `npm run dev` abierto en otra terminal, `npm run test:e2e` sigue en verde | comando (manual) | `npm run dev` + `npm run test:e2e` |
| R6 | `dependencies` contiene exactamente `react`, `react-dom`, `react-router`, `zod` | comando | `node -e "const d=Object.keys(require('./package.json').dependencies).sort().join(',');if(d!=='react,react-dom,react-router,zod'){console.error(d);process.exit(1)}"` |
| R7 | `it('R7: removes the trailing slash from the API URL', …)`: `parseApiUrl('http://localhost:3000/')` → `'http://localhost:3000'` | unit | `tests/unit/config.test.ts` |
| R7 | `it('R7: keeps an API URL without trailing slash unchanged', …)` | unit | `tests/unit/config.test.ts` |
| R7 | `it('R7: reads VITE_API_URL from the environment', …)`: `vi.stubEnv('VITE_API_URL', 'http://localhost:3000/')` → `loadConfig()` devuelve `{ ok: true, apiUrl: 'http://localhost:3000' }` | unit | `tests/unit/config.test.ts` |
| R7 | `.env.development` = `VITE_API_URL=http://localhost:3000`, `.env.e2e` = `VITE_API_URL=http://localhost:3999`, `.env.example` documenta la variable | comando | `Get-Content .env.development, .env.e2e, .env.example` |
| R8 | `it('R8: fails when VITE_API_URL is missing or empty', …)`: `parseApiUrl(undefined)`, `parseApiUrl('')` y `parseApiUrl('   ')` lanzan `ConfigError`; `loadConfig()` con `vi.stubEnv('VITE_API_URL', '')` devuelve `ok: false` | unit | `tests/unit/config.test.ts` |
| R8 | `it('R8: shows a configuration error instead of the app', …)`: `vi.stubEnv('VITE_API_URL', '')`, render de `App` en `MemoryRouter` → `getByRole('alert')` con el texto exacto y `queryByRole('banner')` es `null` | unit | `tests/unit/App.test.tsx` |
| R9 | `it('R9: redirects / to /lanzamientos', …)` (MemoryRouter en `/` → encabezado `level: 1` "Lanzamientos") | unit | `tests/unit/App.test.tsx` |
| R9 | `it('R9: shows the header with the brand and the launches link', …)`: `getByRole('banner')` contiene "AstroBookings" y `getByRole('link', { name: 'Lanzamientos' })` con `href="/lanzamientos"`; el `h1` está dentro de `getByRole('main')` | unit | `tests/unit/App.test.tsx` |
| R9 | e2e: `page.goto('/')` → `toHaveURL(/\/lanzamientos$/)`, `getByRole('heading', { level: 1, name: 'Lanzamientos' })` visible dentro de `getByRole('main')`, banner con "AstroBookings" y enlace "Lanzamientos" | e2e | `tests/e2e/app-shell.spec.ts` |
| R10 | `it('R10: shows the not found page and links back to the launches', …)`: MemoryRouter en `/no-existe` → encabezado "Página no encontrada"; `userEvent.click` en "Ir a los lanzamientos" → encabezado "Lanzamientos" | unit | `tests/unit/App.test.tsx` |
| R10 | `test('R10: shows the not found page for an unknown route', …)`: `/no-existe` → encabezado; clic en el enlace → `toHaveURL(/\/lanzamientos$/)` | e2e | `tests/e2e/app-shell.spec.ts` |
| R11 | `test('R11: declares language, title and mobile viewport', …)`: `locator('html')` `toHaveAttribute('lang', 'es')`, `toHaveTitle('AstroBookings')`, `locator('meta[name="viewport"]')` `toHaveAttribute('content', 'width=device-width, initial-scale=1.0')` | e2e | `tests/e2e/app-shell.spec.ts` |
| R11 | Tras el build: `dist/index.html` contiene `<html lang="es">`, `<title>AstroBookings</title>` y la meta `viewport` | comando | `Select-String -Path dist/index.html -Pattern '<html lang="es">','<title>AstroBookings</title>','name="viewport"'` |

## Tareas

- [x] **T0** — **(Requiere a la persona)** Instalar Node.js 24 LTS ≥ 24.15.0 (E1) y comprobarlo. · Requisitos: base de todos · Ficheros: — · Verificación: `node -v` (≥ v24.15.0), `npm -v`.

- [x] **T1** — Generar la plantilla `react-ts` fuera del repo y copiar los ficheros base (E2, E15). · Requisitos: R1, R2, R3, R11 (base) · Ficheros: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/vite-env.d.ts` (si la plantilla lo trae).
  - Enfoque (PowerShell):
    1. `npx create-vite@9.3.4 --help` para confirmar las opciones no interactivas de la versión (p. ej. `--no-interactive`, `--no-rolldown`, `--no-immediate`, si existen).
    2. `$tmp = Join-Path $env:TEMP "astrobookings-scaffold"; npm create vite@9.3.4 $tmp -- --template react-ts <opciones no interactivas>` (sin instalar dependencias ni arrancar el servidor). Si aun así pregunta, se abandona el generador y se escriben los ficheros a mano con el contenido de la plantilla del paquete (`npm pack create-vite@9.3.4` y copiar de `template-react-ts/`).
    3. Copiar al repo solo los ficheros listados; descartar `README.md`, `.gitignore`, `public/`, `src/assets/`, `src/App.css`, `src/index.css`, `src/App.tsx` (se reescribe en T7).
    4. `index.html`: `lang="es"`, `<title>AstroBookings</title>`, conservar la meta `viewport` exacta, quitar el `<link rel="icon">` (R11).
    5. Borrar `$tmp`.
  - Verificación: `git status` muestra solo los ficheros previstos; `Select-String index.html -Pattern 'lang="es"','<title>AstroBookings</title>'`.

- [x] **T2** — Dependencias y scripts de npm (E3–E5, E14, tabla de versiones). · Requisitos: R6, R1–R5 (scripts) · Ficheros: `package.json`, `package-lock.json`.
  - `name: "astrobookings-client"`, `private: true`, `type: "module"`, versión según CHANGELOG.
  - Revisar con `npm view` las versiones de la tabla; ajustar `typescript` a `~6.0.x` si la plantilla trae una incompatible con `typescript-eslint`.
  - `npm install react-router zod` y `npm install -D vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom @playwright/test @types/node@24`.
  - Scripts: `dev: vite`, `build: tsc -b && vite build`, `preview: vite preview`, `typecheck: tsc -b`, `lint: eslint . --max-warnings 0`, `test: vitest run`, `test:e2e: playwright test --project=chromium --project=firefox`, `test:e2e:smoke: playwright test --project=smoke --pass-with-no-tests`.
  - Verificación: comando de R6; `npm ls --depth=0` sin `UNMET PEER DEPENDENCY` ni `invalid`; `npm ci` desde cero termina sin errores.

- [x] **T3** — Estructura de carpetas del ADD §3 con `.gitkeep`. · Requisitos: — (alcance de la spec) · Ficheros: `src/api/.gitkeep`, `src/domain/.gitkeep`, `src/hooks/.gitkeep`, `src/features/session/.gitkeep`, `src/features/launches/.gitkeep`, `src/features/bookings/.gitkeep`, `tests/e2e/fixtures/.gitkeep`, `tests/e2e/smoke/.gitkeep`; borrar `src/.gitkeep` y `tests/.gitkeep` cuando haya ficheros reales (al final de T5/T7). `src/components/`, `src/styles/` y `tests/unit/` no llevan `.gitkeep` porque tendrán ficheros.
  - Verificación: `git status --short` lista las carpetas; `Get-ChildItem -Recurse -Filter .gitkeep src, tests`.

- [x] **T4** — TypeScript estricto que cubra también los tests (E11, E12). · Requisitos: R1 · Ficheros: `tsconfig.app.json`, `tsconfig.node.json`, `src/vite-env.d.ts`.
  - `strict: true` y `noUncheckedIndexedAccess: true` en ambos `tsconfig.*.json`; `include` según E12; `types` según la plantilla más `vitest`/`node` donde haga falta.
  - Verificación: `npm run typecheck` (0) y la comprobación negativa de R1 (debe fallar y se revierte).

- [x] **T5** — Vitest con jsdom, jest-dom, limpieza y `TZ=UTC` (E6, E7). · Requisitos: R4 · Ficheros: `vite.config.ts`, `tests/setup.ts`, `tests/unit/test-environment.test.ts`.
  - Primero el test de zona horaria (R4); luego el bloque `test` y `tests/setup.ts` (`import '@testing-library/jest-dom/vitest'`, `afterEach(cleanup)`, `process.env.TZ = 'UTC'`).
  - Verificación: `npm test` → 1 test en verde y el proceso termina. El test es significativo porque la máquina no está en UTC (en Madrid daría 15): si falla, se aplica la alternativa de E7.

- [x] **T6** — Ficheros de entorno y módulo de configuración (E9). · Requisitos: R7, R8 · Ficheros: `.env.example`, `.env.development`, `.env.e2e`, `src/config.ts`, `tests/unit/config.test.ts`.
  - Primero `tests/unit/config.test.ts` (R7, R8) en rojo; después `src/config.ts`.
  - `.env.example` con comentario en español explicando la variable y su valor por defecto.
  - Verificación: `npm test -- tests/unit/config.test.ts` en verde; comprobación de contenido de los `.env` (tabla de pruebas).

- [x] **T7** — Página mínima: `Layout`, `NotFoundPage`, `App`, `main` y estilos (E8, E10). · Requisitos: R4, R8, R9, R10 · Ficheros: `tests/unit/App.test.tsx`, `src/App.tsx`, `src/main.tsx`, `src/components/Layout.tsx`, `src/components/NotFoundPage.tsx`, `src/styles/global.css`.
  - Primero `tests/unit/App.test.tsx` (R4, R8, R9, R10) en rojo.
  - `Layout`: `<header>` con "AstroBookings" y `<nav>` con `Link` "Lanzamientos" a `/lanzamientos`; `<main><Outlet /></main>`.
  - `App`: comprobación de configuración (E8) y `Routes`: `/` → `<Navigate to="/lanzamientos" replace />`, `lanzamientos` → `<h1>Lanzamientos</h1>`, `*` → `NotFoundPage`.
  - `NotFoundPage`: `<h1>Página no encontrada</h1>` y `Link` "Ir a los lanzamientos" a `/lanzamientos`.
  - `main.tsx`: `StrictMode` + `BrowserRouter` + `App`; importa `./styles/global.css`.
  - `global.css`: estilos base mínimos y adaptables (sin librerías).
  - Verificación: `npm test` en verde (recuento esperado: 1 + 4 de config + 5 de App, según se escriban); `npm run typecheck`; `npm run lint`.

- [x] **T8** — Build de producción. · Requisitos: R3, R11 · Ficheros: — (solo verificación; `dist/` está en `.gitignore`).
  - Verificación: `npm run build; Test-Path dist/index.html` y `Select-String` de R11 sobre `dist/index.html`. `npm run preview` y abrir `/no-existe` para comprobar el *fallback* (opcional).

- [x] **T9** — Playwright: configuración, navegadores y test e2e (E13). · Requisitos: R5, R9, R10, R11 · Ficheros: `playwright.config.ts`, `tests/e2e/app-shell.spec.ts`, `eslint.config.js` (ignorar `playwright-report`, `test-results`, `coverage`).
  - **Paso que requiere confirmación de la persona:** `npx playwright install chromium firefox` (descarga aproximada de 150 MB para Chromium más unos 100 MB para Firefox, en `%LOCALAPPDATA%\ms-playwright`; hoy no hay ninguno instalado). Los dos navegadores son necesarios para R5.
  - Primero el test e2e (R5/R9, R10, R11); después `playwright.config.ts`.
  - Verificación: `npm run test:e2e` → 3 tests × 2 proyectos = 6 en verde y ningún test del proyecto `smoke`; `npm run test:e2e:smoke` → código 0; repetir `npm run test:e2e` con `npm run dev` abierto en otra terminal (R5, caso límite).

- [x] **T10** — Verificación final y limpieza. · Requisitos: R1–R11 · Ficheros: borrar `src/.gitkeep` y `tests/.gitkeep` si siguen.
  - Desde limpio: borrar `node_modules` y `dist`, `npm ci`, y ejecutar en orden `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run test:e2e:smoke`, y el comando de R6.
  - Comprobar que no quedan `console.log`, código comentado ni `any`; `git status` sin ficheros no previstos (nada de `dist/`, `playwright-report/`, `test-results/`).
  - Anotar en la descripción de la PR las desviaciones E3–E5 y las versiones mayores distintas del ADD (TypeScript 6, React Router 8, Vitest 5) o el *fallback* aplicado.

## Definición de terminado
- [x] Todas las tareas marcadas
- [x] `npm run typecheck`, `npm run lint` y `npm test` en verde
- [x] Tests e2e de la spec en verde (`npm run test:e2e` en Chromium y Firefox; `npm run test:e2e:smoke` sin fallos)
- [x] `npm run build` genera `dist/index.html`
- [x] CHANGELOG actualizado

## Desviaciones para la PR

Anotadas por el Coder durante T1–T8 (y la parte de ficheros de T9). Se suman a E3–E5.

| # | Desviación | Motivo |
|---|---|---|
| D1 | **Node.js 26.13.0** (npm 11.4.2) en lugar de Node 24 LTS (E1, T0, spec "Alcance"). `@types/node` en **26.x** (26.6.6) en lugar de 24.x. | Validado por la persona: es la LTS actual y cumple los `engines` de todas las dependencias. `@types/node` sigue la mayor de Node en uso. La spec no se edita. |
| D2 | `create-vite@9.3.4` se ejecuta con `--eslint --no-immediate --no-interactive`. | En la 9.x la plantilla `react-ts` usa Oxlint por defecto; `--eslint` mantiene ESLint + `typescript-eslint` que exige la spec. La plantilla ya no trae `public/vite.svg` sino `public/favicon.svg` e `icons.svg` (descartados igualmente, E15). |
| D3 | La plantilla no trae `src/vite-env.d.ts` (usa `"types": ["vite/client"]`); se crea con solo la ampliación `interface ImportMetaEnv { readonly VITE_API_URL?: string }` (E11). | Tipado estricto de `import.meta.env`. |
| D4 | `tsconfig.app.json` añade `"node"` a `types` (además de `vite/client`). | `tests/setup.ts`, incluido en ese proyecto (E12), usa `process.env.TZ`. |
| D5 | Versiones mayores distintas del ADD §2: TypeScript **6.0.3** (la de la plantilla; TS 7 no es compatible con `typescript-eslint@8.72.1`), Vite **8**, React Router **8.5.1** y Vitest **5.1.0**. No hizo falta ningún *fallback*: el modo declarativo de React Router 8 y Vitest 5 funcionan con las plantillas. | Regla del ADD §2 (última estable si no rompe las plantillas). |
| D6 | `npm audit` informa de 10 vulnerabilidades moderadas, todas en dependencias de desarrollo (cadena de `eslint@10` / `typescript-eslint` vía `minimatch` y `@eslint/config-array`). No se aplica `npm audit fix --force`. | Solo afectan a herramientas locales de lint; corregirlas exigiría cambiar mayores fuera del alcance. |
| D7 | `playwright.config.ts` según E13. Evidencia de T9: Chromium 3/3 en verde (con y sin `npm run dev` abierto); `test:e2e:smoke` con código 0; Firefox 3/3 en verde **ejecutado por la persona en su terminal** (`npx.cmd playwright test --project=firefox`). | En el entorno aislado del agente, Firefox no arranca (error de Windows *side-by-side*: no encuentra el ensamblado `mozglue`). Es una limitación de ese entorno, no del proyecto. |
| D8 | En PowerShell con la política de ejecución restringida, `npx` falla (`npx.ps1` bloqueado); se usa `npx.cmd` o `npm run …`. | Configuración del equipo; no afecta al proyecto. |
