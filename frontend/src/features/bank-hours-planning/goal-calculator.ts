import {
  SavedBankHoursGoal,
  GoalProgressResult,
  GoalStatus,
  CalendarContextData,
  CompensationSimulationResult,
} from './types';
import {
  calculateCompensationSimulation,
  isValidCivilDate,
} from './compensation-calculator';

/**
 * Calcula o progresso real da meta ativa comparando o saldo inicial (baseline)
 * com o saldo oficial atual consolidado da apuração.
 */
export function calculateGoalProgress(
  goal: SavedBankHoursGoal,
  currentBalanceMinutes: number,
  todayStr: string
): GoalProgressResult {
  const { baselineBalanceMinutes, targetBalanceMinutes, targetDateStr } = goal;

  const totalSpan = targetBalanceMinutes - baselineBalanceMinutes;
  const netEvolution = currentBalanceMinutes - baselineBalanceMinutes;
  const remaining = Math.max(0, targetBalanceMinutes - currentBalanceMinutes);

  const isExpired = todayStr > targetDateStr;
  const isAchieved = currentBalanceMinutes >= targetBalanceMinutes;

  let progressPercentage = 0;
  let status: GoalStatus = 'IN_PROGRESS';

  if (isAchieved) {
    progressPercentage = 100;
    status = 'COMPLETED';
  } else if (isExpired) {
    status = 'EXPIRED';
    if (totalSpan > 0 && netEvolution > 0) {
      progressPercentage = Math.min(
        99,
        Math.max(0, Math.round((netEvolution / totalSpan) * 100))
      );
    } else {
      progressPercentage = 0;
    }
  } else if (netEvolution < 0) {
    // O saldo oficial recuou em relação ao baseline de criação
    status = 'REGRESSED';
    progressPercentage = 0;
  } else if (netEvolution === 0) {
    status = 'NOT_STARTED';
    progressPercentage = 0;
  } else {
    // Evolução líquida positiva em direção ao objetivo
    status = 'IN_PROGRESS';
    if (totalSpan > 0) {
      progressPercentage = Math.min(
        99,
        Math.max(0, Math.round((netEvolution / totalSpan) * 100))
      );
    } else {
      progressPercentage = 0;
    }
  }

  // Cálculo de dias civis restantes até a data limite
  let daysRemainingCivil = 0;
  if (isValidCivilDate(todayStr) && isValidCivilDate(targetDateStr)) {
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const [gy, gm, gd] = targetDateStr.split('-').map(Number);
    const todayUtc = Date.UTC(ty, tm - 1, td);
    const targetUtc = Date.UTC(gy, gm - 1, gd);
    const msPerDay = 86400000;
    daysRemainingCivil = Math.round((targetUtc - todayUtc) / msPerDay);
  }

  return {
    status,
    isAchieved,
    isExpired,
    progressPercentage,
    baselineBalanceMinutes,
    currentBalanceMinutes,
    targetBalanceMinutes,
    remainingMinutes: remaining,
    netEvolutionMinutes: netEvolution,
    totalSpanMinutes: totalSpan,
    daysRemainingCivil,
  };
}

/**
 * Recalcula a previsão dinâmica de compensação para a meta ativa considerando
 * o saldo oficial atual e o calendário de dias úteis restantes até a data limite.
 */
export function calculateRemainingGoalForecast(
  goal: SavedBankHoursGoal,
  currentBalanceMinutes: number,
  calendarData: CalendarContextData,
  todayStr: string
): CompensationSimulationResult {
  return calculateCompensationSimulation(
    {
      currentBalanceMinutes,
      targetBalanceMinutes: goal.targetBalanceMinutes,
      targetDateStr: goal.targetDateStr,
      dailyAdditionMinutes: goal.dailyAdditionMinutes || 30,
      mode: goal.mode || 'TARGET_DATE',
    },
    calendarData,
    todayStr
  );
}
