import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  CalendarRange,
  Download,
  Printer,
  X,
  AlertCircle,
  PiggyBank,
  CalendarOff,
  Search,
  Timer,
  ClipboardList,
  Scale,
  TriangleAlert,
  Info,
} from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { formatMinutes, formatBalance } from '../utils/time';
import { getTodayDateStr } from '../utils/date';
import { CALENDAR_OCCURRENCE_TYPE_LABELS } from '../types/calendar-occurrence';
import { CustomDatePicker } from '../components/common/CustomDatePicker';
import { MetricCard } from '../components/common/MetricCard';
import { ReportDayDetailModal } from '../components/reports/ReportDayDetailModal';
import { ReportDay } from '../types/report';

function getDefaultPeriod(): { from: string; to: string } {
  const today = getTodayDateStr(); // YYYY-MM-DD
  const [yearStr, monthStr] = today.split('-');
  const from = `${yearStr}-${monthStr}-01`;
  return { from, to: today };
}

function formatWeekdayPt(weekday: string): string {
  const names: Record<string, string> = {
    MONDAY: 'Segunda-feira',
    TUESDAY: 'Terça-feira',
    WEDNESDAY: 'Quarta-feira',
    THURSDAY: 'Quinta-feira',
    FRIDAY: 'Sexta-feira',
    SATURDAY: 'Sábado',
    SUNDAY: 'Domingo',
  };
  return names[weekday] || weekday;
}

export function ReportsPage() {
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [fromDate, setFromDate] = useState(defaultPeriod.from);
  const [toDate, setToDate] = useState(defaultPeriod.to);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedDetailDay, setSelectedDetailDay] = useState<ReportDay | null>(null);

  const {
    report,
    loading,
    csvDownloading,
    error,
    setError,
    fetchReport,
    downloadCsv,
  } = useReports(defaultPeriod.from, defaultPeriod.to);

  const handleApplyPreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30_DAYS' | 'THIS_YEAR') => {
    setValidationError(null);
    const todayStr = getTodayDateStr();
    const [y, m] = todayStr.split('-').map(Number);

    let newFrom = '';
    let newTo = todayStr;

    if (preset === 'THIS_MONTH') {
      newFrom = `${y}-${String(m).padStart(2, '0')}-01`;
      newTo = todayStr;
    } else if (preset === 'LAST_MONTH') {
      let prevM = m - 1;
      let prevY = y;
      if (prevM < 1) {
        prevM = 12;
        prevY -= 1;
      }
      const daysInPrev = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
      newFrom = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
      newTo = `${prevY}-${String(prevM).padStart(2, '0')}-${String(daysInPrev).padStart(2, '0')}`;
    } else if (preset === 'LAST_30_DAYS') {
      const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
      const past30 = new Date(todayDate.getTime() - 29 * 86400000);
      newFrom = past30.toISOString().substring(0, 10);
      newTo = todayStr;
    } else if (preset === 'THIS_YEAR') {
      newFrom = `${y}-01-01`;
      newTo = todayStr;
    }

    setFromDate(newFrom);
    setToDate(newTo);
    fetchReport(newFrom, newTo);
  };

  const handleGenerateReport = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!fromDate || !toDate) {
      setValidationError('Selecione as datas inicial e final.');
      return;
    }

    if (fromDate > toDate) {
      setValidationError('A data inicial não pode ser maior que a data final.');
      return;
    }

    const fromUtc = new Date(`${fromDate}T00:00:00.000Z`).getTime();
    const toUtc = new Date(`${toDate}T00:00:00.000Z`).getTime();
    const diffDays = Math.floor((toUtc - fromUtc) / 86400000) + 1;

    if (diffDays > 366) {
      setValidationError('O período do relatório não pode ultrapassar 366 dias.');
      return;
    }

    fetchReport(fromDate, toDate);
  };

  const handlePrint = () => {
    if (!report) return;
    window.print();
  };

  const handleDownloadCsv = () => {
    if (!fromDate || !toDate || csvDownloading) return;
    downloadCsv(fromDate, toDate);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white print:bg-white print:text-slate-900">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 print:p-0 print:space-y-4 print:max-w-none">
        {/* Page Header (Hidden on print) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800/80 gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">Relatórios</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Analise sua jornada, saldos, pendências e ocorrências em um período personalizado.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={handleDownloadCsv}
              disabled={loading || csvDownloading || !report}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/80 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>{csvDownloading ? 'Exportando...' : 'Exportar CSV'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={!report || loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Salvar em PDF / Imprimir</span>
            </button>
          </div>
        </div>

        {/* Print-Only Header */}
        <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">HoraCerta — Relatório de Jornada</h1>
              <p className="text-sm text-slate-600">
                Período: <span className="font-mono font-bold">{fromDate}</span> até{' '}
                <span className="font-mono font-bold">{toDate}</span>
              </p>
            </div>
            {report && (
              <div className="text-right text-xs text-slate-500">
                Gerado em: {new Date(report.period.generatedAt).toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        </div>

        {/* Global Error Banner (Hidden on print) */}
        {(error || validationError) && (
          <div className="flex items-center justify-between p-3.5 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl print:hidden">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError || error}</span>
            </div>
            <button
              onClick={() => {
                setError(null);
                setValidationError(null);
              }}
              className="text-rose-400 hover:text-rose-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Card (Hidden on print) */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4 backdrop-blur-sm print:hidden">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs uppercase tracking-wider">
            <CalendarRange className="w-4 h-4 text-indigo-400" />
            <span>Seleção de Período</span>
          </div>

          <form onSubmit={handleGenerateReport} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CustomDatePicker
                label="Data inicial"
                value={fromDate}
                onChange={(val) => setFromDate(val)}
                required
              />

              <CustomDatePicker
                label="Data final"
                value={toDate}
                onChange={(val) => setToDate(val)}
                required
              />
            </div>

            {/* Presets and Submit */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 mr-1">Atalhos:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('THIS_MONTH')}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                >
                  Este mês
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('LAST_MONTH')}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                >
                  Mês anterior
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('LAST_30_DAYS')}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                >
                  Últimos 30 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('THIS_YEAR')}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                >
                  Este ano
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                <Search className="w-4 h-4" />
                <span>{loading ? 'Gerando...' : 'Gerar relatório'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Loading State */}
        {loading && !report && (
          <div className="p-12 text-center text-xs text-slate-400 bg-slate-900/30 border border-slate-800 rounded-2xl print:hidden">
            Gerando relatório do período...
          </div>
        )}

        {/* Report Content */}
        {report && (
          <div className="space-y-6 sm:space-y-8 print:space-y-6">
            {/* 1. Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Horas trabalhadas"
                value={formatMinutes(report.summary.workedMinutes)}
                subtitle={`${report.summary.recordedDays} dias com registro`}
                icon={Timer}
                variant="indigo"
              />

              <MetricCard
                title="Carga prevista"
                value={formatMinutes(report.summary.scheduledMinutes)}
                subtitle={`${report.summary.calendarDays} dias no período`}
                icon={ClipboardList}
                variant="slate"
              />

              <MetricCard
                title="Saldo apurado"
                value={
                  report.bankHours.configured && report.bankHours.periodConsolidatedBalanceMinutes !== null
                    ? formatBalance(report.bankHours.periodConsolidatedBalanceMinutes)
                    : '--'
                }
                subtitle={report.bankHours.configured ? 'No período selecionado' : 'Banco não configurado'}
                icon={Scale}
                variant={
                  !report.bankHours.configured
                    ? 'slate'
                    : (report.bankHours.periodConsolidatedBalanceMinutes ?? 0) >= 0
                    ? 'emerald'
                    : 'amber'
                }
              />

              <MetricCard
                title="Pendências"
                value={report.summary.pendingDays}
                subtitle={`${report.summary.noRecordsDays} sem registro + ${report.summary.incompleteDays} incompleto`}
                icon={TriangleAlert}
                variant={report.summary.pendingDays > 0 ? 'amber' : 'slate'}
              />
            </div>

            {/* 2. Bank Hours Section */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 backdrop-blur-sm print:bg-slate-50 print:border-slate-300 print:shadow-none">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 print:border-slate-300">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-emerald-400 print:text-emerald-700" />
                  <h3 className="text-base font-bold text-white print:text-slate-900">
                    Apuração de Banco de Horas no Período
                  </h3>
                </div>
                {report.bankHours.configured && (
                  <span className="text-xs text-slate-400 font-mono print:text-slate-600">
                    Início apuração: {report.bankHours.startDate}
                  </span>
                )}
              </div>

              {report.bankHours.configured ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block print:text-slate-600">
                      Créditos (+)
                    </span>
                    <span className="text-lg font-mono font-bold text-emerald-400 mt-0.5 block print:text-emerald-700">
                      +{formatMinutes(report.bankHours.periodCreditMinutes ?? 0)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block print:text-slate-600">
                      Débitos (-)
                    </span>
                    <span className="text-lg font-mono font-bold text-amber-400 mt-0.5 block print:text-amber-700">
                      -{formatMinutes(report.bankHours.periodDebitMinutes ?? 0)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block print:text-slate-600">
                      Saldo Consolidado
                    </span>
                    <span className="text-lg font-mono font-bold text-white mt-0.5 block print:text-slate-900">
                      {formatBalance(report.bankHours.periodConsolidatedBalanceMinutes ?? 0)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block print:text-slate-600">
                      Saldo Período Agora
                    </span>
                    <span className="text-lg font-mono font-bold text-indigo-300 mt-0.5 block print:text-indigo-900">
                      {formatBalance(report.bankHours.livePeriodBalanceMinutes ?? 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between gap-3 print:bg-white print:border-slate-300 print:text-slate-700">
                  <span>O Banco de Horas ainda não foi configurado.</span>
                  <Link
                    to="/banco-de-horas"
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline print:hidden"
                  >
                    Configurar banco de horas
                  </Link>
                </div>
              )}
            </div>

            {/* 3. Occurrences Breakdown Section */}
            {report.occurrences.totalOccurrenceDays > 0 && (
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 backdrop-blur-sm print:bg-slate-50 print:border-slate-300 print:shadow-none">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 print:border-slate-300">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="w-5 h-5 text-indigo-400 print:text-indigo-700" />
                    <h3 className="text-base font-bold text-white print:text-slate-900">
                      Ocorrências e Ausências no Período
                    </h3>
                  </div>
                  <span className="text-xs text-indigo-300 font-semibold print:text-slate-700">
                    {report.occurrences.totalOccurrenceDays} dia(s) cobertos
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
                  {report.occurrences.byType.map((occItem) => (
                    <div
                      key={occItem.type}
                      className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1 print:bg-white print:border-slate-300"
                    >
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block truncate print:text-slate-600">
                        {CALENDAR_OCCURRENCE_TYPE_LABELS[occItem.type as keyof typeof CALENDAR_OCCURRENCE_TYPE_LABELS] || occItem.type}
                      </span>
                      <span className="text-base font-mono font-bold text-white block print:text-slate-900">
                        {occItem.days} dia(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Daily Details Section */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 backdrop-blur-sm print:bg-white print:border-none print:shadow-none print:p-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800/80 print:border-slate-300 gap-2">
                <h3 className="text-base font-bold text-white print:text-slate-900">
                  Detalhamento Diário da Jornada
                </h3>
                <p className="text-[11px] text-indigo-300 font-medium flex items-center gap-1.5 print:hidden">
                  <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Dê um duplo clique em qualquer linha para visualizar os detalhes completos do dia.</span>
                </p>
              </div>

              {/* Desktop Table View */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider print:border-slate-300 print:text-slate-700">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Dia da semana</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Ocorrência</th>
                      <th className="py-2.5 px-3 text-right">Previsto</th>
                      <th className="py-2.5 px-3 text-right">Trabalhado</th>
                      <th className="py-2.5 px-3 text-right">Saldo</th>
                      <th className="py-2.5 px-3 text-center">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 print:divide-slate-200">
                    {report.days.map((day) => (
                      <tr
                        key={day.date}
                        onDoubleClick={() => setSelectedDetailDay(day)}
                        title="Duplo clique para abrir detalhes do dia"
                        className="hover:bg-slate-800/70 cursor-pointer transition-colors print:hover:bg-transparent"
                      >
                        <td className="py-2.5 px-3 font-mono text-white font-medium whitespace-nowrap print:text-slate-900">
                          {day.date}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap print:text-slate-700">
                          {formatWeekdayPt(day.weekday)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {day.status === 'RECORDED' && (
                            <span className="text-emerald-400 font-semibold print:text-emerald-800">Registrado</span>
                          )}
                          {day.status === 'EXCUSED' && (
                            <span className="text-indigo-300 font-semibold print:text-indigo-800">Abonado</span>
                          )}
                          {day.status === 'IN_PROGRESS' && (
                            <span className="text-emerald-400 font-medium print:text-emerald-800">Em andamento</span>
                          )}
                          {day.status === 'INCOMPLETE' && (
                            <span className="text-amber-400 font-semibold print:text-amber-800">Incompleto</span>
                          )}
                          {day.status === 'NO_RECORDS' && (
                            <span className="text-slate-400 print:text-slate-600">Sem registro</span>
                          )}
                          {day.status === 'REST_DAY' && (
                            <span className="text-slate-500 print:text-slate-500">Folga</span>
                          )}
                          {day.status === 'FUTURE' && (
                            <span className="text-slate-600 print:text-slate-400">Futuro</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 truncate max-w-[150px] print:text-slate-800">
                          {day.occurrence ? day.occurrence.title : '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right whitespace-nowrap print:text-slate-800">
                          {formatMinutes(day.expectedMinutes)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white text-right whitespace-nowrap print:text-slate-900">
                          {formatMinutes(day.workedMinutes)}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-mono font-bold text-right whitespace-nowrap ${
                            day.balanceMinutes !== null
                              ? day.balanceMinutes > 0
                                ? 'text-emerald-400 print:text-emerald-800'
                                : day.balanceMinutes === 0
                                ? 'text-slate-300 print:text-slate-800'
                                : 'text-amber-400 print:text-amber-800'
                              : 'text-slate-500 print:text-slate-400'
                          }`}
                        >
                          {day.balanceMinutes !== null ? formatBalance(day.balanceMinutes) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[10px] text-slate-400 print:text-slate-600">
                          {day.entrySource || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Day Detail Modal on double click */}
        {selectedDetailDay && (
          <ReportDayDetailModal
            day={selectedDetailDay}
            onClose={() => setSelectedDetailDay(null)}
          />
        )}
      </div>
    </main>
  );
}
