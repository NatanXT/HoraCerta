import { Request, Response } from 'express';

export class HealthController {
  public check(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
      service: 'hora-certa-api',
      timestamp: new Date().toISOString(),
    });
  }
}

export const healthController = new HealthController();
