/// <reference lib="dom" />
import { expect, test, type Page, type Request } from '@playwright/test';
import {
  bookingIdOf,
  holdResponses,
  mockActivities,
  mockBookings,
  mockLogin,
  type BookingsMock,
  type MockApiResponse,
} from './fixtures/api-mock.ts';
import {
  anaAuthResponse,
  bookingWithActivity,
  capacityExceeded,
  createdBookingDto,
  errorResponses,
} from './fixtures/data.ts';
import { ANA_TOKEN, readStoredSession, seedSession, sessionValue } from './fixtures/session.ts';

const NOW = new Date('2026-11-05T10:00:00Z');
const INVALID_TEXT = 'Introduce un número entero de plazas mayor o igual que 1.';
const PAYMENT_TEXT = 'El pago no se ha podido procesar. La reserva no se ha realizado.';
const NOT_FOUND_TEXT = 'Este lanzamiento no existe o ya no está disponible.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SESSION_TEXT = 'Tu sesión ha caducado o no es válida. Inicia sesión de nuevo.';
const ACCESS_TEXT = 'Inicia sesión o crea una cuenta para reservar.';
const LOGIN_RETURN_URL = /\/acceso\?volver=%2Flanzamientos%2Factivity-1$/;

test.use({ timezoneId: 'UTC', locale: 'es-ES' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

type PostHandler = (request: Request, postAttempt: number) => MockApiResponse | Promise<MockApiResponse>;
type DetailHandler = (id: string) => MockApiResponse | Promise<MockApiResponse>;

function confirmedBookingDto(id: string) {
  return bookingWithActivity(id, 'activity-1', 2, '2026-11-05T10:00:00.000Z', 'paid');
}

function confirmedBooking(id: string): MockApiResponse {
  return { body: confirmedBookingDto(id) };
}

function created(id = 'booking-7', activityId = 'activity-1', participants = 2): MockApiResponse {
  return { status: 201, body: createdBookingDto(id, activityId, participants) };
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
      return onPost(request, postAttempt);
    }
    const id = bookingIdOf(request);
    if (id === null) {
      return { body: [] };
    }
    return onDetail(id);
  });
}

function posts(bookings: BookingsMock) {
  return bookings.requests.filter((request) => request.method === 'POST');
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

function totalAmount(page: Page) {
  return region(page).getByText(/^Importe total:/);
}

function formAlert(page: Page) {
  return region(page).getByRole('alert');
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

test.describe('booking creation', () => {
  test('R1: shows the booking form on a bookable launch', async ({ page }) => {
    await mockBookingApi(page, () => created());
    await openSignedIn(page);

    await expect(seatsField(page)).toHaveValue('1');
    await expect(seatsField(page)).toHaveAttribute('min', '1');
    await expect(seatsField(page)).toHaveAttribute('step', '1');
    await expect(seatsField(page)).toHaveAttribute('max', '6');
    await expect(reserveButton(page)).toHaveText('Reservar');
    await expect(reserveButton(page)).toBeEnabled();
  });

  test('R1: shows no form on activity-4', async ({ page }) => {
    await seedSession(page, sessionValue());
    await mockActivities(page);

    await page.goto('/lanzamientos/activity-4');

    await expect(page.getByRole('heading', { level: 1, name: 'Estación Orbital' })).toBeVisible();
    await expect(page.getByText('Agotado: no quedan plazas')).toBeVisible();
    await expect(seatsField(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reservar' })).toHaveCount(0);
  });

  test('R2: asks to sign in and returns to the launch after signing in', async ({ page }) => {
    await mockActivities(page);
    await mockLogin(page, () => ({ body: anaAuthResponse(ANA_TOKEN) }));

    await page.goto('/lanzamientos/activity-1');

    await expect(region(page)).toContainText(ACCESS_TEXT);
    await expect(region(page).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/acceso?volver=%2Flanzamientos%2Factivity-1',
    );
    await expect(region(page).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/registro?volver=%2Flanzamientos%2Factivity-1',
    );
    await expect(seatsField(page)).toHaveCount(0);

    await region(page).getByRole('link', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(LOGIN_RETURN_URL);
    await page.getByLabel('Email').fill('ana@ejemplo.com');
    await page.getByLabel('Contraseña').fill('secreto1');
    await page.getByRole('main').getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL(/\/lanzamientos\/activity-1$/);
    await expect(seatsField(page)).toBeVisible();
  });

  test('F3: after signing out, the launch shows the links instead of the form', async ({ page }) => {
    await openSignedIn(page);

    await page.getByRole('banner').getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/lanzamientos$/);
    await page.goto('/lanzamientos/activity-1');

    await expect(region(page)).toContainText(ACCESS_TEXT);
    await expect(seatsField(page)).toHaveCount(0);
  });

  test('R3: updates the total amount', async ({ page }) => {
    await mockBookingApi(page, () => created());
    await openSignedIn(page);

    await typeSeats(page, '2');
    await expect(totalAmount(page)).toHaveText('Importe total: 499.998,00 €');

    await typeSeats(page, '1');
    await expect(totalAmount(page)).toHaveText('Importe total: 249.999,00 €');

    await typeSeats(page, '');
    await expect(totalAmount(page)).toHaveText('Importe total: —');

    await typeSeats(page, '1,5');
    await expect(totalAmount(page)).toHaveText('Importe total: —');
  });

  test('R4: rejects invalid numbers without calling the API', async ({ page }) => {
    const bookings = await mockBookingApi(page, () => created());
    await openSignedIn(page);

    for (const value of ['', '0', '-1', '1,5']) {
      await typeSeats(page, value);
      await reserveButton(page).click();

      await expect(seatsField(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(seatsField(page)).toHaveAccessibleDescription(INVALID_TEXT);
    }
    expect(posts(bookings)).toHaveLength(0);
  });

  test('R5: rejects more seats than the max', async ({ page }) => {
    const bookings = await mockBookingApi(page, () => created());
    await openSignedIn(page);

    await typeSeats(page, '7');
    await reserveButton(page).click();

    await expect(seatsField(page)).toHaveAccessibleDescription(
      'Puedes reservar como máximo 6 plazas.',
    );
    expect(posts(bookings)).toHaveLength(0);
  });

  test('R6: sends the booking with the token', async ({ page }) => {
    const bookings = await mockBookingApi(page, () => created());
    await openSignedIn(page);

    await typeSeats(page, '2');
    await reserveButton(page).click();

    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    expect(posts(bookings)).toHaveLength(1);
    const [post] = posts(bookings);
    expect(post?.url.pathname).toBe('/bookings');
    expect(post?.authorization).toBe(`Bearer ${ANA_TOKEN}`);
    expect(post?.body).toEqual({ activityId: 'activity-1', participants: 2 });
  });

  test('R7: sends a single booking on double click', async ({ page }) => {
    const hold = holdResponses();
    const bookings = await mockBookingApi(page, async () => {
      await hold.released;
      return created();
    });
    await openSignedIn(page);

    await reserveButton(page).dblclick();

    await expect(reserveButton(page)).toHaveText('Reservando…');
    await expect(reserveButton(page)).toBeDisabled();
    await expect.poll(() => posts(bookings).length).toBe(1);

    hold.release();

    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    expect(posts(bookings)).toHaveLength(1);
  });

  test('R8: shows the confirmation after booking', async ({ page }) => {
    await mockBookingApi(page, () => created());
    await openSignedIn(page);

    await typeSeats(page, '2');
    await reserveButton(page).click();

    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    const confirmation = page.getByRole('region', { name: 'Reserva confirmada' });
    await expect(
      confirmation.getByRole('heading', { level: 2, name: 'Reserva confirmada' }),
    ).toBeVisible();
    await expect(confirmation).toContainText('Falcon 9 · Misión Luna');
    await expect(confirmation).toContainText('2 plazas');
    await expect(confirmation.getByText(/^Importe total:/)).toHaveText(
      'Importe total: 499.998,00 €',
    );
    await expect(confirmation).toContainText('Pagada');
    await expect(
      confirmation.getByRole('link', { name: 'Ver mis reservas', exact: true }),
    ).toHaveAttribute('href', '/reservas');
  });

  test('R8: does not show the confirmation from my bookings', async ({ page }) => {
    await seedSession(page, sessionValue());
    await mockBookings(page, (request) => {
      const id = bookingIdOf(request);
      return id === null ? { body: [confirmedBookingDto('booking-7')] } : confirmedBooking(id);
    });

    await page.goto('/reservas');
    await page.getByRole('main').getByRole('link', { name: 'Misión Luna' }).click();

    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Tu reserva' })).toBeVisible();
    await expect(page.getByText('Reserva confirmada')).toHaveCount(0);
  });

  test('R9: shows the reference when the confirmation cannot load', async ({ page }) => {
    await mockBookingApi(
      page,
      () => created(),
      () => ({ status: 500, body: { message: 'Internal Server Error', errors: [] } }),
    );
    await openSignedIn(page);

    await reserveButton(page).click();

    await expect(page).toHaveURL(/\/reservas\/booking-7$/);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Tu reserva se ha creado correctamente (referencia booking-7), pero no hemos podido cargar sus datos.',
    );
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Ver mis reservas', exact: true }),
    ).toHaveAttribute('href', '/reservas');
  });

  test('R10: shows the free seats and limits the field', async ({ page }) => {
    const bookings = await mockBookingApi(page, () => ({
      status: 400,
      body: capacityExceeded(2, 5),
    }));
    await openSignedIn(page);

    await typeSeats(page, '5');
    await reserveButton(page).click();

    await expect(formAlert(page)).toHaveText('Solo quedan 2 plazas libres.');
    await expect(seatsField(page)).toHaveAttribute('max', '2');

    await typeSeats(page, '3');
    await reserveButton(page).click();

    await expect(seatsField(page)).toHaveAccessibleDescription(
      'Puedes reservar como máximo 2 plazas.',
    );
    expect(posts(bookings)).toHaveLength(1);
  });

  test('R10: disables booking with no seats left', async ({ page }) => {
    await mockBookingApi(page, () => ({ status: 400, body: capacityExceeded(0, 1) }));
    await openSignedIn(page);

    await reserveButton(page).click();

    await expect(formAlert(page)).toHaveText('No quedan plazas libres en este lanzamiento.');
    await expect(seatsField(page)).toHaveAttribute('max', '0');
    await expect(reserveButton(page)).toBeDisabled();
  });

  test('R10: shows the generic capacity text', async ({ page }) => {
    await mockBookingApi(page, () => ({
      status: 400,
      body: errorResponses.capacityExceededWithoutSeats,
    }));
    await openSignedIn(page);

    await reserveButton(page).click();

    await expect(formAlert(page)).toHaveText('No hay plazas suficientes para tu solicitud.');
    await expect(seatsField(page)).toHaveAttribute('max', '6');
    await expect(reserveButton(page)).toBeEnabled();
  });

  test('R11: shows the payment error on activity-3 and books 1 seat afterwards', async ({
    page,
  }) => {
    const bookings = await mockBookingApi(
      page,
      (_request, postAttempt) =>
        postAttempt === 1
          ? { status: 402, body: errorResponses.paymentFailed }
          : created('booking-8', 'activity-3', 1),
      (id) => ({
        body: bookingWithActivity(id, 'activity-3', 1, '2026-11-05T10:00:00.000Z', 'paid'),
      }),
    );
    await openSignedIn(page, 'activity-3');

    await typeSeats(page, '2');
    await reserveButton(page).click();

    await expect(formAlert(page)).toHaveText(PAYMENT_TEXT);
    await expect(page).toHaveURL(/\/lanzamientos\/activity-3$/);
    await expect(seatsField(page)).toHaveValue('2');
    await expect(reserveButton(page)).toBeEnabled();

    await typeSeats(page, '1');
    await reserveButton(page).click();

    await expect(page).toHaveURL(/\/reservas\/booking-8$/);
    await expect(page.getByRole('region', { name: 'Reserva confirmada' })).toContainText(
      'New Shepard · Vuelo Suborbital',
    );
    expect(posts(bookings).map((post) => post.body)).toEqual([
      { activityId: 'activity-3', participants: 2 },
      { activityId: 'activity-3', participants: 1 },
    ]);
  });

  const alertCases: { name: string; response: MockApiResponse; text: string }[] = [
    {
      name: 'not found',
      response: { status: 404, body: errorResponses.activityNotFound },
      text: NOT_FOUND_TEXT,
    },
    { name: 'a 500', response: { status: 500, body: { message: 'Internal Server Error', errors: [] } }, text: SERVER_TEXT },
    {
      name: 'a 400 Failed to create booking',
      response: { status: 400, body: errorResponses.failedToCreateBooking },
      text: SERVER_TEXT,
    },
    { name: 'a network error', response: 'abort', text: NETWORK_TEXT },
  ];

  for (const { name, response, text } of alertCases) {
    test(`R12: shows ${name} and enables "Reservar" again`, async ({ page }) => {
      await mockBookingApi(page, () => response);
      await openSignedIn(page);

      await typeSeats(page, '2');
      await reserveButton(page).click();

      await expect(formAlert(page)).toHaveText(text);
      await expect(reserveButton(page)).toBeEnabled();
      await expect(seatsField(page)).toHaveValue('2');
      await expect(page).toHaveURL(/\/lanzamientos\/activity-1$/);
    });
  }

  test('R12: shows the validation error next to the field', async ({ page }) => {
    await mockBookingApi(page, () => ({
      status: 400,
      body: errorResponses.bookingValidationFailed,
    }));
    await openSignedIn(page);

    await reserveButton(page).click();

    await expect(seatsField(page)).toHaveAccessibleDescription(INVALID_TEXT);
    await expect(seatsField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(reserveButton(page)).toBeEnabled();
  });

  test('R12 (F4): goes to /acceso when the API rejects the token', async ({ page }) => {
    await mockBookingApi(page, () => ({ status: 401, body: errorResponses.invalidToken }));
    await openSignedIn(page);

    await reserveButton(page).click();

    await expect(page).toHaveURL(LOGIN_RETURN_URL);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(SESSION_TEXT);
    expect(await readStoredSession(page)).toBeNull();
  });

  test('R12: does not send the booking with an expired session', async ({ page }) => {
    const bookings = await mockBookingApi(page, () => created());
    await seedSession(page, sessionValue({ expiresAt: NOW.getTime() + 60_000 }));
    await mockActivities(page);
    await page.goto('/lanzamientos/activity-1');
    await expect(seatsField(page)).toBeVisible();

    await page.clock.setFixedTime(NOW.getTime() + 120_000);
    await reserveButton(page).click();

    await expect(page).toHaveURL(LOGIN_RETURN_URL);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(SESSION_TEXT);
    expect(posts(bookings)).toHaveLength(0);
  });
});

test.describe('bookable launch rejected by the API', () => {
  test('R10 (bookable launch): shows why the launch cannot be booked', async ({ page }) => {
    await mockBookingApi(page, () => ({
      status: 400,
      body: errorResponses.activityNotBookableCancelled,
    }));
    await openSignedIn(page);

    await typeSeats(page, '1');
    await reserveButton(page).click();

    await expect(formAlert(page)).toHaveText(
      'Este lanzamiento se ha cancelado y no se puede reservar.',
    );
    await expect(formAlert(page)).not.toContainText('Activity is not bookable');
    await expect(reserveButton(page)).toBeEnabled();
    await expect(page).toHaveURL(/\/lanzamientos\/activity-1$/);
  });
});
