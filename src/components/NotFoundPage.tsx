import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <>
      <h1>Página no encontrada</h1>
      <p>
        <Link to="/lanzamientos">Ir a los lanzamientos</Link>
      </p>
    </>
  );
}
