import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_STORAGE_KEY } from '../../../src/features/session/session-storage';
import { jsonResponse } from '../support/http';
import { currentLocation, renderApp, SESSION_TEXT, storeSession } from '../support/session';

const NOW = new Date('2026-11-06T10:00:00.000Z');

function header() {
  return screen.getByRole('banner');
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Layout session header', () => {
  it('R7: shows the username and the sign out button with a session', () => {
    storeSession();

    renderApp('/lanzamientos');

    expect(header()).toHaveTextContent('ana');
    expect(within(header()).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(within(header()).queryByRole('link', { name: 'Iniciar sesión' })).toBeNull();
  });

  it('R7: links to /acceso with the current route without a session', () => {
    renderApp('/lanzamientos/activity-1');

    expect(within(header()).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/acceso?volver=%2Flanzamientos%2Factivity-1',
    );
    expect(within(header()).queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  });

  it('R7: keeps the query of /acceso instead of nesting volver', () => {
    renderApp('/acceso?volver=%2Fx');

    expect(within(header()).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/acceso?volver=%2Fx',
    );
  });

  it('R7: links to /registro with the current route without a session', () => {
    renderApp('/lanzamientos/activity-1');

    expect(within(header()).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/registro?volver=%2Flanzamientos%2Factivity-1',
    );
  });

  it('R7: hides the register link with a session', () => {
    storeSession();

    renderApp('/lanzamientos/activity-1');

    expect(within(header()).queryByRole('link', { name: 'Crear cuenta' })).toBeNull();
  });

  it.each(['/registro?volver=%2Fx', '/acceso?volver=%2Fx'])(
    'R7: keeps volver in both header links on %s without nesting it',
    (path) => {
      renderApp(path);

      expect(within(header()).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
        'href',
        '/registro?volver=%2Fx',
      );
      expect(within(header()).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
        'href',
        '/acceso?volver=%2Fx',
      );
    },
  );

  it('R7: links to the bare auth pages from /registro without volver', () => {
    renderApp('/registro');

    expect(within(header()).getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/registro',
    );
    expect(within(header()).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/acceso',
    );
  });

  it.each([false, true])(
    'R9: signs out, clears localStorage and goes to /lanzamientos (strict mode: %s)',
    async (strict) => {
      const user = userEvent.setup();
      storeSession();
      renderApp('/lanzamientos/activity-1', { strict });

      await user.click(within(header()).getByRole('button', { name: 'Cerrar sesión' }));

      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(currentLocation()).toBe('/lanzamientos');
      expect(within(header()).getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it.each([false, true])(
    'R9: signing out from a protected route ends in /lanzamientos, not in /acceso (strict mode: %s)',
    async (strict) => {
      const user = userEvent.setup();
      storeSession();
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(jsonResponse(200, [])),
      );
      renderApp('/protegida', { strict });
      expect(await screen.findByText('Petición: ready')).toBeInTheDocument();

      await user.click(within(header()).getByRole('button', { name: 'Cerrar sesión' }));

      expect(currentLocation()).toBe('/lanzamientos');
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('R11: shows the expired session notice with a login link above the content', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    storeSession({ expiresAt: NOW.getTime() - 1 });

    renderApp('/lanzamientos');

    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent(SESSION_TEXT);
    expect(within(notice).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/acceso?volver=%2Flanzamientos',
    );
    expect(within(header()).getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('R11: shows a single notice on /acceso', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    storeSession({ expiresAt: NOW.getTime() - 1 });

    renderApp('/acceso');

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_TEXT);
  });
});
