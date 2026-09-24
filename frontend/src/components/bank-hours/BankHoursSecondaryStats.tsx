import { TrendingUp, TrendingDown, CalendarCheck, TriangleAlert } from 'lucide-react';
import { BankHoursSummary } from '../../types/bank-hours';
import { formatMinutes } from '../../utils/time';
import { MetricCard } from '../common/MetricCard';

interface BankHoursSecondaryStatsProps {
  summary: BankHoursSummary;
}

export function BankHoursSecondaryStats({ summary }: BankHoursSecondaryStatsProps) {
  return (
    <section aria-label="Estatísticas do Banco de Horas" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard
        title="Créditos"
        value={formatMinutes(summary.creditMinutes)}
        subtitle="Horas excedentes acumuladas"
        icon={TrendingUp}
        variant="emerald"
      />

      <MetricCard
        title="Débitos"
        value={formatMinutes(summary.debitMinutes)}
        subtitle="Horas devidas acumuladas"
        icon={TrendingDown}
        variant="amber"
      />

      <MetricCard
        title="Dias contabilizados"
        value={summary.accountedDays}
        subtitle="Dias com apuração concluída"
        icon={CalendarCheck}
        variant="slate"
      />

      <MetricCard
        title="Pendências"
        value={summary.pendingDays}
        subtitle="Dias sem apurar"
        icon={TriangleAlert}
        variant={summary.pendingDays > 0 ? 'amber' : 'slate'}
      />
    </section>
  );
}
