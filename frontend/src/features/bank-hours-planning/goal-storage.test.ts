// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveActiveGoal,
  getActiveGoal,
  clearActiveGoal,
  sanitizeGoal,
  isLocalStorageAvailable,
} from './goal-storage';
import { SavedBankHoursGoal } from './types';

describe('Goal Storage — Bank Hours Planning (ETAPA 12.5.1)', () => {
  const validGoalUser1: SavedBankHoursGoal = {
    id: 'goal-uuid-1',
    userId: 'user-alpha',
    title: 'Recuperar Banco',
    targetBalanceMinutes: 0,
    targetDateStr: '2026-12-31',
    mode: 'TARGET_DATE',
    dailyAdditionMinutes: 30,
    baselineBalanceMinutes: -240,
    createdAtStr: '2026-11-15',
    createdAtTimestamp: 1763212800000,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('1. detecta disponibilidade de armazenamento local', () => {
    expect(isLocalStorageAvailable()).toBe(true);
  });

  it('2. salva e recupera meta ativa do usuário com fidelidade', () => {
    const saved = saveActiveGoal('user-alpha', validGoalUser1);
    expect(saved).toBe(true);

    const loaded = getActiveGoal('user-alpha');
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe('goal-uuid-1');
    expect(loaded?.userId).toBe('user-alpha');
    expect(loaded?.targetBalanceMinutes).toBe(0);
    expect(loaded?.baselineBalanceMinutes).toBe(-240);
    expect(loaded?.targetDateStr).toBe('2026-12-31');
    expect(loaded?.title).toBe('Recuperar Banco');
  });

  it('3. isolamento estrito entre contas: Usuário B não acessa meta do Usuário A', () => {
    saveActiveGoal('user-alpha', validGoalUser1);

    // Consulta para usuário diferente
    const userBetaGoal = getActiveGoal('user-beta');
    expect(userBetaGoal).toBeNull();
  });

  it('4. descarta dados corrompidos ou malformados no localStorage sem lançar exceções', () => {
    // Insere JSON corrompido manualmente
    localStorage.setItem(
      'horacerta_bank_hours_goal_v1_user-alpha',
      '{ invalid_json_syntax '
    );

    const loaded = getActiveGoal('user-alpha');
    expect(loaded).toBeNull();
  });

  it('5. sanitização rejeita metas com campos ausentes, datas inexistentes ou tipos errados', () => {
    // Data limite impossível (2026-02-30)
    const invalidDateGoal = {
      ...validGoalUser1,
      targetDateStr: '2026-02-30',
    };
    expect(sanitizeGoal(invalidDateGoal, 'user-alpha')).toBeNull();

    // Minutos não inteiros
    const floatMinutesGoal = {
      ...validGoalUser1,
      targetBalanceMinutes: 120.5,
    };
    expect(sanitizeGoal(floatMinutesGoal, 'user-alpha')).toBeNull();

    // Usuário não confere com o esperado
    expect(sanitizeGoal(validGoalUser1, 'other-user')).toBeNull();

    // Modo inválido
    const invalidModeGoal = {
      ...validGoalUser1,
      mode: 'MODO_INEXISTENTE',
    };
    expect(sanitizeGoal(invalidModeGoal, 'user-alpha')).toBeNull();
  });

  it('6. exclusão voluntária remove a meta do usuário com segurança', () => {
    saveActiveGoal('user-alpha', validGoalUser1);
    expect(getActiveGoal('user-alpha')).not.toBeNull();

    const cleared = clearActiveGoal('user-alpha');
    expect(cleared).toBe(true);
    expect(getActiveGoal('user-alpha')).toBeNull();
  });
});
