import React from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import { ReportDay } from '../../types/report';

export interface ReportDayDetailModalProps {
  day: ReportDay | null;
  onClose: () => void;
}

const statusLabels: Record<string, { label: string; bg: string; text: string; border: string }> = {
  RECORDED: {
    label: 'Registrado',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  IN_PROGRESS: {
    label: 'Em andamento',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  INCOMPLETE: {
    label: 'Incompleto',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
  },
  NO_RECORDS: {
    label: 'Sem registro',
    bg: 'bg-slate-800',
    text: 'text-slate-400',
    border: 'border-slate-700',
  },
  REST_DAY: {
    label: 'Folga',
    bg: 'bg-slate-800/80',
    text: 'text-slate-400',
    border: 'border-slate-700/60',
  },
  FUTURE: {
    label: 'Futuro',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
  },
  EXCUSED: {
    label: 'Abonado',
    bg: 'bg-purple-500/10',
    text: 'text-purple-300',
    border: 'border-purple-500/20',
  },
};

const formatMinutes = (minutes: number): string => {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const formatBalance = (minutes: number | null): string => {
  if (minutes === null) return '-';
  const sign = minutes > 0 ? '+' : minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const ReportDayDetailModal: React.FC<ReportDayDetailModalProps> = ({ day, onClose }) => {
  if (!day) return null;

  const statusStyle = statusLabels[day.status] || statusLabels.NO_RECORDS;

  const formatDateDisplay = (isoDate: string): string => {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {formatDateDisplay(day.date)}
                <span className="text-xs font-normal text-slate-400 capitalize">({day.weekday})</span>
              </h2>
              <span
                className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-semibold rounded-md border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
              >
                {statusStyle.label}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {/* Occurrence Banner if present */}
          {day.occurrence && (
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-purple-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Ocorrência: {day.occurrence.title}</span>
              </div>
              <p className="text-xs text-purple-300/80">
                Tipo: <span className="font-mono font-semibold">{day.occurrence.type}</span> ({day.occurrence.startDate} até {day.occurrence.endDate})
              </p>
              {day.occurrence.note && (
                <p className="text-xs text-purple-300/70 italic mt-1">"{day.occurrence.note}"</p>
              )}
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 text-center transition-all duration-200 hover:bg-slate-900/80 hover:border-slate-700/80 hover:shadow-sm hover:-translate-y-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase font-mono block">Jornada Base</span>
              <span className="text-base font-bold font-mono text-slate-200 mt-0.5 block">
                {formatMinutes(day.baseExpectedMinutes)}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 text-center transition-all duration-200 hover:bg-slate-900/80 hover:border-slate-700/80 hover:shadow-sm hover:-translate-y-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase font-mono block">Previsto Efetivo</span>
              <span className="text-base font-bold font-mono text-slate-200 mt-0.5 block">
                {formatMinutes(day.expectedMinutes)}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 text-center transition-all duration-200 hover:bg-slate-900/80 hover:border-indigo-500/30 hover:shadow-sm hover:-translate-y-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase font-mono block">Trabalhado</span>
              <span className="text-base font-bold font-mono text-indigo-400 mt-0.5 block">
                {formatMinutes(day.totalWorkedMinutes)}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 text-center transition-all duration-200 hover:bg-slate-900/80 hover:border-slate-700/80 hover:shadow-sm hover:-translate-y-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase font-mono block">Saldo</span>
              <span
                className={`text-base font-bold font-mono mt-0.5 block ${
                  (day.balanceMinutes ?? 0) > 0
                    ? 'text-emerald-400'
                    : (day.balanceMinutes ?? 0) < 0
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {formatBalance(day.balanceMinutes)}
              </span>
            </div>
          </div>

          {/* Entry Source & Bank accounting info */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/40 gap-2 transition-colors duration-200 hover:border-slate-700/60">
            <div>
              Origem dos registros:{' '}
              <span className="font-semibold text-slate-200 font-mono">
                {day.entrySource === 'CLOCK'
                  ? 'Relógio de ponto'
                  : day.entrySource === 'MANUAL'
                  ? 'Ajuste manual'
                  : day.entrySource === 'MIXED'
                  ? 'Misto (Relógio + Manual)'
                  : 'Sem registros'}
              </span>
            </div>
            <div>
              Contabilizado no banco:{' '}
              <span className={`font-semibold ${day.isBankAccounted ? 'text-emerald-400' : 'text-slate-400'}`}>
                {day.isBankAccounted ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>

          {/* Registros de Ponto List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Registros do Dia ({day.entries?.length || 0})</span>
            </h3>

            {(!day.entries || day.entries.length === 0) ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/40 italic">
                Nenhum registro de ponto encontrado para este dia.
              </div>
            ) : (
              <div className="space-y-1.5">
                {day.entries.map((entry, idx) => {
                  const timeFormatted = entry.timestamp.includes('T')
                    ? new Date(entry.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : entry.timestamp;

                  return (
                    <div
                      key={entry.id || idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs font-mono transition-all duration-200 hover:bg-slate-900/80 hover:border-slate-700/80 hover:shadow-sm hover:-translate-y-0.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 font-bold rounded-md text-[11px] ${
                            entry.type === 'CLOCK_IN'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {entry.type === 'CLOCK_IN' ? 'Entrada' : 'Saída'}
                        </span>
                        <span className="text-slate-200 font-semibold text-sm">{timeFormatted}</span>
                      </div>
                      <span className="text-slate-500 text-[11px]">
                        {entry.source === 'MANUAL' ? 'Ajuste Manual' : 'Relógio'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
