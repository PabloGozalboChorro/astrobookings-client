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
- Los tipos del dominio (`Launch`, `Rocket`, `Booking`…) se definen una sola vez en `src/types/` y se importan con `import type`.
- Valida en tiempo de ejecución los datos que llegan de la API antes de usarlos; no confíes solo en el tipado.
- Funciones pequeñas y puras siempre que se pueda; los efectos secundarios (red, almacenamiento) quedan en los bordes.
- Usa `async/await` en lugar de `.then()`. Captura los errores donde puedas tratarlos y no los silencies.
- Usa `const` por defecto y `let` solo cuando haya reasignación. Nunca `var`.
- Exportaciones con nombre; evita `export default` salvo donde una herramienta lo exija.
- Nombres de fichero: `kebab-case.ts` para módulos y `PascalCase.tsx` para componentes.
