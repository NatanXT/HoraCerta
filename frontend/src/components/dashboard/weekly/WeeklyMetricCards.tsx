import React from 'react';
import { Timer, Briefcase, Scale, CalendarCheck } from 'lucide-react';
import { WeeklySummary } from '../../../types/weekly-summary';
import { formatHoursMinutes, formatSignedBalanceHoursMinutes } from '../../../utils/time';
import { MetricCard } from '../../common/MetricCard';

interface WeeklyMetricCardsProps {
  summary: WeeklySummary;
}

export const WeeklyMetricCards: React.FC<WeeklyMetricCardsProps> = ({ summary }) => {
  const isPositive = summary.weeklyBalanceMinutes > 0;
  const isZero = summary.weeklyBalanceMinutes === 0;

  const balanceVariant = isPositive ? 'emerald' : isZero ? 'slate' : 'amber';

  const hasNominalDifference =
    summary.nominalExpectedMinutes !== undefined &&
    summary.nominalExpectedMinutes > 0 &&
    summary.nominalExpectedMinutes !== summary.plannedExpectedMinutes;

  const plannedSubtitle = hasNominalDifference
    ? `${summary.plannedDaysCount} dias previstos (${formatHoursMinutes(summary.nominalExpectedMinutes)} nominal)`
    : `${summary.plannedDaysCount} ${
        summary.plannedDaysCount === 1 ? 'dia planejado' : 'dias planejados'
      } no perfil`;

  let balanceSubtitle = '';
  if (summary.isFutureWeek) {
    balanceSubtitle = 'Semana futura (sem débitos)';
  } else if (summary.isPastWeek) {
    if (isPositive) balanceSubtitle = 'Saldo positivo apurado';
    else if (isZero) balanceSubtitle = 'Meta semanal cumprida';
    else balanceSubtitle = 'Saldo devedor apurado';
  } else {
    // Current week
    if (summary.inProgressDaysCount > 0) {
      balanceSubtitle = isPositive ? 'Saldo parcial (+ jornada aberta)' : 'Saldo parcial (em andamento)';
    } else if (isPositive) {
      balanceSubtitle = 'Saldo positivo acumulado';
    } else if (isZero) {
      balanceSubtitle = 'Jornada prevista em dia';
    } else {
      balanceSubtitle = 'Restante para a meta da semana';
    }
  }

  let recordedSubtitle = '';
  if (summary.recordedDaysCount > summary.plannedDaysCount) {
    recordedSubtitle = `${summary.plannedDaysCount} ${
      summary.plannedDaysCount === 1 ? 'dia planejado' : 'dias planejados'
    } na semana (inclui registros fora do planejamento)`;
  } else if (summary.plannedDaysCount > 0) {
    recordedSubtitle = `de ${summary.plannedDaysCount} ${
      summary.plannedDaysCount === 1 ? 'dia planejado' : 'dias planejados'
    } na semana`;
  } else {
    recordedSubtitle = 'Sem expediente planejado na semana';
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      <MetricCard
        title="Trabalhado na semana"
        value={formatHoursMinutes(summary.totalWorkedMinutes)}
        subtitle={
          summary.inProgressDaysCount > 0
            ? 'Inclui expediente em andamento hoje'
            : 'Tempo total registrado no período'
        }
        icon={Timer}
        variant="indigo"
      />

      <MetricCard
        title="Carga planejada"
        value={formatHoursMinutes(summary.plannedExpectedMinutes)}
        subtitle={plannedSubtitle}
        icon={Briefcase}
        variant="slate"
      />

      <MetricCard
        title="Saldo da semana"
        value={formatSignedBalanceHoursMinutes(summary.weeklyBalanceMinutes)}
        subtitle={balanceSubtitle}
        icon={Scale}
        variant={balanceVariant}
      />

      <MetricCard
        title="Dias com registros"
        value={`${summary.recordedDaysCount} ${
          summary.recordedDaysCount === 1 ? 'dia' : 'dias'
        }`}
        subtitle={recordedSubtitle}
        icon={CalendarCheck}
        variant="indigo"
      />
    </div>
  );
};
