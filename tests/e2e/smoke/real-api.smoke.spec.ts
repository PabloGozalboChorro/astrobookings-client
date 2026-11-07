import { expect, test, type Page } from '@playwright/test';
import { bookingCard } from '../fixtures/locators.ts';
import { readStoredSession } from '../fixtures/session.ts';

// Local development servers (not secrets): the fork and the client's `npm run dev`.
const API_URL = 'http://localhost:3000';
const APP_URL = 'http://localhost:5173';
const REACHABILITY_TIMEOUT_MS = 3_000;

const BOOKABLE_LAUNCH_ID = 'activity-2';
const BOOKABLE_MISSION = 'Órbita Marciana';
const SOLD_OUT_LAUNCH_ID = 'activity-4';

async function findUnreachable(url: string, howToStart: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS) });
    if (response.ok) {
      return null;
    }
    return `- ${url} responde ${response.status}. ${howToStart}`;
  } catch {
    return `- ${url} no responde. ${howToStart}`;
  }
}

function hasAccessToken(value: unknown): value is { accessToken: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accessToken' in value &&
    typeof value.accessToken === 'string'
  );
}

function header(page: Page) {
  return page.getByRole('banner');
}

async function expectSignedIn(page: Page, username: string) {
  await expect(header(page)).toContainText(username);
  await expect(header(page).getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}

test.use({ locale: 'es-ES' });

test.beforeAll(async () => {
  const problems = await Promise.all([
    findUnreachable(
      `${API_URL}/health`,
      'La API no está en marcha: arranca el fork con `npm run dev` en `activity-bookings-express` (puerto 3000).',
    ),
    findUnreachable(
      APP_URL,
      'La app no está en marcha: arranca el cliente con `npm run dev` en este repositorio (puerto 5173).',
    ),
  ]);
  const unreachable = problems.filter((problem) => problem !== null);
  if (unreachable.length > 0) {
    throw new Error(
      `El smoke e2e necesita la API y la app en marcha:\n${unreachable.join('\n')}`,
    );
  }
});

test('R1–R4, R7: registers, signs in again, books a launch and is rejected on a sold-out launch', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const stamp = Date.now();
  const username = `smoke-${stamp}`;
  const email = `smoke-${stamp}@example.com`;
  const password = 'smoke-pass';

  await test.step('R1: registers with a unique email', async () => {
    await page.goto('/registro');
    await page.getByLabel('Nombre de usuario').fill(username);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('checkbox', { name: 'Acepto los términos y condiciones' }).check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expectSignedIn(page, username);
  });

  await test.step('R2: signs out and signs in again', async () => {
    await header(page).getByRole('button', { name: 'Cerrar sesión' }).click();
    await header(page).getByRole('link', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/acceso/);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('main').getByRole('button', { name: 'Iniciar sesión' }).click();

    await expectSignedIn(page, username);
    await expect(page.getByText('Email o contraseña incorrectos.')).toHaveCount(0);
  });

  await test.step(`R3: books 1 seat on ${BOOKABLE_LAUNCH_ID}`, async () => {
    await page.goto(`/lanzamientos/${BOOKABLE_LAUNCH_ID}`);
    await expect(page.getByLabel('Número de plazas')).toHaveValue('1');
    await page.getByRole('button', { name: 'Reservar' }).click();

    await expect(page).toHaveURL(/\/reservas\/booking-\d+$/);
    const confirmation = page.getByRole('region', { name: 'Reserva confirmada' });
    await expect(confirmation).toContainText(BOOKABLE_MISSION);
    await expect(confirmation).toContainText('1 plaza');
    await expect(confirmation.getByText(/^Importe total:/)).toHaveText(
      'Importe total: 1.249.999,00 €',
    );
    await expect(confirmation).toContainText('Pagada');
  });

  await test.step('R4: shows the booking in Mis reservas', async () => {
    await page.getByRole('link', { name: 'Ver mis reservas', exact: true }).click();

    await expect(page).toHaveURL(/\/reservas$/);
    await expect(page.getByRole('main').getByRole('article')).toHaveCount(1);
    await expect(bookingCard(page, BOOKABLE_MISSION)).toBeVisible();
  });

  await test.step('R7: the API rejects a sold-out launch', async () => {
    const session = await readStoredSession(page);
    if (!hasAccessToken(session)) {
      throw new Error('No hay sesión guardada con accessToken tras iniciar sesión.');
    }

    const response = await request.post(`${API_URL}/bookings`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { activityId: SOLD_OUT_LAUNCH_ID, participants: 1 },
    });
    const body = await response.text();

    expect(response.status(), `POST /bookings respondió: ${body}`).toBe(400);
    expect(JSON.parse(body)).toEqual({
      message: 'Activity is not bookable: sold-out',
      errors: [],
    });

    await page.reload();
    await expect(page.getByRole('main').getByRole('article')).toHaveCount(1);
    await expect(bookingCard(page, BOOKABLE_MISSION)).toBeVisible();
  });
});
