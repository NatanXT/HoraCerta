import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import {
  AppearanceFavorite,
  DEFAULT_ACCENT_HEX,
  DEFAULT_FAVORITES,
  DEFAULT_THEME_MODE,
  ThemeMode,
} from '../types/appearance';
import { appearanceService } from '../services/appearance.service';
import { deriveColorTokens, DerivedColorTokens, normalizeHex } from '../utils/color-contrast';
import { useAuth } from './AuthContext';

const CACHE_KEY_PREFIX_MODE = 'horacerta_visual_mode_';
const CACHE_KEY_PREFIX_ACCENT = 'horacerta_visual_accent_';
const CACHE_KEY_LAST_UID = 'horacerta_visual_last_uid';

// Clean up legacy un-scoped global keys to prevent any cross-account leaks
try {
  localStorage.removeItem('horacerta_visual_mode');
  localStorage.removeItem('horacerta_visual_accent');
} catch {
  // Ignore in environments where localStorage is restricted
}

function getInitialPreferences(): { mode: ThemeMode; accent: string } {
  try {
    const lastUid = localStorage.getItem(CACHE_KEY_LAST_UID);
    if (lastUid) {
      const cachedMode = localStorage.getItem(`${CACHE_KEY_PREFIX_MODE}${lastUid}`);
      const cachedAccent = localStorage.getItem(`${CACHE_KEY_PREFIX_ACCENT}${lastUid}`);
      const validMode = cachedMode === 'LIGHT' || cachedMode === 'DARK' ? cachedMode : DEFAULT_THEME_MODE;
      const validAccent = cachedAccent && normalizeHex(cachedAccent) ? normalizeHex(cachedAccent)! : DEFAULT_ACCENT_HEX;
      return { mode: validMode, accent: validAccent };
    }
  } catch {
    // Fallback to default
  }
  return { mode: DEFAULT_THEME_MODE, accent: DEFAULT_ACCENT_HEX };
}

export interface AppearanceContextType {
  mode: ThemeMode;
  accentHex: string;
  favorites: AppearanceFavorite[];
  derivedTokens: DerivedColorTokens;
  isCustomAccent: boolean;
  loading: boolean;
  saving: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  setAccentHex: (hex: string, persist?: boolean) => Promise<void>;
  selectFavorite: (fav: AppearanceFavorite) => Promise<void>;
  updateFavorite: (id: string, name: string, hex: string) => Promise<void>;
  saveCustomToFavorite: (slotId: string, name: string, hex: string) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

function applyThemeToDom(mode: ThemeMode, tokens: DerivedColorTokens) {
  const root = document.documentElement;

  // 1. Classes and data attributes
  if (mode === 'LIGHT') {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  }

  // 2. Surfaces CSS variables
  if (mode === 'LIGHT') {
    root.style.setProperty('--hc-bg', '#F8FAFC');
    root.style.setProperty('--hc-surface', '#FFFFFF');
    root.style.setProperty('--hc-surface-raised', '#F1F5F9');
    root.style.setProperty('--hc-surface-muted', '#E2E8F0');
    root.style.setProperty('--hc-border', '#E2E8F0');
    root.style.setProperty('--hc-border-subtle', '#F1F5F9');
    root.style.setProperty('--hc-text', '#0F172A');
    root.style.setProperty('--hc-text-secondary', '#475569');
    root.style.setProperty('--hc-text-muted', '#64748B');
  } else {
    root.style.setProperty('--hc-bg', '#020617');
    root.style.setProperty('--hc-surface', '#0F172A');
    root.style.setProperty('--hc-surface-raised', '#1E293B');
    root.style.setProperty('--hc-surface-muted', '#090D16');
    root.style.setProperty('--hc-border', '#1E293B');
    root.style.setProperty('--hc-border-subtle', '#334155');
    root.style.setProperty('--hc-text', '#F8FAFC');
    root.style.setProperty('--hc-text-secondary', '#94A3B8');
    root.style.setProperty('--hc-text-muted', '#64748B');
  }

  // 3. Dynamic Accent tokens
  root.style.setProperty('--hc-accent', tokens.accent);
  root.style.setProperty('--hc-accent-hover', tokens.accentHover);
  root.style.setProperty('--hc-accent-active', tokens.accentActive);
  root.style.setProperty('--hc-accent-foreground', tokens.accentForeground);
  root.style.setProperty('--hc-accent-soft', tokens.accentSoft);
  root.style.setProperty('--hc-accent-soft-foreground', tokens.accentSoftForeground);
  root.style.setProperty('--hc-accent-border', tokens.accentBorder);
  root.style.setProperty('--hc-focus-ring', tokens.focusRing);
}

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Instant boot from user-scoped localStorage (prevents flash of wrong theme on F5)
  const initial = useMemo(() => getInitialPreferences(), []);
  const [mode, setModeState] = useState<ThemeMode>(initial.mode);
  const [accentHex, setAccentHexState] = useState<string>(initial.accent);
  const [favorites, setFavorites] = useState<AppearanceFavorite[]>(DEFAULT_FAVORITES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Synchronization refs to avoid stale closures & race conditions
  const userRef = useRef(user);
  userRef.current = user;

  const prevUserIdRef = useRef<string | undefined>(undefined);

  const latestPrefsRef = useRef<{ mode: ThemeMode; accentHex: string; favorites: AppearanceFavorite[] }>({
    mode: initial.mode,
    accentHex: initial.accent,
    favorites: DEFAULT_FAVORITES,
  });

  // Concurrency serialization refs
  const isPersistingRef = useRef(false);
  const hasPendingPersistRef = useRef(false);

  const derivedTokens = useMemo(() => {
    return deriveColorTokens(accentHex, mode);
  }, [accentHex, mode]);

  // Apply immediately whenever mode or derived tokens change
  useEffect(() => {
    applyThemeToDom(mode, derivedTokens);
    if (user?.id) {
      try {
        localStorage.setItem(`${CACHE_KEY_PREFIX_MODE}${user.id}`, mode);
        localStorage.setItem(`${CACHE_KEY_PREFIX_ACCENT}${user.id}`, accentHex);
        localStorage.setItem(CACHE_KEY_LAST_UID, user.id);
      } catch {}
    }
  }, [mode, derivedTokens, accentHex, user?.id]);

  // Handle user authentication transitions and backend reconciliation
  useEffect(() => {
    // Case 1: Unauthenticated or Logged out
    if (!user) {
      prevUserIdRef.current = undefined;
      setLoading(false);
      try {
        localStorage.removeItem(CACHE_KEY_LAST_UID);
      } catch {}
      // User without session receives default Dark + Violet
      setModeState(DEFAULT_THEME_MODE);
      setAccentHexState(DEFAULT_ACCENT_HEX);
      setFavorites(DEFAULT_FAVORITES);
      latestPrefsRef.current = {
        mode: DEFAULT_THEME_MODE,
        accentHex: DEFAULT_ACCENT_HEX,
        favorites: DEFAULT_FAVORITES,
      };
      return;
    }

    // Case 2: Transitioned to a new authenticated account
    const activeUserId = user.id;
    if (prevUserIdRef.current !== activeUserId) {
      prevUserIdRef.current = activeUserId;

      // Restore user-specific cache immediately (account B will never inherit account A)
      try {
        const cachedMode = localStorage.getItem(`${CACHE_KEY_PREFIX_MODE}${activeUserId}`);
        const cachedAccent = localStorage.getItem(`${CACHE_KEY_PREFIX_ACCENT}${activeUserId}`);

        const userMode = cachedMode === 'LIGHT' || cachedMode === 'DARK' ? cachedMode : DEFAULT_THEME_MODE;
        const userAccent = cachedAccent && normalizeHex(cachedAccent) ? normalizeHex(cachedAccent)! : DEFAULT_ACCENT_HEX;

        setModeState(userMode);
        setAccentHexState(userAccent);
        latestPrefsRef.current = {
          mode: userMode,
          accentHex: userAccent,
          favorites: DEFAULT_FAVORITES,
        };
        localStorage.setItem(CACHE_KEY_LAST_UID, activeUserId);
      } catch {}
    }

    let isMounted = true;

    // Reconcile with preferences returned by backend
    async function loadBackendPreferences() {
      try {
        setLoading(true);
        const data = await appearanceService.getPreferences();
        if (isMounted && data && userRef.current?.id === activeUserId) {
          setModeState(data.mode);
          setAccentHexState(data.accentHex);
          setFavorites(data.favorites);
          latestPrefsRef.current = {
            mode: data.mode,
            accentHex: data.accentHex,
            favorites: data.favorites,
          };
          try {
            localStorage.setItem(`${CACHE_KEY_PREFIX_MODE}${activeUserId}`, data.mode);
            localStorage.setItem(`${CACHE_KEY_PREFIX_ACCENT}${activeUserId}`, data.accentHex);
            localStorage.setItem(CACHE_KEY_LAST_UID, activeUserId);
          } catch {}
        }
      } catch (err) {
        console.warn('Não foi possível carregar preferências de aparência do backend. Usando cache local.', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBackendPreferences();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Serialized coalescing persistence worker
  const queuePersist = async () => {
    if (!userRef.current) return;

    if (isPersistingRef.current) {
      // Mark pending update so the worker automatically persists the latest snapshot once in-flight call resolves
      hasPendingPersistRef.current = true;
      return;
    }

    isPersistingRef.current = true;
    setSaving(true);

    try {
      while (true) {
        hasPendingPersistRef.current = false;
        const payloadToSave = { ...latestPrefsRef.current };

        try {
          await appearanceService.updatePreferences(payloadToSave);
        } catch (err) {
          console.error('Erro ao persistir preferências de aparência:', err);
        }

        // If another change occurred while the request was in flight, coalesce and save latest snapshot
        if (!hasPendingPersistRef.current) {
          break;
        }
      }
    } finally {
      isPersistingRef.current = false;
      setSaving(false);
    }
  };

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    latestPrefsRef.current.mode = newMode;
    await queuePersist();
  };

  const setAccentHex = async (hex: string, persist = false) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return;
    setAccentHexState(normalized);
    latestPrefsRef.current.accentHex = normalized;
    if (persist) {
      await queuePersist();
    }
  };

  const selectFavorite = async (fav: AppearanceFavorite) => {
    const normalized = normalizeHex(fav.hex) || fav.hex;
    setAccentHexState(normalized);
    latestPrefsRef.current.accentHex = normalized;
    await queuePersist();
  };

  const updateFavorite = async (id: string, name: string, hex: string) => {
    const normalizedHex = normalizeHex(hex) || DEFAULT_ACCENT_HEX;
    const newFavorites = favorites.map((f) => (f.id === id ? { ...f, name, hex: normalizedHex } : f));
    setFavorites(newFavorites);
    latestPrefsRef.current.favorites = newFavorites;
    await queuePersist();
  };

  const saveCustomToFavorite = async (slotId: string, name: string, hex: string) => {
    const normalizedHex = normalizeHex(hex) || DEFAULT_ACCENT_HEX;
    const newFavorites = favorites.map((f) => (f.id === slotId ? { id: slotId, name, hex: normalizedHex } : f));
    setFavorites(newFavorites);
    setAccentHexState(normalizedHex);
    latestPrefsRef.current.favorites = newFavorites;
    latestPrefsRef.current.accentHex = normalizedHex;
    await queuePersist();
  };

  const resetToDefaults = async () => {
    setModeState(DEFAULT_THEME_MODE);
    setAccentHexState(DEFAULT_ACCENT_HEX);
    setFavorites(DEFAULT_FAVORITES);
    latestPrefsRef.current = {
      mode: DEFAULT_THEME_MODE,
      accentHex: DEFAULT_ACCENT_HEX,
      favorites: DEFAULT_FAVORITES,
    };
    await queuePersist();
  };

  const isCustomAccent = useMemo(() => {
    const normalizedActive = normalizeHex(accentHex);
    return !favorites.some((f) => normalizeHex(f.hex) === normalizedActive);
  }, [accentHex, favorites]);

  return (
    <AppearanceContext.Provider
      value={{
        mode,
        accentHex,
        favorites,
        derivedTokens,
        isCustomAccent,
        loading,
        saving,
        setMode,
        setAccentHex,
        selectFavorite,
        updateFavorite,
        saveCustomToFavorite,
        resetToDefaults,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance deve ser utilizado dentro de um AppearanceProvider');
  }
  return context;
};
