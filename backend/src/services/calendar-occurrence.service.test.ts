import { describe, it, expect, beforeEach } from 'vitest';
import { calendarOccurrenceService } from './calendar-occurrence.service';
import { prisma } from '../lib/prisma';
import { CalendarOccurrenceType } from '@prisma/client';
import { AppError } from '../errors/app-error';

describe('CalendarOccurrenceService', () => {
  beforeEach(async () => {
    // Clean up test occurrences
    await prisma.calendarOccurrence.deleteMany({});
  });

  it('should create a calendar occurrence successfully', async () => {
    const created = await calendarOccurrenceService.create({
      type: CalendarOccurrenceType.HOLIDAY,
      title: 'Feriado de Teste',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
      note: 'Aniversário da cidade',
    });

    expect(created.id).toBeDefined();
    expect(created.type).toBe('HOLIDAY');
    expect(created.title).toBe('Feriado de Teste');
    expect(created.startDate).toBe('2026-10-24');
    expect(created.endDate).toBe('2026-10-24');
    expect(created.note).toBe('Aniversário da cidade');
  });

  it('should list active occurrences within a date range', async () => {
    await calendarOccurrenceService.create({
      type: CalendarOccurrenceType.VACATION,
      title: 'Férias de Outubro',
      startDate: '2026-10-10',
      endDate: '2026-10-20',
    });

    const list = await calendarOccurrenceService.list('2026-10-01', '2026-10-31');
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Férias de Outubro');
  });

  it('should soft delete an occurrence and hide it from list', async () => {
    const created = await calendarOccurrenceService.create({
      type: CalendarOccurrenceType.HOLIDAY,
      title: 'Feriado a excluir',
      startDate: '2026-11-15',
      endDate: '2026-11-15',
    });

    await calendarOccurrenceService.softDelete(created.id);

    const list = await calendarOccurrenceService.list('2026-11-01', '2026-11-30');
    expect(list.length).toBe(0);

    const raw = await prisma.calendarOccurrence.findUnique({
      where: { id: created.id },
    });
    expect(raw).not.toBeNull();
    expect(raw?.deletedAt).not.toBeNull();
  });

  it('should update an existing occurrence', async () => {
    const created = await calendarOccurrenceService.create({
      type: CalendarOccurrenceType.MEDICAL_LEAVE,
      title: 'Atestado',
      startDate: '2026-12-01',
      endDate: '2026-12-02',
    });

    const updated = await calendarOccurrenceService.update(created.id, {
      type: CalendarOccurrenceType.MEDICAL_LEAVE,
      title: 'Atestado Prorrogado',
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      note: 'Instrução médica',
    });

    expect(updated.title).toBe('Atestado Prorrogado');
    expect(updated.endDate).toBe('2026-12-03');
  });

  describe('Conflict Boundaries Detection (HTTP 409)', () => {
    beforeEach(async () => {
      // Existing occurrence from 2026-10-10 to 2026-10-20
      await calendarOccurrenceService.create({
        type: CalendarOccurrenceType.VACATION,
        title: 'Férias Ativas',
        startDate: '2026-10-10',
        endDate: '2026-10-20',
      });
    });

    it('should reject overlapping start boundary (09/10 to 10/10)', async () => {
      await expect(
        calendarOccurrenceService.create({
          type: CalendarOccurrenceType.HOLIDAY,
          title: 'Feriado',
          startDate: '2026-10-09',
          endDate: '2026-10-10',
        })
      ).rejects.toThrow(AppError);
    });

    it('should reject overlapping end boundary (20/10 to 21/10)', async () => {
      await expect(
        calendarOccurrenceService.create({
          type: CalendarOccurrenceType.HOLIDAY,
          title: 'Feriado',
          startDate: '2026-10-20',
          endDate: '2026-10-21',
        })
      ).rejects.toThrow(AppError);
    });

    it('should reject internal overlap (15/10 to 16/10)', async () => {
      await expect(
        calendarOccurrenceService.create({
          type: CalendarOccurrenceType.JUSTIFIED_ABSENCE,
          title: 'Ausência',
          startDate: '2026-10-15',
          endDate: '2026-10-16',
        })
      ).rejects.toThrow(AppError);
    });

    it('should reject identical period (10/10 to 20/10)', async () => {
      await expect(
        calendarOccurrenceService.create({
          type: CalendarOccurrenceType.EXCEPTIONAL_DAY_OFF,
          title: 'Folga',
          startDate: '2026-10-10',
          endDate: '2026-10-20',
        })
      ).rejects.toThrow(AppError);
    });

    it('should allow non-overlapping period immediately after (21/10 to 22/10)', async () => {
      const created = await calendarOccurrenceService.create({
        type: CalendarOccurrenceType.EXCEPTIONAL_DAY_OFF,
        title: 'Folga Permitida',
        startDate: '2026-10-21',
        endDate: '2026-10-22',
      });
      expect(created.id).toBeDefined();
    });

    it('should allow overlapping period if conflicting occurrence was soft deleted', async () => {
      const list = await calendarOccurrenceService.list('2026-10-01', '2026-10-31');
      await calendarOccurrenceService.softDelete(list[0].id);

      const created = await calendarOccurrenceService.create({
        type: CalendarOccurrenceType.VACATION,
        title: 'Novas Férias',
        startDate: '2026-10-10',
        endDate: '2026-10-20',
      });
      expect(created.id).toBeDefined();
    });

    it('should allow editing an occurrence without conflicting with itself', async () => {
      const list = await calendarOccurrenceService.list('2026-10-01', '2026-10-31');
      const targetId = list[0].id;

      const updated = await calendarOccurrenceService.update(targetId, {
        type: CalendarOccurrenceType.VACATION,
        title: 'Férias Atualizadas',
        startDate: '2026-10-10',
        endDate: '2026-10-20',
        note: 'Nota adicionada',
      });
      expect(updated.title).toBe('Férias Atualizadas');
    });
  });
});
