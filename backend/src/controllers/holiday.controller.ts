import { Request, Response, NextFunction } from 'express';
import { holidayService } from '../services/holiday.service';
import { syncHolidaysSchema, getHolidaysQuerySchema } from '../schemas/holiday.schema';
import { AppError } from '../errors/app-error';

export class HolidayController {
  async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = syncHolidaysSchema.safeParse(req.body);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(
          issue?.message || 'Dados inválidos para sincronização de feriados.',
          400,
          'INVALID_INPUT'
        );
      }

      const { year } = parseResult.data;
      const result = await holidayService.syncNationalHolidays(year);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = getHolidaysQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(
          issue?.message || 'Parâmetro year inválido na consulta de feriados.',
          400,
          'INVALID_QUERY_PARAMS'
        );
      }

      const { year } = parseResult.data;
      const holidays = await holidayService.getHolidaysByYear(year);
      res.status(200).json(holidays);
    } catch (error) {
      next(error);
    }
  }
}

export const holidayController = new HolidayController();
