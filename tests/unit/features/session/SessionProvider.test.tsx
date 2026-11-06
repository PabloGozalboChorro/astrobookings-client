import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, type ReactNode } from 'react';
import { Link, MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../../../src/api/http';
import { SessionExpiredNotice } from '../../../../src/features/session/SessionExpiredNotice';
import { SessionProvider } from '../../../../src/features/session/SessionProvider';
import { SESSION_STORAGE_KEY } from '../../../../src/features/session/session-storage';
import { useSession } from '../../../../src/features/session/use-session';
import { captureError, jsonResponse, mockFetch } from '../../support/http';
import { LocationProbe, ProtectedProbe } from '../../support/session-probes';
import { SESSION_TEXT, storeSession } from '../../support/session';

const NOW = new Date('2026-11-06T10:00:00.000Z');

function SessionProbe() {
  const { session, expiredNotice } = useSession();
  return (
    <>
      <p>{session === null ? 'Sin sesión' : `Usuario: ${session.user.username}`}</p>
      {expiredNotice && <SessionExpiredNotice />}
      <Link to="/datos">Ver datos</Link>
    </>
  );
}

function ProbeLayout() {
  return (
    <>
      <SessionProbe />
      <Outlet />
    </>
  );
}

function renderWithSession(path: string, { strict = false } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <Routes>
          <Route element={<ProbeLayout />}>
            <Route path="lanzamientos" element={<LocationProbe />} />
            <Route path="datos" element={<ProtectedProbe />} />
          </Route>
        </Routes>
      </SessionProvider>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function expectSessionNotice() {
  const notice = screen.getByRole('alert');
  expect(notice).toHaveTextContent(SESSION_TEXT);
  return notice;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SessionProvider', () => {
  it('R8: restores a valid session from localStorage', () => {
    storeSession();

    renderWithSession('/lanzamientos');

    expect(screen.getByText('Usuario: ana')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R8: sends the stored token in the first request of a child route', async () => {
    const session = storeSession();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(jsonResponse(200, [])));

    renderWithSession('/datos', { strict: true });

    expect(await screen.findByText('Petición: ready')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
    for (const [, init] of fetchSpy.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${session.accessToken}`);
    }
  });

  it.each([false, true])(
    'R11: clears an expired session at start and shows the notice (strict mode: %s)',
    (strict) => {
      vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
      storeSession({ expiresAt: NOW.getTime() - 1 });

      renderWithSession('/lanzamientos', { strict });

      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(screen.getByText('Sin sesión')).toBeInTheDocument();
      const notice = expectSessionNotice();
      expect(within(notice).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
        'href',
        '/acceso?volver=%2Flanzamientos',
      );
    },
  );

  it.each([
    ['content that is not JSON', '{no es json', false],
    ['content that is not JSON', '{no es json', true],
    ['an invalid shape', JSON.stringify({ accessToken: '', user: {} }), false],
    ['an invalid shape', JSON.stringify({ accessToken: '', user: {} }), true],
  ])('R11: clears %s without notice (strict mode: %s)', (_label, value, strict) => {
    localStorage.setItem(SESSION_STORAGE_KEY, value);

    renderWithSession('/lanzamientos', { strict });

    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(screen.getByText('Sin sesión')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R11: does not touch the storage when there is no session', () => {
    renderWithSession('/lanzamientos', { strict: true });

    expect(localStorage.length).toBe(0);
    expect(screen.getByText('Sin sesión')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R11: closes the session when an authenticated request gets 401', async () => {
    storeSession();
    mockFetch(
      jsonResponse(401, { message: 'Invalid or expired token. Please login again.', errors: [] }),
    );

    renderWithSession('/datos');

    expect(await screen.findByText('Sin sesión')).toBeInTheDocument();
    expectSessionNotice();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('R11: closes the session without calling fetch when it expired just before the request', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const session = storeSession({ expiresAt: NOW.getTime() + 60_000 });
    const fetchSpy = mockFetch(jsonResponse(200, []));
    renderWithSession('/lanzamientos');
    expect(screen.getByText('Usuario: ana')).toBeInTheDocument();

    vi.setSystemTime(session.expiresAt);
    await user.click(screen.getByRole('link', { name: 'Ver datos' }));

    expect(await screen.findByText('Sin sesión')).toBeInTheDocument();
    expectSessionNotice();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('R12: expires the session when expiresAt is reached', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    storeSession({ expiresAt: NOW.getTime() + 60_000 });
    renderWithSession('/lanzamientos', { strict: true });

    act(() => {
      vi.advanceTimersByTime(59_999);
    });
    expect(screen.getByText('Usuario: ana')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByText('Sin sesión')).toBeInTheDocument();
    expectSessionNotice();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('R8: keeps a session whose expiresAt is beyond the maximum timer delay', () => {
    const maxTimerDelayMs = 2_147_483_647;
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    storeSession({ expiresAt: NOW.getTime() + 30 * 24 * 60 * 60 * 1000 });
    renderWithSession('/lanzamientos');

    act(() => {
      vi.advanceTimersByTime(maxTimerDelayMs);
    });

    expect(screen.getByText('Usuario: ana')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });

  it('useSession throws outside SessionProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useSession())).toThrow(
      'useSession must be used inside SessionProvider',
    );
  });

  it('signIn stores the session and clears the notice; signOut removes it', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    storeSession({ expiresAt: NOW.getTime() - 1 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SessionProvider>{children}</SessionProvider>
    );
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current.expiredNotice).toBe(true);

    act(() => {
      result.current.signIn(
        {
          user: { id: 2, username: 'ana', email: 'ana@ejemplo.com', terms: true },
          accessToken: 'opaque-token',
        },
        NOW.getTime(),
      );
    });

    const expected = {
      accessToken: 'opaque-token',
      user: { username: 'ana', email: 'ana@ejemplo.com' },
      expiresAt: NOW.getTime() + 86_400_000,
    };
    expect(result.current.session).toEqual(expected);
    expect(result.current.expiredNotice).toBe(false);
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null')).toEqual(expected);

    act(() => {
      result.current.signOut();
    });

    expect(result.current.session).toBeNull();
    expect(result.current.expiredNotice).toBe(false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('unsubscribes from session rejections on unmount', async () => {
    storeSession();
    const { unmount } = renderWithSession('/lanzamientos');
    unmount();
    mockFetch(
      jsonResponse(401, { message: 'Invalid or expired token. Please login again.', errors: [] }),
    );

    await captureError(http('/bookings', z.array(z.unknown()), { auth: true }));

    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });
});
