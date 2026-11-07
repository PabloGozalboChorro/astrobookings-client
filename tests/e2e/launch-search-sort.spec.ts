import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  apiLikeHandler,
  mockActivities,
  trackFinishedRequests,
} from './fixtures/api-mock.ts';
import { findLaunchDto, launchDtos } from './fixtures/data.ts';
import { launchCard } from './fixtures/locators.ts';

const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const LIST_URL = `${API_URL}/activities`;
const TYPING_DELAY_MS = 50;

const MISSIONS_BY_DATE_ASC = [
  'Amanecer Orbital',
  'Ventana Perdida',
  'Vuelo Suborbital',
  'Misión Luna',
  'Estación Orbital',
  'Órbita Marciana',
  'Mirador Orbital',
  'Paseo Lunar Express',
];

const MISSIONS_BY_NAME_ASC = [
  'Mirador Orbital',
  'Amanecer Orbital',
  'Misión Luna',
  'Ventana Perdida',
  'Vuelo Suborbital',
  'Paseo Lunar Express',
  'Estación Orbital',
  'Órbita Marciana',
];

test.use({ timezoneId: 'UTC', locale: 'es-ES' });

function searchBox(page: Page) {
  return page.getByRole('searchbox', { name: 'Buscar lanzamientos' });
}

function sortSelect(page: Page) {
  return page.getByRole('combobox', { name: 'Ordenar por' });
}

function orderSelect(page: Page) {
  return page.getByRole('combobox', { name: 'Dirección' });
}

function cardTitles(page: Page) {
  return page.getByRole('article').getByRole('heading', { level: 2 });
}

function trackFinishedListRequests(page: Page): string[] {
  return trackFinishedRequests(page, 'GET', LIST_URL);
}

function lastListSearch(requestedUrls: URL[]): string | undefined {
  return requestedUrls.filter((url) => url.pathname === '/activities').at(-1)?.search;
}

test.describe('launch search and sort', () => {
  test('R1: shows the search box and the sort controls', async ({ page }) => {
    await mockActivities(page, apiLikeHandler);

    await page.goto('/lanzamientos');

    await expect(searchBox(page)).toBeVisible();
    await expect(sortSelect(page).getByRole('option')).toHaveText([
      'Nombre (cohete y misión)',
      'Fecha',
      'Precio',
    ]);
    await expect(orderSelect(page).getByRole('option')).toHaveText(['Ascendente', 'Descendente']);
  });

  test('R5: uses date ascending by default', async ({ page }) => {
    const finished = trackFinishedListRequests(page);
    await mockActivities(page, apiLikeHandler);

    await page.goto('/lanzamientos');

    await expect(cardTitles(page)).toHaveText(MISSIONS_BY_DATE_ASC);
    await expect(sortSelect(page)).toHaveValue('fecha');
    await expect(orderSelect(page)).toHaveValue('asc');
    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expect.poll(() => finished).toEqual([`${LIST_URL}?_sort=date&_order=asc`]);
  });

  test('R2: searches once after the user stops typing', async ({ page }) => {
    const finished = trackFinishedListRequests(page);
    const mock = await mockActivities(page, apiLikeHandler);
    await page.goto('/lanzamientos');
    await expect(cardTitles(page)).toHaveCount(8);

    await searchBox(page).pressSequentially('falcon', { delay: TYPING_DELAY_MS });

    await expect(page).toHaveURL(/\/lanzamientos\?q=falcon$/);
    await expect(cardTitles(page)).toHaveText(['Ventana Perdida', 'Misión Luna']);
    const searchUrl = `${LIST_URL}?q=falcon&_sort=date&_order=asc`;
    await expect.poll(() => finished.filter((url) => url === searchUrl)).toHaveLength(1);
    const searchedTexts = mock.requestedUrls
      .map((url) => url.searchParams.get('q'))
      .filter((query) => query !== null);
    expect(searchedTexts).toEqual(['falcon']);
  });

  test('R2: trims the search text', async ({ page }) => {
    const mock = await mockActivities(page, apiLikeHandler);
    await page.goto('/lanzamientos');
    await expect(cardTitles(page)).toHaveCount(8);

    await searchBox(page).pressSequentially(' falcon ', { delay: TYPING_DELAY_MS });

    await expect(page).toHaveURL(/\/lanzamientos\?q=falcon$/);
    await expect(cardTitles(page)).toHaveCount(2);
    expect(lastListSearch(mock.requestedUrls)).toBe('?q=falcon&_sort=date&_order=asc');
  });

  for (const [label, text] of [
    ['cleared', ''],
    ['blank', '   '],
  ] as const) {
    test(`R3: removes q when the search is ${label}`, async ({ page }) => {
      const mock = await mockActivities(page, apiLikeHandler);
      await page.goto('/lanzamientos?q=falcon');
      await expect(searchBox(page)).toHaveValue('falcon');
      await expect(cardTitles(page)).toHaveCount(2);

      await searchBox(page).fill(text);

      await expect(page).toHaveURL(/\/lanzamientos$/);
      await expect(cardTitles(page)).toHaveCount(8);
      expect(lastListSearch(mock.requestedUrls)).toBe('?_sort=date&_order=asc');
    });
  }

  test('R4: sends the chosen sort and direction', async ({ page }) => {
    const mock = await mockActivities(page, apiLikeHandler);
    await page.goto('/lanzamientos?q=falcon');
    await expect(cardTitles(page)).toHaveText(['Ventana Perdida', 'Misión Luna']);

    await sortSelect(page).selectOption({ label: 'Precio' });
    await orderSelect(page).selectOption({ label: 'Descendente' });

    await expect(page).toHaveURL(/\/lanzamientos\?q=falcon&orden=precio&dir=desc$/);
    await expect
      .poll(() => lastListSearch(mock.requestedUrls))
      .toBe('?q=falcon&_sort=price&_order=desc');
    await expect(cardTitles(page)).toHaveText(['Ventana Perdida', 'Misión Luna']);

    await sortSelect(page).selectOption({ label: 'Nombre (cohete y misión)' });

    await expect(page).toHaveURL(/\/lanzamientos\?q=falcon&orden=nombre&dir=desc$/);
    await expect
      .poll(() => lastListSearch(mock.requestedUrls))
      .toBe('?q=falcon&_sort=name&_order=desc');
    await expect(cardTitles(page)).toHaveText(['Ventana Perdida', 'Misión Luna']);
  });

  test('R4: sorting by name orders by rocket first', async ({ page }) => {
    const mock = await mockActivities(page, apiLikeHandler);

    await page.goto('/lanzamientos?orden=nombre');

    await expect(sortSelect(page)).toHaveValue('nombre');
    await expect(cardTitles(page)).toHaveText(MISSIONS_BY_NAME_ASC);
    expect(lastListSearch(mock.requestedUrls)).toBe('?_sort=name&_order=asc');
  });

  test('R6: restores the search and order from the URL, on reload and on back', async ({
    page,
  }) => {
    const mock = await mockActivities(page, apiLikeHandler);
    const expectRestored = async () => {
      await expect(searchBox(page)).toHaveValue('kourou');
      await expect(sortSelect(page)).toHaveValue('precio');
      await expect(orderSelect(page)).toHaveValue('desc');
      await expect(cardTitles(page)).toHaveText(['Mirador Orbital']);
      expect(lastListSearch(mock.requestedUrls)).toBe('?q=kourou&_sort=price&_order=desc');
    };

    await page.goto('/lanzamientos?q=kourou&orden=precio&dir=desc');
    await expectRestored();

    await page.reload();
    await expectRestored();

    await launchCard(page, 'Mirador Orbital').getByRole('link', { name: 'Mirador Orbital' }).click();
    await expect(page).toHaveURL(/\/lanzamientos\/activity-5$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mirador Orbital' })).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(/\/lanzamientos\?q=kourou&orden=precio&dir=desc$/);
    await expectRestored();
  });

  test('R7: falls back to the defaults for unsupported values', async ({ page }) => {
    const mock = await mockActivities(page, apiLikeHandler);

    await page.goto('/lanzamientos?orden=plazas&dir=arriba');

    await expect(sortSelect(page)).toHaveValue('fecha');
    await expect(orderSelect(page)).toHaveValue('asc');
    await expect(cardTitles(page)).toHaveText(MISSIONS_BY_DATE_ASC);
    expect(lastListSearch(mock.requestedUrls)).toBe('?_sort=date&_order=asc');
  });

  test('R8: hides drafts in the search results', async ({ page }) => {
    await mockActivities(page, apiLikeHandler);
    await page.goto('/lanzamientos');
    await expect(cardTitles(page)).toHaveCount(8);

    await searchBox(page).pressSequentially('kourou', { delay: TYPING_DELAY_MS });

    await expect(page).toHaveURL(/\/lanzamientos\?q=kourou$/);
    await expect(cardTitles(page)).toHaveText(['Mirador Orbital']);
    await expect(page.getByText('Prueba de Sistemas')).toHaveCount(0);
  });

  test('R8: keeps the order returned by the API', async ({ page }) => {
    await mockActivities(page, (request) => {
      const url = new URL(request.url());
      const byPriceAsc =
        url.searchParams.get('_sort') === 'price' && url.searchParams.get('_order') === 'asc';
      return {
        body: byPriceAsc ? ['activity-3', 'activity-6', 'activity-1'].map(findLaunchDto) : launchDtos,
      };
    });

    await page.goto('/lanzamientos?orden=precio');

    await expect(cardTitles(page)).toHaveText(['Vuelo Suborbital', 'Amanecer Orbital', 'Misión Luna']);
  });

  for (const query of ['zzz', 'vega']) {
    test(`R9: shows the no matches message for "${query}" and clears the search`, async ({
      page,
    }) => {
      await mockActivities(page, apiLikeHandler);
      await page.goto('/lanzamientos');
      await expect(cardTitles(page)).toHaveCount(8);

      await searchBox(page).pressSequentially(query, { delay: TYPING_DELAY_MS });

      await expect(page.getByText(`No hay lanzamientos que coincidan con «${query}».`)).toBeVisible();
      await expect(page.getByRole('article')).toHaveCount(0);

      await page.getByRole('button', { name: 'Borrar búsqueda' }).click();

      await expect(searchBox(page)).toHaveValue('');
      await expect(searchBox(page)).toBeFocused();
      await expect(page).toHaveURL(/\/lanzamientos$/);
      await expect(cardTitles(page)).toHaveCount(8);
    });
  }

  test('R10: keeps the search and order on network error and retries', async ({ page }) => {
    let apiDown = false;
    const mock = await mockActivities(page, (request, attempt) =>
      apiDown ? 'abort' : apiLikeHandler(request, attempt),
    );
    await page.goto('/lanzamientos?orden=precio');
    await expect(cardTitles(page)).toHaveCount(8);

    apiDown = true;
    await searchBox(page).pressSequentially('falcon', { delay: TYPING_DELAY_MS });

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(NETWORK_TEXT);
    await expect(searchBox(page)).toHaveValue('falcon');
    await expect(sortSelect(page)).toHaveValue('precio');
    await expect(page).toHaveURL(/\/lanzamientos\?q=falcon&orden=precio$/);

    apiDown = false;
    await alert.getByRole('button', { name: 'Reintentar' }).click();

    await expect(cardTitles(page)).toHaveText(['Misión Luna', 'Ventana Perdida']);
    await expect(page.getByRole('alert')).toHaveCount(0);
    const searches = mock.requestedUrls.filter((url) => url.searchParams.has('q'));
    expect(searches.map((url) => url.search)).toEqual([
      '?q=falcon&_sort=price&_order=asc',
      '?q=falcon&_sort=price&_order=asc',
    ]);
  });

  test('R2: encodes special characters in the app URL and in the API request', async ({
    page,
  }) => {
    const mock = await mockActivities(page, apiLikeHandler);
    await page.goto('/lanzamientos');
    await expect(cardTitles(page)).toHaveCount(8);

    await searchBox(page).pressSequentially('a&b#c+d%e', { delay: TYPING_DELAY_MS });

    await expect(page).toHaveURL(/\/lanzamientos\?q=a%26b%23c%2Bd%25e$/);
    await expect(page.getByText('No hay lanzamientos que coincidan con «a&b#c+d%e».')).toBeVisible();
    expect(lastListSearch(mock.requestedUrls)).toBe('?q=a%26b%23c%2Bd%25e&_sort=date&_order=asc');

    await page.reload();

    await expect(searchBox(page)).toHaveValue('a&b#c+d%e');
    expect(lastListSearch(mock.requestedUrls)).toBe('?q=a%26b%23c%2Bd%25e&_sort=date&_order=asc');
  });

  test('R6: back and forward between searches restore the field and the request', async ({
    page,
  }) => {
    const mock = await mockActivities(page, apiLikeHandler);
    await page.goto('/lanzamientos?q=falcon&orden=precio');
    await expect(cardTitles(page)).toHaveCount(2);

    await page.getByRole('link', { name: 'Lanzamientos', exact: true }).click();

    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expect(searchBox(page)).toHaveValue('');
    await expect(cardTitles(page)).toHaveCount(8);

    await page.goBack();

    await expect(page).toHaveURL(/\/lanzamientos\?q=falcon&orden=precio$/);
    await expect(searchBox(page)).toHaveValue('falcon');
    await expect(sortSelect(page)).toHaveValue('precio');
    await expect(cardTitles(page)).toHaveCount(2);
    expect(lastListSearch(mock.requestedUrls)).toBe('?q=falcon&_sort=price&_order=asc');

    await page.goForward();

    await expect(searchBox(page)).toHaveValue('');
    await expect(sortSelect(page)).toHaveValue('fecha');
    await expect(cardTitles(page)).toHaveCount(8);
  });

  test('R2: changing the sort while a search is pending sends one request with both', async ({
    page,
  }) => {
    const mock = await mockActivities(page, apiLikeHandler);
    await page.goto('/lanzamientos');
    await expect(cardTitles(page)).toHaveCount(8);

    await searchBox(page).pressSequentially('falcon', { delay: 10 });
    await sortSelect(page).selectOption({ label: 'Precio' });

    await expect(page).toHaveURL(/\/lanzamientos\?q=falcon&orden=precio&dir=asc$/);
    await expect(cardTitles(page)).toHaveText(['Misión Luna', 'Ventana Perdida']);
    await expect(searchBox(page)).toHaveValue('falcon');
    const searches = mock.requestedUrls
      .filter((url) => url.searchParams.has('q'))
      .map((url) => url.search);
    expect(searches).toEqual(['?q=falcon&_sort=price&_order=asc']);
  });

  test('R2: keeps a keystroke typed while the applied search reaches the URL', async ({
    page,
  }) => {
    await mockActivities(page, apiLikeHandler);
    await page.goto('/lanzamientos');
    await expect(cardTitles(page)).toHaveCount(8);
    // Types one more letter right after the debounced search writes the URL, before
    // React renders the new location (BrowserRouter applies it inside startTransition).
    await page.evaluate(() => {
      const originalReplaceState = history.replaceState.bind(history);
      let typed = false;
      history.replaceState = (data, unused, url) => {
        originalReplaceState(data, unused, url);
        const input = document.querySelector<HTMLInputElement>('input[type="search"]');
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!typed && input !== null && valueSetter !== undefined) {
          typed = true;
          valueSetter.call(input, `${input.value}c`);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
    });

    await searchBox(page).pressSequentially('fal', { delay: TYPING_DELAY_MS });

    await expect(page).toHaveURL(/\/lanzamientos\?q=falc$/);
    await expect(searchBox(page)).toHaveValue('falc');
  });

  test('R2: encodes accented text in the URL', async ({ page }) => {
    const mock = await mockActivities(page, apiLikeHandler);
    await page.goto('/lanzamientos');
    await expect(cardTitles(page)).toHaveCount(8);

    await searchBox(page).pressSequentially('Órbita Marciana', { delay: TYPING_DELAY_MS });

    await expect(page).toHaveURL(/\/lanzamientos\?q=%C3%93rbita\+Marciana$/);
    await expect(cardTitles(page)).toHaveText(['Órbita Marciana']);
    expect(lastListSearch(mock.requestedUrls)).toBe(
      '?q=%C3%93rbita+Marciana&_sort=date&_order=asc',
    );
  });
});
