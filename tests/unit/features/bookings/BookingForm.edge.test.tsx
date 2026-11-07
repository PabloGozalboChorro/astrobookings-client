import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activityDto, seedActivityDto, type ActivityDtoFixture } from '../../support/activities';
import { bookingDto, createdBookingDto } from '../../support/bookings';
import { deferred } from '../../support/deferred';
import { jsonResponse, mockFetchByUrl } from '../../support/http';
import { currentLocation, renderApp, storeSession } from '../../support/session';

const NOW = new Date('2026-11-05T10:00:00.000Z');
const INVALID_TEXT = 'Introduce un número entero de plazas mayor o igual que 1.';
const PAYMENT_TEXT = 'El pago no se ha podido procesar. La reserva no se ha realizado.';

const NO_BREAK_SPACE = String.fromCharCode(0xa0);
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);

function normalizeSpaces(text: string | null): string {
  return (text ?? '').replaceAll(NO_BREAK_SPACE, ' ').replaceAll(NARROW_NO_BREAK_SPACE, ' ');
}

type PostHandler = (body: unknown) => Response | Promise<Response>;

function mockApi(
  onPost: PostHandler,
  activity: (id: string) => ActivityDtoFixture = seedActivityDto,
) {
  return mockFetchByUrl((url, init) => {
    const activityMatch = /^\/activities\/(.+)$/.exec(url.pathname);
    if (activityMatch?.[1] !== undefined) {
      return jsonResponse(200, activity(decodeURIComponent(activityMatch[1])));
    }
    if (url.pathname === '/bookings' && init.method === 'POST') {
      return onPost(JSON.parse(String(init.body)));
    }
    const bookingMatch = /^\/bookings\/(.+)$/.exec(url.pathname);
    if (bookingMatch?.[1] !== undefined) {
      return jsonResponse(200, bookingDto({ id: decodeURIComponent(bookingMatch[1]) }));
    }
    throw new Error(`Unexpected request ${String(init.method)} ${url.href}`);
  });
}

function postRequests(fetchSpy: ReturnType<typeof mockApi>) {
  return fetchSpy.mock.calls.filter(([, init]) => init?.method === 'POST');
}

function postedBodies(fetchSpy: ReturnType<typeof mockApi>): unknown[] {
  return postRequests(fetchSpy).map(([, init]) => JSON.parse(String(init?.body)));
}

function apiError(status: number, message: string): Response {
  return jsonResponse(status, { message, errors: [] });
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

async function openForm(path = '/lanzamientos/activity-1', strict = false) {
  renderApp(path, { launchDetail: true, strict });
  return screen.findByLabelText('Número de plazas');
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BookingForm edge cases', () => {
  it('R3: updates the total on every keystroke, also above the max', async () => {
    const user = userEvent.setup();
    storeSession();
    mockApi(() => jsonResponse(201, createdBookingDto()));
    const input = await openForm();

    await typeSeats(user, input, '6');
    expect(totalText()).toBe('Importe total: 1.499.994,00 €');

    await typeSeats(user, input, '7');
    expect(totalText()).toBe('Importe total: 1.749.993,00 €');

    await typeSeats(user, input, '0');
    expect(totalText()).toBe('Importe total: —');

    await typeSeats(user, input, '-1');
    expect(totalText()).toBe('Importe total: —');
  });

  it('R3: rounds the total of a decimal price to cents', async () => {
    const user = userEvent.setup();
    storeSession();
    mockApi(
      () => jsonResponse(201, createdBookingDto()),
      (id) => activityDto({ id, price: 0.1 }),
    );
    const input = await openForm();

    await typeSeats(user, input, '3');

    expect(totalText()).toBe('Importe total: 0,30 €');
  });

  it('R4: rejects 0 and keeps the value without calling the API', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() => jsonResponse(201, createdBookingDto()));
    const input = await openForm();

    await typeSeats(user, input, '0');
    await user.keyboard('{Enter}');

    expect(input).toHaveAccessibleDescription(INVALID_TEXT);
    expect(input).toHaveValue(0);
    expect(postRequests(fetchSpy)).toHaveLength(0);
  });

  it('R4, R6: sends 6 for leading zeros "006" as a number', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() => jsonResponse(201, createdBookingDto({ participants: 6 })));
    const input = await openForm();

    await typeSeats(user, input, '006');
    await user.click(reserveButton());

    await waitFor(() => {
      expect(postRequests(fetchSpy)).toHaveLength(1);
    });
    expect(postedBodies(fetchSpy)).toEqual([{ activityId: 'activity-1', participants: 6 }]);
  });

  it('R5: sends exactly the max (6 seats)', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() => jsonResponse(201, createdBookingDto({ participants: 6 })));
    const input = await openForm();

    await typeSeats(user, input, '6');
    await user.click(reserveButton());

    await waitFor(() => {
      expect(currentLocation()).toBe('/reservas/booking-7');
    });
    expect(postedBodies(fetchSpy)).toEqual([{ activityId: 'activity-1', participants: 6 }]);
  });

  it('R5: replaces a previous R5 error by the R4 error on the next attempt', async () => {
    const user = userEvent.setup();
    storeSession();
    mockApi(() => jsonResponse(201, createdBookingDto()));
    const input = await openForm();

    await typeSeats(user, input, '7');
    await user.click(reserveButton());
    expect(input).toHaveAccessibleDescription('Puedes reservar como máximo 6 plazas.');

    await typeSeats(user, input, '');
    await user.click(reserveButton());
    expect(input).toHaveAccessibleDescription(INVALID_TEXT);
  });

  it('R7: sends a single request on double click inside StrictMode', async () => {
    const user = userEvent.setup();
    storeSession();
    const response = deferred<Response>();
    const fetchSpy = mockApi(() => response.promise);
    await openForm('/lanzamientos/activity-1', true);

    await user.dblClick(reserveButton());
    await user.keyboard('{Enter}');

    expect(reserveButton()).toBeDisabled();
    expect(reserveButton()).toHaveTextContent('Reservando…');
    expect(postRequests(fetchSpy)).toHaveLength(1);

    response.resolve(jsonResponse(201, createdBookingDto()));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Reserva confirmada' }),
    ).toBeInTheDocument();
    expect(postRequests(fetchSpy)).toHaveLength(1);
  });

  it('R7: sends a single request on click followed by Enter in the field', async () => {
    const user = userEvent.setup();
    storeSession();
    const response = deferred<Response>();
    const fetchSpy = mockApi(() => response.promise);
    const input = await openForm();

    await user.click(reserveButton());
    await user.click(input);
    await user.keyboard('{Enter}{Enter}');

    expect(postRequests(fetchSpy)).toHaveLength(1);

    response.resolve(apiError(402, 'Payment could not be processed'));
    expect(await screen.findByRole('alert')).toHaveTextContent(PAYMENT_TEXT);
    expect(postRequests(fetchSpy)).toHaveLength(1);
  });

  it('R10: "Available: 1" shows the singular and limits the field to 1', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() => apiError(400, 'Capacity exceeded. Available: 1, Requested: 3'));
    const input = await openForm();

    await typeSeats(user, input, '3');
    await user.click(reserveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo queda 1 plaza libre.');
    expect(input).toHaveAttribute('max', '1');

    await typeSeats(user, input, '2');
    await user.click(reserveButton());

    expect(input).toHaveAccessibleDescription('Puedes reservar como máximo 1 plaza.');
    expect(postRequests(fetchSpy)).toHaveLength(1);
  });

  it('R10: books exactly the known available seats after a capacity error', async () => {
    const user = userEvent.setup();
    storeSession();
    let attempt = 0;
    const fetchSpy = mockApi(() => {
      attempt += 1;
      return attempt === 1
        ? apiError(400, 'Capacity exceeded. Available: 2, Requested: 5')
        : jsonResponse(201, createdBookingDto({ participants: 2 }));
    });
    const input = await openForm();

    await typeSeats(user, input, '5');
    await user.click(reserveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo quedan 2 plazas libres.');

    await typeSeats(user, input, '2');
    await user.click(reserveButton());

    await waitFor(() => {
      expect(currentLocation()).toBe('/reservas/booking-7');
    });
    expect(postedBodies(fetchSpy)).toEqual([
      { activityId: 'activity-1', participants: 5 },
      { activityId: 'activity-1', participants: 2 },
    ]);
  });

  it('R10: with "Available: 0" a valid value and Enter send nothing and keep the alert', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockApi(() => apiError(400, 'Capacity exceeded. Available: 0, Requested: 2'));
    const input = await openForm();

    await typeSeats(user, input, '2');
    await user.click(reserveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No quedan plazas libres en este lanzamiento.',
    );

    await typeSeats(user, input, '1');
    await user.keyboard('{Enter}');

    expect(reserveButton()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No quedan plazas libres en este lanzamiento.',
    );
    expect(postRequests(fetchSpy)).toHaveLength(1);
  });

  it('R11: keeps the payment alert while the value changes until the next attempt', async () => {
    const user = userEvent.setup();
    storeSession();
    mockApi(() => apiError(402, 'Payment could not be processed'));
    const input = await openForm('/lanzamientos/activity-3');

    await typeSeats(user, input, '2');
    await user.click(reserveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(PAYMENT_TEXT);

    await typeSeats(user, input, '3');

    expect(screen.getByRole('alert')).toHaveTextContent(PAYMENT_TEXT);
    expect(input).toHaveValue(3);
    expect(input).toHaveAttribute('max', '6');
  });

  it('R12: clears the previous alert when a new attempt starts', async () => {
    const user = userEvent.setup();
    storeSession();
    const response = deferred<Response>();
    let attempt = 0;
    mockApi(() => {
      attempt += 1;
      return attempt === 1 ? apiError(404, 'Activity not found') : response.promise;
    });
    await openForm();

    await user.click(reserveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este lanzamiento no existe o ya no está disponible.',
    );

    await user.click(reserveButton());

    expect(screen.queryByRole('alert')).toBeNull();
    response.resolve(jsonResponse(201, createdBookingDto()));
    await waitFor(() => {
      expect(currentLocation()).toBe('/reservas/booking-7');
    });
  });

  it.each([
    ['activity-5', 'Este lanzamiento se ha cancelado'],
    ['activity-6', 'Este lanzamiento ya se ha realizado'],
    ['activity-9', 'La fecha de este lanzamiento ya ha pasado'],
  ])('R1: shows no form for %s with a session', async (id, reason) => {
    storeSession();
    mockApi(() => jsonResponse(201, createdBookingDto()));

    renderApp(`/lanzamientos/${id}`, { launchDetail: true });

    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Reservar plazas' })).toBeNull();
    expect(screen.queryByLabelText('Número de plazas')).toBeNull();
  });

  it('R1: shows no form for a draft launch with a session', async () => {
    storeSession();
    mockApi(
      () => jsonResponse(201, createdBookingDto()),
      (id) => activityDto({ id, status: 'draft' }),
    );

    renderApp('/lanzamientos/activity-7', { launchDetail: true });

    const main = screen.getByRole('main');
    expect(
      await within(main).findByText('Este lanzamiento no existe o ya no está disponible.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Número de plazas')).toBeNull();
  });
});
