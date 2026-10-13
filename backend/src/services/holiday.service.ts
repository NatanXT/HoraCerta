import { Holiday } from '@prisma/client';
import { HolidayProvider } from '../providers/holiday-provider';
import { BrasilApiHolidayProvider } from '../providers/brasil-api-holiday.provider';
import { HolidayRepository, holidayRepository, UpsertHolidayData } from '../repositories/holiday.repository';
import { HolidayDTO, formatHolidayDTO } from '../types/holiday.dto';
import { parseDateToUtcMidnight } from '../utils/date';
import { AppError } from '../errors/app-error';

export interface SyncHolidaysResultDto {
  year: number;
  synced: number;
  holidays: HolidayDTO[];
}

export class HolidayService {
  constructor(
    private provider: HolidayProvider = new BrasilApiHolidayProvider(),
    private repository: HolidayRepository = holidayRepository
  ) {}

  async syncNationalHolidays(year: number): Promise<SyncHolidaysResultDto> {
    if (!Number.isInteger(year) || year < 1970 || year > 2100) {
      throw new AppError(`Ano inválido para sincronização: ${year}`, 400, 'INVALID_YEAR');
    }

    const items = await this.provider.getNationalHolidays(year);

    const upsertData: UpsertHolidayData[] = items.map((item) => {
      const dateUtcMidnight = parseDateToUtcMidnight(item.date);
      const providerKey = `BRASIL_API:NATIONAL:${item.date}`;

      return {
        date: dateUtcMidnight,
        year,
        name: item.name,
        provider: 'BRASIL_API',
        providerKey,
      };
    });

    const persisted = await this.repository.upsertMany(upsertData);

    const holidaysDto = persisted
      .map((h) => formatHolidayDTO(h))
      .filter((h): h is HolidayDTO => h !== null);

    return {
      year,
      synced: holidaysDto.length,
      holidays: holidaysDto,
    };
  }

  async getHolidaysByYear(year: number): Promise<HolidayDTO[]> {
    if (!Number.isInteger(year) || year < 1970 || year > 2100) {
      throw new AppError(`Ano inválido: ${year}`, 400, 'INVALID_YEAR');
    }

    const persisted = await this.repository.findByYear(year);

    return persisted
      .map((h) => formatHolidayDTO(h))
      .filter((h): h is HolidayDTO => h !== null);
  }

  async getHolidaysInRange(startDate: Date, endDate: Date): Promise<Holiday[]> {
    return this.repository.findByDateRange(startDate, endDate);
  }
}

export const holidayService = new HolidayService();
