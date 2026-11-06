import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, ContractError } from '../../../src/api/errors';
import { http, onSessionRejected, setAccessTokenGetter } from '../../../src/api/http';
import { ConfigError } from '../../../src/config';
import { toUserMessage } from '../../../src/domain/api-errors';
import { captureError, jsonResponse, mockFetch, sentRequest } from '../support/http';

const idSchema = z.object({ id: z.string() });

const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
});

afterEach(() => {
  setAccessTokenGetter(() => null);
  vi.restoreAllMocks();
});

describe('http request edge cases', () => {
  it('R1: sends a GET without body by default', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, { id: 'a1' }));

    await http('/activities/a1', idSchema);

    const init = sentRequest(fetchSpy).init;
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('R1: removes the trailing slash of VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000/');
    const fetchSpy = mockFetch(jsonResponse(200, { id: 'a1' }));

    await http('/activities', idSchema);

    expect(sentRequest(fetchSpy).url).toBe('http://localhost:3000/activities');
  });

  it('R1: rejects with a ConfigError and does not call fetch when VITE_API_URL is missing', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const fetchSpy = mockFetch(jsonResponse(200, { id: 'a1' }));

    const error = await captureError(http('/activities', idSchema));

    expect(error).toBeInstanceOf(ConfigError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R11: passes the abort signal to fetch', async () => {
    const controller = new AbortController();
    const fetchSpy = mockFetch(jsonResponse(200, { id: 'a1' }));

    await http('/activities', idSchema, { signal: controller.signal });

    expect(sentRequest(fetchSpy).init.signal).toBe(controller.signal);
  });

  it('R5: throws ContractError when a 2xx response has an empty body', async () => {
    mockFetch(new Response(null, { status: 200 }));

    const error = await captureError(http('/activities', idSchema));

    expect(error).toBeInstanceOf(ContractError);
    expect(toUserMessage(error)).toBe('El servidor ha devuelto una respuesta inesperada.');
  });
});

describe('http error body edge cases', () => {
  it('R2: classifies a 400 with field errors as validation even if the message is a capacity one', async () => {
    mockFetch(
      jsonResponse(400, {
        message: 'Capacity exceeded. Available: 2, Requested: 5',
        errors: [{ field: 'participants', message: 'Invalid participants' }],
      }),
    );

    const error = await captureError(http('/bookings', idSchema, { method: 'POST' }));

    expect(error).toMatchObject({
      kind: 'validation',
      fieldErrors: { participants: 'Invalid participants' },
      availableSeats: null,
    });
  });

  it('R2: keeps availableSeats null when the capacity message has no number', async () => {
    mockFetch(jsonResponse(400, { message: 'Capacity exceeded', errors: [] }));

    const error = await captureError(http('/bookings', idSchema, { method: 'POST' }));

    expect(error).toMatchObject({ kind: 'capacity', availableSeats: null });
    expect(toUserMessage(error)).toBe('No hay plazas suficientes para tu solicitud.');
  });

  it('R2: reads zero available seats from a real capacity error', async () => {
    mockFetch(
      jsonResponse(400, { message: 'Capacity exceeded. Available: 0, Requested: 1', errors: [] }),
    );

    const error = await captureError(http('/bookings', idSchema, { method: 'POST' }));

    expect(error).toMatchObject({ kind: 'capacity', availableSeats: 0 });
    expect(toUserMessage(error)).toBe('No quedan plazas libres en este lanzamiento.');
  });

  it.each<[string, unknown]>([
    ['errors is missing', { message: 'Validation failed' }],
    ['errors is not an array', { message: 'Validation failed', errors: 'email' }],
    ['an error has no field', { message: 'Validation failed', errors: [{ message: 'Invalid email' }] }],
    ['message is not a string', { message: 42, errors: [] }],
    ['the body is a JSON array', [{ message: 'Validation failed' }]],
  ])('R4: treats a 400 body where %s as unreadable', async (_case, body) => {
    mockFetch(jsonResponse(400, body));

    const error = await captureError(http('/users', idSchema, { method: 'POST' }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, kind: 'server', message: '', fieldErrors: {} });
    expect(toUserMessage(error)).toBe('No se ha podido completar la operación.');
  });

  it.each([500, 502, 503])('R4: shows the server text for a %i with an HTML body', async (status) => {
    mockFetch(new Response('<html>Bad Gateway</html>', { status }));

    const error = await captureError(http('/activities', idSchema));

    expect(error).toMatchObject({ status, kind: 'server', message: '' });
    expect(toUserMessage(error)).toBe(SERVER_TEXT);
  });

  it('R7: keeps the original message of an unknown 400 for the generic text', async () => {
    mockFetch(jsonResponse(400, { message: 'Launch window closed', errors: [] }));

    const error = await captureError(http('/bookings', idSchema, { method: 'POST' }));

    expect(toUserMessage(error)).toBe('No se ha podido completar la operación (Launch window closed)');
  });
});

describe('session rejected edge cases', () => {
  const unsubscribers: Array<() => void> = [];

  afterEach(() => {
    for (const unsubscribe of unsubscribers.splice(0)) {
      unsubscribe();
    }
  });

  function subscribe(listener: () => void = vi.fn()) {
    unsubscribers.push(onSessionRejected(listener));
    return listener;
  }

  function mockExpiredToken() {
    return mockFetch(
      jsonResponse(401, { message: 'Invalid or expired token. Please login again.', errors: [] }),
    );
  }

  it('R12: notifies every subscriber once', async () => {
    const first = subscribe();
    const second = subscribe();
    setAccessTokenGetter(() => 'abc.def.ghi');
    mockExpiredToken();

    await captureError(http('/bookings', idSchema, { auth: true }));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('R12: keeps notifying the other subscribers after one unsubscribes', async () => {
    const kept = subscribe();
    const removed = vi.fn();
    const unsubscribe = onSessionRejected(removed);
    unsubscribe();
    setAccessTokenGetter(() => 'abc.def.ghi');
    mockExpiredToken();

    await captureError(http('/bookings', idSchema, { auth: true }));

    expect(kept).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
  });

  it('R12: notifies every subscriber even if one unsubscribes while being notified', async () => {
    const second = vi.fn();
    let unsubscribeFirst: () => void = () => undefined;
    unsubscribeFirst = onSessionRejected(() => {
      unsubscribeFirst();
    });
    unsubscribers.push(unsubscribeFirst);
    subscribe(second);
    setAccessTokenGetter(() => 'abc.def.ghi');
    mockExpiredToken();

    await captureError(http('/bookings', idSchema, { auth: true }));

    expect(second).toHaveBeenCalledTimes(1);
  });

  it('R12: does not notify a 401 of a request without auth even if there is a token', async () => {
    const listener = subscribe();
    setAccessTokenGetter(() => 'abc.def.ghi');
    const fetchSpy = mockFetch(jsonResponse(401, { message: 'Invalid email or password', errors: [] }));

    await captureError(http('/login', idSchema, { method: 'POST', body: {} }));

    expect(new Headers(sentRequest(fetchSpy).init.headers).has('Authorization')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('R12: notifies a 401 of an authenticated request whose body cannot be read and still throws', async () => {
    const listener = subscribe();
    setAccessTokenGetter(() => 'abc.def.ghi');
    mockFetch(new Response('Unauthorized', { status: 401 }));

    const error = await captureError(http('/bookings', idSchema, { auth: true }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ status: 401, kind: 'unauthorized', message: '' });
    expect(toUserMessage(error)).toBe('Tu sesión ha caducado o no es válida. Inicia sesión de nuevo.');
  });
});

describe('http cancellation while reading the body', () => {
  function abortingResponse(status: number, controller: AbortController): Response {
    const response = new Response('{}', { status, headers: { 'Content-Type': 'application/json' } });
    const abortWhileReading = (): Promise<never> => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      controller.abort(abortError);
      return Promise.reject(abortError);
    };
    vi.spyOn(response, 'json').mockImplementation(abortWhileReading);
    vi.spyOn(response, 'text').mockImplementation(abortWhileReading);
    return response;
  }

  it('R11: rethrows the AbortError when a 2xx body read is aborted instead of a ContractError', async () => {
    const controller = new AbortController();
    mockFetch(abortingResponse(200, controller));

    const error = await captureError(http('/activities/a1', idSchema, { signal: controller.signal }));

    expect(error).toBeInstanceOf(DOMException);
    expect(error).toMatchObject({ name: 'AbortError' });
    expect(error).not.toBeInstanceOf(ContractError);
  });

  it('R11: rethrows the AbortError when a non-2xx body read is aborted and does not notify a 401', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionRejected(listener);
    setAccessTokenGetter(() => 'abc.def.ghi');
    const controller = new AbortController();
    mockFetch(abortingResponse(401, controller));

    const error = await captureError(
      http('/bookings', idSchema, { auth: true, signal: controller.signal }),
    );
    unsubscribe();

    expect(error).toBeInstanceOf(DOMException);
    expect(error).toMatchObject({ name: 'AbortError' });
    expect(error).not.toBeInstanceOf(ApiError);
    expect(listener).not.toHaveBeenCalled();
  });
});
