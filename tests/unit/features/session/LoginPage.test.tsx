import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onSessionRejected } from '../../../../src/api/http';
import { SESSION_STORAGE_KEY } from '../../../../src/features/session/session-storage';
import { deferred } from '../../support/deferred';
import { jsonResponse, mockFetch, sentRequest } from '../../support/http';
import {
  currentLocation,
  fakeJwt,
  renderApp,
  SESSION_TEXT,
  storedSessionValue,
  storeSession,
} from '../../support/session';

const NOW = new Date('2026-11-06T10:00:00.000Z');
const ANA_TOKEN = fakeJwt({
  userId: 'user-2',
  email: 'ana@ejemplo.com',
  iat: 1793959200,
  exp: 1794045600,
});
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const INVALID_CREDENTIALS_TEXT = 'Email o contraseña incorrectos.';

function authResponse(accessToken = ANA_TOKEN) {
  return {
    user: { id: 2, username: 'ana', email: 'ana@ejemplo.com', terms: true },
    accessToken,
  };
}

function emailInput() {
  return screen.getByLabelText('Email');
}

function passwordInput() {
  return screen.getByLabelText('Contraseña');
}

function submitButton() {
  return screen.getByRole('button', { name: 'Iniciar sesión' });
}

async function fillAndSubmit(user: UserEvent, email = 'ana@ejemplo.com', password = 'secreto1') {
  await user.type(emailInput(), email);
  await user.type(passwordInput(), password);
  await user.click(submitButton());
}

function errorTextOf(input: HTMLElement): string {
  const errorId = input.getAttribute('aria-describedby');
  expect(errorId).not.toBeNull();
  return document.getElementById(errorId ?? '')?.textContent ?? '';
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LoginPage', () => {
  it('R1: shows the email and password fields and the submit button', () => {
    renderApp('/acceso');

    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(emailInput()).toHaveAttribute('type', 'email');
    expect(emailInput()).toHaveAttribute('autocomplete', 'email');
    expect(passwordInput()).toHaveAttribute('type', 'password');
    expect(passwordInput()).toHaveAttribute('autocomplete', 'current-password');
    expect(submitButton()).toHaveAttribute('type', 'submit');
    expect(submitButton()).toBeEnabled();
  });

  it('R2: shows field errors and does not call the API', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(200, authResponse()));
    renderApp('/acceso');

    await user.click(submitButton());

    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(errorTextOf(emailInput())).toBe('Introduce tu email.');
    expect(errorTextOf(passwordInput())).toBe('Introduce tu contraseña.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R2: rejects an email without a valid format', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(200, authResponse()));
    renderApp('/acceso');

    await fillAndSubmit(user, 'ana@ejemplo');

    expect(errorTextOf(emailInput())).toBe('Introduce un email válido.');
    expect(passwordInput()).not.toHaveAttribute('aria-invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R2: clears the field errors once the values are valid', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(401, { message: 'Invalid email or password', errors: [] }));
    renderApp('/acceso');
    await user.click(submitButton());

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_CREDENTIALS_TEXT);
    expect(emailInput()).not.toHaveAttribute('aria-invalid');
    expect(passwordInput()).not.toHaveAttribute('aria-invalid');
  });

  it('R3: sends one request on double click and shows "Entrando…" disabled', async () => {
    const user = userEvent.setup();
    const response = deferred<Response>();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise);
    renderApp('/acceso');
    await user.type(emailInput(), 'ana@ejemplo.com');
    await user.type(passwordInput(), 'secreto1');

    await user.dblClick(submitButton());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const { url, init } = sentRequest(fetchSpy);
    expect(url).toBe('http://localhost:3999/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"email":"ana@ejemplo.com","password":"secreto1"}');
    const button = screen.getByRole('button', { name: 'Entrando…' });
    expect(button).toBeDisabled();

    response.resolve(jsonResponse(200, authResponse()));

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('R3: sends the trimmed email and the password as typed', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(200, authResponse()));
    renderApp('/acceso');

    await fillAndSubmit(user, '  ana@ejemplo.com ', ' secreto1 ');

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    expect(sentRequest(fetchSpy).init.body).toBe(
      '{"email":"ana@ejemplo.com","password":" secreto1 "}',
    );
  });

  it('R4: stores the session and goes to the return path', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(200, authResponse()));
    renderApp('/acceso?volver=/lanzamientos/activity-1');

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos/activity-1');
    });
    expect(storedSessionValue()).toEqual({
      accessToken: ANA_TOKEN,
      user: { username: 'ana', email: 'ana@ejemplo.com' },
      expiresAt: 1794045600000,
    });
  });

  it('R4: does not keep the password in any browser storage', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(200, authResponse()));
    renderApp('/acceso');

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    const storedValues = [localStorage, sessionStorage].flatMap((storage) =>
      Object.keys(storage).map((key) => storage.getItem(key) ?? ''),
    );
    expect(storedValues.join('\n')).not.toContain('secreto1');
  });

  it('R4: falls back to 24 h for an opaque token', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(200, authResponse('opaque-token')));
    renderApp('/acceso');

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    expect(storedSessionValue()).toEqual({
      accessToken: 'opaque-token',
      user: { username: 'ana', email: 'ana@ejemplo.com' },
      expiresAt: NOW.getTime() + 86_400_000,
    });
  });

  it('R4: goes to /lanzamientos without volver', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(200, authResponse()));
    renderApp('/acceso');

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
  });

  it.each([
    ['%2Freservas%3Flanzamiento%3Dactivity-1', '/reservas?lanzamiento=activity-1'],
    ['https%3A%2F%2Fmalicioso.example', '/lanzamientos'],
    ['%2F%2Fmalicioso.example', '/lanzamientos'],
    ['reservas', '/lanzamientos'],
  ])('R5: with volver=%s goes to %s', async (volver, expectedPath) => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(200, authResponse()));
    renderApp(`/acceso?volver=${volver}`);

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(expectedPath);
    });
  });

  it.each(['Invalid email or password', 'Authentication failed'])(
    'R6: shows the invalid credentials alert without marking fields for "%s"',
    async (message) => {
      const user = userEvent.setup();
      const listener = vi.fn();
      const unsubscribe = onSessionRejected(listener);
      mockFetch(jsonResponse(401, { message, errors: [] }));
      renderApp('/acceso');

      await fillAndSubmit(user, 'ana@ejemplo.com', 'incorrecta');

      expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_CREDENTIALS_TEXT);
      unsubscribe();
      expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
      expect(currentLocation()).toBe('/acceso');
      expect(document.body).not.toHaveTextContent(SESSION_TEXT);
      expect(listener).not.toHaveBeenCalled();
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(submitButton()).toBeEnabled();
      expect(emailInput()).toHaveValue('ana@ejemplo.com');
      expect(passwordInput()).toHaveValue('incorrecta');
    },
  );

  it('shows the field errors of a 400 Validation failed', async () => {
    const user = userEvent.setup();
    mockFetch(
      jsonResponse(400, {
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Email is required' }],
      }),
    );
    renderApp('/acceso');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa los datos marcados.');
    expect(errorTextOf(emailInput())).toBe('Introduce un email válido.');
    expect(passwordInput()).not.toHaveAttribute('aria-invalid');
  });

  it('keeps the email and shows the network error', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/acceso');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(NETWORK_TEXT);
    expect(emailInput()).toHaveValue('ana@ejemplo.com');
    expect(submitButton()).toBeEnabled();
  });

  it('shows the server error on a 500', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(500, { message: 'Authentication failed', errors: [] }));
    renderApp('/acceso');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(SERVER_TEXT);
    expect(emailInput()).toHaveValue('ana@ejemplo.com');
  });

  it('redirects to the return path when there is already a session', () => {
    storeSession();

    renderApp('/acceso?volver=%2Fprotegida');

    expect(currentLocation()).toBe('/protegida');
  });

  it('R11: shows the expired session notice without a link', () => {
    storeSession({ expiresAt: NOW.getTime() - 1 });

    renderApp('/acceso');

    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent(SESSION_TEXT);
    expect(within(notice).queryByRole('link')).toBeNull();
  });

  it('R12: logging in from the notice returns to the protected route', async () => {
    const user = userEvent.setup();
    storeSession();
    let sessionAccepted = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('/login')) {
        sessionAccepted = true;
        return jsonResponse(200, authResponse());
      }
      return sessionAccepted
        ? jsonResponse(200, [])
        : jsonResponse(401, {
            message: 'Invalid or expired token. Please login again.',
            errors: [],
          });
    });
    renderApp('/protegida');

    await waitFor(() => {
      expect(currentLocation()).toBe('/acceso?volver=%2Fprotegida');
    });
    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_TEXT);

    await fillAndSubmit(user);

    expect(await screen.findByText('Petición: ready')).toBeInTheDocument();
    expect(currentLocation()).toBe('/protegida');
    expect(screen.queryByText(SESSION_TEXT)).toBeNull();
  });
});
