/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { mockActivities, mockLogin, type MockApiResponse } from './fixtures/api-mock.ts';
import { anaAuthResponse, errorResponses } from './fixtures/data.ts';
import {
  ANA_TOKEN,
  readStoredSession,
  seedSession,
  sessionValue,
} from './fixtures/session.ts';

const NOW = new Date('2026-11-06T10:00:00Z');
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const SESSION_TEXT = 'Tu sesión ha caducado o no es válida. Inicia sesión de nuevo.';
const INVALID_CREDENTIALS_TEXT = 'Email o contraseña incorrectos.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const ANA_STORED_SESSION = {
  accessToken: ANA_TOKEN,
  user: { username: 'ana', email: 'ana@ejemplo.com' },
  expiresAt: 1794045600000,
};

test.use({ timezoneId: 'UTC', locale: 'es-ES' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await mockActivities(page);
});

function ok(accessToken = ANA_TOKEN): MockApiResponse {
  return { body: anaAuthResponse(accessToken) };
}

function header(page: Page) {
  return page.getByRole('banner');
}

function submitButton(page: Page) {
  return page.getByRole('button', { name: 'Iniciar sesión' });
}

async function fillAndSubmit(page: Page, email = 'ana@ejemplo.com', password = 'secreto1') {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await submitButton(page).click();
}

async function expectSignedIn(page: Page) {
  await expect(header(page)).toContainText('ana');
  await expect(header(page).getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toHaveCount(0);
}

test.describe('user session', () => {
  test('R1: shows the login form at /acceso', async ({ page }) => {
    await page.goto('/acceso');

    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email');
    await expect(page.getByLabel('Contraseña')).toHaveAttribute('type', 'password');
    await expect(submitButton(page)).toBeEnabled();
  });

  test('R2: shows the field errors without sending a request', async ({ page }) => {
    const login = await mockLogin(page, () => ok());
    await page.goto('/acceso');

    await submitButton(page).click();

    await expect(page.getByText('Introduce tu email.')).toBeVisible();
    await expect(page.getByText('Introduce tu contraseña.')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');

    await fillAndSubmit(page, 'ana@ejemplo');

    await expect(page.getByText('Introduce un email válido.')).toBeVisible();
    await expect(page.getByText('Introduce tu contraseña.')).toHaveCount(0);
    expect(login.requestBodies).toEqual([]);
  });

  test('R3: sends a single request while waiting and shows "Entrando…"', async ({ page }) => {
    let releaseResponse: () => void = () => undefined;
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let requestReceived: () => void = () => undefined;
    const requestArrived = new Promise<void>((resolve) => {
      requestReceived = resolve;
    });
    const login = await mockLogin(page, async () => {
      requestReceived();
      await responseReleased;
      return ok();
    });
    await page.goto('/acceso');
    await page.getByLabel('Email').fill('ana@ejemplo.com');
    await page.getByLabel('Contraseña').fill('secreto1');

    await submitButton(page).dblclick();
    await requestArrived;

    const waitingButton = page.getByRole('button', { name: 'Entrando…' });
    await expect(waitingButton).toBeDisabled();
    expect(login.requestBodies).toEqual([{ email: 'ana@ejemplo.com', password: 'secreto1' }]);

    releaseResponse();

    await expect(page).toHaveURL(/\/lanzamientos$/);
    expect(login.requestBodies).toHaveLength(1);
  });

  test('R4: stores the session and returns to volver', async ({ page }) => {
    await mockLogin(page, () => ok());
    await page.goto('/acceso?volver=/lanzamientos/activity-1');

    await fillAndSubmit(page);

    await expect(page).toHaveURL(/\/lanzamientos\/activity-1$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Misión Luna' })).toBeVisible();
    await expectSignedIn(page);
    expect(await readStoredSession(page)).toEqual(ANA_STORED_SESSION);
  });

  test('R4: uses 24 h for an opaque token', async ({ page }) => {
    await mockLogin(page, () => ok('opaque-token'));
    await page.goto('/acceso');

    await fillAndSubmit(page);

    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expectSignedIn(page);
    expect(await readStoredSession(page)).toEqual({
      accessToken: 'opaque-token',
      user: { username: 'ana', email: 'ana@ejemplo.com' },
      expiresAt: NOW.getTime() + 86_400_000,
    });
  });

  test('R4: goes to /lanzamientos without volver', async ({ page }) => {
    await mockLogin(page, () => ok());
    await page.goto('/acceso');

    await fillAndSubmit(page);

    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Lanzamientos' })).toBeVisible();
  });

  for (const [volver, expectedUrl] of [
    ['%2Freservas%3Flanzamiento%3Dactivity-1', /\/reservas\?lanzamiento=activity-1$/],
    ['https%3A%2F%2Fmalicioso.example', /localhost:5174\/lanzamientos$/],
    ['%2F%2Fmalicioso.example', /localhost:5174\/lanzamientos$/],
    ['reservas', /localhost:5174\/lanzamientos$/],
  ] as const) {
    test(`R5: ignores unsafe return paths (volver=${volver})`, async ({ page }) => {
      await mockLogin(page, () => ok());
      await page.goto(`/acceso?volver=${volver}`);

      await fillAndSubmit(page);

      await expect(page).toHaveURL(expectedUrl);
    });
  }

  // The URL parser strips tabs and newlines and treats "\" as "/", so these values point to another
  // origin even though they start with a single "/".
  for (const volver of ['%2F%5Cmalicioso.example', '%2F%09%2Fmalicioso.example', '%2F%0A%2Fmalicioso.example']) {
    test(`R5: stays in the app for a return path the browser reads as external (volver=${volver})`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await mockLogin(page, () => ok());
      await page.goto(`/acceso?volver=${volver}`);

      await fillAndSubmit(page);

      await expect(page).toHaveURL(/localhost:5174\/lanzamientos$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Lanzamientos' })).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }

  test('R6: shows the invalid credentials message', async ({ page }) => {
    await mockLogin(page, () => ({ status: 401, body: errorResponses.invalidCredentials }));
    await page.goto('/acceso');

    await fillAndSubmit(page, 'ana@ejemplo.com', 'incorrecta');

    await expect(page.getByRole('alert')).toHaveText(INVALID_CREDENTIALS_TEXT);
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/acceso$/);
    await expect(page.getByText(SESSION_TEXT)).toHaveCount(0);
    await expect(page.getByLabel('Email')).toHaveValue('ana@ejemplo.com');
    expect(await readStoredSession(page)).toBeNull();
  });

  test('R7: shows the user in the header with a session', async ({ page }) => {
    await seedSession(page, sessionValue());

    await page.goto('/lanzamientos');

    await expectSignedIn(page);
  });

  test('R7: links to /acceso with the current route without a session', async ({ page }) => {
    await page.goto('/lanzamientos/activity-1');

    const loginLink = header(page).getByRole('link', { name: 'Iniciar sesión' });
    await expect(loginLink).toHaveAttribute('href', '/acceso?volver=%2Flanzamientos%2Factivity-1');
    await expect(header(page).getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);

    await loginLink.click();

    await expect(page).toHaveURL(/\/acceso\?volver=%2Flanzamientos%2Factivity-1$/);
  });

  test('R8: keeps the session after reloading', async ({ page }) => {
    const stored = sessionValue({ expiresAt: NOW.getTime() + TWO_HOURS_MS });
    await seedSession(page, stored);
    await page.goto('/lanzamientos');
    await expectSignedIn(page);

    await page.reload();

    await expectSignedIn(page);
    expect(await readStoredSession(page)).toEqual(stored);
  });

  test('R9: signs out from the launch detail', async ({ page }) => {
    await seedSession(page, sessionValue());
    await page.goto('/lanzamientos/activity-1');
    await expectSignedIn(page);

    await header(page).getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
    expect(await readStoredSession(page)).toBeNull();

    await page.reload();

    await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('R11: clears an expired session at start and shows the notice', async ({ page }) => {
    await seedSession(page, sessionValue({ expiresAt: NOW.getTime() - 1 }));

    await page.goto('/lanzamientos');

    const notice = page.getByRole('alert');
    await expect(notice).toContainText(SESSION_TEXT);
    await expect(notice.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/acceso?volver=%2Flanzamientos',
    );
    await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
    await expect.poll(() => readStoredSession(page)).toBeNull();
  });

  test('R11: clears corrupt stored content without notice', async ({ page }) => {
    await seedSession(page, '{no es json');

    await page.goto('/lanzamientos');

    await expect(page.getByRole('heading', { level: 1, name: 'Lanzamientos' })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
    await expect.poll(() => readStoredSession(page)).toBeNull();
    await expect(page.getByText(SESSION_TEXT)).toHaveCount(0);
  });

  test('shows the network error and keeps the email', async ({ page }) => {
    await mockLogin(page, () => 'abort');
    await page.goto('/acceso');

    await fillAndSubmit(page);

    await expect(page.getByRole('alert')).toHaveText(NETWORK_TEXT);
    await expect(page.getByLabel('Email')).toHaveValue('ana@ejemplo.com');
    await expect(submitButton(page)).toBeEnabled();
  });

  test('shows the server error on a 500', async ({ page }) => {
    await mockLogin(page, () => ({ status: 500, body: errorResponses.authenticationFailed }));
    await page.goto('/acceso');

    await fillAndSubmit(page);

    await expect(page.getByRole('alert')).toHaveText(SERVER_TEXT);
    await expect(page.getByLabel('Email')).toHaveValue('ana@ejemplo.com');
  });
});
