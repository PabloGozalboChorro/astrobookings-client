/// <reference lib="dom" />
import { expect, test, type Page, type Request } from '@playwright/test';
import {
  API_URL,
  bookingIdOf,
  holdResponses,
  mockActivities,
  mockBookings,
  type BookingsMock,
  type MockApiResponse,
} from './fixtures/api-mock.ts';
import { bookingWithActivity, capacityExceeded, createdBookingDto } from './fixtures/data.ts';
import { seedSession, sessionValue } from './fixtures/session.ts';

const NOW = new Date('2026-11-05T10:00:00Z');
const INVALID_TEXT = 'Introduce un número entero de plazas mayor o igual que 1.';

test.use({ timezoneId: 'UTC', locale: 'es-ES' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

type PostHandler = (postAttempt: number) => MockApiResponse | Promise<MockApiResponse>;
type DetailHandler = (id: string) => MockApiResponse;

function confirmedBooking(id: string): MockApiResponse {
  return { body: bookingWithActivity(id, 'activity-1', 2, '2026-11-05T10:00:00.000Z', 'paid') };
}

function created(participants = 2): MockApiResponse {
  return { status: 201, body: createdBookingDto('booking-7', 'activity-1', participants) };
}

async function mockBookingApi(
  page: Page,
  onPost: PostHandler,
  onDetail: DetailHandler = confirmedBooking,
): Promise<BookingsMock> {
  let postAttempt = 0;
  return mockBookings(page, (request) => {
    if (request.method() === 'POST') {
      postAttempt += 1;
      return onPost(postAttempt);
    }
    const id = bookingIdOf(request);
    if (id === null) {
      return { body: [] };
    }
    return onDetail(id);
  });
}

// Counts the POST /bookings that really reached the (mocked) network and finished.
function countFinishedPosts(page: Page): () => number {
  let count = 0;
  page.on('requestfinished', (request: Request) => {
    if (request.method() === 'POST' && request.url() === `${API_URL}/bookings`) {
      count += 1;
    }
  });
  return () => count;
}

function region(page: Page) {
  return page.getByRole('region', { name: 'Reservar plazas' });
}

function seatsField(page: Page) {
  return page.getByLabel('Número de plazas');
}

function reserveButton(page: Page) {
  return region(page).getByRole('button', { name: /^(Reservar|Reservando…)$/ });
}

async function openSignedIn(page: Page, id = 'activity-1') {
  await seedSession(page, sessionValue());
  await mockActivities(page);
  await page.goto(`/lanzamientos/${id}`);
  await expect(seatsField(page)).toBeVisible();
}

async function typeSeats(page: Page, value: string) {
  const field = seatsField(page);
  await field.fill('');
  if (value !== '') {
    await field.pressSequentially(value);
  }
}

test.describe('booking creation edge cases', () => {
  test('R7: double click and Enter while submitting finish a single POST (StrictMode)', async ({
    page,
  }) => {
    const finishedPosts = countFinishedPosts(page);
    const hold = holdResponses();
    const bookings = await mockBookingApi(page, async () => {
      await hold.released;
      return created();
    });
    await openSignedIn(page);

    await typeSeats(page, '2');
    await reserveButton(page).dblclick();
    await seatsField(page).press('Enter');
    await seatsField(page).press('Enter');

    await expect(reserveButton(page)).toHaveText('Reservando…');
    await expect(reserveButton(page)).toBeDisabled();

    hold.release();

    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Reserva confirmada' })).toBeVisible();
    expect(finishedPosts()).toBe(1);
    expect(bookings.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
  });

  test('R7: double Enter in the field finishes a single POST', async ({ page }) => {
    const finishedPosts = countFinishedPosts(page);
    const hold = holdResponses();
    await mockBookingApi(page, async () => {
      await hold.released;
      return created(1);
    });
    await openSignedIn(page);

    await seatsField(page).press('Enter');
    await seatsField(page).press('Enter');
    await expect(reserveButton(page)).toBeDisabled();

    hold.release();

    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    expect(finishedPosts()).toBe(1);
  });

  for (const value of ['00', '-0', '2.5', '1e', ' ']) {
    test(`R4: rejects ${JSON.stringify(value)} without calling the API`, async ({ page }) => {
      const finishedPosts = countFinishedPosts(page);
      await mockBookingApi(page, () => created());
      await openSignedIn(page);

      await typeSeats(page, value);
      await reserveButton(page).click();

      await expect(seatsField(page)).toHaveAccessibleDescription(INVALID_TEXT);
      await expect(region(page).getByText(/^Importe total:/)).toHaveText('Importe total: —');
      expect(finishedPosts()).toBe(0);
    });
  }

  test('R4, R6: leading zeros are sent as an integer number', async ({ page }) => {
    const bookings = await mockBookingApi(page, () => created(3));
    await openSignedIn(page);

    await typeSeats(page, '003');
    await expect(region(page).getByText(/^Importe total:/)).toHaveText(
      'Importe total: 749.997,00 €',
    );
    await reserveButton(page).click();

    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    const post = bookings.requests.find((request) => request.method === 'POST');
    expect(post?.body).toEqual({ activityId: 'activity-1', participants: 3 });
  });

  test('R10: books exactly the free seats after a capacity error', async ({ page }) => {
    const bookings = await mockBookingApi(page, (postAttempt) =>
      postAttempt === 1 ? { status: 400, body: capacityExceeded(3, 5) } : created(3),
    );
    await openSignedIn(page);

    await typeSeats(page, '5');
    await reserveButton(page).click();
    await expect(region(page).getByRole('alert')).toHaveText('Solo quedan 3 plazas libres.');
    await expect(seatsField(page)).toHaveAttribute('max', '3');
    await expect(seatsField(page)).toHaveValue('5');

    await typeSeats(page, '3');
    await reserveButton(page).click();

    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    expect(
      bookings.requests.filter((request) => request.method === 'POST').map((post) => post.body),
    ).toEqual([
      { activityId: 'activity-1', participants: 5 },
      { activityId: 'activity-1', participants: 3 },
    ]);
  });

  test('R10: with no seats left Enter sends nothing and a reload restores the max (D2)', async ({
    page,
  }) => {
    const finishedPosts = countFinishedPosts(page);
    await mockBookingApi(page, () => ({ status: 400, body: capacityExceeded(0, 1) }));
    await openSignedIn(page);

    await reserveButton(page).click();
    await expect(region(page).getByRole('alert')).toHaveText(
      'No quedan plazas libres en este lanzamiento.',
    );
    await expect(reserveButton(page)).toBeDisabled();

    await seatsField(page).press('Enter');
    await expect(reserveButton(page)).toBeDisabled();
    expect(finishedPosts()).toBe(1);

    await page.reload();
    await expect(seatsField(page)).toHaveAttribute('max', '6');
    await expect(reserveButton(page)).toBeEnabled();
  });

  test('R8 (P12, P9): back returns to the launch and reload keeps the confirmation', async ({
    page,
  }) => {
    await mockBookingApi(page, () => created());
    await openSignedIn(page);

    await typeSeats(page, '2');
    await reserveButton(page).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Reserva confirmada' })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Reserva confirmada' })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/lanzamientos\/activity-1$/);
    await expect(seatsField(page)).toHaveValue('1');
  });

  test('R9: "Reintentar" loads the confirmation after a failed load', async ({ page }) => {
    let retried = false;
    await mockBookingApi(
      page,
      () => created(),
      (id) =>
        retried
          ? confirmedBooking(id)
          : { status: 500, body: { message: 'Failed to retrieve booking', errors: [] } },
    );
    await openSignedIn(page);

    await reserveButton(page).click();

    const alert = page.getByRole('main').getByRole('alert');
    await expect(alert).toContainText(
      'Tu reserva se ha creado correctamente (referencia booking-7), pero no hemos podido cargar sus datos.',
    );
    retried = true;
    await alert.getByRole('button', { name: 'Reintentar' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Reserva confirmada' })).toBeVisible();
  });

  test('R9: a network error loading the confirmation shows the reference', async ({ page }) => {
    await mockBookingApi(
      page,
      () => created(),
      () => 'abort' as const,
    );
    await openSignedIn(page);

    await reserveButton(page).click();

    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Tu reserva se ha creado correctamente (referencia booking-7)',
    );
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Ver mis reservas', exact: true }),
    ).toHaveAttribute('href', '/reservas');
  });

  for (const [id, reason] of [
    ['activity-4', 'Agotado: no quedan plazas'],
    ['activity-5', 'Este lanzamiento se ha cancelado'],
    ['activity-6', 'Este lanzamiento ya se ha realizado'],
    ['activity-9', 'La fecha de este lanzamiento ya ha pasado'],
  ] as const) {
    test(`R1: no form for ${id} with a session`, async ({ page }) => {
      await seedSession(page, sessionValue());
      await mockActivities(page);

      await page.goto(`/lanzamientos/${id}`);

      await expect(page.getByText(reason)).toBeVisible();
      await expect(region(page)).toHaveCount(0);
      await expect(seatsField(page)).toHaveCount(0);
    });
  }

  test('R1: no form for a draft launch with a session', async ({ page }) => {
    await seedSession(page, sessionValue());
    await mockActivities(page);

    await page.goto('/lanzamientos/activity-7');

    await expect(
      page.getByRole('main').getByText('Este lanzamiento no existe o ya no está disponible.'),
    ).toBeVisible();
    await expect(seatsField(page)).toHaveCount(0);
  });

  test('R2: "Crear cuenta" opens the sign-up page with volver', async ({ page }) => {
    await mockActivities(page);
    await page.goto('/lanzamientos/activity-1');

    await region(page).getByRole('link', { name: 'Crear cuenta' }).click();

    await expect(page).toHaveURL(/\/registro\?volver=%2Flanzamientos%2Factivity-1$/);
  });

  test('R1, R3, R10: the form fits a 375 px screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockBookingApi(page, () => ({ status: 400, body: capacityExceeded(2, 5) }));
    await openSignedIn(page);

    await typeSeats(page, '5');
    await reserveButton(page).click();
    await expect(region(page).getByRole('alert')).toHaveText('Solo quedan 2 plazas libres.');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    for (const locator of [seatsField(page), reserveButton(page), region(page).getByRole('alert')]) {
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
    }
  });
});
