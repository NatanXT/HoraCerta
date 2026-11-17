import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { Clock, UserCircle, ChevronDown, LogOut, User, Palette, Bell, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PwaOfflineIndicator, PwaUpdateBanner } from '../features/pwa';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[var(--hc-bg)] text-[var(--hc-text)] flex flex-col selection:bg-[var(--hc-accent)] selection:text-[var(--hc-accent-foreground)]">
      <PwaOfflineIndicator />
      {/* Top Main Navigation Bar */}
      <header className="bg-[var(--hc-surface)]/90 border-b border-[var(--hc-border)] sticky top-0 z-40 backdrop-blur-md print:hidden">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] text-[var(--hc-accent)] font-extrabold flex items-center justify-center text-base shadow-sm">
              <Clock className="w-5 h-5 text-[var(--hc-accent)]" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-[var(--hc-text)] block leading-none">
                HoraCerta
              </span>
              <span className="text-[11px] text-[var(--hc-text-secondary)] hidden sm:block mt-0.5 font-medium">
                Controle simples da sua jornada
              </span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav aria-label="Navegação principal" className="flex items-center gap-1 bg-[var(--hc-surface-raised)] p-1 rounded-xl border border-[var(--hc-border)] overflow-x-auto lg:overflow-visible">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] shadow-sm'
                    : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)]'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/historico"
              className={({ isActive }) =>
                `px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] shadow-sm'
                    : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)]'
                }`
              }
            >
              Histórico
            </NavLink>
            <NavLink
              to="/banco-de-horas"
              className={({ isActive }) =>
                `px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] shadow-sm'
                    : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)]'
                }`
              }
            >
              Banco de horas
            </NavLink>
            <NavLink
              to="/ausencias"
              className={({ isActive }) =>
                `px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] shadow-sm'
                    : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)]'
                }`
              }
            >
              Ausências
            </NavLink>
            <NavLink
              to="/relatorios"
              className={({ isActive }) =>
                `px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] shadow-sm'
                    : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)]'
                }`
              }
            >
              Relatórios
            </NavLink>
          </nav>

          {/* Right User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] hover:border-[var(--hc-accent-border)] text-[var(--hc-text)] text-xs sm:text-sm font-medium transition-all cursor-pointer"
            >
              <UserCircle className="w-5 h-5 text-[var(--hc-accent)]" />
              <span className="max-w-[120px] sm:max-w-[160px] truncate">{user?.name || 'Usuário'}</span>
              <ChevronDown className={`w-4 h-4 text-[var(--hc-text-muted)] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-[var(--hc-border)]">
                  <p className="text-xs font-semibold text-[var(--hc-text)] truncate">{user?.name}</p>
                  <p className="text-[11px] text-[var(--hc-text-secondary)] truncate">{user?.email}</p>
                </div>
                <Link
                  to="/perfil"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] transition-colors"
                >
                  <User className="w-4 h-4 text-[var(--hc-accent)]" />
                  Perfil
                </Link>
                <Link
                  to="/perfil?aba=lembretes"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] transition-colors"
                >
                  <Bell className="w-4 h-4 text-[var(--hc-accent)]" />
                  Lembretes
                </Link>
                <Link
                  to="/perfil?aba=aparencia"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] transition-colors"
                >
                  <Palette className="w-4 h-4 text-[var(--hc-accent)]" />
                  Aparência
                </Link>
                <Link
                  to="/perfil?aba=aplicativo"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] transition-colors"
                >
                  <Smartphone className="w-4 h-4 text-[var(--hc-accent)]" />
                  Aplicativo
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--hc-border)] py-4 text-center text-xs text-[var(--hc-text-muted)] print:hidden">
        HoraCerta &copy; {new Date().getFullYear()} &mdash; Sistema de Gestão de Ponto e Banco de Horas
      </footer>

      {/* PWA Update Banner */}
      <PwaUpdateBanner />
    </div>
  );
}
