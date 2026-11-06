import { Link } from 'react-router';
import { LAUNCH_NOT_FOUND_TEXT } from '../../domain/api-errors';

export function LaunchNotFound() {
  return (
    <>
      <h1>Lanzamiento no encontrado</h1>
      <p>{LAUNCH_NOT_FOUND_TEXT}</p>
      <p>
        <Link to="/lanzamientos">Ver todos los lanzamientos</Link>
      </p>
    </>
  );
}
