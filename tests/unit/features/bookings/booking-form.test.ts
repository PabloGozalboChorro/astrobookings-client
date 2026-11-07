import { describe, expect, it } from 'vitest';
import { ApiError, classifyApiError, ContractError, NetworkError } from '../../../../src/api/errors';
import { parseAvailableSeats } from '../../../../src/domain/api-errors';
import {
  bookingErrorFeedback,
  parseParticipants,
  validateParticipants,
} from '../../../../src/features/bookings/booking-form';

const INVALID_TEXT = 'Introduce un número entero de plazas mayor o igual que 1.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';

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

describe('parseParticipants', () => {
  it.each<[string, number | null]>([
    ['1', 1],
    ['2', 2],
    [' 3 ', 3],
    ['', null],
    [' ', null],
    ['0', null],
    ['-1', null],
    ['1.5', null],
    ['abc', null],
    ['1e400', null],
  ])('R3, R4: parseParticipants(%j) is %s', (raw, expected) => {
    expect(parseParticipants(raw)).toBe(expected);
  });
});

describe('validateParticipants', () => {
  it.each(['', '0', '-1', '1.5', 'abc'])('R4: rejects %j', (raw) => {
    expect(validateParticipants(raw, 6)).toEqual({ ok: false, error: INVALID_TEXT });
  });

  it('R5: rejects more seats than the max', () => {
    expect(validateParticipants('7', 6)).toEqual({
      ok: false,
      error: 'Puedes reservar como máximo 6 plazas.',
    });
  });

  it('R5: uses the singular with max 1', () => {
    expect(validateParticipants('2', 1)).toEqual({
      ok: false,
      error: 'Puedes reservar como máximo 1 plaza.',
    });
  });

  it('R5: accepts the max', () => {
    expect(validateParticipants('6', 6)).toEqual({ ok: true, participants: 6 });
  });
});

describe('bookingErrorFeedback', () => {
  it('R10: returns the capacity text and the available seats', () => {
    expect(
      bookingErrorFeedback(apiError(400, 'Capacity exceeded. Available: 2, Requested: 5')),
    ).toEqual({ alert: 'Solo quedan 2 plazas libres.', availableSeats: 2 });
  });

  it('R10: returns zero available seats', () => {
    expect(
      bookingErrorFeedback(apiError(400, 'Capacity exceeded. Available: 0, Requested: 1')),
    ).toEqual({ alert: 'No quedan plazas libres en este lanzamiento.', availableSeats: 0 });
  });

  it('R10: returns no available seats for an unexpected capacity text', () => {
    expect(bookingErrorFeedback(apiError(400, 'Capacity exceeded'))).toEqual({
      alert: 'No hay plazas suficientes para tu solicitud.',
    });
  });

  it('R12: puts the participants error next to the field', () => {
    const error = apiError(400, 'Validation failed', [
      {
        field: 'participants',
        message: 'Participants is required and must be a positive number (at least 1)',
      },
    ]);

    expect(bookingErrorFeedback(error)).toEqual({ fieldError: INVALID_TEXT });
  });

  it('R12: shows the errors of other fields in the alert', () => {
    const error = apiError(400, 'Validation failed', [
      { field: 'activityId', message: 'Activity ID is required and must be a non-empty string' },
      {
        field: 'participants',
        message: 'Participants is required and must be a positive number (at least 1)',
      },
    ]);

    expect(bookingErrorFeedback(error)).toEqual({
      fieldError: INVALID_TEXT,
      alert: 'El lanzamiento indicado no es válido.',
    });
  });

  it.each<[string, unknown, string]>([
    [
      '402',
      apiError(402, 'Payment could not be processed'),
      'El pago no se ha podido procesar. La reserva no se ha realizado.',
    ],
    ['404', apiError(404, 'Activity not found'), 'Este lanzamiento no existe o ya no está disponible.'],
    ['500', apiError(500, 'Internal Server Error'), SERVER_TEXT],
    ['400 Failed to create booking', apiError(400, 'Failed to create booking'), SERVER_TEXT],
    ['a network error', new NetworkError(), NETWORK_TEXT],
    ['a contract error', new ContractError(), 'El servidor ha devuelto una respuesta inesperada.'],
  ])('R11, R12: shows the alert for %s', (_label, error, expected) => {
    expect(bookingErrorFeedback(error)).toEqual({ alert: expected });
  });

  it('R12: returns no text for a 401 (the session flow handles it)', () => {
    expect(
      bookingErrorFeedback(apiError(401, 'Invalid or expired token. Please login again.')),
    ).toEqual({});
  });
});
