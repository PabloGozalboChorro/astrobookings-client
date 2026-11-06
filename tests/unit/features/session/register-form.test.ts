import { describe, expect, it } from 'vitest';
import { ApiError, ContractError, NetworkError } from '../../../../src/api/errors';
import { validateEmail } from '../../../../src/features/session/login-form';
import {
  registerErrorFeedback,
  validateRegisterForm,
  type RegisterFormValues,
} from '../../../../src/features/session/register-form';

const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const CONTRACT_TEXT = 'El servidor ha devuelto una respuesta inesperada.';

const VALID_VALUES: RegisterFormValues = {
  username: 'ana',
  email: 'ana@ejemplo.com',
  password: 'secreto1',
  termsAccepted: true,
};

function validationError(message: string, fieldErrors: Record<string, string>): ApiError {
  return new ApiError({
    status: 400,
    kind: 'validation',
    message,
    fieldErrors,
    availableSeats: null,
  });
}

describe('validateRegisterForm', () => {
  it.each<[string, Partial<RegisterFormValues>, Record<string, string>]>([
    [
      'empty fields',
      { username: '', email: '', password: '', termsAccepted: false },
      {
        username: 'Introduce un nombre de usuario.',
        email: 'Introduce tu email.',
        password: 'La contraseña debe tener al menos 6 caracteres.',
        terms: 'Debes aceptar los términos y condiciones.',
      },
    ],
    ['a blank username', { username: '   ' }, { username: 'Introduce un nombre de usuario.' }],
    ['an email without domain', { email: 'ana@' }, { email: 'Introduce un email válido.' }],
    [
      'a password of 5 characters',
      { password: '12345' },
      { password: 'La contraseña debe tener al menos 6 caracteres.' },
    ],
    ['a password of 6 characters', { password: '123456' }, {}],
    ['a password of 6 spaces', { password: '      ' }, {}],
    [
      'unaccepted terms',
      { termsAccepted: false },
      { terms: 'Debes aceptar los términos y condiciones.' },
    ],
    [
      'the acceptance criterion values',
      { password: '12345', termsAccepted: false },
      {
        password: 'La contraseña debe tener al menos 6 caracteres.',
        terms: 'Debes aceptar los términos y condiciones.',
      },
    ],
    ['valid values', {}, {}],
  ])('R2: validateRegisterForm with %s', (_label, overrides, expected) => {
    expect(validateRegisterForm({ ...VALID_VALUES, ...overrides })).toEqual(expected);
  });
});

describe('validateEmail', () => {
  it.each<[string, string | undefined]>([
    ['', 'Introduce tu email.'],
    ['   ', 'Introduce tu email.'],
    ['ana@ejemplo', 'Introduce un email válido.'],
    [' ana@ejemplo.com ', undefined],
  ])('R2: validateEmail(%j)', (email, expected) => {
    expect(validateEmail(email)).toBe(expected);
  });
});

describe('registerErrorFeedback', () => {
  it('R5: maps an existing email to the email field', () => {
    const error = validationError('Email is already registered', {
      email: 'Email is already registered',
    });

    expect(registerErrorFeedback(error)).toEqual({
      fieldErrors: { email: 'Ya existe una cuenta con este email.' },
      alert: 'Revisa los datos marcados.',
    });
  });

  it.each([
    ['the spec body', 'Username is required', 'Password must be at least 6 characters'],
    [
      'the API literals',
      'Username is required and must be a non-empty string',
      'Password is required and must be at least 6 characters long',
    ],
  ])('R6: maps the API field errors of %s', (_label, usernameMessage, passwordMessage) => {
    const error = validationError('Validation failed', {
      username: usernameMessage,
      password: passwordMessage,
    });

    expect(registerErrorFeedback(error)).toEqual({
      fieldErrors: {
        username: 'Introduce un nombre de usuario válido.',
        password: 'La contraseña debe tener al menos 6 caracteres.',
      },
      alert: 'Revisa los datos marcados.',
    });
  });

  it('R6: maps the terms field error', () => {
    const error = validationError('Validation failed', { terms: 'Terms acceptance is required' });

    expect(registerErrorFeedback(error).fieldErrors).toEqual({
      terms: 'Debes aceptar los términos y condiciones.',
    });
  });

  it('R6: lists unknown fields in the alert', () => {
    const error = validationError('Validation failed', { foo: 'bad value' });

    expect(registerErrorFeedback(error)).toEqual({
      fieldErrors: {},
      alert: 'Dato no válido (bad value)',
    });
  });

  it('R6: adds unknown fields to the alert next to the form field errors', () => {
    const error = validationError('Validation failed', {
      username: 'Username is required',
      body: 'Request body must be an object',
    });

    expect(registerErrorFeedback(error)).toEqual({
      fieldErrors: { username: 'Introduce un nombre de usuario válido.' },
      alert: 'Revisa los datos marcados. Dato no válido (Request body must be an object)',
    });
  });

  it.each<[string, unknown, string]>([
    ['a network error', new NetworkError(), NETWORK_TEXT],
    [
      'a 500',
      new ApiError({
        status: 500,
        kind: 'server',
        message: 'Internal',
        fieldErrors: {},
        availableSeats: null,
      }),
      SERVER_TEXT,
    ],
    ['a contract error', new ContractError(), CONTRACT_TEXT],
    [
      'a 400 Failed to register user',
      new ApiError({
        status: 400,
        kind: 'server',
        message: 'Failed to register user',
        fieldErrors: {},
        availableSeats: null,
      }),
      'No se ha podido completar la operación (Failed to register user)',
    ],
  ])('uses the common error text for %s', (_label, error, expected) => {
    expect(registerErrorFeedback(error)).toEqual({ fieldErrors: {}, alert: expected });
  });
});
