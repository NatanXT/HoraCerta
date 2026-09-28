import { Request, Response, NextFunction } from 'express';
import { workSessionService } from '../services/work-session.service';
import { pauseSessionSchema } from '../schemas/work-session.schema';

export class WorkSessionController {
  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const result = await workSessionService.startSession(userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const { type } = pauseSessionSchema.parse(req.body);
      const result = await workSessionService.pauseSession(userId, type);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const result = await workSessionService.resumeSession(userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async finish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth!.userId;
      const result = await workSessionService.finishSession(userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const workSessionController = new WorkSessionController();
