// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { AbsencesPage } from './AbsencesPage';
import { calendarOccurrenceService } from '../services/calendar-occurrence.service';
import { inFlightTracker } from '../features/pwa/utils/inFlightTracker';
import { CalendarOccurrence } from '../types/calendar-occurrence';

vi.mock('../services/calendar-occurrence.service', () => ({
  calendarOccurrenceService: {
    getOccurrences: vi.fn(),
    createOccurrence: vi.fn(),
    updateOccurrence: vi.fn(),
    deleteOccurrence: vi.fn(),
  },
}));

describe('AbsencesPage — Form Dirty Snapshot Integration Suite (ETAPA 12.3.3 / 12.4.1)', () => {
  const mockOccurrence: CalendarOccurrence = {
    id: 'occ-100',
    type: 'VACATION',
    title: 'Férias de Julho',
    startDate: '2026-07-01',
    endDate: '2026-07-15',
    note: 'Descanso anual',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (calendarOccurrenceService.getOccurrences as any).mockResolvedValue([mockOccurrence]);
  });

  afterEach(() => {
    cleanup();
  });

  it('valida ciclo completo de dirty state: abertura sem alteração, mudanças de tipo, data, título/observações, reversão e fechamento', async () => {
    render(<AbsencesPage />);

    // Aguarda carregar as ocorrências na listagem
    await waitFor(() => {
      expect(screen.getByText('Férias de Julho')).toBeDefined();
    });

    // 1. Abrir edição sem mudanças: dirty deve ser false
    const editButton = screen.getByLabelText('Editar Férias de Julho');
    fireEvent.click(editButton);

    expect(screen.getByText('Editar ocorrência')).toBeDefined();
    expect(inFlightTracker.hasDirtyForms()).toBe(false);

    // Identifica campos do formulário
    const titleInput = screen.getByPlaceholderText(/Ex: Feriado Tiradentes/);
    const noteTextarea = screen.getByPlaceholderText(/Anotações internas/);

    // 2. Alterar só tipo: clica no trigger do AppSelect (#occ-type) e escolhe 'Atestado / afastamento médico' -> dirty=true
    const selectTrigger = document.getElementById('occ-type');
    expect(selectTrigger).not.toBeNull();
    fireEvent.click(selectTrigger!);

    const medicalOption = screen.getByText('Atestado / afastamento médico');
    fireEvent.click(medicalOption);
    expect(inFlightTracker.hasDirtyForms()).toBe(true);

    // Reverte tipo para 'Férias' -> dirty=false
    fireEvent.click(selectTrigger!);
    const selectOptions = screen.getAllByText('Férias');
    fireEvent.click(selectOptions[selectOptions.length - 1]);
    expect(inFlightTracker.hasDirtyForms()).toBe(false);

    // 3. Alterar só data (limpar data inicial via botão do datepicker) -> dirty=true
    const clearDateButtons = screen.getAllByLabelText('Limpar data');
    expect(clearDateButtons.length).toBeGreaterThan(0);
    fireEvent.click(clearDateButtons[0]);
    expect(inFlightTracker.hasDirtyForms()).toBe(true);

    // Reverter data: clica no trigger de data inicial e seleciona o dia 1 (restaurando 2026-07-01) -> dirty=false
    const datePickers = screen.getAllByText('DD/MM/YYYY');
    expect(datePickers.length).toBeGreaterThan(0);
    fireEvent.click(datePickers[0]);

    // Seleciona o dia 1 no calendário aberto
    const dayOneButton = screen.getAllByRole('button', { name: '1' });
    fireEvent.click(dayOneButton[0]);
    expect(inFlightTracker.hasDirtyForms()).toBe(false);

    // 4. Alterar título: dirty=true
    fireEvent.change(titleInput, { target: { value: 'Férias de Julho Alteradas' } });
    expect(inFlightTracker.hasDirtyForms()).toBe(true);

    // Reverter título: dirty=false
    fireEvent.change(titleInput, { target: { value: 'Férias de Julho' } });
    expect(inFlightTracker.hasDirtyForms()).toBe(false);

    // 5. Alterar observações: dirty=true
    fireEvent.change(noteTextarea, { target: { value: 'Nova anotação de descanso' } });
    expect(inFlightTracker.hasDirtyForms()).toBe(true);

    // Reverter observações: dirty=false
    fireEvent.change(noteTextarea, { target: { value: 'Descanso anual' } });
    expect(inFlightTracker.hasDirtyForms()).toBe(false);

    // 6. Alterar título novamente e fechar modal -> dirty=false
    fireEvent.change(titleInput, { target: { value: 'Férias Canceladas' } });
    expect(inFlightTracker.hasDirtyForms()).toBe(true);

    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);

    expect(screen.queryByText('Editar ocorrência')).toBeNull();
    expect(inFlightTracker.hasDirtyForms()).toBe(false);
  });
});
