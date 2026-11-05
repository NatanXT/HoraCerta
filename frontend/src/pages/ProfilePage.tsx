import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Calendar, Clock, Coffee, Utensils, Save, Check, AlertCircle, Info, Palette } from 'lucide-react';
import { profileService, ProfileScheduleDay } from '../services/profile.service';
import { AppTimePicker } from '../components/ui/AppTimePicker';
import { useAuth } from '../contexts/AuthContext';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';

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
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state directly derived from query params without flicker
  const currentAba = searchParams.get('aba');
  const activeTab: 'profile' | 'appearance' = currentAba === 'aparencia' ? 'appearance' : 'profile';

  const handleTabChange = (tab: 'profile' | 'appearance') => {
    if (tab === 'appearance') {
      setSearchParams({ aba: 'aparencia' });
    } else {
      setSearchParams({});
    }
  };

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
          startHhMm: minutesToHhMm(existing?.plannedStartMinutes ?? (isWorkDay ? 480 : null)),
          endHhMm: minutesToHhMm(existing?.plannedEndMinutes ?? (isWorkDay ? 1035 : null)),
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

    if (end <= start) return 0;
    const gross = end - start;
    const net = gross - snack - lunch;
    return Math.max(0, net);
  };

  const calculateWeeklyTotal = (): number => {
    return days.reduce((acc, curr) => acc + calculateNetMinutes(curr), 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validation
    if (!name.trim()) {
      setErrorMessage('O nome não pode ficar em branco.');
      return;
    }

    for (const d of days) {
      if (d.isWorkDay) {
        const start = hhMmToMinutes(d.startHhMm);
        const end = hhMmToMinutes(d.endHhMm);
        const snack = hhMmToMinutes(d.snackBreakHhMm);
        const lunch = hhMmToMinutes(d.lunchBreakHhMm);

        const weekdayLabel = WEEKDAYS.find((w) => w.key === d.weekday)?.label || d.weekday;

        if (end <= start) {
          setErrorMessage(`Em ${weekdayLabel}, o horário de término deve ser após o início.`);
          return;
        }

        const gross = end - start;
        if (snack + lunch >= gross) {
          setErrorMessage(`Em ${weekdayLabel}, o total das pausas deve ser menor que o período total de trabalho.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      // 1. Update Profile (Name)
      await profileService.updatePersonalData({ name: name.trim() });
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

      setSuccessMessage('Configurações atualizadas com sucesso.');
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
        <div className="w-8 h-8 border-2 border-[var(--hc-accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--hc-text)] flex items-center gap-2.5">
          <User className="w-6 h-6 text-[var(--hc-accent)]" />
          Configurações do Usuário
        </h1>
        <p className="text-sm text-[var(--hc-text-secondary)] mt-1">
          Gerencie seus dados cadastrais, horários de trabalho planejados e preferências visuais.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[var(--hc-border)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange('profile')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] shadow-sm'
              : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)]'
          }`}
        >
          <User className="w-4 h-4" />
          Meu Perfil
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('appearance')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'appearance'
              ? 'bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] shadow-sm'
              : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)]'
          }`}
        >
          <Palette className="w-4 h-4" />
          Aparência
        </button>
      </div>

      {/* Tab: Appearance */}
      {activeTab === 'appearance' && <AppearanceSettings />}

      {/* Tab: Profile & Schedule */}
      {activeTab === 'profile' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {hasUnconfiguredSchedule && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-sm flex items-start gap-3">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Horário planejado ainda não configurado</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Sua conta possui registros com carga horária mas sem horário de início/fim planejado. Preencha os campos abaixo e salve para atualizar.
                </p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm flex items-center gap-3">
              <Check className="w-5 h-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Card 1: Personal Info */}
            <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-base font-semibold text-[var(--hc-text)] flex items-center gap-2 pb-3 border-b border-[var(--hc-border)]">
                <User className="w-4 h-4 text-[var(--hc-accent)]" />
                Dados Pessoais
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-2">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] rounded-xl text-[var(--hc-text)] placeholder-[var(--hc-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-focus-ring)] focus:border-[var(--hc-accent)] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-4 py-2.5 bg-[var(--hc-surface-muted)] border border-[var(--hc-border)] rounded-xl text-[var(--hc-text-muted)] text-sm cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-2">
                    Fuso horário
                  </label>
                  <div className="w-full px-4 py-2.5 bg-[var(--hc-surface-muted)] border border-[var(--hc-border)] rounded-xl text-[var(--hc-text)] text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--hc-accent)] shrink-0" />
                    <span className="font-medium truncate">{timezone}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Planned Weekly Schedule */}
            <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--hc-border)]">
                <div>
                  <h2 className="text-base font-semibold text-[var(--hc-text)] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--hc-accent)]" />
                    Jornada de Trabalho Semanal
                  </h2>
                  <p className="text-xs text-[var(--hc-text-secondary)] mt-1">
                    Configure os horários de início/fim e as pausas estimadas para cada dia da semana.
                  </p>
                </div>

                <div className="bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] text-[var(--hc-accent-soft-foreground)] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
                  <span>Carga semanal planejada:</span>
                  <span className="text-sm font-bold">
                    {minutesToHhMm(calculateWeeklyTotal())}h
                  </span>
                </div>
              </div>

              <div className="space-y-3.5">
                {days.map((day) => {
                  const weekdayObj = WEEKDAYS.find((w) => w.key === day.weekday)!;
                  const netMins = calculateNetMinutes(day);

                  return (
                    <div
                      key={day.weekday}
                      className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-all hover:border-[var(--hc-accent-border)] shadow-xs"
                    >
                      {/* Left: Day & Toggle */}
                      <div className="flex items-center justify-between xl:justify-start xl:w-56 gap-3 shrink-0">
                        <span className="text-sm font-semibold text-[var(--hc-text)]">
                          {weekdayObj.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDayChange(day.weekday, 'isWorkDay', !day.isWorkDay)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            day.isWorkDay
                              ? 'bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] text-[var(--hc-accent-soft-foreground)]'
                              : 'bg-[var(--hc-surface-muted)] border border-[var(--hc-border)] text-[var(--hc-text-muted)]'
                          }`}
                        >
                          {day.isWorkDay ? 'Expediente' : 'Folga'}
                        </button>
                      </div>

                      {/* Center: Work Hours & Breaks */}
                      {day.isWorkDay ? (
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                          <div>
                            <span className="block text-[11px] text-[var(--hc-text-secondary)] font-medium mb-1">
                              Início
                            </span>
                            <AppTimePicker
                              value={day.startHhMm}
                              onChange={(val) => handleDayChange(day.weekday, 'startHhMm', val)}
                            />
                          </div>

                          <div>
                            <span className="block text-[11px] text-[var(--hc-text-secondary)] font-medium mb-1">
                              Fim
                            </span>
                            <AppTimePicker
                              value={day.endHhMm}
                              onChange={(val) => handleDayChange(day.weekday, 'endHhMm', val)}
                            />
                          </div>

                          <div>
                            <span className="block text-[11px] text-[var(--hc-text-secondary)] font-medium mb-1 flex items-center gap-1">
                              <Coffee className="w-3 h-3 text-amber-500" />
                              Lanche
                            </span>
                            <AppTimePicker
                              value={day.snackBreakHhMm}
                              onChange={(val) => handleDayChange(day.weekday, 'snackBreakHhMm', val)}
                            />
                          </div>

                          <div>
                            <span className="block text-[11px] text-[var(--hc-text-secondary)] font-medium mb-1 flex items-center gap-1">
                              <Utensils className="w-3 h-3 text-emerald-500" />
                              Almoço
                            </span>
                            <AppTimePicker
                              value={day.lunchBreakHhMm}
                              onChange={(val) => handleDayChange(day.weekday, 'lunchBreakHhMm', val)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 text-xs text-[var(--hc-text-muted)] italic py-2">
                          Dia de descanso (sem expediente planejado)
                        </div>
                      )}

                      {/* Right: Net workload badge */}
                      <div className="flex items-center justify-end xl:w-36 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-[var(--hc-border)]">
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--hc-text-muted)] block">
                            Jornada líquida
                          </span>
                          <span className="text-sm font-bold text-[var(--hc-text)]">
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
                className="px-6 py-3 bg-[var(--hc-accent)] hover:opacity-90 disabled:opacity-50 text-[var(--hc-accent-foreground)] font-semibold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer text-sm"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
