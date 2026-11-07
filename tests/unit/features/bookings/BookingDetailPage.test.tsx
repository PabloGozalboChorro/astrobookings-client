import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_STORAGE_KEY } from '../../../../src/features/session/session-storage';
import { seedActivityDto } from '../../support/activities';
import { bookingDto, createdBookingDto } from '../../support/bookings';
import { deferred } from '../../support/deferred';
import { jsonResponse, mockFetchByUrl } from '../../support/http';
import { currentLocation, renderApp, SESSION_TEXT, storeSession } from '../../support/session';

const LOADING_TEXT = 'Cargando reserva…';
const NOT_FOUND_TEXT = 'No encontramos esta reserva.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';

const NO_BREAK_SPACE = String.fromCharCode(0xa0);
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);

function normalizeSpaces(text: string | null): string {
  return (text ?? '').replaceAll(NO_BREAK_SPACE, ' ').replaceAll(NARROW_NO_BREAK_SPACE, ' ');
}

function main() {
  return screen.getByRole('main');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BookingDetailPage', () => {
  it('R8: shows "Cargando reserva…" while waiting and sends the token', async () => {
    const session = storeSession();
    const response = deferred<Response>();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise);

    renderApp('/reservas/booking-1');

    expect(screen.getByText(LOADING_TEXT)).toHaveAttribute('role', 'status');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [input, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(input)).toBe('http://localhost:3999/bookings/booking-1');
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${session.accessToken}`);

    response.resolve(jsonResponse(200, bookingDto()));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(LOADING_TEXT)).toBeNull();
  });

  it('R9: shows the booking and its launch', async () => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(200, bookingDto({ activity: { status: 'cancelled' } })));

    renderApp('/reservas/booking-1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
    const text = normalizeSpaces(main().textContent);
    for (const expected of [
      'Cohete: Falcon 9',
      'Cabo Cañaveral, Florida (EE. UU.)',
      'lunes, 15 de marzo de 2027, 14:30',
      '3 días',
      '249.999,00 € por plaza',
      '2 plazas',
      '499.998,00 €',
      'Reservada el 3 de noviembre de 2026',
      'Pagada',
      'Estado del lanzamiento: Cancelado',
    ]) {
      expect(text).toContain(expected);
    }
    expect(
      within(main()).getByRole('link', { name: 'Ver lanzamiento' }),
    ).toHaveAttribute('href', '/lanzamientos/activity-1');
    expect(
      within(main()).getByRole('link', { name: 'Volver a mis reservas' }),
    ).toHaveAttribute('href', '/reservas');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('R9: shows the full name without rocket', async () => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(200, bookingDto({ activityId: 'activity-8' })));

    renderApp('/reservas/booking-1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Paseo Lunar Express' }),
    ).toBeInTheDocument();
    expect(main()).not.toHaveTextContent('Cohete:');
  });

  it.each([
    ['pending', 'Pendiente de pago'],
    ['refunded', 'Reembolsada'],
  ])('R5: shows the payment status %s in the detail', async (paymentStatus, label) => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(200, bookingDto({ paymentStatus })));

    renderApp('/reservas/booking-1');

    expect(await within(main()).findByText(label)).toBeInTheDocument();
  });

  it('R10: shows "No encontramos esta reserva." without retry', async () => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(404, { message: 'Booking not found', errors: [] }));

    renderApp('/reservas/booking-99');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reserva no encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByText(NOT_FOUND_TEXT)).toBeInTheDocument();
    expect(
      within(main()).getByRole('link', { name: 'Volver a mis reservas' }),
    ).toHaveAttribute('href', '/reservas');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R7: shows the server error with retry in the detail', async () => {
    const user = userEvent.setup();
    storeSession();
    let attempt = 0;
    mockFetchByUrl(() => {
      attempt += 1;
      return attempt === 1
        ? jsonResponse(500, { message: 'Failed to retrieve booking', errors: [] })
        : jsonResponse(200, bookingDto());
    });

    renderApp('/reservas/booking-1');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(SERVER_TEXT);

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
  });

  it('R7: shows the network error with retry in the detail', async () => {
    storeSession();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    renderApp('/reservas/booking-1');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NETWORK_TEXT);
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('R11: goes to /acceso?volver=%2Freservas%2Fbooking-1 on 401', async () => {
    storeSession();
    mockFetchByUrl(() =>
      jsonResponse(401, { message: 'Invalid or expired token. Please login again.', errors: [] }),
    );

    renderApp('/reservas/booking-1');

    await waitFor(() => {
      expect(currentLocation()).toBe('/acceso?volver=%2Freservas%2Fbooking-1');
    });
    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_TEXT);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe('BookingDetailPage after creating a booking', () => {
  const CREATED_LOAD_ERROR_TEXT =
    'Tu reserva se ha creado correctamente (referencia booking-7), pero no hemos podido cargar sus datos.';

  function mockCreationApi(detail: () => Response) {
    return mockFetchByUrl((url, init) => {
      if (url.pathname === '/activities/activity-1') {
        return jsonResponse(200, seedActivityDto('activity-1'));
      }
      if (url.pathname === '/bookings' && init.method === 'POST') {
        return jsonResponse(201, createdBookingDto());
      }
      return detail();
    });
  }

  async function bookTwoSeats() {
    const user = userEvent.setup();
    renderApp('/lanzamientos/activity-1', { launchDetail: true });
    await screen.findByLabelText('Número de plazas');
    await user.click(screen.getByRole('button', { name: 'Reservar' }));
    return user;
  }

  it('R8: hides the confirmation without justCreated', async () => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(200, bookingDto({ id: 'booking-7' })));

    renderApp('/reservas/booking-7');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Tu reserva' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Reserva confirmada')).toBeNull();
    expect(within(main()).queryByRole('link', { name: 'Ver mis reservas' })).toBeNull();
  });

  it('R8: shows the confirmation right after the level 1 heading', async () => {
    storeSession();
    mockCreationApi(() => jsonResponse(200, bookingDto({ id: 'booking-7' })));

    await bookTwoSeats();

    const confirmation = await screen.findByRole('region', { name: 'Reserva confirmada' });
    const heading = screen.getByRole('heading', { level: 1, name: 'Misión Luna' });
    expect(heading.nextElementSibling).toBe(confirmation);
    expect(screen.queryByRole('heading', { name: 'Tu reserva' })).toBeNull();
  });

  it('R9: shows the created reference when the detail fails', async () => {
    storeSession();
    let attempt = 0;
    mockCreationApi(() => {
      attempt += 1;
      return attempt === 1
        ? jsonResponse(500, { message: 'Internal Server Error', errors: [] })
        : jsonResponse(200, bookingDto({ id: 'booking-7' }));
    });

    const user = await bookTwoSeats();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(CREATED_LOAD_ERROR_TEXT);
    expect(currentLocation()).toBe('/reservas/booking-7');
    expect(within(main()).getByRole('link', { name: 'Ver mis reservas' })).toHaveAttribute(
      'href',
      '/reservas',
    );

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('region', { name: 'Reserva confirmada' }),
    ).toBeInTheDocument();
  });

  it('R9: shows the created reference when the detail returns 404', async () => {
    storeSession();
    mockCreationApi(() => jsonResponse(404, { message: 'Booking not found', errors: [] }));

    await bookTwoSeats();

    expect(await screen.findByRole('alert')).toHaveTextContent(CREATED_LOAD_ERROR_TEXT);
    expect(screen.queryByText(NOT_FOUND_TEXT)).toBeNull();
  });
});
