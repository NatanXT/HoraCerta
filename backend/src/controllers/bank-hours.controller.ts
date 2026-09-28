import { Request, Response, NextFunction } from 'express';
import { bankHoursService } from '../services/bank-hours.service';
import { saveBankHoursConfigSchema } from '../schemas/bank-hours.schema';
import { AppError } from '../errors/app-error';

export class BankHoursController {
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const response = await bankHoursService.getBankHoursStatus(userId);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async saveConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const parseResult = saveBankHoursConfigSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          parseResult.error.errors[0]?.message || 'Configuração inválida.',
          400,
          'INVALID_BANK_CONFIG'
        );
      }
      const { startDate, initialBalanceMinutes } = parseResult.data;
      const response = await bankHoursService.saveConfig(userId, startDate, initialBalanceMinutes);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const bankHoursController = new BankHoursController();
