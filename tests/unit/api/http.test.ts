import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, ContractError, NetworkError } from '../../../src/api/errors';
import { http, onSessionRejected, setAccessTokenGetter } from '../../../src/api/http';
import { toUserMessage } from '../../../src/domain/api-errors';
import { captureError, jsonResponse, mockFetch, sentRequest } from '../support/http';

const idSchema = z.object({ id: z.string() });

function sentHeaders(fetchSpy: ReturnType<typeof mockFetch>): Headers {
  return new Headers(sentRequest(fetchSpy).init.headers);
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
});

afterEach(() => {
  setAccessTokenGetter(() => null);
  vi.restoreAllMocks();
});

describe('http', () => {
  it('R1: sends an authenticated request to VITE_API_URL with JSON and Bearer headers', async () => {
    setAccessTokenGetter(() => 'abc.def.ghi');
    const fetchSpy = mockFetch(jsonResponse(200, { id: 'b1' }));

    await http('/bookings', idSchema, { auth: true });

    expect(sentRequest(fetchSpy).url).toBe('http://localhost:3000/bookings');
    const headers = sentHeaders(fetchSpy);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer abc.def.ghi');
  });

  it('R1: does not send Authorization on a request without auth', async () => {
    setAccessTokenGetter(() => 'abc.def.ghi');
    const fetchSpy = mockFetch(jsonResponse(200, { id: 'a1' }));

    await http('/activities', idSchema);

    expect(sentRequest(fetchSpy).url).toBe('http://localhost:3000/activities');
    const headers = sentHeaders(fetchSpy);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.has('Authorization')).toBe(false);
  });

  it('R1: does not send Authorization when auth is requested but there is no token', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, { id: 'b1' }));

    await http('/bookings', idSchema, { auth: true });

    expect(sentHeaders(fetchSpy).has('Authorization')).toBe(false);
  });

  it('R1: serialises the body as JSON and uses the given method', async () => {
    const fetchSpy = mockFetch(jsonResponse(201, { id: 'b2' }));

    await http('/bookings', idSchema, {
      method: 'POST',
      body: { activityId: 'a1', participants: 2 },
    });

    const { init } = sentRequest(fetchSpy);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"activityId":"a1","participants":2}');
  });

  it('R5: returns the parsed data when the response matches the schema', async () => {
    mockFetch(jsonResponse(200, { id: 'a1', extra: true }));

    await expect(http('/activities/a1', idSchema)).resolves.toEqual({ id: 'a1' });
  });

  it('R5: throws ContractError when a 2xx response does not match the schema', async () => {
    mockFetch(jsonResponse(200, { id: 7 }));

    const error = await captureError(http('/activities/a1', idSchema));

    expect(error).toBeInstanceOf(ContractError);
    expect(toUserMessage(error)).toBe('El servidor ha devuelto una respuesta inesperada.');
  });

  it('R5: throws ContractError when a 2xx body is not JSON', async () => {
    mockFetch(new Response('<html>ok</html>', { status: 200 }));

    await expect(http('/activities/a1', idSchema)).rejects.toBeInstanceOf(ContractError);
  });
});

describe('http errors', () => {
  it('R2: classifies a capacity error and reads the available seats', async () => {
    mockFetch(
      jsonResponse(400, { message: 'Capacity exceeded. Available: 2, Requested: 5', errors: [] }),
    );

    const error = await captureError(http('/bookings', idSchema, { method: 'POST' }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      kind: 'capacity',
      message: 'Capacity exceeded. Available: 2, Requested: 5',
      availableSeats: 2,
    });
  });

  it('R2: classifies a validation error and keeps the field errors', async () => {
    mockFetch(
      jsonResponse(400, {
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Invalid email' }],
      }),
    );

    const error = await captureError(http('/users', idSchema, { method: 'POST' }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'validation',
      message: 'Validation failed',
      fieldErrors: { email: 'Invalid email' },
      availableSeats: null,
    });
  });

  it('R2: keeps only the first error of a repeated field', async () => {
    mockFetch(
      jsonResponse(400, {
        message: 'Validation failed',
        errors: [
          { field: 'password', message: 'Password is required' },
          { field: 'password', message: 'Password too short' },
        ],
      }),
    );

    const error = await captureError(http('/users', idSchema, { method: 'POST' }));

    expect(error).toMatchObject({ fieldErrors: { password: 'Password is required' } });
  });

  it.each<[number, string, string]>([
    [401, 'Invalid email or password', 'unauthorized'],
    [402, 'Payment could not be processed', 'payment'],
    [404, 'Activity not found', 'not-found'],
    [503, 'Service unavailable', 'server'],
  ])('R2: classifies a %i response with "%s" as %s', async (status, message, expectedKind) => {
    mockFetch(jsonResponse(status, { message, errors: [] }));

    const error = await captureError(http('/activities/a1', idSchema));

    expect(error).toMatchObject({ status, kind: expectedKind, message, availableSeats: null });
  });

  it('R3: throws NetworkError when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await captureError(http('/activities', idSchema));

    expect(error).toBeInstanceOf(NetworkError);
    expect(toUserMessage(error)).toBe(
      'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.',
    );
  });

  it('R4: builds a generic ApiError when the error body is not JSON', async () => {
    mockFetch(new Response('<html>Internal Server Error</html>', { status: 500 }));

    const error = await captureError(http('/activities', idSchema));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, kind: 'server', message: '', fieldErrors: {} });
    expect(toUserMessage(error)).toBe(
      'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.',
    );
  });

  it('R4: builds a generic ApiError when the error body has an unexpected shape', async () => {
    mockFetch(jsonResponse(404, { error: 'x' }));

    const error = await captureError(http('/activities/a1', idSchema));

    expect(error).toMatchObject({ status: 404, kind: 'not-found', message: '', fieldErrors: {} });
    expect(toUserMessage(error)).toBe('No se ha encontrado lo que buscas.');
  });

  it('R4: builds a generic ApiError when the error body is empty', async () => {
    mockFetch(new Response(null, { status: 400 }));

    const error = await captureError(http('/bookings', idSchema, { method: 'POST' }));

    expect(error).toMatchObject({ status: 400, kind: 'server', message: '', fieldErrors: {} });
    expect(toUserMessage(error)).toBe('No se ha podido completar la operación.');
  });

  it('R11: rethrows an aborted fetch instead of a NetworkError', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('The operation was aborted.', 'AbortError'),
    );

    const error = await captureError(
      http('/activities', idSchema, { signal: controller.signal }),
    );

    expect(error).not.toBeInstanceOf(NetworkError);
    expect(error).toBeInstanceOf(DOMException);
    expect(error).toMatchObject({ name: 'AbortError' });
  });
});

describe('session rejected', () => {
  const unsubscribers: Array<() => void> = [];

  function subscribe() {
    const listener = vi.fn();
    unsubscribers.push(onSessionRejected(listener));
    return listener;
  }

  afterEach(() => {
    for (const unsubscribe of unsubscribers.splice(0)) {
      unsubscribe();
    }
  });

  it('R12: notifies session-rejected subscribers on a 401 of an authenticated request', async () => {
    const listener = subscribe();
    setAccessTokenGetter(() => 'abc.def.ghi');
    mockFetch(
      jsonResponse(401, { message: 'Invalid or expired token. Please login again.', errors: [] }),
    );

    const error = await captureError(http('/bookings', idSchema, { auth: true }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, kind: 'unauthorized' });
  });

  it('R12: does not notify on a 401 of a request without auth', async () => {
    const listener = subscribe();
    mockFetch(jsonResponse(401, { message: 'Invalid email or password', errors: [] }));

    const error = await captureError(
      http('/login', idSchema, { method: 'POST', body: { email: 'a@b.c', password: 'x' } }),
    );

    expect(listener).not.toHaveBeenCalled();
    expect(error).toMatchObject({ kind: 'unauthorized' });
  });

  it('R12: stops notifying after unsubscribing', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionRejected(listener);
    unsubscribe();
    mockFetch(
      jsonResponse(401, { message: 'Invalid or expired token. Please login again.', errors: [] }),
    );

    await captureError(http('/bookings', idSchema, { auth: true }));

    expect(listener).not.toHaveBeenCalled();
  });

  it.each([403, 500])(
    'R12: does not notify on a %i of an authenticated request',
    async (status) => {
      const listener = subscribe();
      mockFetch(jsonResponse(status, { message: 'Nope', errors: [] }));

      await captureError(http('/bookings', idSchema, { auth: true }));

      expect(listener).not.toHaveBeenCalled();
    },
  );
});
