/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { activityIdOf, API_URL, mockActivities } from './fixtures/api-mock.ts';
import { errorResponses, findLaunchDto } from './fixtures/data.ts';
import { launchCard } from './fixtures/locators.ts';

const NOW = new Date('2026-11-05T10:00:00Z');
const LOADING_TEXT = 'Cargando lanzamiento…';
const NOT_FOUND_TEXT = 'Este lanzamiento no existe o ya no está disponible.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const REASON_TEXTS = [
  'Agotado: no quedan plazas',
  'Este lanzamiento ya se ha realizado',
  'Este lanzamiento se ha cancelado',
  'La fecha de este lanzamiento ya ha pasado',
  'No disponible',
];
const ACTIVITY_1_URL = `${API_URL}/activities/activity-1`;

test.use({ timezoneId: 'UTC', locale: 'es-ES' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

function missionHeading(page: Page, mission: string) {
  return page.getByRole('heading', { level: 1, name: mission, exact: true });
}

async function expectNoBookingOption(page: Page) {
  await expect(page.getByLabel('Número de plazas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reservar' })).toHaveCount(0);
}

test.describe('launch detail', () => {
  test('R1: shows the loading status while the API is slow and then the detail', async ({
    page,
  }) => {
    const finishedRequests: string[] = [];
    const authorizationHeaders: (string | undefined)[] = [];
    page.on('requestfinished', (request) => {
      if (request.method() === 'GET' && request.url() === ACTIVITY_1_URL) {
        finishedRequests.push(request.url());
      }
    });
    page.on('request', (request) => {
      if (request.url().startsWith(`${API_URL}/activities`)) {
        authorizationHeaders.push(request.headers()['authorization']);
      }
    });
    let releaseResponse: () => void = () => undefined;
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await mockActivities(page, async () => {
      await responseReleased;
      return { body: findLaunchDto('activity-1') };
    });

    await page.goto('/lanzamientos/activity-1');

    await expect(page.getByRole('status')).toHaveText(LOADING_TEXT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);

    releaseResponse();

    await expect(missionHeading(page, 'Misión Luna')).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(finishedRequests).toEqual([ACTIVITY_1_URL]);
    expect(authorizationHeaders.length).toBeGreaterThan(0);
    expect(authorizationHeaders.every((header) => header === undefined)).toBe(true);
    expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
  });

  test('R1: opens the detail from the launch list', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos');
    await launchCard(page, 'Misión Luna').getByRole('link', { name: 'Misión Luna' }).click();

    await expect(page).toHaveURL(/\/lanzamientos\/activity-1$/);
    await expect(missionHeading(page, 'Misión Luna')).toBeVisible();
  });

  test('R2: shows the details of activity-1', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos/activity-1');

    await expect(missionHeading(page, 'Misión Luna')).toBeVisible();
    const main = page.getByRole('main');
    for (const text of [
      'Cohete: Falcon 9',
      'Identificador: falcon-9-mision-luna',
      'Cabo Cañaveral, Florida (EE. UU.)',
      'lunes, 15 de marzo de 2027, 14:30',
      '3 días',
      '249.999,00 € por plaza',
      '6 plazas en total',
      'Mínimo de viajeros para confirmar el lanzamiento: 2',
      'Abierto a reservas',
    ]) {
      await expect(main).toContainText(text);
    }

    await page.getByRole('link', { name: 'Volver a los lanzamientos' }).click();

    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Lanzamientos' })).toBeVisible();
  });

  test('R2: hides the rocket line for activity-8', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos/activity-8');

    await expect(missionHeading(page, 'Paseo Lunar Express')).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText('Cohete:');
  });

  for (const id of ['activity-99', 'xyz']) {
    test(`R3: shows the not found screen for an unknown launch (${id})`, async ({ page }) => {
      await mockActivities(page);

      await page.goto(`/lanzamientos/${id}`);

      await expect(page.getByText(NOT_FOUND_TEXT)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Ver todos los lanzamientos' })).toHaveAttribute(
        'href',
        '/lanzamientos',
      );
      await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
    });
  }

  test('R4: treats a draft opened by URL as not found', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos/activity-7');

    await expect(page.getByText(NOT_FOUND_TEXT)).toBeVisible();
    await expect(page.getByText('Prueba de Sistemas')).toHaveCount(0);
  });

  test('R5: shows the network error and recovers on retry', async ({ page }) => {
    let apiDown = true;
    await mockActivities(page, (request) =>
      apiDown ? 'abort' : { body: findLaunchDto(activityIdOf(request) ?? '') },
    );

    await page.goto('/lanzamientos/activity-1');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(NETWORK_TEXT);

    apiDown = false;
    await alert.getByRole('button', { name: 'Reintentar' }).click();

    await expect(missionHeading(page, 'Misión Luna')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('R5: shows the server error', async ({ page }) => {
    await mockActivities(page, () => ({
      status: 500,
      body: errorResponses.failedToRetrieveActivity,
    }));

    await page.goto('/lanzamientos/activity-1');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(SERVER_TEXT);
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  for (const [id, mission, reasonText] of [
    ['activity-4', 'Estación Orbital', 'Agotado: no quedan plazas'],
    ['activity-5', 'Mirador Orbital', 'Este lanzamiento se ha cancelado'],
    ['activity-6', 'Amanecer Orbital', 'Este lanzamiento ya se ha realizado'],
    ['activity-9', 'Ventana Perdida', 'La fecha de este lanzamiento ya ha pasado'],
  ] as const) {
    test(`R7: explains why ${id} cannot be booked`, async ({ page }) => {
      await mockActivities(page);

      await page.goto(`/lanzamientos/${id}`);

      await expect(missionHeading(page, mission)).toBeVisible();
      await expect(page.getByText(reasonText)).toBeVisible();
      await expectNoBookingOption(page);
    });
  }

  test('R7: shows no notice for a bookable launch', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos/activity-1');

    await expect(missionHeading(page, 'Misión Luna')).toBeVisible();
    await expect(page.locator('.bookability-notice')).toHaveCount(0);
    for (const text of REASON_TEXTS) {
      await expect(page.getByText(text)).toHaveCount(0);
    }
  });
});

test.describe('launch list bookability', () => {
  test('R8: shows the bookability reason on the list cards', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos');

    await expect(page.getByRole('article')).toHaveCount(8);
    await expect(launchCard(page, 'Ventana Perdida')).toContainText(
      'La fecha de este lanzamiento ya ha pasado',
    );
    await expect(launchCard(page, 'Estación Orbital')).toContainText('Agotado: no quedan plazas');
    for (const mission of [
      'Misión Luna',
      'Órbita Marciana',
      'Vuelo Suborbital',
      'Paseo Lunar Express',
    ]) {
      await expect(launchCard(page, mission).locator('.bookability-notice')).toHaveCount(0);
    }
  });
});
