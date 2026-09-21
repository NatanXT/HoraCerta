export function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-xl">
          HC
        </div>
        
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          HoraCerta
        </h1>
        
        <p className="text-slate-400 text-sm leading-relaxed">
          Controle simples e inteligente da sua jornada de trabalho.
        </p>

        <div className="pt-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Frontend configurado com sucesso.
          </span>
        </div>
      </div>
    </main>
  );
}
