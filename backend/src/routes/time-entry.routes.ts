import { Router } from 'express';
import { timeEntryController } from '../controllers/time-entry.controller';

const timeEntryRouter = Router();

timeEntryRouter.post('/clock-in', (req, res, next) => timeEntryController.clockIn(req, res, next));
timeEntryRouter.post('/clock-out', (req, res, next) => timeEntryController.clockOut(req, res, next));

export { timeEntryRouter };
