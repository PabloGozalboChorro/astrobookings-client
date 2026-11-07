import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { loginPath } from '../../domain/session';
import { useCurrentPath } from '../../hooks/use-current-path';
import { useSession } from './use-session';

export function RequireAuth() {
  const { session, checkExpiry } = useSession();
  const location = useLocation();
  const currentPath = useCurrentPath();

  useEffect(() => {
    checkExpiry();
  }, [location.key, checkExpiry]);

  if (session === null) {
    return <Navigate to={loginPath(currentPath)} replace />;
  }
  return <Outlet />;
}
