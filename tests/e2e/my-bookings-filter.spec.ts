import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  bookingIdOf,
  mockBookings,
  trackFinishedRequests,
  type BookingsHandler,
} from './fixtures/api-mock.ts';
import {
  bookingWithActivity,
  errorResponses,
  filterBookingDtos,
  type BookingDtoFixture,
} from './fixtures/data.ts';
import { bookingCard } from './fixtures/locators.ts';
import { seedSession, sessionValue } from './fixtures/session.ts';

const NOW = new Date('2026-11-06T10:00:00Z');
const FILTER_NAME = 'Filtrar por lanzamiento';
const ALL_LAUNCHES = 'Todos los lanzamientos';
const LUNAR_LAUNCH = 'Falcon 9 · Misión Luna';
const SUBORBITAL_LAUNCH = 'New Shepard · Vuelo Suborbital';
const EMPTY_TEXT = 'Todavía no tienes reservas.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const BOOKINGS_URL = `${API_URL}/bookings`;

test.use({ timezoneId: 'UTC', locale: 'es-ES' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await seedSession(page, sessionValue());
});

// Like the fork: the list as given and 404 for a booking that is not in it.
function bookingsHandler(bookings: readonly BookingDtoFixture[]): BookingsHandler {
  return (request) => {
    const id = bookingIdOf(request);
    if (id === null) {
      return { body: bookings };
    }
    const booking = bookings.find((dto) => dto.id === id);
    return booking === undefined
      ? { status: 404, body: errorResponses.bookingNotFound }
      : { body: booking };
  };
}

function launchSelect(page: Page) {
  return page.getByRole('combobox', { name: FILTER_NAME });
}

function bookingArticles(page: Page) {
  return page.getByRole('main').getByRole('article');
}

test.describe('my bookings filter', () => {
  test('R1: lists the launches of my bookings in alphabetical order', async ({ page }) => {
    await mockBookings(page, bookingsHandler(filterBookingDtos));

    await page.goto('/reservas');

    await expect(bookingArticles(page)).toHaveCount(3);
    await expect(launchSelect(page).getByRole('option')).toHaveText([
      ALL_LAUNCHES,
      LUNAR_LAUNCH,
      SUBORBITAL_LAUNCH,
    ]);
    await expect(launchSelect(page)).toHaveValue('');
  });

  test('R2: filters by launch with a single request', async ({ page }) => {
    const finished = trackFinishedRequests(page, 'GET', BOOKINGS_URL);
    const bookings = await mockBookings(page, bookingsHandler(filterBookingDtos));

    await page.goto('/reservas');
    await expect(bookingArticles(page)).toHaveCount(3);
    await expect.poll(() => finished.length).toBe(1);
    const interceptedBefore = bookings.requests.length;

    await launchSelect(page).selectOption({ label: LUNAR_LAUNCH });

    await expect(page).toHaveURL('/reservas?lanzamiento=activity-1');
    await expect(bookingCard(page, 'Misión Luna')).toHaveCount(2);
    await expect(bookingCard(page, 'Vuelo Suborbital')).toHaveCount(0);
    expect(
      await bookingArticles(page)
        .getByRole('link')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    ).toEqual(['/reservas/booking-5', '/reservas/booking-1']);
    expect(finished).toEqual([BOOKINGS_URL]);
    expect(bookings.requests).toHaveLength(interceptedBefore);
    expect(bookings.requests.every((request) => !request.url.searchParams.has('activityId'))).toBe(
      true,
    );
  });

  test('R3: shows all bookings again', async ({ page }) => {
    await mockBookings(page, bookingsHandler(filterBookingDtos));

    await page.goto('/reservas?lanzamiento=activity-1');
    await expect(bookingArticles(page)).toHaveCount(2);

    await launchSelect(page).selectOption({ label: ALL_LAUNCHES });

    await expect(page).toHaveURL('/reservas');
    await expect(launchSelect(page)).toHaveValue('');
    await expect(bookingArticles(page)).toHaveCount(3);
  });

  test('R4: restores the filter on open, reload and back', async ({ page }) => {
    await mockBookings(page, bookingsHandler(filterBookingDtos));

    await page.goto('/reservas?lanzamiento=activity-3');

    await expect(launchSelect(page)).toHaveValue('activity-3');
    await expect(launchSelect(page).locator('option:checked')).toHaveText(SUBORBITAL_LAUNCH);
    await expect(bookingArticles(page)).toHaveCount(1);
    await expect(bookingCard(page, 'Vuelo Suborbital')).toBeVisible();

    await page.reload();

    await expect(launchSelect(page)).toHaveValue('activity-3');
    await expect(bookingArticles(page)).toHaveCount(1);

    await bookingCard(page, 'Vuelo Suborbital').getByRole('link', { name: 'Vuelo Suborbital' }).click();
    await expect(page).toHaveURL('/reservas/booking-2');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Vuelo Suborbital' }),
    ).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL('/reservas?lanzamiento=activity-3');
    await expect(launchSelect(page)).toHaveValue('activity-3');
    await expect(bookingArticles(page)).toHaveCount(1);
    await expect(bookingCard(page, 'Vuelo Suborbital')).toBeVisible();
  });

  test('R5: ignores an unknown launch', async ({ page }) => {
    await mockBookings(page, bookingsHandler(filterBookingDtos));

    await page.goto('/reservas?lanzamiento=activity-99');

    await expect(bookingArticles(page)).toHaveCount(3);
    await expect(launchSelect(page)).toHaveValue('');
    await expect(launchSelect(page).locator('option:checked')).toHaveText(ALL_LAUNCHES);
  });

  test('R6: hides the filter without bookings', async ({ page }) => {
    await mockBookings(page, bookingsHandler([]));

    await page.goto('/reservas');

    await expect(page.getByText(EMPTY_TEXT)).toBeVisible();
    await expect(launchSelect(page)).toHaveCount(0);
  });

  test('hides the filter when the bookings cannot load', async ({ page }) => {
    await mockBookings(page, () => ({
      status: 500,
      body: errorResponses.failedToRetrieveBookings,
    }));

    await page.goto('/reservas');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(SERVER_TEXT);
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(launchSelect(page)).toHaveCount(0);
  });

  test('uses the full name for a launch without separator', async ({ page }) => {
    await mockBookings(
      page,
      bookingsHandler([
        bookingWithActivity('booking-8', 'activity-8', 1, '2026-11-02T10:00:00.000Z', 'paid'),
      ]),
    );

    await page.goto('/reservas');

    await expect(launchSelect(page).getByRole('option')).toHaveText([
      ALL_LAUNCHES,
      'Paseo Lunar Express',
    ]);
  });
});

test.describe('my bookings filter edge cases (tester)', () => {
  for (const [search, count, value] of [
    ['?lanzamiento=', 3, ''],
    ['?lanzamiento=activity-3&lanzamiento=activity-1', 1, 'activity-3'],
    ['?lanzamiento=activity-99&lanzamiento=activity-3', 3, ''],
  ] as const) {
    test(`R4/R5: opening /reservas${search} shows ${count} bookings`, async ({ page }) => {
      await mockBookings(page, bookingsHandler(filterBookingDtos));

      await page.goto(`/reservas${search}`);

      await expect(bookingArticles(page)).toHaveCount(count);
      await expect(launchSelect(page)).toHaveValue(value);
    });
  }

  test('R2: choosing a launch replaces a repeated parameter', async ({ page }) => {
    await mockBookings(page, bookingsHandler(filterBookingDtos));

    await page.goto('/reservas?lanzamiento=activity-99&lanzamiento=activity-3');
    await expect(bookingArticles(page)).toHaveCount(3);

    await launchSelect(page).selectOption({ label: SUBORBITAL_LAUNCH });

    await expect(page).toHaveURL('/reservas?lanzamiento=activity-3');
    await expect(bookingArticles(page)).toHaveCount(1);
  });

  test('R1/R2: launches with the same name and different ids', async ({ page }) => {
    await mockBookings(
      page,
      bookingsHandler([
        bookingWithActivity('booking-1', 'activity-1', 2, '2026-11-03T09:00:00.000Z', 'paid'),
        bookingWithActivity('booking-6', 'activity-2', 1, '2026-11-04T09:00:00.000Z', 'paid', {
          name: LUNAR_LAUNCH,
        }),
      ]),
    );

    await page.goto('/reservas');

    const options = launchSelect(page).getByRole('option');
    await expect(options).toHaveText([ALL_LAUNCHES, LUNAR_LAUNCH, LUNAR_LAUNCH]);
    expect(
      await options.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('value'))),
    ).toEqual(['', 'activity-1', 'activity-2']);

    await launchSelect(page).selectOption('activity-2');

    await expect(page).toHaveURL('/reservas?lanzamiento=activity-2');
    await expect(bookingArticles(page)).toHaveCount(1);
    await expect(bookingArticles(page).getByRole('link')).toHaveAttribute(
      'href',
      '/reservas/booking-6',
    );
  });

  test('P5: the header "Mis reservas" link clears the filter without a new request', async ({
    page,
  }) => {
    const finished = trackFinishedRequests(page, 'GET', BOOKINGS_URL);
    const bookings = await mockBookings(page, bookingsHandler(filterBookingDtos));

    await page.goto('/reservas?lanzamiento=activity-3');
    await expect(bookingArticles(page)).toHaveCount(1);
    await expect.poll(() => finished.length).toBe(1);
    const interceptedBefore = bookings.requests.length;

    await page.getByRole('banner').getByRole('link', { name: 'Mis reservas' }).click();

    await expect(page).toHaveURL('/reservas');
    await expect(launchSelect(page)).toHaveValue('');
    await expect(bookingArticles(page)).toHaveCount(3);
    expect(bookings.requests).toHaveLength(interceptedBefore);
    expect(finished).toHaveLength(1);
  });

  test('keeps the URL filter after "Reintentar" and keeps filtering', async ({ page }) => {
    let failing = true;
    const bookings = await mockBookings(page, () =>
      failing
        ? { status: 500, body: errorResponses.failedToRetrieveBookings }
        : { body: filterBookingDtos },
    );

    await page.goto('/reservas?lanzamiento=activity-3');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(SERVER_TEXT);
    await expect(launchSelect(page)).toHaveCount(0);

    failing = false;
    await alert.getByRole('button', { name: 'Reintentar' }).click();

    await expect(launchSelect(page)).toHaveValue('activity-3');
    await expect(bookingArticles(page)).toHaveCount(1);
    await expect(page).toHaveURL('/reservas?lanzamiento=activity-3');

    await launchSelect(page).selectOption({ label: LUNAR_LAUNCH });
    await expect(page).toHaveURL('/reservas?lanzamiento=activity-1');
    await expect(bookingArticles(page)).toHaveCount(2);
    expect(bookings.requests.every((request) => !request.url.searchParams.has('activityId'))).toBe(
      true,
    );
  });

  test('the filter fits a 375 px wide window', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockBookings(page, bookingsHandler(filterBookingDtos));

    await page.goto('/reservas?lanzamiento=activity-1');
    await expect(bookingArticles(page)).toHaveCount(2);

    const select = launchSelect(page);
    await expect(select).toBeInViewport();
    const box = await select.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
    await expect(page.getByText(FILTER_NAME, { exact: true })).toBeVisible();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    await select.selectOption({ label: ALL_LAUNCHES });
    await expect(bookingArticles(page)).toHaveCount(3);
  });
});
