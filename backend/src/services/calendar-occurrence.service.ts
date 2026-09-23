import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { userRepository } from '../repositories/user.repository';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
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
  private async getDefaultUser() {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }
    return user;
  }

  async list(fromStr: string, toStr: string): Promise<CalendarOccurrenceDTO[]> {
    const user = await this.getDefaultUser();
    const fromDate = parseDateToUtcMidnight(fromStr);
    const toDate = parseDateToUtcMidnight(toStr);

    const occurrences = await calendarOccurrenceRepository.findActiveInRange(
      user.id,
      fromDate,
      toDate
    );

    return occurrences
      .map((occ) => formatCalendarOccurrenceDTO(occ))
      .filter((dto): dto is CalendarOccurrenceDTO => dto !== null);
  }

  async create(dto: CreateCalendarOccurrenceInput): Promise<CalendarOccurrenceDTO> {
    const user = await this.getDefaultUser();
    const startDate = parseDateToUtcMidnight(dto.startDate);
    const endDate = parseDateToUtcMidnight(dto.endDate);

    const created = await prisma.$transaction(async (tx) => {
      const conflict = await calendarOccurrenceRepository.findConflicting(
        tx,
        user.id,
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
        userId: user.id,
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

  async update(id: string, dto: UpdateCalendarOccurrenceInput): Promise<CalendarOccurrenceDTO> {
    const user = await this.getDefaultUser();
    const startDate = parseDateToUtcMidnight(dto.startDate);
    const endDate = parseDateToUtcMidnight(dto.endDate);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await calendarOccurrenceRepository.findById(id, user.id);
      if (!existing) {
        throw new AppError('Ocorrência não encontrada.', 404, 'CALENDAR_OCCURRENCE_NOT_FOUND');
      }

      const conflict = await calendarOccurrenceRepository.findConflicting(
        tx,
        user.id,
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

      return calendarOccurrenceRepository.update(tx, id, user.id, {
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

  async softDelete(id: string): Promise<void> {
    const user = await this.getDefaultUser();
    const existing = await calendarOccurrenceRepository.findById(id, user.id);
    if (!existing) {
      throw new AppError('Ocorrência não encontrada.', 404, 'CALENDAR_OCCURRENCE_NOT_FOUND');
    }

    await calendarOccurrenceRepository.softDelete(user.id, id);
  }
}

export const calendarOccurrenceService = new CalendarOccurrenceService();
