import { SavedBankHoursGoal } from './types';
import { isValidCivilDate } from './compensation-calculator';

const GOAL_STORAGE_KEY_PREFIX = 'horacerta_bank_hours_goal_v1_';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
    return null;
  } catch {
    return null;
  }
}

export function isLocalStorageAvailable(): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    const testKey = '__hc_goal_storage_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitiza e valida um registro de meta vindo do armazenamento local.
 * Descarta registros corrompidos, com campos ausentes ou pertencentes a outro usuário.
 */
export function sanitizeGoal(
  data: unknown,
  expectedUserId: string
): SavedBankHoursGoal | null {
  if (!data || typeof data !== 'object' || !expectedUserId) {
    return null;
  }

  const obj = data as Partial<SavedBankHoursGoal>;

  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    return null;
  }

  if (obj.userId !== expectedUserId) {
    return null;
  }

  if (
    typeof obj.targetBalanceMinutes !== 'number' ||
    !Number.isFinite(obj.targetBalanceMinutes) ||
    !Number.isInteger(obj.targetBalanceMinutes)
  ) {
    return null;
  }

  if (
    typeof obj.baselineBalanceMinutes !== 'number' ||
    !Number.isFinite(obj.baselineBalanceMinutes) ||
    !Number.isInteger(obj.baselineBalanceMinutes)
  ) {
    return null;
  }

  if (
    typeof obj.targetDateStr !== 'string' ||
    !isValidCivilDate(obj.targetDateStr)
  ) {
    return null;
  }

  if (
    typeof obj.createdAtStr !== 'string' ||
    !isValidCivilDate(obj.createdAtStr)
  ) {
    return null;
  }

  if (
    typeof obj.createdAtTimestamp !== 'number' ||
    !Number.isFinite(obj.createdAtTimestamp) ||
    obj.createdAtTimestamp <= 0
  ) {
    return null;
  }

  const validModes = ['TARGET_DATE', 'DAILY_ADDITION'];
  if (!obj.mode || !validModes.includes(obj.mode)) {
    return null;
  }

  let dailyAdditionMinutes: number | undefined;
  if (obj.dailyAdditionMinutes !== undefined) {
    if (
      typeof obj.dailyAdditionMinutes === 'number' &&
      Number.isFinite(obj.dailyAdditionMinutes) &&
      obj.dailyAdditionMinutes >= 0 &&
      obj.dailyAdditionMinutes <= 480
    ) {
      dailyAdditionMinutes = Math.round(obj.dailyAdditionMinutes);
    }
  }

  return {
    id: obj.id.trim(),
    userId: expectedUserId,
    title: typeof obj.title === 'string' ? obj.title.trim() : undefined,
    targetBalanceMinutes: obj.targetBalanceMinutes,
    targetDateStr: obj.targetDateStr,
    dailyAdditionMinutes,
    mode: obj.mode,
    baselineBalanceMinutes: obj.baselineBalanceMinutes,
    createdAtStr: obj.createdAtStr,
    createdAtTimestamp: obj.createdAtTimestamp,
  };
}

/**
 * Salva a meta ativa para o usuário especificado no armazenamento local do navegador.
 * Garante isolamento estrito de conta e validação de schema.
 */
export function saveActiveGoal(
  userId: string,
  goal: SavedBankHoursGoal
): boolean {
  if (!userId || !userId.trim()) return false;

  const sanitized = sanitizeGoal(goal, userId);
  if (!sanitized) return false;

  const storage = getStorage();
  if (!storage) return false;

  try {
    const key = `${GOAL_STORAGE_KEY_PREFIX}${userId}`;
    storage.setItem(key, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

/**
 * Recupera a meta ativa do usuário especificado.
 * Retorna null se não houver meta, se o JSON estiver corrompido ou se o usuário não conferir.
 */
export function getActiveGoal(userId: string): SavedBankHoursGoal | null {
  if (!userId || !userId.trim()) return null;

  const storage = getStorage();
  if (!storage) return null;

  try {
    const key = `${GOAL_STORAGE_KEY_PREFIX}${userId}`;
    const raw = storage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return sanitizeGoal(parsed, userId);
  } catch {
    return null;
  }
}

/**
 * Remove a meta ativa do usuário especificado.
 */
export function clearActiveGoal(userId: string): boolean {
  if (!userId || !userId.trim()) return false;

  const storage = getStorage();
  if (!storage) return false;

  try {
    const key = `${GOAL_STORAGE_KEY_PREFIX}${userId}`;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
