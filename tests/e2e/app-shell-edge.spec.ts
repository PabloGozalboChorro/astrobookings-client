import { expect, test } from '@playwright/test';
import { mockActivities } from './fixtures/api-mock.ts';

test.describe('app shell edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await mockActivities(page);
  });

  test('R10: shows the not found page for a nested unknown route', async ({ page }) => {
    await page.goto('/lanzamientos/no-existe/otra');

    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();

    await page.getByRole('link', { name: 'Ir a los lanzamientos' }).click();

    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Lanzamientos' })).toBeVisible();
  });
});
