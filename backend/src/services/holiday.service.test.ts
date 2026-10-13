import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HolidayService } from './holiday.service';
import { HolidayProvider, HolidayProviderItem } from '../providers/holiday-provider';
import { HolidayRepository } from '../repositories/holiday.repository';
import { resolveWorkDayState } from '../utils/work-day-status';
import { parseDateToUtcMidnight, getWeekdayFromCivilDate } from '../utils/date';
import { Holiday, CalendarOccurrence, Weekday } from '@prisma/client';
import { AppError } from '../errors/app-error';

describe('HolidayService & Holiday Integration Rules', () => {
  let inMemoryHolidays: Map<string, Holiday>;
  let mockRepository: HolidayRepository;
  let mockProvider: HolidayProvider;
  let holidayService: HolidayService;

  beforeEach(() => {
    inMemoryHolidays = new Map();

    mockRepository = {
      findByYear: vi.fn(async (year: number) => {
        return Array.from(inMemoryHolidays.values())
          .filter((h) => h.year === year)
          .sort((a, b) => a.date.getTime() - b.date.getTime());
      }),
      findByDateRange: vi.fn(async (startDate: Date, endDate: Date) => {
        return Array.from(inMemoryHolidays.values())
          .filter((h) => h.date >= startDate && h.date <= endDate)
          .sort((a, b) => a.date.getTime() - b.date.getTime());
      }),
      findByProviderKey: vi.fn(async (providerKey: string) => {
        return inMemoryHolidays.get(providerKey) ?? null;
      }),
      upsert: vi.fn(async (data) => {
        const existing = inMemoryHolidays.get(data.providerKey);
        const saved: Holiday = {
          id: existing ? existing.id : `hol-${Math.random().toString(36).substring(2, 9)}`,
          date: data.date,
          year: data.year,
          name: data.name,
          provider: data.provider,
          providerKey: data.providerKey,
          syncedAt: new Date(),
          createdAt: existing ? existing.createdAt : new Date(),
          updatedAt: new Date(),
        };
        inMemoryHolidays.set(data.providerKey, saved);
        return saved;
      }),
      upsertMany: vi.fn(async (items) => {
        const results: Holiday[] = [];
        for (const item of items) {
          const existing = inMemoryHolidays.get(item.providerKey);
          const saved: Holiday = {
            id: existing ? existing.id : `hol-${Math.random().toString(36).substring(2, 9)}`,
            date: item.date,
            year: item.year,
            name: item.name,
            provider: item.provider,
            providerKey: item.providerKey,
            syncedAt: new Date(),
            createdAt: existing ? existing.createdAt : new Date(),
            updatedAt: new Date(),
          };
          inMemoryHolidays.set(item.providerKey, saved);
          results.push(saved);
        }
        return results.sort((a, b) => a.date.getTime() - b.date.getTime());
      }),
    } as unknown as HolidayRepository;

    mockProvider = {
      getNationalHolidays: vi.fn(),
    };

    holidayService = new HolidayService(mockProvider, mockRepository);
  });

  // 36. TESTES — HOLIDAY PROVIDER
  describe('36. Holiday Provider Normalization', () => {
    it('normalizes provider items into valid civil date and name DTOs', async () => {
      vi.mocked(mockProvider.getNationalHolidays).mockResolvedValue([
        { date: '2026-01-01', name: 'Confraternização Universal' },
        { date: '2026-04-21', name: 'Tiradentes' },
      ]);

      const result = await holidayService.syncNationalHolidays(2026);

      expect(result.year).toBe(2026);
      expect(result.synced).toBe(2);
      expect(result.holidays).toHaveLength(2);
      expect(result.holidays[0]).toEqual({
        id: expect.any(String),
        date: '2026-01-01',
        name: 'Confraternização Universal',
        source: 'BRASIL_API',
      });
      expect(result.holidays[1]).toEqual({
        id: expect.any(String),
        date: '2026-04-21',
        name: 'Tiradentes',
        source: 'BRASIL_API',
      });
    });
  });

  // 37. TESTE — SYNC IDEMPOTENTE
  describe('37. Idempotent Sync', () => {
    it('running sync multiple times yields exact same count and no duplicates', async () => {
      const providerHolidays: HolidayProviderItem[] = [
        { date: '2026-01-01', name: 'Confraternização Universal' },
        { date: '2026-04-21', name: 'Tiradentes' },
        { date: '2026-05-01', name: 'Dia do Trabalho' },
      ];
      vi.mocked(mockProvider.getNationalHolidays).mockResolvedValue(providerHolidays);

      const firstSync = await holidayService.syncNationalHolidays(2026);
      expect(firstSync.synced).toBe(3);
      expect(inMemoryHolidays.size).toBe(3);

      const secondSync = await holidayService.syncNationalHolidays(2026);
      expect(secondSync.synced).toBe(3);
      expect(inMemoryHolidays.size).toBe(3);

      const persisted = await holidayService.getHolidaysByYear(2026);
      expect(persisted).toHaveLength(3);
    });
  });

  // 38. TESTE — ATUALIZAÇÃO
  describe('38. Holiday Name Update', () => {
    it('updates holiday name when provider updates it for the same date', async () => {
      vi.mocked(mockProvider.getNationalHolidays).mockResolvedValueOnce([
        { date: '2026-01-01', name: 'Ano Novo' },
      ]);

      await holidayService.syncNationalHolidays(2026);
      let list = await holidayService.getHolidaysByYear(2026);
      expect(list[0].name).toBe('Ano Novo');
      const initialId = list[0].id;

      // Provider returns updated name
      vi.mocked(mockProvider.getNationalHolidays).mockResolvedValueOnce([
        { date: '2026-01-01', name: 'Confraternização Universal' },
      ]);

      await holidayService.syncNationalHolidays(2026);
      list = await holidayService.getHolidaysByYear(2026);
      expect(list[0].id).toBe(initialId);
      expect(list[0].name).toBe('Confraternização Universal');
      expect(inMemoryHolidays.size).toBe(1);
    });
  });

  // 39. TESTE — JORNADA
  describe('39. Work Schedule on Holiday', () => {
    it('monday with schedule 480 minutes on a holiday has effectiveExpected = 0 and status EXCUSED', () => {
      const holiday: Holiday = {
        id: 'h-1',
        date: parseDateToUtcMidnight('2026-09-07'),
        year: 2026,
        name: 'Independência do Brasil',
        provider: 'BRASIL_API',
        providerKey: 'BRASIL_API:NATIONAL:2026-09-07',
        syncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = resolveWorkDayState({
        dateStr: '2026-09-07',
        todayStr: '2026-10-13',
        defaultExpectedMinutes: 480,
        workDay: null,
        holiday,
      });

      expect(state.expectedMinutes).toBe(0);
      expect(state.status).toBe('EXCUSED');
      expect(state.workedMinutes).toBe(0);
      expect(state.balanceMinutes).toBe(0);
      expect(state.holiday).toBe(holiday);
    });
  });

  // 40. TESTE — BANCO
  describe('40. Bank Impact on Holiday without records', () => {
    it('holiday without records produces bank impact = 0, never -480', () => {
      const holiday: Holiday = {
        id: 'h-2',
        date: parseDateToUtcMidnight('2026-05-01'),
        year: 2026,
        name: 'Dia do Trabalho',
        provider: 'BRASIL_API',
        providerKey: 'BRASIL_API:NATIONAL:2026-05-01',
        syncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = resolveWorkDayState({
        dateStr: '2026-05-01',
        todayStr: '2026-10-13',
        defaultExpectedMinutes: 480,
        workDay: null,
        holiday,
      });

      expect(state.status).toBe('EXCUSED');
      expect(state.expectedMinutes).toBe(0);
      expect(state.balanceMinutes).toBe(0);
      // Bank hours service relies on balanceMinutes === 0 and status EXCUSED -> 0 debit
    });
  });

  // 41. TESTE — BANK_HOURS_LEAVE + HOLIDAY
  describe('41. BANK_HOURS_LEAVE on a Holiday', () => {
    it('does not consume bank hours when BANK_HOURS_LEAVE coincides with a national holiday', () => {
      const holiday: Holiday = {
        id: 'h-3',
        date: parseDateToUtcMidnight('2026-04-21'),
        year: 2026,
        name: 'Tiradentes',
        provider: 'BRASIL_API',
        providerKey: 'BRASIL_API:NATIONAL:2026-04-21',
        syncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const bankLeaveOccurrence: CalendarOccurrence = {
        id: 'occ-bhl-1',
        userId: 'u1',
        type: 'BANK_HOURS_LEAVE',
        title: 'Folga por Banco de Horas',
        startDate: parseDateToUtcMidnight('2026-04-21'),
        endDate: parseDateToUtcMidnight('2026-04-21'),
        note: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = resolveWorkDayState({
        dateStr: '2026-04-21',
        todayStr: '2026-10-13',
        defaultExpectedMinutes: 480,
        workDay: null,
        occurrence: bankLeaveOccurrence,
        holiday,
      });

      expect(state.expectedMinutes).toBe(0);
      expect(state.status).toBe('EXCUSED');
      expect(state.balanceMinutes).toBe(0); // MUST NOT BE -480
    });
  });

  // 42. TESTE — DIA TRABALHADO EM FERIADO
  describe('42. Worked Day on a Holiday', () => {
    it('working 480 minutes on a holiday sets expected = 0 and balance = +480', () => {
      const holiday: Holiday = {
        id: 'h-4',
        date: parseDateToUtcMidnight('2026-11-02'),
        year: 2026,
        name: 'Finados',
        provider: 'BRASIL_API',
        providerKey: 'BRASIL_API:NATIONAL:2026-11-02',
        syncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const workDay = {
        id: 'wd-1',
        userId: 'u1',
        date: parseDateToUtcMidnight('2026-11-02'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          {
            id: 'e1',
            workDayId: 'wd-1',
            type: 'CLOCK_IN' as const,
            timestamp: new Date('2026-11-02T08:00:00.000Z'),
            source: 'CLOCK' as const,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'e2',
            workDayId: 'wd-1',
            type: 'CLOCK_OUT' as const,
            timestamp: new Date('2026-11-02T16:00:00.000Z'), // 8h = 480 min
            source: 'CLOCK' as const,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        workBreaks: [],
      };

      const state = resolveWorkDayState({
        dateStr: '2026-11-02',
        todayStr: '2026-11-10',
        defaultExpectedMinutes: 480,
        workDay: workDay as any,
        holiday,
      });

      expect(state.status).toBe('RECORDED');
      expect(state.expectedMinutes).toBe(0);
      expect(state.workedMinutes).toBe(480);
      expect(state.totalWorkedMinutes).toBe(480);
      expect(state.balanceMinutes).toBe(480);
    });
  });

  // 43. TESTE — API FORA
  describe('43. External API Outage Fallback', () => {
    it('returns persisted holidays when provider fails without deleting cached data', async () => {
      // Step 1: initial successful sync
      vi.mocked(mockProvider.getNationalHolidays).mockResolvedValueOnce([
        { date: '2026-12-25', name: 'Natal' },
      ]);
      await holidayService.syncNationalHolidays(2026);

      // Step 2: provider fails with network/timeout error
      vi.mocked(mockProvider.getNationalHolidays).mockRejectedValueOnce(
        new AppError('BrasilAPI offline', 502, 'HOLIDAY_PROVIDER_NETWORK_ERROR')
      );

      await expect(holidayService.syncNationalHolidays(2026)).rejects.toThrow('BrasilAPI offline');

      // Step 3: verify persisted holidays remain untouched
      const holidays = await holidayService.getHolidaysByYear(2026);
      expect(holidays).toHaveLength(1);
      expect(holidays[0].name).toBe('Natal');
    });
  });

  // 44. TESTE — TIMEZONE
  describe('44. Civil Date and Timezone Handling', () => {
    it('holiday 2026-09-07 remains 2026-09-07 and MONDAY under America/Sao_Paulo (UTC-3)', () => {
      const dateStr = '2026-09-07';
      const weekday = getWeekdayFromCivilDate(dateStr);
      expect(weekday).toBe(Weekday.MONDAY);

      const utcDate = parseDateToUtcMidnight(dateStr);
      const isoStr = utcDate.toISOString().substring(0, 10);
      expect(isoStr).toBe('2026-09-07');

      // Civil date string in America/Sao_Paulo must never shift backwards to 2026-09-06
      expect(isoStr).toBe('2026-09-07');
    });
  });
});
