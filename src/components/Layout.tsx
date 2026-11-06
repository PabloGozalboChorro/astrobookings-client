import { startTransition } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  authPagePath,
  DEFAULT_RETURN_PATH,
  LOGIN_PATH,
  loginPath,
  REGISTER_PATH,
  registerPath,
} from '../domain/session';
import { SessionExpiredNotice } from '../features/session/SessionExpiredNotice';
import { useSession } from '../features/session/use-session';

export function Layout() {
  const { session, expiredNotice, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentPath = `${location.pathname}${location.search}`;
  const onLoginPage = location.pathname === LOGIN_PATH;
  const onAuthPage = onLoginPage || location.pathname === REGISTER_PATH;
  // On the auth pages the header links keep the current volver instead of nesting it.
  const volver = searchParams.get('volver');
  const loginLinkPath = onAuthPage ? authPagePath(LOGIN_PATH, volver) : loginPath(currentPath);
  const registerLinkPath = onAuthPage
    ? authPagePath(REGISTER_PATH, volver)
    : registerPath(currentPath);

  function handleSignOut() {
    // React Router applies the navigation in a transition; signing out in the same transition
    // keeps RequireAuth from seeing the closed session on the protected route
    // (it would redirect to /acceso).
    void navigate(DEFAULT_RETURN_PATH);
    startTransition(() => {
      signOut();
    });
  }

  return (
    <>
      <header className="site-header">
        <p className="site-brand">AstroBookings</p>
        <nav aria-label="Principal">
          <Link to="/lanzamientos">Lanzamientos</Link>
          {session !== null && <Link to="/reservas">Mis reservas</Link>}
        </nav>
        <div className="site-session">
          {session === null ? (
            <>
              <Link to={loginLinkPath}>Iniciar sesión</Link>
              <Link to={registerLinkPath}>Crear cuenta</Link>
            </>
          ) : (
            <>
              <span className="site-session__user">{session.user.username}</span>
              <button type="button" onClick={handleSignOut}>
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </header>
      <main className="site-main">
        {expiredNotice && !onLoginPage && <SessionExpiredNotice />}
        <Outlet />
      </main>
    </>
  );
}
