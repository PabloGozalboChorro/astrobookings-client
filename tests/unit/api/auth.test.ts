import { afterEach, describe, expect, it, vi } from 'vitest';
import { login } from '../../../src/api/auth';
import { ApiError, ContractError } from '../../../src/api/errors';
import { onSessionRejected, setAccessTokenGetter } from '../../../src/api/http';
import { captureError, jsonResponse, mockFetch, sentRequest } from '../support/http';
import { fakeJwt } from '../support/session';

const ACCESS_TOKEN = fakeJwt({ userId: 'user-2', email: 'ana@ejemplo.com', exp: 1794045600 });
const AUTH_RESPONSE = {
  user: { id: 2, username: 'ana', email: 'ana@ejemplo.com', terms: true },
  accessToken: ACCESS_TOKEN,
};
const CREDENTIALS = { email: 'ana@ejemplo.com', password: 'secreto1' };

afterEach(() => {
  setAccessTokenGetter(() => null);
  vi.restoreAllMocks();
});

describe('login', () => {
  it('R3: posts the credentials to /login without Authorization', async () => {
    setAccessTokenGetter(() => 'stored.session.token');
    const fetchSpy = mockFetch(jsonResponse(200, AUTH_RESPONSE));

    await login(CREDENTIALS);

    const { url, init } = sentRequest(fetchSpy);
    expect(url).toBe('http://localhost:3999/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"email":"ana@ejemplo.com","password":"secreto1"}');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('R4: returns the parsed auth response', async () => {
    mockFetch(jsonResponse(200, AUTH_RESPONSE));

    await expect(login(CREDENTIALS)).resolves.toEqual(AUTH_RESPONSE);
  });

  it('R4: throws ContractError when the response has no accessToken', async () => {
    mockFetch(jsonResponse(200, { user: AUTH_RESPONSE.user }));

    await expect(login(CREDENTIALS)).rejects.toBeInstanceOf(ContractError);
  });

  it('R4: throws ContractError when the user id is not a number', async () => {
    mockFetch(jsonResponse(200, { ...AUTH_RESPONSE, user: { ...AUTH_RESPONSE.user, id: 'user-2' } }));

    await expect(login(CREDENTIALS)).rejects.toBeInstanceOf(ContractError);
  });

  it('R6: rejects with an unauthorized ApiError and does not notify the session', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionRejected(listener);
    mockFetch(jsonResponse(401, { message: 'Invalid email or password', errors: [] }));

    const error = await captureError(login({ ...CREDENTIALS, password: 'incorrecta' }));
    unsubscribe();

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, kind: 'unauthorized' });
    expect(listener).not.toHaveBeenCalled();
  });
});
