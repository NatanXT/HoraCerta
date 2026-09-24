import { LockKeyhole, Clock3, Zap } from 'lucide-react';
import { BankHoursSummary } from '../../types/bank-hours';
import { formatBalance } from '../../utils/time';
import { MetricCard } from '../common/MetricCard';

interface BankHoursSummaryCardsProps {
  summary: BankHoursSummary;
}

export function BankHoursSummaryCards({ summary }: BankHoursSummaryCardsProps) {
  const isConsolidatedPositive = summary.consolidatedBalanceMinutes > 0;
  const isConsolidatedZero = summary.consolidatedBalanceMinutes === 0;

  const isLivePositive = summary.liveBalanceMinutes > 0;
  const isLiveZero = summary.liveBalanceMinutes === 0;

  return (
    <section aria-label="Saldos do Banco de Horas" className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        title="Saldo consolidado"
        value={formatBalance(summary.consolidatedBalanceMinutes)}
        subtitle="Fechado até ontem"
        icon={LockKeyhole}
        variant={isConsolidatedPositive ? 'emerald' : isConsolidatedZero ? 'slate' : 'amber'}
      />

      <MetricCard
        title="Saldo de hoje"
        value={summary.todayBalanceMinutes !== null ? formatBalance(summary.todayBalanceMinutes) : 'Não iniciado'}
        subtitle="Provisório do dia atual"
        icon={Clock3}
        variant={
          summary.todayBalanceMinutes === null
            ? 'slate'
            : summary.todayBalanceMinutes > 0
            ? 'emerald'
            : summary.todayBalanceMinutes === 0
            ? 'slate'
            : 'amber'
        }
      />

      <MetricCard
        title="Saldo agora"
        value={formatBalance(summary.liveBalanceMinutes)}
        subtitle="Consolidado + movimento de hoje"
        icon={Zap}
        variant={isLivePositive ? 'emerald' : isLiveZero ? 'purple' : 'amber'}
        badge="AO VIVO"
        badgeVariant={isLivePositive ? 'success' : isLiveZero ? 'info' : 'warning'}
      />
    </section>
  );
}
