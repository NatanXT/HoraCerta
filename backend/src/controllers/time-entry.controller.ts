import { Request, Response, NextFunction } from 'express';
import { timeEntryService } from '../services/time-entry.service';

export class TimeEntryController {
  async clockIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const summary = await timeEntryService.clockIn(userId);
      res.status(201).json(summary);
    } catch (error) {
      next(error);
    }
  }

  async clockOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const summary = await timeEntryService.clockOut(userId);
      res.status(201).json(summary);
    } catch (error) {
      next(error);
    }
  }
}

export const timeEntryController = new TimeEntryController();
