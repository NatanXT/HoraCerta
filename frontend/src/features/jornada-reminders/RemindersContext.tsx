import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  ReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
  ScheduledReminder,
  ToastNotification,
  BrowserPermissionState,
} from './types';
import {
  loadReminderSettings,
  saveReminderSettings,
  loadDispatchedReminders,
  markReminderDispatched,
  purgeOldDispatchedReminders,
} from './reminders-storage';
import { evaluateReminders } from './reminders-evaluator';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  deliverBrowserNotification,
  acquireDispatchLock,
  RemindersCrossTabCoordinator,
} from './reminders-delivery';
import { profileService, ProfileScheduleDay } from '../../services/profile.service';
import { workSessionService, WorkDayWithSession } from '../../services/work-session.service';
import { getTodayDateStr, getWeekdayFromCivilDate } from '../../utils/date';
import { RemindersToastContainer } from './components/RemindersToastContainer';

interface RefreshScheduleOptions {
  broadcast?: boolean;
}

interface RemindersContextType {
  settings: ReminderSettings;
  saveSettings: (settings: ReminderSettings) => boolean;
  refreshSchedule: (
    newDays?: ProfileScheduleDay[],
    options?: RefreshScheduleOptions
  ) => Promise<void>;
  nextReminder: ScheduledReminder | null;
  browserPermission: BrowserPermissionState;
  requestPermission: () => Promise<BrowserPermissionState>;
  testReminder: () => void;
  evaluateNow: (overrideSettings?: ReminderSettings) => void;
}

const RemindersContext = createContext<RemindersContextType | undefined>(undefined);

export const RemindersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [nextReminder, setNextReminder] = useState<ScheduledReminder | null>(null);
  const [activeToasts, setActiveToasts] = useState<ToastNotification[]>([]);
  const [browserPermission, setBrowserPermission] = useState<BrowserPermissionState>('default');

  // Keep a stable ref to settings to decouple evaluateNow from settings changes
  const settingsRef = useRef<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  // Track settings changes to invalidate pending in-flight evaluations
  const settingsVersionRef = useRef<number>(0);

  // Keep a stable ref to browserPermission to prevent evaluateNow recreation
  const browserPermissionRef = useRef<BrowserPermissionState>('default');

  // Concurrency and Session Lifecycle Guards
  const sessionGenerationRef = useRef<number>(0);
  const isEvaluatingRef = useRef<boolean>(false);
  const evaluatingSessionRef = useRef<number>(0);
  const pendingEvaluationRef = useRef<boolean>(false);

  const scheduleDaysRef = useRef<ProfileScheduleDay[]>([]);
  const dispatchedIdsRef = useRef<Set<string>>(new Set<string>());
  const crossTabCoordinatorRef = useRef<RemindersCrossTabCoordinator | null>(null);
  const toastTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 1. Initial browser permission check and ref synchronization
  useEffect(() => {
    const perm = getBrowserNotificationPermission();
    setBrowserPermission(perm);
    browserPermissionRef.current = perm;
  }, []);

  useEffect(() => {
    browserPermissionRef.current = browserPermission;
  }, [browserPermission]);

  // 2. Synchronize settingsRef whenever state changes (without bumping version)
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // 3. Dismiss toast handler
  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = toastTimeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      toastTimeoutsRef.current.delete(id);
    }
  }, []);

  // 4. Push a toast notification into activeToasts with auto-dismiss
  const showToast = useCallback(
    (toast: Omit<ToastNotification, 'id' | 'createdAt'>) => {
      const id = `${toast.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const durationMs = 8000;

      const newToast: ToastNotification = {
        ...toast,
        id,
        createdAt: Date.now(),
        durationMs,
      };

      setActiveToasts((prev) => [...prev, newToast]);

      const timeout = setTimeout(() => {
        dismissToast(id);
      }, durationMs);

      toastTimeoutsRef.current.set(id, timeout);
    },
    [dismissToast]
  );

  // 5. Request browser permission
  const handleRequestPermission = useCallback(async (): Promise<BrowserPermissionState> => {
    const res = await requestBrowserNotificationPermission();
    setBrowserPermission(res);
    browserPermissionRef.current = res;
    return res;
  }, []);

  // 6. Test notification (strictly local to current tab)
  const handleTestReminder = useCallback(() => {
    showToast({
      type: 'EXIT',
      title: 'Lembrete de Demonstração',
      message: 'Este é um teste visual dos Lembretes Inteligentes do HoraCerta.',
    });

    if (settingsRef.current.browserNotificationsEnabled && browserPermissionRef.current === 'granted') {
      deliverBrowserNotification(
        'HoraCerta — Teste de Notificação',
        'As notificações do navegador estão configuradas e funcionando corretamente!'
      );
    }
  }, [showToast]);

  // 7. Evaluation runner with session generation guard, settings version validation & Web Locks coordination
  const evaluateNow = useCallback(
    async (overrideSettings?: ReminderSettings) => {
      const currentUserId = user?.id;
      const effectiveSettings = overrideSettings ?? settingsRef.current;

      if (!currentUserId || !effectiveSettings.enabled) {
        setNextReminder(null);
        return;
      }

      const currentSession = sessionGenerationRef.current;
      const evaluationSettingsVersion = settingsVersionRef.current;

      // If an evaluation is already running for THIS session, mark pending
      if (isEvaluatingRef.current && evaluatingSessionRef.current === currentSession) {
        pendingEvaluationRef.current = true;
        return;
      }

      isEvaluatingRef.current = true;
      evaluatingSessionRef.current = currentSession;

      try {
        const todayStr = getTodayDateStr();
        const workDay: WorkDayWithSession = await workSessionService.getToday();

        // Guard: If session changed, user logged out, settings version changed or reminders disabled while waiting for getToday, abort immediately!
        if (
          sessionGenerationRef.current !== currentSession ||
          user?.id !== currentUserId ||
          settingsVersionRef.current !== evaluationSettingsVersion ||
          !settingsRef.current.enabled
        ) {
          if (!settingsRef.current.enabled) {
            setNextReminder(null);
          }
          return;
        }

        // Guard: If civil date crossed midnight while awaiting getToday(), or if workDay.date does not match current civil date, abort
        const currentTodayStr = getTodayDateStr();
        if (currentTodayStr !== todayStr || (workDay?.date && workDay.date !== currentTodayStr)) {
          return;
        }

        const now = new Date();
        const currentWeekdayKey = getWeekdayFromCivilDate(todayStr);
        const scheduleDay =
          scheduleDaysRef.current.find((d) => d.weekday === currentWeekdayKey) || null;

        const evalResult = evaluateReminders({
          settings: effectiveSettings,
          userId: currentUserId,
          dateStr: todayStr,
          workDay,
          scheduleDay,
          now,
          dispatchedIds: dispatchedIdsRef.current,
        });

        // Guard before applying nextReminder: re-verify session and active settings
        if (
          sessionGenerationRef.current !== currentSession ||
          user?.id !== currentUserId ||
          settingsVersionRef.current !== evaluationSettingsVersion ||
          !settingsRef.current.enabled
        ) {
          if (!settingsRef.current.enabled) {
            setNextReminder(null);
          }
          return;
        }

        setNextReminder(evalResult.upcomingNext);

        // Trigger ready items using Web Locks coordination across tabs
        for (const item of evalResult.readyToTrigger) {
          if (dispatchedIdsRef.current.has(item.id)) continue;

          // Guard before acquiring lock
          if (
            sessionGenerationRef.current !== currentSession ||
            user?.id !== currentUserId ||
            settingsVersionRef.current !== evaluationSettingsVersion ||
            !settingsRef.current.enabled
          ) {
            return;
          }

          await acquireDispatchLock(currentUserId, item.id, async () => {
            // Re-verify session validity and active settings inside lock
            if (
              sessionGenerationRef.current !== currentSession ||
              user?.id !== currentUserId ||
              settingsVersionRef.current !== evaluationSettingsVersion ||
              !settingsRef.current.enabled
            ) {
              return false;
            }

            // Double-check storage to confirm another tab didn't dispatch while acquiring lock
            if (dispatchedIdsRef.current.has(item.id)) return false;
            const freshDispatched = loadDispatchedReminders(currentUserId);
            if (freshDispatched.some((d) => d.id === item.id)) {
              dispatchedIdsRef.current.add(item.id);
              return false;
            }

            // Mark dispatched in-memory and persist to storage
            dispatchedIdsRef.current.add(item.id);
            markReminderDispatched(currentUserId, {
              id: item.id,
              type: item.type,
              dispatchedAt: new Date().toISOString(),
              dateStr: todayStr,
            });

            // Broadcast to other tabs
            crossTabCoordinatorRef.current?.broadcastDispatched(currentUserId, item.id, item.type);

            // Re-verify enabled before delivering visible alerts
            if (!settingsRef.current.enabled) {
              return true;
            }

            // Deliver in-app toast
            showToast({
              type: item.type,
              title: item.title,
              message: item.message,
            });

            // Deliver native browser notification if tab is in background and user opted-in
            if (
              typeof document !== 'undefined' &&
              document.visibilityState === 'hidden' &&
              settingsRef.current.browserNotificationsEnabled &&
              browserPermissionRef.current === 'granted'
            ) {
              deliverBrowserNotification(item.title, item.message);
            }

            return true;
          });
        }
      } catch {
        // Silently catch network or temporary evaluation errors
      } finally {
        // Only release evaluating lock if session has NOT changed
        if (sessionGenerationRef.current === currentSession) {
          isEvaluatingRef.current = false;
          if (pendingEvaluationRef.current) {
            pendingEvaluationRef.current = false;
            // Schedule next evaluation tick
            setTimeout(() => {
              if (sessionGenerationRef.current === currentSession && user?.id === currentUserId) {
                evaluateNow();
              }
            }, 50);
          }
        }
      }
    },
    [user?.id, showToast]
  );

  // 8. Refresh Schedule: Called after saving profile schedule or upon cross-tab sync
  const refreshSchedule = useCallback(
    async (newDays?: ProfileScheduleDay[], options: RefreshScheduleOptions = { broadcast: true }) => {
      const currentUserId = user?.id;
      if (!currentUserId) return;

      const currentSession = sessionGenerationRef.current;

      try {
        if (newDays && Array.isArray(newDays)) {
          scheduleDaysRef.current = newDays;
        } else {
          const profile = await profileService.getProfile();
          if (sessionGenerationRef.current !== currentSession || user?.id !== currentUserId) {
            return;
          }
          if (profile?.workSchedule?.days) {
            scheduleDaysRef.current = profile.workSchedule.days;
          }
        }

        // Notify other tabs ONLY if broadcast is requested (e.g. from local update)
        if (options.broadcast !== false) {
          crossTabCoordinatorRef.current?.broadcastScheduleUpdated(currentUserId);
        }

        // Recalculate reminders immediately with updated schedule
        evaluateNow();
      } catch (err) {
        console.warn('[HoraCerta Reminders] Erro ao sincronizar jornada semanal atualizada:', err);
      }
    },
    [user?.id, evaluateNow]
  );

  // 9. Save settings
  const handleSaveSettings = useCallback(
    (newSettings: ReminderSettings): boolean => {
      const currentUserId = user?.id;
      if (!currentUserId) return false;

      // 1. Immediately invalidate any in-flight evaluations with older settings
      settingsVersionRef.current += 1;
      settingsRef.current = newSettings;

      // 2. Persist to storage
      const success = saveReminderSettings(currentUserId, newSettings);

      // 3. Update React state
      setSettings(newSettings);

      // 4. If disabled, clear nextReminder immediately and return
      if (!newSettings.enabled) {
        setNextReminder(null);
        return success;
      }

      // 5. Evaluate immediately with new snapshot
      evaluateNow(newSettings);
      return success;
    },
    [user?.id, evaluateNow]
  );

  // Stable refs for callbacks used in session effect
  const evaluateNowRef = useRef(evaluateNow);
  evaluateNowRef.current = evaluateNow;
  const refreshScheduleRef = useRef(refreshSchedule);
  refreshScheduleRef.current = refreshSchedule;

  // 10. Load user preferences, schedule, and initialize cross-tab coordinator on login / change
  // Runs ONLY when user?.id changes (login, logout, switch account).
  useEffect(() => {
    // Increment session generation and settings version to cancel all pending async resolutions from prior session
    sessionGenerationRef.current += 1;
    settingsVersionRef.current += 1;
    const currentSession = sessionGenerationRef.current;

    // Reset evaluating state for new session
    isEvaluatingRef.current = false;
    pendingEvaluationRef.current = false;

    // Clear active toasts and timeouts from prior session
    setActiveToasts([]);
    toastTimeoutsRef.current.forEach((t) => clearTimeout(t));
    toastTimeoutsRef.current.clear();
    setNextReminder(null);
    dispatchedIdsRef.current.clear();
    scheduleDaysRef.current = [];

    crossTabCoordinatorRef.current?.destroy();
    crossTabCoordinatorRef.current = null;

    if (!user?.id) {
      settingsRef.current = DEFAULT_REMINDER_SETTINGS;
      setSettings(DEFAULT_REMINDER_SETTINGS);
      return;
    }

    const currentUserId = user.id;

    // Load user settings
    const loaded = loadReminderSettings(currentUserId);
    settingsRef.current = loaded;
    setSettings(loaded);

    // Load dispatched IDs
    const dispatched = loadDispatchedReminders(currentUserId);
    const todayStr = getTodayDateStr();
    purgeOldDispatchedReminders(currentUserId, todayStr);
    dispatchedIdsRef.current = new Set(dispatched.map((d) => d.id));

    // Load schedule
    profileService
      .getProfile()
      .then((profile) => {
        if (sessionGenerationRef.current !== currentSession || user?.id !== currentUserId) {
          return;
        }
        if (profile?.workSchedule?.days) {
          scheduleDaysRef.current = profile.workSchedule.days;
          if (loaded.enabled) {
            evaluateNowRef.current(loaded);
          }
        }
      })
      .catch((err) => {
        console.warn('[HoraCerta Reminders] Erro ao obter jornada semanal do perfil:', err);
      });

    // Cross-tab coordination
    crossTabCoordinatorRef.current = new RemindersCrossTabCoordinator(
      () => user?.id ?? null,
      (msg) => {
        if (msg.type === 'REMINDER_DISPATCHED' && msg.id) {
          dispatchedIdsRef.current.add(msg.id);
        } else if (msg.type === 'SCHEDULE_UPDATED') {
          // Received from another tab: refresh schedule with broadcast: false to PREVENT ECHO LOOP!
          refreshScheduleRef.current(undefined, { broadcast: false });
        }
      }
    );

    return () => {
      crossTabCoordinatorRef.current?.destroy();
      crossTabCoordinatorRef.current = null;
    };
  }, [user?.id]);

  // 11. Periodic timer & window visibility/focus listeners
  useEffect(() => {
    if (!user?.id || !settings.enabled) return;

    // Check once every 45 seconds
    const interval = setInterval(() => {
      evaluateNow();
    }, 45000);

    const handleFocus = () => evaluateNow();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        evaluateNow();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, settings.enabled, evaluateNow]);

  return (
    <RemindersContext.Provider
      value={{
        settings,
        saveSettings: handleSaveSettings,
        refreshSchedule,
        nextReminder,
        browserPermission,
        requestPermission: handleRequestPermission,
        testReminder: handleTestReminder,
        evaluateNow,
      }}
    >
      {children}
      <RemindersToastContainer toasts={activeToasts} onDismiss={dismissToast} />
    </RemindersContext.Provider>
  );
};

export function useReminders(): RemindersContextType {
  const context = useContext(RemindersContext);
  if (!context) {
    throw new Error('useReminders deve ser utilizado dentro de um RemindersProvider');
  }
  return context;
}
