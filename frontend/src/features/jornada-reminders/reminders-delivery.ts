import { BrowserPermissionState } from './types';

const CHANNEL_NAME = 'horacerta_reminders_bus';

function getWindow(): any {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined' && (globalThis as any).window) return (globalThis as any).window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return undefined;
}

export function getBrowserNotificationPermission(): BrowserPermissionState {
  const win = getWindow();
  if (!win || !('Notification' in win)) {
    return 'unsupported';
  }
  return win.Notification.permission as BrowserPermissionState;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserPermissionState> {
  const win = getWindow();
  if (!win || !('Notification' in win)) {
    return 'unsupported';
  }

  try {
    const permission = await win.Notification.requestPermission();
    return permission as BrowserPermissionState;
  } catch (error) {
    console.warn('[HoraCerta Reminders] Erro ao solicitar permissão de notificação:', error);
    return getBrowserNotificationPermission();
  }
}

export function deliverBrowserNotification(
  title: string,
  message: string,
  icon = '/favicon.ico'
): boolean {
  const win = getWindow();
  if (!win || !('Notification' in win)) {
    return false;
  }

  if (win.Notification.permission !== 'granted') {
    return false;
  }

  try {
    const Notif = win.Notification;
    const n = new Notif(title, {
      body: message,
      icon,
      badge: icon,
      tag: 'horacerta-workday-reminder',
      silent: false,
    });

    n.onclick = () => {
      win.focus?.();
      n.close();
    };

    return true;
  } catch (error) {
    console.warn('[HoraCerta Reminders] Falha ao instanciar notificação nativa:', error);
    return false;
  }
}

/**
 * Serializes dispatch between multiple tabs using Web Locks API when available.
 * If another tab is already dispatching or holds the lock for this reminderId, returns false.
 */
export async function acquireDispatchLock(
  userId: string,
  reminderId: string,
  fn: () => Promise<boolean> | boolean
): Promise<boolean> {
  const isWebLocksSupported =
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    typeof (navigator as any).locks?.request === 'function';

  if (isWebLocksSupported) {
    let fnExecuted = false;
    try {
      const lockName = `hc_rem_lock_${userId}_${reminderId}`;
      const acquired = await (navigator as any).locks.request(
        lockName,
        { ifAvailable: true },
        async (lock: any) => {
          if (!lock) {
            // Another tab acquired the lock first
            return false;
          }
          fnExecuted = true;
          return await fn();
        }
      );
      return Boolean(acquired);
    } catch (err) {
      if (fnExecuted) {
        // If fn was already executed, do NOT execute again on catch
        return false;
      }
      console.warn('[HoraCerta Reminders] Erro na Web Locks API ao solicitar lock:', err);
      // Fail-safe: do not duplicate dispatch on lock API exception
      return false;
    }
  }

  // Fallback when Web Locks API is unavailable:
  // Execute fn directly. Cross-tab deduplication relies on localStorage and BroadcastChannel.
  return await fn();
}

export interface CrossTabReminderMessage {
  type: 'REMINDER_DISPATCHED' | 'SCHEDULE_UPDATED';
  userId: string;
  id?: string;
  reminderType?: string;
  timestamp: number;
  source?: 'local' | 'remote';
}

export class RemindersCrossTabCoordinator {
  private channel: BroadcastChannel | null = null;
  private onMessageCallback: ((msg: CrossTabReminderMessage) => void) | null = null;
  private getUserId: () => string | null;

  constructor(
    getUserId: () => string | null,
    onMessage: (msg: CrossTabReminderMessage) => void
  ) {
    this.getUserId = getUserId;
    this.onMessageCallback = onMessage;

    const win = getWindow();
    if (win && 'BroadcastChannel' in win) {
      try {
        const BC = win.BroadcastChannel;
        const channel = new BC(CHANNEL_NAME);
        channel.onmessage = (event: any) => {
          if (event.data && typeof event.data === 'object') {
            const data = event.data as CrossTabReminderMessage;
            // Only process message if it belongs to the current user
            const currentUserId = this.getUserId();
            if (currentUserId && data.userId && data.userId === currentUserId) {
              // Tag as remote origin so listener knows not to re-broadcast
              this.onMessageCallback?.({ ...data, source: 'remote' });
            }
          }
        };
        this.channel = channel;
      } catch {
        this.channel = null;
      }
    }

    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('storage', this.handleStorageEvent);
    }
  }

  private handleStorageEvent = (e: StorageEvent) => {
    const currentUserId = this.getUserId();
    if (!currentUserId) return;

    if (e.key === `horacerta_reminders_dispatched_v1_${currentUserId}` && e.newValue) {
      try {
        const records = JSON.parse(e.newValue);
        if (Array.isArray(records) && records.length > 0) {
          const last = records[records.length - 1];
          this.onMessageCallback?.({
            type: 'REMINDER_DISPATCHED',
            userId: currentUserId,
            id: last.id,
            reminderType: last.type,
            timestamp: Date.now(),
            source: 'remote',
          });
        }
      } catch {
        // ignore parse errors
      }
    }
  };

  public broadcastDispatched(userId: string, id: string, reminderType: string): void {
    const msg: CrossTabReminderMessage = {
      type: 'REMINDER_DISPATCHED',
      userId,
      id,
      reminderType,
      timestamp: Date.now(),
      source: 'local',
    };

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {
        // ignore
      }
    }
  }

  public broadcastScheduleUpdated(userId: string): void {
    const msg: CrossTabReminderMessage = {
      type: 'SCHEDULE_UPDATED',
      userId,
      timestamp: Date.now(),
      source: 'local',
    };

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {
        // ignore
      }
    }
  }

  public destroy(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    const win = getWindow();
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('storage', this.handleStorageEvent);
    }
  }
}
