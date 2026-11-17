import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Check,
  Pencil,
  RotateCcw,
  Sparkles,
  BookmarkPlus,
  Palette,
  AlertCircle,
  X,
} from 'lucide-react';
import { useAppearance } from '../../contexts/AppearanceContext';
import { AppearanceFavorite } from '../../types/appearance';
import {
  hexToRgb,
  rgbToHex,
  normalizeHex,
  isValidHex,
} from '../../utils/color-contrast';
import { AppTooltip } from '../ui/AppTooltip';

export const AppearanceSettings: React.FC = () => {
  const {
    mode,
    accentHex,
    favorites,
    isCustomAccent,
    saving,
    setMode,
    setAccentHex,
    selectFavorite,
    updateFavorite,
    saveCustomToFavorite,
    resetToDefaults,
  } = useAppearance();

  // Local state for free RGB picker
  const [hexInput, setHexInput] = useState(accentHex);
  const [rgbInput, setRgbInput] = useState<{ r: number; g: number; b: number }>(() => {
    return hexToRgb(accentHex) || { r: 79, g: 70, b: 229 };
  });
  const [colorError, setColorError] = useState<string | null>(null);

  // Sync inputs when active accent changes
  useEffect(() => {
    setHexInput(accentHex);
    const rgb = hexToRgb(accentHex);
    if (rgb) setRgbInput(rgb);
    setColorError(null);
  }, [accentHex]);

  // Edit Favorite Modal state
  const [editingFav, setEditingFav] = useState<AppearanceFavorite | null>(null);
  const [editName, setEditName] = useState('');
  const [editHex, setEditHex] = useState('');

  // Save to slot modal state
  const [savingToSlot, setSavingToSlot] = useState(false);
  const [targetSlotId, setTargetSlotId] = useState<string>('1');
  const [slotCustomName, setSlotCustomName] = useState('Minha Cor');

  // Confirmation dialogs
  const [confirmResetPalette, setConfirmResetPalette] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Handle free RGB input changes
  const handleHexChange = (val: string) => {
    setHexInput(val);
    const normalized = normalizeHex(val);
    if (normalized) {
      setColorError(null);
      const rgb = hexToRgb(normalized);
      if (rgb) setRgbInput(rgb);
      // Instant live preview without persisting yet
      setAccentHex(normalized, false);
    } else {
      setColorError('Formato inválido. Use #RRGGBB.');
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', valStr: string) => {
    const num = parseInt(valStr, 10);
    const validNum = isNaN(num) ? 0 : Math.max(0, Math.min(255, num));
    const nextRgb = { ...rgbInput, [channel]: validNum };
    setRgbInput(nextRgb);

    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    setHexInput(nextHex);
    setColorError(null);
    setAccentHex(nextHex, false);
  };

  const handleApplyColor = async () => {
    const normalized = normalizeHex(hexInput);
    if (!normalized) {
      setColorError('Cor inválida.');
      return;
    }
    await setAccentHex(normalized, true);
  };

  const openEditFavorite = (fav: AppearanceFavorite, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFav(fav);
    setEditName(fav.name);
    setEditHex(fav.hex);
  };

  const handleSaveFavoriteEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFav) return;
    const norm = normalizeHex(editHex);
    if (!norm) return;
    await updateFavorite(editingFav.id, editName.trim() || editingFav.name, norm);
    setEditingFav(null);
  };

  const handleConfirmSaveToSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const norm = normalizeHex(hexInput);
    if (!norm) return;
    await saveCustomToFavorite(targetSlotId, slotCustomName.trim() || 'Minha Cor', norm);
    setSavingToSlot(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Section 1: Display Mode (Light / Dark) */}
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--hc-text)] flex items-center gap-2">
            <Sun className="w-4 h-4 text-[var(--hc-accent)]" />
            Modo de Exibição
          </h2>
          <p className="text-xs text-[var(--hc-text-secondary)] mt-1">
            Alterne entre o tema claro e o tema escuro. A mudança é aplicada imediatamente em todo o sistema.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Light Mode Card */}
          <button
            type="button"
            onClick={() => setMode('LIGHT')}
            className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all cursor-pointer ${
              mode === 'LIGHT'
                ? 'bg-[var(--hc-accent-soft)] border-[var(--hc-accent)] ring-2 ring-[var(--hc-focus-ring)] shadow-md'
                : 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] hover:border-[var(--hc-accent-border)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--hc-text)]">Modo Claro</p>
                <p className="text-xs text-[var(--hc-text-secondary)]">Superfícies claras e neutras</p>
              </div>
            </div>
            {mode === 'LIGHT' && (
              <div className="w-6 h-6 rounded-full bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] flex items-center justify-center shadow-sm">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </button>

          {/* Dark Mode Card */}
          <button
            type="button"
            onClick={() => setMode('DARK')}
            className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all cursor-pointer ${
              mode === 'DARK'
                ? 'bg-[var(--hc-accent-soft)] border-[var(--hc-accent)] ring-2 ring-[var(--hc-focus-ring)] shadow-md'
                : 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] hover:border-[var(--hc-accent-border)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--hc-text)]">Modo Escuro</p>
                <p className="text-xs text-[var(--hc-text-secondary)]">Tons escuros e alto conforto visual</p>
              </div>
            </div>
            {mode === 'DARK' && (
              <div className="w-6 h-6 rounded-full bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] flex items-center justify-center shadow-sm">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Section 2: Tom de destaque (9 Favoritos) */}
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[var(--hc-border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--hc-text)] flex items-center gap-2">
              <Palette className="w-4 h-4 text-[var(--hc-accent)]" />
              Tom de Destaque
            </h2>
            <p className="text-xs text-[var(--hc-text-secondary)] mt-1">
              9 cores favoritas editáveis. Clique para aplicar instantaneamente na identidade visual do sistema.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConfirmResetPalette(true)}
            className="text-xs text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] flex items-center gap-1.5 transition-colors cursor-pointer px-2.5 py-1 rounded-lg border border-[var(--hc-border)] hover:bg-[var(--hc-surface-raised)]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar paleta padrão
          </button>
        </div>

        {/* Custom color indicator if active color is outside favorites */}
        {isCustomAccent && (
          <div className="p-3 rounded-xl bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                style={{ backgroundColor: accentHex }}
              />
              <span className="text-[var(--hc-text)] font-medium">
                Cor personalizada ativa: <span className="font-mono font-bold">{accentHex}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSavingToSlot(true)}
              className="px-3 py-1 bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] rounded-lg font-semibold hover:opacity-90 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              Salvar nos favoritos
            </button>
          </div>
        )}

        {/* 9 Favorites Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {favorites.map((fav) => {
            const isSelected = normalizeHex(fav.hex) === normalizeHex(accentHex);

            return (
              <div
                key={fav.id}
                onClick={() => selectFavorite(fav)}
                className={`group relative p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-[var(--hc-accent-soft)] border-[var(--hc-accent)] ring-2 ring-[var(--hc-focus-ring)] shadow-md'
                    : 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] hover:border-[var(--hc-accent-border)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-5 h-5 rounded-full shrink-0 border border-black/20 shadow-sm"
                    style={{ backgroundColor: fav.hex }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--hc-text)] truncate">{fav.name}</p>
                    <p className="text-[11px] font-mono text-[var(--hc-text-muted)]">{fav.hex}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <AppTooltip content={`Editar ${fav.name}`}>
                    <button
                      type="button"
                      onClick={(e) => openEditFavorite(fav, e)}
                      aria-label={`Editar ${fav.name}`}
                      className="p-1.5 rounded-lg text-[var(--hc-text-muted)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)] transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </AppTooltip>

                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] flex items-center justify-center shadow-sm">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-5 h-5" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Cor personalizada (RGB livre) */}
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
        <div className="pb-2 border-b border-[var(--hc-border)]">
          <h2 className="text-base font-semibold text-[var(--hc-text)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--hc-accent)]" />
            Cor Personalizada (RGB de 24 bits)
          </h2>
          <p className="text-xs text-[var(--hc-text-secondary)] mt-1">
            Escolha livremente qualquer cor usando o seletor visual, valores numéricos RGB (0 a 255) ou código HEX.
          </p>
        </div>

        {colorError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{colorError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Visual Picker & Preview Swatch */}
          <div className="md:col-span-4 flex items-center gap-4">
            <div className="relative group cursor-pointer">
              <input
                type="color"
                value={isValidHex(hexInput) ? normalizeHex(hexInput)! : '#4F46E5'}
                onChange={(e) => handleHexChange(e.target.value)}
                className="w-16 h-16 rounded-2xl border-2 border-[var(--hc-border)] cursor-pointer bg-transparent overflow-hidden shadow-md"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--hc-text-muted)] uppercase tracking-wider block">
                Amostra Visual
              </span>
              <span className="text-sm font-mono font-bold text-[var(--hc-text)] block mt-0.5">
                {normalizeHex(hexInput) || hexInput}
              </span>
              <span className="text-[11px] text-[var(--hc-text-secondary)]">Clique na cor para abrir o seletor</span>
            </div>
          </div>

          {/* HEX and RGB Inputs */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* HEX Input */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--hc-text-muted)] uppercase tracking-wider mb-1">
                HEX
              </label>
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#RRGGBB"
                maxLength={7}
                className="w-full px-3 py-2 bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl font-mono text-sm text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-focus-ring)] focus:border-[var(--hc-accent)] uppercase"
              />
            </div>

            {/* R Input */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--hc-text-muted)] uppercase tracking-wider mb-1">
                R (Vermelho)
              </label>
              <input
                type="number"
                min={0}
                max={255}
                value={rgbInput.r}
                onChange={(e) => handleRgbChange('r', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl font-mono text-sm text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-focus-ring)] focus:border-[var(--hc-accent)]"
              />
            </div>

            {/* G Input */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--hc-text-muted)] uppercase tracking-wider mb-1">
                G (Verde)
              </label>
              <input
                type="number"
                min={0}
                max={255}
                value={rgbInput.g}
                onChange={(e) => handleRgbChange('g', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl font-mono text-sm text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-focus-ring)] focus:border-[var(--hc-accent)]"
              />
            </div>

            {/* B Input */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--hc-text-muted)] uppercase tracking-wider mb-1">
                B (Azul)
              </label>
              <input
                type="number"
                min={0}
                max={255}
                value={rgbInput.b}
                onChange={(e) => handleRgbChange('b', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl font-mono text-sm text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-focus-ring)] focus:border-[var(--hc-accent)]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons for Custom RGB */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[var(--hc-border)]">
          <button
            type="button"
            onClick={() => setSavingToSlot(true)}
            className="px-4 py-2 rounded-xl border border-[var(--hc-border)] bg-[var(--hc-surface-raised)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-muted)] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <BookmarkPlus className="w-4 h-4 text-[var(--hc-accent)]" />
            Salvar em um dos favoritos
          </button>

          <button
            type="button"
            onClick={handleApplyColor}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] font-semibold text-xs shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Aplicando...' : 'Aplicar cor'}
          </button>
        </div>
      </div>

      {/* Section 4: Live Component Preview Card */}
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--hc-text)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--hc-accent)]" />
            Demonstração de Componentes
          </h2>
          <p className="text-xs text-[var(--hc-text-secondary)] mt-1">
            Veja em tempo real como botões, links, badges e campos interativos respondem à cor e ao modo selecionados.
          </p>
        </div>

        <div className="p-5 sm:p-6 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            {/* Primary Button */}
            <div>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--hc-text-muted)] mb-1.5">
                Botão Primário
              </span>
              <button
                type="button"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:opacity-90"
              >
                <span>Ação Principal</span>
              </button>
            </div>

            {/* Secondary Button */}
            <div>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--hc-text-muted)] mb-1.5">
                Botão Secundário
              </span>
              <button
                type="button"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-[var(--hc-surface-muted)]"
              >
                <span>Cancelar</span>
              </button>
            </div>

            {/* Link & Badge */}
            <div className="space-y-2">
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--hc-text-muted)]">
                Link e Destaque
              </span>
              <div className="flex items-center gap-3">
                <a
                  href="#preview"
                  onClick={(e) => e.preventDefault()}
                  className="text-xs font-semibold text-[var(--hc-accent)] underline hover:opacity-80 transition-opacity"
                >
                  Link ativo
                </a>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--hc-accent-soft)] text-[var(--hc-accent-soft-foreground)] border border-[var(--hc-accent-border)]">
                  Tag ativa
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Form Input with Focus */}
            <div>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--hc-text-muted)] mb-1.5">
                Campo de Formulário com Foco
              </span>
              <input
                type="text"
                readOnly
                value="Exemplo de digitação ativa"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--hc-surface)] border border-[var(--hc-accent)] ring-2 ring-[var(--hc-focus-ring)] text-xs text-[var(--hc-text)] font-medium outline-none"
              />
            </div>

            {/* Selected Card Example */}
            <div>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--hc-text-muted)] mb-1.5">
                Card Selecionado
              </span>
              <div className="p-2.5 rounded-xl bg-[var(--hc-accent-soft)] border border-[var(--hc-accent)] ring-1 ring-[var(--hc-focus-ring)] flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--hc-text)]">Item selecionado</span>
                <span className="w-5 h-5 rounded-full bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Reset All Appearance */}
      <div className="pt-2 flex justify-between items-center">
        <button
          type="button"
          onClick={() => setConfirmResetAll(true)}
          className="text-xs text-[var(--hc-text-muted)] hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar aparência padrão completa
        </button>
      </div>

      {/* MODAL: Edit Favorite Slot */}
      {editingFav && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--hc-border)]">
              <h3 className="text-base font-bold text-[var(--hc-text)]">Editar Favorito</h3>
              <button
                type="button"
                onClick={() => setEditingFav(null)}
                className="text-[var(--hc-text-muted)] hover:text-[var(--hc-text)] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFavoriteEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-1">
                  Nome do favorito
                </label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl text-sm text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-focus-ring)] focus:border-[var(--hc-accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-1">
                  Cor
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={isValidHex(editHex) ? normalizeHex(editHex)! : '#4F46E5'}
                    onChange={(e) => setEditHex(e.target.value)}
                    className="w-12 h-12 rounded-xl border border-[var(--hc-border)] cursor-pointer bg-transparent overflow-hidden"
                  />
                  <input
                    type="text"
                    value={editHex}
                    onChange={(e) => setEditHex(e.target.value)}
                    maxLength={7}
                    className="flex-1 px-3.5 py-2.5 bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl text-sm font-mono text-[var(--hc-text)] uppercase focus:outline-none focus:ring-2 focus:ring-[var(--hc-focus-ring)] focus:border-[var(--hc-accent)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--hc-border)]">
                <button
                  type="button"
                  onClick={() => setEditingFav(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--hc-border)] text-[var(--hc-text)] text-xs font-semibold hover:bg-[var(--hc-surface-raised)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] text-xs font-semibold hover:opacity-90 cursor-pointer shadow-md"
                >
                  Salvar favorito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Save Custom Color to Slot */}
      {savingToSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--hc-border)]">
              <h3 className="text-base font-bold text-[var(--hc-text)]">Salvar nos Favoritos</h3>
              <button
                type="button"
                onClick={() => setSavingToSlot(false)}
                className="text-[var(--hc-text-muted)] hover:text-[var(--hc-text)] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSaveToSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-1">
                  Nome da cor
                </label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={slotCustomName}
                  onChange={(e) => setSlotCustomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl text-sm text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-focus-ring)] focus:border-[var(--hc-accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-1">
                  Escolha o slot a substituir (1 a 9)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {favorites.map((slot) => {
                    const isTarget = slot.id === targetSlotId;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setTargetSlotId(slot.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isTarget
                            ? 'bg-[var(--hc-accent-soft)] border-[var(--hc-accent)] ring-2 ring-[var(--hc-focus-ring)] font-bold'
                            : 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] hover:border-[var(--hc-accent-border)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: slot.hex }}
                          />
                          <span className="text-xs text-[var(--hc-text)] truncate">{slot.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  O slot selecionado ({favorites.find((f) => f.id === targetSlotId)?.name}) será substituído pela nova
                  cor {hexInput}.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--hc-border)]">
                <button
                  type="button"
                  onClick={() => setSavingToSlot(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--hc-border)] text-[var(--hc-text)] text-xs font-semibold hover:bg-[var(--hc-surface-raised)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] text-xs font-semibold hover:opacity-90 cursor-pointer shadow-md"
                >
                  Confirmar e Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION: Reset Palette */}
      {confirmResetPalette && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-[var(--hc-text)]">Restaurar Paleta Padrão?</h3>
            <p className="text-xs text-[var(--hc-text-secondary)]">
              Isso restaurará os 9 favoritos iniciais (Azul, Violeta, Ciano, Esmeralda, Âmbar, Laranja, Vermelho, Rosa e
              Meia-noite).
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--hc-border)]">
              <button
                type="button"
                onClick={() => setConfirmResetPalette(false)}
                className="px-4 py-2 rounded-xl border border-[var(--hc-border)] text-[var(--hc-text)] text-xs font-semibold hover:bg-[var(--hc-surface-raised)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmResetPalette(false);
                  await resetToDefaults();
                }}
                className="px-4 py-2 rounded-xl bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] text-xs font-semibold hover:opacity-90 cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION: Reset All Appearance */}
      {confirmResetAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-[var(--hc-text)]">Restaurar Aparência Completa?</h3>
            <p className="text-xs text-[var(--hc-text-secondary)]">
              O sistema voltará ao modo Escuro (Dark) com a cor de destaque Violeta original (#4F46E5) e a paleta de 9
              favoritos inicial.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--hc-border)]">
              <button
                type="button"
                onClick={() => setConfirmResetAll(false)}
                className="px-4 py-2 rounded-xl border border-[var(--hc-border)] text-[var(--hc-text)] text-xs font-semibold hover:bg-[var(--hc-surface-raised)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmResetAll(false);
                  await resetToDefaults();
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-500 cursor-pointer"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
