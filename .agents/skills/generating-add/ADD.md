# ADD — {Nombre del producto}

- **Estado:** Borrador | Aprobado
- **Última actualización:** {AAAA-MM-DD}
- **PRD de referencia:** [PRD.md](PRD.md)

## 1. Visión general
{Diagrama o descripción de los componentes y de cómo se comunican.}

## 2. Stack
| Capa | Tecnología | Motivo |
|---|---|---|
| UI | {…} | {…} |

## 3. Estructura de carpetas
```text
src/
  {…}
```

## 4. Integración con la API
- **URL base:** `VITE_API_URL`
- **Origen:** {API del curso | API simulada (herramienta)}

| Método | Endpoint | Uso | Respuesta | Errores |
|---|---|---|---|---|
| GET | {/launches} | {…} | {…} | {…} |

### Modelos
```ts
// {tipos del dominio}
```

## 5. Gestión de estado y navegación
{…}

## 6. Estrategia de pruebas
| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitario | Vitest | {…} |
| E2E | Playwright | {…} |

## 7. Decisiones (ADR)
### ADR-001: {título}
- **Contexto:** {…}
- **Decisión:** {…}
- **Consecuencias:** {…}

## 8. Riesgos
| Riesgo | Mitigación |
|---|---|
| {…} | {…} |
