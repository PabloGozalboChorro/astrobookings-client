import { describe, expect, it } from 'vitest';
import { ApiError, classifyApiError, ContractError, NetworkError } from '../../../src/api/errors';
import { ConfigError } from '../../../src/config';
import {
  fieldErrorMessage,
  fieldErrorMessages,
  parseAvailableSeats,
  toUserMessage,
} from '../../../src/domain/api-errors';

const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const CONTRACT_TEXT = 'El servidor ha devuelto una respuesta inesperada.';
const SESSION_TEXT = 'Tu sesión ha caducado o no es válida. Inicia sesión de nuevo.';
const PAYMENT_TEXT = 'El pago no se ha podido procesar. La reserva no se ha realizado.';

type FieldErrorDto = { field: string; message: string };

function apiError(status: number, message: string, errors: FieldErrorDto[] = []): ApiError {
  const kind = classifyApiError(status, { message, errors });
  const fieldErrors: Record<string, string> = {};
  for (const fieldError of errors) {
    fieldErrors[fieldError.field] ??= fieldError.message;
  }
  return new ApiError({
    status,
    kind,
    message,
    fieldErrors,
    availableSeats: kind === 'capacity' ? parseAvailableSeats(message) : null,
  });
}

function unreadableBodyError(status: number): ApiError {
  return new ApiError({
    status,
    kind: classifyApiError(status, null),
    message: '',
    fieldErrors: {},
    availableSeats: null,
  });
}

describe('parseAvailableSeats', () => {
  it('R6: reads the available seats from a capacity message', () => {
    expect(parseAvailableSeats('Capacity exceeded. Available: 2, Requested: 5')).toBe(2);
  });

  it('R6: reads zero available seats', () => {
    expect(parseAvailableSeats('Capacity exceeded. Available: 0, Requested: 1')).toBe(0);
  });

  it('R6: returns null when the message has no available seats', () => {
    expect(parseAvailableSeats('Capacity exceeded')).toBeNull();
  });
});

describe('toUserMessage', () => {
  it('R3: translates a network error', () => {
    expect(toUserMessage(new NetworkError())).toBe(NETWORK_TEXT);
  });

  it('R5: translates a contract error', () => {
    expect(toUserMessage(new ContractError())).toBe(CONTRACT_TEXT);
  });

  it.each<[number, string]>([
    [400, 'No se ha podido completar la operación.'],
    [401, SESSION_TEXT],
    [402, PAYMENT_TEXT],
    [404, 'No se ha encontrado lo que buscas.'],
    [409, SERVER_TEXT],
    [500, SERVER_TEXT],
    [503, SERVER_TEXT],
  ])('R4: shows the fixed text of status %i when the body cannot be read', (status, expected) => {
    expect(toUserMessage(unreadableBodyError(status))).toBe(expected);
  });

  it('R4: shows the server text for a 500 with a JSON message', () => {
    expect(toUserMessage(apiError(500, 'Failed to retrieve booking'))).toBe(SERVER_TEXT);
  });

  it.each<[number, string, FieldErrorDto[], string]>([
    [400, 'Validation failed', [{ field: 'email', message: 'Invalid email' }], 'Revisa los datos marcados.'],
    [
      400,
      'Email is already registered',
      [{ field: 'email', message: 'Email is already registered' }],
      'Ya existe una cuenta con este email.',
    ],
    [401, 'Invalid email or password', [], 'Email o contraseña incorrectos.'],
    [401, 'Authentication required. Please provide a valid token.', [], SESSION_TEXT],
    [401, 'Invalid or expired token. Please login again.', [], SESSION_TEXT],
    [402, 'Payment could not be processed', [], PAYMENT_TEXT],
    [404, 'Activity not found', [], 'Este lanzamiento no existe o ya no está disponible.'],
    [404, 'Booking not found', [], 'No encontramos esta reserva.'],
    [500, 'Failed to retrieve activities', [], SERVER_TEXT],
    [500, 'Failed to retrieve bookings', [], SERVER_TEXT],
  ])('R6: translates %i "%s"', (status, message, errors, expected) => {
    expect(toUserMessage(apiError(status, message, errors))).toBe(expected);
  });

  it('R12: maps "Failed to create booking" to the server text', () => {
    expect(toUserMessage(apiError(400, 'Failed to create booking'))).toBe(SERVER_TEXT);
  });

  it.each<[string, string]>([
    ['Capacity exceeded. Available: 2, Requested: 5', 'Solo quedan 2 plazas libres.'],
    ['Capacity exceeded. Available: 1, Requested: 3', 'Solo queda 1 plaza libre.'],
    ['Capacity exceeded. Available: 0, Requested: 1', 'No quedan plazas libres en este lanzamiento.'],
    ['Capacity exceeded', 'No hay plazas suficientes para tu solicitud.'],
  ])('R6: translates the capacity message "%s"', (message, expected) => {
    expect(toUserMessage(apiError(400, message))).toBe(expected);
  });

  it('R7: shows the generic text and the original message for an unknown message', () => {
    expect(toUserMessage(apiError(400, 'Launch window closed'))).toBe(
      'No se ha podido completar la operación (Launch window closed)',
    );
  });

  it.each<[number, string, string]>([
    [
      401,
      'Authentication failed',
      'Tu sesión ha caducado o no es válida. Inicia sesión de nuevo (Authentication failed)',
    ],
    [402, 'Card declined', 'El pago no se ha podido procesar (Card declined)'],
    [404, 'Rocket not found', 'No se ha encontrado lo que buscas (Rocket not found)'],
    [409, 'Conflict', 'Se ha producido un error en el servidor (Conflict)'],
  ])('R7: uses the generic text of status %i for "%s"', (status, message, expected) => {
    expect(toUserMessage(apiError(status, message))).toBe(expected);
  });

  it('shows the message of a configuration error', () => {
    const message = 'Error de configuración: falta la variable VITE_API_URL.';

    expect(toUserMessage(new ConfigError(message))).toBe(message);
  });

  it('shows the server text for any other error', () => {
    expect(toUserMessage(new TypeError('x is undefined'))).toBe(SERVER_TEXT);
    expect(toUserMessage('boom')).toBe(SERVER_TEXT);
  });
});

describe('fieldErrorMessage', () => {
  it.each<[string, string, string]>([
    ['username', 'Username is required', 'Introduce un nombre de usuario válido.'],
    ['email', 'Invalid email', 'Introduce un email válido.'],
    ['email', 'Email is already registered', 'Ya existe una cuenta con este email.'],
    ['password', 'Password too short', 'La contraseña debe tener al menos 6 caracteres.'],
    ['terms', 'Terms must be accepted', 'Debes aceptar los términos y condiciones.'],
    ['participants', 'Invalid participants', 'Introduce un número entero de plazas mayor o igual que 1.'],
    ['activityId', 'Invalid activityId', 'El lanzamiento indicado no es válido.'],
    ['foo', 'bad value', 'Dato no válido (bad value)'],
  ])('R8: translates the error of field %s with "%s"', (field, apiMessage, expected) => {
    expect(fieldErrorMessage(field, apiMessage)).toBe(expected);
  });
});

describe('fieldErrorMessages', () => {
  it('R8: translates every field error of a validation error, keeping the first per field', () => {
    const error = apiError(400, 'Validation failed', [
      { field: 'email', message: 'Invalid email' },
      { field: 'email', message: 'Email is already registered' },
      { field: 'foo', message: 'bad value' },
    ]);

    expect(fieldErrorMessages(error)).toEqual({
      email: 'Introduce un email válido.',
      foo: 'Dato no válido (bad value)',
    });
  });

  it('R8: returns no field errors for an error that is not an API error', () => {
    expect(fieldErrorMessages(new NetworkError())).toEqual({});
  });
});
