import { describe, it, expect } from 'vitest';
import {
  calculateGoalProgress,
  calculateRemainingGoalForecast,
} from './goal-calculator';
import { SavedBankHoursGoal } from './types';
import { WorkScheduleDay } from '../../types/settings';

describe('Goal Calculator — Bank Hours Planning (ETAPA 12.5.1)', () => {
  const standardSchedule: WorkScheduleDay[] = [
    { weekday: 'MONDAY', expectedMinutes: 480 },
    { weekday: 'TUESDAY', expectedMinutes: 480 },
    { weekday: 'WEDNESDAY', expectedMinutes: 480 },
    { weekday: 'THURSDAY', expectedMinutes: 480 },
    { weekday: 'FRIDAY', expectedMinutes: 480 },
    { weekday: 'SATURDAY', expectedMinutes: 0 },
    { weekday: 'SUNDAY', expectedMinutes: 0 },
  ];

  const baseGoal: SavedBankHoursGoal = {
    id: 'goal-1',
    userId: 'user-test',
    title: 'Zerar Banco de Horas',
    targetBalanceMinutes: 0,
    targetDateStr: '2026-12-15',
    mode: 'TARGET_DATE',
    dailyAdditionMinutes: 30,
    baselineBalanceMinutes: -300, // Partiu de -05h00
    createdAtStr: '2026-11-15',
    createdAtTimestamp: Date.now(),
  };

  it('1. calcula status NOT_STARTED quando o saldo atual for idêntico ao baseline de criação', () => {
    const res = calculateGoalProgress(baseGoal, -300, '2026-11-15');
    expect(res.status).toBe('NOT_STARTED');
    expect(res.progressPercentage).toBe(0);
    expect(res.isAchieved).toBe(false);
    expect(res.isExpired).toBe(false);
    expect(res.netEvolutionMinutes).toBe(0);
    expect(res.remainingMinutes).toBe(300);
    expect(res.daysRemainingCivil).toBe(30);
  });

  it('2. calcula progresso parcial proporcional (IN_PROGRESS) com evolução positiva do saldo', () => {
    // Evoluiu de -300 para -150 (metade dos 300 min necessários)
    const resHalf = calculateGoalProgress(baseGoal, -150, '2026-11-20');
    expect(resHalf.status).toBe('IN_PROGRESS');
    expect(resHalf.progressPercentage).toBe(50);
    expect(resHalf.isAchieved).toBe(false);
    expect(resHalf.netEvolutionMinutes).toBe(150);
    expect(resHalf.remainingMinutes).toBe(150);

    // Evoluiu de -300 para -60 (240 min dos 300 = 80%)
    const res80 = calculateGoalProgress(baseGoal, -60, '2026-11-25');
    expect(res80.status).toBe('IN_PROGRESS');
    expect(res80.progressPercentage).toBe(80);
    expect(res80.remainingMinutes).toBe(60);
  });

  it('3. calcula status COMPLETED (100%) quando o saldo oficial atinge ou ultrapassa a meta', () => {
    // Exatamente na meta (0 min)
    const resExact = calculateGoalProgress(baseGoal, 0, '2026-12-10');
    expect(resExact.status).toBe('COMPLETED');
    expect(resExact.progressPercentage).toBe(100);
    expect(resExact.isAchieved).toBe(true);
    expect(resExact.remainingMinutes).toBe(0);
    expect(resExact.netEvolutionMinutes).toBe(300);

    // Ultrapassou a meta (+60 min de superávit)
    const resSurplus = calculateGoalProgress(baseGoal, 60, '2026-12-10');
    expect(resSurplus.status).toBe('COMPLETED');
    expect(resSurplus.progressPercentage).toBe(100);
    expect(resSurplus.isAchieved).toBe(true);
    expect(resSurplus.remainingMinutes).toBe(0);
    expect(resSurplus.netEvolutionMinutes).toBe(360);
  });

  it('4. calcula status REGRESSED quando o saldo oficial piora em relação ao ponto de partida', () => {
    // Partiu de -300 min, mas gerou mais débito e agora está em -360 min
    const resRegressed = calculateGoalProgress(baseGoal, -360, '2026-11-18');
    expect(resRegressed.status).toBe('REGRESSED');
    expect(resRegressed.progressPercentage).toBe(0);
    expect(resRegressed.isAchieved).toBe(false);
    expect(resRegressed.netEvolutionMinutes).toBe(-60);
    expect(resRegressed.remainingMinutes).toBe(360);
  });

  it('5. calcula status EXPIRED quando a data atual ultrapassa o prazo limite sem conclusão', () => {
    // Data atual 2026-12-20 é posterior a 2026-12-15
    // Saldo evoluiu de -300 para -60 (80%), mas o prazo expirou
    const resExpiredPartial = calculateGoalProgress(baseGoal, -60, '2026-12-20');
    expect(resExpiredPartial.status).toBe('EXPIRED');
    expect(resExpiredPartial.isExpired).toBe(true);
    expect(resExpiredPartial.isAchieved).toBe(false);
    expect(resExpiredPartial.progressPercentage).toBe(80);
    expect(resExpiredPartial.daysRemainingCivil).toBeLessThan(0);

    // Expirou sem evolução alguma
    const resExpiredZero = calculateGoalProgress(baseGoal, -360, '2026-12-20');
    expect(resExpiredZero.status).toBe('EXPIRED');
    expect(resExpiredZero.progressPercentage).toBe(0);
  });

  it('6. previne categoricamente divisão por zero se o baseline de criação for igual à meta', () => {
    const zeroSpanGoal: SavedBankHoursGoal = {
      ...baseGoal,
      baselineBalanceMinutes: 120,
      targetBalanceMinutes: 120, // baseline === target
    };

    // Saldo atual já é 120: meta atingida (100%)
    const resEqual = calculateGoalProgress(zeroSpanGoal, 120, '2026-11-15');
    expect(resEqual.status).toBe('COMPLETED');
    expect(resEqual.progressPercentage).toBe(100);
    expect(resEqual.isAchieved).toBe(true);

    // Saldo caiu para 60: não atingido, 0% sem NaN
    const resDrop = calculateGoalProgress(zeroSpanGoal, 60, '2026-11-15');
    expect(resDrop.status).toBe('REGRESSED');
    expect(resDrop.progressPercentage).toBe(0);
    expect(Number.isNaN(resDrop.progressPercentage)).toBe(false);
  });

  it('7. suporta meta com saldo inicial positivo buscando superávit maior', () => {
    const surplusGoal: SavedBankHoursGoal = {
      ...baseGoal,
      baselineBalanceMinutes: 120, // +02h00
      targetBalanceMinutes: 300, // +05h00 (requer +180 min)
    };

    // Saldo atual em +210 (+03h30): evoluiu 90 min dos 180 min necessários (50%)
    const res = calculateGoalProgress(surplusGoal, 210, '2026-11-20');
    expect(res.status).toBe('IN_PROGRESS');
    expect(res.progressPercentage).toBe(50);
    expect(res.remainingMinutes).toBe(90);
    expect(res.netEvolutionMinutes).toBe(90);
  });

  it('8. recalcula a previsão dinâmica de compensação utilizando o motor puro de calendário', () => {
    const customGoal: SavedBankHoursGoal = {
      ...baseGoal,
      targetDateStr: '2026-11-20',
    };

    const forecast = calculateRemainingGoalForecast(
      customGoal,
      -180, // Saldo atual em -03h00 (faltam 180 min)
      {
        userId: 'user-test',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15' // Domingo (5 dias úteis: 16 a 20)
    );

    expect(forecast.isValid).toBe(true);
    expect(forecast.breakdown.eligibleDaysCount).toBe(5);
    expect(forecast.minutesToCompensate).toBe(180);
    expect(forecast.suggestedDailyMinutes).toBe(36); // 180 / 5 = 36 min/dia
    expect(forecast.projectedBalanceModeA).toBe(0);
  });
});
