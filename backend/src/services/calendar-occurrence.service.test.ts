import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calendarOccurrenceService } from './calendar-occurrence.service';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
import { prisma } from '../lib/prisma';
import { CalendarOccurrenceType } from '@prisma/client';
import { AppError } from '../errors/app-error';

const TEST_USER_ID = 'test-user-id';

describe('CalendarOccurrenceService (Mocked DB)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a calendar occurrence successfully', async () => {
    const mockCreated = {
      id: 'occ-1',
      userId: TEST_USER_ID,
      type: CalendarOccurrenceType.HOLIDAY,
      title: 'Feriado de Teste',
      startDate: new Date('2026-10-24T00:00:00.000Z'),
      endDate: new Date('2026-10-24T00:00:00.000Z'),
      note: 'Aniversário da cidade',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
    vi.spyOn(calendarOccurrenceRepository, 'findConflicting').mockResolvedValue(null);
    vi.spyOn(calendarOccurrenceRepository, 'create').mockResolvedValue(mockCreated as any);

    const created = await calendarOccurrenceService.create(TEST_USER_ID, {
      type: CalendarOccurrenceType.HOLIDAY,
      title: 'Feriado de Teste',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
      note: 'Aniversário da cidade',
    });

    expect(created.id).toBe('occ-1');
    expect(created.type).toBe('HOLIDAY');
    expect(created.title).toBe('Feriado de Teste');
    expect(created.startDate).toBe('2026-10-24');
    expect(created.endDate).toBe('2026-10-24');
    expect(created.note).toBe('Aniversário da cidade');
  });

  it('should list active occurrences within a date range', async () => {
    const mockList = [
      {
        id: 'occ-2',
        userId: TEST_USER_ID,
        type: CalendarOccurrenceType.VACATION,
        title: 'Férias de Outubro',
        startDate: new Date('2026-10-10T00:00:00.000Z'),
        endDate: new Date('2026-10-20T00:00:00.000Z'),
        note: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue(mockList as any);

    const list = await calendarOccurrenceService.list(TEST_USER_ID, '2026-10-01', '2026-10-31');
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Férias de Outubro');
  });

  it('should soft delete an occurrence and hide it from list', async () => {
    const mockExisting = {
      id: 'occ-3',
      userId: TEST_USER_ID,
      type: CalendarOccurrenceType.HOLIDAY,
      title: 'Feriado a excluir',
      startDate: new Date('2026-11-15T00:00:00.000Z'),
      endDate: new Date('2026-11-15T00:00:00.000Z'),
      note: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(calendarOccurrenceRepository, 'findById').mockResolvedValue(mockExisting as any);
    vi.spyOn(calendarOccurrenceRepository, 'softDelete').mockResolvedValue({ ...mockExisting, deletedAt: new Date() } as any);

    await calendarOccurrenceService.softDelete(TEST_USER_ID, 'occ-3');
    expect(calendarOccurrenceRepository.softDelete).toHaveBeenCalledWith(TEST_USER_ID, 'occ-3');
  });

  it('should update an existing occurrence', async () => {
    const mockExisting = {
      id: 'occ-4',
      userId: TEST_USER_ID,
      type: CalendarOccurrenceType.MEDICAL_LEAVE,
      title: 'Atestado',
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-12-02T00:00:00.000Z'),
      note: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdated = {
      ...mockExisting,
      title: 'Atestado Prorrogado',
      endDate: new Date('2026-12-03T00:00:00.000Z'),
      note: 'Instrução médica',
    };

    vi.spyOn(calendarOccurrenceRepository, 'findById').mockResolvedValue(mockExisting as any);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
    vi.spyOn(calendarOccurrenceRepository, 'findConflicting').mockResolvedValue(null);
    vi.spyOn(calendarOccurrenceRepository, 'update').mockResolvedValue(mockUpdated as any);

    const updated = await calendarOccurrenceService.update(TEST_USER_ID, 'occ-4', {
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
    it('should reject overlapping period when findConflicting finds an occurrence', async () => {
      const mockConflicting = {
        id: 'occ-conflict',
        userId: TEST_USER_ID,
        type: CalendarOccurrenceType.VACATION,
        title: 'Férias Ativas',
        startDate: new Date('2026-10-10T00:00:00.000Z'),
        endDate: new Date('2026-10-20T00:00:00.000Z'),
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(calendarOccurrenceRepository, 'findConflicting').mockResolvedValue(mockConflicting as any);

      await expect(
        calendarOccurrenceService.create(TEST_USER_ID, {
          type: CalendarOccurrenceType.HOLIDAY,
          title: 'Feriado',
          startDate: '2026-10-09',
          endDate: '2026-10-10',
        })
      ).rejects.toThrow(AppError);
    });
  });
});
