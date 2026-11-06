import { z } from 'zod';

export type SessionUser = { username: string; email: string };

export type Session = {
  accessToken: string;
  user: SessionUser;
  expiresAt: number;
};

export type SessionSource = { accessToken: string; user: SessionUser };

export const SESSION_FALLBACK_DURATION_MS = 86_400_000;

export const LOGIN_PATH = '/acceso';

export const DEFAULT_RETURN_PATH = '/lanzamientos';

const tokenClaimsSchema = z.object({ exp: z.number().positive() });

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return atob(padded);
}

export function getTokenExpiry(token: string): number | null {
  const parts = token.split('.');
  const payload = parts[1];
  if (parts.length !== 3 || payload === undefined) {
    return null;
  }
  try {
    const claims: unknown = JSON.parse(decodeBase64Url(payload));
    const parsed = tokenClaimsSchema.safeParse(claims);
    return parsed.success ? parsed.data.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isExpired(session: Session, now: number): boolean {
  return now >= session.expiresAt;
}

export function createSession(source: SessionSource, receivedAt: number): Session {
  const { accessToken, user } = source;
  return {
    accessToken,
    user: { username: user.username, email: user.email },
    expiresAt: getTokenExpiry(accessToken) ?? receivedAt + SESSION_FALLBACK_DURATION_MS,
  };
}

// Fixed placeholder origin: keeps resolveReturnPath pure (no window.location).
const RETURN_PATH_BASE_ORIGIN = 'https://astrobookings.invalid';

const LAST_C0_CONTROL_CODE = 0x1f;
const DELETE_CODE = 0x7f;

// The URL parser strips tabs and newlines, so "/\t/host" would become "//host".
function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= LAST_C0_CONTROL_CODE || code === DELETE_CODE;
  });
}

function staysOnSameOrigin(path: string): boolean {
  try {
    const resolved = new URL(path, RETURN_PATH_BASE_ORIGIN);
    return resolved.origin === RETURN_PATH_BASE_ORIGIN && !resolved.pathname.startsWith('//');
  } catch {
    return false;
  }
}

export function resolveReturnPath(volver: string | null): string {
  if (
    volver === null ||
    !volver.startsWith('/') ||
    volver.startsWith('//') ||
    volver.includes('\\') ||
    hasControlCharacter(volver) ||
    volver.startsWith(LOGIN_PATH) ||
    !staysOnSameOrigin(volver)
  ) {
    return DEFAULT_RETURN_PATH;
  }
  return volver;
}

export function loginPath(returnTo: string): string {
  return `${LOGIN_PATH}?volver=${encodeURIComponent(returnTo)}`;
}
