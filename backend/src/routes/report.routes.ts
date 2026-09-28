import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const reportRouter = Router();

reportRouter.use(requireAuth);

reportRouter.get('/work-hours', (req, res, next) =>
  reportController.getWorkHoursReport(req, res, next)
);
reportRouter.get('/work-hours.csv', (req, res, next) =>
  reportController.downloadWorkHoursCsv(req, res, next)
);

export { reportRouter };
