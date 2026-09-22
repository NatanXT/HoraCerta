import { NavLink, Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Main Navigation Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-extrabold flex items-center justify-center text-base shadow-inner">
              HC
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white block leading-none">
                HoraCerta
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:block mt-0.5">
                Controle simples da sua jornada
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Navegação principal" className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60 overflow-x-auto">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
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
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
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
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              Banco de horas
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
