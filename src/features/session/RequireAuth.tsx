import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { loginPath } from '../../domain/session';
import { useSession } from './use-session';

export function RequireAuth() {
  const { session, checkExpiry } = useSession();
  const location = useLocation();

  useEffect(() => {
    checkExpiry();
  }, [location.key, checkExpiry]);

  if (session === null) {
    return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />;
  }
  return <Outlet />;
}
