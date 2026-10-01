import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
import { bankHoursConfigRepository } from '../repositories/bank-hours-config.repository';
import { parseDateToUtcMidnight } from '../utils/date';
import {
  CreateCalendarOccurrenceInput,
  UpdateCalendarOccurrenceInput,
} from '../schemas/calendar-occurrence.schema';
import {
  CalendarOccurrenceDTO,
  formatCalendarOccurrenceDTO,
} from '../types/calendar-occurrence.dto';

export class CalendarOccurrenceService {
  async list(userId: string, fromStr: string, toStr: string): Promise<CalendarOccurrenceDTO[]> {
    const fromDate = parseDateToUtcMidnight(fromStr);
    const toDate = parseDateToUtcMidnight(toStr);

    const occurrences = await calendarOccurrenceRepository.findActiveInRange(
      userId,
      fromDate,
      toDate
    );

    return occurrences
      .map((occ) => formatCalendarOccurrenceDTO(occ))
      .filter((dto): dto is CalendarOccurrenceDTO => dto !== null);
  }

  async create(userId: string, dto: CreateCalendarOccurrenceInput): Promise<CalendarOccurrenceDTO> {
    const startDate = parseDateToUtcMidnight(dto.startDate);
    const endDate = parseDateToUtcMidnight(dto.endDate);

    if (dto.type === 'BANK_HOURS_LEAVE') {
      const bankConfig = await bankHoursConfigRepository.findByUserId(userId);
      if (!bankConfig) {
        throw new AppError(
          'Configure o banco de horas antes de registrar uma folga usando saldo.',
          400,
          'BANK_HOURS_NOT_CONFIGURED'
        );
      }
      if (startDate.getTime() < bankConfig.startDate.getTime()) {
        throw new AppError(
          'A data da folga por banco de horas não pode ser anterior à data de início do banco de horas configurado.',
          400,
          'BANK_HOURS_LEAVE_BEFORE_START_DATE'
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const conflict = await calendarOccurrenceRepository.findConflicting(
        tx,
        userId,
        startDate,
        endDate
      );

      if (conflict) {
        throw new AppError(
          'Já existe uma ocorrência cadastrada que sobrepõe este período.',
          409,
          'CALENDAR_OCCURRENCE_CONFLICT'
        );
      }

      return calendarOccurrenceRepository.create(tx, {
        userId,
        type: dto.type,
        title: dto.title,
        startDate,
        endDate,
        note: dto.note || null,
      });
    });

    const dtoResult = formatCalendarOccurrenceDTO(created);
    if (!dtoResult) {
      throw new AppError('Erro ao formatar ocorrência criada.', 500, 'INTERNAL_SERVER_ERROR');
    }
    return dtoResult;
  }

  async update(userId: string, id: string, dto: UpdateCalendarOccurrenceInput): Promise<CalendarOccurrenceDTO> {
    const startDate = parseDateToUtcMidnight(dto.startDate);
    const endDate = parseDateToUtcMidnight(dto.endDate);

    if (dto.type === 'BANK_HOURS_LEAVE') {
      const bankConfig = await bankHoursConfigRepository.findByUserId(userId);
      if (!bankConfig) {
        throw new AppError(
          'Configure o banco de horas antes de registrar uma folga usando saldo.',
          400,
          'BANK_HOURS_NOT_CONFIGURED'
        );
      }
      if (startDate.getTime() < bankConfig.startDate.getTime()) {
        throw new AppError(
          'A data da folga por banco de horas não pode ser anterior à data de início do banco de horas configurado.',
          400,
          'BANK_HOURS_LEAVE_BEFORE_START_DATE'
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await calendarOccurrenceRepository.findById(id, userId);
      if (!existing) {
        throw new AppError('Ocorrência não encontrada.', 404, 'CALENDAR_OCCURRENCE_NOT_FOUND');
      }

      const conflict = await calendarOccurrenceRepository.findConflicting(
        tx,
        userId,
        startDate,
        endDate,
        id
      );

      if (conflict) {
        throw new AppError(
          'Já existe uma ocorrência cadastrada que sobrepõe este período.',
          409,
          'CALENDAR_OCCURRENCE_CONFLICT'
        );
      }

      return calendarOccurrenceRepository.update(tx, id, userId, {
        type: dto.type,
        title: dto.title,
        startDate,
        endDate,
        note: dto.note || null,
      });
    });

    const dtoResult = formatCalendarOccurrenceDTO(updated);
    if (!dtoResult) {
      throw new AppError('Erro ao formatar ocorrência atualizada.', 500, 'INTERNAL_SERVER_ERROR');
    }
    return dtoResult;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const existing = await calendarOccurrenceRepository.findById(id, userId);
    if (!existing) {
      throw new AppError('Ocorrência não encontrada.', 404, 'CALENDAR_OCCURRENCE_NOT_FOUND');
    }

    await calendarOccurrenceRepository.softDelete(userId, id);
  }
}

export const calendarOccurrenceService = new CalendarOccurrenceService();
