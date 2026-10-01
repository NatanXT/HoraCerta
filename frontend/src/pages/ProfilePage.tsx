import React, { useState, useEffect } from 'react';
import { User, Calendar, Clock, Coffee, Utensils, Save, Check, AlertCircle, Info } from 'lucide-react';
import { profileService, ProfileScheduleDay } from '../services/profile.service';
import { AppTimePicker } from '../components/ui/AppTimePicker';
import { useAuth } from '../contexts/AuthContext';

const WEEKDAYS = [
  { key: 'MONDAY', label: 'Segunda-feira' },
  { key: 'TUESDAY', label: 'Terça-feira' },
  { key: 'WEDNESDAY', label: 'Quarta-feira' },
  { key: 'THURSDAY', label: 'Quinta-feira' },
  { key: 'FRIDAY', label: 'Sexta-feira' },
  { key: 'SATURDAY', label: 'Sábado' },
  { key: 'SUNDAY', label: 'Domingo' },
];

function minutesToHhMm(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes < 0) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hhMmToMinutes(hhmm: string): number {
  if (!hhmm || !hhmm.includes(':')) return 0;
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
}

interface DayFormState {
  weekday: string;
  isWorkDay: boolean;
  startHhMm: string;
  endHhMm: string;
  snackBreakHhMm: string;
  lunchBreakHhMm: string;
}

export const ProfilePage: React.FC = () => {
  const { refreshMe } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [days, setDays] = useState<DayFormState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUnconfiguredSchedule, setHasUnconfiguredSchedule] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await profileService.getProfile();
      setName(data.user.name);
      setEmail(data.user.email);
      setTimezone(data.timezone || 'America/Sao_Paulo');

      let unconfigured = false;
      const daysMap = new Map<string, ProfileScheduleDay>();
      data.workSchedule.days.forEach((d) => daysMap.set(d.weekday, d));

      const initialDays: DayFormState[] = WEEKDAYS.map((w) => {
        const existing = daysMap.get(w.key);
        const isWorkDay = (existing?.expectedMinutes ?? 0) > 0;

        if (isWorkDay && existing?.plannedStartMinutes === null) {
          unconfigured = true;
        }

        return {
          weekday: w.key,
          isWorkDay,
          startHhMm: minutesToHhMm(existing?.plannedStartMinutes ?? (isWorkDay ? 480 : null)), // 08:00
          endHhMm: minutesToHhMm(existing?.plannedEndMinutes ?? (isWorkDay ? 1035 : null)), // 17:15
          snackBreakHhMm: minutesToHhMm(existing?.snackBreakMinutes ?? (isWorkDay ? 15 : 0)),
          lunchBreakHhMm: minutesToHhMm(existing?.lunchBreakMinutes ?? (isWorkDay ? 60 : 0)),
        };
      });

      setHasUnconfiguredSchedule(unconfigured);
      setDays(initialDays);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Erro ao carregar dados do perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleDayChange = (weekday: string, field: keyof DayFormState, value: any) => {
    setDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, [field]: value } : d))
    );
  };

  const calculateNetMinutes = (day: DayFormState): number => {
    if (!day.isWorkDay) return 0;
    const start = hhMmToMinutes(day.startHhMm);
    const end = hhMmToMinutes(day.endHhMm);
    const snack = hhMmToMinutes(day.snackBreakHhMm);
    const lunch = hhMmToMinutes(day.lunchBreakHhMm);

    const span = end - start;
    const net = span - snack - lunch;
    return Math.max(0, net);
  };

  const calculateWeeklyTotal = (): number => {
    return days.reduce((sum, d) => sum + calculateNetMinutes(d), 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSuccessMessage(null);
    setErrorMessage(null);

    // Validate work days
    for (const d of days) {
      if (d.isWorkDay) {
        const start = hhMmToMinutes(d.startHhMm);
        const end = hhMmToMinutes(d.endHhMm);
        const snack = hhMmToMinutes(d.snackBreakHhMm);
        const lunch = hhMmToMinutes(d.lunchBreakHhMm);

        if (start >= end) {
          const weekdayLabel = WEEKDAYS.find((w) => w.key === d.weekday)?.label;
          setErrorMessage(`No dia ${weekdayLabel}, o horário de início deve ser anterior ao de fim.`);
          return;
        }

        if (snack + lunch >= end - start) {
          const weekdayLabel = WEEKDAYS.find((w) => w.key === d.weekday)?.label;
          setErrorMessage(`No dia ${weekdayLabel}, as pausas superam a duração total do expediente.`);
          return;
        }
      }
    }

    setSaving(true);

    try {
      // 1. Update Personal Data
      await profileService.updatePersonalData({ name });
      await refreshMe();

      // 2. Update Work Schedule
      const schedulePayload = days.map((d) => {
        if (!d.isWorkDay) {
          return {
            weekday: d.weekday,
            isWorkDay: false,
            expectedMinutes: 0,
            plannedStartMinutes: null,
            plannedEndMinutes: null,
            snackBreakMinutes: 0,
            lunchBreakMinutes: 0,
          };
        }

        const start = hhMmToMinutes(d.startHhMm);
        const end = hhMmToMinutes(d.endHhMm);
        const snack = hhMmToMinutes(d.snackBreakHhMm);
        const lunch = hhMmToMinutes(d.lunchBreakHhMm);
        const expected = Math.max(0, end - start - snack - lunch);

        return {
          weekday: d.weekday,
          isWorkDay: true,
          expectedMinutes: expected,
          plannedStartMinutes: start,
          plannedEndMinutes: end,
          snackBreakMinutes: snack,
          lunchBreakMinutes: lunch,
        };
      });

      await profileService.updateWorkSchedule(schedulePayload);

      setSuccessMessage('Jornada atualizada com sucesso.');
      setHasUnconfiguredSchedule(false);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Erro ao salvar perfil.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <User className="w-6 h-6 text-indigo-400" />
          Perfil e Jornada de Trabalho
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure seus dados pessoais e o planejamento semanal das suas jornadas e pausas.
        </p>
      </div>

      {hasUnconfiguredSchedule && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-sm flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Horário planejado ainda não configurado</p>
            <p className="text-xs text-amber-400/90 mt-0.5">
              Sua conta possui registros com carga horária mas sem horário de início/fim planejado. Preencha os campos abaixo e salve para atualizar.
            </p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-sm flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Personal Info */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
            <User className="w-4 h-4 text-indigo-400" />
            Dados Pessoais
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nome completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                E-mail (somente leitura)
              </label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-4 py-2.5 bg-slate-950/40 border border-slate-800/60 rounded-xl text-slate-400 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-400 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Fuso horário: <span className="text-slate-300 font-medium">{timezone}</span>
          </div>
        </div>

        {/* Card 2: Planned Weekly Schedule */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                Jornada de Trabalho Semanal
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure os horários de início/fim e as pausas estimadas para cada dia.
              </p>
            </div>

            <div className="bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>Semana planejada:</span>
              <span className="text-white text-sm font-bold">
                {minutesToHhMm(calculateWeeklyTotal())}h
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {days.map((day) => {
              const weekdayObj = WEEKDAYS.find((w) => w.key === day.weekday)!;
              const netMins = calculateNetMinutes(day);

              return (
                <div
                  key={day.weekday}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all hover:border-slate-700/80"
                >
                  {/* Left: Day & Toggle */}
                  <div className="flex items-center justify-between lg:justify-start lg:w-48 gap-3">
                    <span className="text-sm font-medium text-slate-200">
                      {weekdayObj.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDayChange(day.weekday, 'isWorkDay', !day.isWorkDay)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        day.isWorkDay
                          ? 'bg-indigo-600/30 border border-indigo-500/50 text-indigo-300'
                          : 'bg-slate-800/60 border border-slate-700/60 text-slate-400'
                      }`}
                    >
                      {day.isWorkDay ? 'Trabalha' : 'Folga'}
                    </button>
                  </div>

                  {/* Center: Work Hours & Breaks */}
                  {day.isWorkDay ? (
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="block text-[11px] text-slate-400 font-medium mb-1">
                          Início
                        </span>
                        <AppTimePicker
                          value={day.startHhMm}
                          onChange={(val) => handleDayChange(day.weekday, 'startHhMm', val)}
                        />
                      </div>

                      <div>
                        <span className="block text-[11px] text-slate-400 font-medium mb-1">
                          Fim
                        </span>
                        <AppTimePicker
                          value={day.endHhMm}
                          onChange={(val) => handleDayChange(day.weekday, 'endHhMm', val)}
                        />
                      </div>

                      <div>
                        <span className="block text-[11px] text-slate-400 font-medium mb-1 flex items-center gap-1">
                          <Coffee className="w-3 h-3 text-amber-400" />
                          Lanche
                        </span>
                        <AppTimePicker
                          value={day.snackBreakHhMm}
                          onChange={(val) => handleDayChange(day.weekday, 'snackBreakHhMm', val)}
                        />
                      </div>

                      <div>
                        <span className="block text-[11px] text-slate-400 font-medium mb-1 flex items-center gap-1">
                          <Utensils className="w-3 h-3 text-emerald-400" />
                          Almoço
                        </span>
                        <AppTimePicker
                          value={day.lunchBreakHhMm}
                          onChange={(val) => handleDayChange(day.weekday, 'lunchBreakHhMm', val)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 text-xs text-slate-500 italic">
                      Dia de descanso (sem expediente planejado)
                    </div>
                  )}

                  {/* Right: Net workload badge */}
                  <div className="flex items-center justify-end lg:w-28">
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                        Jornada líquida
                      </span>
                      <span className="text-sm font-bold text-white">
                        {minutesToHhMm(netMins)}h
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};
