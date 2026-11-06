import { describe, expect, it } from 'vitest';
import {
  authPagePath,
  createSession,
  getTokenExpiry,
  isExpired,
  loginPath,
  registerPath,
  resolveReturnPath,
  SESSION_FALLBACK_DURATION_MS,
  type Session,
} from '../../../src/domain/session';
import { fakeJwt } from '../support/session';

const ANA_CLAIMS = { userId: 'user-2', email: 'ana@ejemplo.com', iat: 1793959200, exp: 1794045600 };
const ANA_USER = { id: 2, username: 'ana', email: 'ana@ejemplo.com', terms: true };

function base64UrlPart(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('getTokenExpiry', () => {
  it('R4: reads the exp claim of a JWT in milliseconds', () => {
    expect(getTokenExpiry(fakeJwt(ANA_CLAIMS))).toBe(1794045600000);
  });

  it('R4: reads a base64url payload with "-" and "_"', () => {
    const payload = base64UrlPart('{"exp":1794045600,"note":"???>>>"}');
    expect(payload).toMatch(/[-_]/);

    expect(getTokenExpiry(`header.${payload}.signature`)).toBe(1794045600000);
  });

  it.each([
    ['an opaque token', 'opaque-token'],
    ['a token with two parts', `header.${base64UrlPart('{"exp":1794045600}')}`],
    ['a payload that is not JSON', `header.${base64UrlPart('not json')}.signature`],
    ['a payload that is not base64', 'header.%%%.signature'],
    ['a payload without exp', fakeJwt({ userId: 'user-2' })],
    ['an exp that is text', fakeJwt({ exp: '1794045600' })],
    ['a payload that is not an object', `header.${base64UrlPart('42')}.signature`],
  ])('R4: returns null for %s', (_label, token) => {
    expect(getTokenExpiry(token)).toBeNull();
  });
});

describe('createSession', () => {
  it('R4: creates the session from the auth response', () => {
    const accessToken = fakeJwt(ANA_CLAIMS);

    const session = createSession(
      {
        user: ANA_USER,
        accessToken,
      },
      1793959200000,
    );

    expect(session).toEqual({
      accessToken,
      user: { username: 'ana', email: 'ana@ejemplo.com' },
      expiresAt: 1794045600000,
    });
  });

  it('R4: falls back to 24 hours after reception', () => {
    const receivedAt = 1793959200000;

    const session = createSession(
      {
        user: ANA_USER,
        accessToken: 'opaque-token',
      },
      receivedAt,
    );

    expect(SESSION_FALLBACK_DURATION_MS).toBe(86_400_000);
    expect(session.expiresAt).toBe(receivedAt + 86_400_000);
  });
});

describe('isExpired', () => {
  const session: Session = {
    accessToken: 'token',
    user: { username: 'ana', email: 'ana@ejemplo.com' },
    expiresAt: 1794045600000,
  };

  it('R8: is not expired 1 ms before expiresAt', () => {
    expect(isExpired(session, 1794045599999)).toBe(false);
  });

  it.each([1794045600000, 1794045600001])('R11: is expired at %i', (now) => {
    expect(isExpired(session, now)).toBe(true);
  });
});

describe('resolveReturnPath', () => {
  it.each<[string | null, string]>([
    ['/reservas?lanzamiento=activity-1', '/reservas?lanzamiento=activity-1'],
    ['/lanzamientos/activity-1', '/lanzamientos/activity-1'],
    ['https://malicioso.example', '/lanzamientos'],
    ['//malicioso.example', '/lanzamientos'],
    ['reservas', '/lanzamientos'],
    ['/\\malicioso.example', '/lanzamientos'],
    ['/acceso', '/lanzamientos'],
    ['/acceso?volver=%2Fx', '/lanzamientos'],
    ['/registro', '/lanzamientos'],
    ['/registro?volver=/x', '/lanzamientos'],
    ['', '/lanzamientos'],
    [null, '/lanzamientos'],
  ])('R5: resolves "%s" to "%s"', (volver, expected) => {
    expect(resolveReturnPath(volver)).toBe(expected);
  });

  // The URL parser removes tabs and newlines, so "/\t/host" becomes "//host" (another origin).
  it.each(['/\t/malicioso.example', '/\n/malicioso.example', '/\r/malicioso.example'])(
    'R5: rejects %j, which the browser reads as an external URL',
    (volver) => {
      expect(resolveReturnPath(volver)).toBe('/lanzamientos');
    },
  );
});

describe('loginPath', () => {
  it('R10: builds the login path with the encoded return path', () => {
    expect(loginPath('/protegida?x=1')).toBe('/acceso?volver=%2Fprotegida%3Fx%3D1');
  });

  it('R7: encodes a launch detail path', () => {
    expect(loginPath('/lanzamientos/activity-1')).toBe(
      '/acceso?volver=%2Flanzamientos%2Factivity-1',
    );
  });
});

describe('registerPath', () => {
  it('R7: builds the register path with the encoded return path', () => {
    expect(registerPath('/lanzamientos/activity-1')).toBe(
      '/registro?volver=%2Flanzamientos%2Factivity-1',
    );
  });
});

describe('authPagePath', () => {
  it.each<[string, string | null, string]>([
    ['/registro', '/reservas', '/registro?volver=%2Freservas'],
    ['/acceso', '/reservas', '/acceso?volver=%2Freservas'],
    ['/registro', null, '/registro'],
  ])('R8: authPagePath(%s, %j)', (base, volver, expected) => {
    expect(authPagePath(base, volver)).toBe(expected);
  });
});
