import { expect, test } from '@playwright/test';

test.describe('app shell', () => {
  test('R5: R9: redirects / to /lanzamientos and shows the layout', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expect(
      page.getByRole('main').getByRole('heading', { level: 1, name: 'Lanzamientos' }),
    ).toBeVisible();
    const header = page.getByRole('banner');
    await expect(header).toContainText('AstroBookings');
    await expect(header.getByRole('link', { name: 'Lanzamientos' })).toBeVisible();
  });

  test('R10: shows the not found page for an unknown route', async ({ page }) => {
    await page.goto('/no-existe');

    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();

    await page.getByRole('link', { name: 'Ir a los lanzamientos' }).click();

    await expect(page).toHaveURL(/\/lanzamientos$/);
  });

  test('R11: declares language, title and mobile viewport', async ({ page }) => {
    await page.goto('/lanzamientos');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveTitle('AstroBookings');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      'width=device-width, initial-scale=1.0',
    );
  });
});
