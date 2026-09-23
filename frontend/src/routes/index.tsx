import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { HistoryPage } from '../pages/HistoryPage';
import { BankHoursPage } from '../pages/BankHoursPage';
import { AbsencesPage } from '../pages/AbsencesPage';
import { SettingsPage } from '../pages/SettingsPage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/historico" element={<HistoryPage />} />
          <Route path="/banco-de-horas" element={<BankHoursPage />} />
          <Route path="/ausencias" element={<AbsencesPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
