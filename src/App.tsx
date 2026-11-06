import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { NotFoundPage } from './components/NotFoundPage';
import { loadConfig } from './config';
import { BookingDetailPage } from './features/bookings/BookingDetailPage';
import { MyBookingsPage } from './features/bookings/MyBookingsPage';
import { LaunchDetailPage } from './features/launches/LaunchDetailPage';
import { LaunchListPage } from './features/launches/LaunchListPage';
import { LoginPage } from './features/session/LoginPage';
import { RegisterPage } from './features/session/RegisterPage';
import { RequireAuth } from './features/session/RequireAuth';
import { SessionProvider } from './features/session/SessionProvider';

export function App() {
  const config = loadConfig();

  if (!config.ok) {
    return <p role="alert">{config.message}</p>;
  }

  return (
    <SessionProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/lanzamientos" replace />} />
          <Route path="lanzamientos" element={<LaunchListPage />} />
          <Route path="lanzamientos/:id" element={<LaunchDetailPage />} />
          <Route path="acceso" element={<LoginPage />} />
          <Route path="registro" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route path="reservas" element={<MyBookingsPage />} />
            <Route path="reservas/:id" element={<BookingDetailPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </SessionProvider>
  );
}
