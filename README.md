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

## Mantenimiento de los artefactos de IA

La fuente está en `.agents/`. Después de modificarla, regenera la copia para Claude Code:

```powershell
./scripts/sync-claude.ps1
```

## Créditos

- Curso: [Alberto Basalo](https://albertobasalo.dev) · [AI Code Academy](https://aicode.academy)
