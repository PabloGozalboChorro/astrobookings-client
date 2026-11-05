import { Link, Outlet } from 'react-router';

export function Layout() {
  return (
    <>
      <header className="site-header">
        <p className="site-brand">AstroBookings</p>
        <nav aria-label="Principal">
          <Link to="/lanzamientos">Lanzamientos</Link>
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  );
}
