import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineErrorProps {
  message: string;
  onRetry: () => void;
}

export function OfflineError({ message, onRetry }: OfflineErrorProps) {
  return (
    <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-8 sm:p-12 text-center space-y-5 shadow-xl max-w-lg mx-auto my-8">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
        <WifiOff className="w-7 h-7" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-[var(--hc-text)]">Não foi possível carregar seus dados</h2>
        <p className="text-sm text-[var(--hc-text-secondary)] leading-relaxed">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="px-6 py-2.5 rounded-xl bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 text-[var(--hc-accent-foreground)] text-sm font-semibold transition-all duration-200 shadow-md cursor-pointer inline-flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        <span>Tentar novamente</span>
      </button>
    </div>
  );
}
