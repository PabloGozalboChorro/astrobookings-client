import { Link, useLocation } from 'react-router';
import { loginPath, registerPath } from '../../domain/session';

export function BookingAccess() {
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;

  return (
    <div className="booking-access">
      <p>Inicia sesión o crea una cuenta para reservar.</p>
      <p>
        <Link to={loginPath(currentPath)}>Iniciar sesión</Link>{' '}
        <Link to={registerPath(currentPath)}>Crear cuenta</Link>
      </p>
    </div>
  );
}
