---
description: Convenciones de TypeScript para el código y los tests del proyecto
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "tests/**/*.ts"
  - "tests/**/*.tsx"
---

# Instrucciones de TypeScript

- `strict: true`. No uses `any`; si un tipo es desconocido, usa `unknown` y estréchalo.
- Usa `type` para las formas de datos y uniones de literales en lugar de `enum` (por ejemplo, `type BookingStatus = 'pending' | 'confirmed' | 'cancelled'`).
- Los tipos del dominio (`Launch`, `Booking`, `Session`…) se definen una sola vez en `src/domain/`, junto a sus funciones de mapeo y reglas, y se importan con `import type`. Los tipos DTO de la API se infieren de los esquemas de `src/api/schemas.ts` (`z.infer`) y no salen de `api/` y `domain/`. No se crea `src/types/` (ver ADD §3).
- Valida en tiempo de ejecución los datos que llegan de la API antes de usarlos; no confíes solo en el tipado.
- Funciones pequeñas y puras siempre que se pueda; los efectos secundarios (red, almacenamiento) quedan en los bordes.
- Usa `async/await` en lugar de `.then()`. Captura los errores donde puedas tratarlos y no los silencies.
- Usa `const` por defecto y `let` solo cuando haya reasignación. Nunca `var`.
- Exportaciones con nombre; evita `export default` salvo donde una herramienta lo exija.
- Nombres de fichero: `kebab-case.ts` para módulos y `PascalCase.tsx` para componentes.
