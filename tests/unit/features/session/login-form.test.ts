import { describe, expect, it } from 'vitest';
import { ApiError, ContractError, NetworkError } from '../../../../src/api/errors';
import {
  loginErrorMessage,
  validateLoginForm,
} from '../../../../src/features/session/login-form';

function apiError(status: number, message: string): ApiError {
  return new ApiError({
    status,
    kind: status === 401 ? 'unauthorized' : 'server',
    message,
    fieldErrors: {},
    availableSeats: null,
  });
}

describe('validateLoginForm', () => {
  it.each<[string, { email: string; password: string }, Record<string, string>]>([
    [
      'empty fields',
      { email: '', password: '' },
      { email: 'Introduce tu email.', password: 'Introduce tu contraseña.' },
    ],
    [
      'blank fields',
      { email: '   ', password: '   ' },
      { email: 'Introduce tu email.', password: 'Introduce tu contraseña.' },
    ],
    ['an email without domain', { email: 'ana@ejemplo', password: 'secreto1' }, { email: 'Introduce un email válido.' }],
    ['an email without @', { email: 'ana.ejemplo.com', password: 'secreto1' }, { email: 'Introduce un email válido.' }],
    ['an email with spaces', { email: 'ana maria@ejemplo.com', password: 'secreto1' }, { email: 'Introduce un email válido.' }],
    ['valid values', { email: 'ana@ejemplo.com', password: 'secreto1' }, {}],
    ['a valid email with surrounding spaces', { email: '  ana@ejemplo.com  ', password: ' x ' }, {}],
  ])('R2: validates %s', (_label, values, expected) => {
    expect(validateLoginForm(values)).toEqual(expected);
  });
});

describe('loginErrorMessage', () => {
  it.each(['Invalid email or password', 'Authentication failed', ''])(
    'R6: shows the invalid credentials text for a 401 "%s"',
    (message) => {
      expect(loginErrorMessage(apiError(401, message))).toBe('Email o contraseña incorrectos.');
    },
  );

  it.each<[string, unknown, string]>([
    [
      'a network error',
      new NetworkError(),
      'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.',
    ],
    [
      'a 500',
      apiError(500, 'Internal'),
      'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.',
    ],
    ['a contract error', new ContractError(), 'El servidor ha devuelto una respuesta inesperada.'],
  ])('uses the common error text for %s', (_label, error, expected) => {
    expect(loginErrorMessage(error)).toBe(expected);
  });
});
