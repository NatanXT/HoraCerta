interface OfflineErrorProps {
  message: string;
  onRetry: () => void;
}

export function OfflineError({ message, onRetry }: OfflineErrorProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-5 shadow-xl max-w-lg mx-auto my-8">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl">
        ⚡
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Não foi possível carregar seus dados</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-950/50 cursor-pointer inline-flex items-center gap-2"
      >
        <span>🔄</span> Tentar novamente
      </button>
    </div>
  );
}
