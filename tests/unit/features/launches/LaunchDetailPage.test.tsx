import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaunchDetailPage } from '../../../../src/features/launches/LaunchDetailPage';
import { SessionProvider } from '../../../../src/features/session/SessionProvider';
import { draftActivityDto, seedActivityDtos } from '../../support/activities';
import { deferred } from '../../support/deferred';
import { jsonResponse, mockFetch } from '../../support/http';
import { storeSession } from '../../support/session';

const NOW = new Date('2026-11-05T10:00:00.000Z');
const LOADING_TEXT = 'Cargando lanzamiento…';
const NOT_FOUND_TEXT = 'Este lanzamiento no existe o ya no está disponible.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const REASON_TEXTS = [
  'Agotado: no quedan plazas',
  'Este lanzamiento ya se ha realizado',
  'Este lanzamiento se ha cancelado',
  'La fecha de este lanzamiento ya ha pasado',
  'No disponible',
];

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <Link to="/lanzamientos/activity-2">Ir a activity-2</Link>
        <Routes>
          <Route path="/lanzamientos/:id" element={<LaunchDetailPage />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

function activityNotFoundResponse(): Response {
  return jsonResponse(404, { message: 'Activity not found', errors: [] });
}

function seedResponse(input: string | URL | Request): Response {
  const id = decodeURIComponent(String(input).split('/').pop() ?? '');
  const dto = seedActivityDtos.find((activity) => activity.id === id);
  if (dto === undefined) {
    return activityNotFoundResponse();
  }
  return jsonResponse(200, dto);
}

function mockSeedApi() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input) => Promise.resolve(seedResponse(input)));
}

function expectNoBookingOption() {
  expect(screen.queryByLabelText('Número de plazas')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reservar' })).toBeNull();
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LaunchDetailPage', () => {
  it('R1: requests the launch once and shows the loading status until it arrives', async () => {
    const response = deferred<Response>();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise);

    renderAt('/lanzamientos/activity-1');

    expect(screen.getByRole('status')).toHaveTextContent(LOADING_TEXT);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('http://localhost:3999/activities/activity-1');

    response.resolve(seedResponse('activity-1'));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('R2: shows every launch field', async () => {
    mockSeedApi();

    renderAt('/lanzamientos/activity-1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
    const page = document.body;
    for (const text of [
      'Cohete: Falcon 9',
      'Identificador: falcon-9-mision-luna',
      'Cabo Cañaveral, Florida (EE. UU.)',
      'lunes, 15 de marzo de 2027, 14:30',
      '3 días',
      '249.999,00 € por plaza',
      '6 plazas en total',
      'Mínimo de viajeros para confirmar el lanzamiento: 2',
      'Abierto a reservas',
    ]) {
      expect(page).toHaveTextContent(text);
    }
    expect(screen.getByText('lunes, 15 de marzo de 2027, 14:30')).toHaveAttribute(
      'datetime',
      '2027-03-15T14:30:00.000Z',
    );
    expect(screen.getByRole('link', { name: 'Volver a los lanzamientos' })).toHaveAttribute(
      'href',
      '/lanzamientos',
    );
  });

  it('R2: hides the rocket line for a name without separator', async () => {
    mockSeedApi();

    renderAt('/lanzamientos/activity-8');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Paseo Lunar Express' }),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Cohete:');
  });

  it.each([
    ['a 404 Activity not found', activityNotFoundResponse],
    ['a 404 without body', () => new Response(null, { status: 404 })],
  ])('R3: shows the not found screen without retry for %s', async (_label, response) => {
    mockFetch(response());

    renderAt('/lanzamientos/activity-99');

    expect(await screen.findByText(NOT_FOUND_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todos los lanzamientos' })).toHaveAttribute(
      'href',
      '/lanzamientos',
    );
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('R4: treats a draft launch as not found', async () => {
    mockFetch(jsonResponse(200, draftActivityDto));

    renderAt('/lanzamientos/activity-7');

    expect(await screen.findByText(NOT_FOUND_TEXT)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Prueba de Sistemas');
    expect(document.body).not.toHaveTextContent('Vega');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('R5: shows the network error and reloads on retry', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation((input) => Promise.resolve(seedResponse(input)));

    renderAt('/lanzamientos/activity-1');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NETWORK_TEXT);

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.',
      'a 500 Failed to retrieve activity',
      () => jsonResponse(500, { message: 'Failed to retrieve activity', errors: [] }),
    ],
    [
      'El servidor ha devuelto una respuesta inesperada.',
      'an unexpected response',
      () => jsonResponse(200, { id: 1 }),
    ],
  ])('R5: shows "%s" for %s', async (expectedText, _label, response) => {
    mockFetch(response());

    renderAt('/lanzamientos/activity-1');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expectedText);
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it.each([
    ['Agotado: no quedan plazas', 'activity-4', 'Estación Orbital'],
    ['Este lanzamiento se ha cancelado', 'activity-5', 'Mirador Orbital'],
    ['Este lanzamiento ya se ha realizado', 'activity-6', 'Amanecer Orbital'],
    ['La fecha de este lanzamiento ya ha pasado', 'activity-9', 'Ventana Perdida'],
  ])('R7: shows "%s" and no booking option for %s', async (reasonText, id, mission) => {
    mockSeedApi();

    renderAt(`/lanzamientos/${id}`);

    expect(await screen.findByRole('heading', { level: 1, name: mission })).toBeInTheDocument();
    expect(screen.getByText(reasonText)).toBeInTheDocument();
    expectNoBookingOption();
  });

  it('R7: shows no notice for a bookable launch', async () => {
    mockSeedApi();

    renderAt('/lanzamientos/activity-1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
    for (const text of REASON_TEXTS) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(document.querySelector('.bookability-notice')).toBeNull();
  });

  it('R1: loads a new launch when the id changes', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockSeedApi();

    renderAt('/lanzamientos/activity-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Ir a activity-2' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Órbita Marciana' }),
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe('http://localhost:3999/activities/activity-2');
  });

  it('R1: shows the loading status instead of the previous launch while the new id loads', async () => {
    const user = userEvent.setup();
    const secondResponse = deferred<Response>();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(seedResponse('activity-1'))
      .mockReturnValueOnce(secondResponse.promise);

    renderAt('/lanzamientos/activity-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Ir a activity-2' }));

    expect(screen.getByRole('status')).toHaveTextContent(LOADING_TEXT);
    expect(document.body).not.toHaveTextContent('Misión Luna');

    secondResponse.resolve(seedResponse('activity-2'));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Órbita Marciana' }),
    ).toBeInTheDocument();
  });

  it('R1: aborts the pending request and ignores its response when the id changes', async () => {
    const user = userEvent.setup();
    const firstResponse = deferred<Response>();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(firstResponse.promise)
      .mockImplementation((input) => Promise.resolve(seedResponse(input)));

    renderAt('/lanzamientos/activity-1');
    expect(screen.getByRole('status')).toHaveTextContent(LOADING_TEXT);

    await user.click(screen.getByRole('link', { name: 'Ir a activity-2' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Órbita Marciana' }),
    ).toBeInTheDocument();
    expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);

    firstResponse.resolve(seedResponse('activity-1'));
    await Promise.resolve();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Órbita Marciana');
    expect(document.body).not.toHaveTextContent('Misión Luna');
  });

  it.each([
    ['/lanzamientos/a%2Fb', 'http://localhost:3999/activities/a%2Fb'],
    ['/lanzamientos/con%20espacio', 'http://localhost:3999/activities/con%20espacio'],
    ['/lanzamientos/100%25', 'http://localhost:3999/activities/100%25'],
  ])('R3: requests an encoded id for %s and shows not found on 404', async (path, apiUrl) => {
    const fetchSpy = mockFetch(activityNotFoundResponse());

    renderAt(path);

    expect(await screen.findByText(NOT_FOUND_TEXT)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(apiUrl);
  });

  it('R2: renders the detail inside one article with a single level 1 heading', async () => {
    mockSeedApi();

    renderAt('/lanzamientos/activity-1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Misión Luna' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('article')).toContainElement(heading);
  });

  it('R2 (booking): shows the sign-in and sign-up links without a session', async () => {
    mockSeedApi();

    renderAt('/lanzamientos/activity-1');

    const region = await screen.findByRole('region', { name: 'Reservar plazas' });
    expect(region).toHaveTextContent('Inicia sesión o crea una cuenta para reservar.');
    expect(within(region).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/acceso?volver=%2Flanzamientos%2Factivity-1',
    );
    expect(within(region).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/registro?volver=%2Flanzamientos%2Factivity-1',
    );
    expectNoBookingOption();
  });

  it('R2 (booking): shows no links for a non-bookable launch', async () => {
    mockSeedApi();

    renderAt('/lanzamientos/activity-4');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Estación Orbital' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Reservar plazas' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).toBeNull();
  });

  it('R1 (booking): shows no form for activity-4 (sold-out) with a session', async () => {
    storeSession();
    mockSeedApi();

    renderAt('/lanzamientos/activity-4');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Estación Orbital' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Agotado: no quedan plazas')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Reservar plazas' })).toBeNull();
    expectNoBookingOption();
  });

  it('R1 (booking): shows the booking section without the access links with a session', async () => {
    storeSession();
    mockSeedApi();

    renderAt('/lanzamientos/activity-1');

    const region = await screen.findByRole('region', { name: 'Reservar plazas' });
    expect(region).not.toHaveTextContent('Inicia sesión o crea una cuenta para reservar.');
    expect(within(region).queryByRole('link', { name: 'Iniciar sesión' })).toBeNull();
  });

  it('R3: the not found screen has a single level 1 heading', async () => {
    mockFetch(activityNotFoundResponse());

    renderAt('/lanzamientos/activity-99');

    expect(await screen.findByText(NOT_FOUND_TEXT)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('article')).toBeNull();
  });
});
