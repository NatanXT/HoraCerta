import { useState, useEffect } from 'react';
import {
  CalendarOff,
  Plus,
  PencilLine,
  Trash2,
  AlertTriangle,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useCalendarOccurrences } from '../hooks/useCalendarOccurrences';
import {
  CalendarOccurrence,
  CalendarOccurrenceType,
  CALENDAR_OCCURRENCE_TYPE_LABELS,
} from '../types/calendar-occurrence';

function formatMonthTitle(monthStr: string): string {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthNumStr, 10) - 1;
  const dateObj = new Date(Date.UTC(year, monthIndex, 1));
  const monthName = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
  }).format(dateObj);
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalizedMonth} de ${year}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getMonthRange(monthStr: string): { from: string; to: string } {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);
  const daysCount = getDaysInMonth(year, month);
  const from = `${yearStr}-${monthNumStr.padStart(2, '0')}-01`;
  const to = `${yearStr}-${monthNumStr.padStart(2, '0')}-${String(daysCount).padStart(2, '0')}`;
  return { from, to };
}

export function AbsencesPage() {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const {
    occurrences,
    loading,
    submitting,
    error,
    successMessage,
    setError,
    setSuccessMessage,
    fetchOccurrences,
    createOccurrence,
    updateOccurrence,
    deleteOccurrence,
  } = useCalendarOccurrences(selectedMonth);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOccurrence, setEditingOccurrence] = useState<CalendarOccurrence | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [formType, setFormType] = useState<CalendarOccurrenceType>('HOLIDAY');
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = getMonthRange(selectedMonth);
    fetchOccurrences(from, to);
  }, [selectedMonth, fetchOccurrences]);

  const handlePreviousMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const openCreateModal = () => {
    setEditingOccurrence(null);
    setFormType('HOLIDAY');
    setFormTitle('');
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setFormStartDate(todayStr);
    setFormEndDate(todayStr);
    setFormNote('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (occ: CalendarOccurrence) => {
    setEditingOccurrence(occ);
    setFormType(occ.type);
    setFormTitle(occ.title);
    setFormStartDate(occ.startDate);
    setFormEndDate(occ.endDate);
    setFormNote(occ.note || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formTitle.trim().length < 2) {
      setFormError('O título deve ter no mínimo 2 caracteres.');
      return;
    }
    if (!formStartDate || !formEndDate) {
      setFormError('As datas inicial e final são obrigatórias.');
      return;
    }
    if (formStartDate > formEndDate) {
      setFormError('A data inicial não pode ser maior que a data final.');
      return;
    }

    const payload = {
      type: formType,
      title: formTitle.trim(),
      startDate: formStartDate,
      endDate: formEndDate,
      note: formNote.trim() || undefined,
    };

    let ok = false;
    if (editingOccurrence) {
      ok = await updateOccurrence(editingOccurrence.id, payload);
    } else {
      ok = await createOccurrence(payload);
    }

    if (ok) {
      setIsModalOpen(false);
      const { from, to } = getMonthRange(selectedMonth);
      fetchOccurrences(from, to);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const ok = await deleteOccurrence(deletingId);
    setDeletingId(null);
    if (ok) {
      const { from, to } = getMonthRange(selectedMonth);
      fetchOccurrences(from, to);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800/80 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarOff className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">Ausências e feriados</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Gerencie períodos que alteram a jornada esperada, como feriados, férias e afastamentos.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova ocorrência
          </button>
        </div>

        {/* Global Feedback Messages */}
        {error && (
          <div className="flex items-center justify-between p-3.5 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center justify-between p-3.5 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Month Navigation */}
        <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <button
            onClick={handlePreviousMonth}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-200">
            {formatMonthTitle(selectedMonth)}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Occurrences List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/30 border border-slate-800 rounded-xl">
              Carregando ocorrências...
            </div>
          ) : occurrences.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/30 border border-slate-800 rounded-xl space-y-1">
              <p className="font-medium text-slate-300">Nenhuma ocorrência registrada no mês.</p>
              <p className="text-slate-500">
                Dias sem registro continuarão seguindo a jornada padrão.
              </p>
            </div>
          ) : (
            occurrences.map((occ) => (
              <div
                key={occ.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl gap-3 hover:border-slate-700/80 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 rounded-md">
                      {CALENDAR_OCCURRENCE_TYPE_LABELS[occ.type] || occ.type}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{occ.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Período:{' '}
                    <span className="text-slate-300 font-mono">
                      {occ.startDate === occ.endDate
                        ? occ.startDate
                        : `${occ.startDate} até ${occ.endDate}`}
                    </span>
                  </p>
                  {occ.note && (
                    <p className="text-xs text-slate-400 italic bg-slate-950/40 px-2.5 py-1 rounded border border-slate-800/40">
                      "{occ.note}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => openEditModal(occ)}
                    className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <PencilLine className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingId(occ.id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">
                {editingOccurrence ? 'Editar ocorrência' : 'Nova ocorrência'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tipo</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as CalendarOccurrenceType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="HOLIDAY">Feriado</option>
                  <option value="VACATION">Férias</option>
                  <option value="MEDICAL_LEAVE">Atestado / afastamento médico</option>
                  <option value="JUSTIFIED_ABSENCE">Ausência justificada</option>
                  <option value="EXCEPTIONAL_DAY_OFF">Folga excepcional</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Título</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Feriado municipal, Férias regulamentares"
                  maxLength={100}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Data final
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Observação <span className="text-slate-500 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Detalhes adicionais..."
                  maxLength={500}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-semibold text-white">Confirmar remoção</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Remover esta ocorrência pode alterar o Histórico e o Banco de Horas dos dias envolvidos.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
              >
                {submitting ? 'Removendo...' : 'Remover ocorrência'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
