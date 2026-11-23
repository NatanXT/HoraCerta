import React, { useState } from 'react';
import { Landmark, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { BankHoursEvolutionPoint } from '../types';
import { formatSignedBalanceHoursMinutes } from '../../../utils/time';
import { shiftMonth } from '../../../utils/date';

interface BankHoursEvolutionChartProps {
  evolution: BankHoursEvolutionPoint[];
  isBankHoursConfigured: boolean;
  bankHoursStatus: 'configured' | 'unconfigured' | 'error';
  configStartDate: string | null;
  onRetry?: () => void;
}

export const BankHoursEvolutionChart: React.FC<BankHoursEvolutionChartProps> = ({
  evolution,
  isBankHoursConfigured,
  bankHoursStatus,
  configStartDate,
  onRetry,
}) => {
  const [activePoint, setActivePoint] = useState<BankHoursEvolutionPoint | null>(null);

  if (bankHoursStatus === 'error') {
    return (
      <div className="bg-[var(--hc-surface)] border border-rose-500/20 rounded-2xl p-6 shadow-xs text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h4 className="text-base font-bold text-[var(--hc-text)]">
            Banco de Horas Indisponível
          </h4>
          <p className="text-xs text-[var(--hc-text-secondary)] leading-relaxed">
            Não foi possível consultar os dados do Banco de Horas no servidor. As demais análises de jornada permanecem ativas e disponíveis.
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-[var(--hc-accent)] hover:opacity-90 text-[var(--hc-accent-foreground)] text-xs font-semibold transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tentar novamente</span>
          </button>
        )}
      </div>
    );
  }

  if (bankHoursStatus === 'unconfigured' || !isBankHoursConfigured) {
    return (
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 shadow-xs text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 mx-auto flex items-center justify-center">
          <Landmark className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h4 className="text-base font-bold text-[var(--hc-text)]">
            Evolução do Banco de Horas
          </h4>
          <p className="text-xs text-[var(--hc-text-secondary)] leading-relaxed">
            O Banco de Horas não está configurado nesta conta. Acesse a área de{' '}
            <strong className="text-[var(--hc-text)]">Banco de horas</strong> para definir a data de início de apuração e o saldo inicial para visualizar a curva histórica oficial.
          </p>
        </div>
      </div>
    );
  }

  const validPoints = evolution.filter(
    (p) => p.isConfiguredPeriod && p.closingBalanceMinutes !== null && p.status !== 'unavailable'
  );

  if (validPoints.length === 0) {
    const hasConfiguredPeriod = evolution.some((p) => p.isConfiguredPeriod);

    if (hasConfiguredPeriod) {
      return (
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 shadow-xs text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-[var(--hc-text)]">
            Saldo acumulado indisponível para o período
          </h4>
          <p className="text-xs text-[var(--hc-text-secondary)]">
            O extrato do Banco de Horas não possui fechamentos contínuos disponíveis para as competências selecionadas devido a lacunas ou dados não fornecidos pelo servidor.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 shadow-xs text-center space-y-2">
        <Info className="w-8 h-8 text-[var(--hc-text-muted)] mx-auto" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-[var(--hc-text)]">
          Nenhum mês apurado na vigência do Banco de Horas
        </h4>
        <p className="text-xs text-[var(--hc-text-secondary)]">
          O período filtrado é anterior à vigência configurada ({configStartDate || 'início'}). Selecione um período mais recente para acompanhar a evolução.
        </p>
      </div>
    );
  }

  // Calculate SVG dimensions and scaling based on valid values
  const minVal = Math.min(0, ...validPoints.map((p) => p.closingBalanceMinutes!));
  const maxVal = Math.max(0, ...validPoints.map((p) => p.closingBalanceMinutes!));
  const rangeSpan = Math.max(60, maxVal - minVal);

  const svgWidth = 800;
  const svgHeight = 220;
  const paddingX = 60;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const chartWidth = svgWidth - paddingX * 2;

  const getY = (val: number) => {
    const norm = (val - minVal) / rangeSpan;
    return paddingTop + chartHeight * (1 - norm);
  };

  const zeroY = getY(0);

  // Map each month in full evolution list to its slot position along X axis
  const fullMonthsWithCoords = evolution.map((p, idx) => {
    const x =
      evolution.length === 1
        ? paddingX + chartWidth / 2
        : paddingX + (idx / (evolution.length - 1)) * chartWidth;
    const y = p.closingBalanceMinutes !== null ? getY(p.closingBalanceMinutes) : zeroY;
    return { ...p, x, y };
  });

  // Calculate line segments strictly between contiguous, valid months.
  // Gaps (unavailable months) are not bridged!
  const lineSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < fullMonthsWithCoords.length - 1; i++) {
    const current = fullMonthsWithCoords[i];
    const next = fullMonthsWithCoords[i + 1];

    const isCurrentValid =
      current.isConfiguredPeriod &&
      current.closingBalanceMinutes !== null &&
      current.status !== 'unavailable';
    const isNextValid =
      next.isConfiguredPeriod &&
      next.closingBalanceMinutes !== null &&
      next.status !== 'unavailable';
    const isAdjacentMonth = shiftMonth(current.month, 1) === next.month;

    if (isCurrentValid && isNextValid && isAdjacentMonth) {
      lineSegments.push({ x1: current.x, y1: current.y, x2: next.x, y2: next.y });
    }
  }

  return (
    <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[var(--hc-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--hc-text)] tracking-tight">
              Evolução Histórica do Banco de Horas
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Oficial
            </span>
          </div>
          <p className="text-xs text-[var(--hc-text-secondary)] mt-0.5">
            Saldo acumulado oficial apurado no fechamento de cada competência mensal.
          </p>
        </div>

        {activePoint && (
          <div className="p-2 px-3 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs flex items-center gap-2 self-start sm:self-auto animate-fadeIn">
            <span className="font-semibold text-[var(--hc-text)]">{activePoint.monthLabel}:</span>
            {activePoint.closingBalanceMinutes !== null ? (
              <>
                <span
                  className={`font-mono font-bold ${
                    activePoint.closingBalanceMinutes > 0
                      ? 'text-emerald-500'
                      : activePoint.closingBalanceMinutes < 0
                      ? 'text-rose-500'
                      : 'text-[var(--hc-text)]'
                  }`}
                >
                  {formatSignedBalanceHoursMinutes(activePoint.closingBalanceMinutes)}
                </span>
                {activePoint.isCurrentMonth && (
                  <span className="text-[10px] font-bold uppercase text-amber-500">
                    (Em andamento)
                  </span>
                )}
                {activePoint.monthlyNetMinutes !== null && (
                  <span className="text-[11px] text-[var(--hc-text-muted)]">
                    (Variação: {formatSignedBalanceHoursMinutes(activePoint.monthlyNetMinutes)})
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-[var(--hc-text-muted)] italic">
                {activePoint.status === 'unavailable'
                  ? 'Dados indisponíveis'
                  : activePoint.status === 'unconfirmed'
                  ? `Fechamento não confirmado por lacuna anterior ${
                      activePoint.monthlyNetMinutes !== null
                        ? `(Variação: ${formatSignedBalanceHoursMinutes(activePoint.monthlyNetMinutes)})`
                        : ''
                    }`
                  : 'Anterior à vigência'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Responsive SVG Line Chart */}
      <div className="relative w-full overflow-x-auto custom-scrollbar">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[500px] select-none"
          role="img"
          aria-label="Gráfico de evolução do saldo oficial do banco de horas ao longo dos meses"
        >
          {/* Zero baseline */}
          <line
            x1={paddingX}
            y1={zeroY}
            x2={svgWidth - paddingX}
            y2={zeroY}
            stroke="var(--hc-border)"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />

          {/* Zero label */}
          <text
            x={paddingX - 10}
            y={zeroY + 4}
            textAnchor="end"
            fontSize="10"
            fill="var(--hc-text-muted)"
            fontFamily="monospace"
          >
            0h 00m
          </text>

          {/* Line segments connecting strictly contiguous valid points without jumping gaps */}
          {lineSegments.map((seg, sIdx) => (
            <line
              key={sIdx}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke="var(--hc-accent)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}

          {/* Interactive Nodes */}
          {fullMonthsWithCoords.map((pt) => {
            const isAvailable =
              pt.isConfiguredPeriod &&
              pt.closingBalanceMinutes !== null &&
              pt.status !== 'unavailable';
            const isSelected = activePoint?.month === pt.month;

            const isPositive = isAvailable && pt.closingBalanceMinutes! > 0;
            const isNegative = isAvailable && pt.closingBalanceMinutes! < 0;

            const nodeColor = isAvailable
              ? isPositive
                ? '#10B981' // emerald-500
                : isNegative
                ? '#F43F5E' // rose-500
                : 'var(--hc-accent)'
              : 'var(--hc-text-muted)';

            return (
              <g
                key={pt.month}
                className="cursor-pointer group"
                onClick={() => setActivePoint(pt)}
                onMouseEnter={() => setActivePoint(pt)}
              >
                {/* Click target helper */}
                <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />

                {isAvailable ? (
                  <>
                    {/* Outer halo */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 9 : 6}
                      fill={nodeColor}
                      fillOpacity="0.25"
                      className="transition-all duration-150"
                    />

                    {/* Node dot */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 5.5 : 4}
                      fill={nodeColor}
                      stroke="var(--hc-surface)"
                      strokeWidth="2"
                      strokeDasharray={pt.isCurrentMonth ? '2 2' : undefined}
                      className="transition-all duration-150"
                    />

                    {/* Balance value tag above node */}
                    <text
                      x={pt.x}
                      y={pt.y - 12}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                      fill={nodeColor}
                    >
                      {formatSignedBalanceHoursMinutes(pt.closingBalanceMinutes!)}
                    </text>
                  </>
                ) : (
                  <>
                    {/* Hollow dashed indicator for missing / unconfigured point */}
                    <circle
                      cx={pt.x}
                      cy={zeroY}
                      r="4"
                      fill="none"
                      stroke="var(--hc-border)"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={pt.x}
                      y={zeroY - 10}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--hc-text-muted)"
                    >
                      {pt.status === 'unavailable'
                        ? 'Indisp.'
                        : pt.status === 'unconfirmed'
                        ? 'Não conf.'
                        : 'Pré-vigência'}
                    </text>
                  </>
                )}

                {/* Month Label below */}
                <text
                  x={pt.x}
                  y={svgHeight - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  fill={isSelected ? 'var(--hc-text)' : 'var(--hc-text-secondary)'}
                >
                  {pt.monthLabel}
                  {pt.isCurrentMonth && ' *'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Accessible Table Summary */}
      <details className="text-xs text-[var(--hc-text-secondary)]">
        <summary className="cursor-pointer font-semibold hover:text-[var(--hc-text)] transition-colors">
          Exibir tabela acessível de fechamento mensal
        </summary>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--hc-border)]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--hc-surface-raised)] border-b border-[var(--hc-border)]">
                <th className="p-2.5 font-bold">Mês</th>
                <th className="p-2.5 font-bold">Status</th>
                <th className="p-2.5 font-bold">Saldo de Fechamento</th>
                <th className="p-2.5 font-bold">Variação no Mês</th>
                <th className="p-2.5 font-bold">Créditos</th>
                <th className="p-2.5 font-bold">Débitos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hc-border)]">
              {evolution.map((pt) => {
                const isUnavailable = pt.status === 'unavailable';
                const isUnconfigured = pt.status === 'unconfigured';
                const isUnconfirmed = pt.status === 'unconfirmed';

                return (
                  <tr key={pt.month} className="hover:bg-[var(--hc-surface-raised)] transition-colors">
                    <td className="p-2.5 font-medium">{pt.monthLabel}</td>
                    <td className="p-2.5">
                      {pt.status === 'in_progress' ? (
                        <span className="text-[10px] font-bold text-amber-500 uppercase">
                          Em andamento
                        </span>
                      ) : isUnavailable ? (
                        <span className="text-[10px] font-bold text-rose-500 uppercase">
                          Indisponível
                        </span>
                      ) : isUnconfigured ? (
                        <span className="text-[10px] text-[var(--hc-text-muted)] uppercase">
                          Pré-vigência
                        </span>
                      ) : isUnconfirmed ? (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                          Não confirmado
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-500 uppercase">
                          Fechado
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 font-mono font-bold">
                      {isUnavailable
                        ? 'Indisponível'
                        : isUnconfigured
                        ? '— (Anterior à vigência)'
                        : isUnconfirmed
                        ? '— (Lacuna no extrato)'
                        : pt.closingBalanceMinutes !== null
                        ? formatSignedBalanceHoursMinutes(pt.closingBalanceMinutes)
                        : '—'}
                    </td>
                    <td className="p-2.5 font-mono">
                      {isUnavailable
                        ? 'Indisponível'
                        : pt.monthlyNetMinutes !== null
                        ? formatSignedBalanceHoursMinutes(pt.monthlyNetMinutes)
                        : '—'}
                    </td>
                    <td className="p-2.5 font-mono text-emerald-500">
                      {isUnavailable
                        ? '—'
                        : pt.creditMinutes !== null
                        ? `+${pt.creditMinutes} min`
                        : '—'}
                    </td>
                    <td className="p-2.5 font-mono text-rose-500">
                      {isUnavailable
                        ? '—'
                        : pt.debitMinutes !== null
                        ? `-${pt.debitMinutes} min`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};
