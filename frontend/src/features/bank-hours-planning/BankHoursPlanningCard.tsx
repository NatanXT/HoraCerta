import { useState } from 'react';
import {
  Compass,
  CalendarCheck,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Hourglass,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { useBankHoursPlanning } from './useBankHoursPlanning';
import { AppDatePicker } from '../../components/ui/AppDatePicker';
import { formatBalance, formatHoursMinutes } from '../../utils/time';
import { formatFullDate } from '../../utils/date';

interface BankHoursPlanningCardProps {
  currentBalanceMinutes: number;
  todayStr: string;
}

export function BankHoursPlanningCard({
  currentBalanceMinutes,
  todayStr,
}: BankHoursPlanningCardProps) {
  const {
    mode,
    setMode,
    targetDateStr,
    setTargetDateStr,
    minTargetDate,
    maxTargetDate,
    targetBalanceInput,
    targetBalanceError,
    setTargetBalanceInput,
    dailyAdditionMinutes,
    setDailyAdditionMinutes,
    calendarStatus,
    loadingCalendar,
    calendarError,
    simulationResult,
    retry,
  } = useBankHoursPlanning({ currentBalanceMinutes, todayStr });

  const [showCalendarDetails, setShowCalendarDetails] = useState<boolean>(false);

  const isCurrentPositive = currentBalanceMinutes > 0;
  const isCurrentZero = currentBalanceMinutes === 0;

  const {
    isValid,
    validationErrors,
    targetBalanceMinutes: simTargetBalanceMinutes,
    breakdown,
    minutesToCompensate,
    isTargetAchieved,
    hasEligibleDays,
    suggestedDailyMinutes,
    projectedBalanceModeA,
    totalCompensatedModeB,
    projectedBalanceModeB,
    differenceFromTargetModeB,
    targetReachedDateModeB,
    eligibleDaysList,
  } = simulationResult;

  // Filter out non-eligible days for the breakdown view
  const nonWorkingDays = eligibleDaysList.filter((d) => d.status !== 'ELIGIBLE');

  return (
    <section
      aria-label="Planejamento de Compensação do Banco de Horas"
      className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-6"
    >
      {/* Header with Title and Simulation Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--hc-border)]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[var(--hc-accent-soft)] text-[var(--hc-accent)]">
            <Compass className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--hc-text)] tracking-tight">
                Planejamento de compensação
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-[var(--hc-text-secondary)]">
                SIMULAÇÃO
              </span>
            </div>
            <p className="text-xs text-[var(--hc-text-secondary)]">
              Simule metas de saldo de horas e prazos de compensação de forma informativa.
            </p>
          </div>
        </div>

        {/* Current Official Balance Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] self-start sm:self-auto text-xs">
          <span className="text-[var(--hc-text-secondary)]">Saldo oficial atual:</span>
          <strong
            className={`font-mono text-sm ${
              isCurrentPositive
                ? 'text-emerald-500'
                : isCurrentZero
                ? 'text-[var(--hc-text)]'
                : 'text-amber-500'
            }`}
          >
            {formatBalance(currentBalanceMinutes)}
          </strong>
        </div>
      </div>

      {/* Mandatory Non-Destructive Simulation Banner */}
      <div className="p-3 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] flex items-start gap-2.5 text-xs text-[var(--hc-text-secondary)]">
        <Info className="w-4 h-4 shrink-0 text-[var(--hc-text-muted)] mt-0.5" aria-hidden="true" />
        <div className="space-y-0.5">
          <strong className="text-[var(--hc-text)] block">
            Simulação informativa — não altera seus registros de ponto ou saldo oficial.
          </strong>
          <p className="text-[11px] text-[var(--hc-text-muted)]">
            Os cálculos consideram seus dias normais de expediente, excluindo folgas semanais, feriados
            e ausências cadastradas.
          </p>
        </div>
      </div>

      {/* Balance Context Notice */}
      {currentBalanceMinutes < 0 ? (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hourglass className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Você possui <strong>{formatHoursMinutes(Math.abs(currentBalanceMinutes))}</strong> de débito a recuperar no banco de horas.
            </span>
          </div>
          <span className="text-[11px] font-semibold hidden md:inline">
            Meta padrão sugerida: 00h 00min (zerar saldo)
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Não existe débito atual a recuperar. Você pode simular uma meta de crédito maior para folgas futuras.
            </span>
          </div>
          <span className="text-[11px] font-semibold hidden md:inline">
            Saldo atual positivo
          </span>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-[var(--hc-text-secondary)] block">
          Forma de simulação:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
          <button
            type="button"
            onClick={() => setMode('TARGET_DATE')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'TARGET_DATE'
                ? 'bg-[var(--hc-surface)] text-[var(--hc-text)] shadow-sm border border-[var(--hc-border)]'
                : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Modo A: Meta até uma data</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('DAILY_ADDITION')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'DAILY_ADDITION'
                ? 'bg-[var(--hc-surface)] text-[var(--hc-text)] shadow-sm border border-[var(--hc-border)]'
                : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Modo B: Acréscimo fixo por dia</span>
          </button>
        </div>
      </div>

      {/* Simulation Inputs Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input: Data Limite */}
        <div>
          <AppDatePicker
            id="simulationTargetDate"
            label="Prazo final da simulação *"
            value={targetDateStr}
            onChange={(val) => setTargetDateStr(val)}
            min={minTargetDate}
            max={maxTargetDate}
            required
          />
          {validationErrors.dateRangeError ? (
            <span className="text-[11px] text-amber-500 mt-1 block font-medium">
              {validationErrors.dateRangeError}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--hc-text-muted)] mt-1 block">
              De amanhã até {formatFullDate(maxTargetDate)}.
            </span>
          )}
        </div>

        {/* Input: Meta de Saldo */}
        <div className="space-y-1.5">
          <label htmlFor="targetBalanceInput" className="text-xs font-semibold text-[var(--hc-text-secondary)] block">
            Meta de saldo desejada (HH:MM) *
          </label>
          <input
            id="targetBalanceInput"
            type="text"
            required
            value={targetBalanceInput}
            onChange={(e) => setTargetBalanceInput(e.target.value)}
            placeholder="00:00"
            className={`w-full bg-[var(--hc-surface)] border rounded-xl px-3.5 py-2.5 text-sm text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] transition-all font-mono ${
              targetBalanceError
                ? 'border-amber-500 focus:border-amber-500'
                : 'border-[var(--hc-border)] focus:border-[var(--hc-accent)]'
            }`}
          />
          {targetBalanceError ? (
            <span className="text-[11px] text-amber-500 block font-medium">
              {targetBalanceError}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--hc-text-muted)] block">
              Exemplos: <code className="text-[var(--hc-text)] font-mono">00:00</code> (zerar débito), <code className="text-emerald-500 font-mono">+04:00</code>
            </span>
          )}
        </div>
      </div>

      {/* Mode B Extra Controls: Daily Addition Quick Select */}
      {mode === 'DAILY_ADDITION' && (
        <div className="space-y-2 p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label htmlFor="dailyAdditionInput" className="text-xs font-semibold text-[var(--hc-text)]">
              Tempo adicional a compensar por dia útil trabalhado:
            </label>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDailyAdditionMinutes(mins)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    dailyAdditionMinutes === mins
                      ? 'bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)]'
                      : 'bg-[var(--hc-surface)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] border border-[var(--hc-border)]'
                  }`}
                >
                  +{mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="dailyAdditionInput"
              type="number"
              min={1}
              max={480}
              value={dailyAdditionMinutes || ''}
              onChange={(e) => setDailyAdditionMinutes(parseInt(e.target.value, 10))}
              className="w-28 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--hc-text)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--hc-accent)]"
            />
            <span className="text-xs text-[var(--hc-text-secondary)]">
              minutos por dia ({formatHoursMinutes(dailyAdditionMinutes)} adicionais diários)
            </span>
          </div>
          {validationErrors.dailyAdditionError && (
            <span className="text-[11px] text-amber-500 block font-medium">
              {validationErrors.dailyAdditionError}
            </span>
          )}
        </div>
      )}

      {/* Calendar Loading State */}
      {loadingCalendar && (
        <div className="p-6 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] flex flex-col items-center justify-center gap-2.5 text-center">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--hc-accent)] border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-[var(--hc-text)]">
            Consultando expediente, feriados e ausências do período...
          </span>
          <span className="text-[11px] text-[var(--hc-text-muted)]">
            A projeção será apresentada assim que todos os dados do calendário forem confirmados.
          </span>
        </div>
      )}

      {/* Calendar Error State with Retry Button */}
      {!loadingCalendar && calendarStatus === 'error' && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <strong className="block font-semibold">
                Não foi possível validar o calendário para este período
              </strong>
              <p className="text-[11px] text-amber-500/90 leading-relaxed">
                {calendarError || 'Falha ao consultar expediente, feriados ou ausências.'}
              </p>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-end">
            <button
              type="button"
              onClick={retry}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 hover:bg-amber-400 active:opacity-95 transition-colors cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tentar novamente</span>
            </button>
          </div>
        </div>
      )}

      {/* Target Balance Invalid Notice */}
      {!loadingCalendar && calendarStatus === 'ready' && targetBalanceError && (
        <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs text-[var(--hc-text-muted)] text-center">
          Informe uma meta de saldo válida no formato HH:MM para visualizar a projeção.
        </div>
      )}

      {/* Projection Results Cards — Only Rendered When Calendar is Ready and Inputs are Valid */}
      {!loadingCalendar && calendarStatus === 'ready' && isValid && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--hc-text-secondary)]">
                Resultado da Simulação
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Card 1: Dias Elegíveis */}
              <div className="bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] text-[var(--hc-text-muted)] flex items-center gap-1">
                  <CalendarCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Dias elegíveis
                </span>
                <div className="text-lg font-bold font-mono text-[var(--hc-text)]">
                  {breakdown.eligibleDaysCount} {breakdown.eligibleDaysCount === 1 ? 'dia' : 'dias'}
                </div>
                <span className="text-[10px] text-[var(--hc-text-secondary)] block">
                  em {breakdown.totalCalendarDays} dias corridos
                </span>
              </div>

              {/* Card 2: Horas a Compensar */}
              <div className="bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] text-[var(--hc-text-muted)] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  A compensar
                </span>
                <div className="text-lg font-bold font-mono text-[var(--hc-text)]">
                  {formatHoursMinutes(minutesToCompensate)}
                </div>
                <span className="text-[10px] text-[var(--hc-text-secondary)] block">
                  meta: {formatBalance(simTargetBalanceMinutes)}
                </span>
              </div>

              {/* Card 3: Acréscimo Diário Sugerido / Escolhido */}
              <div className="bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] text-[var(--hc-text-muted)] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  Acréscimo por dia
                </span>
                <div className="text-lg font-bold font-mono text-[var(--hc-accent)]">
                  {mode === 'TARGET_DATE'
                    ? isTargetAchieved || !hasEligibleDays
                      ? '0 min/dia'
                      : `+${suggestedDailyMinutes} min/dia`
                    : `+${dailyAdditionMinutes} min/dia`}
                </div>
                <span className="text-[10px] text-[var(--hc-text-secondary)] block">
                  {mode === 'TARGET_DATE'
                    ? isTargetAchieved
                      ? 'meta já alcançada'
                      : formatHoursMinutes(suggestedDailyMinutes)
                    : formatHoursMinutes(dailyAdditionMinutes)}
                </span>
              </div>

              {/* Card 4: Saldo Projetado Final */}
              <div className="bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] text-[var(--hc-text-muted)] flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                  Saldo projetado
                </span>
                <div
                  className={`text-lg font-bold font-mono ${
                    (mode === 'TARGET_DATE' ? projectedBalanceModeA : projectedBalanceModeB) >= 0
                      ? 'text-emerald-500'
                      : 'text-amber-500'
                  }`}
                >
                  {formatBalance(
                    mode === 'TARGET_DATE' ? projectedBalanceModeA : projectedBalanceModeB
                  )}
                </div>
                <span className="text-[10px] text-[var(--hc-text-secondary)] block">
                  ao final do prazo
                </span>
              </div>
            </div>
          </div>

          {/* Contextual Status Feedback Box */}
          {isTargetAchieved ? (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>Meta já atingida!</strong> Seu saldo atual ({formatBalance(currentBalanceMinutes)})
                já alcança ou ultrapassa a meta de {formatBalance(simTargetBalanceMinutes)}. Nenhum acréscimo diário é necessário.
              </span>
            </div>
          ) : !hasEligibleDays ? (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>Nenhum dia de expediente elegível encontrado.</strong> O período selecionado contém
                apenas dias sem expediente, feriados ou ausências cadastradas. Selecione um prazo mais longo.
              </span>
            </div>
          ) : mode === 'DAILY_ADDITION' ? (
            <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs text-[var(--hc-text)] space-y-1">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[var(--hc-accent)] shrink-0" aria-hidden="true" />
                <span>
                  Compensando <strong>{dailyAdditionMinutes} min/dia</strong> ao longo dos{' '}
                  <strong>{breakdown.eligibleDaysCount} dias elegíveis</strong>, você gerará{' '}
                  <strong>{formatHoursMinutes(totalCompensatedModeB)}</strong> de crédito adicional estimado.
                </span>
              </div>
              {targetReachedDateModeB ? (
                <p className="text-[11px] text-emerald-500 font-semibold pl-6">
                  A meta de {formatBalance(simTargetBalanceMinutes)} poderá ser alcançada em{' '}
                  {formatFullDate(targetReachedDateModeB)}, caso o expediente e acréscimos sejam cumpridos.
                </p>
              ) : (
                <p className="text-[11px] text-amber-500 pl-6">
                  Ao final do prazo, faltarão ainda {formatHoursMinutes(Math.abs(differenceFromTargetModeB))} para atingir a meta.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs text-[var(--hc-text)] flex items-center gap-2">
              <Info className="w-4 h-4 text-[var(--hc-accent)] shrink-0" aria-hidden="true" />
              <span>
                Trabalhando <strong>{suggestedDailyMinutes} minutos a mais por dia</strong> ({formatHoursMinutes(suggestedDailyMinutes)} adicionais) nos{' '}
                <strong>{breakdown.eligibleDaysCount} dias úteis</strong>, você poderá atingir a meta em{' '}
                <strong>{formatFullDate(targetDateStr)}</strong>, considerando o expediente projetado.
              </span>
            </div>
          )}

          {/* Collapsible Calendar Days Breakdown Accordion */}
          <div className="pt-2 border-t border-[var(--hc-border)]">
            <button
              type="button"
              onClick={() => setShowCalendarDetails(!showCalendarDetails)}
              className="w-full flex items-center justify-between text-xs text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors py-1 cursor-pointer"
            >
              <span className="flex items-center gap-2 font-medium">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                Detalhamento do calendário ({breakdown.eligibleDaysCount} dias de expediente,{' '}
                {breakdown.scheduleOffDaysCount + breakdown.holidayDaysCount + breakdown.occurrenceDaysCount} dias desconsiderados)
              </span>
              {showCalendarDetails ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            {showCalendarDetails && (
              <div className="mt-3 space-y-3">
                {/* Counts Badges */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                    {breakdown.eligibleDaysCount} dias de trabalho elegíveis
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--hc-surface-raised)] text-[var(--hc-text-secondary)] border border-[var(--hc-border)] font-medium">
                    {breakdown.scheduleOffDaysCount} folgas de escala / fim de semana
                  </span>
                  {breakdown.holidayDaysCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20 font-medium">
                      {breakdown.holidayDaysCount} {breakdown.holidayDaysCount === 1 ? 'feriado' : 'feriados'}
                    </span>
                  )}
                  {breakdown.occurrenceDaysCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 font-medium">
                      {breakdown.occurrenceDaysCount} {breakdown.occurrenceDaysCount === 1 ? 'ausência/férias' : 'ausências/férias'}
                    </span>
                  )}
                </div>

                {/* List of excluded days with reason */}
                {nonWorkingDays.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--hc-border)] divide-y divide-[var(--hc-border)] text-xs">
                    {nonWorkingDays.map((day) => (
                      <div
                        key={day.date}
                        className="px-3 py-2 flex items-center justify-between bg-[var(--hc-surface-raised)] text-[var(--hc-text-secondary)]"
                      >
                        <span className="font-mono text-[var(--hc-text)]">{formatFullDate(day.date)}</span>
                        <span className="text-[11px] text-[var(--hc-text-muted)] italic">
                          {day.reason || 'Sem expediente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
