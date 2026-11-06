import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_STORAGE_KEY } from '../../../../src/features/session/session-storage';
import { jsonResponse, mockFetch } from '../../support/http';
import { currentLocation, renderApp, SESSION_TEXT, storeSession } from '../../support/session';

function expectSessionNotice() {
  expect(screen.getByRole('alert')).toHaveTextContent(SESSION_TEXT);
}

const NOW = new Date('2026-11-06T10:00:00.000Z');

function mockBookings() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() => Promise.resolve(jsonResponse(200, [])));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RequireAuth', () => {
  it.each([false, true])(
    'R10: redirects to /acceso with the requested path and query (strict mode: %s)',
    (strict) => {
      const fetchSpy = mockBookings();

      renderApp('/protegida?x=1', { strict });

      expect(currentLocation()).toBe('/acceso?volver=%2Fprotegida%3Fx%3D1');
      expect(screen.queryByRole('region', { name: 'Sonda protegida' })).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('R10: renders the protected route with a valid session', async () => {
    const session = storeSession();
    const fetchSpy = mockBookings();

    renderApp('/protegida');

    expect(await screen.findByText('Petición: ready')).toBeInTheDocument();
    expect(currentLocation()).toBe('/protegida');
    expect(new Headers(fetchSpy.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      `Bearer ${session.accessToken}`,
    );
  });

  it('R12: goes to /acceso with the notice when a request of the protected route gets 401', async () => {
    storeSession();
    mockFetch(
      jsonResponse(401, { message: 'Invalid or expired token. Please login again.', errors: [] }),
    );

    renderApp('/protegida');

    await waitFor(() => {
      expect(currentLocation()).toBe('/acceso?volver=%2Fprotegida');
    });
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expectSessionNotice();
  });

  it('R12: goes to /acceso with the notice when the session expires on a protected route', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    storeSession({ expiresAt: NOW.getTime() + 60_000 });
    mockBookings();
    renderApp('/protegida?x=1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Petición: ready')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(currentLocation()).toBe('/acceso?volver=%2Fprotegida%3Fx%3D1');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expectSessionNotice();
  });

  it('R11: entering a protected route with an expired session redirects with the notice and no request', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const session = storeSession({ expiresAt: NOW.getTime() + 60_000 });
    const fetchSpy = mockBookings();
    renderApp('/lanzamientos');

    vi.setSystemTime(session.expiresAt);
    await user.click(screen.getByRole('link', { name: 'Ir a la ruta protegida' }));

    expect(currentLocation()).toBe('/acceso?volver=%2Fprotegida');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expectSessionNotice();
  });
});
