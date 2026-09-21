import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { HistoryPage } from '../pages/HistoryPage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/historico" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
