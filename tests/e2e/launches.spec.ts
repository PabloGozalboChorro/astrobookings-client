/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { API_URL, mockActivities } from './fixtures/api-mock.ts';
import { draftLaunchDto, errorResponses, launchDtos } from './fixtures/data.ts';
import { launchCard } from './fixtures/locators.ts';

const LOADING_TEXT = 'Cargando lanzamientos…';
const EMPTY_TEXT = 'No hay lanzamientos disponibles en este momento.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const CONTRACT_TEXT = 'El servidor ha devuelto una respuesta inesperada.';

const VISIBLE_MISSIONS_IN_API_ORDER = [
  'Misión Luna',
  'Órbita Marciana',
  'Vuelo Suborbital',
  'Estación Orbital',
  'Mirador Orbital',
  'Amanecer Orbital',
  'Paseo Lunar Express',
  'Ventana Perdida',
];

test.use({ timezoneId: 'UTC', locale: 'es-ES' });

function launchCards(page: Page) {
  return page.getByRole('article');
}

function isActivitiesListRequest(url: string): boolean {
  return url.startsWith(`${API_URL}/activities`);
}

test.describe('launch list', () => {
  test('R1: lists the visible launches in API order without drafts', async ({ page }) => {
    const finishedRequests: string[] = [];
    page.on('requestfinished', (request) => {
      if (request.method() === 'GET' && isActivitiesListRequest(request.url())) {
        finishedRequests.push(request.url());
      }
    });
    const mock = await mockActivities(page);

    await page.goto('/lanzamientos');

    await expect(launchCards(page).getByRole('heading', { level: 2 })).toHaveText(
      VISIBLE_MISSIONS_IN_API_ORDER,
    );
    await expect(page.getByText('Prueba de Sistemas')).toHaveCount(0);
    expect(mock.requestedUrls.length).toBeGreaterThan(0);
    for (const url of mock.requestedUrls) {
      expect(url.pathname).toBe('/activities');
      expect(url.search).toBe('');
    }
    expect(finishedRequests).toEqual([`${API_URL}/activities`]);
    expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
  });

  test('R2: shows the details of activity-1', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos');

    const card = launchCard(page, 'Misión Luna');
    await expect(card.getByRole('link', { name: 'Misión Luna' })).toHaveAttribute(
      'href',
      '/lanzamientos/activity-1',
    );
    await expect(card).toContainText('Cohete: Falcon 9');
    await expect(card).toContainText('Cabo Cañaveral, Florida (EE. UU.)');
    await expect(card).toContainText('lunes, 15 de marzo de 2027, 14:30');
    await expect(card).toContainText('3 días');
    await expect(card).toContainText('249.999,00 € por plaza');
    await expect(card).toContainText('6 plazas en total');
    await expect(card).toContainText('Abierto a reservas');
  });

  test('R2: shows the status text of every visible launch, including past ones', async ({
    page,
  }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos');

    await expect(launchCards(page).locator('.launch-card__status')).toHaveText([
      'Abierto a reservas',
      'Confirmado',
      'Abierto a reservas',
      'Agotado',
      'Cancelado',
      'Realizado',
      'Abierto a reservas',
      'Abierto a reservas',
    ]);
    await expect(launchCard(page, 'Amanecer Orbital')).toContainText(
      'miércoles, 30 de septiembre de 2026, 6:00',
    );
    await expect(launchCard(page, 'Ventana Perdida')).toContainText(
      'jueves, 1 de octubre de 2026, 18:30',
    );
  });

  test('R4: shows the full name and no rocket line when the name cannot be split', async ({
    page,
  }) => {
    const unsplittableLaunch = { ...launchDtos[0], id: 'activity-10', name: 'Falcon 9 · ' };
    await mockActivities(page, () => ({ body: [...launchDtos, unsplittableLaunch] }));

    await page.goto('/lanzamientos');

    const expressCard = launchCard(page, 'Paseo Lunar Express');
    await expect(expressCard.getByRole('heading')).toHaveText('Paseo Lunar Express');
    await expect(expressCard).not.toContainText('Cohete:');

    const unsplittableCard = launchCards(page).last();
    await expect(unsplittableCard.getByRole('heading')).toHaveText('Falcon 9 ·');
    await expect(unsplittableCard.getByRole('link')).toHaveAttribute(
      'href',
      '/lanzamientos/activity-10',
    );
    await expect(unsplittableCard).not.toContainText('Cohete:');
  });

  test('R5: formats prices and dates in es-ES', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos');

    await expect(launchCard(page, 'Vuelo Suborbital')).toContainText('12.500,00 € por plaza');
    const marsCard = launchCard(page, 'Órbita Marciana');
    await expect(marsCard).toContainText('1.249.999,00 € por plaza');
    await expect(marsCard).toContainText('martes, 1 de junio de 2027, 9:00');
  });

  test('R6: formats durations', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos');

    await expect(launchCard(page, 'Vuelo Suborbital')).toContainText('11 min');
    await expect(launchCard(page, 'Amanecer Orbital')).toContainText('3 h');
    await expect(launchCard(page, 'Mirador Orbital')).toContainText('1 día');
    await expect(launchCard(page, 'Ventana Perdida')).toContainText('2 días');
    await expect(launchCard(page, 'Órbita Marciana')).toContainText('180 días');
  });

  test('R7: shows the loading status while the API is slow', async ({ page }) => {
    let releaseResponse: () => void = () => undefined;
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await mockActivities(page, async () => {
      await responseReleased;
      return { body: launchDtos };
    });

    await page.goto('/lanzamientos');

    await expect(page.getByRole('status')).toHaveText(LOADING_TEXT);
    await expect(launchCards(page)).toHaveCount(0);

    releaseResponse();

    await expect(launchCards(page)).toHaveCount(8);
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('R8: shows the empty message for an empty list', async ({ page }) => {
    await mockActivities(page, () => ({ body: [] }));

    await page.goto('/lanzamientos');

    await expect(page.getByText(EMPTY_TEXT)).toBeVisible();
    await expect(launchCards(page)).toHaveCount(0);
  });

  test('R8: shows the empty message when only drafts are returned', async ({ page }) => {
    await mockActivities(page, () => ({ body: [draftLaunchDto] }));

    await page.goto('/lanzamientos');

    await expect(page.getByText(EMPTY_TEXT)).toBeVisible();
    await expect(launchCards(page)).toHaveCount(0);
  });

  test('R9: shows the network error and recovers on retry', async ({ page }) => {
    let apiDown = true;
    await mockActivities(page, () => (apiDown ? 'abort' : { body: launchDtos }));

    await page.goto('/lanzamientos');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(NETWORK_TEXT);
    await expect(launchCards(page)).toHaveCount(0);

    apiDown = false;
    await alert.getByRole('button', { name: 'Reintentar' }).click();

    await expect(launchCards(page)).toHaveCount(8);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('R9: shows the server error', async ({ page }) => {
    await mockActivities(page, () => ({
      status: 500,
      body: errorResponses.failedToRetrieveActivities,
    }));

    await page.goto('/lanzamientos');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(SERVER_TEXT);
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('R9: shows the unexpected response error', async ({ page }) => {
    await mockActivities(page, () => ({ body: [{ id: 1 }] }));

    await page.goto('/lanzamientos');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(CONTRACT_TEXT);
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('R10: fits a 375 px wide window', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockActivities(page);

    await page.goto('/lanzamientos');

    await expect(launchCards(page)).toHaveCount(8);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    for (const card of await launchCards(page).all()) {
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeInViewport();
    }
  });
});
