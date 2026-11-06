import { describe, expect, it } from 'vitest';
import {
  ApiError,
  classifyApiError,
  ContractError,
  isNotFoundError,
  NetworkError,
  type ApiErrorKind,
} from '../../../src/api/errors';

describe('classifyApiError', () => {
  it('R2: classifies a 400 with field errors as validation', () => {
    const kind = classifyApiError(400, {
      message: 'Validation failed',
      errors: [{ field: 'email', message: 'Invalid email' }],
    });

    expect(kind).toBe('validation');
  });

  it('R2: classifies a 400 whose message starts with "Capacity exceeded" as capacity', () => {
    const kind = classifyApiError(400, {
      message: 'Capacity exceeded. Available: 2, Requested: 5',
      errors: [],
    });

    expect(kind).toBe('capacity');
  });

  it.each<[number, string, ApiErrorKind]>([
    [401, 'Invalid or expired token. Please login again.', 'unauthorized'],
    [402, 'Payment could not be processed', 'payment'],
    [404, 'Activity not found', 'not-found'],
    [503, 'Service unavailable', 'server'],
    [400, 'Launch window closed', 'server'],
    [409, 'Conflict', 'server'],
  ])('R2: classifies status %i with message "%s" as %s', (status, message, expectedKind) => {
    expect(classifyApiError(status, { message, errors: [] })).toBe(expectedKind);
  });

  it('R2: classifies by status when the error body could not be read', () => {
    expect(classifyApiError(400, null)).toBe('server');
    expect(classifyApiError(401, null)).toBe('unauthorized');
    expect(classifyApiError(404, null)).toBe('not-found');
    expect(classifyApiError(500, null)).toBe('server');
  });
});

describe('error classes', () => {
  it('R2: ApiError keeps its status, kind, field errors and available seats', () => {
    const error = new ApiError({
      status: 400,
      kind: 'capacity',
      message: 'Capacity exceeded. Available: 2, Requested: 5',
      fieldErrors: {},
      availableSeats: 2,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(400);
    expect(error.kind).toBe('capacity');
    expect(error.message).toBe('Capacity exceeded. Available: 2, Requested: 5');
    expect(error.fieldErrors).toEqual({});
    expect(error.availableSeats).toBe(2);
  });

  it('R3, R5: NetworkError and ContractError have their own names', () => {
    expect(new NetworkError().name).toBe('NetworkError');
    expect(new ContractError().name).toBe('ContractError');
  });
});

function apiError(status: number, kind: ApiErrorKind, message: string): ApiError {
  return new ApiError({ status, kind, message, fieldErrors: {}, availableSeats: null });
}

describe('isNotFoundError', () => {
  it('R3: isNotFoundError is true for a not-found ApiError, with or without message', () => {
    expect(isNotFoundError(apiError(404, 'not-found', 'Activity not found'))).toBe(true);
    expect(isNotFoundError(apiError(404, 'not-found', ''))).toBe(true);
  });

  it.each<[string, unknown]>([
    ['NetworkError', new NetworkError()],
    ['ContractError', new ContractError()],
    ['ApiError 500', apiError(500, 'server', 'Failed to retrieve activity')],
    ['Error', new Error('Activity not found')],
  ])('R3: isNotFoundError is false for %s', (_label, error) => {
    expect(isNotFoundError(error)).toBe(false);
  });
});
