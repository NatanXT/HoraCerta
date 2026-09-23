import { Router } from 'express';
import { reportController } from '../controllers/report.controller';

const reportRouter = Router();

reportRouter.get('/work-hours', (req, res, next) =>
  reportController.getWorkHoursReport(req, res, next)
);
reportRouter.get('/work-hours.csv', (req, res, next) =>
  reportController.downloadWorkHoursCsv(req, res, next)
);

export { reportRouter };
