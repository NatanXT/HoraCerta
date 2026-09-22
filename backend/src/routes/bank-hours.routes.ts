import { Router } from 'express';
import { bankHoursController } from '../controllers/bank-hours.controller';

const bankHoursRouter = Router();

bankHoursRouter.get('/', (req, res, next) => bankHoursController.getStatus(req, res, next));
bankHoursRouter.put('/config', (req, res, next) => bankHoursController.saveConfig(req, res, next));

export { bankHoursRouter };
