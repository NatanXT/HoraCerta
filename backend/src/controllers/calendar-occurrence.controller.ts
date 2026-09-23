import { Request, Response, NextFunction } from 'express';
import { calendarOccurrenceService } from '../services/calendar-occurrence.service';
import {
  calendarOccurrenceQuerySchema,
  createCalendarOccurrenceSchema,
  updateCalendarOccurrenceSchema,
} from '../schemas/calendar-occurrence.schema';
import { AppError } from '../errors/app-error';

export class CalendarOccurrenceController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = calendarOccurrenceQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(
          issue?.message || 'Parâmetros de busca por período inválidos.',
          400,
          'INVALID_QUERY_PARAMS'
        );
      }
      const { from, to } = parseResult.data;
      const occurrences = await calendarOccurrenceService.list(from, to);
      res.status(200).json(occurrences);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = createCalendarOccurrenceSchema.safeParse(req.body);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(
          issue?.message || 'Dados inválidos para criação de ocorrência.',
          400,
          'INVALID_INPUT'
        );
      }
      const created = await calendarOccurrenceService.create(parseResult.data);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idParam = req.params.id;
      const id = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!id) {
        throw new AppError('ID da ocorrência é obrigatório.', 400, 'INVALID_INPUT');
      }
      const parseResult = updateCalendarOccurrenceSchema.safeParse(req.body);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(
          issue?.message || 'Dados inválidos para atualização de ocorrência.',
          400,
          'INVALID_INPUT'
        );
      }
      const updated = await calendarOccurrenceService.update(id, parseResult.data);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idParam = req.params.id;
      const id = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!id) {
        throw new AppError('ID da ocorrência é obrigatório.', 400, 'INVALID_INPUT');
      }
      await calendarOccurrenceService.softDelete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const calendarOccurrenceController = new CalendarOccurrenceController();
