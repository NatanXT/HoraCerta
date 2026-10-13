import { Router } from 'express';
import { holidayController } from '../controllers/holiday.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const holidayRouter = Router();

holidayRouter.use(requireAuth);

holidayRouter.post('/sync', (req, res, next) => holidayController.sync(req, res, next));
holidayRouter.get('/', (req, res, next) => holidayController.list(req, res, next));

export { holidayRouter };
