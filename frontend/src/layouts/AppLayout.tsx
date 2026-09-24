import { NavLink, Outlet } from 'react-router-dom';
import { Clock } from 'lucide-react';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Main Navigation Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 font-extrabold flex items-center justify-center text-base shadow-sm shadow-indigo-500/10">
              <Clock className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent block leading-none">
                HoraCerta
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:block mt-0.5 font-medium">
                Controle simples da sua jornada
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Navegação principal" className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80 overflow-x-auto lg:overflow-visible">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              Relatórios
            </NavLink>
            <NavLink
              to="/configuracoes"
              className={({ isActive }) =>
                `px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              Configurações
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
