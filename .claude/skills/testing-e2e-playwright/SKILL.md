---
name: testing-e2e-playwright
description: Escribe y ejecuta tests end-to-end con Playwright que validan los criterios de aceptación de una spec desde el navegador. Úsala para verificar flujos completos.
---

# Tests end-to-end con Playwright

## Ubicación y nombres
- `tests/e2e/<funcionalidad>.spec.ts`
- Un `test` por criterio de aceptación; el nombre incluye el requisito: `test('R1: shows available launches', …)`

## Reglas
1. Traduce cada Dado / Cuando / Entonces de la spec en pasos del test.
2. Usa localizadores accesibles: `getByRole`, `getByLabel`, `getByText`. Evita los selectores CSS frágiles.
3. Para que los tests sean deterministas, intercepta la API con `page.route()` cuando el ADD no disponga de un backend de pruebas estable.
4. No uses esperas fijas (`waitForTimeout`); usa las aserciones con autoespera (`await expect(...).toBeVisible()`).
5. Configura `webServer` en `playwright.config.ts` para arrancar la app (`npm run dev`).

## Ejemplo
```ts
import { expect, test } from '@playwright/test';

test('R1: shows available launches with rocket, price and seats', async ({ page }) => {
  await page.route('**/launches', (route) =>
    route.fulfill({ json: [{ id: '1', mission: 'Ares I', rocket: 'Falcon', price: 1000, availableSeats: 4 }] }),
  );
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Launches' })).toContainText('Ares I');
});
```

## Ejecución
`npm run test:e2e`. Si falla, adjunta el informe (`npx playwright show-report`).
