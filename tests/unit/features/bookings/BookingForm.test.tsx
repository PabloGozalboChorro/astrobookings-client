import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedActivityDto } from '../../support/activities';
import { bookingDto, createdBookingDto } from '../../support/bookings';
import { deferred } from '../../support/deferred';
import { jsonResponse, mockFetchByUrl } from '../../support/http';
import {
  currentLocation,
  renderApp,
  SESSION_TEXT,
  storedSessionValue,
  storeSession,
} from '../../support/session';

const NOW = new Date('2026-11-05T10:00:00.000Z');
const INVALID_TEXT = 'Introduce un número entero de plazas mayor o igual que 1.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const PAYMENT_TEXT = 'El pago no se ha podido procesar. La reserva no se ha realizado.';
const NOT_FOUND_TEXT = 'Este lanzamiento no existe o ya no está disponible.';
const LOGIN_RETURN_PATH = '/acceso?volver=%2Flanzamientos%2Factivity-1';

const NO_BREAK_SPACE = String.fromCharCode(0xa0);
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);

function normalizeSpaces(text: string | null): string {
  return (text ?? '').replaceAll(NO_BREAK_SPACE, ' ').replaceAll(NARROW_NO_BREAK_SPACE, ' ');
}

type PostHandler = (body: unknown) => Response | Promise<Response>;
type DetailHandler = (id: string) => Response | Promise<Response>;

function confirmedBookingResponse(id: string): Response {
  return jsonResponse(
    200,
    bookingDto({
      id,
      createdAt: '2026-11-05T10:00:00.000Z',
      paymentId: id.replace('booking', 'payment'),
    }),
  );
}

function mockApi(onPost: PostHandler, onDetail: DetailHandler = confirmedBookingResponse) {
  return mockFetchByUrl((url, init) => {
    const activityMatch = /^\/activities\/(.+)$/.exec(url.pathname);
    if (activityMatch?.[1] !== undefined) {
      return jsonResponse(200, seedActivityDto(decodeURIComponent(activityMatch[1])));
    }
    if (url.pathname === '/bookings' && init.method === 'POST') {
      return onPost(JSON.parse(String(init.body)));
    }
    const bookingMatch = /^\/bookings\/(.+)$/.exec(url.pathname);
    if (bookingMatch?.[1] !== undefined) {
      return onDetail(decodeURIComponent(bookingMatch[1]));
    }
    throw new Error(`Unexpected request ${String(init.method)} ${url.href}`);
  });
}

function postRequests(fetchSpy: ReturnType<typeof mockApi>) {
  return fetchSpy.mock.calls.filter(([, init]) => init?.method === 'POST');
}

function apiError(status: number, message: string, errors: unknown[] = []): Response {
  return jsonResponse(status, { message, errors });
}

async function openForm(path = '/lanzamientos/activity-1') {
  renderApp(path, { launchDetail: true });
  return screen.findByLabelText('Número de plazas');
}

function reserveButton() {
  return screen.getByRole('button', { name: /^(Reservar|Reservando…)$/ });
}

function totalText(): string {
  return normalizeSpaces(screen.getByText(/^Importe total:/).textContent);
}

async function typeSeats(user: UserEvent, input: HTMLElement, value: string) {
  await user.clear(input);
  if (value !== '') {
    await user.type(input, value);
  }
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BookingForm', () => {
  it('R1: shows the booking form for a bookable launch with a session', async () => {
    storeSession();
    mockApi(() => jsonResponse(201, createdBookingDto()));

    const input = await openForm();

    expect(input).toHaveValue(1);
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('step', '1');
    expect(input).toHaveAttribute('max', '6');
    expect(reserveButton()).toHaveTextContent('Reservar');
    expect(reserveButton()).toBeEnabled();
    const region = screen.getByRole('region', { name: 'Reservar plazas' });
    expect(region).toContainElement(input);
  });

  it('R3: shows the live total amount', async () => {
    const user = userEvent.setup();
    storeSession();
    mockApi(() => jsonResponse(201, createdBookingDto()));
    const input = await openForm();

    expect(totalText()).toBe('Importe total: 249.999,00 €');

    await typeSeats(user, input, '2');
    expect(totalText()).toBe('Importe total: 499.998,00 €');

    await typeSeats(user, input, '1');
    expect(totalText()).toBe('Importe total: 249.999,00 €');

    await typeSeats(user, input, '');
    expect(totalText()).toBe('Importe total: —');

    await typeSeats(user, input, '1.5');
    expect(totalText()).toBe('Importe total: —');
  });

  it.each(['', '0', '-1', '1.5'])('R4: rejects %j without calling the API', async (value) => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() => jsonResponse(201, createdBookingDto()));
    const input = await openForm();

    await typeSeats(user, input, value);
    await user.click(reserveButton());

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(INVALID_TEXT);
    expect(postRequests(fetchSpy)).toHaveLength(0);
  });

  it('R5: rejects 7 seats with max 6 without calling the API', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() => jsonResponse(201, createdBookingDto()));
    const input = await openForm();

    await typeSeats(user, input, '7');
    await user.click(reserveButton());

    expect(input).toHaveAccessibleDescription('Puedes reservar como máximo 6 plazas.');
    expect(postRequests(fetchSpy)).toHaveLength(0);
  });

  it('R6: sends the booking with the session token', async () => {
    const user = userEvent.setup();
    const session = storeSession();
    const fetchSpy = mockApi(() => jsonResponse(201, createdBookingDto()));
    const input = await openForm();

    await typeSeats(user, input, '2');
    await user.click(reserveButton());

    await waitFor(() => {
      expect(postRequests(fetchSpy)).toHaveLength(1);
    });
    const [input0, init] = postRequests(fetchSpy)[0] ?? [];
    expect(String(input0)).toBe('http://localhost:3999/bookings');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      `Bearer ${session.accessToken}`,
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      activityId: 'activity-1',
      participants: 2,
    });
  });

  it('R7: sends a single request on double click and shows "Reservando…"', async () => {
    const user = userEvent.setup();
    storeSession();
    const response = deferred<Response>();
    const fetchSpy = mockApi(() => response.promise);
    await openForm();

    await user.dblClick(reserveButton());

    expect(reserveButton()).toHaveTextContent('Reservando…');
    expect(reserveButton()).toBeDisabled();
    expect(postRequests(fetchSpy)).toHaveLength(1);

    response.resolve(apiError(402, 'Payment could not be processed'));

    expect(await screen.findByRole('alert')).toHaveTextContent(PAYMENT_TEXT);
    expect(reserveButton()).toHaveTextContent('Reservar');
    expect(reserveButton()).toBeEnabled();
    expect(postRequests(fetchSpy)).toHaveLength(1);
  });

  it('R7: sends a single request on double Enter', async () => {
    const user = userEvent.setup();
    storeSession();
    const response = deferred<Response>();
    const fetchSpy = mockApi(() => response.promise);
    const input = await openForm();

    await user.click(input);
    await user.keyboard('{Enter}{Enter}');

    expect(reserveButton()).toHaveTextContent('Reservando…');
    expect(postRequests(fetchSpy)).toHaveLength(1);

    response.resolve(apiError(402, 'Payment could not be processed'));

    expect(await screen.findByRole('alert')).toHaveTextContent(PAYMENT_TEXT);
    expect(postRequests(fetchSpy)).toHaveLength(1);
  });

  it('R8: goes to /reservas/booking-7 and shows the confirmation', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() => jsonResponse(201, createdBookingDto()));
    const input = await openForm();

    await typeSeats(user, input, '2');
    await user.click(reserveButton());

    const confirmation = await screen.findByRole('region', { name: 'Reserva confirmada' });
    expect(currentLocation()).toBe('/reservas/booking-7');
    const text = normalizeSpaces(confirmation.textContent);
    for (const expected of [
      'Falcon 9 · Misión Luna',
      '2 plazas',
      'Importe total: 499.998,00 €',
      'Pagada',
    ]) {
      expect(text).toContain(expected);
    }
    expect(within(confirmation).getByRole('link', { name: 'Ver mis reservas' })).toHaveAttribute(
      'href',
      '/reservas',
    );
    expect(
      fetchSpy.mock.calls.some(
        ([url]) => String(url) === 'http://localhost:3999/bookings/booking-7',
      ),
    ).toBe(true);
  });

  it('R10: shows the free seats and lowers the max', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() =>
      apiError(400, 'Capacity exceeded. Available: 2, Requested: 5'),
    );
    const input = await openForm();

    await typeSeats(user, input, '5');
    await user.click(reserveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo quedan 2 plazas libres.');
    expect(input).toHaveAttribute('max', '2');
    expect(input).toHaveValue(5);

    await typeSeats(user, input, '3');
    await user.click(reserveButton());

    expect(input).toHaveAccessibleDescription('Puedes reservar como máximo 2 plazas.');
    expect(postRequests(fetchSpy)).toHaveLength(1);
  });

  it('R10: disables "Reservar" with no seats left', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() =>
      apiError(400, 'Capacity exceeded. Available: 0, Requested: 1'),
    );
    const input = await openForm();

    await user.click(reserveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No quedan plazas libres en este lanzamiento.',
    );
    expect(input).toHaveAttribute('max', '0');
    expect(reserveButton()).toBeDisabled();

    await user.click(input);
    await user.keyboard('{Enter}');

    expect(postRequests(fetchSpy)).toHaveLength(1);
  });

  it('R10: keeps max 6 with an unexpected capacity text', async () => {
    const user = userEvent.setup();
    storeSession();
    mockApi(() => apiError(400, 'Capacity exceeded'));
    const input = await openForm();

    await user.click(reserveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hay plazas suficientes para tu solicitud.',
    );
    expect(input).toHaveAttribute('max', '6');
    expect(reserveButton()).toBeEnabled();
  });

  it('R10: keeps the known max after a later error', async () => {
    const user = userEvent.setup();
    storeSession();
    let attempt = 0;
    mockApi(() => {
      attempt += 1;
      return attempt === 1
        ? apiError(400, 'Capacity exceeded. Available: 2, Requested: 5')
        : apiError(402, 'Payment could not be processed');
    });
    const input = await openForm();

    await typeSeats(user, input, '5');
    await user.click(reserveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo quedan 2 plazas libres.');

    await typeSeats(user, input, '2');
    await user.click(reserveButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(PAYMENT_TEXT);
    });
    expect(input).toHaveAttribute('max', '2');
  });

  it('R11: shows the payment error and keeps the form', async () => {
    const user = userEvent.setup();
    storeSession();
    mockApi((body) =>
      JSON.stringify(body) === JSON.stringify({ activityId: 'activity-3', participants: 2 })
        ? apiError(402, 'Payment could not be processed')
        : jsonResponse(
            201,
            createdBookingDto({ id: 'booking-8', activityId: 'activity-3', participants: 1 }),
          ),
    );
    const input = await openForm('/lanzamientos/activity-3');

    await typeSeats(user, input, '2');
    await user.click(reserveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(PAYMENT_TEXT);
    expect(currentLocation()).toBe('/lanzamientos/activity-3');
    expect(input).toHaveValue(2);
    expect(reserveButton()).toBeEnabled();

    await typeSeats(user, input, '1');
    await user.click(reserveButton());

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Reserva confirmada' }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe('/reservas/booking-8');
  });

  it.each<[string, () => Response | Promise<Response>, string]>([
    ['the not found text for a 404', () => apiError(404, 'Activity not found'), NOT_FOUND_TEXT],
    [
      'the server text for a 500',
      () => apiError(500, 'Internal Server Error'),
      SERVER_TEXT,
    ],
    [
      'the server text for a 400 Failed to create booking',
      () => apiError(400, 'Failed to create booking'),
      SERVER_TEXT,
    ],
    [
      'the network text when the connection fails',
      () => Promise.reject(new TypeError('Failed to fetch')),
      NETWORK_TEXT,
    ],
  ])('R12: shows %s and enables "Reservar" again', async (_label, response, expected) => {
    const user = userEvent.setup();
    storeSession();
    mockApi(response);
    const input = await openForm();

    await typeSeats(user, input, '2');
    await user.click(reserveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(reserveButton()).toBeEnabled();
    expect(input).toHaveValue(2);
    expect(currentLocation()).toBe('/lanzamientos/activity-1');
  });

  it('R12: shows the validation error of the API next to the field', async () => {
    const user = userEvent.setup();
    storeSession();
    mockApi(() =>
      apiError(400, 'Validation failed', [
        {
          field: 'participants',
          message: 'Participants is required and must be a positive number (at least 1)',
        },
      ]),
    );
    const input = await openForm();

    await user.click(reserveButton());

    await waitFor(() => {
      expect(input).toHaveAccessibleDescription(INVALID_TEXT);
    });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(reserveButton()).toBeEnabled();
  });

  it('R12: goes to /acceso with the notice on 401', async () => {
    const user = userEvent.setup();
    storeSession();
    mockApi(() => apiError(401, 'Invalid or expired token. Please login again.'));
    await openForm();

    await user.click(reserveButton());

    await waitFor(() => {
      expect(currentLocation()).toBe(LOGIN_RETURN_PATH);
    });
    expect(within(screen.getByRole('main')).getByRole('alert')).toHaveTextContent(SESSION_TEXT);
    expect(storedSessionValue()).toBeNull();
  });

  it('R12: does not send the booking with an expired session', async () => {
    const user = userEvent.setup();
    storeSession({ expiresAt: NOW.getTime() + 60_000 });
    const fetchSpy = mockApi(() => jsonResponse(201, createdBookingDto()));
    await openForm();

    vi.setSystemTime(NOW.getTime() + 120_000);
    await user.click(reserveButton());

    await waitFor(() => {
      expect(currentLocation()).toBe(LOGIN_RETURN_PATH);
    });
    expect(within(screen.getByRole('main')).getByRole('alert')).toHaveTextContent(SESSION_TEXT);
    expect(postRequests(fetchSpy)).toHaveLength(0);
    expect(storedSessionValue()).toBeNull();
  });
});
