import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LaunchListPage } from '../../../../src/features/launches/LaunchListPage';
import {
  activityDto,
  draftActivityDto,
  seedActivityDto,
  seedActivityDtos,
  type ActivityDtoFixture,
} from '../../support/activities';
import { deferred } from '../../support/deferred';
import {
  jsonResponse,
  mockFetch,
  mockFetchByUrl,
  requestedUrls,
  sentRequest,
} from '../../support/http';

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

const API_ACTIVITIES_URL = 'http://localhost:3999/activities';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.search}</span>;
}

function renderPage(entry = '/lanzamientos') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/lanzamientos"
          element={
            <>
              <LaunchListPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function currentSearch(): string {
  return screen.getByTestId('location').textContent ?? '';
}

function searchBox(): HTMLInputElement {
  return screen.getByRole('searchbox', { name: 'Buscar lanzamientos' });
}

function sortSelect(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: 'Ordenar por' });
}

function orderSelect(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: 'Dirección' });
}

function lastRequestedUrl(fetchSpy: ReturnType<typeof mockFetch>): string {
  return requestedUrls(fetchSpy).at(-1) ?? '';
}

function seedResponse(...ids: string[]): Response {
  return jsonResponse(200, ids.map(seedActivityDto));
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
    expect(sentRequest(fetchSpy).url).toBe(`${API_ACTIVITIES_URL}?_sort=date&_order=asc`);
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

describe('LaunchListPage search and sort', () => {
  const NO_MATCHES_ZZZ = 'No hay lanzamientos que coincidan con «zzz».';

  it('R5: requests the default order when the URL has no parameters', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, seedActivityDtos));

    renderPage();

    expect(await screen.findAllByRole('article')).toHaveLength(8);
    expect(requestedUrls(fetchSpy)).toEqual([`${API_ACTIVITIES_URL}?_sort=date&_order=asc`]);
    expect(sortSelect()).toHaveValue('fecha');
    expect(within(sortSelect()).getByRole('option', { selected: true })).toHaveTextContent('Fecha');
    expect(orderSelect()).toHaveValue('asc');
    expect(searchBox()).toHaveValue('');
    expect(currentSearch()).toBe('');
  });

  it('R6: reads q, orden and dir from the URL', async () => {
    const fetchSpy = mockFetch(seedResponse('activity-5'));

    renderPage('/lanzamientos?q=kourou&orden=precio&dir=desc');

    expect(await screen.findByRole('article', { name: 'Mirador Orbital' })).toBeInTheDocument();
    expect(searchBox()).toHaveValue('kourou');
    expect(sortSelect()).toHaveValue('precio');
    expect(orderSelect()).toHaveValue('desc');
    expect(requestedUrls(fetchSpy)).toEqual([
      `${API_ACTIVITIES_URL}?q=kourou&_sort=price&_order=desc`,
    ]);
  });

  it('R6: reads special characters in q and forwards them encoded to the API', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, []));

    renderPage('/lanzamientos?q=a%2Bb%26c%23d%25e+%C3%93');

    expect(
      await screen.findByText('No hay lanzamientos que coincidan con «a+b&c#d%e Ó».'),
    ).toBeInTheDocument();
    expect(searchBox()).toHaveValue('a+b&c#d%e Ó');
    expect(requestedUrls(fetchSpy)).toEqual([
      `${API_ACTIVITIES_URL}?q=a%2Bb%26c%23d%25e+%C3%93&_sort=date&_order=asc`,
    ]);
  });

  it('R7: falls back to the defaults for unsupported orden and dir', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, seedActivityDtos));

    renderPage('/lanzamientos?orden=plazas&dir=arriba');

    expect(await screen.findAllByRole('article')).toHaveLength(8);
    expect(sortSelect()).toHaveValue('fecha');
    expect(orderSelect()).toHaveValue('asc');
    expect(requestedUrls(fetchSpy)).toEqual([`${API_ACTIVITIES_URL}?_sort=date&_order=asc`]);
  });

  it('R2: searches once after typing and puts the trimmed text in the URL', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetchByUrl((url) =>
      url.searchParams.get('q') === 'falcon'
        ? seedResponse('activity-1', 'activity-9')
        : jsonResponse(200, seedActivityDtos),
    );
    renderPage();
    expect(await screen.findAllByRole('article')).toHaveLength(8);

    await user.type(searchBox(), ' falcon ');

    await waitFor(() => expect(currentSearch()).toBe('?q=falcon'));
    await waitFor(() => expect(cardTitles()).toEqual(['Misión Luna', 'Ventana Perdida']));
    expect(requestedUrls(fetchSpy)).toEqual([
      `${API_ACTIVITIES_URL}?_sort=date&_order=asc`,
      `${API_ACTIVITIES_URL}?q=falcon&_sort=date&_order=asc`,
    ]);
    expect(searchBox()).toHaveValue(' falcon ');
  });

  it('R2: aborts the previous search and shows only the latest results', async () => {
    const user = userEvent.setup();
    const falconResponse = deferred<Response>();
    const signals = new Map<string | null, AbortSignal | null | undefined>();
    mockFetchByUrl((url, init) => {
      const query = url.searchParams.get('q');
      signals.set(query, init.signal);
      if (query === 'falcon') {
        return falconResponse.promise;
      }
      if (query === 'kourou') {
        return seedResponse('activity-5');
      }
      return jsonResponse(200, seedActivityDtos);
    });
    renderPage();
    expect(await screen.findAllByRole('article')).toHaveLength(8);

    await user.type(searchBox(), 'falcon');
    await waitFor(() => expect(signals.has('falcon')).toBe(true));
    await user.clear(searchBox());
    await user.type(searchBox(), 'kourou');

    expect(await screen.findByRole('article', { name: 'Mirador Orbital' })).toBeInTheDocument();
    expect(signals.get('falcon')?.aborted).toBe(true);

    falconResponse.resolve(seedResponse('activity-1', 'activity-9'));
    await falconResponse.promise;

    expect(cardTitles()).toEqual(['Mirador Orbital']);
    expect(currentSearch()).toBe('?q=kourou');
  });

  it('R3: removes q and requests the list without it when the field is cleared', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetchByUrl((url) =>
      url.searchParams.has('q')
        ? seedResponse('activity-9', 'activity-1')
        : jsonResponse(200, seedActivityDtos),
    );
    renderPage('/lanzamientos?q=falcon&orden=precio&dir=desc');
    expect(await screen.findAllByRole('article')).toHaveLength(2);

    await user.clear(searchBox());

    await waitFor(() => expect(currentSearch()).toBe('?orden=precio&dir=desc'));
    expect(await screen.findAllByRole('article')).toHaveLength(8);
    expect(lastRequestedUrl(fetchSpy)).toBe(`${API_ACTIVITIES_URL}?_sort=price&_order=desc`);
  });

  it('R3: treats a whitespace-only search as empty', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetchByUrl(() => jsonResponse(200, seedActivityDtos));
    renderPage('/lanzamientos?q=falcon');
    expect(await screen.findAllByRole('article')).toHaveLength(8);

    await user.clear(searchBox());
    await user.type(searchBox(), '   ');

    await waitFor(() => expect(currentSearch()).toBe(''));
    await waitFor(() =>
      expect(lastRequestedUrl(fetchSpy)).toBe(`${API_ACTIVITIES_URL}?_sort=date&_order=asc`),
    );
    expect(searchBox()).toHaveValue('   ');
  });

  it('R4: changing sort and direction updates the URL and the request', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetchByUrl(() => seedResponse('activity-1', 'activity-9'));
    renderPage('/lanzamientos?q=falcon');
    expect(await screen.findAllByRole('article')).toHaveLength(2);

    await user.selectOptions(sortSelect(), 'Precio');
    await user.selectOptions(orderSelect(), 'Descendente');

    expect(currentSearch()).toBe('?q=falcon&orden=precio&dir=desc');
    expect(sortSelect()).toHaveValue('precio');
    expect(orderSelect()).toHaveValue('desc');
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(lastRequestedUrl(fetchSpy)).toBe(
      `${API_ACTIVITIES_URL}?q=falcon&_sort=price&_order=desc`,
    );

    await user.selectOptions(sortSelect(), 'Nombre (cohete y misión)');

    expect(currentSearch()).toBe('?q=falcon&orden=nombre&dir=desc');
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(lastRequestedUrl(fetchSpy)).toBe(
      `${API_ACTIVITIES_URL}?q=falcon&_sort=name&_order=desc`,
    );
  });

  it('R8: shows the launches in the received order without drafts', async () => {
    mockFetch(seedResponse('activity-3', 'activity-6', 'activity-1'));

    renderPage('/lanzamientos?orden=precio');

    expect(await screen.findAllByRole('article')).toHaveLength(3);
    expect(cardTitles()).toEqual(['Vuelo Suborbital', 'Amanecer Orbital', 'Misión Luna']);
  });

  it('R8: hides drafts in the search results', async () => {
    mockFetch(seedResponse('activity-5', 'activity-7'));

    renderPage('/lanzamientos?q=kourou');

    expect(await screen.findAllByRole('article')).toHaveLength(1);
    expect(cardTitles()).toEqual(['Mirador Orbital']);
    expect(screen.queryByText(/Prueba de Sistemas/)).toBeNull();
  });

  it.each([
    ['an empty list', []],
    ['only drafts', [draftActivityDto]],
  ])('R9: shows the no matches message for %s', async (_label, activities) => {
    mockFetch(jsonResponse(200, activities));

    renderPage('/lanzamientos?q=zzz');

    expect(await screen.findByText(NO_MATCHES_ZZZ)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar búsqueda' })).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('R9: quotes the applied search, not the text being typed', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(200, []));
    renderPage('/lanzamientos?q=%20zzz%20');
    expect(await screen.findByText(NO_MATCHES_ZZZ)).toBeInTheDocument();

    await user.type(searchBox(), 'y');

    expect(screen.getByText(NO_MATCHES_ZZZ)).toBeInTheDocument();
  });

  it('R9: clearing the search empties the field, removes q and focuses the search box', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetchByUrl((url) =>
      url.searchParams.has('q') ? jsonResponse(200, []) : jsonResponse(200, seedActivityDtos),
    );
    renderPage('/lanzamientos?q=zzz&orden=precio&dir=desc');
    await screen.findByText(NO_MATCHES_ZZZ);

    await user.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));

    expect(searchBox()).toHaveValue('');
    expect(searchBox()).toHaveFocus();
    expect(currentSearch()).toBe('?orden=precio&dir=desc');
    expect(await screen.findAllByRole('article')).toHaveLength(8);
    expect(lastRequestedUrl(fetchSpy)).toBe(`${API_ACTIVITIES_URL}?_sort=price&_order=desc`);
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).toBeNull();
  });

  it('R10: keeps the search and the order on error and retries the same request', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(seedResponse('activity-1', 'activity-9'));
    renderPage('/lanzamientos?q=falcon&orden=precio');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NETWORK_TEXT);
    expect(searchBox()).toHaveValue('falcon');
    expect(sortSelect()).toHaveValue('precio');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findAllByRole('article')).toHaveLength(2);
    const expectedUrl = `${API_ACTIVITIES_URL}?q=falcon&_sort=price&_order=asc`;
    expect(requestedUrls(fetchSpy)).toEqual([expectedUrl, expectedUrl]);
    expect(searchBox()).toHaveValue('falcon');
    expect(sortSelect()).toHaveValue('precio');
  });

  it('R10: keeps the filters mounted while loading', () => {
    const response = deferred<Response>();
    vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise);

    renderPage('/lanzamientos?q=falcon');

    expect(screen.getByRole('status')).toHaveTextContent(LOADING_TEXT);
    expect(searchBox()).toHaveValue('falcon');
    expect(sortSelect()).toBeInTheDocument();
    expect(orderSelect()).toBeInTheDocument();
  });
});
