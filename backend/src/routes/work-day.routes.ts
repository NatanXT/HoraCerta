import { Router } from 'express';
import { workDayController } from '../controllers/work-day.controller';

const workDayRouter = Router();

workDayRouter.get('/today', (req, res, next) => workDayController.getToday(req, res, next));
workDayRouter.get('/:date', (req, res, next) => workDayController.getByDate(req, res, next));

export { workDayRouter };
