import { Router } from 'express';
import { healthRouter } from './health.routes';
import { workDayRouter } from './work-day.routes';
import { timeEntryRouter } from './time-entry.routes';

const routes = Router();

routes.use('/health', healthRouter);
routes.use('/api/work-days', workDayRouter);
routes.use('/api/time-entries', timeEntryRouter);

export { routes };
