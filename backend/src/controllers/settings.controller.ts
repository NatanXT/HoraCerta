import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';
import { updateProfileSchema, updateWorkScheduleSchema } from '../schemas/settings.schema';
import { AppError } from '../errors/app-error';

export class SettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const response = await settingsService.getSettings(userId);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const parseResult = updateProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          parseResult.error.errors[0]?.message || 'Perfil inválido.',
          400,
          'INVALID_PROFILE'
        );
      }

      const response = await settingsService.updateProfile(userId, parseResult.data);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async updateWorkSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const parseResult = updateWorkScheduleSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          parseResult.error.errors[0]?.message || 'Jornada semanal inválida.',
          400,
          'INVALID_WORK_SCHEDULE'
        );
      }

      const response = await settingsService.updateWorkSchedule(userId, parseResult.data.days);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
