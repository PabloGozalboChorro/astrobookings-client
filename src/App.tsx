import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { NotFoundPage } from './components/NotFoundPage';
import { loadConfig } from './config';
import { LaunchListPage } from './features/launches/LaunchListPage';

export function App() {
  const config = loadConfig();

  if (!config.ok) {
    return <p role="alert">{config.message}</p>;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/lanzamientos" replace />} />
        <Route path="lanzamientos" element={<LaunchListPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
