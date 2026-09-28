import { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/profile.service';
import { updateProfileSchema, updateWorkScheduleSchema } from '../schemas/profile.schema';

export class ProfileController {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const profile = await profileService.getProfile(userId);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const input = updateProfileSchema.parse(req.body);
      const profile = await profileService.updateProfile(userId, input);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }

  async updateWorkSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const input = updateWorkScheduleSchema.parse(req.body);
      const profile = await profileService.updateWorkSchedule(userId, input);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }
}

export const profileController = new ProfileController();
