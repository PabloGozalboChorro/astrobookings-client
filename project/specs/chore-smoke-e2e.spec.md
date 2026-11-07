# chore: Smoke e2e contra la API real

- **Estado:** Aprobada
- **PRD:** F1, F2, F3, F9, F11, F13, F14 (recorrido feliz y rechazo de la API; ADD §9 fila "Smoke e2e", ADR-007, ADR-013, riesgo R8)
- **Rama:** `chore/smoke-e2e`
- **Depende de:** `fix-api-bookable-launch` (rama del fork `fix/bookable-launch` integrada en `master`, necesaria para R7), `fix-api-user-session` (login tras registro e ids tras reiniciar, ya en el fork), `feat-user-registration`, `feat-user-session`, `feat-booking-creation`, `feat-my-bookings` (todas integradas).
- **Vigencia:** el recorrido reserva en `activity-2` (fecha 2027-06-01); **a partir del 2027-06-01 el smoke deja de funcionar** hasta que se actualice la semilla o el lanzamiento elegido.
- **Prioridad:** Could

## Contexto
Los e2e del cliente interceptan la API con `page.route` (ADR-007) y comparan con fixtures copiados de respuestas reales. El riesgo R8 del ADD (fixtures desalineados con la API) se cubre con un smoke opcional contra el fork, previsto en ADD §9 y aplazado en el plan de `feat-booking-creation` (P13) por no estar en ninguna spec. Esta spec lo pide.

La infraestructura ya existe en `playwright.config.ts`:

- Proyecto `smoke`: `testDir: './tests/e2e/smoke'`, Desktop Chrome, `baseURL` `http://localhost:5173` (el `npm run dev` de la persona, que usa `.env.development` → `VITE_API_URL=http://localhost:3000`).
- Proyectos `chromium` y `firefox`: `testIgnore: '**/smoke/**'`, `baseURL` `http://localhost:5174` (Vite en modo `e2e`, API en un puerto sin servidor).
- Scripts: `test:e2e` = `playwright test --project=chromium --project=firefox`; `test:e2e:smoke` = `playwright test --project=smoke --pass-with-no-tests`.
- `tests/e2e/smoke/` solo contiene `.gitkeep`. Vitest solo incluye `tests/unit/**`.

## Alcance
- **Incluido:**
  - Un fichero `tests/e2e/smoke/real-api.smoke.spec.ts` (nombre del ADD §3) con el recorrido: registro con email único → cerrar sesión → iniciar sesión → reservar 1 plaza en un lanzamiento reservable → confirmación → "Mis reservas".
  - Comprobación previa de que la API y la app están en marcha, con un error claro si no.
  - Comprobar que la API rechaza una reserva en un lanzamiento no reservable (R7, requiere `fix-api-bookable-launch`).
  - Documentación de requisitos previos, ejecución y limpieza de `db/` en `README.md`.
- **Excluido:**
  - Arrancar o parar el fork o el `npm run dev` desde Playwright, y restaurar `db/` automáticamente.
  - Ejecutar el smoke en Firefox, en CI o dentro de `npm run test:e2e`.
  - Probar casos de error (402, capacidad, sesión caducada) contra la API real: los cubren los e2e deterministas.
  - Cambiar código de `src/` o del fork.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | Cuando se ejecute `npm run test:e2e:smoke` con el fork en `http://localhost:3000` y la app en `http://localhost:5173`, el test deberá registrar desde `/registro` una persona con un email único por ejecución (por ejemplo, `smoke-<marca de tiempo>@example.com`), un nombre de usuario, una contraseña de al menos 6 caracteres y los términos aceptados, y comprobar que queda con sesión iniciada (su nombre y "Cerrar sesión" en la cabecera). |
| R2 | Cuando la persona registrada pulse "Cerrar sesión" e inicie sesión de nuevo desde `/acceso` con el mismo email y contraseña, el test deberá comprobar que vuelve a tener sesión iniciada. |
| R3 | Cuando la persona abra el detalle de `activity-2` ("Starship · Órbita Marciana", `confirmed`, 1 249 999 € por plaza) y reserve 1 plaza, el test deberá comprobar que llega a `/reservas/booking-<n>` con el bloque "Reserva confirmada", "Órbita Marciana", "1 plaza", "Importe total: 1.249.999,00 €" y "Pagada". |
| R4 | Cuando la persona pulse "Ver mis reservas" en la confirmación, el test deberá comprobar que "Mis reservas" muestra exactamente una reserva, la del lanzamiento "Órbita Marciana". |
| R5 | Si antes del recorrido la API (`GET http://localhost:3000/health`) o la app (`http://localhost:5173`) no responden, entonces el test deberá fallar enseguida con un mensaje que diga qué falta y cómo arrancarlo, sin intentar el recorrido. |
| R6 | Los proyectos `chromium` y `firefox` (`npm run test:e2e`) no deberán ejecutar ni listar ningún test de `tests/e2e/smoke/`, y `npm run test` (Vitest) tampoco. |
| R7 | Cuando la persona tenga sesión iniciada (R2), el test deberá comprobar, con el token de la sesión de la persona, que `POST /bookings` con `{ "activityId": "activity-4", "participants": 1 }` responde 400 con `message` `Activity is not bookable: sold-out`. |
| R8 | El `README.md` deberá explicar en una sección "Smoke e2e contra la API real" los requisitos previos (fork en `master` con la semilla y `fix-api-bookable-launch`, arrancado con `npm run dev` en el puerto 3000; `npm run dev` del cliente en el 5173), el comando `npm run test:e2e:smoke`, que escribe datos en el fork y cómo dejarlos como estaban (`git restore db/` en el fork), y que deja de funcionar a partir del 2027-06-01 porque la fecha de `activity-2` habrá pasado. |

## Criterios de aceptación

"Entorno listo" = fork en `master` (con `fix-api-bookable-launch` integrado) con `db/` sin cambios (`git status --short db/` vacío) arrancado con `npm run dev`, y `npm run dev` del cliente en marcha. El smoke usa el reloj real (no `page.clock`).

### R1
- **Dado** el entorno listo
- **Cuando** se ejecuta `npm run test:e2e:smoke`
- **Entonces** el test rellena "Nombre de usuario", "Email" y "Contraseña", marca "Acepto los términos y condiciones" y pulsa "Crear cuenta"
- **Y** la cabecera muestra el nombre de usuario y el botón "Cerrar sesión"
- **Y** `db/users.json` del fork contiene un usuario nuevo con ese email

### R2
- **Dado** la persona de R1 con sesión iniciada
- **Cuando** el test pulsa "Cerrar sesión", va a "Iniciar sesión", escribe el mismo email y contraseña y envía el formulario
- **Entonces** la cabecera vuelve a mostrar su nombre y "Cerrar sesión" (y no "Email o contraseña incorrectos.")

### R3
- **Dado** la persona de R2 con sesión iniciada
- **Cuando** el test abre `/lanzamientos/activity-2`, deja "Número de plazas" en 1 y pulsa "Reservar"
- **Entonces** la URL coincide con `/reservas/booking-\d+` y la región "Reserva confirmada" contiene "Órbita Marciana", "1 plaza", "Importe total: 1.249.999,00 €" y "Pagada"

### R4
- **Dado** la confirmación de R3
- **Cuando** el test pulsa "Ver mis reservas"
- **Entonces** la URL es `/reservas` y hay un único `article`, con nombre "Órbita Marciana"

### R5
- **Dado** el fork parado (o el `npm run dev` del cliente parado)
- **Cuando** se ejecuta `npm run test:e2e:smoke`
- **Entonces** el test falla en pocos segundos con un mensaje que indica que la API no responde en `http://localhost:3000` (o la app en `http://localhost:5173`) y cómo arrancarla, sin pasos de registro en la traza

### R6
- **Dado** el fichero del smoke en `tests/e2e/smoke/`
- **Cuando** se ejecuta `npx playwright test --project=chromium --project=firefox --list`
- **Entonces** la lista no incluye `real-api.smoke.spec.ts`
- **Y** `npm run test:e2e` pasa con la API apagada, y `npm run test` no ejecuta el smoke

### R7
- **Dado** el entorno listo y la persona de R2 con sesión
- **Cuando** el test envía `POST http://localhost:3000/bookings` con `Authorization: Bearer <accessToken de la sesión guardada>` y `{ "activityId": "activity-4", "participants": 1 }`
- **Entonces** la respuesta es 400 con `message` `Activity is not bookable: sold-out` y `errors` `[]`
- **Y** "Mis reservas" sigue mostrando una sola reserva

### R8
- **Dado** el `README.md` del cliente
- **Cuando** una persona lo lee
- **Entonces** encuentra la sección "Smoke e2e contra la API real" con los dos servidores que hay que arrancar, el comando `npm run test:e2e:smoke`, el aviso de que el smoke crea usuarios y reservas en el fork y el paso `git restore db/` en el fork para limpiarlos
- **Y** el aviso de que el smoke deja de funcionar a partir del 2027-06-01 (fecha de `activity-2`) y habrá que actualizar la semilla o el lanzamiento elegido

## Casos límite
- Ejecuciones repetidas sin restaurar `db/`: cada una usa un email nuevo (R1) y una persona nueva, así que "Mis reservas" sigue teniendo una sola reserva (R4). Cada ejecución ocupa 1 de las 12 plazas de `activity-2`; tras 12 ejecuciones la reserva falla por capacidad y el test lo muestra ("No quedan plazas libres en este lanzamiento."): hay que restaurar `db/`.
- Importe múltiplo de 1000 (pago rechazado, 402): 1 × 1 249 999 € no lo es; no se deben usar `activity-3` con N par ni lanzamientos de precio redondo.
- Reinicio del fork entre ejecuciones: los ids siguen correlativos gracias a `fix-api-user-session` (R7 de esa spec).
- Fork sin `fix-api-bookable-launch`: `activity-4` acepta la reserva (201) y R7 falla. Es el resultado esperado: el smoke exige el fork actualizado (dependencia de la spec); el mensaje de fallo debe mostrar el código y el cuerpo recibidos.
- Puerto 5173 ocupado por otra app o `npm run dev` apuntando a otra API: R5 solo comprueba que responden; el recorrido fallará en el primer paso con un error visible.
- El `webServer` global de `playwright.config.ts` arranca también Vite en el 5174 al ejecutar el smoke; no se usa, pero no molesta.
- Fechas: `activity-2` es del 2027-06-01; a partir de esa fecha deja de ser reservable (el detalle muestra el aviso sin formulario y la API respondería `past-date`), así que el smoke fallará en R3. Habrá que actualizar la semilla o el lanzamiento elegido (y el ADD §9). Lo documenta el README (R8).

## Fuera de la spec / notas
- **Lanzamiento elegido:** `activity-2` (12 plazas, `confirmed`) en lugar de `activity-1` (6 plazas): aguanta el doble de ejecuciones y prueba un estado reservable distinto de `published`. El ADD §9 ya está actualizado.
- **Pista para el plan (no es una decisión de la spec):** el token de R7 puede leerse de `localStorage["astrobookings.session"]` con `page.evaluate` y la petición hacerse con el fixture `request` de Playwright. La URL de la API puede ser una constante `http://localhost:3000` (local, no es secreto) o leerse de `.env.development`.
- **Sin esperas fijas** y con localizadores accesibles (`getByRole`, `getByLabel`), como el resto de e2e. El título del test referencia los requisitos (`R1–R4`, `R7`).
- Los datos que deja el smoke (usuarios `smoke-…@example.com`, reservas y pagos) no se borran solos; `git restore db/` en el fork los elimina. Un script de limpieza queda fuera (no aporta más que ese comando).
- El smoke no forma parte del criterio de terminado del proyecto (`typecheck`, `lint`, `test`, `test:e2e`); se ejecuta a mano antes de una release o tras cambiar el fork.

## Decisiones tomadas
Aprobadas por la persona el 2026-11-07:
1. **R7:** se incluye como requisito normal (no opcional ni `test.fixme`); por eso esta spec depende de `fix-api-bookable-launch`, que se implementa antes.
2. **Lanzamiento:** `activity-2` (ADD §9 actualizado).
3. **Vigencia:** se acepta que el smoke deje de funcionar a partir del 2027-06-01; se avisa en la spec y en el README (R8).
