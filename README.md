# AstroBookings Client

Aplicación cliente para la API de **AstroBookings**: consulta de lanzamientos espaciales y reserva de plazas.

Es el ejercicio práctico del curso **Programación Inteligente: domina el desarrollo asistido con IA** (Alberto Basalo) y se desarrolla con *Spec-Driven Development* usando agentes con roles.

- Enunciado: [project/briefing.md](project/briefing.md)
- Reglas para agentes: [AGENTS.md](AGENTS.md)
- Proyecto de ejemplo del curso: [activity-bookings-express](https://github.com/Programacion-Inteligente/activity-bookings-express)

## Cómo se trabaja

| Paso | Comando (Claude Code) | Resultado |
|---|---|---|
| 1. Definir el producto | `/architect` | `project/PRD.md`, `project/ADD.md`, `project/specs/*.spec.md` |
| 2. Construir una funcionalidad | `/builder <spec>` | plan, código, tests, limpieza y release |
| 3. Mejorar el sistema | `/craftsman` | refactorización de código, agentes y skills |

Cada fase se detiene para que la persona la valide antes de continuar (*human-in-the-loop*).

## Smoke e2e contra la API real

Los e2e normales (`npm run test:e2e`) interceptan la API. El smoke (`tests/e2e/smoke/real-api.smoke.spec.ts`) recorre la app contra la API real: registro, cierre e inicio de sesión, reserva de 1 plaza en `activity-2` ("Starship · Órbita Marciana"), "Mis reservas" y rechazo de la API al reservar en un lanzamiento agotado (`activity-4`). Es opcional: se ejecuta a mano antes de una release o tras cambiar el fork, solo en Chromium, y no forma parte de `npm run test:e2e`.

Requisitos previos (dos servidores en marcha):

1. Fork [activity-bookings-express](https://github.com/Programacion-Inteligente/activity-bookings-express) en `master`, con la semilla de lanzamientos y el rechazo de lanzamientos no reservables (`fix-api-bookable-launch`), y con `db/` sin cambios. Arráncalo en su carpeta con `npm run dev` (puerto 3000).
2. Este cliente con `npm run dev` (puerto 5173, usa `VITE_API_URL=http://localhost:3000` de `.env.development`).

Ejecución:

```powershell
npm run test:e2e:smoke
```

Si la API (`http://localhost:3000/health`) o la app (`http://localhost:5173`) no responden, el test falla enseguida indicando qué falta y cómo arrancarlo.

Datos que escribe y limpieza:

- Cada ejecución crea en el fork un usuario `smoke-<marca de tiempo>@example.com`, una reserva y un pago (`db/users.json`, `db/bookings.json`, `db/payments.json`). No se borran solos.
- Para dejarlo como estaba, **para el fork** (guarda los datos en memoria y los volvería a escribir) y ejecuta en su carpeta `git restore db/`; si lo restauras con el fork en marcha, reinícialo después.
- Cada ejecución ocupa 1 de las 12 plazas de `activity-2`: tras 12 ejecuciones sin restaurar, la reserva falla por falta de plazas.

Vigencia: `activity-2` es del 2027-06-01. **A partir del 2027-06-01 el smoke deja de funcionar** (el lanzamiento deja de ser reservable) hasta que se actualice la semilla del fork o el lanzamiento elegido en el test.

## Mantenimiento de los artefactos de IA

La fuente está en `.agents/`. Después de modificarla, regenera la copia para Claude Code:

```powershell
./scripts/sync-claude.ps1
```

## Créditos

- Curso: [Alberto Basalo](https://albertobasalo.dev) · [AI Code Academy](https://aicode.academy)
