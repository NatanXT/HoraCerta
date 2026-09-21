import { Request, Response, NextFunction } from 'express';
import { timeEntryService } from '../services/time-entry.service';

export class TimeEntryController {
  async clockIn(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await timeEntryService.clockIn();
      res.status(201).json(summary);
    } catch (error) {
      next(error);
    }
  }

  async clockOut(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await timeEntryService.clockOut();
      res.status(201).json(summary);
    } catch (error) {
      next(error);
    }
  }
}

export const timeEntryController = new TimeEntryController();
