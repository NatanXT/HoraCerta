import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, Share, Info, Monitor } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export const PwaInstallCard: React.FC = () => {
  const { canInstall, isInstalled, isStandalone, isIos, promptInstall } = usePwaInstall();
  const [installing, setInstalling] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleInstallClick = async () => {
    try {
      setInstalling(true);
      setActionMessage(null);
      const success = await promptInstall();
      if (success) {
        setActionMessage('Instalação autorizada! O aplicativo está sendo instalado pelo navegador.');
      }
    } catch (_error) {
      setActionMessage('Não foi possível iniciar a instalação no momento.');
    } finally {
      setInstalling(false);
    }
  };

  const isAlreadyActive = isStandalone || isInstalled;

  return (
    <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] flex items-center justify-center text-[var(--hc-accent)]">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--hc-text)]">
              Instalar HoraCerta
            </h2>
            <p className="text-xs sm:text-sm text-[var(--hc-text-secondary)] mt-0.5">
              Tenha acesso mais rápido ao seu controle de jornada diretamente pelo computador ou celular.
            </p>
          </div>
        </div>

        {isAlreadyActive && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            HoraCerta instalado
          </span>
        )}
      </div>

      {actionMessage && (
        <div
          role="status"
          className="p-3 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs text-[var(--hc-text)] flex items-center gap-2"
        >
          <Info className="w-4 h-4 text-[var(--hc-accent)] shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* State 1: Already installed or running in standalone mode */}
      {isAlreadyActive ? (
        <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] space-y-2">
          <p className="text-xs sm:text-sm text-[var(--hc-text)] font-medium">
            O aplicativo já está instalado e pronto para uso no seu dispositivo.
          </p>
          <p className="text-xs text-[var(--hc-text-secondary)]">
            Você pode abri-lo diretamente pela tela inicial ou menu de aplicativos com sua própria janela independente, sem barras do navegador.
          </p>
        </div>
      ) : canInstall ? (
        /* State 2: Programmatic install available (Chrome, Edge, Android) */
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-[var(--hc-text-secondary)]">
            Instale o HoraCerta como aplicativo independente para ter carregamento rápido, ícone próprio e navegação sem barras do navegador.
          </p>
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {installing ? 'Instalando...' : 'Instalar aplicativo'}
          </button>
        </div>
      ) : isIos ? (
        /* State 3: iOS / iPadOS Instructions */
        <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] space-y-2.5">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--hc-text)]">
            <Share className="w-4 h-4 text-[var(--hc-accent)]" />
            Como instalar no iPhone ou iPad:
          </div>
          <ol className="text-xs text-[var(--hc-text-secondary)] space-y-1.5 list-decimal list-inside pl-1">
            <li>No Safari ou Chrome, toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta para cima).</li>
            <li>Role a lista para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.</li>
            <li>Confirme tocando em <strong>"Adicionar"</strong> no canto superior direito.</li>
          </ol>
        </div>
      ) : (
        /* State 4: Desktop / browsers without programmatic prompt */
        <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] space-y-2.5">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--hc-text)]">
            <Monitor className="w-4 h-4 text-[var(--hc-accent)]" />
            Instalação pelo navegador:
          </div>
          <p className="text-xs text-[var(--hc-text-secondary)] leading-relaxed">
            Para instalar no computador, procure pelo ícone de instalação (computador com seta para baixo) na barra de endereços do seu navegador ou abra o menu do navegador (<strong>⋯</strong>) e selecione <strong>"Instalar HoraCerta"</strong>.
          </p>
        </div>
      )}
    </div>
  );
};
