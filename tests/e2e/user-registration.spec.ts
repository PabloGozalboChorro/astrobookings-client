/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  mockActivities,
  mockLogin,
  mockRegister,
  type MockApiResponse,
} from './fixtures/api-mock.ts';
import { anaAuthResponse, anaRegisterResponse, errorResponses } from './fixtures/data.ts';
import { ANA_TOKEN, readStoredSession, seedSession, sessionValue } from './fixtures/session.ts';

const NOW = new Date('2026-11-06T10:00:00Z');
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const PASSWORD_ERROR = 'La contraseña debe tener al menos 6 caracteres.';
const TERMS_ERROR = 'Debes aceptar los términos y condiciones.';
const ANA_STORED_SESSION = {
  accessToken: ANA_TOKEN,
  user: { username: 'ana', email: 'ana@ejemplo.com' },
  expiresAt: 1794045600000,
};
const ANA_REGISTRATION = {
  username: 'ana',
  email: 'ana@ejemplo.com',
  password: 'secreto1',
  terms: true,
};

test.use({ timezoneId: 'UTC', locale: 'es-ES' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await mockActivities(page);
});

function created(): MockApiResponse {
  return { status: 201, body: anaRegisterResponse(ANA_TOKEN) };
}

function header(page: Page) {
  return page.getByRole('banner');
}

function submitButton(page: Page) {
  return page.getByRole('button', { name: 'Crear cuenta' });
}

function termsCheckbox(page: Page) {
  return page.getByRole('checkbox', { name: 'Acepto los términos y condiciones' });
}

type FormInput = {
  username?: string;
  email?: string;
  password?: string;
  acceptTerms?: boolean;
};

async function fillForm(
  page: Page,
  {
    username = 'ana',
    email = 'ana@ejemplo.com',
    password = 'secreto1',
    acceptTerms = true,
  }: FormInput = {},
) {
  await page.getByLabel('Nombre de usuario').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await termsCheckbox(page).setChecked(acceptTerms);
}

async function fillAndSubmit(page: Page, input: FormInput = {}) {
  await fillForm(page, input);
  await submitButton(page).click();
}

async function expectDescribedBy(page: Page, label: string, text: string) {
  const control = page.getByLabel(label, { exact: true });
  await expect(control).toHaveAttribute('aria-invalid', 'true');
  const errorId = await control.getAttribute('aria-describedby');
  expect(errorId).not.toBeNull();
  await expect(page.locator(`[id="${errorId ?? ''}"]`)).toHaveText(text);
}

test.describe('user registration', () => {
  test('R1: shows the registration form at /registro', async ({ page }) => {
    await page.goto('/registro');

    await expect(page.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeVisible();
    await expect(page.getByLabel('Nombre de usuario')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email');
    await expect(page.getByLabel('Contraseña')).toHaveAttribute('type', 'password');
    await expect(termsCheckbox(page)).not.toBeChecked();
    await expect(submitButton(page)).toBeEnabled();
  });

  test('R2: shows the field errors without sending a request', async ({ page }) => {
    const register = await mockRegister(page, () => created());
    await page.goto('/registro');

    await fillAndSubmit(page, { password: '12345', acceptTerms: false });

    await expectDescribedBy(page, 'Contraseña', PASSWORD_ERROR);
    await expectDescribedBy(page, 'Acepto los términos y condiciones', TERMS_ERROR);

    await fillAndSubmit(page, { username: '', email: '', password: '', acceptTerms: false });

    await expect(page.getByText('Introduce un nombre de usuario.')).toBeVisible();
    await expect(page.getByText('Introduce tu email.')).toBeVisible();

    await fillAndSubmit(page, { email: 'ana@', password: '123456', acceptTerms: false });

    await expect(page.getByText('Introduce un email válido.')).toBeVisible();
    await expect(page.getByText(PASSWORD_ERROR)).toHaveCount(0);
    expect(register.requestBodies).toEqual([]);
  });

  test('R3: sends a single request while waiting and shows "Creando cuenta…"', async ({
    page,
  }) => {
    let releaseResponse: () => void = () => undefined;
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let requestReceived: () => void = () => undefined;
    const requestArrived = new Promise<void>((resolve) => {
      requestReceived = resolve;
    });
    const register = await mockRegister(page, async () => {
      requestReceived();
      await responseReleased;
      return created();
    });
    await page.goto('/registro');
    await fillForm(page);

    await submitButton(page).dblclick();
    await requestArrived;

    await expect(page.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled();
    expect(register.requestBodies).toEqual([ANA_REGISTRATION]);

    releaseResponse();

    await expect(page).toHaveURL(/\/lanzamientos$/);
    expect(register.requestBodies).toHaveLength(1);
  });

  test('R4: starts the session and returns to volver', async ({ page }) => {
    const register = await mockRegister(page, () => created());
    const login = await mockLogin(page, () => ({ body: anaAuthResponse(ANA_TOKEN) }));
    await page.goto('/registro?volver=/lanzamientos/activity-1');

    await fillAndSubmit(page);

    await expect(page).toHaveURL(/\/lanzamientos\/activity-1$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Misión Luna' })).toBeVisible();
    await expect(header(page)).toContainText('ana');
    await expect(header(page).getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    expect(await readStoredSession(page)).toEqual(ANA_STORED_SESSION);
    expect(register.requestBodies).toEqual([ANA_REGISTRATION]);
    expect(login.requestBodies).toEqual([]);
  });

  test('R4: ignores an external volver', async ({ page }) => {
    await mockRegister(page, () => created());
    await page.goto('/registro?volver=https%3A%2F%2Fmalicioso.example');

    await fillAndSubmit(page);

    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expect(header(page).getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });

  test('R5: shows the existing email error and keeps the data', async ({ page }) => {
    await mockRegister(page, () => ({ status: 400, body: errorResponses.emailAlreadyRegistered }));
    await page.goto('/registro');

    await fillAndSubmit(page);

    await expectDescribedBy(page, 'Email', 'Ya existe una cuenta con este email.');
    await expect(page.getByLabel('Nombre de usuario')).toHaveValue('ana');
    await expect(page.getByLabel('Email')).toHaveValue('ana@ejemplo.com');
    await expect(page).toHaveURL(/\/registro$/);
    expect(await readStoredSession(page)).toBeNull();
  });

  test('R6: shows the API field errors in Spanish', async ({ page }) => {
    await mockRegister(page, () => ({
      status: 400,
      body: errorResponses.registerValidationFailed,
    }));
    await page.goto('/registro');

    await fillAndSubmit(page);

    await expectDescribedBy(page, 'Nombre de usuario', 'Introduce un nombre de usuario válido.');
    await expectDescribedBy(page, 'Contraseña', PASSWORD_ERROR);
  });

  test('R7: links to /registro from the header without a session', async ({ page }) => {
    await page.goto('/lanzamientos/activity-1');

    await expect(header(page).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/registro?volver=%2Flanzamientos%2Factivity-1',
    );
  });

  test('R7: hides the register link with a session', async ({ page }) => {
    await seedSession(page, sessionValue());
    await page.goto('/lanzamientos/activity-1');

    await expect(header(page).getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Crear cuenta' })).toHaveCount(0);
  });

  test('R8: goes from /acceso to /registro and back keeping volver', async ({ page }) => {
    await page.goto('/acceso?volver=/reservas');

    await page.getByRole('link', { name: '¿No tienes cuenta? Crea una' }).click();

    await expect(page).toHaveURL(/\/registro\?volver=%2Freservas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeVisible();

    await page.getByRole('link', { name: '¿Ya tienes cuenta? Inicia sesión' }).click();

    await expect(page).toHaveURL(/\/acceso\?volver=%2Freservas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
  });

  test('shows the network error and keeps the data', async ({ page }) => {
    await mockRegister(page, () => 'abort');
    await page.goto('/registro');

    await fillAndSubmit(page);

    await expect(page.getByRole('alert')).toContainText(NETWORK_TEXT);
    await expect(page.getByLabel('Nombre de usuario')).toHaveValue('ana');
    await expect(page.getByLabel('Email')).toHaveValue('ana@ejemplo.com');
    await expect(termsCheckbox(page)).toBeChecked();
    await expect(submitButton(page)).toBeEnabled();
  });

  test('shows the server error on a 500', async ({ page }) => {
    await mockRegister(page, () => ({ status: 500, body: errorResponses.failedToRegisterUser }));
    await page.goto('/registro');

    await fillAndSubmit(page);

    await expect(page.getByRole('alert')).toContainText(SERVER_TEXT);
    await expect(page.getByLabel('Email')).toHaveValue('ana@ejemplo.com');
  });
});

// Completed POST requests to /users (StrictMode is on in the dev server used by the tests).
function trackFinishedRegisterRequests(page: Page): string[] {
  const finished: string[] = [];
  page.on('requestfinished', (request) => {
    if (request.method() === 'POST' && request.url() === `${API_URL}/users`) {
      finished.push(request.url());
    }
  });
  return finished;
}

test.describe('user registration edge cases', () => {
  test('R3: a double click and Enter while waiting finish a single POST /users', async ({
    page,
  }) => {
    const finished = trackFinishedRegisterRequests(page);
    let releaseResponse: () => void = () => undefined;
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    const register = await mockRegister(page, async () => {
      await responseReleased;
      return created();
    });
    await page.goto('/registro');
    await fillForm(page);

    await submitButton(page).dblclick();
    await expect(page.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled();
    await page.getByLabel('Contraseña').press('Enter');

    releaseResponse();

    await expect(page).toHaveURL(/\/lanzamientos$/);
    await expect(header(page).getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    expect(register.requestBodies).toEqual([ANA_REGISTRATION]);
    expect(finished).toEqual([`${API_URL}/users`]);
  });

  test('R3: sends the trimmed username and email and the password as typed', async ({ page }) => {
    const register = await mockRegister(page, () => created());
    await page.goto('/registro');

    await fillAndSubmit(page, {
      username: '  ana ',
      email: ' ana@ejemplo.com  ',
      password: ' secreto1 ',
    });

    await expect(page).toHaveURL(/\/lanzamientos$/);
    expect(register.requestBodies).toEqual([
      { username: 'ana', email: 'ana@ejemplo.com', password: ' secreto1 ', terms: true },
    ]);
  });

  for (const volver of ['//malicioso.example', '/registro', '/acceso?volver=%2Freservas']) {
    test(`R4: goes to /lanzamientos after registering with volver ${volver}`, async ({ page }) => {
      await mockRegister(page, () => created());
      await page.goto(`/registro?volver=${encodeURIComponent(volver)}`);

      await fillAndSubmit(page);

      await expect(page).toHaveURL(/\/lanzamientos$/);
      await expect(header(page).getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    });
  }

  test('redirects an existing session from /registro to volver without calling the API', async ({
    page,
  }) => {
    await seedSession(page, sessionValue());
    const register = await mockRegister(page, () => created());

    await page.goto('/registro?volver=%2Flanzamientos%2Factivity-1');

    await expect(page).toHaveURL(/\/lanzamientos\/activity-1$/);
    await expect(header(page).getByRole('link', { name: 'Crear cuenta' })).toHaveCount(0);
    expect(register.requestBodies).toEqual([]);
  });

  test('R6: shows several API field errors and an unknown field', async ({ page }) => {
    await mockRegister(page, () => ({
      status: 400,
      body: {
        message: 'Validation failed',
        errors: [
          { field: 'username', message: 'Username is required and must be a non-empty string' },
          {
            field: 'password',
            message: 'Password is required and must be at least 6 characters long',
          },
          { field: 'terms', message: 'Terms acceptance is required' },
          { field: 'foo', message: 'bad value' },
        ],
      },
    }));
    await page.goto('/registro');

    await fillAndSubmit(page);

    await expectDescribedBy(page, 'Nombre de usuario', 'Introduce un nombre de usuario válido.');
    await expectDescribedBy(page, 'Contraseña', PASSWORD_ERROR);
    await expectDescribedBy(page, 'Acepto los términos y condiciones', TERMS_ERROR);
    await expect(page.getByRole('alert')).toContainText(
      'Revisa los datos marcados. Dato no válido (bad value)',
    );
    await expect(page.getByLabel('Nombre de usuario')).toHaveValue('ana');
  });

  test('keeps the data after a 500 and registers on retry', async ({ page }) => {
    const register = await mockRegister(page, (_request, attempt) =>
      attempt === 1 ? { status: 500, body: { message: 'Internal', errors: [] } } : created(),
    );
    await page.goto('/registro');

    await fillAndSubmit(page);
    await expect(page.getByRole('alert')).toContainText(SERVER_TEXT);
    await expect(page.getByLabel('Contraseña')).toHaveValue('secreto1');
    await expect(termsCheckbox(page)).toBeChecked();

    await submitButton(page).click();

    await expect(page).toHaveURL(/\/lanzamientos$/);
    expect(register.requestBodies).toEqual([ANA_REGISTRATION, ANA_REGISTRATION]);
  });

  for (const path of ['/acceso', '/registro']) {
    test(`R7: the header links on ${path} keep volver without nesting it`, async ({ page }) => {
      await page.goto(`${path}?volver=%2Freservas`);

      await expect(header(page).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
        'href',
        '/registro?volver=%2Freservas',
      );
      await expect(header(page).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
        'href',
        '/acceso?volver=%2Freservas',
      );
    });
  }

  test('R7: the header register link goes to /registro and back after registering', async ({
    page,
  }) => {
    await mockRegister(page, () => created());
    await page.goto('/lanzamientos/activity-1');

    await header(page).getByRole('link', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/registro\?volver=%2Flanzamientos%2Factivity-1$/);
    await fillAndSubmit(page);

    await expect(page).toHaveURL(/\/lanzamientos\/activity-1$/);
    await expect(header(page)).toContainText('ana');
  });
});
