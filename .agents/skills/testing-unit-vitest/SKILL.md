---
name: testing-unit-vitest
description: Escribe y ejecuta tests unitarios y de componentes con Vitest y Testing Library, trazados a los requisitos de la spec. Úsala para verificar lógica y componentes.
---

# Tests unitarios con Vitest

## Ubicación y nombres
- `tests/unit/<módulo>.test.ts` o `.test.tsx`
- Un `describe` por módulo y un `it` por comportamiento; el nombre incluye el requisito:
  `it('R3: rejects a booking that exceeds available seats', …)`

## Reglas
1. Patrón **Arrange / Act / Assert**, con un comportamiento por test.
2. Prueba el comportamiento observable, no los detalles internos.
3. Mockea la red en el borde (`vi.spyOn(globalThis, 'fetch')` o el módulo `src/api/`), nunca la lógica que se está probando.
4. En los componentes, usa `screen.getByRole` / `getByText` y `@testing-library/user-event`.
5. Casos límite obligatorios cuando apliquen: lista vacía, 0 plazas, exactamente las plazas restantes, error de la API.

## Ejemplo
```ts
import { describe, expect, it } from 'vitest';
import { canBook } from '../../src/features/bookings/can-book';

describe('canBook', () => {
  it('R2: allows booking exactly the remaining seats', () => {
    expect(canBook({ availableSeats: 3 }, 3)).toBe(true);
  });

  it('R3: rejects a booking that exceeds available seats', () => {
    expect(canBook({ availableSeats: 3 }, 4)).toBe(false);
  });
});
```

## Ejecución
`npm test` (una pasada) o `npx vitest` (modo watch). Informa del número real de tests que pasan y fallan.
