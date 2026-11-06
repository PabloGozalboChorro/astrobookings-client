import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LaunchListPage } from '../../../../src/features/launches/LaunchListPage';
import {
  activityDto,
  draftActivityDto,
  seedActivityDtos,
  type ActivityDtoFixture,
} from '../../support/activities';
import { deferred } from '../../support/deferred';
import { jsonResponse, mockFetch, sentRequest } from '../../support/http';

const LOADING_TEXT = 'Cargando lanzamientos…';
const EMPTY_TEXT = 'No hay lanzamientos disponibles en este momento.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';

const visibleMissions = [
  'Misión Luna',
  'Órbita Marciana',
  'Vuelo Suborbital',
  'Estación Orbital',
  'Mirador Orbital',
  'Amanecer Orbital',
  'Paseo Lunar Express',
  'Ventana Perdida',
];

function nineActivities(): ActivityDtoFixture[] {
  const visible = visibleMissions.map((mission, index) =>
    activityDto({ id: `visible-${index}`, name: `Cohete ${index} · ${mission}` }),
  );
  return [...visible.slice(0, 6), draftActivityDto, ...visible.slice(6)];
}

function renderPage() {
  render(
    <MemoryRouter>
      <LaunchListPage />
    </MemoryRouter>,
  );
}

function cardTitles(): string[] {
  return screen
    .getAllByRole('article')
    .map((card) => within(card).getByRole('heading').textContent ?? '');
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LaunchListPage', () => {
  it('R1: requests the launches once and shows one card per visible launch in API order', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, nineActivities()));

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Lanzamientos' })).toBeInTheDocument();
    expect(await screen.findAllByRole('article')).toHaveLength(8);
    expect(cardTitles()).toEqual(visibleMissions);
    expect(screen.queryByText(/Prueba de Sistemas/)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sentRequest(fetchSpy).url).toBe('http://localhost:3999/activities');
  });

  it('R7: shows the loading status until the launches arrive', async () => {
    const response = deferred<Response>();
    vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise);

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(LOADING_TEXT);
    expect(screen.queryByRole('article')).toBeNull();

    response.resolve(jsonResponse(200, [activityDto()]));

    expect(await screen.findByRole('article', { name: 'Misión Luna' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    ['an empty list', []],
    ['only drafts', [draftActivityDto]],
  ])('R8: shows the empty message when the API returns %s', async (_label, activities) => {
    mockFetch(jsonResponse(200, activities));

    renderPage();

    expect(await screen.findByText(EMPTY_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('R9: shows the network error and reloads on retry', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, nineActivities()));

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NETWORK_TEXT);
    expect(screen.queryByRole('article')).toBeNull();

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findAllByRole('article')).toHaveLength(8);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.',
      'a 500 Failed to retrieve activities',
      () => jsonResponse(500, { message: 'Failed to retrieve activities', errors: [] }),
    ],
    [
      'El servidor ha devuelto una respuesta inesperada.',
      'an unexpected response',
      () => jsonResponse(200, [{ id: 1 }]),
    ],
  ])('R9: shows "%s" for %s', async (expectedText, _label, response) => {
    mockFetch(response());

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expectedText);
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('R9: shows the unexpected response error when a launch has an unknown status', async () => {
    mockFetch(jsonResponse(200, [activityDto(), activityDto({ id: 'activity-x', status: 'postponed' })]));

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El servidor ha devuelto una respuesta inesperada.');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('R8: shows the bookability reason on the cards using the current date', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-05T10:00:00.000Z'), toFake: ['Date'] });
    mockFetch(jsonResponse(200, seedActivityDtos));

    renderPage();

    expect(await screen.findAllByRole('article')).toHaveLength(8);
    expect(screen.getByRole('article', { name: 'Ventana Perdida' })).toHaveTextContent(
      'La fecha de este lanzamiento ya ha pasado',
    );
    expect(screen.getByRole('article', { name: 'Estación Orbital' })).toHaveTextContent(
      'Agotado: no quedan plazas',
    );
    for (const mission of [
      'Misión Luna',
      'Órbita Marciana',
      'Vuelo Suborbital',
      'Paseo Lunar Express',
    ]) {
      const card = screen.getByRole('article', { name: mission });
      expect(card.querySelector('.bookability-notice')).toBeNull();
    }
  });

  it('R1: renders the launches as a list of articles under the page heading', async () => {
    mockFetch(jsonResponse(200, [activityDto()]));

    renderPage();

    const list = await screen.findByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByRole('article', { name: 'Misión Luna' })).toBeInTheDocument();
    expect(within(list).getByRole('heading', { level: 2, name: 'Misión Luna' })).toBeInTheDocument();
  });
});
