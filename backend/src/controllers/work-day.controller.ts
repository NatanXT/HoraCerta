import { Request, Response, NextFunction } from 'express';
import { workDayService } from '../services/work-day.service';
import { getWorkDayByDateSchema, getMonthlyWorkDaysSchema } from '../schemas/work-day.schema';
import { AppError } from '../errors/app-error';

export class WorkDayController {
  async getToday(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await workDayService.getTodaySummary();
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  }

  async getMonthly(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = getMonthlyWorkDaysSchema.safeParse(req.query);
      if (!parseResult.success) {
        throw new AppError(
          parseResult.error.errors[0]?.message || 'Formato de mês inválido. Utilize YYYY-MM.',
          400,
          'INVALID_MONTH'
        );
      }
      const { month } = parseResult.data;
      const response = await workDayService.getMonthlySummary(month);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getByDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = getWorkDayByDateSchema.safeParse(req.params);
      if (!parseResult.success) {
        throw new AppError(
          parseResult.error.errors[0]?.message || 'Data inválida.',
          400,
          'INVALID_DATE'
        );
      }
      const { date } = parseResult.data;
      const summary = await workDayService.getWorkDaySummaryByDateStr(date);
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  }
}

export const workDayController = new WorkDayController();
