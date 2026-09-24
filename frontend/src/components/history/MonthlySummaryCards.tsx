import { Timer, CalendarCheck, CalendarX, TriangleAlert } from 'lucide-react';
import { MonthlyHistorySummary } from '../../types/work-day';
import { formatMinutes } from '../../utils/time';
import { MetricCard } from '../common/MetricCard';

interface MonthlySummaryCardsProps {
  summary: MonthlyHistorySummary;
}

export function MonthlySummaryCards({ summary }: MonthlySummaryCardsProps) {
  return (
    <section aria-label="Resumo mensal descritivo" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard
        title="Horas registradas"
        value={formatMinutes(summary.totalWorkedMinutes)}
        subtitle="Efetivamente trabalhadas"
        icon={Timer}
        variant="indigo"
      />

      <MetricCard
        title="Dias com registro"
        value={summary.recordedDays}
        subtitle="Dias trabalhados"
        icon={CalendarCheck}
        variant="emerald"
      />

      <MetricCard
        title="Dias sem registro"
        value={summary.daysWithoutRecords}
        subtitle="Jornada prevista sem ponto"
        icon={CalendarX}
        variant="slate"
      />

      <MetricCard
        title="Pendências"
        value={summary.incompleteDays}
        subtitle="Sessões não encerradas"
        icon={TriangleAlert}
        variant={summary.incompleteDays > 0 ? 'amber' : 'slate'}
      />
    </section>
  );
}
