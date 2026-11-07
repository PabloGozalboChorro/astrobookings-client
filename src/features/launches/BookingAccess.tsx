import { Link } from 'react-router';
import { loginPath, registerPath } from '../../domain/session';
import { useCurrentPath } from '../../hooks/use-current-path';

export function BookingAccess() {
  const currentPath = useCurrentPath();

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
