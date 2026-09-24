import { Timer, ClipboardList, Scale } from 'lucide-react';
import { WorkDaySummary } from '../../types/work-day';
import { formatMinutes, formatBalance } from '../../utils/time';
import { MetricCard } from '../common/MetricCard';

interface SummaryCardProps {
  summary: WorkDaySummary;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  const isPositive = summary.balanceMinutes > 0;
  const isZero = summary.balanceMinutes === 0;

  return (
    <section aria-label="Resumo da jornada" className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        title="Trabalhado hoje"
        value={formatMinutes(summary.totalWorkedMinutes)}
        subtitle={
          summary.isOpen && summary.currentSessionMinutes > 0
            ? `Sessão atual: ${formatMinutes(summary.currentSessionMinutes)}`
            : undefined
        }
        icon={Timer}
        variant="indigo"
      />

      <MetricCard
        title="Jornada esperada"
        value={formatMinutes(summary.expectedMinutes)}
        subtitle="Carga diária esperada"
        icon={ClipboardList}
        variant="slate"
      />

      <MetricCard
        title="Saldo de hoje"
        value={formatBalance(summary.balanceMinutes)}
        subtitle={
          summary.isOpen
            ? 'Saldo parcial em andamento'
            : summary.balanceMinutes > 0
            ? 'Saldo positivo do dia'
            : summary.balanceMinutes < 0
            ? 'Saldo parcial restante'
            : 'Jornada cumprida'
        }
        icon={Scale}
        variant={isPositive ? 'emerald' : isZero ? 'slate' : 'amber'}
      />
    </section>
  );
}
