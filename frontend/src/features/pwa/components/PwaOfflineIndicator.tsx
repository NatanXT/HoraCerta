import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const PwaOfflineIndicator: React.FC = () => {
  const { isOnline, serverStatus } = useNetworkStatus();

  // Se estiver online e com status conectado ou ainda checando, não exibe o alerta
  if (isOnline && serverStatus !== 'disconnected') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-500/10 border-b border-amber-500/20 text-amber-500 px-4 py-2 text-xs sm:text-sm font-medium transition-all print:hidden"
    >
      <div className="max-w-[1440px] mx-auto flex items-center justify-center gap-2 text-center">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>
          Sem conexão com o servidor. Os registros de ponto precisam de conexão para serem realizados.
        </span>
      </div>
    </div>
  );
};
