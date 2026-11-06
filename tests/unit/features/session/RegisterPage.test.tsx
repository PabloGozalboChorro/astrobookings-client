import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onSessionRejected } from '../../../../src/api/http';
import { SESSION_STORAGE_KEY } from '../../../../src/features/session/session-storage';
import { deferred } from '../../support/deferred';
import { jsonResponse, mockFetch, requestedUrls, sentRequest } from '../../support/http';
import {
  currentLocation,
  fakeJwt,
  renderApp,
  storedSessionValue,
  storeSession,
} from '../../support/session';

const NOW = new Date('2026-11-06T10:00:00.000Z');
const ANA_TOKEN = fakeJwt({
  userId: 'user-3',
  email: 'ana@ejemplo.com',
  iat: 1793959200,
  exp: 1794045600,
});
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const REGISTRATION_BODY =
  '{"username":"ana","email":"ana@ejemplo.com","password":"secreto1","terms":true}';

function registerResponse() {
  return {
    user: { id: 3, username: 'ana', email: 'ana@ejemplo.com', terms: true },
    accessToken: ANA_TOKEN,
  };
}

function usernameInput() {
  return screen.getByLabelText('Nombre de usuario');
}

function emailInput() {
  return screen.getByLabelText('Email');
}

function passwordInput() {
  return screen.getByLabelText('Contraseña');
}

function termsCheckbox() {
  return screen.getByRole('checkbox', { name: 'Acepto los términos y condiciones' });
}

function submitButton() {
  return screen.getByRole('button', { name: 'Crear cuenta' });
}

type FormInput = {
  username?: string;
  email?: string;
  password?: string;
  acceptTerms?: boolean;
};

async function fillForm(
  user: UserEvent,
  {
    username = 'ana',
    email = 'ana@ejemplo.com',
    password = 'secreto1',
    acceptTerms = true,
  }: FormInput = {},
) {
  if (username !== '') {
    await user.type(usernameInput(), username);
  }
  if (email !== '') {
    await user.type(emailInput(), email);
  }
  if (password !== '') {
    await user.type(passwordInput(), password);
  }
  if (acceptTerms) {
    await user.click(termsCheckbox());
  }
}

async function fillAndSubmit(user: UserEvent, input: FormInput = {}) {
  await fillForm(user, input);
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

describe('RegisterPage', () => {
  it('R1: shows the registration fields, the terms checkbox and the submit button', () => {
    renderApp('/registro');

    expect(screen.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeInTheDocument();
    expect(usernameInput()).toHaveAttribute('autocomplete', 'username');
    expect(emailInput()).toHaveAttribute('type', 'email');
    expect(emailInput()).toHaveAttribute('autocomplete', 'email');
    expect(passwordInput()).toHaveAttribute('type', 'password');
    expect(passwordInput()).toHaveAttribute('autocomplete', 'new-password');
    expect(termsCheckbox()).not.toBeChecked();
    expect(submitButton()).toHaveAttribute('type', 'submit');
    expect(submitButton()).toBeEnabled();
  });

  it('R2: shows the field errors and does not call the API', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro');

    await fillAndSubmit(user, { password: '12345', acceptTerms: false });

    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');
    expect(errorTextOf(passwordInput())).toBe('La contraseña debe tener al menos 6 caracteres.');
    expect(termsCheckbox()).toHaveAttribute('aria-invalid', 'true');
    expect(errorTextOf(termsCheckbox())).toBe('Debes aceptar los términos y condiciones.');
    expect(usernameInput()).not.toHaveAttribute('aria-invalid');
    expect(emailInput()).not.toHaveAttribute('aria-invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R2: shows the empty field errors', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro');

    await user.click(submitButton());

    expect(errorTextOf(usernameInput())).toBe('Introduce un nombre de usuario.');
    expect(errorTextOf(emailInput())).toBe('Introduce tu email.');
    expect(errorTextOf(passwordInput())).toBe('La contraseña debe tener al menos 6 caracteres.');
    expect(errorTextOf(termsCheckbox())).toBe('Debes aceptar los términos y condiciones.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R2: rejects an email without a valid format and accepts a password of 6', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro');

    await fillAndSubmit(user, { email: 'ana@', password: '123456' });

    expect(errorTextOf(emailInput())).toBe('Introduce un email válido.');
    expect(passwordInput()).not.toHaveAttribute('aria-invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R3: sends one request on double click and shows "Creando cuenta…" disabled', async () => {
    const user = userEvent.setup();
    const response = deferred<Response>();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise);
    renderApp('/registro');
    await fillForm(user);

    await user.dblClick(submitButton());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const { url, init } = sentRequest(fetchSpy);
    expect(url).toBe('http://localhost:3999/users');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(REGISTRATION_BODY);
    expect(screen.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled();

    response.resolve(jsonResponse(201, registerResponse()));

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('R3: sends the trimmed username and email and the password as typed', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro');

    await fillAndSubmit(user, {
      username: ' ana ',
      email: '  ana@ejemplo.com ',
      password: ' secreto1 ',
    });

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    expect(sentRequest(fetchSpy).init.body).toBe(
      '{"username":"ana","email":"ana@ejemplo.com","password":" secreto1 ","terms":true}',
    );
  });

  it('R4: starts the session and goes to the return path', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro?volver=/lanzamientos/activity-1');

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos/activity-1');
    });
    expect(storedSessionValue()).toEqual({
      accessToken: ANA_TOKEN,
      user: { username: 'ana', email: 'ana@ejemplo.com' },
      expiresAt: 1794045600000,
    });
    const header = screen.getByRole('banner');
    expect(header).toHaveTextContent('ana');
    expect(within(header).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(requestedUrls(fetchSpy)).toEqual(['http://localhost:3999/users']);
  });

  it('R4: goes to /lanzamientos without volver', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro');

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
  });

  it('R4: ignores an external volver', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro?volver=https%3A%2F%2Fmalicioso.example');

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
  });

  it('redirects to the return path when there is already a session', () => {
    storeSession();

    renderApp('/registro?volver=%2Fprotegida');

    expect(currentLocation()).toBe('/protegida');
  });

  it('R5: marks the email field and keeps the typed data', async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    const unsubscribe = onSessionRejected(listener);
    mockFetch(
      jsonResponse(400, {
        message: 'Email is already registered',
        errors: [{ field: 'email', message: 'Email is already registered' }],
      }),
    );
    renderApp('/registro');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa los datos marcados.');
    unsubscribe();
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(errorTextOf(emailInput())).toBe('Ya existe una cuenta con este email.');
    expect(usernameInput()).toHaveValue('ana');
    expect(emailInput()).toHaveValue('ana@ejemplo.com');
    expect(termsCheckbox()).toBeChecked();
    expect(currentLocation()).toBe('/registro');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    expect(submitButton()).toBeEnabled();
  });

  it('R6: shows the Spanish text of each API field error', async () => {
    const user = userEvent.setup();
    mockFetch(
      jsonResponse(400, {
        message: 'Validation failed',
        errors: [
          { field: 'username', message: 'Username is required' },
          { field: 'password', message: 'Password must be at least 6 characters' },
        ],
      }),
    );
    renderApp('/registro');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa los datos marcados.');
    expect(errorTextOf(usernameInput())).toBe('Introduce un nombre de usuario válido.');
    expect(errorTextOf(passwordInput())).toBe('La contraseña debe tener al menos 6 caracteres.');
    expect(emailInput()).not.toHaveAttribute('aria-invalid');
  });

  it('R6: shows an unknown field in the alert', async () => {
    const user = userEvent.setup();
    mockFetch(
      jsonResponse(400, {
        message: 'Validation failed',
        errors: [{ field: 'foo', message: 'bad value' }],
      }),
    );
    renderApp('/registro');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Dato no válido (bad value)');
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it('keeps the data and shows the network error', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/registro');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(NETWORK_TEXT);
    expect(usernameInput()).toHaveValue('ana');
    expect(emailInput()).toHaveValue('ana@ejemplo.com');
    expect(passwordInput()).toHaveValue('secreto1');
    expect(termsCheckbox()).toBeChecked();
    expect(submitButton()).toBeEnabled();
  });

  it('shows the server error on a 500', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(500, { message: 'Internal server error', errors: [] }));
    renderApp('/registro');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(SERVER_TEXT);
    expect(emailInput()).toHaveValue('ana@ejemplo.com');
    expect(currentLocation()).toBe('/registro');
  });

  it('R8: links to /acceso keeping volver', () => {
    renderApp('/registro?volver=/reservas');

    expect(screen.getByRole('link', { name: '¿Ya tienes cuenta? Inicia sesión' })).toHaveAttribute(
      'href',
      '/acceso?volver=%2Freservas',
    );
  });

  it('R8: links to /acceso without volver', () => {
    renderApp('/registro');

    expect(screen.getByRole('link', { name: '¿Ya tienes cuenta? Inicia sesión' })).toHaveAttribute(
      'href',
      '/acceso',
    );
  });
});

describe('RegisterPage edge cases', () => {
  const CONTRACT_TEXT = 'El servidor ha devuelto una respuesta inesperada.';

  it.each([false, true])(
    'R3: sends a single request with Enter and click while waiting (strict mode: %s)',
    async (strict) => {
      const user = userEvent.setup();
      const response = deferred<Response>();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise);
      renderApp('/registro', { strict });
      await fillForm(user);

      await user.type(passwordInput(), '{Enter}');
      await user.click(screen.getByRole('button', { name: 'Creando cuenta…' }));
      await user.type(emailInput(), '{Enter}');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled();

      response.resolve(jsonResponse(201, registerResponse()));

      await waitFor(() => {
        expect(currentLocation()).toBe('/lanzamientos');
      });
      expect(requestedUrls(fetchSpy)).toEqual(['http://localhost:3999/users']);
    },
  );

  it.each([false, true])(
    'R4: starts the session and goes to volver with its query (strict mode: %s)',
    async (strict) => {
      const user = userEvent.setup();
      const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
      renderApp('/registro?volver=%2Flanzamientos%2Factivity-1%3Fx%3D1', { strict });

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(currentLocation()).toBe('/lanzamientos/activity-1?x=1');
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(storedSessionValue()).toEqual({
        accessToken: ANA_TOKEN,
        user: { username: 'ana', email: 'ana@ejemplo.com' },
        expiresAt: 1794045600000,
      });
    },
  );

  it.each([
    '//malicioso.example',
    '/\\malicioso.example',
    'javascript:alert(1)',
    '/registro',
    '/registro?volver=%2Freservas',
    '/acceso?volver=%2Freservas',
    '',
  ])('R4: goes to /lanzamientos after registering with the unsafe volver %j', async (volver) => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(201, registerResponse()));
    renderApp(`/registro?volver=${encodeURIComponent(volver)}`);

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
  });

  it.each(['//malicioso.example', '/registro', '/acceso'])(
    'redirects an existing session to /lanzamientos with the unsafe volver %j',
    (volver) => {
      storeSession();

      renderApp(`/registro?volver=${encodeURIComponent(volver)}`);

      expect(currentLocation()).toBe('/lanzamientos');
    },
  );

  it('redirects an existing session to /lanzamientos without volver and calls no API', () => {
    storeSession();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));

    renderApp('/registro');

    expect(currentLocation()).toBe('/lanzamientos');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R6: marks every form field and lists the unknown field for a 400 with several errors', async () => {
    const user = userEvent.setup();
    mockFetch(
      jsonResponse(400, {
        message: 'Validation failed',
        errors: [
          { field: 'username', message: 'Username is required and must be a non-empty string' },
          { field: 'email', message: 'Email must be a valid email address' },
          {
            field: 'password',
            message: 'Password is required and must be at least 6 characters long',
          },
          { field: 'terms', message: 'Terms acceptance is required' },
          { field: 'body', message: 'Request body must be an object' },
        ],
      }),
    );
    renderApp('/registro');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Revisa los datos marcados. Dato no válido (Request body must be an object)',
    );
    for (const control of [usernameInput(), emailInput(), passwordInput(), termsCheckbox()]) {
      expect(control).toHaveAttribute('aria-invalid', 'true');
    }
    expect(errorTextOf(usernameInput())).toBe('Introduce un nombre de usuario válido.');
    expect(errorTextOf(passwordInput())).toBe('La contraseña debe tener al menos 6 caracteres.');
    expect(errorTextOf(termsCheckbox())).toBe('Debes aceptar los términos y condiciones.');
    expect(errorTextOf(emailInput()).length).toBeGreaterThan(0);
    expect(usernameInput()).toHaveValue('ana');
    expect(termsCheckbox()).toBeChecked();
  });

  it('shows the API text of a 400 Failed to register user and keeps the data', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(400, { message: 'Failed to register user', errors: [] }));
    renderApp('/registro');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha podido completar la operación (Failed to register user)',
    );
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(usernameInput()).toHaveValue('ana');
    expect(passwordInput()).toHaveValue('secreto1');
  });

  it('shows the contract error and does not start a session on a 201 without token', async () => {
    const user = userEvent.setup();
    mockFetch(jsonResponse(201, { user: registerResponse().user }));
    renderApp('/registro');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(CONTRACT_TEXT);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(currentLocation()).toBe('/registro');
  });

  it('shows an error alert and does not start a session on an empty 201 body', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 201 }));
    renderApp('/registro');

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(currentLocation()).toBe('/registro');
  });

  it('R5: registers after correcting the existing email', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(400, {
          message: 'Email is already registered',
          errors: [{ field: 'email', message: 'Email is already registered' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(201, registerResponse()));
    renderApp('/registro');
    await fillAndSubmit(user);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.clear(emailInput());
    await user.type(emailInput(), 'ana2@ejemplo.com');
    await user.click(submitButton());

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]?.[1]?.body).toBe(
      '{"username":"ana","email":"ana2@ejemplo.com","password":"secreto1","terms":true}',
    );
  });

  it('R2: sends the request once the client errors are corrected', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro');
    await fillAndSubmit(user, { password: '12345', acceptTerms: false });
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');

    await user.type(passwordInput(), '6');
    await user.click(termsCheckbox());
    await user.click(submitButton());

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('R2: does not send a username of only spaces', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro');

    await fillAndSubmit(user, { username: '   ' });

    expect(errorTextOf(usernameInput())).toBe('Introduce un nombre de usuario.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R4: stores the user returned by the API when the email was typed in upper case', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro');

    await fillAndSubmit(user, { email: 'Ana@Ejemplo.com' });

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    expect(sentRequest(fetchSpy).init.body).toBe(
      '{"username":"ana","email":"Ana@Ejemplo.com","password":"secreto1","terms":true}',
    );
    expect(storedSessionValue()).toMatchObject({
      user: { username: 'ana', email: 'ana@ejemplo.com' },
    });
  });

  it('R4: sends no Authorization header and never calls /login', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(jsonResponse(201, registerResponse()));
    renderApp('/registro');

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(currentLocation()).toBe('/lanzamientos');
    });
    expect(new Headers(sentRequest(fetchSpy).init.headers).has('Authorization')).toBe(false);
    expect(requestedUrls(fetchSpy)).toEqual(['http://localhost:3999/users']);
  });
});
