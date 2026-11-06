import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../../../../src/domain/session';
import {
  clearStoredSession,
  readStoredAccessToken,
  readStoredSession,
  saveSession,
  SESSION_STORAGE_KEY,
} from '../../../../src/features/session/session-storage';

const NOW = Date.parse('2026-11-06T10:00:00.000Z');
const SESSION: Session = {
  accessToken: 'header.payload.signature',
  user: { username: 'ana', email: 'ana@ejemplo.com' },
  expiresAt: NOW + 2 * 60 * 60 * 1000,
};

function store(value: unknown) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('session storage', () => {
  it('uses the astrobookings.session key', () => {
    expect(SESSION_STORAGE_KEY).toBe('astrobookings.session');
  });

  it('R8: returns none when nothing is stored', () => {
    expect(readStoredSession(NOW)).toEqual({ status: 'none' });
  });

  it('R8: returns a valid stored session', () => {
    store(SESSION);

    expect(readStoredSession(NOW)).toEqual({ status: 'valid', session: SESSION });
  });

  it('R8: ignores extra fields of the stored session', () => {
    store({ ...SESSION, user: { ...SESSION.user, id: 2 }, extra: true });

    expect(readStoredSession(NOW)).toEqual({ status: 'valid', session: SESSION });
  });

  it('R11: reports an expired session', () => {
    store({ ...SESSION, expiresAt: NOW });

    expect(readStoredSession(NOW)).toEqual({ status: 'expired' });
  });

  it('R11: reports invalid JSON', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, '{no es json');

    expect(readStoredSession(NOW)).toEqual({ status: 'invalid' });
  });

  it.each([
    ['without expiresAt', { accessToken: SESSION.accessToken, user: SESSION.user }],
    ['with an empty token', { ...SESSION, accessToken: '' }],
    ['without user', { accessToken: SESSION.accessToken, expiresAt: SESSION.expiresAt }],
    ['with expiresAt as text', { ...SESSION, expiresAt: String(SESSION.expiresAt) }],
    ['that is not an object', 'ana'],
    ['that is null', null],
  ])('R11: reports an invalid shape %s', (_label, value) => {
    store(value);

    expect(readStoredSession(NOW)).toEqual({ status: 'invalid' });
  });

  it('does not remove the key while reading', () => {
    store({ ...SESSION, expiresAt: NOW - 1 });
    readStoredSession(NOW);

    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });

  it('returns none when localStorage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });

    expect(readStoredSession(NOW)).toEqual({ status: 'none' });
  });

  it('R4: saveSession writes the exact JSON', () => {
    saveSession(SESSION);

    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null')).toEqual(SESSION);
  });

  it('R9: clearStoredSession removes the key', () => {
    store(SESSION);

    clearStoredSession();

    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('R8: readStoredAccessToken returns the token of a valid session', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    store(SESSION);

    expect(readStoredAccessToken()).toBe(SESSION.accessToken);
  });

  it.each([
    ['there is no session', undefined],
    ['the session has expired', { ...SESSION, expiresAt: NOW }],
    ['the session is invalid', { ...SESSION, accessToken: '' }],
  ])('R11: readStoredAccessToken returns null when %s', (_label, value) => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    if (value !== undefined) {
      store(value);
    }

    expect(readStoredAccessToken()).toBeNull();
  });

  it('localStorage starts empty in every test', () => {
    expect(localStorage.length).toBe(0);
  });
});
