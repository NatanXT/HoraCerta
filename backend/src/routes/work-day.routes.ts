import { Router } from 'express';
import { workDayController } from '../controllers/work-day.controller';
import { manualAdjustmentController } from '../controllers/manual-adjustment.controller';

const workDayRouter = Router();

workDayRouter.get('/today', (req, res, next) => workDayController.getToday(req, res, next));
workDayRouter.get('/monthly', (req, res, next) => workDayController.getMonthly(req, res, next));
workDayRouter.get('/:date/adjustments', (req, res, next) =>
  manualAdjustmentController.getAdjustments(req, res, next)
);
workDayRouter.put('/:date/manual-adjustment', (req, res, next) =>
  manualAdjustmentController.saveAdjustment(req, res, next)
);
workDayRouter.get('/:date', (req, res, next) => workDayController.getByDate(req, res, next));

export { workDayRouter };
