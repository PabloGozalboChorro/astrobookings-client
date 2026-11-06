import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { activityDto } from './support/activities';
import { jsonResponse, mockFetch } from './support/http';

const CONFIG_ERROR_MESSAGE = 'Error de configuración: falta la variable VITE_API_URL.';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function expectConfigErrorInsteadOfApp() {
  expect(screen.getByRole('alert')).toHaveTextContent(CONFIG_ERROR_MESSAGE);
  expect(screen.queryByRole('banner')).toBeNull();
  expect(screen.queryByRole('main')).toBeNull();
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(jsonResponse(200, [])),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('R4: renders the launches heading at /lanzamientos', () => {
    renderAt('/lanzamientos');

    expect(screen.getByRole('heading', { name: 'Lanzamientos' })).toBeInTheDocument();
  });

  it('R8: shows a configuration error instead of the app', () => {
    vi.stubEnv('VITE_API_URL', '');

    renderAt('/lanzamientos');

    expectConfigErrorInsteadOfApp();
  });

  it('R8: shows a configuration error when VITE_API_URL is undefined', () => {
    vi.stubEnv('VITE_API_URL', undefined);

    renderAt('/lanzamientos');

    expectConfigErrorInsteadOfApp();
  });

  it('R8: shows a configuration error when VITE_API_URL is only whitespace', () => {
    vi.stubEnv('VITE_API_URL', '   ');

    renderAt('/lanzamientos');

    expectConfigErrorInsteadOfApp();
  });

  it('R9: redirects / to /lanzamientos', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Lanzamientos' })).toBeInTheDocument();
  });

  it('R9: shows the header with the brand and the launches link', () => {
    renderAt('/lanzamientos');

    const header = screen.getByRole('banner');
    expect(header).toHaveTextContent('AstroBookings');
    expect(within(header).getByRole('link', { name: 'Lanzamientos' })).toHaveAttribute(
      'href',
      '/lanzamientos',
    );
    expect(
      within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Lanzamientos' }),
    ).toBeInTheDocument();
  });

  it('R1: renders the launch detail at /lanzamientos/:id', async () => {
    mockFetch(jsonResponse(200, activityDto()));

    renderAt('/lanzamientos/activity-1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Misión Luna' }),
    ).toBeInTheDocument();
  });

  it('R1: renders the login page at /acceso', () => {
    renderAt('/acceso');

    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('R1: renders the registration page at /registro', () => {
    renderAt('/registro');

    expect(screen.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Acepto los términos y condiciones' }),
    ).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
  });

  it('R7: shows the login link in the header without a session', () => {
    renderAt('/lanzamientos');

    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/acceso?volver=%2Flanzamientos');
  });

  it('R10: shows the not found page and links back to the launches', async () => {
    const user = userEvent.setup();
    renderAt('/no-existe');

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Ir a los lanzamientos' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Lanzamientos' })).toBeInTheDocument();
  });

  it('R10: shows the not found page for a nested unknown route', () => {
    renderAt('/lanzamientos/no-existe/otra');

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a los lanzamientos' })).toHaveAttribute(
      'href',
      '/lanzamientos',
    );
  });

  it('R2: redirects /reservas/booking-3 to /acceso without requesting it', () => {
    const fetchSpy = vi.mocked(globalThis.fetch);

    renderAt('/reservas/booking-3');

    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/acceso?volver=%2Freservas%2Fbooking-3');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
