import { Request, Response, NextFunction } from 'express';
import { appearanceService } from '../services/appearance.service';
import { updateAppearanceSchema } from '../schemas/appearance.schema';

export class AppearanceController {
  async getAppearance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const preferences = await appearanceService.getPreferences(userId);
      res.json(preferences);
    } catch (err) {
      next(err);
    }
  }

  async updateAppearance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const input = updateAppearanceSchema.parse(req.body);
      const updated = await appearanceService.updatePreferences(userId, input);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
}

export const appearanceController = new AppearanceController();
