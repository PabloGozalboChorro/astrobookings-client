import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_STORAGE_KEY } from '../../../../src/features/session/session-storage';
import { bookingDto, suborbitalBookingDto } from '../../support/bookings';
import { jsonResponse, mockFetchByUrl, requestedUrls } from '../../support/http';
import { currentLocation, renderApp, SESSION_TEXT, storeSession } from '../../support/session';

const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const CONTRACT_TEXT = 'El servidor ha devuelto una respuesta inesperada.';

const NO_BREAK_SPACE = String.fromCharCode(0xa0);
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);

function normalizeSpaces(text: string | null): string {
  return (text ?? '').replaceAll(NO_BREAK_SPACE, ' ').replaceAll(NARROW_NO_BREAK_SPACE, ' ');
}

function main() {
  return screen.getByRole('main');
}

function header() {
  return screen.getByRole('banner');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('my bookings edge cases', () => {
  it('R4: shows the total amount rounded to two decimals (99.99 x 3 = 299,97 €)', async () => {
    storeSession();
    mockFetchByUrl(() =>
      jsonResponse(200, [bookingDto({ participants: 3, activity: { price: 99.99 } })]),
    );

    renderApp('/reservas');

    const article = await screen.findByRole('article', { name: 'Misión Luna' });
    expect(normalizeSpaces(article.textContent)).toContain('299,97 €');
  });

  it('R4: keeps the API order for bookings created at the same time', async () => {
    storeSession();
    mockFetchByUrl(() =>
      jsonResponse(200, [
        bookingDto({ id: 'booking-1', createdAt: '2026-11-04T18:00:00.000Z' }),
        suborbitalBookingDto({ createdAt: '2026-11-04T18:00:00.000Z' }),
      ]),
    );

    renderApp('/reservas');

    await screen.findByRole('article', { name: 'Misión Luna' });
    const titles = within(main())
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(['Misión Luna', 'Vuelo Suborbital']);
  });

  it.each([
    ['an unknown paymentStatus', { paymentStatus: 'cancelled' }],
    ['an invalid createdAt', { createdAt: 'not-a-date' }],
  ])('R7: shows the contract error with retry for %s in the list', async (_case, overrides) => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(200, [bookingDto(overrides)]));

    renderApp('/reservas');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(CONTRACT_TEXT);
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(within(main()).queryByRole('article')).toBeNull();
  });

  it.each([
    ['draft', 'Borrador'],
    ['cancelled', 'Cancelado'],
    ['done', 'Realizado'],
  ])('R9: shows a booking whose launch is now %s in the list and the detail', async (status, label) => {
    storeSession();
    mockFetchByUrl((url) =>
      url.pathname === '/bookings'
        ? jsonResponse(200, [bookingDto({ activity: { status } })])
        : jsonResponse(200, bookingDto({ activity: { status } })),
    );

    renderApp('/reservas');
    expect(await screen.findByRole('article', { name: 'Misión Luna' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Misión Luna' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
    expect(main()).toHaveTextContent(`Estado del lanzamiento: ${label}`);
    expect(within(main()).getByRole('link', { name: 'Ver lanzamiento' })).toHaveAttribute(
      'href',
      '/lanzamientos/activity-1',
    );
  });

  it('R7: retries after a network error in the list', async () => {
    const user = userEvent.setup();
    storeSession();
    let networkDown = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (networkDown) {
        throw new TypeError('Failed to fetch');
      }
      return jsonResponse(200, [bookingDto()]);
    });

    renderApp('/reservas');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NETWORK_TEXT);
    networkDown = false;
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('article', { name: 'Misión Luna' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R7: retries after a network error in the detail', async () => {
    const user = userEvent.setup();
    storeSession();
    let networkDown = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (networkDown) {
        throw new TypeError('Failed to fetch');
      }
      return jsonResponse(200, bookingDto());
    });

    renderApp('/reservas/booking-1');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NETWORK_TEXT);
    networkDown = false;
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
  });

  it('R7: shows the contract error with retry for an unknown paymentStatus in the detail', async () => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(200, bookingDto({ paymentStatus: 'chargeback' })));

    renderApp('/reservas/booking-1');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(CONTRACT_TEXT);
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('R7: shows the server error in the detail for a 500 without a known message', async () => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(503, { message: 'Service Unavailable', errors: [] }));

    renderApp('/reservas/booking-1');

    expect(await screen.findByRole('alert')).toHaveTextContent(SERVER_TEXT);
  });

  it('R10: treats a 404 for another user booking as not found and makes a single request', async () => {
    storeSession();
    const fetchSpy = mockFetchByUrl(() =>
      jsonResponse(404, { message: 'Booking not found', errors: [] }),
    );

    renderApp('/reservas/booking-of-someone-else');

    expect(await screen.findByText('No encontramos esta reserva.')).toBeInTheDocument();
    expect(requestedUrls(fetchSpy)).toEqual([
      'http://localhost:3999/bookings/booking-of-someone-else',
    ]);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('R2: redirects /reservas without a session to /acceso?volver=%2Freservas without requesting', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderApp('/reservas');

    expect(currentLocation()).toBe('/acceso?volver=%2Freservas');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R11: does not request the detail with an expired session', () => {
    storeSession({ expiresAt: Date.now() - 1 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderApp('/reservas/booking-1');

    expect(currentLocation()).toBe('/acceso?volver=%2Freservas%2Fbooking-1');
    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_TEXT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R11: on 401 in the detail shows "Iniciar sesión" in the header', async () => {
    storeSession();
    mockFetchByUrl(() =>
      jsonResponse(401, { message: 'Invalid or expired token. Please login again.', errors: [] }),
    );

    renderApp('/reservas/booking-1');

    await waitFor(() => {
      expect(currentLocation()).toBe('/acceso?volver=%2Freservas%2Fbooking-1');
    });
    expect(within(header()).getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(within(header()).queryByRole('link', { name: 'Mis reservas' })).toBeNull();
  });

  it.each([false, true])(
    'F3: signing out from /reservas ends in /lanzamientos without session (strict mode: %s)',
    async (strict) => {
      const user = userEvent.setup();
      storeSession();
      mockFetchByUrl(() => jsonResponse(200, [bookingDto()]));
      renderApp('/reservas', { strict });
      expect(await screen.findByRole('article', { name: 'Misión Luna' })).toBeInTheDocument();

      await user.click(within(header()).getByRole('button', { name: 'Cerrar sesión' }));

      expect(currentLocation()).toBe('/lanzamientos');
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(within(header()).queryByRole('link', { name: 'Mis reservas' })).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('R3: in strict mode the list ends ready with every request carrying the token', async () => {
    const session = storeSession();
    const fetchSpy = mockFetchByUrl(() => jsonResponse(200, [bookingDto()]));

    renderApp('/reservas', { strict: true });

    expect(await screen.findByRole('article', { name: 'Misión Luna' })).toBeInTheDocument();
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
    for (const [input, init] of fetchSpy.mock.calls) {
      expect(String(input)).toBe('http://localhost:3999/bookings');
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        `Bearer ${session.accessToken}`,
      );
    }
  });
});
