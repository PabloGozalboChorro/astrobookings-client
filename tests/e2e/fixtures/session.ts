/// <reference lib="dom" />
import { Buffer } from 'node:buffer';
import type { Page } from '@playwright/test';

export const SESSION_STORAGE_KEY = 'astrobookings.session';

const SEEDED_MARK = 'e2e.session-seeded';

export type StoredSessionFixture = {
  accessToken: string;
  user: { username: string; email: string };
  expiresAt: number;
};

function toBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function fakeJwt(claims: Record<string, unknown>): string {
  return `${toBase64Url({ alg: 'HS256', typ: 'JWT' })}.${toBase64Url(claims)}.fake-signature`;
}

// Token of the R4 acceptance criterion: iat 2026-11-06T10:00:00Z, exp 2026-11-07T10:00:00Z.
export const ANA_TOKEN = fakeJwt({
  userId: 'user-2',
  email: 'ana@ejemplo.com',
  iat: 1793959200,
  exp: 1794045600,
});

export function sessionValue(overrides: Partial<StoredSessionFixture> = {}): StoredSessionFixture {
  return {
    accessToken: ANA_TOKEN,
    user: { username: 'ana', email: 'ana@ejemplo.com' },
    expiresAt: 1794045600000,
    ...overrides,
  };
}

// Writes the stored session only on the first load of the tab, so reloading after signing out
// does not bring it back. A string is stored as is (to seed corrupt content).
export async function seedSession(page: Page, value: StoredSessionFixture | string): Promise<void> {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  await page.addInitScript(
    ({ key, mark, storedValue }) => {
      if (window.sessionStorage.getItem(mark) === null) {
        window.sessionStorage.setItem(mark, 'true');
        window.localStorage.setItem(key, storedValue);
      }
    },
    { key: SESSION_STORAGE_KEY, mark: SEEDED_MARK, storedValue: raw },
  );
}

export async function readStoredSession(page: Page): Promise<unknown> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), SESSION_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}
