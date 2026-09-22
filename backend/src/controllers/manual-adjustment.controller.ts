import { Request, Response, NextFunction } from 'express';
import { manualAdjustmentService } from '../services/manual-adjustment.service';
import { manualAdjustmentSchema } from '../schemas/manual-adjustment.schema';
import { dateParamSchema } from '../schemas/work-day.schema';
import { AppError } from '../errors/app-error';

export class ManualAdjustmentController {
  async saveAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dateParse = dateParamSchema.safeParse(req.params.date);
      if (!dateParse.success) {
        throw new AppError(
          'Data inválida. Utilize uma data real no formato YYYY-MM-DD.',
          400,
          'INVALID_DATE'
        );
      }

      const parseResult = manualAdjustmentSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || 'Dados de ajuste manual inválidos.';
        throw new AppError(firstError, 400, 'INVALID_MANUAL_ADJUSTMENT');
      }

      const result = await manualAdjustmentService.saveAdjustment(dateParse.data, parseResult.data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dateParse = dateParamSchema.safeParse(req.params.date);
      if (!dateParse.success) {
        throw new AppError(
          'Data inválida. Utilize uma data real no formato YYYY-MM-DD.',
          400,
          'INVALID_DATE'
        );
      }

      const result = await manualAdjustmentService.getAdjustments(dateParse.data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const manualAdjustmentController = new ManualAdjustmentController();
