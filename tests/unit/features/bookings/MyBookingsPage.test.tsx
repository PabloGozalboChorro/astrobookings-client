import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_STORAGE_KEY } from '../../../../src/features/session/session-storage';
import { bookingDto, suborbitalBookingDto, type BookingDtoFixture } from '../../support/bookings';
import { deferred } from '../../support/deferred';
import { jsonResponse, mockFetchByUrl } from '../../support/http';
import { currentLocation, renderApp, SESSION_TEXT, storeSession } from '../../support/session';

const LOADING_TEXT = 'Cargando tus reservas…';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const CONTRACT_TEXT = 'El servidor ha devuelto una respuesta inesperada.';

const NO_BREAK_SPACE = String.fromCharCode(0xa0);
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);

function normalizeSpaces(text: string | null): string {
  return (text ?? '').replaceAll(NO_BREAK_SPACE, ' ').replaceAll(NARROW_NO_BREAK_SPACE, ' ');
}

function bookingArticles(): HTMLElement[] {
  return within(screen.getByRole('main')).getAllByRole('article');
}

function mockBookingList(bookings: BookingDtoFixture[]) {
  return mockFetchByUrl(() => jsonResponse(200, bookings));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MyBookingsPage', () => {
  it('R3: shows "Cargando tus reservas…" while waiting and sends the token', async () => {
    const session = storeSession();
    const response = deferred<Response>();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise);

    renderApp('/reservas');

    expect(screen.getByRole('heading', { level: 1, name: 'Mis reservas' })).toBeInTheDocument();
    expect(screen.getByText(LOADING_TEXT)).toHaveAttribute('role', 'status');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [input, init] = fetchSpy.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(url.href).toBe('http://localhost:3999/bookings');
    expect(url.searchParams.has('activityId')).toBe(false);
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${session.accessToken}`);

    response.resolve(jsonResponse(200, []));

    expect(await screen.findByText('Todavía no tienes reservas.')).toBeInTheDocument();
    expect(screen.queryByText(LOADING_TEXT)).toBeNull();
  });

  it('R4: shows each booking from the most recent', async () => {
    storeSession();
    mockBookingList([bookingDto(), suborbitalBookingDto()]);

    renderApp('/reservas');

    await screen.findByRole('article', { name: 'Vuelo Suborbital' });
    const [first, second] = bookingArticles();
    if (first === undefined || second === undefined) {
      throw new Error('Expected two bookings');
    }
    expect(within(first).getByRole('heading', { level: 2 })).toHaveTextContent('Vuelo Suborbital');
    const firstText = normalizeSpaces(first.textContent);
    expect(firstText).toContain('Cohete: New Shepard');
    expect(firstText).toContain('miércoles, 10 de febrero de 2027, 16:00');
    expect(firstText).toContain('3 plazas');
    expect(firstText).toContain('37.500,00 €');
    expect(firstText).toContain('Reservada el 4 de noviembre de 2026');
    expect(firstText).toContain('Pagada');
    expect(within(first).getByText('miércoles, 10 de febrero de 2027, 16:00')).toHaveAttribute(
      'dateTime',
      '2027-02-10T16:00:00.000Z',
    );

    expect(within(second).getByRole('heading', { level: 2 })).toHaveTextContent('Misión Luna');
    const secondText = normalizeSpaces(second.textContent);
    expect(secondText).toContain('Cohete: Falcon 9');
    expect(secondText).toContain('2 plazas');
    expect(secondText).toContain('499.998,00 €');
    expect(secondText).toContain('Reservada el 3 de noviembre de 2026');
  });

  it('R4: shows "1 plaza" for a booking of one seat', async () => {
    storeSession();
    mockBookingList([bookingDto({ participants: 1 })]);

    renderApp('/reservas');

    const article = await screen.findByRole('article', { name: 'Misión Luna' });
    expect(within(article).getByText('1 plaza')).toBeInTheDocument();
    expect(normalizeSpaces(article.textContent)).toContain('249.999,00 €');
  });

  it('R4: shows the full name without rocket', async () => {
    storeSession();
    mockBookingList([bookingDto({ activityId: 'activity-8' })]);

    renderApp('/reservas');

    const article = await screen.findByRole('article', { name: 'Paseo Lunar Express' });
    expect(article).not.toHaveTextContent('Cohete:');
  });

  it('R5: shows pending, paid and refunded in the list', async () => {
    storeSession();
    mockBookingList([
      bookingDto({ id: 'booking-1', paymentStatus: 'pending' }),
      suborbitalBookingDto({ paymentStatus: 'paid' }),
      bookingDto({
        id: 'booking-4',
        activityId: 'activity-6',
        createdAt: '2026-11-01T08:00:00.000Z',
        paymentStatus: 'refunded',
      }),
    ]);

    renderApp('/reservas');

    expect(
      within(await screen.findByRole('article', { name: 'Misión Luna' })).getByText(
        'Pendiente de pago',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Vuelo Suborbital' })).getByText('Pagada'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Amanecer Orbital' })).getByText('Reembolsada'),
    ).toBeInTheDocument();
  });

  it('R6: shows the empty state with the link to /lanzamientos', async () => {
    storeSession();
    mockBookingList([]);

    renderApp('/reservas');

    expect(await screen.findByText('Todavía no tienes reservas.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Ver lanzamientos' }),
    ).toHaveAttribute('href', '/lanzamientos');
    expect(within(screen.getByRole('main')).queryByRole('article')).toBeNull();
  });

  it('R7: shows the server error and retries', async () => {
    const user = userEvent.setup();
    storeSession();
    let attempt = 0;
    const fetchSpy = mockFetchByUrl(() => {
      attempt += 1;
      return attempt === 1
        ? jsonResponse(500, { message: 'Failed to retrieve bookings', errors: [] })
        : jsonResponse(200, [bookingDto()]);
    });

    renderApp('/reservas');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(SERVER_TEXT);

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('article', { name: 'Misión Luna' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('R7: shows the network error with retry', async () => {
    storeSession();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    renderApp('/reservas');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NETWORK_TEXT);
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('R7: shows the contract error with retry', async () => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(200, [{ id: 1 }]));

    renderApp('/reservas');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(CONTRACT_TEXT);
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('R8: opens the booking detail from the list', async () => {
    const user = userEvent.setup();
    const session = storeSession();
    const detailResponse = deferred<Response>();
    const fetchSpy = mockFetchByUrl((url) =>
      url.pathname === '/bookings'
        ? jsonResponse(200, [bookingDto(), suborbitalBookingDto()])
        : detailResponse.promise,
    );

    renderApp('/reservas');
    const article = await screen.findByRole('article', { name: 'Misión Luna' });
    expect(within(article).getByRole('link', { name: 'Misión Luna' })).toHaveAttribute(
      'href',
      '/reservas/booking-1',
    );

    await user.click(within(article).getByRole('link', { name: 'Misión Luna' }));

    expect(currentLocation()).toBe('/reservas/booking-1');
    expect(screen.getByText('Cargando reserva…')).toHaveAttribute('role', 'status');
    const [input, init] = fetchSpy.mock.calls.at(-1) ?? [];
    expect(String(input)).toBe('http://localhost:3999/bookings/booking-1');
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${session.accessToken}`);

    detailResponse.resolve(jsonResponse(200, bookingDto()));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
  });

  it('R11: goes to /acceso with the notice on 401', async () => {
    storeSession();
    mockFetchByUrl(() =>
      jsonResponse(401, { message: 'Invalid or expired token. Please login again.', errors: [] }),
    );

    renderApp('/reservas');

    await waitFor(() => {
      expect(currentLocation()).toBe('/acceso?volver=%2Freservas');
    });
    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_TEXT);
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('R11: does not request bookings with an expired session', () => {
    storeSession({ expiresAt: Date.now() - 1 });
    const fetchSpy = mockBookingList([]);

    renderApp('/reservas');

    expect(currentLocation()).toBe('/acceso?volver=%2Freservas');
    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_TEXT);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
