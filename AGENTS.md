# AstroBookings Client — Reglas para agentes

Reglas generales que cualquier agente (Claude Code, Copilot, Cursor…) debe seguir en este repositorio.
Las reglas específicas de lenguaje están en `.agents/instructions/` y los procedimientos reutilizables en `.agents/skills/`.

## 1. Proyecto

Aplicación **frontend** que consume la **API de AstroBookings** (empresa ficticia de viajes espaciales) para:

- Mostrar los lanzamientos disponibles con sus detalles (cohete, precio, plazas).
- Reservar plazas en un lanzamiento sin superar las plazas disponibles.
- Mostrar el estado de las reservas y permitir al cliente consultar las suyas.

Proyecto de formación: no requiere seguridad ni base de datos en la fase inicial.
Enunciado completo: [project/briefing.md](project/briefing.md).

## 2. Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript (modo `strict`) |
| UI | React + Vite |
| Tests unitarios y de componentes | Vitest + Testing Library |
| Tests end-to-end | Playwright |
| Backend | **Pendiente de decidir en el ADD**: API del curso o API simulada |

No añadas dependencias que no estén justificadas en `project/ADD.md`.

## 3. Estructura del repositorio

```text
AGENTS.md            Reglas generales (este fichero)
CLAUDE.md            Importa AGENTS.md para Claude Code
.agents/             FUENTE de verdad de los artefactos de IA (independiente de la herramienta)
  agents/            Roles del flujo SDD (1-analyst … 8-dev-ops)
  instructions/      Instrucciones contextuales por lenguaje
  prompts/           Prompts versionados: orquestadores y comandos
  skills/            Capacidades reutilizables con sus plantillas
.claude/             COPIA generada para Claude Code (no editar a mano)
project/             Documentación de producto
  briefing.md        Enunciado de la práctica
  PRD.md             Requisitos de producto (Analyst)
  ADD.md             Diseño de arquitectura (Architect)
  specs/             Specs (*.spec.md) y planes (*.plan.md) por funcionalidad
src/                 Código de la aplicación
tests/               Tests unitarios (unit/) y end-to-end (e2e/)
scripts/             Utilidades del repositorio
CHANGELOG.md         Historial de versiones (Keep a Changelog + SemVer)
```

**Importante:** edita siempre en `.agents/` y después ejecuta `scripts/sync-claude.ps1` para regenerar `.claude/`.

## 4. Flujo de trabajo (Spec-Driven Development)

| Fase | Rol | Entrada | Salida |
|---|---|---|---|
| Entender | `1-analyst` | briefing.md | `project/PRD.md` |
| Diseñar | `2-architect` | PRD.md | `project/ADD.md` |
| Especificar | `3-product-owner` | PRD.md + ADD.md | `project/specs/<tipo>-<slug>.spec.md` |
| Planificar | `4-engineer` | spec | `project/specs/<tipo>-<slug>.plan.md` + rama |
| Implementar | `5-coder` | spec + plan | código en `src/` |
| Verificar | `6-tester` | spec + código | tests en `tests/` + informe |
| Limpiar | `7-cleaner` | código verificado | código refactorizado sin cambio de comportamiento |
| Documentar y publicar | `8-dev-ops` | rama terminada | commits, CHANGELOG, merge, versión |

Orquestadores (capítulo 6): `architect` (PRD → ADD → specs), `builder` (plan → código → test → limpieza → release) y `craftsman` (mejora continua del sistema).

## 5. Reglas generales

1. **Human-in-the-loop.** Al terminar cada fase, detente, resume lo que has hecho y espera la validación de la persona antes del handoff.
2. **Sin spec no hay código.** No implementes nada que no esté en una spec aprobada. Si falta información, pregunta; no inventes requisitos.
3. **Una funcionalidad, una rama.** `feat/<slug>`, `fix/<slug>` o `chore/<slug>` creadas desde `main`. Nunca trabajes directamente en `main`.
4. **Commits** con Conventional Commits (skill `committing-changes`). No hagas commit, merge ni push sin que la persona lo pida.
5. **Trazabilidad.** Cada commit y cada test deben poder relacionarse con un requisito de la spec (por ejemplo, `R1`, `R2`).
6. **Evidencia, no promesas.** Una tarea se da por terminada solo cuando los tests pasan y se cumplen los criterios de aceptación. Informa de los fallos tal como son.
7. **Cambios pequeños.** Haz solo lo que pide la tarea, sin refactorizaciones oportunistas fuera del alcance (para eso está `7-cleaner`).
8. **Idioma.** La documentación y las specs se escriben en español; el código, los identificadores y los mensajes de commit, en inglés.

## 6. Convenciones de código

- Componentes de React funcionales, uno por fichero, en `PascalCase.tsx`.
- Lógica sin UI (cliente de la API, validaciones, tipos) separada de los componentes.
- El acceso a la API está centralizado en un único módulo cliente; los componentes nunca llaman a `fetch` directamente.
- Los errores de red y de validación siempre se muestran a la persona usuaria y nunca se ignoran en silencio.
- Nombres descriptivos y sin abreviaturas crípticas.

## 7. Qué evitar

- Dejar código comentado, `console.log` de depuración o `any` sin justificar.
- Duplicar lógica que ya existe en otro módulo.
- Escribir secretos o URLs de entornos reales en el código (usa variables `VITE_*` en `.env`).
- Modificar `.claude/` a mano.
