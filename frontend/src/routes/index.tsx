import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { HistoryPage } from '../pages/HistoryPage';
import { BankHoursPage } from '../pages/BankHoursPage';
import { AbsencesPage } from '../pages/AbsencesPage';
import { ReportsPage } from '../pages/ReportsPage';
import { ProfilePage } from '../pages/ProfilePage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />

          {/* Protected Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/historico" element={<HistoryPage />} />
            <Route path="/banco-de-horas" element={<BankHoursPage />} />
            <Route path="/ausencias" element={<AbsencesPage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            {/* Redirect legacy /configuracoes to /perfil */}
            <Route path="/configuracoes" element={<Navigate to="/perfil" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
