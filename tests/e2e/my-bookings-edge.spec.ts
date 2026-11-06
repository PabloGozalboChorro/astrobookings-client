/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  defaultBookingsHandler,
  holdResponses,
  mockActivities,
  mockBookings,
  mockLogin,
} from './fixtures/api-mock.ts';
import { anaAuthResponse, bookingWithActivity, errorResponses } from './fixtures/data.ts';
import { bookingCard } from './fixtures/locators.ts';
import { ANA_TOKEN, readStoredSession, seedSession, sessionValue } from './fixtures/session.ts';

const NOW = new Date('2026-11-06T10:00:00Z');
const SESSION_TEXT = 'Tu sesión ha caducado o no es válida. Inicia sesión de nuevo.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const CONTRACT_TEXT = 'El servidor ha devuelto una respuesta inesperada.';
const LAUNCH_NOT_FOUND_TEXT = 'Este lanzamiento no existe o ya no está disponible.';
const LIST_URL = `${API_URL}/bookings`;
const BOOKING_1_URL = `${API_URL}/bookings/booking-1`;

test.use({ timezoneId: 'UTC', locale: 'es-ES' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

function header(page: Page) {
  return page.getByRole('banner');
}

function main(page: Page) {
  return page.getByRole('main');
}

function bookingArticles(page: Page) {
  return main(page).getByRole('article');
}

// StrictMode mounts twice: the first request is aborted and only one GET finishes.
function trackFinishedGets(page: Page, url: string): string[] {
  const finished: string[] = [];
  page.on('requestfinished', (request) => {
    if (request.method() === 'GET' && request.url() === url) {
      finished.push(request.url());
    }
  });
  return finished;
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe('my bookings edge cases', () => {
  test('R3: a single GET /bookings finishes in StrictMode', async ({ page }) => {
    await seedSession(page, sessionValue());
    const finished = trackFinishedGets(page, LIST_URL);
    const { release, released } = holdResponses();
    await mockBookings(page, async (request, attempt) => {
      await released;
      return defaultBookingsHandler(request, attempt);
    });

    await page.goto('/reservas');
    await expect(page.getByRole('status').filter({ hasText: 'Cargando tus reservas…' })).toBeVisible();
    release();

    await expect(bookingArticles(page)).toHaveCount(4);
    expect(finished).toEqual([LIST_URL]);
  });

  test('R8: a single GET /bookings/booking-1 finishes in StrictMode', async ({ page }) => {
    await seedSession(page, sessionValue());
    const finished = trackFinishedGets(page, BOOKING_1_URL);
    const { release, released } = holdResponses();
    await mockBookings(page, async (request, attempt) => {
      await released;
      return defaultBookingsHandler(request, attempt);
    });

    await page.goto('/reservas/booking-1');
    await expect(page.getByRole('status').filter({ hasText: 'Cargando reserva…' })).toBeVisible();
    release();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Misión Luna', exact: true }),
    ).toBeVisible();
    expect(finished).toEqual([BOOKING_1_URL]);
  });

  test('R2: /reservas without a session goes to /acceso and comes back after signing in', async ({
    page,
  }) => {
    const bookings = await mockBookings(page);
    await mockLogin(page, () => ({ body: anaAuthResponse(ANA_TOKEN) }));

    await page.goto('/reservas');

    await expect(page).toHaveURL(/\/acceso\?volver=%2Freservas$/);
    expect(bookings.requests).toEqual([]);

    await page.getByLabel('Email').fill('ana@ejemplo.com');
    await page.getByLabel('Contraseña').fill('secreto1');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL(/\/reservas$/);
    await expect(bookingArticles(page)).toHaveCount(4);
    for (const { authorization } of bookings.requests) {
      expect(authorization).toBe(`Bearer ${ANA_TOKEN}`);
    }
  });

  test('R11: a 401 on the detail goes to /acceso with volver and the notice', async ({ page }) => {
    await seedSession(page, sessionValue());
    await mockBookings(page, () => ({ status: 401, body: errorResponses.invalidToken }));

    await page.goto('/reservas/booking-1');

    await expect(page).toHaveURL(/\/acceso\?volver=%2Freservas%2Fbooking-1$/);
    await expect(page.getByText(SESSION_TEXT)).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Mis reservas', exact: true })).toHaveCount(
      0,
    );
    await expect.poll(() => readStoredSession(page)).toBeNull();
  });

  test('R11: an expired session on the detail does not request it', async ({ page }) => {
    await seedSession(page, sessionValue({ expiresAt: NOW.getTime() - 1 }));
    const bookings = await mockBookings(page);

    await page.goto('/reservas/booking-1');

    await expect(page).toHaveURL(/\/acceso\?volver=%2Freservas%2Fbooking-1$/);
    await expect(page.getByText(SESSION_TEXT)).toBeVisible();
    expect(bookings.requests).toEqual([]);
  });

  test('R7: retries after a network error and shows the bookings', async ({ page }) => {
    await seedSession(page, sessionValue());
    let networkDown = true;
    await mockBookings(page, (request, attempt) =>
      networkDown ? 'abort' : defaultBookingsHandler(request, attempt),
    );

    await page.goto('/reservas');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(NETWORK_TEXT);
    networkDown = false;
    await alert.getByRole('button', { name: 'Reintentar' }).click();

    await expect(bookingArticles(page)).toHaveCount(4);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('R7: shows the contract error for an unexpected response', async ({ page }) => {
    await seedSession(page, sessionValue());
    await mockBookings(page, () => ({ body: [{ id: 1 }] }));

    await page.goto('/reservas');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(CONTRACT_TEXT);
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('R4: rounds the total amount to two decimals', async ({ page }) => {
    await seedSession(page, sessionValue());
    await mockBookings(page, () => ({
      body: [
        bookingWithActivity('booking-1', 'activity-1', 3, '2026-11-03T09:00:00.000Z', 'paid', {
          price: 99.99,
        }),
      ],
    }));

    await page.goto('/reservas');

    await expect(bookingCard(page, 'Misión Luna')).toContainText('299,97 €');
  });

  test('R9: lists bookings of draft and cancelled launches and the draft launch is not found', async ({
    page,
  }) => {
    await seedSession(page, sessionValue());
    await mockActivities(page);
    const draftBooking = bookingWithActivity(
      'booking-7',
      'activity-7',
      1,
      '2026-11-05T10:00:00.000Z',
      'paid',
    );
    const cancelledBooking = bookingWithActivity(
      'booking-5',
      'activity-5',
      2,
      '2026-11-04T10:00:00.000Z',
      'pending',
    );
    await mockBookings(page, (request) => {
      const path = new URL(request.url()).pathname;
      if (path === '/bookings') {
        return { body: [cancelledBooking, draftBooking] };
      }
      return { body: path.endsWith('booking-7') ? draftBooking : cancelledBooking };
    });

    await page.goto('/reservas');

    await expect(bookingArticles(page)).toHaveCount(2);
    const draftMission = draftBooking.activity.name.split(' · ').at(-1) ?? '';
    const cancelledMission = cancelledBooking.activity.name.split(' · ').at(-1) ?? '';
    await expect(bookingArticles(page).getByRole('heading', { level: 2 })).toHaveText([
      draftMission,
      cancelledMission,
    ]);

    await page.goto('/reservas/booking-5');
    await expect(main(page)).toContainText('Estado del lanzamiento: Cancelado');

    await page.goto('/reservas/booking-7');
    await expect(main(page)).toContainText('Estado del lanzamiento: Borrador');
    await main(page).getByRole('link', { name: 'Ver lanzamiento', exact: true }).click();

    await expect(page).toHaveURL(/\/lanzamientos\/activity-7$/);
    await expect(page.getByText(LAUNCH_NOT_FOUND_TEXT)).toBeVisible();
  });

  test('fits a 375 px wide window in the list and the detail', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedSession(page, sessionValue());
    await mockBookings(page);

    await page.goto('/reservas');
    await expect(bookingArticles(page)).toHaveCount(4);
    await expectNoHorizontalScroll(page);
    for (const card of await bookingArticles(page).all()) {
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeInViewport();
    }

    await page.goto('/reservas/booking-1');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Misión Luna', exact: true }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
