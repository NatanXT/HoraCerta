export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PwaInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  isIos: boolean;
  isMobile: boolean;
  promptInstall: () => Promise<boolean>;
}

export type UpdateCycleStatus =
  | 'idle'
  | 'waiting_available'
  | 'updating'
  | 'ready_to_reload'
  | 'blocked_by_mutation'
  | 'error';

export interface PwaUpdateState {
  hasUpdate: boolean;
  isUpdating: boolean;
  updateStatus: UpdateCycleStatus;
  updateError: string | null;
  updateNow: () => Promise<void>;
  reloadNow: () => void;
  dismissUpdate: () => void;
}

export type ServerReachabilityStatus = 'checking' | 'connected' | 'disconnected';

export interface NetworkStatusState {
  isOnline: boolean;
  isServerReachable: boolean;
  serverStatus: ServerReachabilityStatus;
}
