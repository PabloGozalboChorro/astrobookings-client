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

const FILTER_NAME = 'Filtrar por lanzamiento';

function filterBookingList(): BookingDtoFixture[] {
  return [
    bookingDto(),
    bookingDto({ id: 'booking-5', participants: 1, createdAt: '2026-11-05T12:00:00.000Z' }),
    suborbitalBookingDto(),
  ];
}

function launchSelect(): HTMLElement {
  return screen.getByRole('combobox', { name: FILTER_NAME });
}

function launchOptionTexts(): string[] {
  return within(launchSelect())
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

function articleLinks(): (string | null)[] {
  return bookingArticles().map(
    (article) => within(article).getByRole('link').getAttribute('href'),
  );
}

describe('MyBookingsPage launch filter', () => {
  it('R1: shows the filter with the launches of the bookings', async () => {
    storeSession();
    mockBookingList(filterBookingList());

    renderApp('/reservas');

    await screen.findByRole('article', { name: 'Vuelo Suborbital' });
    expect(launchOptionTexts()).toEqual([
      'Todos los lanzamientos',
      'Falcon 9 · Misión Luna',
      'New Shepard · Vuelo Suborbital',
    ]);
    expect(launchSelect()).toHaveValue('');
    expect(bookingArticles()).toHaveLength(3);
  });

  it('R1: shows the filter with a single booking', async () => {
    storeSession();
    mockBookingList([bookingDto({ activityId: 'activity-8' })]);

    renderApp('/reservas');

    await screen.findByRole('article', { name: 'Paseo Lunar Express' });
    expect(launchOptionTexts()).toEqual(['Todos los lanzamientos', 'Paseo Lunar Express']);
  });

  it('R2: filters by launch without a new request', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockBookingList(filterBookingList());

    renderApp('/reservas');
    await screen.findByRole('article', { name: 'Vuelo Suborbital' });

    await user.selectOptions(launchSelect(), 'Falcon 9 · Misión Luna');

    expect(currentLocation()).toBe('/reservas?lanzamiento=activity-1');
    expect(launchSelect()).toHaveValue('activity-1');
    expect(screen.getAllByRole('article', { name: 'Misión Luna' })).toHaveLength(2);
    expect(screen.queryByRole('article', { name: 'Vuelo Suborbital' })).toBeNull();
    expect(articleLinks()).toEqual(['/reservas/booking-5', '/reservas/booking-1']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('R3: shows all bookings again and removes the parameter', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockBookingList(filterBookingList());

    renderApp('/reservas?lanzamiento=activity-1');
    await screen.findAllByRole('article', { name: 'Misión Luna' });
    expect(bookingArticles()).toHaveLength(2);

    await user.selectOptions(launchSelect(), 'Todos los lanzamientos');

    expect(currentLocation()).toBe('/reservas');
    expect(launchSelect()).toHaveValue('');
    expect(bookingArticles()).toHaveLength(3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('R4: applies the filter from the URL', async () => {
    storeSession();
    mockBookingList(filterBookingList());

    renderApp('/reservas?lanzamiento=activity-3');

    await screen.findByRole('article', { name: 'Vuelo Suborbital' });
    expect(launchSelect()).toHaveValue('activity-3');
    expect(
      screen.getByRole('option', { name: 'New Shepard · Vuelo Suborbital' }),
    ).toHaveProperty('selected', true);
    expect(bookingArticles()).toHaveLength(1);
  });

  it('R5: ignores an unknown launch in the URL', async () => {
    storeSession();
    mockBookingList(filterBookingList());

    renderApp('/reservas?lanzamiento=activity-99');

    await screen.findByRole('article', { name: 'Vuelo Suborbital' });
    expect(launchSelect()).toHaveValue('');
    expect(bookingArticles()).toHaveLength(3);
    expect(currentLocation()).toBe('/reservas?lanzamiento=activity-99');
  });

  it('R6: hides the filter without bookings', async () => {
    storeSession();
    mockBookingList([]);

    renderApp('/reservas');

    expect(await screen.findByText('Todavía no tienes reservas.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: FILTER_NAME })).toBeNull();
  });

  it('hides the filter while loading and on error, and keeps the URL filter after retry', async () => {
    const user = userEvent.setup();
    storeSession();
    const firstResponse = deferred<Response>();
    let attempt = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      attempt += 1;
      return attempt === 1
        ? firstResponse.promise
        : Promise.resolve(jsonResponse(200, filterBookingList()));
    });

    renderApp('/reservas?lanzamiento=activity-1');

    expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: FILTER_NAME })).toBeNull();

    firstResponse.resolve(
      jsonResponse(500, { message: 'Failed to retrieve bookings', errors: [] }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(SERVER_TEXT);
    expect(screen.queryByRole('combobox', { name: FILTER_NAME })).toBeNull();

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    await screen.findAllByRole('article', { name: 'Misión Luna' });
    expect(launchSelect()).toHaveValue('activity-1');
    expect(bookingArticles()).toHaveLength(2);
    expect(currentLocation()).toBe('/reservas?lanzamiento=activity-1');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not send activityId', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockBookingList(filterBookingList());

    renderApp('/reservas?lanzamiento=activity-3');
    await screen.findByRole('article', { name: 'Vuelo Suborbital' });
    await user.selectOptions(launchSelect(), 'Falcon 9 · Misión Luna');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [input] = fetchSpy.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(url.href).toBe('http://localhost:3999/bookings');
    expect(url.searchParams.has('activityId')).toBe(false);
  });
});

describe('MyBookingsPage launch filter edge cases (tester)', () => {
  it.each([
    ['/reservas?lanzamiento=', 3, ''],
    ['/reservas?lanzamiento=ACTIVITY-1', 3, ''],
    ['/reservas?lanzamiento=activity-3&lanzamiento=activity-1', 1, 'activity-3'],
  ])('R4/R5: opening %s shows %i bookings', async (path, count, value) => {
    storeSession();
    mockBookingList(filterBookingList());

    renderApp(path);

    await screen.findByRole('article', { name: 'Vuelo Suborbital' });
    expect(launchSelect()).toHaveValue(value);
    expect(bookingArticles()).toHaveLength(count);
    expect(currentLocation()).toBe(path);
  });

  it('R2: replaces a repeated parameter with the chosen launch', async () => {
    const user = userEvent.setup();
    storeSession();
    mockBookingList(filterBookingList());

    renderApp('/reservas?lanzamiento=activity-99&lanzamiento=activity-3');
    await screen.findByRole('article', { name: 'Vuelo Suborbital' });
    expect(bookingArticles()).toHaveLength(3);

    await user.selectOptions(launchSelect(), 'Falcon 9 · Misión Luna');

    expect(currentLocation()).toBe('/reservas?lanzamiento=activity-1');
    expect(bookingArticles()).toHaveLength(2);
  });

  it('R1/R2: launches with the same name and different ids are separate options', async () => {
    const user = userEvent.setup();
    storeSession();
    mockBookingList([
      bookingDto({
        id: 'booking-1',
        activityId: 'activity-2',
        activity: { name: 'Falcon 9 · Misión Luna' },
      }),
      bookingDto({ id: 'booking-5', createdAt: '2026-11-05T12:00:00.000Z' }),
    ]);

    renderApp('/reservas');
    await screen.findAllByRole('article', { name: 'Misión Luna' });

    const options = within(launchSelect()).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Todos los lanzamientos',
      'Falcon 9 · Misión Luna',
      'Falcon 9 · Misión Luna',
    ]);
    expect(options.map((option) => option.getAttribute('value'))).toEqual([
      '',
      'activity-1',
      'activity-2',
    ]);

    await user.selectOptions(launchSelect(), 'activity-2');

    expect(currentLocation()).toBe('/reservas?lanzamiento=activity-2');
    expect(articleLinks()).toEqual(['/reservas/booking-1']);
  });

  it('R1: the select is labelled "Filtrar por lanzamiento"', async () => {
    storeSession();
    mockBookingList(filterBookingList());

    renderApp('/reservas');

    const select = await screen.findByLabelText(FILTER_NAME);
    expect(select.tagName).toBe('SELECT');
    const label = screen.getByText(FILTER_NAME);
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', select.id);
  });

  it('P5: the header "Mis reservas" link clears the filter without a new request', async () => {
    const user = userEvent.setup();
    storeSession();
    const fetchSpy = mockBookingList(filterBookingList());

    renderApp('/reservas?lanzamiento=activity-3');
    await screen.findByRole('article', { name: 'Vuelo Suborbital' });
    expect(bookingArticles()).toHaveLength(1);

    await user.click(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Mis reservas' }),
    );

    expect(currentLocation()).toBe('/reservas');
    expect(launchSelect()).toHaveValue('');
    expect(bookingArticles()).toHaveLength(3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('R4: keeps the filter when filtering after a network error and retry', async () => {
    const user = userEvent.setup();
    storeSession();
    let attempt = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(jsonResponse(200, filterBookingList()));
    });

    renderApp('/reservas?lanzamiento=activity-3');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NETWORK_TEXT);
    expect(screen.queryByRole('combobox', { name: FILTER_NAME })).toBeNull();
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    await screen.findByRole('article', { name: 'Vuelo Suborbital' });
    expect(bookingArticles()).toHaveLength(1);

    await user.selectOptions(launchSelect(), 'Falcon 9 · Misión Luna');

    expect(currentLocation()).toBe('/reservas?lanzamiento=activity-1');
    expect(bookingArticles()).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('hides the filter on an invalid (contract) response', async () => {
    storeSession();
    mockFetchByUrl(() => jsonResponse(200, [{ id: 'booking-1' }]));

    renderApp('/reservas?lanzamiento=activity-1');

    expect(await screen.findByRole('alert')).toHaveTextContent(CONTRACT_TEXT);
    expect(screen.queryByRole('combobox', { name: FILTER_NAME })).toBeNull();
  });

  it('R6: hides the filter without bookings even with lanzamiento in the URL', async () => {
    storeSession();
    mockBookingList([]);

    renderApp('/reservas?lanzamiento=activity-1');

    expect(await screen.findByText('Todavía no tienes reservas.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: FILTER_NAME })).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });
});
