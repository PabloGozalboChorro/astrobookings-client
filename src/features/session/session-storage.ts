import { z } from 'zod';
import { isExpired, type Session } from '../../domain/session';

export const SESSION_STORAGE_KEY = 'astrobookings.session';

export type StoredSessionResult =
  | { status: 'none' }
  | { status: 'valid'; session: Session }
  | { status: 'expired' }
  | { status: 'invalid' };

const storedSessionSchema = z.object({
  accessToken: z.string().min(1),
  user: z.object({ username: z.string(), email: z.string() }),
  expiresAt: z.number(),
});

function readRawSession(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

export function readStoredSession(now: number): StoredSessionResult {
  const raw = readRawSession();
  if (raw === null) {
    return { status: 'none' };
  }
  const json = parseJson(raw);
  if (!json.ok) {
    return { status: 'invalid' };
  }
  const parsed = storedSessionSchema.safeParse(json.value);
  if (!parsed.success) {
    return { status: 'invalid' };
  }
  const session: Session = parsed.data;
  if (isExpired(session, now)) {
    return { status: 'expired' };
  }
  return { status: 'valid', session };
}

export function readStoredAccessToken(): string | null {
  const stored = readStoredSession(Date.now());
  return stored.status === 'valid' ? stored.session.accessToken : null;
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage unavailable: there is nothing stored to remove.
  }
}
