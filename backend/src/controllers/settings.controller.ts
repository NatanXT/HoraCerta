import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';
import { updateProfileSchema, updateWorkScheduleSchema } from '../schemas/settings.schema';
import { AppError } from '../errors/app-error';

export class SettingsController {
  async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await settingsService.getSettings();
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = updateProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          parseResult.error.errors[0]?.message || 'Perfil inválido.',
          400,
          'INVALID_PROFILE'
        );
      }

      const response = await settingsService.updateProfile(parseResult.data);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async updateWorkSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = updateWorkScheduleSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          parseResult.error.errors[0]?.message || 'Jornada semanal inválida.',
          400,
          'INVALID_WORK_SCHEDULE'
        );
      }

      const response = await settingsService.updateWorkSchedule(parseResult.data.days);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
