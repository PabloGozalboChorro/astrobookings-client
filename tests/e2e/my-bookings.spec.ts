/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import {
  bookingIdOf,
  defaultBookingsHandler,
  holdResponses,
  mockActivities,
  mockBookings,
  mockLogin,
} from './fixtures/api-mock.ts';
import {
  anaAuthResponse,
  bookingWithActivity,
  errorResponses,
  findBookingDto,
} from './fixtures/data.ts';
import { bookingCard } from './fixtures/locators.ts';
import { ANA_TOKEN, readStoredSession, seedSession, sessionValue } from './fixtures/session.ts';

const NOW = new Date('2026-11-06T10:00:00Z');
const LIST_LOADING_TEXT = 'Cargando tus reservas…';
const DETAIL_LOADING_TEXT = 'Cargando reserva…';
const EMPTY_TEXT = 'Todavía no tienes reservas.';
const NOT_FOUND_TEXT = 'No encontramos esta reserva.';
const SESSION_TEXT = 'Tu sesión ha caducado o no es válida. Inicia sesión de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const BEARER = `Bearer ${ANA_TOKEN}`;

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

async function signIn(page: Page) {
  await seedSession(page, sessionValue());
}

test.describe('my bookings', () => {
  test('R1: shows "Mis reservas" in the header with a session', async ({ page }) => {
    await signIn(page);
    await mockActivities(page);

    await page.goto('/lanzamientos');

    await expect(
      header(page).getByRole('link', { name: 'Mis reservas', exact: true }),
    ).toHaveAttribute('href', '/reservas');
  });

  test('R1: hides "Mis reservas" without a session', async ({ page }) => {
    await mockActivities(page);

    await page.goto('/lanzamientos');

    await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Mis reservas', exact: true })).toHaveCount(
      0,
    );
  });

  test('R2: redirects to /acceso and returns to the booking after signing in', async ({ page }) => {
    const bookings = await mockBookings(page);
    await mockLogin(page, () => ({ body: anaAuthResponse(ANA_TOKEN) }));

    await page.goto('/reservas/booking-3');

    await expect(page).toHaveURL(/\/acceso\?volver=%2Freservas%2Fbooking-3$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    expect(bookings.requests).toEqual([]);

    await page.getByLabel('Email').fill('ana@ejemplo.com');
    await page.getByLabel('Contraseña').fill('secreto1');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL(/\/reservas\/booking-3$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Órbita Marciana', exact: true }),
    ).toBeVisible();
    const lastRequest = bookings.requests.at(-1);
    expect(lastRequest?.url.pathname).toBe('/bookings/booking-3');
    expect(lastRequest?.authorization).toBe(BEARER);
  });

  test('F3: after signing out, /reservas goes to /acceso', async ({ page }) => {
    await signIn(page);
    await mockActivities(page);
    await mockBookings(page);
    await page.goto('/reservas');
    await expect(bookingArticles(page)).toHaveCount(4);

    await header(page).getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/lanzamientos$/);
    expect(await readStoredSession(page)).toBeNull();

    await page.goto('/reservas');

    await expect(page).toHaveURL(/\/acceso\?volver=%2Freservas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
  });

  test('R3: shows "Cargando tus reservas…" and sends the token without activityId', async ({
    page,
  }) => {
    await signIn(page);
    const { release, released } = holdResponses();
    const bookings = await mockBookings(page, async (request, attempt) => {
      await released;
      return defaultBookingsHandler(request, attempt);
    });

    await page.goto('/reservas');

    await expect(page.getByRole('status').filter({ hasText: LIST_LOADING_TEXT })).toBeVisible();
    await expect.poll(() => bookings.requests.length).toBeGreaterThan(0);
    for (const { url, authorization } of bookings.requests) {
      expect(url.pathname).toBe('/bookings');
      expect(url.searchParams.has('activityId')).toBe(false);
      expect(authorization).toBe(BEARER);
    }

    release();

    await expect(bookingArticles(page)).toHaveCount(4);
    await expect(page.getByText(LIST_LOADING_TEXT)).toHaveCount(0);
  });

  test('R4: lists the bookings from the most recent', async ({ page }) => {
    await signIn(page);
    await mockBookings(page, () => ({
      body: [findBookingDto('booking-1'), findBookingDto('booking-2')],
    }));

    await page.goto('/reservas');

    await expect(bookingArticles(page)).toHaveCount(2);
    const first = bookingArticles(page).nth(0);
    await expect(first.getByRole('heading', { level: 2 })).toHaveText('Vuelo Suborbital');
    for (const text of [
      'Cohete: New Shepard',
      'miércoles, 10 de febrero de 2027, 16:00',
      '3 plazas',
      '37.500,00 €',
      'Reservada el 4 de noviembre de 2026',
      'Pagada',
    ]) {
      await expect(first).toContainText(text);
    }
    const second = bookingArticles(page).nth(1);
    await expect(second.getByRole('heading', { level: 2 })).toHaveText('Misión Luna');
    for (const text of ['2 plazas', '499.998,00 €', 'Reservada el 3 de noviembre de 2026']) {
      await expect(second).toContainText(text);
    }
  });

  test('R4: orders the four bookings of the API by booking date', async ({ page }) => {
    await signIn(page);
    await mockBookings(page);

    await page.goto('/reservas');

    await expect(bookingArticles(page).getByRole('heading', { level: 2 })).toHaveText([
      'Órbita Marciana',
      'Vuelo Suborbital',
      'Misión Luna',
      'Amanecer Orbital',
    ]);
    await expect(bookingCard(page, 'Órbita Marciana')).toContainText('1 plaza');
    await expect(bookingCard(page, 'Órbita Marciana')).not.toContainText('1 plazas');
  });

  test('R4: shows only the full name for a launch without rocket', async ({ page }) => {
    await signIn(page);
    await mockBookings(page, () => ({
      body: [bookingWithActivity('booking-5', 'activity-8', 2, '2026-11-02T10:00:00.000Z', 'paid')],
    }));

    await page.goto('/reservas');

    const card = bookingCard(page, 'Paseo Lunar Express');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText('Cohete:');
  });

  test('R5: shows pending, paid and refunded in the list and in the details', async ({ page }) => {
    await signIn(page);
    await mockBookings(page);

    await page.goto('/reservas');

    await expect(bookingCard(page, 'Órbita Marciana')).toContainText('Pendiente de pago');
    await expect(bookingCard(page, 'Vuelo Suborbital')).toContainText('Pagada');
    await expect(bookingCard(page, 'Amanecer Orbital')).toContainText('Reembolsada');

    for (const [id, mission, label] of [
      ['booking-3', 'Órbita Marciana', 'Pendiente de pago'],
      ['booking-2', 'Vuelo Suborbital', 'Pagada'],
      ['booking-4', 'Amanecer Orbital', 'Reembolsada'],
    ] as const) {
      await page.goto(`/reservas/${id}`);
      await expect(
        page.getByRole('heading', { level: 1, name: mission, exact: true }),
      ).toBeVisible();
      await expect(main(page)).toContainText(label);
    }
  });

  test('R6: shows the empty state', async ({ page }) => {
    await signIn(page);
    await mockBookings(page, () => ({ body: [] }));

    await page.goto('/reservas');

    await expect(page.getByText(EMPTY_TEXT)).toBeVisible();
    await expect(
      main(page).getByRole('link', { name: 'Ver lanzamientos', exact: true }),
    ).toHaveAttribute('href', '/lanzamientos');
    await expect(bookingArticles(page)).toHaveCount(0);
  });

  test('R7: retries after a server error', async ({ page }) => {
    await signIn(page);
    let apiFailing = true;
    await mockBookings(page, (request, attempt) =>
      apiFailing
        ? { status: 500, body: errorResponses.failedToRetrieveBookings }
        : defaultBookingsHandler(request, attempt),
    );

    await page.goto('/reservas');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(SERVER_TEXT);
    await expect(bookingArticles(page)).toHaveCount(0);

    apiFailing = false;
    await alert.getByRole('button', { name: 'Reintentar' }).click();

    await expect(bookingArticles(page)).toHaveCount(4);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('R7: shows the network error', async ({ page }) => {
    await signIn(page);
    await mockBookings(page, () => 'abort');

    await page.goto('/reservas');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(NETWORK_TEXT);
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('R7: shows the server error with retry in the detail', async ({ page }) => {
    await signIn(page);
    await mockBookings(page, () => ({
      status: 500,
      body: errorResponses.failedToRetrieveBooking,
    }));

    await page.goto('/reservas/booking-1');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(SERVER_TEXT);
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('R8: opens the detail from the list', async ({ page }) => {
    await signIn(page);
    let holdDetail = true;
    const { release, released } = holdResponses();
    const bookings = await mockBookings(page, async (request, attempt) => {
      if (bookingIdOf(request) !== null && holdDetail) {
        await released;
      }
      return defaultBookingsHandler(request, attempt);
    });
    await page.goto('/reservas');

    await bookingCard(page, 'Misión Luna').getByRole('link', { name: 'Misión Luna' }).click();

    await expect(page).toHaveURL(/\/reservas\/booking-1$/);
    await expect(page.getByRole('status').filter({ hasText: DETAIL_LOADING_TEXT })).toBeVisible();
    await expect
      .poll(() => bookings.requests.at(-1)?.url.pathname)
      .toBe('/bookings/booking-1');
    expect(bookings.requests.at(-1)?.authorization).toBe(BEARER);

    holdDetail = false;
    release();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Misión Luna', exact: true }),
    ).toBeVisible();
    await expect(page.getByText(DETAIL_LOADING_TEXT)).toHaveCount(0);
  });

  test('R9: shows the booking detail with the current launch status', async ({ page }) => {
    await signIn(page);
    await mockBookings(page, () => ({
      body: bookingWithActivity('booking-1', 'activity-1', 2, '2026-11-03T09:00:00.000Z', 'paid', {
        status: 'cancelled',
      }),
    }));

    await page.goto('/reservas/booking-1');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Misión Luna', exact: true }),
    ).toBeVisible();
    for (const text of [
      'Cohete: Falcon 9',
      'Cabo Cañaveral, Florida (EE. UU.)',
      'lunes, 15 de marzo de 2027, 14:30',
      '3 días',
      '249.999,00 € por plaza',
      '2 plazas',
      '499.998,00 €',
      'Reservada el 3 de noviembre de 2026',
      'Pagada',
      'Cancelado',
    ]) {
      await expect(main(page)).toContainText(text);
    }
    await expect(
      main(page).getByRole('link', { name: 'Ver lanzamiento', exact: true }),
    ).toHaveAttribute('href', '/lanzamientos/activity-1');
    await expect(
      main(page).getByRole('link', { name: 'Volver a mis reservas', exact: true }),
    ).toHaveAttribute('href', '/reservas');
  });

  test('R10: shows the not found message for booking-99', async ({ page }) => {
    await signIn(page);
    await mockBookings(page);

    await page.goto('/reservas/booking-99');

    await expect(page.getByText(NOT_FOUND_TEXT)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
    await expect(
      main(page).getByRole('link', { name: 'Volver a mis reservas', exact: true }),
    ).toHaveAttribute('href', '/reservas');
  });

  test('R11: goes to /acceso when the API rejects the token', async ({ page }) => {
    await signIn(page);
    await mockBookings(page, () => ({ status: 401, body: errorResponses.invalidToken }));

    await page.goto('/reservas');

    await expect(page).toHaveURL(/\/acceso\?volver=%2Freservas$/);
    await expect(page.getByText(SESSION_TEXT)).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
    await expect.poll(() => readStoredSession(page)).toBeNull();
  });

  test('R11: does not request bookings with an expired session', async ({ page }) => {
    await seedSession(page, sessionValue({ expiresAt: NOW.getTime() - 1 }));
    const bookings = await mockBookings(page);

    await page.goto('/reservas');

    await expect(page).toHaveURL(/\/acceso\?volver=%2Freservas$/);
    await expect(page.getByText(SESSION_TEXT)).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
    await expect.poll(() => readStoredSession(page)).toBeNull();
    expect(bookings.requests).toEqual([]);
  });
});
