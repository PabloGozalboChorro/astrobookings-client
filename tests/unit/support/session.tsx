import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { Layout } from '../../../src/components/Layout';
import type { Session } from '../../../src/domain/session';
import { LoginPage } from '../../../src/features/session/LoginPage';
import { RequireAuth } from '../../../src/features/session/RequireAuth';
import { SessionProvider } from '../../../src/features/session/SessionProvider';
import { SESSION_STORAGE_KEY } from '../../../src/features/session/session-storage';
import { CurrentLocation, LocationProbe, ProtectedProbe } from './session-probes';

export const SESSION_TEXT = 'Tu sesión ha caducado o no es válida. Inicia sesión de nuevo.';

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fakeJwt(claims: Record<string, unknown>): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify(claims));
  return `${header}.${payload}.fake-signature`;
}

export function anaSession(overrides: Partial<Session> = {}): Session {
  return {
    accessToken: fakeJwt({ userId: 'user-2', email: 'ana@ejemplo.com' }),
    user: { username: 'ana', email: 'ana@ejemplo.com' },
    expiresAt: Date.now() + TWO_HOURS_MS,
    ...overrides,
  };
}

export function storeSession(overrides: Partial<Session> = {}): Session {
  const session = anaSession(overrides);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function storedSessionValue(): unknown {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

export function currentLocation(): string {
  return screen.getByRole('status', { name: 'Ubicación actual' }).textContent ?? '';
}

export function renderApp(path: string, { strict = false } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <CurrentLocation />
        <Link to="/protegida">Ir a la ruta protegida</Link>
        <Routes>
          <Route element={<Layout />}>
            <Route path="acceso" element={<LoginPage />} />
            <Route path="lanzamientos" element={<LocationProbe />} />
            <Route path="lanzamientos/:id" element={<LocationProbe />} />
            <Route element={<RequireAuth />}>
              <Route path="protegida" element={<ProtectedProbe />} />
            </Route>
          </Route>
        </Routes>
      </SessionProvider>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}
