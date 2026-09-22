import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeEntryService } from './time-entry.service';
import { userRepository } from '../repositories/user.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import { timeEntryRepository } from '../repositories/time-entry.repository';
import { prisma } from '../lib/prisma';
import { TimeEntryType, TimeEntrySource, Weekday } from '@prisma/client';
import { workDayService } from './work-day.service';

describe('TimeEntryService - clockIn & snapshot persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T08:00:00.000Z'));

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => {
      return cb(prisma);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve persistir expectedMinutesSnapshot ao criar primeiro WorkDay no primeiro CLOCK_IN', async () => {
    const mockUser = {
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);

    vi.spyOn(workScheduleRepository, 'findByUserAndWeekday').mockResolvedValue({
      id: 'sched-1',
      userId: 'user-1',
      weekday: Weekday.MONDAY,
      expectedMinutes: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockWorkDayCreated: WorkDayWithEntries = {
      id: 'wd-new',
      userId: 'user-1',
      date: new Date('2026-09-21T00:00:00.000Z'),
      note: null,
      expectedMinutesSnapshot: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeEntries: [],
    };

    const findOrCreateSpy = vi
      .spyOn(workDayRepository, 'findOrCreateByUserAndDate')
      .mockResolvedValue(mockWorkDayCreated);

    const createEntrySpy = vi
      .spyOn(timeEntryRepository, 'create')
      .mockResolvedValue({
        id: 'te-1',
        workDayId: 'wd-new',
        type: TimeEntryType.CLOCK_IN,
        timestamp: new Date('2026-09-21T08:00:00.000Z'),
        source: TimeEntrySource.CLOCK,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    vi.spyOn(workDayService, 'getWorkDaySummaryByDateStr').mockResolvedValue({
      date: '2026-09-21',
      expectedMinutes: 480,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: -480,
      isOpen: true,
      nextAction: TimeEntryType.CLOCK_OUT,
      entries: [],
    });

    await timeEntryService.clockIn();

    expect(findOrCreateSpy).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
      480,
      expect.anything()
    );

    expect(createEntrySpy).toHaveBeenCalledWith(
      'wd-new',
      TimeEntryType.CLOCK_IN,
      expect.any(Date),
      expect.anything()
    );
  });

  it('não deve alterar expectedMinutesSnapshot quando já existir WorkDay criado, mesmo se o WorkSchedule mudar', async () => {
    const mockUser = {
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);

    vi.spyOn(workScheduleRepository, 'findByUserAndWeekday').mockResolvedValue({
      id: 'sched-1',
      userId: 'user-1',
      weekday: Weekday.MONDAY,
      expectedMinutes: 360,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const existingWorkDay: WorkDayWithEntries = {
      id: 'wd-existing',
      userId: 'user-1',
      date: new Date('2026-09-21T00:00:00.000Z'),
      note: null,
      expectedMinutesSnapshot: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeEntries: [
        {
          id: 'te-1',
          workDayId: 'wd-existing',
          type: TimeEntryType.CLOCK_IN,
          timestamp: new Date('2026-09-21T08:00:00.000Z'),
          source: TimeEntrySource.CLOCK,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'te-2',
          workDayId: 'wd-existing',
          type: TimeEntryType.CLOCK_OUT,
          timestamp: new Date('2026-09-21T12:00:00.000Z'),
          source: TimeEntrySource.CLOCK,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    vi.spyOn(workDayRepository, 'findOrCreateByUserAndDate').mockResolvedValue(existingWorkDay);

    vi.spyOn(timeEntryRepository, 'create').mockResolvedValue({
      id: 'te-3',
      workDayId: 'wd-existing',
      type: TimeEntryType.CLOCK_IN,
      timestamp: new Date('2026-09-21T13:00:00.000Z'),
      source: TimeEntrySource.CLOCK,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(workDayService, 'getWorkDaySummaryByDateStr').mockResolvedValue({
      date: '2026-09-21',
      expectedMinutes: 480,
      workedMinutes: 240,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 240,
      balanceMinutes: -240,
      isOpen: true,
      nextAction: TimeEntryType.CLOCK_OUT,
      entries: [],
    });

    await timeEntryService.clockIn();

    expect(existingWorkDay.expectedMinutesSnapshot).toBe(480);
  });
});
