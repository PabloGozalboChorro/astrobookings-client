import { startTransition } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { DEFAULT_RETURN_PATH, LOGIN_PATH, loginPath } from '../domain/session';
import { SessionExpiredNotice } from '../features/session/SessionExpiredNotice';
import { useSession } from '../features/session/use-session';

export function Layout() {
  const { session, expiredNotice, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = `${location.pathname}${location.search}`;
  const onLoginPage = location.pathname === LOGIN_PATH;

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
        </nav>
        <div className="site-session">
          {session === null ? (
            <Link to={onLoginPage ? currentPath : loginPath(currentPath)}>Iniciar sesión</Link>
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
