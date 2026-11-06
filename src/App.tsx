import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { NotFoundPage } from './components/NotFoundPage';
import { loadConfig } from './config';
import { LaunchDetailPage } from './features/launches/LaunchDetailPage';
import { LaunchListPage } from './features/launches/LaunchListPage';
import { LoginPage } from './features/session/LoginPage';
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </SessionProvider>
  );
}
